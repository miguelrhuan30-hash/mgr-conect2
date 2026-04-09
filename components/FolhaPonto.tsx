import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection, query, where, getDocs, Timestamp, orderBy, limit, addDoc, serverTimestamp, deleteDoc, doc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import {
  CollectionName, TimeEntry, UserProfile,
  EmployeeOccurrence, EmployeeDocument, OccurrenceType,
  OCCURRENCE_LABELS, OCCURRENCE_COLORS
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import { calcularTurnos, Turno, toDateStr, minutesToHHMM } from '../utils/shift-calculator';
import {
  adicionarRegistro, editarHorarioRegistro, excluirRegistro, hardDeleteRegistro, TIPO_LABELS
} from '../utils/shift-editor';
import {
  Search, Loader2, Clock, AlertTriangle, CheckCircle,
  ChevronDown, ChevronUp, Plus, Trash2, Save, X,
  Filter, Calendar, User, History, AlertCircle, Edit2,
  Paperclip, Upload, FileText, Activity, Download, Info, ExternalLink
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

/** Retorna apenas HH:mm para input type="time" */
const toTimeInput = (entry: TimeEntry | null): string => {
  if (!entry) return '';
  const d = entry.timestamp.toDate();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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

  // ── Tab principal: Folha vs Logs ────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'folha' | 'logs'>('folha');

  // ── Ocorrências e Documentos por dia ────────────────────────────────────────
  const [ocorrenciasPorDia, setOcorrenciasPorDia] = useState<Map<string, EmployeeOccurrence[]>>(new Map());
  const [documentosPorDia, setDocumentosPorDia] = useState<Map<string, EmployeeDocument[]>>(new Map());

  // ── Formulário de ocorrência ────────────────────────────────────────────────
  const [showOcForm, setShowOcForm] = useState(false);
  const [ocTipo, setOcTipo] = useState<OccurrenceType>('falta_justificada');
  const [ocDescricao, setOcDescricao] = useState('');
  const [ocDiaCompleto, setOcDiaCompleto] = useState(true);
  const [ocHoraInicio, setOcHoraInicio] = useState('08:00');
  const [ocHoraFim, setOcHoraFim] = useState('12:00');
  const [ocDataFolga, setOcDataFolga] = useState('');  // data de folga compensatória (banco_troca)
  const [savingOc, setSavingOc] = useState(false);

  // ── Upload de documento ─────────────────────────────────────────────────────
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Logs de ponto ───────────────────────────────────────────────────────────
  const [pontoLogs, setPontoLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logExpandido, setLogExpandido] = useState<string | null>(null);

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
        where('timestamp', '<=', Timestamp.fromDate(new Date(dataFim + 'T23:59:59.999')))
      );
      const snap = await getDocs(q);
      const entries = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as TimeEntry))
        .filter(e => !e.excluido)
        .sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());
      setRawEntries(entries);

      // 1. Calcular turnos a partir dos registros existentes
      const turnosCalculados = calcularTurnos(entries);

      // 2. Deduplica por data — mantém o turno mais completo
      const turnosPorData = new Map<string, Turno>();
      for (const t of turnosCalculados) {
        const existing = turnosPorData.get(t.data);
        if (!existing) {
          turnosPorData.set(t.data, t);
        } else {
          // Manter o turno com mais registros preenchidos
          const countRegs = (turno: Turno) =>
            [turno.entry, turno.lunchStart, turno.lunchEnd, turno.exit].filter(Boolean).length;
          if (countRegs(t) > countRegs(existing)) {
            turnosPorData.set(t.data, t);
          }
        }
      }

      // 3. Gerar grade completa de datas do período
      const turnosCompletos: Turno[] = [];
      const dStart = new Date(dataInicio + 'T12:00:00');
      const dEnd = new Date(dataFim + 'T12:00:00');
      for (let d = new Date(dStart); d <= dEnd; d.setDate(d.getDate() + 1)) {
        const dateStr = toDateStr(d);
        const turnoExistente = turnosPorData.get(dateStr);
        if (turnoExistente) {
          turnosCompletos.push(turnoExistente);
        } else {
          // Dia sem nenhum registro — placeholder editável
          turnosCompletos.push({
            data: dateStr,
            entry: null,
            lunchStart: null,
            lunchEnd: null,
            exit: null,
            status: 'sem_saida',
            duracaoTotalMinutos: null,
            duracaoTrabalhoMinutos: null,
            intervaloAlmocoMinutos: null,
            inconsistente: false,
          });
        }
      }

      setTurnos(turnosCompletos);
      setTurnoEmEdicao(null);

      // 4. Carregar ocorrências e documentos do período em paralelo
      const [ocSnap, docSnap] = await Promise.all([
        getDocs(query(
          collection(db, CollectionName.EMPLOYEE_OCCURRENCES),
          where('userId', '==', uid),
          where('data', '>=', dataInicio),
          where('data', '<=', dataFim)
        )).catch((err) => { console.error('Erro ao carregar ocorrências:', err); return { docs: [] as any[] }; }),
        getDocs(query(
          collection(db, CollectionName.EMPLOYEE_DOCS),
          where('userId', '==', uid),
          where('dataReferencia', '>=', dataInicio),
          where('dataReferencia', '<=', dataFim)
        )).catch((err) => { console.error('Erro ao carregar documentos:', err); return { docs: [] as any[] }; }),
      ]);

      const ocMap = new Map<string, EmployeeOccurrence[]>();
      ocSnap.docs.forEach((d: any) => {
        const oc = { id: d.id, ...d.data() } as EmployeeOccurrence;
        const list = ocMap.get(oc.data) || [];
        list.push(oc);
        ocMap.set(oc.data, list);
      });
      setOcorrenciasPorDia(ocMap);

      const docMap = new Map<string, EmployeeDocument[]>();
      docSnap.docs.forEach((d: any) => {
        const doc_ = { id: d.id, ...d.data() } as EmployeeDocument;
        const ref_ = doc_.dataReferencia || '';
        const list = docMap.get(ref_) || [];
        list.push(doc_);
        docMap.set(ref_, list);
      });
      setDocumentosPorDia(docMap);
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
  /** Monta Date a partir da data do turno + hora HH:mm */
  const buildTimestamp = (dateStr: string, time: string): Date => {
    return new Date(`${dateStr}T${time}:00`);
  };

  const expandirTurno = (turno: Turno) => {
    if (turnoEmEdicao === turno.data) {
      setTurnoEmEdicao(null);
      return;
    }
    setTurnoEmEdicao(turno.data);

    // Encontrar a jornada do colaborador para pré-preencher horários padrão
    const uid = colaboradorId || currentUser?.uid;
    const user = uid ? users.find(u => u.uid === uid) : null;
    const schedule = user?.workSchedule;
    const defaultStart = schedule?.startTime || '08:00';
    const defaultEnd = schedule?.endTime || '17:00';
    // Calcular horários padrão de almoço (meio da jornada)
    const [sh, ] = defaultStart.split(':').map(Number);
    const defaultLunchStart = `${String(sh + 4).padStart(2, '0')}:00`;
    const defaultLunchEnd = `${String(sh + 5).padStart(2, '0')}:00`;

    // Armazenar apenas HH:mm — data é fixada pelo turno.data
    setEditTimes({
      entry: toTimeInput(turno.entry) || defaultStart,
      lunch_start: toTimeInput(turno.lunchStart) || defaultLunchStart,
      lunch_end: toTimeInput(turno.lunchEnd) || defaultLunchEnd,
      exit: toTimeInput(turno.exit) || defaultEnd,
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

      // Montar Date a partir da data do turno + hora informada
      const newTs = buildTimestamp(turno.data, novoTime);

      if (existing) {
        // Editar horário existente
        const oldTs = existing.timestamp.toDate();
        if (Math.abs(newTs.getTime() - oldTs.getTime()) > 60000) {
          await editarHorarioRegistro(existing.id, newTs, currentUser.uid, adminNome, editMotivo);
        }
      } else {
        // Adicionar registro faltante
        await adicionarRegistro(uid, tipo, newTs, currentUser.uid, adminNome, editMotivo);
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
        buildTimestamp(turno.data, addSlotTime),
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

  // ── Hard delete emergencial (admin only) ────────────────────────────────────
  const handleHardDelete = async (entry: TimeEntry) => {
    if (!isAdmin) return;
    if (!currentUser) return;
    if (!confirm(
      `⚠️ HARD DELETE — AÇÃO IRREVERSÍVEL\n\n` +
      `Isso removerá FISICAMENTE o registro de ${TIPO_LABELS[entry.type]} ` +
      `(${entry.timestamp.toDate().toLocaleString('pt-BR')}) do banco de dados.\n\n` +
      `Use apenas em emergência (ex: ponto travado por data futura).\n\n` +
      `Continuar?`
    )) return;
    const adminNome = userProfile?.displayName || currentUser.email || currentUser.uid;
    try {
      await hardDeleteRegistro(entry.id, currentUser.uid, adminNome);
      await buscarRegistros();
      alert('✅ Registro removido fisicamente. Verifique se o ponto do colaborador foi desbloqueado.');
    } catch (err: any) {
      alert(err?.message || 'Erro ao realizar hard delete.');
    }
  };


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

  // ── Salvar ocorrência (ausência, atestado, etc.) ────────────────────────────
  const salvarOcorrencia = async (dia: string) => {
    const uid = colaboradorId || currentUser?.uid;
    if (!uid || !currentUser) return;
    if (!ocDescricao.trim() && ocTipo !== 'falta_injustificada' && ocTipo !== 'folga') {
      alert('Informe uma descrição para a ocorrência.');
      return;
    }
    setSavingOc(true);
    try {
      let minutosAbonados: number | undefined;
      if (ocTipo === 'atestado') {
        if (ocDiaCompleto) {
          const user = users.find(u => u.uid === uid);
          const schedule = user?.workSchedule;
          if (schedule?.dailyWorkMinutes && schedule.dailyWorkMinutes > 0) {
            minutosAbonados = schedule.dailyWorkMinutes;
          } else if (schedule?.startTime && schedule?.endTime) {
            const [sh, sm] = schedule.startTime.split(':').map(Number);
            const [eh, em] = schedule.endTime.split(':').map(Number);
            minutosAbonados = ((eh * 60) + em) - ((sh * 60) + sm) - (schedule.lunchDuration || 60);
          } else {
            minutosAbonados = 480;
          }
        } else {
          const [shi, smi] = ocHoraInicio.split(':').map(Number);
          const [ehi, emi] = ocHoraFim.split(':').map(Number);
          minutosAbonados = ((ehi * 60) + emi) - ((shi * 60) + smi);
          if (minutosAbonados <= 0) { alert('O período do atestado é inválido.'); setSavingOc(false); return; }
        }
      }
      await addDoc(collection(db, CollectionName.EMPLOYEE_OCCURRENCES), {
        userId: uid,
        data: dia,
        tipo: ocTipo,
        descricao: ocDescricao,
        diaCompleto: ocDiaCompleto,
        ...(ocTipo === 'atestado' && !ocDiaCompleto ? { horaInicio: ocHoraInicio, horaFim: ocHoraFim } : {}),
        ...(minutosAbonados ? { minutosAbonados } : {}),
        ...(ocTipo === 'banco_troca' && ocDataFolga ? { dataFolgaCompensacao: ocDataFolga } : {}),
        criadoPor: currentUser.uid,
        criadoEm: serverTimestamp(),
      });

      // Se for banco_troca, criar ocorrência de folga compensatória na data indicada
      if (ocTipo === 'banco_troca' && ocDataFolga) {
        await addDoc(collection(db, CollectionName.EMPLOYEE_OCCURRENCES), {
          userId: uid,
          data: ocDataFolga,
          tipo: 'folga' as OccurrenceType,
          descricao: `Folga compensatória (Banco de Troca ref. ${dia})`,
          diaCompleto: true,
          criadoPor: currentUser.uid,
          criadoEm: serverTimestamp(),
        });
      }

      setShowOcForm(false);
      setOcDescricao('');
      setOcDataFolga('');
      await buscarRegistros();
      alert('Ocorrência registrada com sucesso.');
    } catch (err: any) {
      alert(err?.message || 'Erro ao registrar ocorrência.');
    } finally {
      setSavingOc(false);
    }
  };

  // ── Excluir ocorrência ────────────────────────────────────────────────────────
  const excluirOcorrencia = async (ocId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta ocorrência?')) return;
    try {
      await deleteDoc(doc(db, CollectionName.EMPLOYEE_OCCURRENCES, ocId));
      await buscarRegistros();
    } catch (err: any) {
      alert(err?.message || 'Erro ao excluir ocorrência.');
    }
  };

  // ── Upload de documento para o dia ──────────────────────────────────────────
  const handleUploadDocumento = async (dia: string, file: File) => {
    const uid = colaboradorId || currentUser?.uid;
    if (!uid || !currentUser) return;
    if (file.size > 10 * 1024 * 1024) { alert('Arquivo muito grande (máx 10MB).'); return; }
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) { alert('Tipo de arquivo não aceito. Use PDF, JPG ou PNG.'); return; }
    setUploading(true);
    try {
      const storageRef = ref(storage, `employee_docs/${uid}/${dia}/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await addDoc(collection(db, CollectionName.EMPLOYEE_DOCS), {
        userId: uid,
        nome: file.name,
        tipo: file.type.includes('pdf') ? 'documento' : 'atestado',
        pasta: 'Folha de Ponto',
        url,
        tamanhoBytes: file.size,
        uploadPor: currentUser.uid,
        uploadEm: serverTimestamp(),
        dataReferencia: dia,
      });
      await buscarRegistros();
      alert('Documento anexado com sucesso.');
    } catch (err: any) {
      alert(err?.message || 'Erro ao fazer upload.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Batch save: salva todos os 4 horários de uma vez ────────────────────────
  const salvarEdicaoLote = async (turno: Turno) => {
    const uid = colaboradorId || currentUser?.uid;
    if (!uid || !currentUser || !editMotivo.trim()) {
      alert('Informe o motivo da correção antes de salvar.');
      return;
    }
    const adminNome = userProfile?.displayName || currentUser.email || currentUser.uid;
    setSaving(true);
    try {
      const slots: { type: 'entry' | 'lunch_start' | 'lunch_end' | 'exit'; existing: TimeEntry | null; newTime: string }[] = [
        { type: 'entry', existing: turno.entry, newTime: editTimes['entry'] || '' },
        { type: 'lunch_start', existing: turno.lunchStart, newTime: editTimes['lunch_start'] || '' },
        { type: 'lunch_end', existing: turno.lunchEnd, newTime: editTimes['lunch_end'] || '' },
        { type: 'exit', existing: turno.exit, newTime: editTimes['exit'] || '' },
      ];
      for (const s of slots) {
        if (!s.newTime) continue;
        // Montar Date: data fixa do turno + hora informada
        const newTs = buildTimestamp(turno.data, s.newTime);
        if (s.existing) {
          const oldTs = s.existing.timestamp.toDate();
          if (Math.abs(newTs.getTime() - oldTs.getTime()) > 60000) {
            await editarHorarioRegistro(s.existing.id, newTs, currentUser.uid, adminNome, editMotivo);
          }
        } else {
          await adicionarRegistro(uid, s.type, newTs, currentUser.uid, adminNome, editMotivo);
        }
      }
      await buscarRegistros();
    } catch (err: any) {
      alert(err?.message || 'Erro ao salvar edição em lote.');
    } finally {
      setSaving(false);
    }
  };

  // ── Buscar logs de ponto ────────────────────────────────────────────────────
  const buscarLogs = async () => {
    const uid = colaboradorId || currentUser?.uid;
    if (!uid) return;
    setLoadingLogs(true);
    try {
      const startTs = Timestamp.fromDate(new Date(dataInicio + 'T00:00:00'));
      const endTs = Timestamp.fromDate(new Date(dataFim + 'T23:59:59'));
      const q = query(
        collection(db, CollectionName.SYSTEM_LOGS),
        where('timestamp', '>=', startTs),
        where('timestamp', '<=', endTs),
        orderBy('timestamp', 'desc'),
        limit(200)
      );
      const snap = await getDocs(q);
      const allLogs = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter((log: any) => {
          if (log.userId !== uid) return false;
          const action = log.action || '';
          return action.startsWith('ponto_');
        });
      setPontoLogs(allLogs);
    } catch (err) {
      console.error('Erro ao buscar logs:', err);
    } finally {
      setLoadingLogs(false);
    }
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

      {/* ── TABS: Folha vs Logs ── */}
      {isGestor && (
        <div className="flex p-1 bg-gray-200 rounded-lg">
          {([
            { key: 'folha' as const, label: 'Folha de Ponto', icon: Calendar },
            { key: 'logs' as const, label: 'Logs de Ponto', icon: Activity },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); if (tab.key === 'logs') buscarLogs(); }}
              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all flex items-center justify-center gap-2 ${
                activeTab === tab.key ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── FILTROS ── */}
      {activeTab === 'folha' && (
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
      )}

      {/* ── LISTA DE TURNOS ── */}
      {activeTab === 'folha' && (loading || turnosFiltrados.length > 0 || (turnos.length === 0 && rawEntries.length >= 0)) && (<>
      {/* Lista de turnos */}
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

                  {/* Badge de status + ocorrência + documento */}
                  <div className="w-44 flex-shrink-0 flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-extrabold px-2 py-1 rounded-full border whitespace-nowrap flex items-center gap-1 ${cfg.color}`}>
                      <StatusIcon size={10} />
                      {cfg.label}
                    </span>
                    {hasEdited && (
                      <span className="text-[9px] font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full border border-yellow-200">✏</span>
                    )}
                    {ocorrenciasPorDia.get(turno.data)?.map(oc => (
                      <span key={oc.id} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${OCCURRENCE_COLORS[oc.tipo]}`}>
                        {OCCURRENCE_LABELS[oc.tipo]}
                      </span>
                    ))}
                    {(documentosPorDia.get(turno.data)?.length || 0) > 0 && (
                      <span className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full border border-blue-200 flex items-center gap-0.5">
                        <Paperclip size={8} /> {documentosPorDia.get(turno.data)!.length}
                      </span>
                    )}
                  </div>

                  {/* Expand icon */}
                  {isGestor && (
                    <div className="w-8 flex-shrink-0 flex justify-center">
                      {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                    </div>
                  )}
                </div>

                {/* ── Sub-linhas de ocorrências (visíveis sem expandir) ── */}
                {(ocorrenciasPorDia.get(turno.data) || []).map(oc => (
                  <div key={oc.id} className={`flex items-center gap-3 px-5 py-2 border-t border-dashed border-gray-100 ${OCCURRENCE_COLORS[oc.tipo]} bg-opacity-30`}>
                    <div className="w-20 flex-shrink-0" />
                    <div className="flex-1 flex items-center gap-3 min-w-0">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border whitespace-nowrap ${OCCURRENCE_COLORS[oc.tipo]}`}>
                        {OCCURRENCE_LABELS[oc.tipo]}
                      </span>
                      {oc.descricao && (
                        <span className="text-xs text-gray-600 truncate">{oc.descricao}</span>
                      )}
                      {oc.horaInicio && oc.horaFim && (
                        <span className="text-[10px] text-gray-500 font-mono">{oc.horaInicio} - {oc.horaFim}</span>
                      )}
                      {oc.diaCompleto && <span className="text-[10px] text-gray-400">Dia completo</span>}
                      {oc.dataFolgaCompensacao && (
                        <span className="text-[10px] text-teal-600 font-bold">→ Folga em {oc.dataFolgaCompensacao.split('-').reverse().join('/')}</span>
                      )}
                      {oc.minutosAbonados && oc.minutosAbonados > 0 && (
                        <span className="text-[10px] text-gray-500">{minutesToHHMM(oc.minutosAbonados)} abonadas</span>
                      )}
                    </div>
                    {isGestor && (
                      <button
                        onClick={(e) => { e.stopPropagation(); excluirOcorrencia(oc.id); }}
                        className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
                        title="Excluir ocorrência"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}

                {/* ── PAINEL DE EDIÇÃO INLINE ── */}
                {isExpanded && isGestor && (
                  <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4 space-y-4">
                    {/* Banner: data travada */}
                    <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                      <Calendar size={14} className="text-blue-600 flex-shrink-0" />
                      <span className="text-xs font-bold text-blue-700">
                        📅 Editando registros do dia{' '}
                        <span className="font-black">
                          {new Date(turno.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                      </span>
                      <span className="ml-auto text-[10px] text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded font-bold">DATA TRAVADA</span>
                    </div>

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
                                  type="time"
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
                                  <>
                                    <button
                                      onClick={() => handleExcluir(reg)}
                                      className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                                      title="Soft delete — inativa o registro (recuperável)"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleHardDelete(reg)}
                                      className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                      title="⚠️ Hard delete emergencial — remove fisicamente (irreversível)"
                                    >
                                      <X size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <input
                                  type="time"
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

                    {/* Botão Salvar Todos */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => salvarEdicaoLote(turno)}
                        disabled={saving || !editMotivo.trim()}
                        className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg font-bold text-sm hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                      >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Salvar Todos os Horários
                      </button>
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

                    {/* ── Seção de Ocorrências ── */}
                    <div className="border-t border-gray-100 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-600 uppercase flex items-center gap-1"><AlertCircle size={12} /> Ocorrências do Dia</span>
                        <button onClick={() => { setShowOcForm(!showOcForm); setOcDescricao(''); setOcTipo('falta_justificada'); setOcDiaCompleto(true); }} className="text-xs text-brand-600 font-bold hover:underline flex items-center gap-1"><Plus size={12} /> Registrar</button>
                      </div>
                      {/* Ocorrências existentes */}
                      {(ocorrenciasPorDia.get(turno.data) || []).map(oc => (
                        <div key={oc.id} className={`mb-2 p-2 rounded-lg border text-xs ${OCCURRENCE_COLORS[oc.tipo]}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-bold">{OCCURRENCE_LABELS[oc.tipo]}</span>
                            {oc.horaInicio && oc.horaFim && <span>{oc.horaInicio} - {oc.horaFim}</span>}
                            {oc.diaCompleto && <span>Dia completo</span>}
                          </div>
                          {oc.descricao && <p className="mt-1 text-gray-600">{oc.descricao}</p>}
                          {oc.minutosAbonados && <p className="mt-0.5 text-gray-500">{minutesToHHMM(oc.minutosAbonados)} abonadas</p>}
                        </div>
                      ))}
                      {/* Formulário de nova ocorrência */}
                      {showOcForm && turnoEmEdicao === turno.data && (
                        <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-3 mt-2">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-gray-600 mb-1">Tipo</label>
                              <select value={ocTipo} onChange={e => { setOcTipo(e.target.value as OccurrenceType); setOcDataFolga(''); }} className="w-full rounded-lg border-gray-300 text-sm bg-white text-gray-900">
                                {(Object.entries(OCCURRENCE_LABELS) as [OccurrenceType, string][]).map(([k, v]) => (
                                  <option key={k} value={k}>{v}</option>
                                ))}
                              </select>
                            </div>
                            {ocTipo === 'atestado' && (
                              <div className="flex items-center gap-2">
                                <label className="flex items-center gap-1 text-xs">
                                  <input type="checkbox" checked={ocDiaCompleto} onChange={e => setOcDiaCompleto(e.target.checked)} className="rounded" /> Dia completo
                                </label>
                              </div>
                            )}
                          </div>
                          {ocTipo === 'atestado' && !ocDiaCompleto && (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Hora Início</label>
                                <input type="time" value={ocHoraInicio} onChange={e => setOcHoraInicio(e.target.value)} className="w-full rounded-lg border-gray-300 text-sm bg-white text-gray-900" />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Hora Fim</label>
                                <input type="time" value={ocHoraFim} onChange={e => setOcHoraFim(e.target.value)} className="w-full rounded-lg border-gray-300 text-sm bg-white text-gray-900" />
                              </div>
                            </div>
                          )}
                          {/* Campo especial: Banco de Troca → data de folga compensatória */}
                          {ocTipo === 'banco_troca' && (
                            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                              <label className="block text-xs font-bold text-teal-700 mb-1">📅 Data da Folga Compensatória</label>
                              <p className="text-[10px] text-teal-600 mb-2">Selecione o dia que será usado como folga para compensar o excesso de horas deste dia. O dia selecionado será marcado automaticamente como folga.</p>
                              <input
                                type="date"
                                value={ocDataFolga}
                                onChange={e => setOcDataFolga(e.target.value)}
                                className="w-full rounded-lg border-teal-300 text-sm bg-white text-gray-900"
                              />
                            </div>
                          )}
                          <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Descrição</label>
                            <input type="text" value={ocDescricao} onChange={e => setOcDescricao(e.target.value)} placeholder="Descrição da ocorrência..." className="w-full rounded-lg border-gray-300 text-sm bg-white text-gray-900" />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => salvarOcorrencia(turno.data)} disabled={savingOc || (ocTipo === 'banco_troca' && !ocDataFolga)} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1">
                              {savingOc ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Salvar Ocorrência
                            </button>
                            <button onClick={() => setShowOcForm(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-300">Cancelar</button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Seção de Documentos ── */}
                    <div className="border-t border-gray-100 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-600 uppercase flex items-center gap-1"><FileText size={12} /> Documentos Anexados</span>
                        <label className={`text-xs text-brand-600 font-bold hover:underline flex items-center gap-1 cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} Anexar
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadDocumento(turno.data, f); }}
                          />
                        </label>
                      </div>
                      {(documentosPorDia.get(turno.data) || []).length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Nenhum documento anexado a este dia.</p>
                      ) : (
                        <div className="space-y-1">
                          {(documentosPorDia.get(turno.data) || []).map(doc_ => (
                            <div key={doc_.id} className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-3 py-2">
                              <div className="flex items-center gap-2 text-xs">
                                <Paperclip size={12} className="text-gray-400" />
                                <span className="font-medium text-gray-700 truncate max-w-[200px]">{doc_.nome}</span>
                                <span className="text-gray-400">({(doc_.tamanhoBytes / 1024).toFixed(0)} KB)</span>
                              </div>
                              <a href={doc_.url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 font-bold hover:underline flex items-center gap-1">
                                <ExternalLink size={12} /> Ver
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

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

      </>)}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB: LOGS DE PONTO ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Filtros de logs */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={18} className="text-brand-600" />
              <h3 className="font-bold text-gray-900">Logs de Ponto</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Colaborador</label>
                {isGestor ? (
                  <select value={colaboradorId} onChange={e => setColaboradorId(e.target.value)} className="w-full rounded-lg border-gray-300 bg-white text-gray-900 text-sm">
                    <option value="">Selecionar...</option>
                    {users.map(u => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
                  </select>
                ) : (
                  <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-700">{userProfile?.displayName || 'Eu'}</div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Data Início</label>
                <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-full rounded-lg border-gray-300 bg-white text-gray-900 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Data Fim</label>
                <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-full rounded-lg border-gray-300 bg-white text-gray-900 text-sm" />
              </div>
              <div className="flex items-end">
                <button onClick={buscarLogs} disabled={loadingLogs || (!colaboradorId && isGestor)} className="w-full px-4 py-2 bg-brand-600 text-white rounded-lg font-bold text-sm hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loadingLogs ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  Buscar Logs
                </button>
              </div>
            </div>
          </div>

          {/* Lista de logs */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {loadingLogs ? (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin text-brand-600" size={32} /></div>
            ) : pontoLogs.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {pontoLogs.map((log: any) => {
                  const isOpen = logExpandido === log.id;
                  const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;
                  const levelColors: Record<string, string> = {
                    info: 'bg-blue-50 text-blue-600 border-blue-200',
                    success: 'bg-green-50 text-green-600 border-green-200',
                    warning: 'bg-yellow-50 text-yellow-600 border-yellow-200',
                    error: 'bg-red-50 text-red-600 border-red-200',
                  };
                  const lc = levelColors[log.level] || levelColors.info;
                  return (
                    <div key={log.id} className="hover:bg-gray-50/70 transition-colors">
                      <div className={`px-4 py-3 flex items-start gap-3 ${hasMetadata ? 'cursor-pointer' : ''}`} onClick={() => hasMetadata && setLogExpandido(isOpen ? null : log.id)}>
                        <div className={`mt-0.5 flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${lc}`}>
                          {log.level || 'info'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 leading-snug">{log.message}</p>
                          <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200 mt-1 inline-block">{log.action}</span>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <div className="text-xs text-gray-400 font-mono">
                            {log.timestamp?.toDate?.()?.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) ?? '—'}
                          </div>
                          {hasMetadata && <span className="text-[10px] text-brand-500 flex items-center gap-0.5 justify-end mt-1">{isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />} detalhes</span>}
                        </div>
                      </div>
                      {isOpen && hasMetadata && (
                        <div className="px-4 pb-3 ml-10">
                          <pre className="text-[11px] bg-gray-900 text-green-400 rounded-lg p-3 overflow-x-auto font-mono leading-relaxed">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 text-gray-400">
                <Activity className="mx-auto w-12 h-12 mb-3 opacity-30" />
                <p className="font-medium">Nenhum log de ponto encontrado.</p>
                <p className="text-xs mt-1">Selecione um colaborador e período, depois clique "Buscar Logs".</p>
              </div>
            )}
            {!loadingLogs && pontoLogs.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500">
                Exibindo <strong>{pontoLogs.length}</strong> registros de ações de ponto
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FolhaPonto;
