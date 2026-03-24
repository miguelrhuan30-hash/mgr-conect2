import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection, query, where, getDocs, Timestamp, orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, TimeEntry, UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { calcularTurnos, Turno, toDateStr, minutesToHHMM } from '../utils/shift-calculator';
import {
  Search, Loader2, Clock, FileSpreadsheet, Printer,
  Calendar, User, CheckCircle, AlertTriangle, AlertCircle, X
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
  diasPresentes: number;
  diasAusentes: number;
  diasFolga: number;
  turnosIncompletos: number;
  turnosInconsistentes: number;
  mediaHorasDiarias: number;
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
      setGerado(true);
    } catch (err) {
      console.error('Erro ao gerar espelho:', err);
    } finally {
      setLoading(false);
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

  // ── Linhas do espelho ─────────────────────────────────────────────────────
  const linhasEspelho = useMemo(() => {
    return dias.map(dia => {
      const turno = turnosPorDia.get(dia);
      const weekend = isWeekend(dia);
      const dateObj = new Date(dia + 'T12:00:00');
      const weekDay = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase();

      let statusKey: string;
      if (turno) {
        statusKey = turno.inconsistente ? 'inconsistente' : turno.status;
      } else {
        statusKey = weekend ? 'folga' : 'ausencia';
      }

      const hasManual = turno && [turno.entry, turno.lunchStart, turno.lunchEnd, turno.exit]
        .some(e => e?.isManual || e?.editedBy);

      return { dia, dateObj, weekDay, turno, weekend, statusKey, hasManual };
    });
  }, [dias, turnosPorDia]);

  // ── Totalizadores ─────────────────────────────────────────────────────────
  const resumo = useMemo((): ResumoMensal => {
    const diasUteis = dias.filter(d => !isWeekend(d));
    let totalMinutos = 0;
    let presentes = 0;
    let ausentes = 0;
    let folgas = 0;
    let incompletos = 0;
    let inconsistentes = 0;

    for (const dia of dias) {
      const turno = turnosPorDia.get(dia);
      const weekend = isWeekend(dia);

      if (weekend && !turno) { folgas++; continue; }
      if (!turno) { ausentes++; continue; }
      if (turno.inconsistente) { inconsistentes++; continue; }
      if (turno.status === 'sem_saida') { incompletos++; continue; }

      presentes++;
      totalMinutos += turno.duracaoTrabalhoMinutos ?? 0;
    }

    return {
      totalHorasTrabalhadasMinutos: totalMinutos,
      diasPresentes: presentes,
      diasAusentes: ausentes,
      diasFolga: folgas,
      turnosIncompletos: incompletos,
      turnosInconsistentes: inconsistentes,
      mediaHorasDiarias: presentes > 0 ? Math.round(totalMinutos / presentes) : 0,
    };
  }, [dias, turnosPorDia]);

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
                    return (
                      <tr
                        key={l.dia}
                        className={`${l.weekend ? 'bg-gray-50/50 text-gray-400' : 'text-gray-900'} ${
                          l.statusKey === 'ausencia' ? 'bg-red-50/30' : ''
                        } print:text-[11px]`}
                      >
                        {/* Dia */}
                        <td className="px-3 py-1.5 font-bold whitespace-nowrap">
                          {String(l.dateObj.getDate()).padStart(2, '0')}/{String(l.dateObj.getMonth() + 1).padStart(2, '0')}
                        </td>
                        {/* Semana */}
                        <td className="px-3 py-1.5 text-center text-xs capitalize">{l.weekDay}</td>
                        {/* Entrada */}
                        <td className="px-3 py-1.5 text-center font-medium">
                          {l.turno ? formatTime(l.turno.entry) : '-'}
                        </td>
                        {/* Saída Almoço */}
                        <td className="px-3 py-1.5 text-center">{l.turno ? formatTime(l.turno.lunchStart) : '-'}</td>
                        {/* Volta Almoço */}
                        <td className="px-3 py-1.5 text-center">{l.turno ? formatTime(l.turno.lunchEnd) : '-'}</td>
                        {/* Saída */}
                        <td className="px-3 py-1.5 text-center font-medium">
                          {l.turno ? formatTime(l.turno.exit) : '-'}
                        </td>
                        {/* Horas Trabalhadas */}
                        <td className={`px-3 py-1.5 text-center font-bold ${
                          l.turno?.inconsistente ? 'text-red-600'
                          : l.turno?.duracaoTrabalhoMinutos != null ? 'text-green-700'
                          : ''
                        }`}>
                          {l.turno?.inconsistente
                            ? '⚠ Erro'
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
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Rodapé com totais */}
                <tfoot className="bg-gray-100 font-bold text-gray-900 border-t-2 border-gray-300 print:bg-gray-200">
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-right uppercase text-xs tracking-wider">
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
          ${printRef.current ? '' : ''}
        }
      `}</style>
    </div>
  );
};

export default EspelhoMensal;
