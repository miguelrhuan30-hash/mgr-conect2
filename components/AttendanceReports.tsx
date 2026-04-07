import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, getDocs, Timestamp, orderBy, addDoc, serverTimestamp, updateDoc, deleteDoc, doc, increment, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, TimeEntry, UserProfile, TimeBankEntry, EmployeeOccurrence, OCCURRENCE_LABELS, OCCURRENCE_COLORS, ErrorDetail } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { calcularTurnos, Turno, toDateStr } from '../utils/shift-calculator';
import { adicionarRegistro, editarHorarioRegistro, excluirRegistro } from '../utils/shift-editor';
import { 
  Calendar, User, Search, AlertCircle, CheckCircle, Clock, 
  AlertTriangle, ShieldAlert, X, Save, Loader2, Calculator, 
  FileText, FileSpreadsheet, MapPin, Edit2, Banknote, PiggyBank,
  History, Camera, Trash2, Pencil, CheckCircle2
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const AttendanceReports: React.FC = () => {
  const { userProfile, currentUser } = useAuth();
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'monitoring' | 'pontoLogs'>('monitoring');

  // Ponto Logs State
  const [pontoLogs, setPontoLogs] = useState<(TimeEntry & { userName?: string })[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logFilterUserId, setLogFilterUserId] = useState('');
  const [logFilterQuality, setLogFilterQuality] = useState<'all' | 'ok' | 'partial' | 'emergency'>('all');
  const [logDateFrom, setLogDateFrom] = useState(new Date().toISOString().slice(0, 10));
  const [logDateTo, setLogDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [logPage, setLogPage] = useState(0);
  const LOG_PAGE_SIZE = 25;

  // Report State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Monitoring State
  const [openShifts, setOpenShifts] = useState<{user: UserProfile, entry: TimeEntry, lunchEntry?: TimeEntry}[]>([]);
  const [allMonitoringEntries, setAllMonitoringEntries] = useState<TimeEntry[]>([]);
  const [loadingMonitoring, setLoadingMonitoring] = useState(false);
  const [liveTime, setLiveTime] = useState(new Date());
  const [forceExitModalOpen, setForceExitModalOpen] = useState(false);
  const [selectedShiftToClose, setSelectedShiftToClose] = useState<{user: UserProfile, entry: TimeEntry, lastType: string} | null>(null);
  const [forceActionType, setForceActionType] = useState<'lunch_start' | 'lunch_end' | 'exit'>('exit');
  const [exitTime, setExitTime] = useState('');
  const [exitReason, setExitReason] = useState('');
  const [isSavingExit, setIsSavingExit] = useState(false);
  const [expandedShiftIdx, setExpandedShiftIdx] = useState<number | null>(null);

  // Adjustments State
  const [adjUser, setAdjUser] = useState('');
  const [adjType, setAdjType] = useState<'entry' | 'lunch_start' | 'lunch_end' | 'exit'>('entry');
  const [adjTime, setAdjTime] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [isSavingAdj, setIsSavingAdj] = useState(false);

  // Time Bank State
  const [dayDestinations, setDayDestinations] = useState<Record<string, 'pay' | 'bank'>>({});
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [processedDates, setProcessedDates] = useState<Set<string>>(new Set());
  // Bank Compensation State
  const [bankCompUser, setBankCompUser] = useState('');
  const [bankCompMinutes, setBankCompMinutes] = useState<number>(60);
  const [bankCompReason, setBankCompReason] = useState('');
  const [isSavingComp, setIsSavingComp] = useState(false);

  // Global Edits (Sprint 14)
  const [adjStartDate, setAdjStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [adjEndDate, setAdjEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [adjustmentsList, setAdjustmentsList] = useState<TimeEntry[]>([]);
  const [loadingAdjList, setLoadingAdjList] = useState(false);

  // Day Edit State (comprehensive day-level editing)
  const [dayEditModalOpen, setDayEditModalOpen] = useState(false);
  const [dayEditData, setDayEditData] = useState<any>(null);
  const [dayEditTimes, setDayEditTimes] = useState({ entry: '', lunchStart: '', lunchEnd: '', exit: '' });
  const [dayEditReason, setDayEditReason] = useState('');
  const [isSavingDayEdit, setIsSavingDayEdit] = useState(false);

  // Sprint 48 â€” Ocorrências do colaborador
  const [occurrencesForReport, setOccurrencesForReport] = useState<EmployeeOccurrence[]>([]);

  const isAuthorized = 
    userProfile?.role === 'admin' || 
    userProfile?.role === 'developer' || 
    !!userProfile?.permissions?.canViewAttendanceReports;

  const canViewFinancials = 
    userProfile?.role === 'admin' || 
    !!userProfile?.permissions?.canViewFinancials;

  // Live clock â€” updates all cards every second
  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Load Users
    const fetchUsers = async () => {
      if (!isAuthorized) return;
      
      try {
        const snap = await getDocs(collection(db, CollectionName.USERS));
        setUsers(snap.docs.map(d => ({uid: d.id, ...(d.data() as any)} as UserProfile)));
      } catch (error: any) {
        if (error?.code !== 'permission-denied') {
            console.error("Error fetching users for report:", error);
        }
      }
    };
    fetchUsers();
  }, [isAuthorized]);

  // Ponto Logs: busca global de pontos com diagnóstico
  const fetchPontoLogs = useCallback(async () => {
    if (!isAuthorized) return;
    setLoadingLogs(true);
    try {
      const startTs = Timestamp.fromDate(new Date(logDateFrom + 'T00:00:00'));
      const endTs   = Timestamp.fromDate(new Date(logDateTo   + 'T23:59:59'));
      const q = query(
        collection(db, CollectionName.TIME_ENTRIES),
        where('timestamp', '>=', startTs),
        where('timestamp', '<=', endTs),
        orderBy('timestamp', 'desc'),
        limit(300)
      );
      const snap = await getDocs(q);
      let entries = snap.docs.map(d => ({ id: d.id, ...d.data() } as TimeEntry));
      if (logFilterUserId) entries = entries.filter(e => e.userId === logFilterUserId);
      if (logFilterQuality !== 'all') {
        entries = entries.filter(e => (e as any).registrationQuality === logFilterQuality);
      }
      // Enrich with user name
      const enriched = entries.map(e => ({
        ...e,
        userName: users.find(u => u.uid === e.userId)?.displayName ?? e.userId,
      }));
      setPontoLogs(enriched);
      setLogPage(0);
    } catch (err) {
      console.error('fetchPontoLogs error:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, [isAuthorized, logDateFrom, logDateTo, logFilterUserId, logFilterQuality, users]);

  useEffect(() => {
    if (activeTab === 'pontoLogs' && isAuthorized && users.length > 0) fetchPontoLogs();
  }, [activeTab, isAuthorized, users]);

  useEffect(() => {
      if (activeTab === 'monitoring' && isAuthorized) {
          fetchOpenShifts();
      }
  }, [activeTab, users, isAuthorized]);

  // Sprint 48 â€” busca ocorrências ao gerar o relatório mensal
  useEffect(() => {
    if (!selectedUser || !selectedMonth || !isAuthorized) return;
    const [year, month] = selectedMonth.split('-').map(Number);
    const startStr = `${year}-${String(month).padStart(2,'0')}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const endStr = `${year}-${String(month).padStart(2,'0')}-${String(endDay).padStart(2,'0')}`;
    getDocs(query(
      collection(db, CollectionName.EMPLOYEE_OCCURRENCES),
      where('userId', '==', selectedUser),
      where('data', '>=', startStr),
      where('data', '<=', endStr)
    )).then(snap => setOccurrencesForReport(snap.docs.map(d => ({id: d.id, ...(d.data() as any)} as EmployeeOccurrence))))
      .catch(() => {});
  }, [selectedUser, selectedMonth, isAuthorized]);

  // --- REPORT LOGIC ---

  const generateReport = async () => {
    if (!selectedUser || !isAuthorized) return;
    setLoading(true);

    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const q = query(
        collection(db, CollectionName.TIME_ENTRIES),
        where('userId', '==', selectedUser),
        where('timestamp', '>=', Timestamp.fromDate(startDate)),
        where('timestamp', '<=', Timestamp.fromDate(endDate)),
        orderBy('timestamp', 'asc')
      );

      const snap = await getDocs(q);
      const entries = snap.docs.map(d => ({ id: d.id, ...d.data() } as TimeEntry));

      // ── Calcular turnos com motor correto (agrupamento por dia do entry) ──
      // Deduplica por data — mantém o turno MAIS COMPLETO (com mais registros preenchidos)
      const turnosPorDia = new Map<string, Turno>();
      calcularTurnos(entries).forEach(t => {
        const existing = turnosPorDia.get(t.data);
        if (!existing) {
          turnosPorDia.set(t.data, t);
        } else {
          const countRegs = (turno: Turno) =>
            [turno.entry, turno.lunchStart, turno.lunchEnd, turno.exit].filter(Boolean).length;
          if (countRegs(t) > countRegs(existing)) {
            turnosPorDia.set(t.data, t);
          }
        }
      });

      // ── Iterar cada dia do mês para montar o relatório ──
      const daysInMonth = endDate.getDate();
      const user = users.find(u => u.uid === selectedUser);
      const dailyReport: any[] = [];

      for (let d = 1; d <= daysInMonth; d++) {
        const currentDateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const turno = turnosPorDia.get(currentDateStr);

        const row = {
          date: currentDateStr,
          hasEntries: !!turno,
          entry: turno?.entry ?? undefined,
          lunchStart: turno?.lunchStart ?? undefined,
          lunchEnd: turno?.lunchEnd ?? undefined,
          exit: turno?.exit ?? undefined,
          // Campos extras para badges
          turnoStatus: turno?.status ?? null,           // 'completo'|'sem_almoco'|'incompleto'|'sem_saida'|null
          inconsistente: turno?.inconsistente ?? false, // true → duração > 16h
          userSchedule: user?.workSchedule,
          userScheduleType: user?.scheduleType || 'FIXED',
        };
        dailyReport.push(row);
      }

      setReportData(dailyReport);
      setDayDestinations({});
      setProcessedDates(new Set());
    } catch (error: any) {
      if (error?.code !== 'permission-denied') {
        console.error("Error generating report:", error);
      }
      if (error?.code === 'permission-denied') {
        alert("Acesso negado: Você não tem permissão para gerar este relatório.");
      } else {
        alert("Erro ao gerar relatório. Verifique suas permissões.");
      }
    } finally {
      setLoading(false);
    }
  };


  // --- MONITORING LOGIC (OPEN SHIFTS) ---
  
  const fetchOpenShifts = async () => {
      if (users.length === 0 || !isAuthorized) return;
      setLoadingMonitoring(true);
      
      try {
        const open: {user: UserProfile, entry: TimeEntry, lunchEntry?: TimeEntry}[] = [];

        // Get entries from last 48h to check
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        const q = query(
          collection(db, CollectionName.TIME_ENTRIES),
          where('timestamp', '>=', Timestamp.fromDate(twoDaysAgo)),
          orderBy('timestamp', 'desc')
        );

        const snapshot = await getDocs(q);
        const allEntries = snapshot.docs.map(d => ({id: d.id, ...(d.data() as any)} as TimeEntry));
        setAllMonitoringEntries(allEntries);

        // Group by User
        users.forEach(user => {
            const userEntries = allEntries
                .filter(e => e.userId === user.uid)
                .sort((a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime());
            if (userEntries.length > 0) {
                const lastEntry = userEntries[0]; // Most recent
                if (lastEntry.type === 'entry' || lastEntry.type === 'lunch_end' || lastEntry.type === 'lunch_start') {
                    // Find the shift entry (type==='entry') for this session
                    const shiftEntry = userEntries.find(e => e.type === 'entry') || lastEntry;
                    // Find lunch_start if in lunch
                    const lunchEntry = lastEntry.type === 'lunch_start' ? lastEntry : undefined;
                    open.push({ user, entry: shiftEntry, lunchEntry });
                }
            }
        });

        setOpenShifts(open);
      } catch (error: any) {
        if (error?.code !== 'permission-denied') {
            console.error("Error fetching open shifts:", error);
        }
      } finally {
        setLoadingMonitoring(false);
      }
  };

  // ── Labels e config por tipo de ação forçada ──
  const FORCE_ACTION_CONFIG: Record<string, { label: string; buttonLabel: string; buttonColor: string; defaultReason: string }> = {
    lunch_start: { label: 'Iniciar Almoço (Forçado)', buttonLabel: '☕ Forçar Início Almoço', buttonColor: 'bg-yellow-600 hover:bg-yellow-700', defaultReason: 'Esquecimento - Registro administrativo de almoço' },
    lunch_end:   { label: 'Encerrar Almoço (Forçado)', buttonLabel: '🔄 Forçar Volta Almoço', buttonColor: 'bg-orange-600 hover:bg-orange-700', defaultReason: 'Esquecimento - Retorno de almoço administrativo' },
    exit:        { label: 'Encerrar Turno (Forçado)', buttonLabel: '⛔ Forçar Saída', buttonColor: 'bg-red-600 hover:bg-red-700', defaultReason: 'Esquecimento - Fechamento administrativo' },
  };

  /** Determina próxima ação com base no último registro do colaborador */
  const getNextForceAction = (shift: {user: UserProfile, entry: TimeEntry}): 'lunch_start' | 'lunch_end' | 'exit' => {
    const userEntries = allMonitoringEntries
      .filter(e => e.userId === shift.user.uid)
      .sort((a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime());
    const lastEntry = userEntries[0];
    if (!lastEntry) return 'exit';
    switch (lastEntry.type) {
      case 'entry': return 'lunch_start';
      case 'lunch_start': return 'lunch_end';
      case 'lunch_end': return 'exit';
      default: return 'exit';
    }
  };

  const handleOpenForceExit = (shift: {user: UserProfile, entry: TimeEntry}) => {
      const nextAction = getNextForceAction(shift);
      setForceActionType(nextAction);
      setSelectedShiftToClose({ ...shift, lastType: nextAction });

      // Horário default: hora atual
      const now = new Date();
      const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      setExitTime(defaultTime);

      const cfg = FORCE_ACTION_CONFIG[nextAction] || FORCE_ACTION_CONFIG.exit;
      setExitReason(cfg.defaultReason);
      setForceExitModalOpen(true);
  };

  const submitForceExit = async () => {
      if (!selectedShiftToClose || !exitTime || !exitReason) return;
      setIsSavingExit(true);

      try {
          // Montar timestamp a partir da data do turno + hora selecionada
          const entryDate = selectedShiftToClose.entry.timestamp.toDate();
          const dateStr = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}-${String(entryDate.getDate()).padStart(2, '0')}`;
          const exitTimestamp = new Date(`${dateStr}T${exitTime}:00`);

          await addDoc(collection(db, CollectionName.TIME_ENTRIES), {
              userId: selectedShiftToClose.user.uid,
              type: forceActionType,
              timestamp: Timestamp.fromDate(exitTimestamp),
              locationId: 'manual_adjustment',
              isManual: true,
              forcedClose: true,
              editedBy: currentUser?.uid,
              editedByNome: userProfile?.displayName || currentUser?.email || '',
              editReason: exitReason,
              userAgent: 'Manager Dashboard',
              // Campos obrigatórios para Security Rules
              biometricVerified: false,
              processingStatus: 'skipped_manual',
              photoURL: null,
              aiValidation: null,
          });

          const cfg = FORCE_ACTION_CONFIG[forceActionType] || FORCE_ACTION_CONFIG.exit;
          setForceExitModalOpen(false);
          fetchOpenShifts(); // Refresh list
          alert(`${cfg.label} — registrado com sucesso.`);
      } catch (error) {
          console.error('Erro ao forçar ação:', error);
          alert(`Erro ao executar ação forçada: ${(error as any)?.message || 'Erro desconhecido'}`);
      } finally {
          setIsSavingExit(false);
      }
  };

  const submitAdjustment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!adjUser || !adjType || !adjTime || !adjReason || !isAuthorized) return;
      setIsSavingAdj(true);

      try {
          const timestamp = new Date(adjTime);
          
          await addDoc(collection(db, CollectionName.TIME_ENTRIES), {
              userId: adjUser,
              type: adjType,
              timestamp: Timestamp.fromDate(timestamp),
              locationId: 'manual_adjustment',
              isManual: true,
              editedBy: currentUser?.uid,
              editReason: adjReason,
              userAgent: 'Manager Dashboard - Manual Adjustment'
          });

          alert("Registro manual adicionado com sucesso.");
          // Reset form
          setAdjType('entry');
          setAdjTime('');
          setAdjReason('');
          
          // Refresh if needed
          if (activeTab === 'monitoring') fetchOpenShifts();
      } catch (error) {
          console.error(error);
          alert("Erro ao adicionar registro manual.");
      } finally {
          setIsSavingAdj(false);
      }
  };

  // --- TIME BANK LOGIC ---

  const applyToBank = async () => {
    if (!selectedUser || !currentUser) return;
    const bankedDays = reportData.filter(day => dayDestinations[day.date] === 'bank');
    if (bankedDays.length === 0) { alert("Nenhum dia marcado como Enviar para Banco."); return; }
    setIsSavingBank(true);
    try {
      let totalMinutesCredit = 0;
      for (const day of bankedDays) {
        const worked = calcWorkedHours(day);
        if (worked && worked.diffMinutes > 10) {
          totalMinutesCredit += worked.diffMinutes;
          // Log each day as a credit entry in time_bank collection
          await addDoc(collection(db, CollectionName.TIME_BANK), {
            userId: selectedUser,
            type: 'credit',
            minutes: worked.diffMinutes,
            reason: `Horas extras do dia ${day.date} enviadas ao banco (ref. ${selectedMonth})` ,
            referenceMonth: selectedMonth,
            createdBy: currentUser.uid,
            createdAt: serverTimestamp(),
          });
        }
      }
      // Increment timeBankBalance on user document
      if (totalMinutesCredit > 0) {
        await updateDoc(doc(db, CollectionName.USERS, selectedUser), {
          timeBankBalance: increment(totalMinutesCredit)
        });
      }
      const hh = Math.floor(totalMinutesCredit / 60);
      const mm = totalMinutesCredit % 60;
      const newProcessed = new Set(processedDates);
      bankedDays.forEach(day => newProcessed.add(day.date));
      setProcessedDates(newProcessed);

      alert(`${hh}h ${mm}min creditados no Banco de Horas do colaborador com sucesso!`);
    } catch (error) {
      console.error(error);
      alert("Erro ao enviar horas para o banco.");
    } finally {
      setIsSavingBank(false);
    }
  };

  const submitBankCompensation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankCompUser || bankCompMinutes <= 0 || !bankCompReason || !currentUser) return;
    setIsSavingComp(true);
    try {
      await addDoc(collection(db, CollectionName.TIME_BANK), {
        userId: bankCompUser,
        type: 'debit',
        minutes: bankCompMinutes,
        reason: bankCompReason,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, CollectionName.USERS, bankCompUser), {
        timeBankBalance: increment(-bankCompMinutes)
      });
      const hh = Math.floor(bankCompMinutes / 60);
      const mm = bankCompMinutes % 60;
      alert(`${hh}h ${mm}min de compensacao debitados do Banco de Horas.`);
      setBankCompUser('');
      setBankCompMinutes(60);
      setBankCompReason('');
    } catch (error) {
      console.error(error);
      alert("Erro ao lancar compensacao.");
    } finally {
      setIsSavingComp(false);
    }
  };

  const openDayEditModal = (day: any) => {
    const toLocalInput = (entry?: TimeEntry) => {
      if (!entry) return '';
      const date = entry.timestamp.toDate();
      const tzOffset = date.getTimezoneOffset() * 60000;
      return (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
    };
    setDayEditData(day);
    setDayEditTimes({
      entry: toLocalInput(day.entry),
      lunchStart: toLocalInput(day.lunchStart),
      lunchEnd: toLocalInput(day.lunchEnd),
      exit: toLocalInput(day.exit),
    });
    setDayEditReason('');
    setDayEditModalOpen(true);
  };

  const submitDayEdit = async () => {
    if (!dayEditData || !dayEditReason || !currentUser) return;
    setIsSavingDayEdit(true);
    try {
      const editDate = dayEditData.date; // e.g. '2026-03-23'
      const adminNome = userProfile?.displayName || currentUser.email || currentUser.uid;

      const updates: { type: 'entry'|'lunch_start'|'lunch_end'|'exit'; entry?: TimeEntry; newTime: string }[] = [
        { type: 'entry',       entry: dayEditData.entry,      newTime: dayEditTimes.entry },
        { type: 'lunch_start', entry: dayEditData.lunchStart, newTime: dayEditTimes.lunchStart },
        { type: 'lunch_end',   entry: dayEditData.lunchEnd,   newTime: dayEditTimes.lunchEnd },
        { type: 'exit',        entry: dayEditData.exit,        newTime: dayEditTimes.exit },
      ];

      // Validar que cada horário informado pertence ao mesmo dia sendo editado
      for (const u of updates) {
        if (!u.newTime) continue;
        const newTs = new Date(u.newTime);
        const editDateObj = new Date(editDate + 'T00:00:00');
        const nextDayEnd = new Date(editDateObj.getTime() + 2 * 24 * 60 * 60 * 1000);
        if (newTs < editDateObj || newTs > nextDayEnd) {
          const label = u.type === 'entry' ? 'Entrada' : u.type === 'lunch_start' ? 'Ida Almoço' : u.type === 'lunch_end' ? 'Volta Almoço' : 'Saída';
          alert(`O horário de ${label} não corresponde ao dia ${editDate}. Verifique a data e tente novamente.`);
          setIsSavingDayEdit(false);
          return;
        }
      }

      // Aplicar cada alteração via shift-editor (edição isolada por documento)
      for (const u of updates) {
        if (u.entry && u.newTime) {
          // ── Registro existente: editar horário diretamente no documento ──
          const newTs = new Date(u.newTime);
          const oldTs = u.entry.timestamp.toDate();
          if (Math.abs(newTs.getTime() - oldTs.getTime()) > 60000) {
            await editarHorarioRegistro(u.entry.id, newTs, currentUser.uid, adminNome, dayEditReason);
          }
        } else if (!u.entry && u.newTime) {
          // ── Registro faltante: adicionar com validação de duplicata ──
          try {
            await adicionarRegistro(
              selectedUser,
              u.type,
              new Date(u.newTime),
              currentUser.uid,
              adminNome,
              dayEditReason,
            );
          } catch (dupErr: any) {
            // Erro de duplicata: informar o admin e abortar
            alert(dupErr.message || `Erro ao adicionar registro de ${u.type}.`);
            setIsSavingDayEdit(false);
            return;
          }
        }
      }

      alert('Registros do dia atualizados com sucesso.');
      setDayEditModalOpen(false);
      generateReport();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Erro ao editar registros do dia.');
    } finally {
      setIsSavingDayEdit(false);
    }
  };


  const deleteTimeEntry = async (entry: TimeEntry) => {
    if (!confirm('Tem certeza que deseja excluir este registro de ponto?\n\nO registro será removido da folha de ponto mas o histórico de auditoria será preservado.')) return;
    try {
      const adminNome = userProfile?.displayName || currentUser?.email || currentUser?.uid || 'Admin';
      await excluirRegistro(entry.id, currentUser!.uid, adminNome);
      alert('Registro excluído com sucesso.');
      generateReport();
    } catch (e) {
      console.error(e);
      alert('Erro ao excluir registro.');
    }
  };


  const loadAdjustmentsList = async () => {
    if (!adjUser) return;
    setLoadingAdjList(true);
    try {
        const start = Timestamp.fromDate(new Date(adjStartDate + 'T00:00:00'));
        const end = Timestamp.fromDate(new Date(adjEndDate + 'T23:59:59'));

        const q = query(
            collection(db, CollectionName.TIME_ENTRIES),
            where('userId', '==', adjUser),
            where('timestamp', '>=', start),
            where('timestamp', '<=', end),
            orderBy('timestamp', 'asc')
        );

        const snap = await getDocs(q);
        setAdjustmentsList(snap.docs.map(d => ({ id: d.id, ...d.data() } as TimeEntry)));
    } catch (error) {
        console.error("Error loading adjustments list:", error);
    } finally {
        setLoadingAdjList(false);
    }
  };

  // --- HELPERS ---

  const getTimeString = (entry?: TimeEntry) => {
    if (!entry) return '-';
    return entry.timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  const getDailySchedule = (dayRow: any) => {
    const { userSchedule, userScheduleType, date } = dayRow;
    const dateObj = new Date(date + 'T12:00:00');
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const weekDay = days[dateObj.getDay()];
    
    if (userScheduleType === 'FLEXIBLE' && userSchedule && userSchedule[weekDay]) {
      return userSchedule[weekDay];
    }
    
    if (userSchedule) {
      const isWeekend = weekDay === 'saturday' || weekDay === 'sunday';
      return {
        active: !isWeekend,
        startTime: userSchedule.startTime || '08:00',
        lunchDuration: userSchedule.lunchDuration || 60,
        endTime: userSchedule.endTime || '17:00'
      };
    }
    
    const isWeekend = weekDay === 'saturday' || weekDay === 'sunday';
    return {
      active: !isWeekend,
      startTime: '08:00',
      lunchDuration: 60,
      endTime: '17:00'
    };
  };

  const getDayStatus = (dayRow: any) => {
    const schedule = getDailySchedule(dayRow);
    
    if (!schedule.active) {
       if (!dayRow.hasEntries) return { color: 'text-gray-400 bg-gray-100', label: 'Folga', type: 'off' };
       return { color: 'text-purple-700 bg-purple-100', label: 'Extra (Folga)', type: 'extra-off' };
    }
    
    if (!dayRow.hasEntries) {
       return { color: 'text-red-700 bg-red-100', label: 'Falta', type: 'missing' };
    }
    
    let isLateEntry = false;
    if (dayRow.entry && schedule.startTime) {
       const entryDate = dayRow.entry.timestamp.toDate();
       const [targetH, targetM] = schedule.startTime.split(':').map(Number);
       const targetDate = new Date(entryDate);
       targetDate.setHours(targetH, targetM + 10, 0); 
       if (entryDate > targetDate) isLateEntry = true;
    }
    
    let isExtra = false;
    if (dayRow.exit && schedule.endTime) {
       const exitDate = dayRow.exit.timestamp.toDate();
       const [endH, endM] = schedule.endTime.split(':').map(Number);
       const endDate = new Date(exitDate);
       endDate.setHours(endH, endM, 0);
       if ((exitDate.getTime() - endDate.getTime()) > 15 * 60000) {
         isExtra = true;
       }
    }
    
    if (!dayRow.exit) {
       return { color: 'text-orange-700 bg-orange-100', label: 'Incompleto', type: 'incomplete' };
    }
    
    if (isLateEntry) return { color: 'text-yellow-700 bg-yellow-100', label: 'Atraso', type: 'late' };
    if (isExtra) return { color: 'text-blue-700 bg-blue-100', label: 'Hora Extra', type: 'extra' };
    
    return { color: 'text-green-700 bg-green-100', label: 'No Horário', type: 'on-time' };
  };

  // Formata ms em HH:MM
  const msToHHMM = (ms: number) => {
      const totalMin = Math.floor(ms / 60000);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      return `${h}h ${String(m).padStart(2, '0')}m`;
  };

  const getShiftDurationMs = (entryTimestamp: Date, referenceTime?: Date) => {
      const ref = referenceTime || new Date();
      return Math.max(0, ref.getTime() - entryTimestamp.getTime());
  };

  const calcWorkedHours = (day: any) => {
    if (!day.entry || !day.exit) return null;

    const entryTime = day.entry.timestamp.toDate().getTime();
    const exitTime = day.exit.timestamp.toDate().getTime();

    // ── Cap de segurança: turno > 16h é inconsistente (ex: exit de outro dia) ──
    const rawMinutes = (exitTime - entryTime) / 60000;
    if (rawMinutes > 16 * 60) return null;

    let totalMs = exitTime - entryTime;

    const schedule = getDailySchedule(day);

    // Desconta almoço se ambos registrados
    if (day.lunchStart && day.lunchEnd) {
      const lunchStartTime = day.lunchStart.timestamp.toDate().getTime();
      const lunchEndTime = day.lunchEnd.timestamp.toDate().getTime();
      totalMs -= (lunchEndTime - lunchStartTime);
    } else if (totalMs > 6 * 3600000) {
      // SPRINT 9: Correção do Erro de Almoço. Se não registrou almoço e trabalhou mais de 6h, subtrai automaticamente
      const autoLunchMs = (schedule.lunchDuration || 60) * 60000;
      totalMs -= autoLunchMs;
    }

    const totalMinutes = Math.floor(totalMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    let plannedMinutes = 0;
    if (schedule.dailyWorkMinutes && schedule.dailyWorkMinutes > 0) {
        plannedMinutes = schedule.dailyWorkMinutes;
    } else if (schedule.active && schedule.startTime && schedule.endTime) {
        const [sh, sm] = schedule.startTime.split(':').map(Number);
        const [eh, em] = schedule.endTime.split(':').map(Number);
        plannedMinutes = ((eh * 60) + em) - ((sh * 60) + sm) - (schedule.lunchDuration || 0);
    }

    const diffMinutes = totalMinutes - plannedMinutes;
    let diffStr = '';

    if (schedule.active && plannedMinutes > 0) {
        const plannedH = Math.floor(plannedMinutes / 60);
        const plannedM = plannedMinutes % 60;
        const pDisp = `${plannedH}h${plannedM > 0 ? ` ${plannedM}m` : ''}`;

        if (diffMinutes > 10) {
            const dH = Math.floor(diffMinutes / 60);
            const dM = diffMinutes % 60;
            diffStr = ` / ${pDisp} (+${dH}h${dM > 0 ? ` ${dM}m` : ''})`;
        } else if (diffMinutes < -10) {
            const absDiff = Math.abs(diffMinutes);
            const dH = Math.floor(absDiff / 60);
            const dM = absDiff % 60;
            diffStr = ` / ${pDisp} (-${dH}h${dM > 0 ? ` ${dM}m` : ''})`;
        } else {
            diffStr = ` / ${pDisp}`;
        }
    } else if (!schedule.active) {
        diffStr = ` (Extra)`;
    }

    return {
      display: `${hours}h ${String(minutes).padStart(2,'0')}m${diffStr}`,
      totalMinutes,
      hours,
      diffMinutes
    };
  };


  const summary = useMemo(() => {
    let totalMinutes = 0;
    let daysWorked = 0;
    let absences = 0;

    reportData.forEach(day => {
        const result = calcWorkedHours(day);
        if (result) {
            totalMinutes += result.totalMinutes;
            daysWorked++;
        }

        const schedule = getDailySchedule(day);
        if (!day.hasEntries && schedule.active) {
            absences++;
        }
    });

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return {
        totalTime: `${hours}h ${String(minutes).padStart(2, '0')}m`,
        daysWorked,
        absences
    };
  }, [reportData]);

  // --- FINANCIAL CALCULATIONS ---
  const calcFinancials = (day: any) => {
    const worked = calcWorkedHours(day);
    if (!worked) return null;

    const user = users.find(u => u.uid === selectedUser);
    const hourlyRate = user?.hourlyRate || 0;
    const rate50 = user?.overtimeRules?.rate50 || 1.5;
    const rate100 = user?.overtimeRules?.rate100 || 2.0;

    let normalHours = 0;
    let extra50Hours = 0;
    let extra100Hours = 0;
    let nightPremiumHours = 0; // 20% on these hours

    const entryTime = day.entry.timestamp.toDate().getTime();
    const exitTime = day.exit.timestamp.toDate().getTime();
    
    let nightMillis = 0;
    const hasRegisteredLunch = !!(day.lunchStart && day.lunchEnd);
    const schedule = getDailySchedule(day);

    for (let t = entryTime; t < exitTime; t += 60000) {
      const d = new Date(t);
      const h = d.getHours();
      
      // Verifica se está no intervalo de adicional noturno (22:00 - 05:00)
      const isNight = h >= 22 || h < 5;
      
      if (isNight) {
        if (hasRegisteredLunch) {
          const ls = day.lunchStart.timestamp.toDate().getTime();
          const le = day.lunchEnd.timestamp.toDate().getTime();
          if (t >= ls && t < le) continue;
        } else if (worked.totalMinutes > 360) {
          // Se for almoço automático (jornada > 6h), descontamos o tempo de almoço proporcionalmente ou ignoramos parte das horas
          // Uma abordagem comum é não pagar adicional sobre o período de descanso.
          // Como o almoço é automático, não sabemos o horário exato. Vamos assumir que ocorreu no meio do turno.
          // Se o minuto atual está próximo do meio do turno, e é turno noturno, descontamos.
          // Simplificação: Descontar os minutos de almoço do total de nightMillis proporcionalmente ao tempo noturno vs total
          // Mas aqui faremos algo mais simples: se for automático, o loop de minutos vai rodar por todo o tempo,
          // então precisamos subtrair o lunchDuration proporcionalmente no final.
        }
        nightMillis += 60000;
      }
    }

    // Ajuste proporcional para almoço automático nas horas noturnas
    if (!hasRegisteredLunch && worked.totalMinutes > 360 && nightMillis > 0) {
        const totalDuration = (exitTime - entryTime) / 60000;
        const lunchMin = (schedule.lunchDuration || 60);
        const nightRatio = nightMillis / (exitTime - entryTime); // erro aqui: nightMillis Ò© ms, divisao por ms ok
        nightMillis -= (lunchMin * 60000 * nightRatio);
    }

    nightPremiumHours = Math.max(0, nightMillis / 3600000);
    const isBanked = dayDestinations[day.date] === 'bank';

    if (schedule.active) { // working day
       const totalWorkedHrs = worked.totalMinutes / 60;
       
       let plannedMinutes = 0;
       if (schedule.dailyWorkMinutes && schedule.dailyWorkMinutes > 0) {
         plannedMinutes = schedule.dailyWorkMinutes;
       } else if (schedule.startTime && schedule.endTime) {
         const [sh, sm] = schedule.startTime.split(':').map(Number);
         const [eh, em] = schedule.endTime.split(':').map(Number);
         plannedMinutes = ((eh * 60) + em) - ((sh * 60) + sm) - (schedule.lunchDuration || 0);
       }
       const plannedHrs = plannedMinutes / 60;

       if (totalWorkedHrs > plannedHrs) {
         normalHours = plannedHrs;
         extra50Hours = isBanked ? 0 : totalWorkedHrs - plannedHrs;
       } else {
         normalHours = totalWorkedHrs;
       }
    } else { // Inactive day (Sunday/Holiday)
       const totalWorkedHrs = worked.totalMinutes / 60;
       extra100Hours = isBanked ? 0 : totalWorkedHrs;
    }

    const valueNormal = normalHours * hourlyRate;
    const valueExtra50 = extra50Hours * (hourlyRate * rate50);
    const valueExtra100 = extra100Hours * (hourlyRate * rate100);
    const valueNight = nightPremiumHours * (hourlyRate * 0.2); 

    const totalValue = valueNormal + valueExtra50 + valueExtra100 + valueNight;

    return {
      normalHours, valueNormal,
      extra50Hours, valueExtra50,
      extra100Hours, valueExtra100,
      nightPremiumHours, valueNight,
      totalValue
    };
  };

  const financialSummary = useMemo(() => {
     let totals = {
       normalHours: 0, valueNormal: 0,
       extra50Hours: 0, valueExtra50: 0,
       extra100Hours: 0, valueExtra100: 0,
       nightPremiumHours: 0, valueNight: 0,
       totalValue: 0
     };
     reportData.forEach(day => {
        const f = calcFinancials(day);
        if (f) {
           totals.normalHours += f.normalHours; totals.valueNormal += f.valueNormal;
           totals.extra50Hours += f.extra50Hours; totals.valueExtra50 += f.valueExtra50;
           totals.extra100Hours += f.extra100Hours; totals.valueExtra100 += f.valueExtra100;
           totals.nightPremiumHours += f.nightPremiumHours; totals.valueNight += f.valueNight;
           totals.totalValue += f.totalValue;
        }
     });
     return totals;
  }, [reportData, selectedUser, users]);

  // --- EXPORT FUNCTIONS ---

  const exportPDF = () => {
    const doc = new jsPDF({ 
      orientation: 'portrait', 
      unit: 'mm', 
      format: 'a4' 
    });
    
    const user = users.find(u => u.uid === selectedUser);
    const userName = user?.displayName || 'Colaborador';
    
    // Parse month
    const [year, month] = selectedMonth.split('-').map(Number);
    const monthDate = new Date(year, month - 1, 1);
    
    // Capitalize month name
    const monthNameRaw = monthDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    const monthName = monthNameRaw.charAt(0).toUpperCase() + monthNameRaw.slice(1);
    
    // Safe access to potential missing fields
    const userAny = user as any;
    const userDocNum = userAny?.cpf || userAny?.document || '_______________________';
    
    const roleMap: Record<string, string> = {
        'admin': 'Gestor',
        'developer': 'Desenvolvedor',
        'manager': 'Gerente',
        'technician': 'Técnico',
        'employee': 'Colaborador',
        'pending': 'Pendente'
    };
    const userRole = roleMap[user?.role || ''] || userAny?.jobTitle || 'Colaborador';
    
    // === CABEÇALHO ===
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('MGR SERVICOS', 105, 18, { align: 'center' });
    
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.text('FOLHA DE PONTO', 105, 26, { align: 'center' });
    
    doc.setLineWidth(0.5);
    doc.line(14, 30, 196, 30);
    
    // === DADOS DO FUNCIONÃƒÆ’Ã‚ÂRIO ===
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.rect(14, 33, 182, 28);
    
    doc.text('DADOS DO COLABORADOR', 16, 39);
    doc.setFont('helvetica', 'normal');
    
    doc.text(`Nome Completo: ${userName}`, 16, 46);
    doc.text(`Nº Documento: ${userDocNum}`, 16, 52);
    
    doc.text(`Cargo/Função: ${userRole}`, 110, 46);
    doc.text(`Competência: ${monthName}`, 110, 52);
    
    // === TABELA DE REGISTROS ===
    const rows = reportData.map(day => {
      const dateObj = new Date(day.date + 'T12:00:00');
      const schedule = getDailySchedule(day);
      const isWeekend = !schedule.active;
      const weekDay = dateObj.toLocaleString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase();
      const worked = calcWorkedHours(day);
      const dayStatus = getDayStatus(day);
      
      let ocorrencia = dayStatus.label;
      if (day.exit?.forcedClose) ocorrencia += ' (Forçada)';
      
      return {
        data: [
          String(dateObj.getDate()).padStart(2,'0'),
          weekDay,
          getTimeString(day.entry),
          getTimeString(day.lunchStart),
          getTimeString(day.lunchEnd),
          getTimeString(day.exit),
          worked ? worked.display : '--',
          ocorrencia
        ],
        isWeekend,
        isAbsent: !isWeekend && !day.hasEntries
      };
    });
    
    autoTable(doc, {
      head: [['Dia','Sem.','Entrada','Almoço','Volta','Saída','Total','Ocorrência']],
      body: rows.map(r => r.data),
      startY: 65,
      styles: { 
        fontSize: 8, 
        cellPadding: 2,
        halign: 'center',
        valign: 'middle',
        lineColor: [200, 200, 200],
        lineWidth: 0.1
      },
      headStyles: { 
        fillColor: [180, 83, 9],
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 12 },
        2: { cellWidth: 18 },
        3: { cellWidth: 18 },
        4: { cellWidth: 18 },
        5: { cellWidth: 18 },
        6: { cellWidth: 20 },
        7: { cellWidth: 'auto', halign: 'left' }
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
           const rowData = rows[data.row.index];
           if (rowData?.isWeekend) {
             data.cell.styles.fillColor = [240,240,240];
             data.cell.styles.textColor = [150,150,150];
           } else if (rowData?.isAbsent && data.column.index === 7) {
             data.cell.styles.textColor = [200,0,0];
             data.cell.styles.fontStyle = 'bold';
           }
        }
      },
      alternateRowStyles: { 
        fillColor: [252, 252, 252] 
      }
    });
    
    // === RODAPÃƒÆ’ââ‚¬Â° DE TOTAIS ===
    const totalMinutes = reportData.reduce((acc, day) => {
      const w = calcWorkedHours(day);
      return acc + (w ? w.totalMinutes : 0);
    }, 0);
    const totalH = Math.floor(totalMinutes / 60);
    const totalM = totalMinutes % 60;
    const workedDays = reportData.filter(d => d.hasEntries).length;
    const faltaDays = reportData.filter(d => {
      const schedule = getDailySchedule(d);
      return !d.hasEntries && schedule.active;
    }).length;
    
    let finalY = (doc as any).lastAutoTable.finalY + 5;

    // Check page break
    if (finalY > 250) {
        doc.addPage();
        finalY = 20;
    }
    
    doc.rect(14, finalY, 182, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total de Dias Trabalhados: ${workedDays}`, 20, finalY + 9);
    doc.text(`Total de Horas: ${totalH}h ${String(totalM).padStart(2,'0')}m`, 80, finalY + 9);
    doc.text(`Total de Faltas: ${faltaDays} dias`, 148, finalY + 9);
    
    // === RODAPÃƒÆ’ââ‚¬Â° DE ASSINATURA ===
    let signY = finalY + 25;
    if (signY + 40 > 285) {
        doc.addPage();
        signY = 30;
    }
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(
      `Declaro estar ciente das informações registradas nesta folha de ponto referente ao período de ${monthName}.`,
      105, signY, { align: 'center' }
    );
    
    // Assinatura Colaborador
    doc.line(14, signY + 18, 95, signY + 18);
    doc.setFont('helvetica', 'bold');
    doc.text('Assinatura do Colaborador', 54, signY + 23, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(userName, 54, signY + 28, { align: 'center' });
    doc.text('Data: ____/____/________', 54, signY + 34, { align: 'center' });
    
    // Assinatura RH
    doc.line(105, signY + 18, 196, signY + 18);
    doc.setFont('helvetica', 'bold');
    doc.text('Responsável RH / Gestão', 150, signY + 23, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text('____________________________', 150, signY + 28, { align: 'center' });
    doc.text('Data: ____/____/________', 150, signY + 34, { align: 'center' });
    
    // Salvar
    doc.save(`folha_ponto_${userName.replace(/ /g,'_')}_${selectedMonth}.pdf`);
  };

  const exportExcel = () => {
    const userName = users.find(u => u.uid === selectedUser)?.displayName || 'Colaborador';
    
    // Dados da planilha
    const wsData = [
      ['ESPELHO DE PONTO - MGR SERVIÃƒÆ’ââ‚¬Â¡OS'],
      [`Colaborador: ${userName}`],
      [`Período: ${selectedMonth}`],
      [`Gerado em: ${new Date().toLocaleString()}`],
      [],
      ['Data','Entrada','Almoço','Volta','Saída','Total Trabalhado','Obs']
    ];
    
    reportData.forEach(day => {
      const dateObj = new Date(day.date + 'T12:00:00');
      const schedule = getDailySchedule(day);
      const isWeekend = !schedule.active;
      const worked = calcWorkedHours(day);
      const dayStatus = getDayStatus(day);
      
      let obs = dayStatus.label;
      if (day.exit?.forcedClose) obs += ' (Forçada)';

      wsData.push([
        dateObj.toLocaleDateString(),
        getTimeString(day.entry),
        getTimeString(day.lunchStart),
        getTimeString(day.lunchEnd),
        getTimeString(day.exit),
        worked ? worked.display : '--',
        obs
      ]);
    });
    
    // Linha de totais
    const totalMinutes = reportData.reduce((acc, day) => {
      const w = calcWorkedHours(day);
      return acc + (w ? w.totalMinutes : 0);
    }, 0);
    const totalH = Math.floor(totalMinutes / 60);
    const totalM = totalMinutes % 60;
    const workedDays = reportData.filter(d => d.hasEntries).length;
    
    wsData.push([]);
    wsData.push([
      `Total do Mês: ${totalH}h ${String(totalM).padStart(2,'0')}m`,
      `Dias Trabalhados: ${workedDays}`
    ]);
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Largura das colunas
    ws['!cols'] = [
      {wch:14},{wch:10},{wch:10},
      {wch:10},{wch:10},{wch:16},{wch:14}
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Ponto ${selectedMonth}`);
    
    XLSX.writeFile(wb, `ponto_${userName}_${selectedMonth}.xlsx`);
  };

  const exportFinancialPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const user = users.find(u => u.uid === selectedUser);
    const userName = user?.displayName || 'Colaborador';
    const hourlyRate = user?.hourlyRate || 0;
    
    // Parse month
    const [year, month] = selectedMonth.split('-').map(Number);
    const monthDate = new Date(year, month - 1, 1);
    const monthNameRaw = monthDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    const monthName = monthNameRaw.charAt(0).toUpperCase() + monthNameRaw.slice(1);
    
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('EXTRATO DE HORAS E CUSTOS - MGR', 105, 18, { align: 'center' });
    
    doc.setLineWidth(0.5);
    doc.line(14, 25, 196, 25);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Colaborador: ${userName}`, 14, 33);
    doc.text(`Período: ${monthName}`, 14, 39);
    doc.text(`Valor Hora Padrão: R$ ${hourlyRate.toFixed(2).replace('.', ',')}`, 14, 45);

    autoTable(doc, {
      head: [['Venda / Evento', 'Horas', 'Valor R$']],
      body: [
        ['Horas Normais (Base)', `${financialSummary.normalHours.toFixed(1)}h`, `R$ ${financialSummary.valueNormal.toFixed(2).replace('.', ',')}`],
        ['Horas Extras (50%) - Dias ÃƒÆ’Ã…Â¡teis', `${financialSummary.extra50Hours.toFixed(1)}h`, `R$ ${financialSummary.valueExtra50.toFixed(2).replace('.', ',')}`],
        ['Horas Extras (100%) - Domingos/Feriados', `${financialSummary.extra100Hours.toFixed(1)}h`, `R$ ${financialSummary.valueExtra100.toFixed(2).replace('.', ',')}`],
        ['Adicional Noturno (20%) - 22h às 05h', `${financialSummary.nightPremiumHours.toFixed(1)}h`, `R$ ${financialSummary.valueNight.toFixed(2).replace('.', ',')}`],
      ],
      startY: 55,
      theme: 'grid',
      headStyles: { fillColor: [40, 100, 40] }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL BRUTO A ESTIMAR:', 14, finalY);
    doc.setFontSize(20);
    doc.text(`R$ ${financialSummary.totalValue.toFixed(2).replace('.', ',')}`, 14, finalY + 10);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const msg = "Documento apenas para conferencia de metricas de horas. Nao tem valor como holerite provisorio sem os devidos descontos legais (INSS, IRRF, VT/VR).";
    doc.text(msg, 105, finalY + 30, { align: 'center', maxWidth: 160 });

    doc.save(`extrato_financeiro_${userName.replace(/ /g,'_')}_${selectedMonth}.pdf`);
  };

  if (!isAuthorized) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">Acesso Restrito</h2>
        <p className="text-gray-500">Você não tem permissão para visualizar relatórios.</p>
      </div>
    );
  }

  return (
    <>
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-900">Monitoramento de Turnos</h1>
           <p className="text-gray-500">Acompanhamento em tempo real dos turnos em andamento.</p>
        </div>
        {/* Tab buttons */}
        <div className="flex gap-2 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('monitoring')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'monitoring' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Clock size={14} /> Monitoramento
          </button>
          <button
            onClick={() => setActiveTab('pontoLogs')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'pontoLogs' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <AlertTriangle size={14} /> Logs de Ponto
          </button>
        </div>
      </div>

      {/* --- MONITORING TAB --- */}
      {activeTab === 'monitoring' && (
          <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
                  <ShieldAlert className="text-blue-600 w-5 h-5 mt-0.5" />
                  <div>
                      <h4 className="font-bold text-blue-800">Painel de Gestão de Turnos</h4>
                      <p className="text-sm text-blue-700">
                          Abaixo estão listados os colaboradores que registraram entrada mas ainda não registraram saída. 
                          Turnos abertos há mais de 12 horas são destacados em vermelho e devem ser encerrados manualmente.
                      </p>
                  </div>
              </div>

              {loadingMonitoring ? (
                  <div className="flex justify-center p-12"><Loader2 className="animate-spin text-brand-600" /></div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {openShifts.length === 0 && (
                          <div className="col-span-full text-center py-12 bg-white rounded-xl border border-gray-200">
                              <CheckCircle className="mx-auto w-12 h-12 text-green-500 mb-3" />
                              <p className="text-gray-500 font-medium">Todos os turnos anteriores foram fechados corretamente.</p>
                          </div>
                      )}
                      {openShifts.map((shift, idx) => {
                          const isOnLunch = !!shift.lunchEntry;
                          const entryDate = shift.entry.timestamp.toDate();

                          // Buscar TODOS os registros deste usuário, sortidos cronologicamente
                          const userAllEntries = allMonitoringEntries
                              .filter(e => e.userId === shift.user.uid)
                              .sort((a,b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime());

                          // Encontrar lunch_start e lunch_end do TURNO ATUAL (após o entry usado no card)
                          const shiftEntryTime = entryDate.getTime();
                          const lunchStartEntry = userAllEntries.find(e => e.type === 'lunch_start' && e.timestamp.toDate().getTime() > shiftEntryTime);
                          const lunchEndEntry = userAllEntries.find(e => e.type === 'lunch_end' && e.timestamp.toDate().getTime() > shiftEntryTime);

                          // Turno 1: entrada até início do almoço (ou até agora se não há almoço)
                          const lunchStartDate = lunchStartEntry ? lunchStartEntry.timestamp.toDate() : null;
                          const t1Ms = lunchStartDate
                              ? lunchStartDate.getTime() - entryDate.getTime()
                              : getShiftDurationMs(entryDate, liveTime);

                          // Turno 2: volta do almoço até agora (somente se já voltou)
                          const t2Ms = lunchEndEntry
                              ? getShiftDurationMs(lunchEndEntry.timestamp.toDate(), liveTime)
                              : 0;

                          // Almoço em andamento (entre lunch_start e lunch_end)
                          const lunchElapsedMs = (isOnLunch && shift.lunchEntry)
                              ? getShiftDurationMs(shift.lunchEntry.timestamp.toDate(), liveTime)
                              : (lunchStartDate && !lunchEndEntry)
                                  ? getShiftDurationMs(lunchStartDate, liveTime)
                                  : 0;

                          // Total trabalhado (T1 + T2, NÃO inclui almoço)
                          const totalWorkedMs = t1Ms + t2Ms;

                          // Total desde entrada (para checar turno crítico — >12h desde entry)
                          const totalSinceEntryMs = getShiftDurationMs(entryDate, liveTime);
                          const isCritical = totalSinceEntryMs > 12 * 3600000;

                          return (
                              <div key={idx} className={`bg-white rounded-xl border p-5 shadow-sm relative overflow-hidden ${
                                  isCritical ? 'border-red-200 ring-1 ring-red-100'
                                  : isOnLunch ? 'border-orange-200 ring-1 ring-orange-100'
                                  : 'border-gray-200'
                              }`}>
                                  {isCritical && <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] px-2 py-0.5 font-bold uppercase">Atenção</div>}

                                  {/* Header do card */}
                                  <div className="flex items-center gap-3 mb-3">
                                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                                          isOnLunch ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                                      }`}>
                                          {shift.user.displayName.charAt(0)}
                                      </div>
                                      <div className="flex-1">
                                          <h3 className="font-bold text-gray-900">{shift.user.displayName}</h3>
                                          <p className="text-xs text-gray-500">{shift.user.role}</p>
                                      </div>
                                      {/* Badge de status */}
                                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                                          isOnLunch
                                              ? 'bg-orange-100 text-orange-700 border border-orange-200'
                                              : 'bg-green-100 text-green-700 border border-green-200'
                                      }`}>
                                          {isOnLunch ? 'â˜• Almoço' : 'ðŸŸ¢ Trabalhando'}
                                      </span>
                                  </div>

                                  {/* Almoço em andamento */}
                                  {isOnLunch && (
                                      <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mb-3 text-center">
                                          <p className="text-[10px] text-orange-600 font-bold uppercase tracking-wider mb-0.5">â± Almoço em andamento</p>
                                          <p className="text-xl font-black font-mono text-orange-700">{msToHHMM(lunchElapsedMs)}</p>
                                          <p className="text-[10px] text-orange-500">Inicio: {shift.lunchEntry!.timestamp.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                      </div>
                                  )}

                                  {/* Detalhes dos turnos */}
                                  <div className="space-y-1.5 mb-4 text-sm">
                                      <div className="flex justify-between">
                                          <span className="text-gray-500">Entrada:</span>
                                          <span className="font-mono font-medium">{entryDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                      </div>
                                      <div className="flex justify-between">
                                          <span className="text-gray-500">Turno 1:</span>
                                          <span className="font-mono font-medium text-blue-700">{msToHHMM(t1Ms)}</span>
                                      </div>
                                      {lunchEndEntry && (
                                          <div className="flex justify-between">
                                              <span className="text-gray-500">Turno 2:</span>
                                              <span className="font-mono font-medium text-blue-700">{msToHHMM(t2Ms)}</span>
                                          </div>
                                      )}
                                      <div className="flex justify-between border-t border-gray-100 pt-1.5">
                                          <span className="text-gray-700 font-bold">Total trabalhado:</span>
                                          <span className={`font-mono font-black ${
                                              isCritical ? 'text-red-600' : 'text-green-700'
                                          }`}>{msToHHMM(totalWorkedMs)}</span>
                                      </div>
                                  </div>

                                  {(() => {
                                    const nextAction = getNextForceAction(shift);
                                    const cfg = FORCE_ACTION_CONFIG[nextAction] || FORCE_ACTION_CONFIG.exit;
                                    return (
                                      <button
                                          onClick={() => handleOpenForceExit(shift)}
                                          className={`w-full py-2 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${cfg.buttonColor}`}
                                      >
                                        <X size={14} /> {cfg.buttonLabel}
                                      </button>
                                    );
                                  })()}

                                  {/* Botão para inspecionar registros */}
                                  <button
                                      onClick={() => setExpandedShiftIdx(expandedShiftIdx === idx ? null : idx)}
                                      className="w-full mt-2 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                                  >
                                      <Search size={12} />
                                      {expandedShiftIdx === idx ? 'Ocultar Registros' : 'Inspecionar Registros'}
                                  </button>

                                  {/* Painel de debug — mostra exatamente o que o card está usando */}
                                  {expandedShiftIdx === idx && (() => {
                                    const userEntries = allMonitoringEntries
                                      .filter(e => e.userId === shift.user.uid)
                                      .sort((a, b) => a.timestamp.toDate().getTime() - b.timestamp.toDate().getTime());
                                    const lastEntry = [...userEntries].sort((a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime())[0];
                                    const shiftEntryTs = shift.entry.timestamp.toDate();
                                    const elapsedMs = Date.now() - shiftEntryTs.getTime();
                                    const elapsedH = Math.floor(elapsedMs / 3600000);
                                    const elapsedM = Math.floor((elapsedMs % 3600000) / 60000);
                                    return (
                                      <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
                                        {/* Por que está aberto */}
                                        <div className="bg-red-50 px-3 py-2 border-b border-red-200">
                                          <h4 className="text-xs font-bold text-red-700 mb-1">⚠️ Por que este turno aparece como aberto?</h4>
                                          <p className="text-[10px] text-red-600">
                                            Última ação: <strong>{lastEntry?.type || '?'}</strong> em {lastEntry?.timestamp.toDate().toLocaleString('pt-BR')}
                                            {' '}— Como não é "exit", o sistema considera o turno aberto.
                                          </p>
                                          <p className="text-[10px] text-red-600 mt-0.5">
                                            Entrada usada no card: <strong>{shiftEntryTs.toLocaleString('pt-BR')}</strong> — Há <strong>{elapsedH}h {elapsedM}m</strong>
                                          </p>
                                        </div>

                                        {/* Entradas que o card usa */}
                                        <div className="bg-blue-50 px-3 py-2 border-b border-blue-200">
                                          <h4 className="text-xs font-bold text-blue-700 mb-1">📌 Registros usados neste card</h4>
                                          <div className="space-y-1 text-[11px]">
                                            <div className="flex justify-between">
                                              <span className="text-blue-800">🟢 Entrada (shift.entry)</span>
                                              <span className="font-mono text-blue-700">{shiftEntryTs.toLocaleString('pt-BR')} <span className="bg-blue-100 px-1 rounded text-[9px]">ID: {shift.entry.id?.slice(-6)}</span></span>
                                            </div>
                                            {shift.lunchEntry && (
                                              <div className="flex justify-between">
                                                <span className="text-blue-800">🍽️ Almoço (lunchEntry)</span>
                                                <span className="font-mono text-blue-700">{shift.lunchEntry.timestamp.toDate().toLocaleString('pt-BR')} <span className="bg-blue-100 px-1 rounded text-[9px]">ID: {shift.lunchEntry.id?.slice(-6)}</span></span>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {/* Todos os registros do usuário na janela de monitoramento */}
                                        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                                          <h4 className="text-xs font-bold text-gray-700">
                                            📋 Todos os registros deste usuário na janela de monitoramento — {userEntries.length} encontrado(s)
                                          </h4>
                                        </div>
                                        <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-100">
                                          {userEntries.length === 0 ? (
                                            <p className="text-xs text-gray-400 text-center py-4">Nenhum registro encontrado.</p>
                                          ) : userEntries.map((e, eIdx) => {
                                            const ts = e.timestamp.toDate();
                                            const isShiftEntry = e.id === shift.entry.id;
                                            const isLunchEntry = e.id === shift.lunchEntry?.id;
                                            const typeLabels: Record<string, string> = {
                                              entry: '🟢 Entrada',
                                              lunch_start: '🍽️ Ida Almoço',
                                              lunch_end: '🍽️ Volta Almoço',
                                              exit: '🔴 Saída',
                                            };
                                            return (
                                              <div key={e.id || eIdx} className={`px-3 py-2 text-xs ${isShiftEntry ? 'bg-green-50 border-l-4 border-green-500' : isLunchEntry ? 'bg-orange-50 border-l-4 border-orange-400' : e.isManual ? 'bg-yellow-50' : ''}`}>
                                                <div className="flex items-center justify-between gap-2">
                                                  <span className="font-bold text-gray-800">
                                                    {typeLabels[e.type] || e.type}
                                                    {isShiftEntry && <span className="ml-1 text-[9px] bg-green-200 text-green-800 px-1 rounded">← USADO NO CARD</span>}
                                                    {isLunchEntry && <span className="ml-1 text-[9px] bg-orange-200 text-orange-800 px-1 rounded">← ALMOÇO NO CARD</span>}
                                                  </span>
                                                  <span className="font-mono text-gray-600">
                                                    {ts.toLocaleDateString('pt-BR')} {ts.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit', second: '2-digit'})}
                                                  </span>
                                                </div>
                                                <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-gray-500">
                                                  <span className="font-mono bg-gray-100 px-1 rounded">ID: {e.id?.slice(-6)}</span>
                                                  {e.locationId && <span>Local: {e.locationId.slice(0, 12)}</span>}
                                                  {e.isManual && <span className="text-orange-600 font-bold">✏️ Manual</span>}
                                                  {e.editedBy && <span className="text-blue-600">Editado por: {(e as any).editedByNome || e.editedBy.slice(0, 8)}</span>}
                                                  {e.editReason && <span className="text-purple-600">Motivo: {e.editReason}</span>}
                                                  {(e as any).forcedClose && <span className="text-red-600 font-bold">⚡ Forçado</span>}
                                                  {(e as any).deleted && <span className="text-red-600 font-bold">🗑 Deletado</span>}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })()}
                              </div>
                          );
                      })}
                  </div>
              )}

          </div>
      )}

      {/* --- PONTO LOGS TAB --- */}
      {activeTab === 'pontoLogs' && (() => {
        const typeLabel = (type: string) => ({
          entry: 'Entrada', lunch_start: 'Início Almoço',
          lunch_end: 'Volta Almoço', exit: 'Saída',
        }[type] || type);

        const QualityBadge = ({ quality }: { quality?: string }) => {
          if (!quality || quality === 'ok')
            return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full"><CheckCircle2 size={10} /> OK</span>;
          if (quality === 'partial')
            return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded-full"><AlertTriangle size={10} /> Parcial</span>;
          return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full"><AlertCircle size={10} /> Emergencial</span>;
        };

        const errDetail = (d: ErrorDetail | null | undefined) => {
          if (!d) return null;
          const parts = [`${d.name}: ${d.message}`];
          if (d.code !== undefined) parts.push(`code=${d.code}`);
          if (d.deviceContext?.connection) parts.push(`net=${d.deviceContext.connection}`);
          if (d.deviceContext?.platform) parts.push(`plt=${d.deviceContext.platform}`);
          return parts.join(' · ');
        };

        const okCount        = pontoLogs.filter(e => !(e as any).registrationQuality || (e as any).registrationQuality === 'ok').length;
        const partialCount   = pontoLogs.filter(e => (e as any).registrationQuality === 'partial').length;
        const emergencyCount = pontoLogs.filter(e => (e as any).registrationQuality === 'emergency').length;

        return (
          <div className="space-y-4">

            {/* Filtros */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Funcionário</label>
                  <select value={logFilterUserId} onChange={e => setLogFilterUserId(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5">
                    <option value="">Todos</option>
                    {users.map(u => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Qualidade</label>
                  <select value={logFilterQuality} onChange={e => setLogFilterQuality(e.target.value as any)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5">
                    <option value="all">Todos</option>
                    <option value="ok">✅ OK</option>
                    <option value="partial">⚠️ Parcial</option>
                    <option value="emergency">🆘 Emergencial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">De</label>
                  <input type="date" value={logDateFrom} onChange={e => setLogDateFrom(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Até</label>
                  <input type="date" value={logDateTo} onChange={e => setLogDateTo(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5" />
                </div>
              </div>
              <button onClick={fetchPontoLogs}
                className="mt-3 px-4 py-2 bg-brand-600 text-white text-sm font-bold rounded-lg hover:bg-brand-700 flex items-center gap-2">
                {loadingLogs ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Buscar Logs
              </button>
            </div>

            {/* Resumo */}
            {pontoLogs.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                  <div className="text-2xl font-black text-green-700">{okCount}</div>
                  <div className="text-xs font-bold text-green-600">✅ OK</div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center">
                  <div className="text-2xl font-black text-yellow-700">{partialCount}</div>
                  <div className="text-xs font-bold text-yellow-600">⚠️ Parcial</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                  <div className="text-2xl font-black text-red-700">{emergencyCount}</div>
                  <div className="text-xs font-bold text-red-600">🆘 Emergencial</div>
                </div>
              </div>
            )}

            {/* Tabela */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {loadingLogs ? (
                <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-brand-600" /></div>
              ) : pontoLogs.length === 0 ? (
                <p className="p-8 text-center text-gray-400 italic">Nenhum registro encontrado. Use os filtros acima e clique em "Buscar Logs".</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Funcionário</th>
                          <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Data/Hora</th>
                          <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Tipo</th>
                          <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Qualidade</th>
                          <th className="text-center px-4 py-3 text-xs font-bold text-gray-500 uppercase" title="Câmera"><Camera size={12} /></th>
                          <th className="text-center px-4 py-3 text-xs font-bold text-gray-500 uppercase" title="GPS"><MapPin size={12} /></th>
                          <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">Detalhe do Erro</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {pontoLogs
                          .slice(logPage * LOG_PAGE_SIZE, (logPage + 1) * LOG_PAGE_SIZE)
                          .map(entry => {
                            const e = entry as any;
                            const hasError = e.registrationQuality === 'partial' || e.registrationQuality === 'emergency';
                            const photoErrStr = errDetail(e.photoErrorDetail);
                            const gpsErrStr   = errDetail(e.gpsErrorDetail);
                            const fullErrStr  = [photoErrStr && `📷 ${photoErrStr}`, gpsErrStr && `📍 ${gpsErrStr}`].filter(Boolean).join('  ·  ');
                            return (
                              <tr key={entry.id} className={`hover:bg-gray-50 transition-colors ${ hasError ? 'bg-red-50/30' : '' }`}>
                                <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{e.userName}</td>
                                <td className="px-4 py-3 font-mono text-gray-600 whitespace-nowrap">
                                  {entry.timestamp?.toDate?.()?.toLocaleDateString('pt-BR')}{' '}
                                  {entry.timestamp?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="px-4 py-3 text-gray-600">{typeLabel(entry.type)}</td>
                                <td className="px-4 py-3"><QualityBadge quality={e.registrationQuality} /></td>
                                <td className="px-4 py-3 text-center">
                                  {e.photoStatus === 'ok'
                                    ? <Camera size={14} className="text-green-500 mx-auto" />
                                    : <Camera size={14} className="text-red-400 mx-auto" />}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {e.gpsStatus === 'ok'
                                    ? <MapPin size={14} className="text-green-500 mx-auto" />
                                    : e.gpsStatus === 'best_effort'
                                    ? <MapPin size={14} className="text-yellow-500 mx-auto" />
                                    : <MapPin size={14} className="text-red-400 mx-auto" />}
                                </td>
                                <td className="px-4 py-3 max-w-xs">
                                  {fullErrStr
                                    ? <span className="block text-xs text-gray-600 truncate" title={fullErrStr}>{fullErrStr}</span>
                                    : <span className="text-gray-300 text-xs">—</span>}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginação */}
                  {pontoLogs.length > LOG_PAGE_SIZE && (
                    <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {logPage * LOG_PAGE_SIZE + 1}–{Math.min((logPage + 1) * LOG_PAGE_SIZE, pontoLogs.length)} de {pontoLogs.length}
                      </span>
                      <div className="flex gap-2">
                        <button disabled={logPage === 0} onClick={() => setLogPage(p => p - 1)}
                          className="px-3 py-1 text-xs font-bold bg-gray-100 rounded-lg disabled:opacity-40 hover:bg-gray-200">← Anterior</button>
                        <button disabled={(logPage + 1) * LOG_PAGE_SIZE >= pontoLogs.length} onClick={() => setLogPage(p => p + 1)}
                          className="px-3 py-1 text-xs font-bold bg-gray-100 rounded-lg disabled:opacity-40 hover:bg-gray-200">Próximo →</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })()}

    </div>

      {/* ── MODAL: Ação Forçada (Almoço / Saída) ── */}
      {forceExitModalOpen && selectedShiftToClose && (() => {
        const cfg = FORCE_ACTION_CONFIG[forceActionType] || FORCE_ACTION_CONFIG.exit;
        const entryDate = selectedShiftToClose.entry.timestamp.toDate();
        const dateDisplay = entryDate.toLocaleDateString('pt-BR');
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">{cfg.label}</h3>
                <button onClick={() => setForceExitModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1">
                <p className="text-sm text-gray-700">
                  <span className="font-bold">Colaborador:</span> {selectedShiftToClose.user.displayName}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-bold">Data do turno:</span> {dateDisplay}
                </p>
                <p className="text-sm text-gray-700">
                  <span className="font-bold">Entrada:</span> {entryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Horário da Ação ({dateDisplay})
                </label>
                <input
                  type="time"
                  value={exitTime}
                  onChange={e => setExitTime(e.target.value)}
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900 text-sm px-3 py-2 border"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  O horário será registrado na data {dateDisplay} (data do turno).
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Motivo</label>
                <input
                  type="text"
                  value={exitReason}
                  onChange={e => setExitReason(e.target.value)}
                  placeholder="Ex: Esquecimento de registro..."
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900 text-sm px-3 py-2 border"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setForceExitModalOpen(false)}
                  className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={submitForceExit}
                  disabled={isSavingExit || !exitTime || !exitReason}
                  className={`flex-1 py-2 text-white rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${cfg.buttonColor}`}
                >
                  {isSavingExit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {isSavingExit ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
};

export default AttendanceReports;

