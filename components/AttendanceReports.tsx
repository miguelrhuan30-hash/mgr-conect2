import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, Timestamp, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, TimeEntry, UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, User, Search, AlertCircle, CheckCircle, Clock, AlertTriangle, ShieldAlert, X, Save, Loader2, Calculator, FileText, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const AttendanceReports: React.FC = () => {
  const { userProfile, currentUser } = useAuth();
  
  // Tabs
  const [activeTab, setActiveTab] = useState<'report' | 'monitoring'>('monitoring');

  // Report State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Monitoring State
  const [openShifts, setOpenShifts] = useState<{user: UserProfile, entry: TimeEntry}[]>([]);
  const [loadingMonitoring, setLoadingMonitoring] = useState(false);
  const [forceExitModalOpen, setForceExitModalOpen] = useState(false);
  const [selectedShiftToClose, setSelectedShiftToClose] = useState<{user: UserProfile, entry: TimeEntry} | null>(null);
  const [exitTime, setExitTime] = useState('');
  const [exitReason, setExitReason] = useState('');
  const [isSavingExit, setIsSavingExit] = useState(false);

  // Correct authorization check using specific permission
  const isAuthorized = 
    userProfile?.role === 'admin' || 
    userProfile?.role === 'developer' || 
    !!userProfile?.permissions?.canViewAttendanceReports;

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
      const entries = snap.docs.map(d => d.data() as TimeEntry);

      // Group by Day
      const daysInMonth = endDate.getDate();
      const dailyReport: any[] = [];
      const user = users.find(u => u.uid === selectedUser);

      for (let d = 1; d <= daysInMonth; d++) {
        const currentDateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayEntries = entries.filter(e => {
            const date = e.timestamp.toDate();
            return date.getDate() === d;
        });

        const row = {
          date: currentDateStr,
          hasEntries: dayEntries.length > 0,
          entry: dayEntries.find(e => e.type === 'entry'),
          lunchStart: dayEntries.find(e => e.type === 'lunch_start'),
          lunchEnd: dayEntries.find(e => e.type === 'lunch_end'),
          exit: dayEntries.find(e => e.type === 'exit'),
          userSchedule: user?.workSchedule
        };
        dailyReport.push(row);
      }
      setReportData(dailyReport);
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
        const open: {user: UserProfile, entry: TimeEntry}[] = [];

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

        // Group by User
        users.forEach(user => {
            const userEntries = allEntries.filter(e => e.userId === user.uid);
            if (userEntries.length > 0) {
                const lastEntry = userEntries[0]; // Most recent
                if (lastEntry.type === 'entry' || lastEntry.type === 'lunch_end') {
                    open.push({ user, entry: lastEntry });
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


  // --- HELPERS ---

  const getTimeString = (entry?: TimeEntry) => {
    if (!entry) return '-';
    return entry.timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  const isLate = (entry?: TimeEntry, targetTime?: string) => {
    if (!entry || !targetTime) return false;
    const entryDate = entry.timestamp.toDate();
    const [targetH, targetM] = targetTime.split(':').map(Number);
    const targetDate = new Date(entryDate);
    targetDate.setHours(targetH, targetM + 10, 0); 
    return entryDate > targetDate;
  };

  const getShiftDuration = (entry: TimeEntry) => {
      const start = entry.timestamp.toDate().getTime();
      const now = Date.now();
      const diffHrs = (now - start) / (1000 * 60 * 60);
      return diffHrs.toFixed(1);
  };

  const calcWorkedHours = (day: any) => {
    if (!day.entry || !day.exit) return null;
    
    const entryTime = day.entry.timestamp.toDate().getTime();
    const exitTime = day.exit.timestamp.toDate().getTime();
    
    let totalMs = exitTime - entryTime;
    
    // Desconta almoço se ambos registrados
    if (day.lunchStart && day.lunchEnd) {
      const lunchStartTime = day.lunchStart.timestamp.toDate().getTime();
      const lunchEndTime = day.lunchEnd.timestamp.toDate().getTime();
      totalMs -= (lunchEndTime - lunchStartTime);
    }
    
    const totalMinutes = Math.floor(totalMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return { 
      display: `${hours}h ${String(minutes).padStart(2,'0')}m`,
      totalMinutes,
      hours
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

        const date = new Date(day.date + 'T12:00:00');
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        if (!day.hasEntries && !isWeekend) {
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
    doc.text('MGR SERVIÇOS', 105, 18, { align: 'center' });
    
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.text('FOLHA DE PONTO', 105, 26, { align: 'center' });
    
    doc.setLineWidth(0.5);
    doc.line(14, 30, 196, 30);
    
    // === DADOS DO FUNCIONÁRIO ===
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
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
      const weekDay = dateObj.toLocaleString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase();
      const worked = calcWorkedHours(day);
      
      let ocorrencia = '';
      if (isWeekend) ocorrencia = 'Final de Semana';
      else if (!day.hasEntries) ocorrencia = 'FALTA';
      else if (day.exit?.forcedClose) ocorrencia = 'Saída Forçada';
      
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
    
    // === RODAPÉ DE TOTAIS ===
    const totalMinutes = reportData.reduce((acc, day) => {
      const w = calcWorkedHours(day);
      return acc + (w ? w.totalMinutes : 0);
    }, 0);
    const totalH = Math.floor(totalMinutes / 60);
    const totalM = totalMinutes % 60;
    const workedDays = reportData.filter(d => d.hasEntries).length;
    const faltaDays = reportData.filter(d => {
      const dateObj = new Date(d.date + 'T12:00:00');
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
      return !d.hasEntries && !isWeekend;
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
    
    // === RODAPÉ DE ASSINATURA ===
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
      ['ESPELHO DE PONTO - MGR SERVIÇOS'],
      [`Colaborador: ${userName}`],
      [`Período: ${selectedMonth}`],
      [`Gerado em: ${new Date().toLocaleString()}`],
      [],
      ['Data','Entrada','Almoço','Volta','Saída','Total Trabalhado','Obs']
    ];
    
    reportData.forEach(day => {
      const dateObj = new Date(day.date + 'T12:00:00');
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
      const worked = calcWorkedHours(day);
      
      wsData.push([
        dateObj.toLocaleDateString(),
        getTimeString(day.entry),
        getTimeString(day.lunchStart),
        getTimeString(day.lunchEnd),
        getTimeString(day.exit),
        worked ? worked.display : '--',
        !day.hasEntries && !isWeekend ? 'Falta' :
        day.exit?.forcedClose ? 'Saída Forçada' : ''
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
      <div className="flex border-b border-gray-200">
          <button 
             onClick={() => setActiveTab('monitoring')}
             className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'monitoring' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
             Monitoramento de Turnos
          </button>
          <button 
             onClick={() => setActiveTab('report')}
             className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'report' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
             Espelho de Ponto (Mensal)
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
                          const duration = parseFloat(getShiftDuration(shift.entry));
                          const isCritical = duration > 12;

                          return (
                              <div key={idx} className={`bg-white rounded-xl border p-5 shadow-sm relative overflow-hidden ${isCritical ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-200'}`}>
                                  {isCritical && <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] px-2 py-0.5 font-bold uppercase">Atenção</div>}
                                  
                                  <div className="flex items-center gap-3 mb-3">
                                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600">
                                          {shift.user.displayName.charAt(0)}
                                      </div>
                                      <div>
                                          <h3 className="font-bold text-gray-900">{shift.user.displayName}</h3>
                                          <p className="text-xs text-gray-500">{shift.user.role}</p>
                                      </div>
                                  </div>

                                  <div className="space-y-2 mb-4">
                                      <div className="flex justify-between text-sm">
                                          <span className="text-gray-500">Entrada:</span>
                                          <span className="font-mono font-medium">{shift.entry.timestamp.toDate().toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                          <span className="text-gray-500">Duração Atual:</span>
                                          <span className={`font-mono font-bold ${isCritical ? 'text-red-600' : 'text-green-600'}`}>
                                              {duration} horas
                                          </span>
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
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Entrada</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Almoço</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Volta</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Saída</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Obs.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {reportData.map((day, idx) => {
                                const dateObj = new Date(day.date + 'T12:00:00');
                                const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                                const isLateEntry = isLate(day.entry, day.userSchedule?.startTime);
                                const worked = calcWorkedHours(day);

                                let totalColor = "text-gray-400";
                                if (worked) {
                                  if (worked.hours < 6) totalColor = "text-red-600 font-bold";
                                  else if (worked.hours < 8) totalColor = "text-yellow-600 font-bold";
                                  else totalColor = "text-green-600 font-bold";
                                }

                                return (
                                    <tr key={idx} className={`${isWeekend ? 'bg-gray-50/50' : 'hover:bg-gray-50'}`}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {dateObj.toLocaleDateString()} <span className="text-gray-400 font-normal text-xs ml-1">({dateObj.toLocaleDateString(undefined, {weekday: 'short'})})</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {day.entry ? (
                                                <span className={`px-2 py-1 rounded text-sm font-bold ${isLateEntry ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                    {getTimeString(day.entry)}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-center text-sm text-gray-600">{getTimeString(day.lunchStart)}</td>
                                        <td className="px-6 py-4 text-center text-sm text-gray-600">{getTimeString(day.lunchEnd)}</td>
                                        <td className="px-6 py-4 text-center text-sm text-gray-600 font-bold flex flex-col items-center">
                                            {getTimeString(day.exit)}
                                            {day.exit?.forcedClose && <span className="text-[10px] text-red-500 font-normal">Forçado</span>}
                                        </td>
                                        <td className={`px-6 py-4 text-center text-sm ${totalColor}`}>
                                            {worked ? worked.display : '--'}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {!day.hasEntries && !isWeekend ? (
                                                <span className="text-red-400 text-xs flex items-center justify-center gap-1"><AlertCircle size={12}/> Falta</span>
                                            ) : day.hasEntries ? (
                                                <span className="text-green-500 text-xs flex items-center justify-center gap-1"><CheckCircle size={12}/> OK</span>
                                            ) : '-'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-gray-100 font-bold text-gray-900 border-t-2 border-gray-300">
                            <tr>
                                <td colSpan={5} className="px-6 py-4 text-right uppercase text-xs tracking-wider">Totais do Mês</td>
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

    </div>
  );
};

export default AttendanceReports;