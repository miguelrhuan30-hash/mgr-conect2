// ═══════════════════════════════════════════════════════════════════════════
// MGR ACADEMY — Vitrine do colaborador (módulos publicados)
// Fase 1: lista os módulos publicados e o progresso já registrado.
// Fase 2 adiciona o leitor com rastreamento (PDF/vídeo/infográfico) e a prova.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CollectionName, AcademyModule, AcademyProgress } from '../types';
import { GraduationCap, FileText, Video, Image as ImageIcon, ClipboardList, Loader2, PlayCircle } from 'lucide-react';
import { BADGE_TIERS } from './academy/academyHelpers';

const Academy: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [modules, setModules] = useState<AcademyModule[]>([]);
  const [progress, setProgress] = useState<Record<string, AcademyProgress>>({});
  const [loading, setLoading] = useState(true);

  // Módulos publicados
  useEffect(() => {
    const q = query(
      collection(db, CollectionName.ACADEMY_MODULES),
      where('status', '==', 'published'),
      orderBy('order', 'asc'),
    );
    const unsub = onSnapshot(q, snap => {
      setModules(snap.docs.map(d => ({ id: d.id, ...d.data() } as AcademyModule)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  // Progresso do colaborador
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, CollectionName.ACADEMY_PROGRESS), where('userId', '==', currentUser.uid));
    return onSnapshot(q, snap => {
      const map: Record<string, AcademyProgress> = {};
      snap.docs.forEach(d => { const p = { id: d.id, ...d.data() } as AcademyProgress; map[p.moduleId] = p; });
      setProgress(map);
    });
  }, [currentUser]);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-brand-100 flex items-center justify-center">
          <GraduationCap className="text-brand-700" size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Academia MGR</h1>
          <p className="text-sm text-gray-500">Sua trilha de evolução na empresa. Avance, conquiste badges e construa sua carreira.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-500" size={32} /></div>
      ) : modules.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
          <GraduationCap className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-500 font-medium">Nenhum módulo disponível ainda.</p>
          <p className="text-sm text-gray-400">Assim que novos cursos forem publicados, eles aparecerão aqui.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map(m => {
            const p = progress[m.id];
            const pct = p?.contentPercent ?? 0;
            const badge = p?.badge;
            return (
              <div key={m.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                <div className="h-28 bg-gradient-to-br from-brand-500 to-brand-700 relative flex items-end p-3">
                  {m.coverUrl && <img src={m.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                  {badge && (
                    <span className={`relative z-10 px-2 py-0.5 rounded-full text-[11px] font-bold border ${BADGE_TIERS[badge].classes}`}>
                      {BADGE_TIERS[badge].emoji} {BADGE_TIERS[badge].label}
                    </span>
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-bold text-gray-900">{m.title}</h3>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3 flex-1">{m.description}</p>

                  {/* Etapas do módulo */}
                  <div className="flex gap-3 text-[11px] text-gray-400 mb-3">
                    {m.pdfUrl && <span className="flex items-center gap-1"><FileText size={13} /> PDF</span>}
                    {m.videoUrl && <span className="flex items-center gap-1"><Video size={13} /> Vídeo</span>}
                    {m.infographicUrl && <span className="flex items-center gap-1"><ImageIcon size={13} /> Info</span>}
                    {m.exam.enabled && <span className="flex items-center gap-1"><ClipboardList size={13} /> Prova</span>}
                  </div>

                  {/* Progresso */}
                  <div className="mb-3">
                    <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                      <span>Progresso</span><span className="font-bold">{pct}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-brand-500 to-brand-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/app/academy/modulo/${m.id}`)}
                    className="w-full py-2.5 bg-brand-600 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-brand-700"
                  >
                    <PlayCircle size={15} /> {badge ? 'Revisar' : pct > 0 ? 'Continuar' : 'Começar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Academy;
