import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, TimeEntry, UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, User, Search, AlertCircle, CheckCircle, Image as ImageIcon } from 'lucide-react';

const AttendanceReports: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load Users
    const fetchUsers = async () => {
      const snap = await getDocs(collection(db, CollectionName.USERS));
      setUsers(snap.docs.map(d => ({uid: d.id, ...d.data()} as UserProfile)));
    };
    fetchUsers();
  }, []);

  const generateReport = async () => {
    if (!selectedUser) return;
    setLoading(true);

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

       // Structure the day data
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
    setLoading(false);
  };

  const getTimeString = (entry?: TimeEntry) => {
    if (!entry) return '-';
    return entry.timestamp.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  const isLate = (entry?: TimeEntry, targetTime?: string) => {
    if (!entry || !targetTime) return false;
    const entryDate = entry.timestamp.toDate();
    const [targetH, targetM] = targetTime.split(':').map(Number);
    
    // Create comparable date
    const targetDate = new Date(entryDate);
    targetDate.setHours(targetH, targetM + 10, 0); // 10 min tolerance

    return entryDate > targetDate;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-900">Espelho de Ponto</h1>
           <p className="text-gray-500">Relatório mensal de frequência e pontualidade.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-end">
         <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Colaborador</label>
            <div className="relative">
               <User className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
               <select 
                  value={selectedUser} 
                  onChange={e => setSelectedUser(e.target.value)}
                  className="w-full pl-9 rounded-lg border-gray-300"
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
              className="w-full rounded-lg border-gray-300" 
            />
         </div>

         <button 
           onClick={generateReport}
           disabled={!selectedUser || loading}
           className="w-full md:w-auto px-6 py-2.5 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-70 flex items-center justify-center gap-2"
         >
            {loading ? 'Carregando...' : <><Search size={18}/> Gerar</>}
         </button>
      </div>

      {/* Grid */}
      {reportData.length > 0 && (
         <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
               <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                     <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Entrada</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Saída Almoço</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Volta Almoço</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Saída</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
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
                              
                              {/* Entry Cell */}
                              <td className="px-6 py-4 text-center">
                                 {day.entry ? (
                                    <div className="group relative inline-block">
                                       <span className={`px-2 py-1 rounded text-sm font-bold ${isLateEntry ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                          {getTimeString(day.entry)}
                                       </span>
                                       {/* Tooltip Selfie */}
                                       <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 w-32 bg-white p-1 rounded shadow-lg border border-gray-200">
                                          <img src={day.entry.photoEvidenceUrl} alt="Selfie" className="w-full rounded" />
                                       </div>
                                    </div>
                                 ) : '-'}
                              </td>

                              <td className="px-6 py-4 text-center text-sm text-gray-600">{getTimeString(day.lunchStart)}</td>
                              <td className="px-6 py-4 text-center text-sm text-gray-600">{getTimeString(day.lunchEnd)}</td>
                              <td className="px-6 py-4 text-center text-sm text-gray-600 font-bold">{getTimeString(day.exit)}</td>
                              
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
         </div>
      )}
    </div>
  );
};

export default AttendanceReports;