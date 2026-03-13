import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, UserProfile, Task, TimeEntry } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Trophy, Zap, Shield, Loader2, Medal, User, Clock } from 'lucide-react';

interface TechStats {
  uid: string;
  name: string;
  tasksCompleted: number;
  avgTaskDurationMs: number;
  delays: number;
  daysWorked: number;
  score: number;
}

const TechnicianStats: React.FC = () => {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TechStats[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  useEffect(() => {
    loadStats();
  }, [currentMonth]);

  const loadStats = async () => {
    setLoading(true);
    try {
      // 1. Definições de Data
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);
      const startMs = startOfMonth.getTime();
      const endMs = endOfMonth.getTime();

      // 2. Fetch Users
      const usersSnap = await getDocs(collection(db, CollectionName.USERS));
      const users: UserProfile[] = usersSnap.docs.map(d => ({ uid: d.id, ...(d.data() as any) } as UserProfile));

      // 3. Fetch Tasks do mês (Completed)
      const tasksQuery = query(
        collection(db, CollectionName.TASKS),
        where('status', '==', 'completed')
      );
      const tasksSnap = await getDocs(tasksQuery);
      const tasks = tasksSnap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) } as Task))
        .filter(t => {
           if (!t.endDate) return false;
           const time = t.endDate.toDate().getTime();
           return time >= startMs && time <= endMs;
        });

      // 4. Fetch Time Entries do mês (para calcular assiduidade/atrasos)
      const timeQuery = query(
        collection(db, CollectionName.TIME_ENTRIES),
        where('timestamp', '>=', Timestamp.fromDate(startOfMonth)),
        where('timestamp', '<=', Timestamp.fromDate(endOfMonth))
      );
      const timeSnap = await getDocs(timeQuery);
      const timeEntries = timeSnap.docs.map(d => d.data() as TimeEntry);

      // 5. Agregação por Usuário
      const statsMap: Record<string, TechStats> = {};

      users.forEach(u => {
        // Apenas técnicos / equipe operacional
        if (u.role === 'admin' || u.role === 'manager') return;
        
        statsMap[u.uid] = {
          uid: u.uid,
          name: u.displayName,
          tasksCompleted: 0,
          avgTaskDurationMs: 0,
          delays: 0,
          daysWorked: 0,
          score: 0
        };
      });

      // Process Tasks
      tasks.forEach(t => {
         // O.S. pode ter assignedUsers (array) ou assignedTo (string legacy)
         const assignees = t.assignedUsers || (t.assignedTo ? [t.assignedTo] : []);
         
         assignees.forEach(uid => {
            if (statsMap[uid]) {
               statsMap[uid].tasksCompleted += 1;
               
               // Tempo de conclusão = endDate - createdAt
               if (t.endDate && t.createdAt) {
                  const duration = t.endDate.toDate().getTime() - t.createdAt.toDate().getTime();
                  statsMap[uid].avgTaskDurationMs += duration; // Acumulando para depois dividir
               }
            }
         });
      });

      // Process Time Entries (Contagem básica de dias trabalhados e atrasos simplificados)
      // Aqui consideramos atrasados se ele tem isOnTime = false. 
      // Como o Ponto.tsx antigo não salva isOnTime, fazemos uma verificação baseada no horário do entry
      timeEntries.forEach(te => {
         if (te.type === 'entry' && statsMap[te.userId]) {
            statsMap[te.userId].daysWorked += 1;
            
            // Lógica simplificada de atraso (verifica se startTime existe no profile)
            const u = users.find(user => user.uid === te.userId);
            if (u && u.workSchedule) {
               const dayOfWeek = te.timestamp.toDate().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
               const schedule = (u.workSchedule as any)[dayOfWeek] || { active: false };
               
               if (schedule.active && schedule.startTime) {
                  const [h, m] = schedule.startTime.split(':').map(Number);
                  const entryTime = te.timestamp.toDate();
                  const expectedTime = new Date(entryTime);
                  expectedTime.setHours(h, m, 0, 0);
                  
                  // Tolerância de 10 minutos
                  if (entryTime.getTime() > expectedTime.getTime() + (10 * 60000)) {
                     statsMap[te.userId].delays += 1;
                  }
               }
            }
         }
      });

      // 6. Fechamento de Médias e Score
      let finalStats = Object.values(statsMap).filter(s => s.tasksCompleted > 0 || s.daysWorked > 0);
      
      finalStats.forEach(s => {
         if (s.tasksCompleted > 0) {
            s.avgTaskDurationMs = s.avgTaskDurationMs / s.tasksCompleted;
         }
         // Fórmula de Score (Exemplo: 10 pts por OS, -5 pts por atraso)
         s.score = (s.tasksCompleted * 10) - (s.delays * 5);
      });

      // Ordenar por score
      finalStats.sort((a, b) => b.score - a.score);
      setStats(finalStats);

    } catch (err) {
      console.error("Erro ao carregar estatísticas", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
       <div className="flex items-center justify-center p-12">
          <Loader2 className="animate-spin text-brand-600 w-10 h-10" />
       </div>
    );
  }

  // Descobrindo os ganhadores das Badges
  const topTasker = stats.length > 0 ? stats.reduce((prev, current) => (prev.tasksCompleted > current.tasksCompleted) ? prev : current) : null;
  const fastest = stats.filter(s => s.tasksCompleted > 1).length > 0 
      ? stats.filter(s => s.tasksCompleted > 1).reduce((prev, current) => (prev.avgTaskDurationMs < current.avgTaskDurationMs) ? prev : current) 
      : null;
  const sentinels = stats.filter(s => s.delays === 0 && s.daysWorked >= 5);

  const formatDuration = (ms: number) => {
      if (ms === 0) return '--';
      const hours = Math.floor(ms / (1000 * 60 * 60));
      return `${hours}h`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Medal className="text-brand-600" /> Ranking da Equipe
           </h1>
           <p className="text-gray-500">Acompanhe o desempenho, ordens de serviço e pontualidade no mês.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Card: Top 1 do Mês */}
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-5 shadow-sm relative overflow-hidden">
             <div className="absolute top-2 right-2 text-yellow-500 opacity-20"><Trophy size={60} /></div>
             <div className="flex items-center gap-2 mb-2">
                <Trophy className="text-yellow-600 w-5 h-5" />
                <h3 className="font-bold text-yellow-900 text-sm uppercase tracking-wider">Top 1 do Mês</h3>
             </div>
             {topTasker && topTasker.tasksCompleted > 0 ? (
                 <>
                    <p className="text-2xl font-black text-yellow-800">{topTasker.name}</p>
                    <p className="text-sm text-yellow-700 font-medium">{topTasker.tasksCompleted} O.S. Concluídas</p>
                 </>
             ) : (
                 <p className="text-sm text-gray-500 italic">Ninguém pontuou ainda.</p>
             )}
          </div>

          {/* Card: Relâmpago */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 shadow-sm relative overflow-hidden">
             <div className="absolute top-2 right-2 text-blue-500 opacity-20"><Zap size={60} /></div>
             <div className="flex items-center gap-2 mb-2">
                <Zap className="text-blue-600 w-5 h-5" />
                <h3 className="font-bold text-blue-900 text-sm uppercase tracking-wider">Relâmpago</h3>
             </div>
             {fastest ? (
                 <>
                    <p className="text-2xl font-black text-blue-800">{fastest.name}</p>
                    <p className="text-sm text-blue-700 font-medium">Média: {formatDuration(fastest.avgTaskDurationMs)} por O.S.</p>
                 </>
             ) : (
                 <p className="text-sm text-gray-500 italic">Dados insuficientes.</p>
             )}
          </div>

          {/* Card: Sentinela */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5 shadow-sm relative overflow-hidden">
             <div className="absolute top-2 right-2 text-green-500 opacity-20"><Shield size={60} /></div>
             <div className="flex items-center gap-2 mb-2">
                <Shield className="text-green-600 w-5 h-5" />
                <h3 className="font-bold text-green-900 text-sm uppercase tracking-wider">Sentinela (Zero Atrasos)</h3>
             </div>
             {sentinels.length > 0 ? (
                 <div className="flex flex-wrap gap-1">
                    {sentinels.map(s => (
                       <span key={s.uid} className="bg-white/60 border border-green-200 text-green-800 text-xs px-2 py-1 rounded font-bold">
                          {s.name}
                       </span>
                    ))}
                 </div>
             ) : (
                 <p className="text-sm text-gray-500 italic">Nenhum sentinela este mês.</p>
             )}
          </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
             <h3 className="font-bold text-gray-700 inline-flex items-center gap-2">
               Leaderboard <span className="text-xs bg-gray-200 text-gray-600 px-2 rounded-full py-0.5">{currentMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric'})}</span>
             </h3>
          </div>
          <div className="overflow-x-auto">
             <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                   <tr>
                      <th className="px-6 py-3 text-left font-medium">Classificação</th>
                      <th className="px-6 py-3 text-left font-medium">Colaborador</th>
                      <th className="px-6 py-3 text-center font-medium">Pontuação</th>
                      <th className="px-6 py-3 text-center font-medium">O.S. Entregues</th>
                      <th className="px-6 py-3 text-center font-medium">Atrasos de Ponto</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                   {stats.map((s, index) => {
                      const isTop = topTasker?.uid === s.uid;
                      const isFast = fastest?.uid === s.uid;
                      const isSentinel = sentinels.some(sen => sen.uid === s.uid);

                      return (
                         <tr key={s.uid} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                               <div className="flex justify-center items-center w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-bold">
                                  #{index + 1}
                               </div>
                            </td>
                            <td className="px-6 py-4">
                               <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
                                     {s.name.charAt(0)}
                                  </div>
                                  <div>
                                     <p className="font-bold text-gray-900">{s.name}</p>
                                     <div className="flex gap-1 mt-1">
                                        {isTop && <span title="Top 1 O.S."><Trophy size={14} className="text-yellow-500" /></span>}
                                        {isFast && <span title="Relâmpago"><Zap size={14} className="text-blue-500" /></span>}
                                        {isSentinel && <span title="Sentinela"><Shield size={14} className="text-green-500" /></span>}
                                     </div>
                                  </div>
                               </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                               <span className="text-lg font-black text-brand-700">{s.score} pt</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                               <span className="text-gray-900 font-medium">{s.tasksCompleted}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                               {s.delays === 0 ? (
                                  <span className="text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded text-sm">Nenhum</span>
                               ) : (
                                  <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded text-sm">{s.delays} atrasos</span>
                               )}
                            </td>
                         </tr>
                      );
                   })}
                   {stats.length === 0 && (
                      <tr>
                         <td colSpan={5} className="py-12 text-center text-gray-500">
                            Nenhum dado disponível para este mês.
                         </td>
                      </tr>
                   )}
                </tbody>
             </table>
          </div>
      </div>
    </div>
  );
};

export default TechnicianStats;
