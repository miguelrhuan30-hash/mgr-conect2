import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection, query, where, getDocs, Timestamp, orderBy, addDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  CollectionName, TimeEntry, UserProfile,
  EmployeeOccurrence, OccurrenceType, OCCURRENCE_LABELS, OCCURRENCE_COLORS
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import { calcularTurnos, Turno, toDateStr, minutesToHHMM } from '../utils/shift-calculator';
import {
  adicionarRegistro, editarHorarioRegistro, excluirRegistro
} from '../utils/shift-editor';
import {
  Search, Loader2, Clock, FileSpreadsheet, Printer,
  Calendar, User, CheckCircle, AlertTriangle, AlertCircle, X,
  Pencil, Save, Trash2, Plus, FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ─── Status badge config ───────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  completo:      { label: 'Completo',      color: 'bg-green-100 text-green-700' },
  sem_almoco:    { label: 'Sem Almoço',    color: 'bg-blue-100 text-blue-700' },
  incompleto:    { label: 'Incompleto',    color: 'bg-orange-100 text-orange-700' },
  sem_saida:     { label: 'Sem Saída',     color: 'bg-orange-100 text-orange-700' },
  inconsistente: { label: 'Inconsistente', color: 'bg-red-100 text-red-700' },
  ausencia:      { label: 'Ausência',      color: 'bg-red-50 text-red-600' },
  folga:         { label: 'Folga / FDS',   color: 'bg-gray-100 text-gray-500' },
  atestado_abonado: { label: 'Atestado',   color: 'bg-orange-100 text-orange-700' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatTime = (entry: TimeEntry | null) =>
  entry ? entry.timestamp.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-';

const hoje = (): string => toDateStr(new Date());

/** Gera todos os dias de um mês "YYYY-MM" como array de "YYYY-MM-DD" */
function diasDoMes(mesStr: string): string[] {
  const [y, m] = mesStr.split('-').map(Number);
  const totalDias = new Date(y, m, 0).getDate();
  const dias: string[] = [];
  for (let d = 1; d <= totalDias; d++) {
    dias.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return dias;
}

/** Verifica se um dia é fim de semana */
function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00');
  return d.getDay() === 0 || d.getDay() === 6;
}

// ─── Interface do Resumo Mensal ───────────────────────────────────────────────
interface ResumoMensal {
  totalHorasTrabalhadasMinutos: number;
  horasAbonadas: number;
  diasPresentes: number;
  diasAusentes: number;
  diasFolga: number;
  turnosIncompletos: number;
  turnosInconsistentes: number;
  mediaHorasDiarias: number;
  ocorrenciasCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE
// ═══════════════════════════════════════════════════════════════════════════════

const EspelhoMensal: React.FC = () => {
  const { userProfile, currentUser } = useAuth();
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'developer';
  const isGestor = userProfile?.role === 'gestor' || userProfile?.role === 'manager' || isAdmin;

  const printRef = useRef<HTMLDivElement>(null);

  // ── State ─────────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [colaboradorId, setColaboradorId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(false);
  const [gerado, setGerado] = useState(false);

  // ── Edição em lote do dia ────────────────────────────────────────────────
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editDia, setEditDia] = useState<string | null>(null);
  const [editTurno, setEditTurno] = useState<Turno | null>(null);
  const [editTimes, setEditTimes] = useState({ entry: '', lunchStart: '', lunchEnd: '', exit: '' });
  const [editMotivo, setEditMotivo] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Ocorrências ─────────────────────────────────────────────────────────
  const [ocorrencias, setOcorrencias] = useState<EmployeeOccurrence[]>([]);
  const [showOcorrenciaForm, setShowOcorrenciaForm] = useState(false);
  const [ocTipo, setOcTipo] = useState<OccurrenceType>('atestado');
  const [ocDescricao, setOcDescricao] = useState('');
  const [ocDiaCompleto, setOcDiaCompleto] = useState(true);
  const [ocHoraInicio, setOcHoraInicio] = useState('08:00');
  const [ocHoraFim, setOcHoraFim] = useState('12:00');
  const [savingOc, setSavingOc] = useState(false);

  // ── Carregar colaboradores ────────────────────────────────────────────────
  useEffect(() => {
    const loadUsers = async () => {
      const snap = await getDocs(collection(db, CollectionName.USERS));
      let allUsers = snap.docs
        .map(d => ({ uid: d.id, ...d.data() } as UserProfile))
        .filter(u => u.role !== 'pending');

      if (!isAdmin && isGestor && userProfile?.sectorId) {
        allUsers = allUsers.filter(u => u.sectorId === userProfile.sectorId);
      }
      if (!isGestor) {
        allUsers = allUsers.filter(u => u.uid === currentUser?.uid);
        if (currentUser) setColaboradorId(currentUser.uid);
      }

      allUsers.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
      setUsers(allUsers);
    };
    if (currentUser) loadUsers();
  }, [currentUser, userProfile]);

  // ── Buscar registros do mês ───────────────────────────────────────────────
  const gerarEspelho = async () => {
    const uid = colaboradorId || currentUser?.uid;
    if (!uid) return;
    setLoading(true);
    setGerado(false);
    try {
      const dias = diasDoMes(selectedMonth);
      const inicio = dias[0] + 'T00:00:00';
      const fim = dias[dias.length - 1] + 'T23:59:59.999';

      const q = query(
        collection(db, CollectionName.TIME_ENTRIES),
        where('userId', '==', uid),
        where('timestamp', '>=', Timestamp.fromDate(new Date(inicio))),
        where('timestamp', '<=', Timestamp.fromDate(new Date(fim))),
        orderBy('timestamp', 'asc')
      );
      const snap = await getDocs(q);
      const entries = snap.docs.map(d => ({ id: d.id, ...d.data() } as TimeEntry));
      setTurnos(calcularTurnos(entries));

      // Carregar ocorrências do mês
      try {
        const oq = query(
          collection(db, CollectionName.EMPLOYEE_OCCURRENCES),
          where('userId', '==', uid),
          where('data', '>=', dias[0]),
          where('data', '<=', dias[dias.length - 1])
        );
        const oSnap = await getDocs(oq);
        setOcorrencias(oSnap.docs.map(d => ({ id: d.id, ...d.data() } as EmployeeOccurrence)));
      } catch (err) { console.error('Erro ao carregar ocorrências:', err); setOcorrencias([]); }

      setGerado(true);
    } catch (err) {
      console.error('Erro ao gerar espelho:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers para edição ──────────────────────────────────────────────────
  const toLocalInput = (entry: TimeEntry | null): string => {
    if (!entry) return '';
    const d = entry.timestamp.toDate();
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  // ── Abrir modal de edição do dia ─────────────────────────────────────────
  const abrirModalEdicao = (dia: string, turno: Turno | null) => {
    setEditDia(dia);
    setEditTurno(turno);
    setEditTimes({
      entry: toLocalInput(turno?.entry ?? null),
      lunchStart: toLocalInput(turno?.lunchStart ?? null),
      lunchEnd: toLocalInput(turno?.lunchEnd ?? null),
      exit: toLocalInput(turno?.exit ?? null),
    });
    setEditMotivo('');
    setShowOcorrenciaForm(false);
    setOcTipo('atestado');
    setOcDescricao('');
    setOcDiaCompleto(true);
    setOcHoraInicio('08:00');
    setOcHoraFim('12:00');
    setEditModalOpen(true);
  };

  // ── Salvar edição em lote (todos os 4 horários de uma vez) ───────────────
  const salvarEdicaoLote = async () => {
    const uid = colaboradorId || currentUser?.uid;
    if (!uid || !currentUser || !editDia || !editMotivo.trim()) {
      alert('Informe o motivo da correção antes de salvar.');
      return;
    }
    const adminNome = userProfile?.displayName || currentUser.email || currentUser.uid;
    setSaving(true);
    try {
      const slots: { type: 'entry' | 'lunch_start' | 'lunch_end' | 'exit'; existing: TimeEntry | null; newTime: string }[] = [
        { type: 'entry',       existing: editTurno?.entry ?? null,      newTime: editTimes.entry },
        { type: 'lunch_start', existing: editTurno?.lunchStart ?? null, newTime: editTimes.lunchStart },
        { type: 'lunch_end',   existing: editTurno?.lunchEnd ?? null,   newTime: editTimes.lunchEnd },
        { type: 'exit',        existing: editTurno?.exit ?? null,       newTime: editTimes.exit },
      ];

      for (const s of slots) {
        if (s.existing && s.newTime) {
          // Editar horário existente
          const newTs = new Date(s.newTime);
          const oldTs = s.existing.timestamp.toDate();
          if (Math.abs(newTs.getTime() - oldTs.getTime()) > 60000) {
            await editarHorarioRegistro(s.existing.id, newTs, currentUser.uid, adminNome, editMotivo);
          }
        } else if (!s.existing && s.newTime) {
          // Adicionar registro faltante
          await adicionarRegistro(uid, s.type, new Date(s.newTime), currentUser.uid, adminNome, editMotivo);
        }
        // Se existia mas input ficou vazio → não exclui automaticamente (exclusão é manual)
      }

      setEditModalOpen(false);
      await gerarEspelho();
    } catch (err: any) {
      alert(err?.message || 'Erro ao salvar edição.');
    } finally {
      setSaving(false);
    }
  };

  // ── Excluir registro (soft delete) ───────────────────────────────────────
  const handleExcluirRegistro = async (entry: TimeEntry) => {
    if (!isAdmin || !currentUser) return;
    if (!confirm(`Excluir registro de ${entry.type === 'entry' ? 'Entrada' : entry.type === 'lunch_start' ? 'Ida Almoço' : entry.type === 'lunch_end' ? 'Volta Almoço' : 'Saída'}?\n\nO registro será inativado (soft delete).`)) return;
    const adminNome = userProfile?.displayName || currentUser.email || currentUser.uid;
    try {
      await excluirRegistro(entry.id, currentUser.uid, adminNome);
      setEditModalOpen(false);
      await gerarEspelho();
    } catch (err: any) {
      alert(err?.message || 'Erro ao excluir.');
    }
  };

  // ── Salvar ocorrência ────────────────────────────────────────────────────
  const salvarOcorrencia = async () => {
    const uid = colaboradorId || currentUser?.uid;
    if (!uid || !currentUser || !editDia) return;
    if (!ocDescricao.trim()) { alert('Informe uma descrição para a ocorrência.'); return; }

    setSavingOc(true);
    try {
      let minutosAbonados: number | undefined;
      if (ocTipo === 'atestado') {
        if (ocDiaCompleto) {
          // Abonar jornada padrão do colaborador (8h default)
          const user = users.find(u => u.uid === uid);
          const schedule = user?.workSchedule;
          if (schedule?.dailyWorkMinutes && schedule.dailyWorkMinutes > 0) {
            minutosAbonados = schedule.dailyWorkMinutes;
          } else if (schedule?.startTime && schedule?.endTime) {
            const [sh, sm] = schedule.startTime.split(':').map(Number);
            const [eh, em] = schedule.endTime.split(':').map(Number);
            minutosAbonados = ((eh * 60) + em) - ((sh * 60) + sm) - (schedule.lunchDuration || 60);
          } else {
            minutosAbonados = 480; // 8h default
          }
        } else {
          // Parcial: calcular minutosAbonados
          const [shi, smi] = ocHoraInicio.split(':').map(Number);
          const [ehi, emi] = ocHoraFim.split(':').map(Number);
          minutosAbonados = ((ehi * 60) + emi) - ((shi * 60) + smi);
          if (minutosAbonados <= 0) { alert('O período do atestado é inválido.'); setSavingOc(false); return; }
        }
      }

      await addDoc(collection(db, CollectionName.EMPLOYEE_OCCURRENCES), {
        userId: uid,
        data: editDia,
        tipo: ocTipo,
        descricao: ocDescricao,
        diaCompleto: ocDiaCompleto,
        ...(ocTipo === 'atestado' && !ocDiaCompleto ? { horaInicio: ocHoraInicio, horaFim: ocHoraFim } : {}),
        ...(minutosAbonados ? { minutosAbonados } : {}),
        criadoPor: currentUser.uid,
        criadoEm: serverTimestamp(),
      });

      setShowOcorrenciaForm(false);
      setOcDescricao('');
      // Recarregar ocorrências
      await gerarEspelho();
      alert('Ocorrência registrada com sucesso.');
    } catch (err: any) {
      alert(err?.message || 'Erro ao registrar ocorrência.');
    } finally {
      setSavingOc(false);
    }
  };

  // ── Dados do colaborador selecionado ──────────────────────────────────────
  const colaborador = useMemo(() => {
    return users.find(u => u.uid === (colaboradorId || currentUser?.uid));
  }, [users, colaboradorId, currentUser]);

  // ── Montar linhas do espelho: 1 por dia do mês ───────────────────────────
  const dias = useMemo(() => diasDoMes(selectedMonth), [selectedMonth]);
  const turnosPorDia = useMemo(() => {
    const map = new Map<string, Turno>();
    turnos.forEach(t => map.set(t.data, t));
    return map;
  }, [turnos]);

  // ── Ocorrências por dia ──────────────────────────────────────────────────
  const ocorrenciasPorDia = useMemo(() => {
    const map = new Map<string, EmployeeOccurrence[]>();
    ocorrencias.forEach(oc => {
      const list = map.get(oc.data) || [];
      list.push(oc);
      map.set(oc.data, list);
    });
    return map;
  }, [ocorrencias]);

  // ── Linhas do espelho ─────────────────────────────────────────────────────
  const linhasEspelho = useMemo(() => {
    return dias.map(dia => {
      const turno = turnosPorDia.get(dia);
      const weekend = isWeekend(dia);
      const dateObj = new Date(dia + 'T12:00:00');
      const weekDay = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase();
      const diaOcorrencias = ocorrenciasPorDia.get(dia) || [];

      let statusKey: string;
      if (turno) {
        statusKey = turno.inconsistente ? 'inconsistente' : turno.status;
      } else {
        statusKey = weekend ? 'folga' : 'ausencia';
      }

      // Se tem atestado dia completo sem registros, marcar como atestado em vez de ausência
      const atestadoDiaCompleto = diaOcorrencias.find(o => o.tipo === 'atestado' && (o.diaCompleto !== false));
      if (statusKey === 'ausencia' && atestadoDiaCompleto) {
        statusKey = 'atestado_abonado';
      }

      const hasManual = turno && [turno.entry, turno.lunchStart, turno.lunchEnd, turno.exit]
        .some(e => e?.isManual || e?.editedBy);

      return { dia, dateObj, weekDay, turno, weekend, statusKey, hasManual, ocorrencias: diaOcorrencias };
    });
  }, [dias, turnosPorDia, ocorrenciasPorDia]);

  // ── Totalizadores ─────────────────────────────────────────────────────────
  const resumo = useMemo((): ResumoMensal => {
    let totalMinutos = 0;
    let horasAbonadas = 0;
    let presentes = 0;
    let ausentes = 0;
    let folgas = 0;
    let incompletos = 0;
    let inconsistentes = 0;
    let ocCount = 0;

    for (const l of linhasEspelho) {
      const { turno, weekend, ocorrencias: diaOcs } = l;

      // Contar ocorrências
      ocCount += diaOcs.length;

      // Calcular minutos abonados por atestado neste dia
      const minutosAbonadosDia = diaOcs
        .filter(o => o.tipo === 'atestado' && o.minutosAbonados)
        .reduce((sum, o) => sum + (o.minutosAbonados || 0), 0);
      horasAbonadas += minutosAbonadosDia;

      if (weekend && !turno) { folgas++; continue; }
      if (!turno) {
        if (minutosAbonadosDia > 0) {
          // Dia abonado por atestado — conta como presente
          presentes++;
          totalMinutos += minutosAbonadosDia;
        } else {
          ausentes++;
        }
        continue;
      }
      if (turno.inconsistente) { inconsistentes++; continue; }
      if (turno.status === 'sem_saida') { incompletos++; continue; }

      presentes++;
      totalMinutos += (turno.duracaoTrabalhoMinutos ?? 0) + minutosAbonadosDia;
    }

    return {
      totalHorasTrabalhadasMinutos: totalMinutos,
      horasAbonadas,
      diasPresentes: presentes,
      diasAusentes: ausentes,
      diasFolga: folgas,
      turnosIncompletos: incompletos,
      turnosInconsistentes: inconsistentes,
      mediaHorasDiarias: presentes > 0 ? Math.round(totalMinutos / presentes) : 0,
      ocorrenciasCount: ocCount,
    };
  }, [linhasEspelho]);

  // ── Exportar Excel ────────────────────────────────────────────────────────
  const exportarExcel = () => {
    const nome = colaborador?.displayName || 'colaborador';
    const linhas = linhasEspelho.map(l => ({
      'Data': l.dia,
      'Dia': l.weekDay,
      'Entrada': l.turno ? formatTime(l.turno.entry) : '-',
      'Saída Almoço': l.turno ? formatTime(l.turno.lunchStart) : '-',
      'Volta Almoço': l.turno ? formatTime(l.turno.lunchEnd) : '-',
      'Saída': l.turno ? formatTime(l.turno.exit) : '-',
      'H. Trabalhadas': l.turno?.duracaoTrabalhoMinutos != null ? minutesToHHMM(l.turno.duracaoTrabalhoMinutos) : '-',
      'Status': (STATUS_CONFIG[l.statusKey] || STATUS_CONFIG.completo).label,
      'Editado': l.hasManual ? 'Sim' : '',
    }));

    // Adicionar linha de totais
    linhas.push({
      'Data': '',
      'Dia': 'TOTAIS',
      'Entrada': '',
      'Saída Almoço': '',
      'Volta Almoço': '',
      'Saída': '',
      'H. Trabalhadas': minutesToHHMM(resumo.totalHorasTrabalhadasMinutos),
      'Status': `${resumo.diasPresentes} presentes / ${resumo.diasAusentes} ausências`,
      'Editado': '',
    });

    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Espelho');
    XLSX.writeFile(wb, `espelho_${nome.replace(/ /g, '_')}_${selectedMonth}.xlsx`);
  };

  // ── Imprimir ──────────────────────────────────────────────────────────────
  const handlePrint = () => window.print();

  // ── Nome do mês formatado ─────────────────────────────────────────────────
  const mesFormatado = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    const raw = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [selectedMonth]);

  // ── Cargo formatado ───────────────────────────────────────────────────────
  const roleMap: Record<string, string> = {
    admin: 'Gestor', developer: 'Desenvolvedor', manager: 'Gerente',
    gestor: 'Gestor', technician: 'Técnico', employee: 'Colaborador',
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ── FILTROS (ocultos no print) ── */}
      <div className="print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Espelho de Ponto Mensal</h1>
            <p className="text-gray-500">Visualize o espelho completo do mês e exporte para Excel ou PDF.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            {/* Colaborador */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                <User size={12} className="inline mr-1" /> Colaborador
              </label>
              {isGestor ? (
                <select
                  value={colaboradorId}
                  onChange={e => setColaboradorId(e.target.value)}
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900 text-sm"
                >
                  <option value="">Selecionar...</option>
                  {users.map(u => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName} {u.sectorName ? `(${u.sectorName})` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900">
                  {userProfile?.displayName || 'Você'}
                </div>
              )}
            </div>

            {/* Mês */}
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                <Calendar size={12} className="inline mr-1" /> Mês/Ano
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="w-full rounded-lg border-gray-300 bg-white text-gray-900 text-sm"
              />
            </div>

            {/* Botão Gerar */}
            <div>
              <button
                onClick={gerarEspelho}
                disabled={loading || (!colaboradorId && isGestor)}
                className="w-full px-4 py-2 bg-brand-600 text-white rounded-lg font-bold text-sm hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Gerar Espelho
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── ESPELHO (visível no print) ── */}
      {gerado && (
        <div ref={printRef}>
          {/* Botões de exportação (ocultos no print) */}
          <div className="flex items-center gap-3 mb-4 print:hidden">
            <button
              onClick={exportarExcel}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 flex items-center gap-2 transition-colors"
            >
              <FileSpreadsheet size={16} /> Exportar Excel
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg font-bold text-sm hover:bg-gray-800 flex items-center gap-2 transition-colors"
            >
              <Printer size={16} /> Imprimir / PDF
            </button>
          </div>

          {/* Cabeçalho do Espelho */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:shadow-none print:border-0 print:rounded-none">
            <div className="bg-gray-900 text-white px-6 py-4 print:bg-white print:text-black print:border-b-2 print:border-black">
              <h2 className="text-lg font-bold text-center uppercase tracking-wide">
                MGR Serviços — Espelho de Ponto
              </h2>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 print:bg-white grid grid-cols-2 gap-2 text-sm">
              <div><span className="font-bold text-gray-700">Colaborador:</span> {colaborador?.displayName || '-'}</div>
              <div><span className="font-bold text-gray-700">Competência:</span> {mesFormatado}</div>
              <div><span className="font-bold text-gray-700">Setor:</span> {colaborador?.sectorName || '-'}</div>
              <div><span className="font-bold text-gray-700">Cargo:</span> {roleMap[colaborador?.role || ''] || (colaborador as any)?.jobTitle || '-'}</div>
            </div>

            {/* Tabela do Espelho */}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 print:bg-gray-200">
                  <tr>
                    {isGestor && <th className="px-2 py-2 text-center w-10 print:hidden"></th>}
                    <th className="px-3 py-2 text-left font-bold text-gray-700 text-xs uppercase">Dia</th>
                    <th className="px-3 py-2 text-center font-bold text-gray-700 text-xs uppercase">Sem.</th>
                    <th className="px-3 py-2 text-center font-bold text-gray-700 text-xs uppercase">Entrada</th>
                    <th className="px-3 py-2 text-center font-bold text-gray-700 text-xs uppercase">Saída Alm.</th>
                    <th className="px-3 py-2 text-center font-bold text-gray-700 text-xs uppercase">Volta Alm.</th>
                    <th className="px-3 py-2 text-center font-bold text-gray-700 text-xs uppercase">Saída</th>
                    <th className="px-3 py-2 text-center font-bold text-gray-700 text-xs uppercase">H. Trab.</th>
                    <th className="px-3 py-2 text-center font-bold text-gray-700 text-xs uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {linhasEspelho.map(l => {
                    const cfg = STATUS_CONFIG[l.statusKey] || STATUS_CONFIG.completo;
                    const atestadoOcs = l.ocorrencias.filter(o => o.tipo === 'atestado');
                    const outrasOcs = l.ocorrencias.filter(o => o.tipo !== 'atestado');
                    return (
                      <tr
                        key={l.dia}
                        className={`${l.weekend ? 'bg-gray-50/50 text-gray-400' : 'text-gray-900'} ${
                          l.statusKey === 'ausencia' ? 'bg-red-50/30' : l.statusKey === 'atestado_abonado' ? 'bg-orange-50/30' : ''
                        } print:text-[11px]`}
                      >
                        {/* Pencil icon */}
                        {isGestor && (
                          <td className="px-2 py-1.5 text-center print:hidden">
                            <button
                              onClick={() => abrirModalEdicao(l.dia, l.turno || null)}
                              className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-brand-600 transition-colors"
                              title="Editar dia"
                            >
                              <Pencil size={14} />
                            </button>
                          </td>
                        )}
                        {/* Dia */}
                        <td className="px-3 py-1.5 font-bold whitespace-nowrap">
                          {String(l.dateObj.getDate()).padStart(2, '0')}/{String(l.dateObj.getMonth() + 1).padStart(2, '0')}
                        </td>
                        {/* Semana */}
                        <td className="px-3 py-1.5 text-center text-xs capitalize">{l.weekDay}</td>
                        {/* Entrada */}
                        <td className="px-3 py-1.5 text-center font-medium">
                          {l.turno ? formatTime(l.turno.entry) : l.statusKey === 'atestado_abonado' ? '—' : '-'}
                        </td>
                        {/* Saída Almoço */}
                        <td className="px-3 py-1.5 text-center">{l.turno ? formatTime(l.turno.lunchStart) : '-'}</td>
                        {/* Volta Almoço */}
                        <td className="px-3 py-1.5 text-center">{l.turno ? formatTime(l.turno.lunchEnd) : '-'}</td>
                        {/* Saída */}
                        <td className="px-3 py-1.5 text-center font-medium">
                          {l.turno ? formatTime(l.turno.exit) : l.statusKey === 'atestado_abonado' ? '—' : '-'}
                        </td>
                        {/* Horas Trabalhadas */}
                        <td className={`px-3 py-1.5 text-center font-bold ${
                          l.turno?.inconsistente ? 'text-red-600'
                          : l.statusKey === 'atestado_abonado' ? 'text-orange-600'
                          : l.turno?.duracaoTrabalhoMinutos != null ? 'text-green-700'
                          : ''
                        }`}>
                          {l.turno?.inconsistente
                            ? '⚠ Erro'
                            : l.statusKey === 'atestado_abonado' && atestadoOcs[0]?.minutosAbonados
                              ? `🏥 ${minutesToHHMM(atestadoOcs[0].minutosAbonados)}`
                            : l.turno?.duracaoTrabalhoMinutos != null
                              ? minutesToHHMM(l.turno.duracaoTrabalhoMinutos)
                              : '-'}
                        </td>
                        {/* Status + badges */}
                        <td className="px-3 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full whitespace-nowrap ${cfg.color}`}>
                              {cfg.label}
                            </span>
                            {l.hasManual && (
                              <span className="text-[9px] font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full border border-yellow-200 print:border-yellow-400">
                                ✏ Editado
                              </span>
                            )}
                            {atestadoOcs.length > 0 && l.statusKey !== 'atestado_abonado' && (
                              <span className="text-[9px] font-bold bg-orange-100 text-orange-700 px-1 py-0.5 rounded-full border border-orange-200">
                                🏥 Atestado
                              </span>
                            )}
                            {outrasOcs.map(oc => (
                              <span key={oc.id} className={`text-[9px] font-bold px-1 py-0.5 rounded-full border ${OCCURRENCE_COLORS[oc.tipo]}`}>
                                {OCCURRENCE_LABELS[oc.tipo]}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Rodapé com totais */}
                <tfoot className="bg-gray-100 font-bold text-gray-900 border-t-2 border-gray-300 print:bg-gray-200">
                  <tr>
                    <td colSpan={isGestor ? 7 : 6} className="px-3 py-3 text-right uppercase text-xs tracking-wider">
                      Totais do Mês
                    </td>
                    <td className="px-3 py-3 text-center text-brand-700 text-base">
                      {minutesToHHMM(resumo.totalHorasTrabalhadasMinutos)}
                    </td>
                    <td className="px-3 py-3 text-center text-xs font-normal">
                      <div className="flex flex-col gap-0.5 items-center">
                        <span className="text-green-600">{resumo.diasPresentes} presentes</span>
                        {resumo.diasAusentes > 0 && <span className="text-red-600">{resumo.diasAusentes} ausências</span>}
                        {resumo.turnosIncompletos > 0 && <span className="text-orange-600">{resumo.turnosIncompletos} incompletos</span>}
                        {resumo.turnosInconsistentes > 0 && <span className="text-red-600">{resumo.turnosInconsistentes} inconsistentes</span>}
                        {resumo.horasAbonadas > 0 && <span className="text-orange-600">🏥 {minutesToHHMM(resumo.horasAbonadas)} abonadas</span>}
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ── Cards de Resumo (ocultos no print — a tfoot já mostra) ── */}
            <div className="px-6 py-5 bg-gray-50 border-t border-gray-200 print:hidden">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Clock size={18} className="text-brand-600" /> Resumo do Mês
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
                <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                  <div className="text-2xl font-black text-brand-700">{minutesToHHMM(resumo.totalHorasTrabalhadasMinutos)}</div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase">Total Horas</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                  <div className="text-2xl font-black text-green-600">{resumo.diasPresentes}</div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase">Dias Presentes</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                  <div className="text-2xl font-black text-red-600">{resumo.diasAusentes}</div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase">Ausências</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                  <div className="text-2xl font-black text-orange-600">{resumo.turnosIncompletos}</div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase">Incompletos</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                  <div className="text-2xl font-black text-gray-700">{resumo.diasFolga}</div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase">Folgas / FDS</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                  <div className="text-2xl font-black text-blue-600">
                    {resumo.mediaHorasDiarias > 0 ? minutesToHHMM(resumo.mediaHorasDiarias) : '-'}
                  </div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase">Média Diária</div>
                </div>
                {resumo.horasAbonadas > 0 && (
                  <div className="bg-orange-50 rounded-lg border border-orange-200 p-3 text-center">
                    <div className="text-2xl font-black text-orange-600">{minutesToHHMM(resumo.horasAbonadas)}</div>
                    <div className="text-[10px] text-orange-500 font-bold uppercase">🏥 H. Abonadas</div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Área de Assinatura (sempre visível, essencial no print) ── */}
            <div className="px-6 py-8 border-t border-gray-200 print:pt-16">
              <div className="grid grid-cols-2 gap-16">
                <div className="text-center">
                  <div className="border-t border-gray-900 pt-2 mx-8">
                    <p className="text-xs font-bold text-gray-700 uppercase">Assinatura do Colaborador</p>
                    <p className="text-xs text-gray-500">{colaborador?.displayName || '-'}</p>
                  </div>
                </div>
                <div className="text-center">
                  <div className="border-t border-gray-900 pt-2 mx-8">
                    <p className="text-xs font-bold text-gray-700 uppercase">Assinatura do Gestor</p>
                    <p className="text-xs text-gray-500">MGR Serviços</p>
                  </div>
                </div>
              </div>
              <p className="text-center text-[10px] text-gray-400 mt-6 print:mt-8">
                Documento gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — MGR Conect
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Estado vazio */}
      {!gerado && !loading && (
        <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-gray-200 print:hidden">
          <Calendar className="mx-auto w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Selecione um colaborador e mês, depois clique "Gerar Espelho".</p>
        </div>
      )}

      {/* ── Print CSS ── */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:hidden { display: none !important; }
          [class*="print:"] { break-inside: avoid; }
          #root { visibility: visible; }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL DE EDIÇÃO DO DIA                                               */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {editModalOpen && editDia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" style={{ touchAction: 'none' }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto relative animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Editar Dia</h3>
                <p className="text-sm text-gray-500">
                  {new Date(editDia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setEditModalOpen(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-4 space-y-5">
              {/* ── 4 campos de horário ── */}
              <div>
                <h4 className="text-xs font-bold text-gray-600 uppercase mb-3">Horários do Turno</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(['entry', 'lunchStart', 'lunchEnd', 'exit'] as const).map(tipo => {
                    const labels = { entry: 'Entrada', lunchStart: 'Ida Almoço', lunchEnd: 'Volta Almoço', exit: 'Saída' };
                    const existing = tipo === 'entry' ? editTurno?.entry
                                   : tipo === 'lunchStart' ? editTurno?.lunchStart
                                   : tipo === 'lunchEnd' ? editTurno?.lunchEnd
                                   : editTurno?.exit;
                    return (
                      <div key={tipo} className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-gray-700">{labels[tipo]}</span>
                          {existing?.isManual && (
                            <span className="text-[9px] bg-orange-100 text-orange-700 px-1 py-0.5 rounded font-bold">Editado</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="datetime-local"
                            value={editTimes[tipo]}
                            onChange={e => setEditTimes({ ...editTimes, [tipo]: e.target.value })}
                            className="flex-1 rounded-lg border-gray-300 text-sm bg-white text-gray-900"
                          />
                          {isAdmin && existing && (
                            <button
                              onClick={() => handleExcluirRegistro(existing)}
                              className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                              title="Excluir registro"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Motivo ── */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Motivo da Correção *</label>
                <input
                  type="text"
                  value={editMotivo}
                  onChange={e => setEditMotivo(e.target.value)}
                  placeholder="Ex: Esquecimento de registro, erro de sistema..."
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900 text-sm"
                />
              </div>

              {/* ── Botão Salvar Tudo ── */}
              <button
                onClick={salvarEdicaoLote}
                disabled={saving || !editMotivo.trim()}
                className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold text-sm hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Salvar Todas as Alterações
              </button>

              {/* ═══ OCORRÊNCIAS ═══ */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-gray-600 uppercase flex items-center gap-1.5">
                    <FileText size={14} /> Ocorrências do Dia
                  </h4>
                  {!showOcorrenciaForm && (
                    <button
                      onClick={() => setShowOcorrenciaForm(true)}
                      className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                    >
                      <Plus size={14} /> Registrar Ocorrência
                    </button>
                  )}
                </div>

                {/* Lista de ocorrências já cadastradas neste dia */}
                {(() => {
                  const diaOcs = ocorrenciasPorDia.get(editDia) || [];
                  return diaOcs.length > 0 ? (
                    <div className="space-y-2 mb-3">
                      {diaOcs.map(oc => (
                        <div key={oc.id} className={`rounded-lg border p-3 text-xs ${OCCURRENCE_COLORS[oc.tipo]}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-bold">{OCCURRENCE_LABELS[oc.tipo]}</span>
                            {oc.minutosAbonados && (
                              <span className="font-bold">🏥 {minutesToHHMM(oc.minutosAbonados)} abonadas</span>
                            )}
                          </div>
                          {oc.descricao && <p className="mt-1 text-gray-600">{oc.descricao}</p>}
                          {oc.horaInicio && oc.horaFim && (
                            <p className="mt-0.5 text-gray-500">Período: {oc.horaInicio} — {oc.horaFim}</p>
                          )}
                          {oc.diaCompleto && oc.tipo === 'atestado' && (
                            <p className="mt-0.5 text-gray-500">Dia completo</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    !showOcorrenciaForm && (
                      <p className="text-xs text-gray-400 mb-3">Nenhuma ocorrência registrada para este dia.</p>
                    )
                  );
                })()}

                {/* Formulário de nova ocorrência */}
                {showOcorrenciaForm && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Tipo</label>
                        <select
                          value={ocTipo}
                          onChange={e => setOcTipo(e.target.value as OccurrenceType)}
                          className="w-full rounded-lg border-gray-300 text-sm bg-white text-gray-900"
                        >
                          {(Object.keys(OCCURRENCE_LABELS) as OccurrenceType[]).map(k => (
                            <option key={k} value={k}>{OCCURRENCE_LABELS[k]}</option>
                          ))}
                        </select>
                      </div>
                      {ocTipo === 'atestado' && (
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1">Período</label>
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1 text-xs">
                              <input type="radio" checked={ocDiaCompleto} onChange={() => setOcDiaCompleto(true)} />
                              Dia completo
                            </label>
                            <label className="flex items-center gap-1 text-xs">
                              <input type="radio" checked={!ocDiaCompleto} onChange={() => setOcDiaCompleto(false)} />
                              Parcial
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                    {ocTipo === 'atestado' && !ocDiaCompleto && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1">Hora Início</label>
                          <input type="time" value={ocHoraInicio} onChange={e => setOcHoraInicio(e.target.value)}
                            className="w-full rounded-lg border-gray-300 text-sm bg-white text-gray-900" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1">Hora Fim</label>
                          <input type="time" value={ocHoraFim} onChange={e => setOcHoraFim(e.target.value)}
                            className="w-full rounded-lg border-gray-300 text-sm bg-white text-gray-900" />
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">Descrição *</label>
                      <input type="text" value={ocDescricao} onChange={e => setOcDescricao(e.target.value)}
                        placeholder="Ex: Atestado médico, consulta ortodontista..."
                        className="w-full rounded-lg border-gray-300 text-sm bg-white text-gray-900" />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={salvarOcorrencia}
                        disabled={savingOc || !ocDescricao.trim()}
                        className="flex-1 py-2.5 bg-brand-600 text-white rounded-lg font-bold text-sm hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                      >
                        {savingOc ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Registrar Ocorrência
                      </button>
                      <button
                        onClick={() => setShowOcorrenciaForm(false)}
                        className="py-2.5 px-4 bg-gray-200 text-gray-700 rounded-lg font-bold text-sm hover:bg-gray-300 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EspelhoMensal;
