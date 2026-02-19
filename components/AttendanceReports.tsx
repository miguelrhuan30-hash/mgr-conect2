import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, TimeEntry, UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, User, Search, AlertCircle, CheckCircle, Clock, AlertTriangle, ShieldAlert, X, Save, Loader2 } from 'lucide-react';

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
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Obs.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {reportData.map((day, idx) => {
                                const dateObj = new Date(day.date + 'T12:00:00');
                                const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                                const isLateEntry = isLate(day.entry, day.userSchedule?.startTime);

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