/**
 * components/ContratoSignatureFieldEditor.tsx
 *
 * Editor para o admin marcar visualmente a posição da assinatura no PDF do contrato.
 * Usa react-pdf para renderizar o PDF e captura o retângulo desenhado pelo admin
 * (clique e arraste). Salva em coordenadas relativas (0..1) para `assinaturaCampo`.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { ChevronLeft, ChevronRight, Check, Loader2, X, RotateCcw } from 'lucide-react';
import type { AssinaturaCampo } from '../types';

// Worker do pdfjs via import.meta.url — Vite resolve o caminho local corretamente.
// Evita dependência de CDN externa (unpkg) que pode falhar por CORS ou indisponibilidade.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface Props {
  contratoPdfUrl: string;
  initial?: AssinaturaCampo;
  onClose: () => void;
  onSave: (campo: AssinaturaCampo) => Promise<void> | void;
}

const ContratoSignatureFieldEditor: React.FC<Props> = ({
  contratoPdfUrl, initial, onClose, onSave,
}) => {
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(initial?.page || 1);
  const [pageDims, setPageDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [campo, setCampo] = useState<AssinaturaCampo | null>(initial || null);
  const [drawing, setDrawing] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const onLoadSuccess = ({ numPages }: { numPages: number }) => setNumPages(numPages);

  // react-pdf ainda não tem tipos públicos sólidos para o objeto da page renderizada
  const onPageRenderSuccess = (page: { width: number; height: number }) => {
    setPageDims({ w: page.width, h: page.height });
  };

  // Coordenadas relativas (0..1) baseadas no wrapper visível
  const toRel = (clientX: number, clientY: number) => {
    const r = wrapperRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(1, (clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (clientY - r.top) / r.height)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const { x, y } = toRel(e.clientX, e.clientY);
    setDrawing({ x0: x, y0: y, x1: x, y1: y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawing) return;
    const { x, y } = toRel(e.clientX, e.clientY);
    setDrawing({ ...drawing, x1: x, y1: y });
  };
  const handleMouseUp = () => {
    if (!drawing) return;
    const xMin = Math.min(drawing.x0, drawing.x1);
    const yMin = Math.min(drawing.y0, drawing.y1);
    const w = Math.abs(drawing.x1 - drawing.x0);
    const h = Math.abs(drawing.y1 - drawing.y0);
    if (w < 0.04 || h < 0.02) {
      // Clique sem arrastar — usa default em torno do clique
      setCampo({ page: pageNum, xRel: drawing.x0, yRel: drawing.y0, wRel: 0.3, hRel: 0.06 });
    } else {
      setCampo({ page: pageNum, xRel: xMin, yRel: yMin, wRel: w, hRel: h });
    }
    setDrawing(null);
  };

  // Reset campo se mudou de página
  useEffect(() => {
    if (campo && campo.page !== pageNum) setCampo(null);
  }, [pageNum]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!campo) return;
    setSaving(true);
    try {
      await onSave(campo);
    } finally {
      setSaving(false);
    }
  };

  // Display do retângulo (em px) — pageDims é o tamanho real renderizado
  const previewBox = (() => {
    const c = drawing
      ? { xRel: Math.min(drawing.x0, drawing.x1), yRel: Math.min(drawing.y0, drawing.y1),
          wRel: Math.abs(drawing.x1 - drawing.x0), hRel: Math.abs(drawing.y1 - drawing.y0) }
      : campo && campo.page === pageNum ? campo : null;
    if (!c) return null;
    const r = wrapperRef.current?.getBoundingClientRect();
    if (!r) return null;
    return {
      left: c.xRel * r.width,
      top: c.yRel * r.height,
      width: c.wRel * r.width,
      height: c.hRel * r.height,
    };
  })();

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 600,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        height: 56, background: '#0d1f35', borderBottom: '1px solid #1e3550',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', flexShrink: 0,
      }}>
        <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: 14 }}>
          Marcar posição da assinatura
        </span>
        <button onClick={onClose}
          style={{ background: 'transparent', border: '1px solid #1e3550',
                   borderRadius: 8, color: '#94a3b8', padding: '6px 10px',
                   cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <X size={16} />
        </button>
      </div>

      {/* Toolbar */}
      <div style={{
        background: '#112040', borderBottom: '1px solid #1e3550',
        padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12,
        color: '#f8fafc', fontSize: 13,
      }}>
        <button
          disabled={pageNum <= 1}
          onClick={() => setPageNum((p: number) => Math.max(1, p - 1))}
          style={{ background: 'transparent', border: '1px solid #1e3550',
                   borderRadius: 6, color: '#94a3b8', padding: '4px 8px',
                   cursor: pageNum <= 1 ? 'not-allowed' : 'pointer', opacity: pageNum <= 1 ? 0.4 : 1 }}>
          <ChevronLeft size={14} />
        </button>
        <span>Página {pageNum} de {numPages || '…'}</span>
        <button
          disabled={pageNum >= numPages}
          onClick={() => setPageNum((p: number) => Math.min(numPages, p + 1))}
          style={{ background: 'transparent', border: '1px solid #1e3550',
                   borderRadius: 6, color: '#94a3b8', padding: '4px 8px',
                   cursor: pageNum >= numPages ? 'not-allowed' : 'pointer', opacity: pageNum >= numPages ? 0.4 : 1 }}>
          <ChevronRight size={14} />
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ color: '#94a3b8', fontSize: 12 }}>
          Clique e arraste sobre a página para desenhar o retângulo onde o cliente assina.
        </span>
        {campo && (
          <button onClick={() => setCampo(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 6,
                     background: 'transparent', border: '1px solid #1e3550',
                     borderRadius: 6, color: '#94a3b8', padding: '4px 10px',
                     fontSize: 12, cursor: 'pointer' }}>
            <RotateCcw size={12} /> Redesenhar
          </button>
        )}
        <button onClick={handleSave} disabled={!campo || saving}
          style={{ display: 'flex', alignItems: 'center', gap: 6,
                   background: campo ? 'linear-gradient(135deg, #22c55e, #16a34a)' : '#1e3550',
                   border: 'none', borderRadius: 6, color: 'white',
                   padding: '6px 14px', fontSize: 13, fontWeight: 700,
                   cursor: !campo || saving ? 'not-allowed' : 'pointer',
                   opacity: !campo ? 0.5 : 1 }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Salvar posição
        </button>
      </div>

      {/* Viewer */}
      <div style={{
        flex: 1, overflow: 'auto', display: 'flex',
        justifyContent: 'center', alignItems: 'flex-start',
        padding: 24, background: '#0A1628',
      }}>
        <div
          ref={wrapperRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setDrawing(null)}
          style={{
            position: 'relative', display: 'inline-block',
            cursor: 'crosshair', userSelect: 'none',
            boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          }}>
          <Document
            file={contratoPdfUrl}
            onLoadSuccess={(pdf) => { setLoadError(null); onLoadSuccess(pdf); }}
            onLoadError={(err) => setLoadError(err.message || 'Erro ao carregar o PDF')}
            loading={<div style={{ color: '#94a3b8', padding: 40, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Loader2 size={20} className="animate-spin" /> Carregando PDF…
            </div>}
            error={
              <div style={{ color: '#f87171', padding: 40, textAlign: 'center', maxWidth: 400 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>❌ Não foi possível carregar o PDF</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{loadError || 'Verifique se o arquivo foi enviado corretamente.'}</div>
              </div>
            }
          >
            <Page
              pageNumber={pageNum}
              onRenderSuccess={onPageRenderSuccess}
              width={Math.min(window.innerWidth - 80, 800)}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>

          {previewBox && (
            <div style={{
              position: 'absolute',
              left: previewBox.left, top: previewBox.top,
              width: previewBox.width, height: previewBox.height,
              border: '2px dashed #22c55e',
              background: 'rgba(34,197,94,0.18)',
              pointerEvents: 'none',
            }}>
              <div style={{
                position: 'absolute', top: -22, left: 0,
                background: '#22c55e', color: 'white',
                padding: '2px 6px', fontSize: 10, fontWeight: 700,
                borderRadius: 4,
              }}>
                ✍️ Assinatura aqui
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContratoSignatureFieldEditor;
