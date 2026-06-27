/**
 * components/OSPrintLayout.tsx — Sprint 45
 * Layout de impressão da O.S. pré-preenchida.
 * Acessível via /app/os/:osId/print — abre em nova aba.
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, Task, Client, OSStatusFinal } from '../types';
import { normalizeStatusOS } from '../services/osService';
import { Loader2 } from 'lucide-react';

// ── Sprint F1: Formulário em branco para OS sem dados preenchidos ──────────────
interface FormularioEmBrancoProps {
  numeroOS: string;
  dataAbertura: string;
}

const FormularioEmBranco: React.FC<FormularioEmBrancoProps> = ({ numeroOS, dataAbertura }) => {
  useEffect(() => {
    setTimeout(() => window.print(), 500);
  }, []);

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; font-family: Arial, sans-serif; font-size: 11px; color: #000; }
          .fb-page { padding: 16mm; }
        }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #111; }
        .fb-page { padding: 36px; max-width: 800px; margin: 0 auto; }
        .fb-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 14px; }
        .fb-title { font-size: 22px; font-weight: bold; letter-spacing: 1px; }
        .fb-num { font-size: 20px; font-weight: bold; border: 2px solid #000; padding: 4px 14px; border-radius: 6px; }
        .fb-section { margin-top: 12px; margin-bottom: 6px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #bbb; padding-bottom: 3px; }
        .fb-field { display: flex; gap: 6px; margin-bottom: 8px; font-size: 11px; }
        .fb-label { font-weight: bold; min-width: 110px; white-space: nowrap; }
        .fb-line { flex: 1; border-bottom: 1px solid #aaa; min-height: 18px; }
        .fb-lines { margin-top: 6px; }
        .fb-sline { border-bottom: 1px solid #ccc; height: 22px; margin-bottom: 5px; }
        .fb-check-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 11px; }
        .fb-box { width: 14px; height: 14px; border: 1px solid #444; display: inline-block; flex-shrink: 0; }
        table.fb-mat { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10px; }
        table.fb-mat th { background: #eee; border: 1px solid #bbb; padding: 4px 8px; text-align: left; }
        table.fb-mat td { border: 1px solid #bbb; padding: 4px 8px; height: 22px; }
        .fb-sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 8px; }
        .fb-sig-col { border: 1px solid #bbb; border-radius: 4px; padding: 10px; }
        .fb-sig-label { font-size: 10px; color: #666; margin-bottom: 3px; }
        .fb-sig-line { border-bottom: 1px solid #999; min-height: 28px; margin-bottom: 8px; }
        .fb-footer { margin-top: 24px; border-top: 1px solid #ccc; padding-top: 6px; display: flex; justify-content: space-between; font-size: 9px; color: #888; }
        .fb-satisfaction { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px 12px; font-size: 11px; display: flex; align-items: center; gap: 16px; margin-top: 8px; }
      `}</style>
      <div className="fb-page">
        {/* Cabeçalho */}
        <div className="fb-header">
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 16 }}>MGR CONECT</div>
            <div style={{ fontSize: 10, color: '#555' }}>CNPJ: 00.000.000/0001-00</div>
            <div style={{ fontSize: 10, color: '#555' }}>Refrigeração Industrial e Comercial</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div className="fb-title">ORDEM DE SERVIÇO</div>
            <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>Formulário para Preenchimento Manual</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="fb-num">N°: {numeroOS}</div>
            <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>Abertura: {dataAbertura}</div>
          </div>
        </div>

        {/* Dados do cliente */}
        <div className="fb-section">Dados do Cliente</div>
        <div className="fb-field"><span className="fb-label">Cliente:</span><span className="fb-line" /></div>
        <div className="fb-field"><span className="fb-label">Contato:</span><span className="fb-line" /></div>
        <div className="fb-field"><span className="fb-label">Endereço:</span><span className="fb-line" /></div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="fb-field" style={{ flex: 1 }}><span className="fb-label">Telefone:</span><span className="fb-line" /></div>
          <div className="fb-field" style={{ flex: 1 }}><span className="fb-label">E-mail:</span><span className="fb-line" /></div>
        </div>

        {/* Descrição do serviço */}
        <div className="fb-section">Descrição do Serviço Solicitado</div>
        <div className="fb-lines">
          <div className="fb-sline" />
          <div className="fb-sline" />
        </div>

        {/* Serviços realizados */}
        <div className="fb-section">Serviços Realizados</div>
        {[
          'Manutenção Preventiva',
          'Manutenção Corretiva',
          'Troca de Peça / Componente',
          'Recarga de Gás',
        ].map(s => (
          <div key={s} className="fb-check-row">
            <span className="fb-box" />
            <span>{s}</span>
          </div>
        ))}
        <div className="fb-lines">
          <div className="fb-sline" />
          <div className="fb-sline" />
        </div>

        {/* Materiais */}
        <div className="fb-section">Materiais Utilizados</div>
        <table className="fb-mat">
          <thead>
            <tr>
              <th style={{ width: '50%' }}>Descrição do Item</th>
              <th style={{ width: '20%' }}>Qtd</th>
              <th style={{ width: '30%' }}>Unidade</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map(i => (
              <tr key={i}><td /><td /><td /></tr>
            ))}
          </tbody>
        </table>

        {/* Horas */}
        <div className="fb-section">Controle de Tempo</div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div className="fb-field" style={{ flex: 1 }}><span className="fb-label">Hora Início:</span><span className="fb-line" /></div>
          <div className="fb-field" style={{ flex: 1 }}><span className="fb-label">Hora Término:</span><span className="fb-line" /></div>
          <div className="fb-field" style={{ flex: 1 }}><span className="fb-label">Total de Horas:</span><span className="fb-line" /></div>
        </div>

        {/* Observações */}
        <div className="fb-section">Observações Técnicas</div>
        <div className="fb-lines">
          <div className="fb-sline" />
          <div className="fb-sline" />
        </div>

        {/* Satisfação */}
        <div className="fb-satisfaction">
          <span style={{ fontWeight: 'bold' }}>Serviço concluído a sua satisfação?</span>
          <div className="fb-check-row"><span className="fb-box" /><span>SIM</span></div>
          <div className="fb-check-row"><span className="fb-box" /><span>NÃO</span></div>
        </div>

        {/* Assinatura */}
        <div className="fb-section" style={{ marginTop: 14 }}>Confirmação e Assinatura do Cliente</div>
        <div className="fb-sig-grid">
          <div className="fb-sig-col">
            <div style={{ fontWeight: 'bold', fontSize: 11, marginBottom: 8, textTransform: 'uppercase' }}>Cliente</div>
            <div className="fb-sig-label">Nome legível:</div>
            <div className="fb-sig-line" />
            <div className="fb-sig-label">Assinatura:</div>
            <div className="fb-sig-line" style={{ minHeight: 44 }} />
            <div className="fb-sig-label">Data:</div>
            <div className="fb-sig-line" style={{ width: 120 }} />
          </div>
          <div className="fb-sig-col">
            <div style={{ fontWeight: 'bold', fontSize: 11, marginBottom: 8, textTransform: 'uppercase' }}>Técnico MGR</div>
            <div className="fb-sig-label">Nome:</div>
            <div className="fb-sig-line" />
            <div className="fb-sig-label">Assinatura:</div>
            <div className="fb-sig-line" style={{ minHeight: 44 }} />
            <div className="fb-sig-label">Data:</div>
            <div className="fb-sig-line" style={{ width: 120 }} />
          </div>
        </div>

        {/* Footer */}
        <div className="fb-footer">
          <span>OS N°: {numeroOS} — Emitido em {dataAbertura}</span>
          <span>MGR CONECT — (XX) XXXX-XXXX | contato@mgrconect.com.br</span>
        </div>

        {/* Botão imprimir — sem-print */}
        <div className="no-print" style={{ marginTop: 24, textAlign: 'center' }}>
          <button onClick={() => window.print()}
            style={{ padding: '10px 24px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', marginRight: 12 }}>
            🖨️ Imprimir / Salvar PDF
          </button>
          <button onClick={() => window.history.length > 1 ? window.history.back() : window.close()}
            style={{ padding: '10px 24px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' }}>
            ← Voltar
          </button>
        </div>
      </div>
    </>
  );
};

