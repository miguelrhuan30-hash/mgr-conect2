import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, where, getDocs, Timestamp, orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, TimeEntry, UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { calcularTurnos, Turno, toDateStr, minutesToHHMM } from '../utils/shift-calculator';
import {
  adicionarRegistro, editarHorarioRegistro, excluirRegistro, TIPO_LABELS
} from '../utils/shift-editor';
import {
  Search, Loader2, Clock, AlertTriangle, CheckCircle,
  ChevronDown, ChevronUp, Plus, Trash2, Save, X,
  Filter, Calendar, User, History, AlertCircle, Edit2
} from 'lucide-react';

// ─── Status badge config ───────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  completo:    { label: 'Completo',     color: 'bg-green-100 text-green-700 border-green-200',   icon: CheckCircle },
  sem_almoco:  { label: 'Sem Almoço',   color: 'bg-blue-100 text-blue-700 border-blue-200',       icon: Clock },
  incompleto:  { label: 'Incompleto',   color: 'bg-orange-100 text-orange-700 border-orange-200', icon: AlertTriangle },
  sem_saida:   { label: 'Sem Saída',    color: 'bg-orange-100 text-orange-700 border-orange-200', icon: AlertTriangle },
  inconsistente: { label: 'Inconsistente', color: 'bg-red-100 text-red-700 border-red-200',       icon: AlertCircle },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatTime = (entry: TimeEntry | null) => {
  if (!entry) return null;
  return entry.timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const toLocalInput = (entry: TimeEntry | null): string => {
  if (!entry) return '';
  const d = entry.timestamp.toDate();
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
};

const hoje = (): string => toDateStr(new Date());

const FolhaPonto: React.FC = () => {
  const { userProfile, currentUser } = useAuth();
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'developer';
  const isGestor = userProfile?.role === 'gestor' || userProfile?.role === 'manager' || isAdmin;

  // ── Filtros ─────────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [colaboradorId, setColaboradorId] = useState<string>('');
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return toDateStr(d);
  });
  const [dataFim, setDataFim] = useState(hoje());
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'incompletos' | 'inconsistentes'>('todos');

  // ── Dados ───────────────────────────────────────────────────────────────────
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [rawEntries, setRawEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Edição inline ───────────────────────────────────────────────────────────
  const [turnoEmEdicao, setTurnoEmEdicao] = useState<string | null>(null); // data do turno
  const [editTimes, setEditTimes] = useState<Record<string, string>>({});
  const [editMotivo, setEditMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Adicionar registro faltante ─────────────────────────────────────────────
  const [addSlotTipo, setAddSlotTipo] = useState<string | null>(null);
  const [addSlotTime, setAddSlotTime] = useState('');

  // ── Histórico expandido ─────────────────────────────────────────────────────
  const [historicoAberto, setHistoricoAberto] = useState<string | null>(null);

  // ── Carregar lista de colaboradores ─────────────────────────────────────────
  useEffect(() => {
    const loadUsers = async () => {
      const snap = await getDocs(collection(db, CollectionName.USERS));
      let allUsers = snap.docs
        .map(d => ({ uid: d.id, ...d.data() } as UserProfile))
        .filter(u => u.role !== 'pending');

      // Gestor: filtrar apenas colaboradores do mesmo setor
      if (!isAdmin && isGestor && userProfile?.sectorId) {
        allUsers = allUsers.filter(u => u.sectorId === userProfile.sectorId);
      }

      // Técnico/Employee: apenas ele mesmo
      if (!isGestor) {
        allUsers = allUsers.filter(u => u.uid === currentUser?.uid);
        if (currentUser) setColaboradorId(currentUser.uid);
      }

      allUsers.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
      setUsers(allUsers);
    };
    if (currentUser) loadUsers();
  }, [currentUser, userProfile]);

  // ── Buscar registros ────────────────────────────────────────────────────────
  const buscarRegistros = async () => {
    const uid = colaboradorId || currentUser?.uid;
    if (!uid) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, CollectionName.TIME_ENTRIES),
        where('userId', '==', uid),
        where('timestamp', '>=', Timestamp.fromDate(new Date(dataInicio + 'T00:00:00'))),
        where('timestamp', '<=', Timestamp.fromDate(new Date(dataFim + 'T23:59:59.999'))),
        orderBy('timestamp', 'asc')
      );
      const snap = await getDocs(q);
      const entries = snap.docs.map(d => ({ id: d.id, ...d.data() } as TimeEntry));
      setRawEntries(entries);
      setTurnos(calcularTurnos(entries));
      setTurnoEmEdicao(null);
    } catch (err) {
      console.error('Erro ao buscar registros:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Filtrar por status ──────────────────────────────────────────────────────
  const turnosFiltrados = useMemo(() => {
    if (filtroStatus === 'todos') return turnos;
    if (filtroStatus === 'incompletos') {
      return turnos.filter(t => t.status === 'sem_saida' || t.status === 'incompleto');
    }
    return turnos.filter(t => t.inconsistente);
  }, [turnos, filtroStatus]);

  // ── Expandir turno para edição ──────────────────────────────────────────────
  const expandirTurno = (turno: Turno) => {
    if (turnoEmEdicao === turno.data) {
      setTurnoEmEdicao(null);
      return;
    }
    setTurnoEmEdicao(turno.data);
    setEditTimes({
      entry: toLocalInput(turno.entry),
      lunch_start: toLocalInput(turno.lunchStart),
      lunch_end: toLocalInput(turno.lunchEnd),
      exit: toLocalInput(turno.exit),
    });
    setEditMotivo('');
    setAddSlotTipo(null);
    setAddSlotTime('');
  };

  // ── Salvar edição de horário ────────────────────────────────────────────────
  const salvarEdicao = async (turno: Turno, tipo: 'entry' | 'lunch_start' | 'lunch_end' | 'exit') => {
    const uid = colaboradorId || currentUser?.uid;
    if (!uid || !currentUser || !editMotivo.trim()) {
      alert('Informe o motivo da correção antes de salvar.');
      return;
    }
    const adminNome = userProfile?.displayName || currentUser.email || currentUser.uid;
    const novoTime = editTimes[tipo];
    if (!novoTime) return;

    setSaving(true);
    try {
      const existing = tipo === 'entry' ? turno.entry
                     : tipo === 'lunch_start' ? turno.lunchStart
                     : tipo === 'lunch_end' ? turno.lunchEnd
                     : turno.exit;

      if (existing) {
        // Editar horário existente
        const newTs = new Date(novoTime);
        const oldTs = existing.timestamp.toDate();
        if (Math.abs(newTs.getTime() - oldTs.getTime()) > 60000) {
          await editarHorarioRegistro(existing.id, newTs, currentUser.uid, adminNome, editMotivo);
        }
      } else {
        // Adicionar registro faltante
        await adicionarRegistro(uid, tipo, new Date(novoTime), currentUser.uid, adminNome, editMotivo);
      }
      await buscarRegistros();
    } catch (err: any) {
      alert(err?.message || 'Erro ao salvar edição.');
    } finally {
      setSaving(false);
    }
  };

  // ── Adicionar registro via slot ─────────────────────────────────────────────
  const salvarNovoRegistro = async (turno: Turno) => {
    const uid = colaboradorId || currentUser?.uid;
    if (!uid || !currentUser || !addSlotTipo || !addSlotTime || !editMotivo.trim()) {
      alert('Preencha o tipo, horário e motivo.');
      return;
    }
    const adminNome = userProfile?.displayName || currentUser.email || currentUser.uid;
    setSaving(true);
    try {
      await adicionarRegistro(
        uid,
        addSlotTipo as 'entry' | 'lunch_start' | 'lunch_end' | 'exit',
        new Date(addSlotTime),
        currentUser.uid,
        adminNome,
        editMotivo
      );
      setAddSlotTipo(null);
      setAddSlotTime('');
      await buscarRegistros();
    } catch (err: any) {
      alert(err?.message || 'Erro ao adicionar registro.');
    } finally {
      setSaving(false);
    }
  };

  // ── Excluir registro (admin only) ───────────────────────────────────────────
  const handleExcluir = async (entry: TimeEntry) => {
    if (!isAdmin) return;
    if (!currentUser) return;
    if (!confirm(`Excluir registro de ${TIPO_LABELS[entry.type]}?\n\nO registro será inativado (soft delete) e o histórico preservado.`)) return;
    const adminNome = userProfile?.displayName || currentUser.email || currentUser.uid;
    try {
      await excluirRegistro(entry.id, currentUser.uid, adminNome);
      await buscarRegistros();
    } catch (err: any) {
      alert(err?.message || 'Erro ao excluir.');
    }
  };

  // ── Coletar registros editados de um turno para o accordion de histórico ────
  const getHistoricoDeTurno = (turno: Turno): TimeEntry[] => {
    const registros = [turno.entry, turno.lunchStart, turno.lunchEnd, turno.exit].filter(Boolean) as TimeEntry[];
    return registros.filter(r => r.isManual || r.editedBy);
  };

  // ── Slots do turno: quais tipos estão faltando ──────────────────────────────
  const getSlotsFaltantes = (turno: Turno): string[] => {
    const faltando: string[] = [];
    if (!turno.entry) faltando.push('entry');
    if (!turno.lunchStart) faltando.push('lunch_start');
    if (!turno.lunchEnd) faltando.push('lunch_end');
    if (!turno.exit) faltando.push('exit');
    return faltando;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Folha de Ponto</h1>
        <p className="text-gray-500">
          {isGestor ? 'Visualize, corrija e gerencie os registros de ponto dos colaboradores.' : 'Visualize seus registros de ponto.'}
        </p>
      </div>

      {/* ── FILTROS ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={18} className="text-brand-600" />
          <h3 className="font-bold text-gray-900">Filtros</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Colaborador */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              <User size={12} className="inline mr-1" />
              Colaborador
            </label>
            {isGestor ? (
              <select
                value={colaboradorId}
                onChange={e => setColaboradorId(e.target.value)}
                className="w-full rounded-lg border-gray-300 bg-white text-gray-900 text-sm"
              >
                <option value="">Selecionar...</option>
                {users.map(u => (
                  <option key={u.uid} value={u.uid}>{u.displayName} {u.sectorName ? `(${u.sectorName})` : ''}</option>
                ))}
              </select>
            ) : (
              <div className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900">
                {userProfile?.displayName || 'Você'}
              </div>
            )}
          </div>

          {/* Data Início */}
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              <Calendar size={12} className="inline mr-1" />
              Início
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
              className="w-full rounded-lg border-gray-300 bg-white text-gray-900 text-sm"
            />
          </div>

          {/* Data Fim */}
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
              <Calendar size={12} className="inline mr-1" />
              Fim
            </label>
            <input
              type="date"
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
              className="w-full rounded-lg border-gray-300 bg-white text-gray-900 text-sm"
            />
          </div>

          {/* Botão Buscar */}
          <div className="flex items-end">
            <button
              onClick={buscarRegistros}
              disabled={loading || (!colaboradorId && isGestor)}
              className="w-full px-4 py-2 bg-brand-600 text-white rounded-lg font-bold text-sm hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Buscar
            </button>
          </div>
        </div>

        {/* Filtro de status */}
        {turnos.length > 0 && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
            <span className="text-xs font-bold text-gray-500 uppercase">Filtrar:</span>
            {([
              { key: 'todos', label: 'Todos', count: turnos.length },
              { key: 'incompletos', label: 'Incompletos', count: turnos.filter(t => t.status === 'sem_saida' || t.status === 'incompleto').length },
              { key: 'inconsistentes', label: 'Inconsistentes', count: turnos.filter(t => t.inconsistente).length },
            ] as const).map(f => (
              <button
                key={f.key}
                onClick={() => setFiltroStatus(f.key)}
                className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                  filtroStatus === f.key
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400'
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── LISTA DE TURNOS ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-brand-600" size={32} />
        </div>
      ) : turnosFiltrados.length > 0 ? (
        <div className="space-y-3">
          {turnosFiltrados.map(turno => {
            const isExpanded = turnoEmEdicao === turno.data;
            const dateObj = new Date(turno.data + 'T12:00:00');
            const weekDay = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
            const statusKey = turno.inconsistente ? 'inconsistente' : turno.status;
            const cfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.completo;
            const StatusIcon = cfg.icon;
            const historico = getHistoricoDeTurno(turno);
            const isHistoricoAberto = historicoAberto === turno.data;
            const slotsFaltantes = getSlotsFaltantes(turno);
            const hasEdited = [turno.entry, turno.lunchStart, turno.lunchEnd, turno.exit].some(e => e?.isManual || e?.editedBy);

            return (
              <div key={turno.data} className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
                turno.inconsistente ? 'border-red-200 ring-1 ring-red-100'
                : turno.status === 'sem_saida' ? 'border-orange-200 ring-1 ring-orange-100'
                : 'border-gray-200'
              }`}>
                {/* ── Linha principal do turno ── */}
                <div
                  className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => isGestor && expandirTurno(turno)}
                >
                  {/* Data */}
                  <div className="w-20 flex-shrink-0">
                    <div className="text-sm font-bold text-gray-900">
                      {String(dateObj.getDate()).padStart(2, '0')}/{String(dateObj.getMonth() + 1).padStart(2, '0')}
                    </div>
                    <div className="text-xs text-gray-500 capitalize">{weekDay}</div>
                  </div>

                  {/* Horários */}
                  <div className="flex-1 grid grid-cols-4 gap-2 text-center">
                    {(['entry', 'lunch_start', 'lunch_end', 'exit'] as const).map(tipo => {
                      const reg = tipo === 'entry' ? turno.entry
                                : tipo === 'lunch_start' ? turno.lunchStart
                                : tipo === 'lunch_end' ? turno.lunchEnd
                                : turno.exit;
                      const time = formatTime(reg);
                      return (
                        <div key={tipo}>
                          <div className="text-[10px] text-gray-400 uppercase font-bold">{TIPO_LABELS[tipo]}</div>
                          <div className={`text-sm font-bold ${time ? 'text-gray-900' : 'text-gray-300'}`}>
                            {time || '--:--'}
                          </div>
                          {reg?.isManual && (
                            <span className="text-[9px] bg-orange-100 text-orange-700 px-1 rounded font-bold">Editado</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Duração */}
                  <div className="w-20 text-center flex-shrink-0">
                    <div className="text-[10px] text-gray-400 uppercase font-bold">Total</div>
                    <div className={`text-sm font-bold ${
                      turno.inconsistente ? 'text-red-600'
                      : turno.duracaoTrabalhoMinutos !== null ? 'text-green-600'
                      : 'text-gray-400'
                    }`}>
                      {turno.inconsistente ? '⚠ Erro'
                       : turno.duracaoTrabalhoMinutos !== null ? minutesToHHMM(turno.duracaoTrabalhoMinutos)
                       : '--'}
                    </div>
                  </div>

                  {/* Badge de status */}
                  <div className="w-32 flex-shrink-0 flex items-center gap-1.5">
                    <span className={`text-[10px] font-extrabold px-2 py-1 rounded-full border whitespace-nowrap flex items-center gap-1 ${cfg.color}`}>
                      <StatusIcon size={10} />
                      {cfg.label}
                    </span>
                    {hasEdited && (
                      <span className="text-[9px] font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full border border-yellow-200">✏</span>
                    )}
                  </div>

                  {/* Expand icon */}
                  {isGestor && (
                    <div className="w-8 flex-shrink-0 flex justify-center">
                      {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                    </div>
                  )}
                </div>

                {/* ── PAINEL DE EDIÇÃO INLINE ── */}
                {isExpanded && isGestor && (
                  <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4 space-y-4">
                    {/* Motivo da correção */}
                    <div>
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Motivo da Correção</label>
                      <input
                        type="text"
                        value={editMotivo}
                        onChange={e => setEditMotivo(e.target.value)}
                        placeholder="Ex: Esquecimento de registro, erro de sistema..."
                        className="w-full rounded-lg border-gray-300 bg-white text-gray-900 text-sm"
                      />
                    </div>

                    {/* 4 slots de registro */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(['entry', 'lunch_start', 'lunch_end', 'exit'] as const).map(tipo => {
                        const reg = tipo === 'entry' ? turno.entry
                                  : tipo === 'lunch_start' ? turno.lunchStart
                                  : tipo === 'lunch_end' ? turno.lunchEnd
                                  : turno.exit;
                        return (
                          <div key={tipo} className="bg-white rounded-lg border border-gray-200 p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-gray-700 uppercase">{TIPO_LABELS[tipo]}</span>
                              {reg?.isManual && (
                                <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">Editado pelo gestor</span>
                              )}
                            </div>
                            {reg ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="datetime-local"
                                  value={editTimes[tipo] || ''}
                                  onChange={e => setEditTimes({ ...editTimes, [tipo]: e.target.value })}
                                  className="flex-1 rounded-lg border-gray-300 text-sm bg-white text-gray-900"
                                />
                                <button
                                  onClick={() => salvarEdicao(turno, tipo)}
                                  disabled={saving}
                                  className="p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
                                  title="Salvar alteração"
                                >
                                  <Save size={14} />
                                </button>
                                {isAdmin && (
                                  <button
                                    onClick={() => handleExcluir(reg)}
                                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                                    title="Excluir registro (soft delete)"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <input
                                  type="datetime-local"
                                  value={editTimes[tipo] || ''}
                                  onChange={e => setEditTimes({ ...editTimes, [tipo]: e.target.value })}
                                  className="flex-1 rounded-lg border-gray-300 text-sm bg-white text-gray-900"
                                />
                                <button
                                  onClick={() => salvarEdicao(turno, tipo)}
                                  disabled={saving || !editTimes[tipo]}
                                  className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                                  title="Adicionar registro"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Adicionar registro extra (para casos onde entry não existe) */}
                    {slotsFaltantes.length > 0 && slotsFaltantes.includes('entry') && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-yellow-800 text-xs font-bold mb-2">
                          <AlertTriangle size={14} />
                          Não há registro de Entrada para este dia. Adicione para criar o turno.
                        </div>
                      </div>
                    )}

                    {/* ── Accordion de Histórico ── */}
                    {historico.length > 0 && (
                      <div className="border-t border-gray-100 pt-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); setHistoricoAberto(isHistoricoAberto ? null : turno.data); }}
                          className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          <History size={14} />
                          Histórico de Alterações ({historico.length})
                          {isHistoricoAberto ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                        {isHistoricoAberto && (
                          <div className="mt-2 space-y-2">
                            {historico.map(reg => (
                              <div key={reg.id} className="bg-gray-50 rounded-lg p-3 text-xs border border-gray-100">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-gray-700">{TIPO_LABELS[reg.type]}</span>
                                  <span className="text-gray-400">
                                    {reg.timestamp.toDate().toLocaleString('pt-BR')}
                                  </span>
                                </div>
                                <div className="mt-1 text-gray-500 space-y-0.5">
                                  {reg.editedBy && (
                                    <div>
                                      <span className="font-bold">Editado por:</span> {(reg as any).editedByNome || reg.editedBy}
                                    </div>
                                  )}
                                  {reg.editReason && (
                                    <div>
                                      <span className="font-bold">Motivo:</span> {reg.editReason}
                                    </div>
                                  )}
                                  {(reg as any).editTimestamp && (
                                    <div>
                                      <span className="font-bold">Data da edição:</span> {(reg as any).editTimestamp.toDate().toLocaleString('pt-BR')}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        !loading && (colaboradorId || !isGestor) && turnos.length === 0 && rawEntries.length >= 0 && (
          <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-gray-200">
            <Calendar className="mx-auto w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">
              {turnos.length === 0 && rawEntries.length === 0
                ? 'Nenhum registro encontrado para este período.'
                : 'Selecione um colaborador e clique "Buscar" para visualizar a folha de ponto.'}
            </p>
          </div>
        )
      )}

      {/* ── Resumo rápido ── */}
      {turnosFiltrados.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Clock size={18} className="text-brand-600" /> Resumo do Período
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-black text-gray-900">{turnos.length}</div>
              <div className="text-xs text-gray-500 font-bold">Turnos Totais</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-green-600">
                {turnos.filter(t => t.status === 'completo').length}
              </div>
              <div className="text-xs text-gray-500 font-bold">Completos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-blue-600">
                {turnos.filter(t => t.status === 'sem_almoco').length}
              </div>
              <div className="text-xs text-gray-500 font-bold">Sem Almoço</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-orange-600">
                {turnos.filter(t => t.status === 'sem_saida' || t.status === 'incompleto').length}
              </div>
              <div className="text-xs text-gray-500 font-bold">Incompletos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-red-600">
                {turnos.filter(t => t.inconsistente).length}
              </div>
              <div className="text-xs text-gray-500 font-bold">Inconsistentes</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FolhaPonto;
