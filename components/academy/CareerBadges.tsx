// ═══════════════════════════════════════════════════════════════════════════
// MGR ACADEMY — Vitrine de Carreira (Fase 4)
// Mostra os badges do colaborador: módulos concluídos (Bronze/Prata/Ouro),
// certificações e cursos externos. Reutilizável (perfil próprio ou visão adm).
// ═══════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { CollectionName, AcademyModule, AcademyProgress, AcademyExternalBadge } from '../../types';
import { GraduationCap, Award, Globe, BadgeCheck, Trophy } from 'lucide-react';
import { BADGE_TIERS } from './academyHelpers';

interface Props { userId: string; }

const CareerBadges: React.FC<Props> = ({ userId }) => {
  const [progress, setProgress] = useState<AcademyProgress[]>([]);
  const [externals, setExternals] = useState<AcademyExternalBadge[]>([]);
  const [modules, setModules] = useState<Record<string, AcademyModule>>({});

  useEffect(() => {
    const unsubP = onSnapshot(query(collection(db, CollectionName.ACADEMY_PROGRESS), where('userId', '==', userId)),
      snap => setProgress(snap.docs.map(d => ({ id: d.id, ...d.data() } as AcademyProgress))));
    const unsubE = onSnapshot(query(collection(db, CollectionName.ACADEMY_EXTERNAL_BADGES), where('userId', '==', userId)),
      snap => setExternals(snap.docs.map(d => ({ id: d.id, ...d.data() } as AcademyExternalBadge))));
    const unsubM = onSnapshot(collection(db, CollectionName.ACADEMY_MODULES),
      snap => { const m: Record<string, AcademyModule> = {}; snap.docs.forEach(d => m[d.id] = { id: d.id, ...d.data() } as AcademyModule); setModules(m); });
    return () => { unsubP(); unsubE(); unsubM(); };
  }, [userId]);

  const earned = progress.filter(p => p.badge);
  const certs = externals.filter(e => e.type === 'certification');
  const courses = externals.filter(e => e.type === 'external');

  const tally = {
    gold: earned.filter(p => p.badge === 'gold').length,
    silver: earned.filter(p => p.badge === 'silver').length,
    bronze: earned.filter(p => p.badge === 'bronze').length,
  };

  return (
    <div className="space-y-5">
      {/* Resumo de carreira */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={20} />
          <h3 className="font-bold">Carreira MGR</h3>
        </div>
        <div className="grid grid-cols-4 gap-3 text-center">
          <Stat n={earned.length} label="Módulos" />
          <Stat n={tally.gold} label="🥇 Ouro" />
          <Stat n={tally.silver} label="🥈 Prata" />
          <Stat n={tally.bronze} label="🥉 Bronze" />
        </div>
        <p className="text-[11px] text-white/70 mt-3">Cada módulo concluído e cada certificação avançam seu nível na empresa.</p>
      </div>

      {/* Badges de módulos */}
      <Section icon={GraduationCap} title={`Módulos concluídos (${earned.length})`}>
        {earned.length === 0 ? <Empty label="Nenhum módulo concluído ainda. Comece na Academia MGR!" /> : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {earned.map(p => {
              const tier = BADGE_TIERS[p.badge!];
              return (
                <div key={p.id} className={`rounded-xl border-2 p-3 flex items-center gap-3 ${tier.classes}`}>
                  <span className="text-2xl">{tier.emoji}</span>
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{modules[p.moduleId]?.title || 'Módulo'}</p>
                    <p className="text-[11px] opacity-80">{tier.label} · {p.scorePercent}% de acertos</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Certificações */}
      <Section icon={BadgeCheck} title={`Certificações (${certs.length})`}>
        {certs.length === 0 ? <Empty label="Nenhuma certificação cadastrada." /> : (
          <div className="grid sm:grid-cols-2 gap-3">{certs.map(c => <ExternalCard key={c.id} b={c} />)}</div>
        )}
      </Section>

      {/* Cursos externos */}
      <Section icon={Globe} title={`Cursos externos (${courses.length})`}>
        {courses.length === 0 ? <Empty label="Nenhum curso externo cadastrado." /> : (
          <div className="grid sm:grid-cols-2 gap-3">{courses.map(c => <ExternalCard key={c.id} b={c} />)}</div>
        )}
      </Section>
    </div>
  );
};

const Stat: React.FC<{ n: number; label: string }> = ({ n, label }) => (
  <div><p className="text-2xl font-extrabold">{n}</p><p className="text-[11px] text-white/80">{label}</p></div>
);

const Section: React.FC<{ icon: React.ElementType; title: string; children: React.ReactNode }> = ({ icon: Icon, title, children }) => (
  <div>
    <h4 className="flex items-center gap-2 font-bold text-gray-800 text-sm mb-2"><Icon size={16} className="text-brand-600" /> {title}</h4>
    {children}
  </div>
);

const Empty: React.FC<{ label: string }> = ({ label }) => (
  <p className="text-sm text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200 py-4 text-center">{label}</p>
);

const ExternalCard: React.FC<{ b: AcademyExternalBadge }> = ({ b }) => (
  <div className="rounded-xl border border-gray-200 p-3 flex items-center gap-3 bg-white">
    <Award size={22} className="text-brand-500 flex-shrink-0" />
    <div className="min-w-0 flex-1">
      <p className="font-bold text-sm text-gray-900 truncate">{b.title}</p>
      <p className="text-[11px] text-gray-500 truncate">{b.institution || '—'}{b.completedDate ? ` · ${b.completedDate}` : ''}</p>
    </div>
    {b.proofUrl && <a href={b.proofUrl} target="_blank" rel="noreferrer" className="text-[11px] text-brand-600 font-semibold hover:underline">ver</a>}
  </div>
);

export default CareerBadges;