// ── Sprint 45: Layout de impressão principal (OS com dadosCompletos !== false) ──
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

  // Sprint F1 — formulário em branco para OS geradas pelo Gerador Rápido
  // Também detecta OS com statusOS NUMERO_GERADO ou AGUARDANDO_DADOS (dados incompletos)
  const statusNorm = normalizeStatusOS((task as any).statusOS);
  const isFormEmBranco = (task as any).dadosCompletos === false
    || statusNorm === 'NUMERO_GERADO'
    || statusNorm === 'AGUARDANDO_DADOS';
  if (isFormEmBranco) {
    return <FormularioEmBranco numeroOS={(task as any).numeroOS || task.code || osId?.slice(0, 8) || ''} dataAbertura={today} />;
  }

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
        .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 8px; }
        .sig-col { border: 1px solid #bbb; border-radius: 4px; padding: 12px; }
        .sig-col-title { font-size: 12px; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
        .sig-field { margin-bottom: 10px; }
        .sig-label { font-size: 10px; color: #666; margin-bottom: 3px; }
        .sig-line { border-bottom: 1px solid #999; min-height: 30px; }
        .declaration { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 10px; font-size: 11px; margin: 8px 0; line-height: 1.5; }
      `}</style>

      <div className="page">
        {/* Header */}
        <div className="header-top">
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 18 }}>MGR CONECT</div>
            <div style={{ fontSize: 11, color: '#555' }}>Ordem de Serviço</div>
          </div>
          <div className="os-number">#{(task as any).numeroOS || task.code || osId?.slice(0, 8)}</div>
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
          <span>OS #{(task as any).numeroOS || task.code || osId?.slice(0, 8)} — Gerado em {today}</span>
          <span>MGR CONECT — Sistema de Gestão</span>
        </div>

        {/* Print button — no-print */}
        <div className="no-print" style={{ marginTop: 24, textAlign: 'center' }}>
          <button onClick={() => window.print()}
            style={{ padding: '10px 24px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>
            🖨️ Imprimir / Salvar PDF
          </button>
          <button
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                window.close();
              }
            }}
            style={{ marginLeft: 12, padding: '10px 24px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' }}>
            ← Voltar às O.S.
          </button>
        </div>
      </div>
    </>
  );
};

export default OSPrintLayout;
