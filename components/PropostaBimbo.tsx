import React, { useEffect, useState } from 'react';

/**
 * PropostaBimbo — Apresentação HTML standalone da proposta MGR × Bimbo
 * Serve o arquivo MGR_Bimbo_Proposta_v3.html em tela cheia via iframe.
 */
const PropostaBimbo: React.FC = () => {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Tenta carregar o HTML do arquivo estático servido pelo Vite/servidor
    fetch('/MGR_Bimbo_Proposta_v3.html')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        setHtml(text);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Erro ao carregar proposta:', err);
        setError('Não foi possível carregar a proposta. Verifique se o arquivo existe na raiz do projeto.');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#040e1a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#D4792A] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 text-sm font-medium tracking-wider uppercase">
            Carregando Proposta...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#040e1a] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="text-5xl mb-4">📄</div>
          <h1 className="text-white text-xl font-bold mb-2">Proposta não encontrada</h1>
          <p className="text-white/50 text-sm leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <iframe
      srcDoc={html}
      title="MGR – Proposta Bimbo | Câmara Frigorífica 2026"
      className="fixed inset-0 w-full h-full border-0"
      style={{ display: 'block', width: '100vw', height: '100vh', border: 'none' }}
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
    />
  );
};

export default PropostaBimbo;
