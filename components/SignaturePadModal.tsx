/**
 * components/SignaturePadModal.tsx
 *
 * Modal de assinatura virtual estilo DocuSign.
 * Cliente desenha a assinatura num canvas → pdf-lib carimba a imagem na posição
 * definida em `assinaturaCampo` do PDF original → salva como `contrato_final.pdf` no Storage.
 *
 * Reutilizado tanto pela página pública (PropostaDocPublica) quanto pela retaguarda
 * (ProjectContrato — admin assinando em nome do cliente).
 */
import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { PDFDocument } from 'pdf-lib';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { Check, Loader2, X, Eraser, AlertCircle } from 'lucide-react';
import type { AssinaturaCampo } from '../types';

interface Props {
  projectId: string;
  contratoPdfUrl: string;
  assinaturaCampo?: AssinaturaCampo;
  signerNome: string;
  onClose: () => void;
  onSigned: (result: {
    contratoFinalUrl: string;
    contratoFinalPath: string;
    imagemDataUrl: string;
  }) => Promise<void> | void;
}

const C = {
  bg: '#0A1628',
  bgCard: '#0d1f35',
  bgCard2: '#112040',
  border: '#1e3550',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  green: '#22c55e',
  greenDark: '#16a34a',
  accent: '#E8593C',
};

