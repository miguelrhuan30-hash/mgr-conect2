import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, Timestamp, orderBy, addDoc, serverTimestamp, updateDoc, deleteDoc, doc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, TimeEntry, UserProfile, TimeBankEntry, EmployeeOccurrence, OCCURRENCE_LABELS, OCCURRENCE_COLORS } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { calcularTurnos, Turno, toDateStr } from '../utils/shift-calculator';
import { adicionarRegistro, editarHorarioRegistro, excluirRegistro } from '../utils/shift-editor';
import { 
  Calendar, User, Search, AlertCircle, CheckCircle, Clock, 
  AlertTriangle, ShieldAlert, X, Save, Loader2, Calculator, 
  FileText, FileSpreadsheet, MapPin, Edit2, Banknote, PiggyBank,
  History, Camera, Trash2, Pencil
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const AttendanceReports: React.FC = () => {
  const { userProfile, currentUser } = useAuth();
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'report' | 'monitoring' | 'adjustments'>('monitoring');

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
  const [selectedShiftToClose, setSelectedShiftToClose] = useState<{user: UserProfile, entry: TimeEntry} | null>(null);
  const [exitTime, setExitTime] = useState('');
  const [exitReason, setExitReason] = useState('');
  const [isSavingExit, setIsSavingExit] = useState(false);

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
      const turnosPorDia = new Map<string, Turno>();
      calcularTurnos(entries).forEach(t => {
        // Guardar apenas o primeiro turno do dia (se houver duplicata, preserva o primeiro)
        if (!turnosPorDia.has(t.data)) {
          turnosPorDia.set(t.data, t);
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

  const handleOpenForceExit = (shift: {user: UserProfile, entry: TimeEntry}) => {
      setSelectedShiftToClose(shift);
      // Default exit time: 9 hours after entry or current time if earlier
      const entryDate = shift.entry.timestamp.toDate();
      const defaultExit = new Date(entryDate.getTime() + 9 * 60 * 60 * 1000); // +9h
      
      // Format for datetime-local input (YYYY-MM-DDTHH:mm)
      // Adjust for timezone offset for input value
      const tzOffset = defaultExit.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(defaultExit.getTime() - tzOffset)).toISOString().slice(0, 16);
      
      setExitTime(localISOTime);
      setExitReason('Esquecimento - Fechamento administrativo');
      setForceExitModalOpen(true);
  };

  const submitForceExit = async () => {
      if (!selectedShiftToClose || !exitTime || !exitReason) return;
      setIsSavingExit(true);

      try {
          const exitTimestamp = new Date(exitTime);
          
          await addDoc(collection(db, CollectionName.TIME_ENTRIES), {
              userId: selectedShiftToClose.user.uid,
              type: 'exit',
              timestamp: Timestamp.fromDate(exitTimestamp),
              locationId: 'manual_adjustment',
              isManual: true,
              forcedClose: true,
              editedBy: currentUser?.uid,
              editReason: exitReason,
              userAgent: 'Manager Dashboard'
          });

          setForceExitModalOpen(false);
          fetchOpenShifts(); // Refresh list
          alert("Turno encerrado com sucesso.");
      } catch (error) {
          console.error(error);
          alert("Erro ao encerrar turno.");
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
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-900">Gestão de Ponto e Frequência</h1>
           <p className="text-gray-500">Monitoramento em tempo real e relatórios mensais.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
          <button 
             onClick={() => setActiveTab('monitoring')}
             className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'monitoring' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
             Monitoramento de Turnos
          </button>
          <button 
             onClick={() => setActiveTab('report')}
             className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'report' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
             Espelho de Ponto (Mensal)
          </button>
          <button 
             onClick={() => setActiveTab('adjustments')}
             className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'adjustments' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
             Ajustes Manuais
          </button>
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

                          // Turno 1: entrada até início do almoço (ou até agora se não há almoço)
                          const lunchStartDate = isOnLunch ? shift.lunchEntry!.timestamp.toDate() : null;
                          const t1Ms = lunchStartDate
                              ? lunchStartDate.getTime() - entryDate.getTime()
                              : getShiftDurationMs(entryDate, liveTime);

                          // Turno 2: volta do almoço até agora (lunch_end)
                          const userAllEntries = allMonitoringEntries
                              .filter(e => e.userId === shift.user.uid)
                              .sort((a,b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime());
                          const lunchEndEntry = userAllEntries.find(e => e.type === 'lunch_end');
                          const t2Ms = lunchEndEntry
                              ? getShiftDurationMs(lunchEndEntry.timestamp.toDate(), liveTime)
                              : 0;

                          // Almoço em andamento
                          const lunchElapsedMs = isOnLunch
                              ? getShiftDurationMs(shift.lunchEntry!.timestamp.toDate(), liveTime)
                              : 0;

                          // Total trabalhado (T1 + T2)
                          const totalWorkedMs = t1Ms + t2Ms;

                          // Total desde entrada (para checar turno crítico)
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

                                  <button
                                      onClick={() => handleOpenForceExit(shift)}
                                      className="w-full py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                                  >
                                      <X size={14} /> Encerrar Turno (Forçar Saída)
                                  </button>
                              </div>
                          );
                      })}
                  </div>
              )}


          </div>
      )}

      {/* --- MONTHLY REPORT TAB --- */}
      {activeTab === 'report' && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-6">
             <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Colaborador</label>
                    <div className="relative">
                    <User className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                    <select 
                        value={selectedUser} 
                        onChange={e => setSelectedUser(e.target.value)}
                        className="w-full pl-9 rounded-lg border-gray-300 bg-white text-gray-900"
                    >
                        <option value="">Selecione...</option>
                        {users.map(u => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
                    </select>
                    </div>
                </div>
                
                <div className="w-full md:w-48">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mês Ref.</label>
                    <input 
                    type="month" 
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                    className="w-full rounded-lg border-gray-300 bg-white text-gray-900" 
                    />
                </div>

                <button 
                onClick={generateReport}
                disabled={!selectedUser || loading}
                className="w-full md:w-auto px-6 py-2.5 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-70 flex items-center justify-center gap-2"
                >
                    {loading ? 'Carregando...' : <><Search size={18}/> Gerar Relatório</>}
                </button>

                {reportData.length > 0 && (
                    <button 
                        onClick={applyToBank}
                        disabled={isSavingBank || !reportData.some(day => dayDestinations[day.date] === 'bank')}
                        className={`w-full md:w-auto px-6 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
                            isSavingBank 
                            ? 'bg-gray-400 text-white cursor-not-allowed' 
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg active:scale-95'
                        }`}
                    >
                        {isSavingBank ? (
                            <><Loader2 className="animate-spin" size={18}/> Processando...</>
                        ) : (
                            <><PiggyBank size={18}/> Aplicar ao Banco</>
                        )}
                    </button>
                )}
             </div>

             {/* Export Actions */}
             {reportData.length > 0 && (
                <div className="flex flex-wrap justify-end gap-3 pt-2 border-t border-gray-100">
                    <button 
                      onClick={exportPDF}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                    >
                        <FileText size={16} /> Folha de Ponto (PDF)
                    </button>
                    <button 
                      onClick={exportExcel}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                    >
                        <FileSpreadsheet size={16} /> Exportar Excel
                    </button>
                </div>
             )}

             {/* Table */}
             {reportData.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Entrada</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Almoço</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Volta</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Saída</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total / Carga</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Destino Extra</th>
                                {userProfile?.permissions?.canManageAttendance && (
                                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Ações</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {reportData.map((day, idx) => {
                                const dateObj = new Date(day.date + 'T12:00:00');
                                const schedule = getDailySchedule(day);
                                const dayStatus = getDayStatus(day);
                                const inativo = !schedule.active;
                                const worked = calcWorkedHours(day);

                                let totalColor = "text-gray-400";
                                if (worked) {
                                  if (worked.diffMinutes && worked.diffMinutes < -10) totalColor = "text-red-600 font-bold";
                                  else if (worked.diffMinutes && worked.diffMinutes > 10) totalColor = "text-blue-600 font-bold";
                                  else totalColor = "text-green-600 font-bold";
                                }

                                return (
                                    <tr key={idx} className={`${inativo ? 'bg-gray-50/50' : 'hover:bg-gray-50'} group`}>
                                        {/* DATA */}
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {dateObj.toLocaleDateString()} <span className="text-gray-400 font-normal text-xs ml-1">({dateObj.toLocaleDateString(undefined, {weekday: 'short'})})</span>
                                        </td>
                                        {/* ENTRADA */}
                                        <td className="px-4 py-3 text-center">
                                            {day.entry ? (
                                                <span className={`px-2 py-1 rounded text-sm font-bold ${dayStatus.type === 'late' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                    {getTimeString(day.entry)}
                                                </span>
                                            ) : <span className="text-gray-400">-</span>}
                                            {(day.entry?.isManual || day.entry?.editedBy) && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 ml-1 whitespace-nowrap" title={day.entry?.editReason || "Editado pelo gestor"}>Editado</span>}
                                        </td>
                                        {/* ALMOÇO */}
                                        <td className="px-4 py-3 text-center text-sm text-gray-600">
                                            {day.lunchStart ? getTimeString(day.lunchStart) : '-'}
                                            {(day.lunchStart?.isManual || day.lunchStart?.editedBy) && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 ml-1 whitespace-nowrap" title={day.lunchStart?.editReason || "Editado pelo gestor"}>Editado</span>}
                                        </td>
                                        {/* VOLTA */}
                                        <td className="px-4 py-3 text-center text-sm text-gray-600">
                                            {day.lunchEnd ? getTimeString(day.lunchEnd) : '-'}
                                            {(day.lunchEnd?.isManual || day.lunchEnd?.editedBy) && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 ml-1 whitespace-nowrap" title={day.lunchEnd?.editReason || "Editado pelo gestor"}>Editado</span>}
                                        </td>
                                        {/* SAÍDA */}
                                        <td className="px-4 py-3 text-center text-sm font-bold">
                                            {day.exit ? (
                                                <div className="flex flex-col items-center">
                                                    <span>{getTimeString(day.exit)}</span>
                                                    {day.exit.forcedClose && <span className="text-[10px] text-red-500 font-normal">Forçado</span>}
                                                </div>
                                            ) : <span className="text-gray-400 font-normal">-</span>}
                                            {(day.exit?.isManual || day.exit?.editedBy) && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 ml-1 whitespace-nowrap" title={day.exit?.editReason || "Editado pelo gestor"}>Editado</span>}
                                        </td>
                                        {/* TOTAL / CARGA */}
                                        <td className={`px-4 py-3 text-center text-sm ${totalColor} whitespace-nowrap`}>
                                            {day.inconsistente ? <span className="text-red-600 font-bold text-[11px]">&#9888; Inconsistente</span> : worked ? worked.display : '--'}
                                        </td>
                                        {/* STATUS */}
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className={`text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${dayStatus.color}`}>
                                                    {dayStatus.label}
                                                </span>

                                                {/* Badge: turno inconsistente (duracao > 16h — revisar) */}
                                                {day.inconsistente && (
                                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 whitespace-nowrap">
                                                    &#9888; Revisar
                                                  </span>
                                                )}

                                                {/* Ocorrência badge */}
                                                {(() => {
                                                  const dayOccs = occurrencesForReport.filter(o => o.data === day.date);
                                                  if (dayOccs.length === 0) return null;
                                                  return (
                                                    <div className="flex flex-col items-center gap-0.5 mt-0.5">
                                                      {dayOccs.map(occ => (
                                                        <div key={occ.id} className="flex items-center gap-1">
                                                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border ${OCCURRENCE_COLORS[occ.tipo]}`}>
                                                            {OCCURRENCE_LABELS[occ.tipo]}
                                                          </span>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  );
                                                })()}

                                                {/* Map Links */}
                                                {(day.entry?.mapsUrl || day.exit?.mapsUrl) && (
                                                    <div className="flex gap-1 mt-1">
                                                        {day.entry?.mapsUrl && (
                                                            <a href={day.entry.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5">
                                                                <MapPin size={8} /> E
                                                            </a>
                                                        )}
                                                        {day.exit?.mapsUrl && (
                                                            <a href={day.exit.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5">
                                                                <MapPin size={8} /> S
                                                            </a>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        {/* DESTINO EXTRA */}
                                        <td className="px-4 py-3 text-center">
                                            {worked && worked.diffMinutes > 10 && !processedDates.has(day.date) && (
                                                <select
                                                    value={dayDestinations[day.date] || 'pay'}
                                                    onChange={(e) => setDayDestinations({
                                                        ...dayDestinations,
                                                        [day.date]: e.target.value as 'pay' | 'bank'
                                                    })}
                                                    className="text-xs border rounded px-1 py-0.5 bg-white text-gray-900"
                                                >
                                                    <option value="pay">💰 Pagar</option>
                                                    <option value="bank">🏦 Banco</option>
                                                </select>
                                            )}
                                            {processedDates.has(day.date) && (
                                                <span className="text-[10px] font-bold text-green-600 flex items-center justify-center gap-1">
                                                    <CheckCircle size={10} /> Processado
                                                </span>
                                            )}
                                        </td>
                                        {/* AÇÕES */}
                                        {userProfile?.permissions?.canManageAttendance && (
                                          <td className="px-4 py-3 text-center">
                                            <button
                                              onClick={() => openDayEditModal(day)}
                                              className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                              title="Editar registros do dia"
                                            >
                                              <Pencil size={16} />
                                            </button>
                                          </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-gray-100 font-bold text-gray-900 border-t-2 border-gray-300">
                            <tr>
                                <td colSpan={6} className="px-6 py-4 text-right uppercase text-xs tracking-wider">Totais do Mês</td>
                                <td className="px-6 py-4 text-center text-brand-700 text-base">{summary.totalTime}</td>
                                <td className="px-6 py-4 text-center text-xs font-normal">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-green-600">{summary.daysWorked} dias trab.</span>
                                        {summary.absences > 0 && <span className="text-red-600">{summary.absences} faltas</span>}
                                    </div>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
             )}

             {/* Financial Summary */}
             {reportData.length > 0 && canViewFinancials && (
                 <div className="mt-8 bg-gray-50 p-6 rounded-xl border border-gray-200">
                     <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                       <Calculator size={20} className="text-brand-600"/>
                       Resumo Financeiro Mensal (CLT)
                     </h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                         <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                             <p className="text-sm text-gray-500">Horas Normais</p>
                             <p className="text-lg font-bold text-gray-900">{financialSummary.normalHours.toFixed(1)}h</p>
                             <p className="text-sm text-green-600 font-medium">R$ {financialSummary.valueNormal.toFixed(2)}</p>
                         </div>
                         <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                             <p className="text-sm text-gray-500">Horas Extras (50%)</p>
                             <p className="text-lg font-bold text-gray-900">{financialSummary.extra50Hours.toFixed(1)}h</p>
                             <p className="text-sm text-green-600 font-medium">R$ {financialSummary.valueExtra50.toFixed(2)}</p>
                         </div>
                         <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                             <p className="text-sm text-gray-500">Horas Extras (100%)</p>
                             <p className="text-lg font-bold text-gray-900">{financialSummary.extra100Hours.toFixed(1)}h</p>
                             <p className="text-sm text-green-600 font-medium">R$ {financialSummary.valueExtra100.toFixed(2)}</p>
                         </div>
                         <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                             <p className="text-sm text-gray-500">Adicional Noturno (20%)</p>
                             <p className="text-lg font-bold text-gray-900">{financialSummary.nightPremiumHours.toFixed(1)}h</p>
                             <p className="text-sm text-green-600 font-medium">R$ {financialSummary.valueNight.toFixed(2)}</p>
                         </div>
                     </div>
                     <div className="mt-6 p-4 bg-brand-50 border border-brand-200 rounded-lg flex flex-col md:flex-row justify-between items-center gap-4">
                          <div className="flex flex-col gap-2">
                              <p className="text-sm text-brand-700 font-bold uppercase tracking-wide">Salário Bruto Calculado</p>
                              <p className="text-3xl font-black text-brand-900">R$ {financialSummary.totalValue.toFixed(2)}</p>
                              {(() => {
                                const user = users.find(u => u.uid === selectedUser);
                                return typeof user?.accumulatedPrize === 'number' ? (
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-1 rounded-lg font-bold">
                                      💰 Cofre Acumulado: R$ {user.accumulatedPrize.toFixed(2)}
                                    </span>
                                  </div>
                                ) : null;
                              })()}
                          </div>
                          <button 
                             onClick={exportFinancialPDF}
                             className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors shadow-sm"
                          >
                             <FileText size={18} /> Gerar Extrato (PDF)
                          </button>
                      </div>
                 </div>
             )}
          </div>
      )}

      {/* --- ADJUSTMENTS TAB --- */}
      {activeTab === 'adjustments' && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm max-w-2xl mx-auto">
              <div className="mb-6">
                  <h2 className="text-lg font-bold text-gray-900">Lançamento Manual de Ponto</h2>
                  <p className="text-sm text-gray-500">Utilize esta ferramenta para corrigir esquecimentos ou erros no registro de ponto dos colaboradores.</p>
              </div>

              <form onSubmit={submitAdjustment} className="space-y-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Colaborador</label>
                      <select 
                          value={adjUser} 
                          onChange={e => setAdjUser(e.target.value)}
                          className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                          required
                      >
                          <option value="">Selecione o colaborador...</option>
                          {users.map(u => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
                      </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Registro</label>
                          <select 
                              value={adjType} 
                              onChange={e => setAdjType(e.target.value as any)}
                              className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                              required
                          >
                              <option value="entry">Entrada</option>
                              <option value="lunch_start">Início Almoço</option>
                              <option value="lunch_end">Fim Almoço</option>
                              <option value="exit">Saída</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Data e Hora</label>
                          <input 
                              type="datetime-local" 
                              value={adjTime} 
                              onChange={e => setAdjTime(e.target.value)}
                              className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                              required
                          />
                      </div>
                  </div>

                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Motivo / Justificativa</label>
                      <textarea 
                          value={adjReason} 
                          onChange={e => setAdjReason(e.target.value)}
                          className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                          rows={3}
                          placeholder="Ex: Colaborador esqueceu de bater o ponto na volta do almoço."
                          required
                      />
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex justify-end">
                      <button 
                          type="submit"
                          disabled={isSavingAdj || !adjUser || !adjTime || !adjReason}
                          className="px-6 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-70 flex items-center gap-2"
                      >
                          {isSavingAdj ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          Salvar Registro Manual
                      </button>
                  </div>
              </form>

              {/* --- BANK COMPENSATION SECTION --- */}
              <div className="mt-8 pt-6 border-t-2 border-indigo-100">
                <div className="mb-4 flex items-center gap-2">
                  <PiggyBank size={20} className="text-indigo-600" />
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Lancar Compensacao de Banco</h3>
                    <p className="text-xs text-gray-500">Registre horas usadas como compensacao (ex: saida antecipada). Isso debita do Banco de Horas do colaborador.</p>
                  </div>
                </div>
                <form onSubmit={submitBankCompensation} className="space-y-4 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Colaborador</label>
                    <select
                      value={bankCompUser}
                      onChange={e => setBankCompUser(e.target.value)}
                      className="w-full rounded-lg border-indigo-300 bg-white text-gray-900"
                      required
                    >
                      <option value="">Selecione o colaborador...</option>
                      {users.map(u => {
                        const bal = u.timeBankBalance ?? 0;
                        const hh = Math.floor(bal / 60);
                        const mm = bal % 60;
                        return <option key={u.uid} value={u.uid}>{u.displayName} (saldo: {hh}h {mm}min)</option>;
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Minutos a Compensar</label>
                    <input
                      type="number"
                      value={bankCompMinutes}
                      onChange={e => setBankCompMinutes(parseInt(e.target.value) || 0)}
                      min={1}
                      className="w-full rounded-lg border-indigo-300 bg-white text-gray-900"
                      placeholder="Ex: 240 = 4 horas"
                      required
                    />
                    <p className="text-xs text-indigo-600 mt-1">{Math.floor(bankCompMinutes / 60)}h {bankCompMinutes % 60}min</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Motivo / Justificativa</label>
                    <textarea
                      value={bankCompReason}
                      onChange={e => setBankCompReason(e.target.value)}
                      className="w-full rounded-lg border-indigo-300 bg-white text-gray-900"
                      rows={2}
                      placeholder="Ex: Tecnico saiu mais cedo na sexta para compensar 4h de banco."
                      required
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSavingComp || !bankCompUser || bankCompMinutes <= 0 || !bankCompReason}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-70 flex items-center gap-2"
                    >
                      {isSavingComp ? <Loader2 className="w-4 h-4 animate-spin" /> : <PiggyBank className="w-4 h-4" />}
                      Lancar Compensacao
                    </button>
                  </div>
                </form>
              </div>
          </div>
      )}

      {/* --- GLOBAL EDIT CENTER (SPRINT 14) --- */}
      {activeTab === 'adjustments' && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mt-6">
              <div className="mb-6 flex items-center justify-between border-b pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Clock className="text-brand-600" />
                        Histórico e Edição Global por Período
                    </h2>
                    <p className="text-sm text-gray-500">Busque e edite múltiplos registros de uma vez filtrando pelo período.</p>
                  </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 mb-6 items-end bg-gray-50 p-4 rounded-lg">
                  <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Data Inicial</label>
                      <input 
                        type="date" 
                        value={adjStartDate} 
                        onChange={e => setAdjStartDate(e.target.value)}
                        className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                      />
                  </div>
                  <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Data Final</label>
                      <input 
                        type="date" 
                        value={adjEndDate} 
                        onChange={e => setAdjEndDate(e.target.value)}
                        className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                      />
                  </div>
                  <button 
                    onClick={loadAdjustmentsList}
                    disabled={!adjUser || loadingAdjList}
                    className="px-6 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
                  >
                      {loadingAdjList ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />} Buscar Registros
                  </button>
              </div>

              {adjustmentsList.length > 0 ? (
                  <div className="overflow-x-auto border rounded-xl overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                              <tr>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Data/Hora Registro</th>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Tipo</th>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Localização / Foto</th>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Ajuste</th>
                                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Ação</th>
                              </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                              {adjustmentsList.filter(e => !e.excluido).map((entry) => (
                                  <AdjustEntryRow 
                                    key={entry.id} 
                                    entry={entry} 
                                    onUpdate={() => {
                                        loadAdjustmentsList();
                                        if (selectedUser === adjUser) generateReport();
                                    }} 
                                  />
                              ))}
                          </tbody>
                      </table>
                  </div>
              ) : (
                  !loadingAdjList && adjUser && (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                        <AlertCircle className="mx-auto w-12 h-12 text-gray-300 mb-2" />
                        <p className="text-gray-500 font-medium">Nenhum registro encontrado para este período.</p>
                    </div>
                  )
              )}
          </div>
      )}

      {/* FORCE EXIT MODAL */}
      {forceExitModalOpen && selectedShiftToClose && (
         <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                 <h2 className="text-xl font-bold text-gray-900 mb-2">Encerrar Turno Manualmente</h2>
                 <p className="text-sm text-gray-500 mb-6">
                     Você está forçando a saída de <strong className="text-gray-900">{selectedShiftToClose.user.displayName}</strong>. 
                     Esta ação ficará registrada na auditoria.
                 </p>

                 <div className="space-y-4">
                     <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Data/Hora da Saída</label>
                         <input 
                            type="datetime-local" 
                            value={exitTime} 
                            onChange={e => setExitTime(e.target.value)}
                            className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                         />
                     </div>
                     <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Motivo / Justificativa</label>
                         <textarea 
                            rows={2}
                            value={exitReason} 
                            onChange={e => setExitReason(e.target.value)}
                            className="w-full rounded-lg border-gray-300 resize-none bg-white text-gray-900"
                            placeholder="Ex: Colaborador esqueceu de registrar saída."
                         />
                     </div>
                 </div>

                 <div className="flex gap-3 mt-6">
                     <button 
                        onClick={() => setForceExitModalOpen(false)}
                        className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                     >
                        Cancelar
                     </button>
                     <button 
                        onClick={submitForceExit}
                        disabled={isSavingExit}
                        className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center justify-center gap-2"
                     >
                        {isSavingExit ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Salvar
                     </button>
                 </div>
             </div>
         </div>
      )}

      {/* DAY EDIT MODAL */}
      {dayEditModalOpen && dayEditData && (
         <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
             <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full my-8">
                 <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                   <div>
                     <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                       <Pencil size={18} className="text-brand-600" /> Editar Registros do Dia
                     </h2>
                     <p className="text-xs text-gray-500 mt-0.5">
                       {new Date(dayEditData.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                     </p>
                   </div>
                   <button onClick={() => setDayEditModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                     <X size={20} />
                   </button>
                 </div>

                 <div className="p-6 space-y-4">
                     {/* Entrada */}
                     <div className="flex items-center gap-3">
                       <div className="flex-1">
                         <label className="block text-xs font-bold text-green-700 mb-1">⏰ Entrada</label>
                         <input type="datetime-local" value={dayEditTimes.entry}
                           onChange={e => setDayEditTimes(p => ({...p, entry: e.target.value}))}
                           className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-300 outline-none" />
                       </div>
                       {dayEditData.entry && (
                         <button onClick={() => { deleteTimeEntry(dayEditData.entry); setDayEditModalOpen(false); }}
                           className="mt-5 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir entrada">
                           <Trash2 size={16} />
                         </button>
                       )}
                     </div>

                     {/* Almoço */}
                     <div className="flex items-center gap-3">
                       <div className="flex-1">
                         <label className="block text-xs font-bold text-orange-700 mb-1">🍽️ Ida Almoço</label>
                         <input type="datetime-local" value={dayEditTimes.lunchStart}
                           onChange={e => setDayEditTimes(p => ({...p, lunchStart: e.target.value}))}
                           className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-300 outline-none" />
                       </div>
                       {dayEditData.lunchStart && (
                         <button onClick={() => { deleteTimeEntry(dayEditData.lunchStart); setDayEditModalOpen(false); }}
                           className="mt-5 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir ida almoço">
                           <Trash2 size={16} />
                         </button>
                       )}
                     </div>

                     {/* Volta */}
                     <div className="flex items-center gap-3">
                       <div className="flex-1">
                         <label className="block text-xs font-bold text-blue-700 mb-1">🔄 Volta Almoço</label>
                         <input type="datetime-local" value={dayEditTimes.lunchEnd}
                           onChange={e => setDayEditTimes(p => ({...p, lunchEnd: e.target.value}))}
                           className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-300 outline-none" />
                       </div>
                       {dayEditData.lunchEnd && (
                         <button onClick={() => { deleteTimeEntry(dayEditData.lunchEnd); setDayEditModalOpen(false); }}
                           className="mt-5 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir volta almoço">
                           <Trash2 size={16} />
                         </button>
                       )}
                     </div>

                     {/* Saída */}
                     <div className="flex items-center gap-3">
                       <div className="flex-1">
                         <label className="block text-xs font-bold text-red-700 mb-1">🚪 Saída</label>
                         <input type="datetime-local" value={dayEditTimes.exit}
                           onChange={e => setDayEditTimes(p => ({...p, exit: e.target.value}))}
                           className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-300 outline-none" />
                       </div>
                       {dayEditData.exit && (
                         <button onClick={() => { deleteTimeEntry(dayEditData.exit); setDayEditModalOpen(false); }}
                           className="mt-5 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir saída">
                           <Trash2 size={16} />
                         </button>
                       )}
                     </div>

                     {/* Motivo */}
                     <div className="pt-2 border-t border-gray-100">
                       <label className="block text-xs font-bold text-gray-700 mb-1">📝 Motivo / Justificativa</label>
                       <textarea rows={2} value={dayEditReason} onChange={e => setDayEditReason(e.target.value)}
                         className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-brand-300 outline-none"
                         placeholder="Ex: Correção de esquecimento de registro." />
                     </div>
                 </div>

                 <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                     <button onClick={() => setDayEditModalOpen(false)}
                       className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 font-medium text-sm">
                       Cancelar
                     </button>
                     <button onClick={submitDayEdit}
                       disabled={isSavingDayEdit || !dayEditReason}
                       className="flex-1 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                       {isSavingDayEdit ? <><Loader2 className="animate-spin" size={16}/> Salvando...</> : <><Save size={16}/> Salvar Alterações</>}
                     </button>
                 </div>
             </div>
         </div>
      )}

    </div>
  );
};

// --- SUB-COMPONENT FOR GLOBAL EDIT ROW ---
const AdjustEntryRow: React.FC<{ entry: TimeEntry, onUpdate: () => void }> = ({ entry, onUpdate }) => {
    const { currentUser } = useAuth();
    const [newTime, setNewTime] = useState(new Date(entry.timestamp.toDate().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16));
    const [newType, setNewType] = useState(entry.type);
    const [reason, setReason] = useState(entry.editReason || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleUpdate = async () => {
        if (!reason) {
            alert("Por favor, insira uma justificativa para a alteração.");
            return;
        }
        setIsSaving(true);
        try {
            const entryRef = doc(db, CollectionName.TIME_ENTRIES, entry.id);
            await updateDoc(entryRef, {
                timestamp: Timestamp.fromDate(new Date(newTime)),
                type: newType,
                editedBy: currentUser?.uid,
                editReason: reason,
                editTimestamp: serverTimestamp(),
                isManual: true
            });
            onUpdate();
        } catch (error) {
            console.error("Error updating entry:", error);
            alert("Erro ao atualizar registro.");
        } finally {
            setIsSaving(false);
        }
    };

    const originalTime = new Date(entry.timestamp.toDate().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    const isChanged = newTime !== originalTime || newType !== entry.type;

    return (
        <tr className={`hover:bg-gray-50 transition-colors ${entry.editedBy ? 'bg-amber-50/30' : ''}`}>
            <td className="px-4 py-3 whitespace-nowrap">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">{entry.timestamp.toDate().toLocaleString()}</span>
                        {entry.editedBy && (
                            <span className="flex items-center gap-0.5 text-[9px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded uppercase tracking-tighter" title={`Editado por UID: ${entry.editedBy}`}>
                                <History size={10} /> Editado
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">{entry.id}</span>
                </div>
            </td>
            <td className="px-4 py-3">
                <div className="flex flex-col gap-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase w-fit ${
                        entry.type === 'entry' ? 'bg-green-100 text-green-700 border border-green-200' :
                        entry.type === 'exit' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                    }`}>
                        {entry.type === 'entry' ? 'Entrada' : entry.type === 'exit' ? 'Saída' : entry.type === 'lunch_start' ? 'Início Almoço' : 'Fim Almoço'}
                    </span>
                    {entry.isManual && !entry.editedBy && (
                        <span className="text-[9px] text-gray-500 font-medium italic">Lançamento Manual</span>
                    )}
                </div>
            </td>
            <td className="px-4 py-3">
                <div className="flex flex-col gap-1.5">
                    {entry.locationName ? (
                        <span className="text-xs text-gray-600 flex items-center gap-1">
                            <MapPin size={12} className="text-gray-400" /> {entry.locationName}
                        </span>
                    ) : entry.coordinates ? (
                        <a href={`https://www.google.com/maps?q=${entry.coordinates.lat},${entry.coordinates.lng}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                            <MapPin size={12} /> Ver no Mapa
                        </a>
                    ) : <span className="text-xs text-gray-400 italic">Sem localização</span>}
                    
                    {entry.photoUrl ? (
                        <a href={entry.photoUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 font-medium hover:underline flex items-center gap-1">
                            <Camera size={12} /> Ver Evidência
                        </a>
                    ) : <span className="text-xs text-gray-400 italic">Sem foto</span>}
                </div>
            </td>
            <td className="px-4 py-3 min-w-[320px]">
                <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-0.5">
                            <label className="text-[9px] font-bold text-gray-400 uppercase">Ajustar Hora</label>
                            <input 
                                type="datetime-local" 
                                value={newTime}
                                onChange={e => setNewTime(e.target.value)}
                                className="text-xs rounded-lg border-gray-200 w-full text-gray-900 focus:ring-brand-500 focus:border-brand-500 py-1"
                            />
                        </div>
                        <div className="space-y-0.5">
                            <label className="text-[9px] font-bold text-gray-400 uppercase">Ajustar Tipo</label>
                            <select 
                                value={newType}
                                onChange={e => setNewType(e.target.value as any)}
                                className="text-xs rounded-lg border-gray-200 w-full text-gray-900 focus:ring-brand-500 focus:border-brand-500 py-1"
                            >
                                <option value="entry">Entrada</option>
                                <option value="lunch_start">Início Almoço</option>
                                <option value="lunch_end">Fim Almoço</option>
                                <option value="exit">Saída</option>
                            </select>
                        </div>
                    </div>
                    <div className="space-y-0.5">
                        <label className="text-[9px] font-bold text-gray-400 uppercase">Justificativa da Alteração</label>
                        <input 
                            type="text"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="Descreva o motivo da correção..."
                            className="text-xs rounded-lg border-gray-200 w-full text-gray-900 focus:ring-brand-500 focus:border-brand-500 py-1.5"
                        />
                    </div>
                </div>
            </td>
            <td className="px-4 py-3 text-right">
                <button 
                    onClick={handleUpdate}
                    disabled={isSaving || !reason || !isChanged}
                    className="p-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-30 transition-all shadow-md hover:shadow-lg active:scale-95 group"
                    title="Confirmar Ajuste"
                >
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} className="group-hover:scale-110 transition-transform" />}
                </button>
            </td>
        </tr>
    );
};

export default AttendanceReports;

