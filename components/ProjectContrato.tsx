/**
 * components/ProjectContrato.tsx — Sprint 2
 *
 * Gestão de contrato do projeto: criação de template texto,
 * envio por link, upload de contrato assinado.
 */
import React, { useState, useRef } from 'react';
import {
  FileText, Send, Upload, CheckCircle2, AlertCircle,
  Loader2, ExternalLink, Download, Pen,
} from 'lucide-react';
import { useProjectContrato } from '../hooks/useProjectContrato';
import type { ContratoStatus } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  projectId: string;
  projectNome: string;
  clientName: string;
  valorTotal?: number;
}

const fmtCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (ts: any) => {
  if (!ts) return '—';
  try { return format(ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000), "dd/MM/yyyy", { locale: ptBR }); }
  catch { return '—'; }
};

const STATUS_CONFIG: Record<ContratoStatus, { label: string; color: string; icon: React.ReactNode }> = {
  rascunho:   { label: 'Rascunho',    color: 'bg-gray-100 text-gray-600 border-gray-200',         icon: <FileText className="w-4 h-4" /> },
  enviado:    { label: 'Enviado',     color: 'bg-blue-100 text-blue-700 border-blue-200',          icon: <Send className="w-4 h-4" /> },
  visualizado:{ label: 'Visualizado', color: 'bg-purple-100 text-purple-700 border-purple-200',    icon: <ExternalLink className="w-4 h-4" /> },
  assinado:   { label: 'Assinado',    color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="w-4 h-4" /> },
  recusado:   { label: 'Recusado',    color: 'bg-red-100 text-red-600 border-red-200',             icon: <AlertCircle className="w-4 h-4" /> },
};

const TEMPLATE_PADRAO = (nome: string, cliente: string, valor: number) => `
CONTRATO DE PRESTAÇÃO DE SERVIÇOS — PROJETO DE REFRIGERAÇÃO

Contratante: ${cliente}
Projeto: ${nome}
Valor Total: ${fmtCurrency(valor)}
Data: ${format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}

CLÁUSULAS

1. DO OBJETO
O presente contrato tem como objeto a execução do projeto de refrigeração denominado "${nome}", 
conforme especificações técnicas apresentadas na proposta comercial aprovada pelo Contratante.

2. DO PRAZO
O prazo de execução dos serviços será definido no cronograma aprovado entre as partes, 
a contar da data de assinatura deste instrumento e do recebimento do sinal.

3. DO VALOR E FORMA DE PAGAMENTO
O valor total dos serviços é de ${fmtCurrency(valor)}, a ser pago conforme cronograma de parcelas 
estabelecido na proposta aprovada.

4. DAS OBRIGAÇÕES DO CONTRATANTE
d) Fornecer acesso às instalações para execução dos serviços.
e) Efetuar os pagamentos nas datas acordadas.

5. DAS OBRIGAÇÕES DA CONTRATADA
a) Executar os serviços com qualidade e dentro das especificações técnicas.
b) Respeitar as normas de segurança (NR-10, NR-18).
c) Emitir relatório fotográfico de conclusão.

6. DA GARANTIA
Os equipamentos instalados possuem garantia conforme especificação do fabricante. 
Os serviços de instalação são garantidos por 6 (seis) meses a partir da entrega.

7. DO FORO
As partes elegem o foro da comarca de Indaiatuba/SP para dirimir quaisquer controvérsias.

___________________________________        ___________________________________
Contratante: ${cliente}                    MGR Refrigeração Industrial Ltda
Data: ____/____/________                   CNPJ: __________________________
`.trim();

const ProjectContrato: React.FC<Props> = ({ projectId, projectNome, clientName, valorTotal = 0 }) => {
  const { contrato, loading, createContrato, updateContrato, marcarEnviado, uploadContratoAssinado, uploadContratoPDF } = useProjectContrato(projectId);
  const [textoContrato, setTextoContrato] = useState('');
  const [valorContrato, setValorContrato] = useState(valorTotal);
  const [linkPublico, setLinkPublico] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAssinado, setUploadingAssinado] = useState(false);
  const [uploadingPDF, setUploadingPDF] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const assinadoRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const texto = textoContrato.trim() || TEMPLATE_PADRAO(projectNome, clientName, valorContrato);
      await createContrato({
        projectId,
        projectNome,
        clientId: '',
        clientName,
        valorContrato,
        textoContrato: texto,
        linkPublico: linkPublico.trim() || null,
      } as any);
      setShowEditor(false);
    } finally { setSaving(false); }
  };

  const handleUploadAssinado = async (file: File) => {
    if (!contrato) return;
    setUploadingAssinado(true);
    try { await uploadContratoAssinado(contrato.id, file); }
    finally { setUploadingAssinado(false); }
  };

  const handleUploadPDF = async (file: File) => {
    if (!contrato) return;
    setUploadingPDF(true);
    try { await uploadContratoPDF(contrato.id, file); }
    finally { setUploadingPDF(false); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-600" /></div>;

  /* ── Estado: Sem contrato ── */
  if (!contrato) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">📝 Contrato</h3>
        </div>

        {!showEditor ? (
          <div className="text-center py-10 text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">Nenhum contrato criado.</p>
            <p className="text-xs text-gray-400 mt-1">Crie o contrato com base no template padrão ou escreva um personalizado.</p>
            <button onClick={() => {
              setTextoContrato(TEMPLATE_PADRAO(projectNome, clientName, valorTotal));
              setValorContrato(valorTotal);
              setShowEditor(true);
            }}
              className="mt-4 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 flex items-center gap-2 mx-auto">
              <FileText className="w-4 h-4" />
              Criar Contrato
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Valor do Contrato (R$)</label>
                <input type="number" value={valorContrato} onChange={e => {
                  const v = Number(e.target.value);
                  setValorContrato(v);
                  setTextoContrato(TEMPLATE_PADRAO(projectNome, clientName, v));
                }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Link de Apresentação/Proposta (opcional)</label>
                <input value={linkPublico} onChange={e => setLinkPublico(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                  placeholder="https://..." />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Texto do Contrato</label>
              <textarea value={textoContrato} onChange={e => setTextoContrato(e.target.value)} rows={16}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono resize-y"
                placeholder="Texto do contrato..." />
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowEditor(false)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleCreate} disabled={saving}
                className="px-5 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Salvar Contrato
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Estado: Contrato criado ── */
  const statusCfg = STATUS_CONFIG[contrato.status as ContratoStatus];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">📝 Contrato</h3>
        <span className={`text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 ${statusCfg.color}`}>
          {statusCfg.icon}{statusCfg.label}
        </span>
      </div>

      {/* Info resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: 'Cliente', value: contrato.clientName },
          { label: 'Valor Contrato', value: fmtCurrency(Number(contrato.variaveis?.valorContrato) || 0) },
          { label: 'Criado em', value: fmtDate(contrato.criadoEm) },
          ...(contrato.enviadoEm ? [{ label: 'Enviado em', value: fmtDate(contrato.enviadoEm) }] : []),
          ...(contrato.assinadoEm ? [{ label: 'Assinado em', value: fmtDate(contrato.assinadoEm) }] : []),
        ].map(f => (
          <div key={f.label} className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{f.label}</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{f.value}</p>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="flex items-center gap-2">
        {(['rascunho', 'enviado', 'assinado'] as ContratoStatus[]).map((s, i, arr) => {
          const stages = ['rascunho', 'enviado', 'assinado'];
          const currentIdx = stages.indexOf(contrato.status);
          const done = i <= currentIdx;
          return (
            <React.Fragment key={s}>
              <div className="flex items-center gap-1.5">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${done ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-200 text-gray-400'}`}>
                  {done ? '✓' : i + 1}
                </div>
                <span className={`text-xs font-medium ${done ? 'text-brand-700' : 'text-gray-400'}`}>
                  {STATUS_CONFIG[s].label}
                </span>
              </div>
              {i < arr.length - 1 && <div className={`flex-1 h-0.5 ${i < currentIdx ? 'bg-brand-500' : 'bg-gray-200'}`} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Ações by status */}
      <div className="flex flex-wrap gap-2">
        {/* Ver/baixar contrato */}
        {contrato.documentoPdfUrl ? (
          <a href={contrato.documentoPdfUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 border border-blue-200 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-50">
            <Download className="w-3.5 h-3.5" /> Baixar Contrato
          </a>
        ) : (
          <button onClick={() => pdfRef.current?.click()} disabled={uploadingPDF}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50">
            {uploadingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Upload PDF Contrato
          </button>
        )}

        {/* Marcar como enviado */}
        {contrato.status === 'rascunho' && (
          <button onClick={() => marcarEnviado(contrato.id)}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700">
            <Send className="w-3.5 h-3.5" /> Marcar como Enviado
          </button>
        )}

        {/* Link público da apresentação */}
        {contrato.variaveis?.linkPublico && (
          <a href={contrato.variaveis.linkPublico} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 border border-brand-200 text-brand-600 rounded-xl text-xs font-bold hover:bg-brand-50">
            <ExternalLink className="w-3.5 h-3.5" /> Ver Apresentação
          </a>
        )}

        {/* Upload assinado */}
        {['rascunho', 'enviado'].includes(contrato.status) && (
          <button onClick={() => assinadoRef.current?.click()} disabled={uploadingAssinado}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-50">
            {uploadingAssinado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pen className="w-3.5 h-3.5" />}
            Upload Assinado
          </button>
        )}

        {/* Contrato assinado — link */}
        {contrato.documentoAssinadoUrl && (
          <a href={contrato.documentoAssinadoUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ver Contrato Assinado
          </a>
        )}
      </div>

      {/* Texto do contrato (colapsável) */}
      {contrato.conteudoHtml && (
        <details className="bg-gray-50 rounded-xl border border-gray-200">
          <summary className="px-4 py-3 cursor-pointer text-xs font-bold text-gray-600 select-none">
            📄 Ver texto do contrato
          </summary>
          <pre className="px-4 pb-4 text-xs text-gray-700 font-mono whitespace-pre-wrap leading-relaxed">
            {contrato.conteudoHtml}
          </pre>
        </details>
      )}

      {/* Hidden inputs */}
      <input ref={assinadoRef} type="file" accept="application/pdf,image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadAssinado(f); e.target.value = ''; }} />
      <input ref={pdfRef} type="file" accept="application/pdf" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadPDF(f); e.target.value = ''; }} />
    </div>
  );
};

export default ProjectContrato;