const SignaturePadModal: React.FC<Props> = ({
  projectId, contratoPdfUrl, assinaturaCampo, signerNome, onClose, onSigned,
}) => {
  const sigRef = useRef<SignatureCanvas | null>(null);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [step, setStep] = useState<'draw' | 'preview'>('draw');
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  const handleClear = () => {
    sigRef.current?.clear();
    setErro('');
  };

  const isEmpty = () => sigRef.current?.isEmpty() ?? true;

  // Captura PNG da assinatura (recortado ao bounding box do traço — toDataURL
  // do canvas inteiro inclui muito espaço vazio em volta).
  const captureSignaturePng = (): string | null => {
    const pad = sigRef.current;
    if (!pad || pad.isEmpty()) return null;
    return pad.toDataURL('image/png');
  };

  // Carimba assinatura no PDF e gera Blob
  const stampPdf = async (signaturePngDataUrl: string): Promise<Uint8Array> => {
    const pdfBytes = await fetch(contratoPdfUrl).then(r => r.arrayBuffer());
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    // Default: última página, canto inferior direito.
    const totalPages = pages.length;
    const campo: AssinaturaCampo = assinaturaCampo || {
      page: totalPages,
      xRel: 0.55, yRel: 0.85, wRel: 0.35, hRel: 0.08,
    };
    const pageIdx = Math.max(0, Math.min(totalPages - 1, campo.page - 1));
    const page = pages[pageIdx];
    const { width: pw, height: ph } = page.getSize();

    const pngImage = await pdfDoc.embedPng(signaturePngDataUrl);
    const w = campo.wRel * pw;
    const h = campo.hRel * ph;
    // pdf-lib usa origem no canto INFERIOR esquerdo. yRel é top-left (0..1).
    const x = campo.xRel * pw;
    const y = ph - campo.yRel * ph - h;

    page.drawImage(pngImage, { x, y, width: w, height: h });

    // Adiciona linha de auditoria abaixo da assinatura
    const fontSize = 7;
    const auditTxt = `Assinado digitalmente por ${signerNome} em ${new Date().toLocaleString('pt-BR')}`;
    page.drawText(auditTxt, {
      x,
      y: Math.max(0, y - fontSize - 2),
      size: fontSize,
    });

    return pdfDoc.save();
  };

  const handlePreview = () => {
    if (isEmpty()) {
      setErro('Desenhe sua assinatura antes de continuar.');
      return;
    }
    const png = captureSignaturePng();
    if (!png) return;
    setPreviewDataUrl(png);
    setStep('preview');
  };

  const handleConfirm = async () => {
    if (!previewDataUrl) return;
    setSaving(true);
    setErro('');
    try {
      const pdfBytes = await stampPdf(previewDataUrl);
      const path = `projects/${projectId}/contrato_final.pdf`;
      const ref = storageRef(storage, path);
      // Cópia em ArrayBuffer puro — evita conflito de Uint8Array<SharedArrayBuffer>.
      const buf = new ArrayBuffer(pdfBytes.byteLength);
      new Uint8Array(buf).set(pdfBytes);
      const blob = new Blob([buf], { type: 'application/pdf' });
      await uploadBytes(ref, blob, { contentType: 'application/pdf' });
      const url = await getDownloadURL(ref);
      await onSigned({
        contratoFinalUrl: url,
        contratoFinalPath: path,
        imagemDataUrl: previewDataUrl,
      });
    } catch (err) {
      console.error(err);
      setErro(`Erro ao processar assinatura: ${(err as Error).message || 'tente novamente'}`);
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 600,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        background: C.bgCard, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: '28px 24px',
        maxWidth: 560, width: '100%',
        boxShadow: '0 20px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ color: C.text, fontSize: 18, fontWeight: 800, margin: 0 }}>
            ✍️ Assinatura Digital
          </h2>
          <button onClick={onClose} disabled={saving}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {step === 'draw' && (
          <>
            <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: '0 0 16px' }}>
              Desenhe sua assinatura no quadro abaixo. Use o mouse, trackpad ou o dedo (em telas touch).
            </p>

            <div style={{
              background: '#fff', borderRadius: 10, border: `2px solid ${C.border}`,
              overflow: 'hidden', marginBottom: 14,
            }}>
              <SignatureCanvas
                ref={sigRef}
                penColor="#0A1628"
                canvasProps={{
                  width: 500, height: 200,
                  style: { width: '100%', height: 200, display: 'block', touchAction: 'none' },
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', marginBottom: 14 }}>
              <button onClick={handleClear}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 8,
                  border: `1px solid ${C.border}`, background: 'transparent',
                  color: C.textMuted, fontSize: 13, cursor: 'pointer',
                }}>
                <Eraser size={14} /> Limpar
              </button>
            </div>

            {erro && (
              <div style={{
                background: '#ef444418', border: '1px solid #ef444444',
                borderRadius: 10, padding: '10px 14px', marginBottom: 14,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <AlertCircle size={14} color="#ef4444" />
                <span style={{ color: '#ef4444', fontSize: 13 }}>{erro}</span>
              </div>
            )}

            <button onClick={handlePreview}
              style={{
                width: '100%', padding: '13px 0',
                background: `linear-gradient(135deg, ${C.green}, ${C.greenDark})`,
                border: 'none', borderRadius: 11, cursor: 'pointer',
                color: 'white', fontWeight: 800, fontSize: 15,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: `0 4px 18px ${C.green}44`,
              }}>
              Pré-visualizar Contrato Assinado →
            </button>
          </>
        )}

        {step === 'preview' && previewDataUrl && (
          <>
            <p style={{ color: C.textMuted, fontSize: 13, lineHeight: 1.5, margin: '0 0 14px' }}>
              Sua assinatura será aplicada ao contrato como abaixo. Confirme para finalizar.
            </p>

            <div style={{
              background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`,
              padding: 16, marginBottom: 14, textAlign: 'center',
            }}>
              <img src={previewDataUrl} alt="Assinatura"
                style={{ maxWidth: '100%', maxHeight: 120, display: 'inline-block' }} />
              <p style={{ color: '#444', fontSize: 11, margin: '6px 0 0' }}>
                Assinado por <strong>{signerNome}</strong> · {new Date().toLocaleString('pt-BR')}
              </p>
            </div>

            {erro && (
              <div style={{
                background: '#ef444418', border: '1px solid #ef444444',
                borderRadius: 10, padding: '10px 14px', marginBottom: 14,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <AlertCircle size={14} color="#ef4444" />
                <span style={{ color: '#ef4444', fontSize: 13 }}>{erro}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setStep('draw'); setPreviewDataUrl(null); }}
                disabled={saving}
                style={{
                  flex: '0 0 auto', padding: '13px 18px', borderRadius: 11,
                  border: `1px solid ${C.border}`, background: 'transparent',
                  color: C.textMuted, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer',
                }}>
                ← Refazer
              </button>
              <button onClick={handleConfirm} disabled={saving}
                style={{
                  flex: 1, padding: '13px 0',
                  background: saving ? `${C.green}88` : `linear-gradient(135deg, ${C.green}, ${C.greenDark})`,
                  border: 'none', borderRadius: 11,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  color: 'white', fontWeight: 800, fontSize: 15,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: saving ? 'none' : `0 4px 18px ${C.green}44`,
                }}>
                {saving
                  ? <><Loader2 size={16} className="animate-spin" /> Carimbando contrato…</>
                  : <><Check size={16} strokeWidth={3} /> Confirmar Assinatura</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SignaturePadModal;
