/**
 * components/LeadForm.tsx — Sprint Projetos v2
 *
 * Formulário PÚBLICO (sem login) para captação de leads via anúncios.
 * Inclui: honeypot anti-bot, rate limiting, sanitização, checkbox LGPD.
 */
import React, { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, PROJECT_TYPES } from '../types';
import { Send, CheckCircle2, Loader2, Snowflake } from 'lucide-react';

// ── Sanitização ──
const sanitize = (input: string): string =>
  input.replace(/[<>]/g, '').replace(/javascript:/gi, '').trim().slice(0, 500);

// ── Rate limiting ──
const COOLDOWN_MS = 60_000;
const LAST_SUBMIT_KEY = 'mgr_lead_last_submit';
const canSubmit = () => {
  const last = localStorage.getItem(LAST_SUBMIT_KEY);
  if (!last) return true;
  return Date.now() - parseInt(last) > COOLDOWN_MS;
};

const LeadForm: React.FC = () => {
  const [nome, setNome] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [tipoProjeto, setTipoProjeto] = useState('');
  const [medidas, setMedidas] = useState('');
  const [finalidade, setFinalidade] = useState('');
  const [localizacao, setLocalizacao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [lgpd, setLgpd] = useState(false);
  const [honeypot, setHoneypot] = useState(''); // campo invisível
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Honeypot
    if (honeypot) { setSent(true); return; }

    // Rate limiting
    if (!canSubmit()) {
      setError('Aguarde um momento antes de enviar novamente.');
      return;
    }

    if (!nome.trim() || !telefone.trim() || !tipoProjeto || !lgpd) {
      setError('Preencha os campos obrigatórios e aceite a política de privacidade.');
      return;
    }

    setSending(true);
    try {
      // Capturar UTMs da URL
      const params = new URLSearchParams(window.location.search);

      await addDoc(collection(db, CollectionName.PROJECT_LEADS), {
        nomeContato: sanitize(nome),
        empresa: sanitize(empresa) || null,
        telefone: sanitize(telefone),
        email: sanitize(email) || null,
        tipoProjetoSlug: tipoProjeto,
        tipoProjetoTexto: PROJECT_TYPES.find((t) => t.slug === tipoProjeto)?.label || tipoProjeto,
        medidasAproximadas: sanitize(medidas) || null,
        finalidade: sanitize(finalidade) || null,
        localizacao: sanitize(localizacao) || null,
        observacoes: sanitize(observacoes) || null,
        origem: 'formulario_site',
        utmSource: params.get('utm_source') || null,
        utmMedium: params.get('utm_medium') || null,
        utmCampaign: params.get('utm_campaign') || null,
        status: 'novo',
        criadoEm: serverTimestamp(),
        userAgent: navigator.userAgent?.slice(0, 200) || null,
      });

      localStorage.setItem(LAST_SUBMIT_KEY, Date.now().toString());
      setSent(true);
    } catch (err) {
      setError('Erro ao enviar. Tente novamente em alguns instantes.');
    } finally {
      setSending(false);
    }
  };

  // ── Tela de sucesso ──
  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Obrigado!</h2>
          <p className="text-gray-500 leading-relaxed">
            Recebemos sua solicitação. Nossa equipe técnica entrará em contato em breve para entender melhor o seu projeto.
          </p>
          <a
            href="/"
            className="inline-block mt-6 px-6 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors"
          >
            Voltar ao Site
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4 py-10">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-8 py-8 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Snowflake className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold">MGR Refrigeração</h1>
              <p className="text-xs text-white/70">Soluções em Refrigeração Industrial</p>
            </div>
          </div>
          <h2 className="text-lg font-bold mt-4">Solicite um Projeto</h2>
          <p className="text-sm text-white/80 mt-1">
            Preencha o formulário abaixo e nossa equipe técnica entrará em contato.
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          {/* Honeypot (invisible to human) */}
          <input
            type="text"
            name="website"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
            tabIndex={-1}
            autoComplete="off"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Nome / Empresa *</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="Seu nome ou razão social"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Empresa (opcional)</label>
              <input
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="Nome da empresa"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Telefone / WhatsApp *</label>
              <input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="(00) 00000-0000"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Tipo de Projeto *</label>
            <select
              value={tipoProjeto}
              onChange={(e) => setTipoProjeto(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              required
            >
              <option value="">Selecione o tipo de projeto...</option>
              {PROJECT_TYPES.map((t) => (
                <option key={t.slug} value={t.slug}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Medidas Aproximadas</label>
              <input
                value={medidas}
                onChange={(e) => setMedidas(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="Ex: 10x8m, 120m²"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Localização / Cidade</label>
              <input
                value={localizacao}
                onChange={(e) => setLocalizacao(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="Ex: Indaiatuba, SP"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Para que vai utilizar?</label>
            <input
              value={finalidade}
              onChange={(e) => setFinalidade(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              placeholder="Ex: Armazenar perecíveis, climatizar ambiente"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Observações</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              placeholder="Informações adicionais sobre o projeto..."
            />
          </div>

          {/* LGPD Consent */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={lgpd}
              onChange={(e) => setLgpd(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-brand-600 rounded"
            />
            <span className="text-xs text-gray-500 leading-relaxed">
              Concordo com a{' '}
              <a href="/privacidade" className="text-brand-600 underline hover:text-brand-700" target="_blank">
                Política de Privacidade
              </a>{' '}
              e autorizo o uso dos meus dados para contato comercial. *
            </span>
          </label>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600">{error}</div>
          )}

          <button
            type="submit"
            disabled={sending || !lgpd}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-600 text-white rounded-xl font-bold text-base hover:bg-brand-700 disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {sending ? 'Enviando...' : 'Solicitar Contato'}
          </button>

          <p className="text-center text-[10px] text-gray-400">
            Seus dados são protegidos conforme a LGPD (Lei 13.709/2018)
          </p>
        </form>
      </div>
    </div>
  );
};

export default LeadForm;
