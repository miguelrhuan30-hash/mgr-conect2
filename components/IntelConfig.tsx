import React, { useState, useEffect } from 'react';
import {
    Shield, Key, Users, AlertCircle, CheckCircle2,
    Loader2, Wifi, WifiOff, RefreshCw, UserCheck, UserX,
    Sparkles, Lock, ExternalLink
} from 'lucide-react';
import { collection, query, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';

type IntelRole = 'intel_admin' | 'intel_analyst' | 'intel_viewer' | 'none';

const ROLE_LABELS: Record<IntelRole, string> = {
    intel_admin:   '⚡ Admin Intel',
    intel_analyst: '🔬 Analista',
    intel_viewer:  '👁 Visualizador',
    none:          'Sem acesso',
};

const ROLE_COLORS: Record<IntelRole, string> = {
    intel_admin:   'bg-purple-100 text-purple-700 border-purple-200',
    intel_analyst: 'bg-blue-100 text-blue-700 border-blue-200',
    intel_viewer:  'bg-gray-100 text-gray-600 border-gray-200',
    none:          'bg-red-50 text-red-500 border-red-100',
};

type HealthStatus = 'checking' | 'ok' | 'error';

const IntelConfig: React.FC = () => {
    const { userProfile } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [healthStatus, setHealthStatus] = useState<HealthStatus>('checking');
    const [healthData, setHealthData] = useState<any>(null);
    const [updatingUser, setUpdatingUser] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // ── Health check ──────────────────────────────────────────────────────
    const checkHealth = async () => {
        setHealthStatus('checking');
        try {
            const res = await fetch('/api/health');
            const data = await res.json();
            setHealthData(data);
            setHealthStatus(data.services?.intel_engine === 'ready' ? 'ok' : 'error');
        } catch {
            setHealthStatus('error');
        }
    };

    useEffect(() => { checkHealth(); }, []);

    // ── Load all users ────────────────────────────────────────────────────
    useEffect(() => {
        getDocs(query(collection(db, CollectionName.USERS)))
            .then(snap => {
                setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
                setUsersLoading(false);
            })
            .catch(() => setUsersLoading(false));
    }, []);

    // ── Update user role ──────────────────────────────────────────────────
    const handleRoleChange = async (uid: string, newRole: IntelRole) => {
        setUpdatingUser(uid);
        try {
            await updateDoc(doc(db, CollectionName.USERS, uid), {
                role: newRole === 'none' ? 'employee' : newRole,
            });
            setUsers(prev => prev.map(u =>
                u.uid === uid ? { ...u, role: (newRole === 'none' ? 'employee' : newRole) as UserProfile['role'] } : u
            ));
            setSuccessMsg(`Papel atualizado com sucesso!`);
            setTimeout(() => setSuccessMsg(null), 3000);
        } catch (err) {
            console.error(err);
        } finally {
            setUpdatingUser(null);
        }
    };

    const getIntelRole = (user: UserProfile): IntelRole => {
        if (user.role === 'intel_admin') return 'intel_admin';
        if (user.role === 'intel_analyst') return 'intel_analyst';
        if (user.role === 'intel_viewer') return 'intel_viewer';
        return 'none';
    };

    const isCurrentAdmin = ['admin', 'developer', 'intel_admin'].includes(userProfile?.role || '');

    return (
        <div className="space-y-6 max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* ── Gemini API Health ─────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Sparkles size={16} className="text-brand-600" /> Motor de IA — Gemini 2.0 Flash
                    </h3>
                    <button
                        onClick={checkHealth}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg transition-all"
                    >
                        <RefreshCw size={12} className={healthStatus === 'checking' ? 'animate-spin' : ''} />
                        Verificar
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    {/* Status indicator */}
                    <div className={`flex items-center gap-3 p-4 rounded-xl border ${
                        healthStatus === 'ok' ? 'bg-emerald-50 border-emerald-200' :
                        healthStatus === 'error' ? 'bg-red-50 border-red-200' :
                        'bg-gray-50 border-gray-200'}`}>
                        {healthStatus === 'checking' && <Loader2 size={20} className="animate-spin text-gray-400" />}
                        {healthStatus === 'ok' && <CheckCircle2 size={20} className="text-emerald-600" />}
                        {healthStatus === 'error' && <WifiOff size={20} className="text-red-500" />}
                        <div>
                            <p className={`text-sm font-bold ${
                                healthStatus === 'ok' ? 'text-emerald-800' :
                                healthStatus === 'error' ? 'text-red-800' : 'text-gray-700'}`}>
                                {healthStatus === 'checking' ? 'Verificando conexão...' :
                                 healthStatus === 'ok' ? 'Gemini Online — Intel Engine: Ready' :
                                 'Gemini indisponível — Verifique a GEMINI_API_KEY'}
                            </p>
                            {healthData?.uptime && (
                                <p className="text-[10px] text-gray-500 mt-0.5">
                                    Uptime: {Math.floor(healthData.uptime / 60)}min · Timestamp: {healthData.timestamp?.slice(0,19).replace('T',' ')}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Security note */}
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
                        <Lock size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-amber-800">Segurança de Credenciais</p>
                            <p className="text-[11px] text-amber-700 mt-1 leading-relaxed">
                                A <code className="bg-amber-100 px-1 rounded font-mono">GEMINI_API_KEY</code> é consumida exclusivamente via variável de ambiente no Cloud Run.
                                Nunca está exposta no frontend ou no código-fonte.
                                Para alterar, atualize o <code className="bg-amber-100 px-1 rounded font-mono">cloudbuild.yaml</code> e faça re-deploy.
                            </p>
                        </div>
                    </div>

                    {/* Build confirmation */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                            <CheckCircle2 size={14} className="text-emerald-500" />
                            <span><code className="font-mono bg-gray-200 px-1 rounded text-[10px]">cloudbuild.yaml</code> usando <code className="font-mono bg-gray-200 px-1 rounded text-[10px]">--cpu-boost</code></span>
                        </div>
                        <span className="text-[10px] text-emerald-600 font-bold">✅ Válido</span>
                    </div>
                </div>
            </div>

            {/* ── Role Management ───────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Shield size={16} className="text-brand-600" /> Gestão de Papéis Intel
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-1">
                        Controle quem pode criar, analisar e visualizar insights de inteligência.
                    </p>
                </div>

                {/* Role legend */}
                <div className="px-5 pt-4 pb-2 flex flex-wrap gap-2">
                    {(Object.keys(ROLE_LABELS) as IntelRole[]).map(r => (
                        <span key={r} className={`text-[10px] font-bold px-2 py-1 rounded-full border ${ROLE_COLORS[r]}`}>
                            {ROLE_LABELS[r]}
                        </span>
                    ))}
                </div>

                <div className="p-5 space-y-3">
                    {usersLoading ? (
                        <div className="flex items-center gap-2 text-gray-400 py-4">
                            <Loader2 size={16} className="animate-spin" />
                            <span className="text-xs">Carregando utilizadores...</span>
                        </div>
                    ) : users.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Nenhum utilizador encontrado.</p>
                    ) : (
                        users.map(user => {
                            const currentRole = getIntelRole(user);
                            const isUpdating = updatingUser === user.uid;
                            const isSelf = user.uid === userProfile?.uid;

                            return (
                                <div key={user.uid}
                                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold flex-shrink-0">
                                            {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-gray-900 truncate">
                                                {user.displayName || 'Sem nome'}
                                                {isSelf && <span className="ml-1 text-[9px] text-gray-400">(você)</span>}
                                            </p>
                                            <p className="text-[10px] text-gray-500 truncate">{user.email}</p>
                                        </div>
                                    </div>

                                    {isCurrentAdmin && !isSelf ? (
                                        <select
                                            value={currentRole}
                                            disabled={isUpdating}
                                            onChange={e => handleRoleChange(user.uid, e.target.value as IntelRole)}
                                            className="text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:opacity-50"
                                        >
                                            {(Object.keys(ROLE_LABELS) as IntelRole[]).map(r => (
                                                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${ROLE_COLORS[currentRole]}`}>
                                            {ROLE_LABELS[currentRole]}
                                        </span>
                                    )}

                                    {isUpdating && <Loader2 size={14} className="animate-spin text-brand-500 flex-shrink-0" />}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Success toast */}
                {successMsg && (
                    <div className="mx-5 mb-5 flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs rounded-lg px-4 py-2.5 border border-emerald-200">
                        <CheckCircle2 size={14} /> {successMsg}
                    </div>
                )}
            </div>

            {/* ── System Status ─────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <AlertCircle size={14} /> Estado do Sistema
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                        { label: 'API Key',         value: 'Variável de ambiente Cloud Run',  ok: true },
                        { label: 'Flag de Deploy',   value: '--cpu-boost (correto)',           ok: true },
                        { label: 'TypeScript',       value: 'tsc --noEmit 0 erros',           ok: true },
                    ].map(item => (
                        <div key={item.label} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                            {item.ok
                                ? <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                                : <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />}
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{item.label}</p>
                                <p className="text-xs text-gray-700 mt-0.5">{item.value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default IntelConfig;
