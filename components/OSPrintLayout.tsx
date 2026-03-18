/**
 * components/OSPrintLayout.tsx — Sprint 45
 * Layout de impressão da O.S. pré-preenchida.
 * Acessível via /app/os/:osId/print — abre em nova aba.
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, Task, Client } from '../types';
import { Loader2 } from 'lucide-react';

const OSPrintLayout: React.FC = () => {
  const { osId } = useParams<{ osId: string }>();
  const [task,   setTask]   = useState<Task | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!osId) return;
    (async () => {
      const snap = await getDoc(doc(db, CollectionName.TASKS, osId));
      if (!snap.exists()) { setLoading(false); return; }
      const t = { id: snap.id, ...snap.data() } as Task;
      setTask(t);
      if (t.clientId) {
        const cSnap = await getDoc(doc(db, CollectionName.CLIENTS, t.clientId));
        if (cSnap.exists()) setClient({ id: cSnap.id, ...cSnap.data() } as Client);
      }
      setLoading(false);
    })();
  }, [osId]);

  useEffect(() => {
    if (!loading && task) {
      setTimeout(() => window.print(), 500);
    }
  }, [loading, task]);

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      <span className="ml-3 text-gray-500">Preparando impressão...</span>
    </div>
  );

  if (!task) return <div className="p-8 text-gray-500">O.S. não encontrada.</div>;

  const today = new Date().toLocaleDateString('pt-BR');
  const tarefas = (task as any).tarefasOS || (task.checklist || []).map((c: any) => ({ descricao: c.text }));

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; font-family: Arial, sans-serif; font-size: 12px; color: #000; }
          .page { padding: 20mm; }
        }
        body { font-family: Arial, sans-serif; font-size: 13px; color: #111; }
        .page { padding: 40px; max-width: 800px; margin: 0 auto; }
        h1 { font-size: 20px; margin: 0; }
        h2 { font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin: 16px 0 8px; }
        .row { display: flex; gap: 24px; margin-bottom: 6px; }
        .label { font-weight: bold; min-width: 140px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #f0f0f0; border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-size: 11px; }
        td { border: 1px solid #ccc; padding: 6px 10px; font-size: 11px; }
        .sig-box { border: 1px solid #999; min-height: 80px; border-radius: 4px; margin-top: 8px; }
        .lines { margin-top: 8px; }
        .line { border-bottom: 1px solid #ccc; height: 24px; margin-bottom: 4px; }
        .header-top { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px; }
        .os-number { font-size: 24px; font-weight: bold; }
        .badge { display: inline-block; background: #f0f0f0; border: 1px solid #ccc; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
        .footer { margin-top: 32px; border-top: 1px solid #ccc; padding-top: 8px; display: flex; justify-content: space-between; font-size: 10px; color: #666; }
      `}</style>

      <div className="page">
        {/* Header */}
        <div className="header-top">
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 18 }}>MGR CONECT</div>
            <div style={{ fontSize: 11, color: '#555' }}>Ordem de Serviço</div>
          </div>
          <div className="os-number">#{task.code || osId?.slice(0, 8)}</div>
          <div style={{ textAlign: 'right', fontSize: 11 }}>
            <div>Emissão: {today}</div>
            <div className="badge">{(task as any).tipoServico || 'Serviço'}</div>
          </div>
        </div>

        {/* Cliente */}
        <h2>Dados do Cliente</h2>
        <div className="row"><span className="label">Nome:</span> {client?.name || task.clientName || '—'}</div>
        <div className="row"><span className="label">Endereço:</span> {client?.address || '—'}</div>
        <div className="row"><span className="label">Telefone:</span> {client?.phone || '—'}</div>
        <div className="row"><span className="label">E-mail:</span> {client?.email || '—'}</div>

        {/* Serviço */}
        <h2>Dados do Serviço</h2>
        <div className="row"><span className="label">Tipo de Serviço:</span> {(task as any).tipoServico || '—'}</div>
        <div className="row"><span className="label">Ativo vinculado:</span> {(task as any).ativoNome || '—'}</div>
        <div className="row"><span className="label">Responsável:</span> {task.assigneeName || '—'}</div>
        <div className="row"><span className="label">Data Prevista:</span>
          {task.scheduling?.dataPrevista
            ? (task.scheduling.dataPrevista as any).toDate?.().toLocaleDateString('pt-BR') || '—'
            : task.endDate ? (task.endDate as any).toDate?.().toLocaleDateString('pt-BR') || '—' : '—'}
        </div>
        <div className="row"><span className="label">Prioridade:</span> {task.priority || '—'}</div>

        {/* Descrição */}
        <h2>Descrição do Problema</h2>
        <p style={{ minHeight: 48, border: '1px solid #eee', padding: 8, borderRadius: 4 }}>
          {task.description || '—'}
        </p>

        {/* Tarefas */}
        <h2>Lista de Tarefas</h2>
        <table>
          <thead>
            <tr>
              <th style={{ width: 32 }}>✓</th>
              <th>Descrição da Tarefa</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ width: 80 }}>Duração</th>
            </tr>
          </thead>
          <tbody>
            {tarefas.length > 0 ? tarefas.map((t: any, i: number) => (
              <tr key={i}>
                <td style={{ textAlign: 'center' }}>□</td>
                <td>{t.descricao || t.text || '—'}</td>
                <td>{t.status || '—'}</td>
                <td>{t.tempoDuracaoMinutos ? `${t.tempoDuracaoMinutos}min` : '—'}</td>
              </tr>
            )) : (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: '#999' }}>Nenhuma tarefa</td></tr>
            )}
          </tbody>
        </table>

        {/* Ferramentas */}
        {(task as any).ferramentasUtilizadas?.length > 0 && (
          <>
            <h2>Ferramentas Previstas</h2>
            <p>{(task as any).ferramentasUtilizadas.join(', ')}</p>
          </>
        )}

        {/* Observações em branco */}
        <h2>Observações de Campo</h2>
        <div className="lines">
          {[1,2,3,4].map(i => <div key={i} className="line" />)}
        </div>

        {/* Assinatura */}
        <h2>Assinatura do Cliente</h2>
        <div style={{ display: 'flex', gap: 32, marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, marginBottom: 4 }}>Nome:</div>
            <div className="sig-box" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, marginBottom: 4 }}>Assinatura:</div>
            <div className="sig-box" />
          </div>
          <div style={{ width: 120 }}>
            <div style={{ fontSize: 11, marginBottom: 4 }}>Data:</div>
            <div className="sig-box" />
          </div>
        </div>

        {/* Footer */}
        <div className="footer">
          <span>OS #{task.code || osId?.slice(0, 8)} — Gerado em {today}</span>
          <span>MGR CONECT — Sistema de Gestão</span>
        </div>

        {/* Print button — no-print */}
        <div className="no-print" style={{ marginTop: 24, textAlign: 'center' }}>
          <button onClick={() => window.print()}
            style={{ padding: '10px 24px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>
            🖨️ Imprimir / Salvar PDF
          </button>
          <button onClick={() => window.close()}
            style={{ marginLeft: 12, padding: '10px 24px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' }}>
            Fechar
          </button>
        </div>
      </div>
    </>
  );
};

export default OSPrintLayout;
