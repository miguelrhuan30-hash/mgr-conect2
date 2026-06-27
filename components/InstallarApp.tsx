import React, { useState } from 'react';
import {
  Download, Smartphone, MapPin, Camera, Bell, Mic, Phone, Volume2,
  CheckCircle2, ChevronRight, Shield, RefreshCcw, ExternalLink,
} from 'lucide-react';

const APK_URL =
  'https://firebasestorage.googleapis.com/v0/b/mgr-conect2.firebasestorage.app/o/apk%2Fapp-debug.apk?alt=media';

const STEPS = [
  {
    n: '1',
    title: 'Toque em "Baixar APK"',
    desc: 'O download começa automaticamente. Pode levar alguns segundos dependendo da conexão.',
  },
  {
    n: '2',
    title: 'Abra o arquivo baixado',
    desc: 'Vá nas Notificações e toque em mgr-campo.apk para iniciar a instalação.',
  },
  {
    n: '3',
    title: 'Permita a instalação',
    desc: 'O Android pedirá para habilitar "Fontes desconhecidas". Toque em Configurações → ative "Permitir desta fonte" → volte e confirme.',
  },
  {
    n: '4',
    title: 'Abra e faça login',
    desc: 'Use o mesmo e-mail e senha do sistema MGR. O app atualiza automaticamente a cada abertura — sem precisar reinstalar.',
  },
];

const PERMS = [
  { icon: MapPin,  label: 'Localização contínua', desc: 'Rastreio em tempo real em campo' },
  { icon: Camera,  label: 'Câmera',               desc: 'Fotos de execução nas O.S.' },
  { icon: Bell,    label: 'Notificações',          desc: 'Alertas de nova O.S. e ponto' },
  { icon: Mic,     label: 'Microfone',             desc: 'Notas de voz nas ordens' },
  { icon: Phone,   label: 'Chamadas',              desc: 'Ligar para o cliente direto da O.S.' },
  { icon: Volume2, label: 'Áudio',                 desc: 'Sons de alertas e notificações' },
];

export default function InstallarApp() {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  function handleDownload() {
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      setDownloaded(true);
    }, 1500);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        {/* Hero */}
        <div className="flex flex-col items-center text-center pt-4 pb-2">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center mb-5 shadow-lg shadow-emerald-900/40">
            <Smartphone size={38} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight mb-2">MGR Campo</h1>
          <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
            App para equipes de campo — ordens de serviço, ponto eletrônico e rastreio em tempo real.
          </p>
        </div>

        {/* Botão download */}
        <div className="flex flex-col items-center gap-3">
          <a
            href={APK_URL}
            download="mgr-campo.apk"
            onClick={handleDownload}
            className={`flex items-center justify-center gap-3 w-full max-w-sm py-4 px-6 rounded-2xl font-bold text-base transition-all active:scale-95 ${
              downloaded
                ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-400'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-900/40'
            }`}
          >
            {downloading ? (
              <>
                <RefreshCcw size={20} className="animate-spin" />
                Baixando…
              </>
            ) : downloaded ? (
              <>
                <CheckCircle2 size={20} />
                Download iniciado!
              </>
            ) : (
              <>
                <Download size={20} />
                Baixar APK — MGR Campo
              </>
            )}
          </a>

          <div className="flex items-center gap-3 text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <Shield size={11} className="text-emerald-700" />
              Android 8.0+
            </span>
            <span>·</span>
            <span>v1.0 · ~25 MB</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <RefreshCcw size={11} className="text-blue-700" />
              Live Update
            </span>
          </div>
        </div>

        {/* Aviso sideload */}
        <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-4 flex gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center">
              <span className="text-amber-400 text-sm font-black">!</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-300 mb-1">Instalação fora da Play Store</p>
            <p className="text-xs text-amber-600 leading-relaxed">
              O Android solicitará permissão para instalar apps externos. É um procedimento seguro e necessário.
              Siga o passo a passo abaixo.
            </p>
          </div>
        </div>

        {/* Passo a passo */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Como instalar</h2>
          </div>
          <div className="divide-y divide-gray-800/60">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-start gap-4 px-5 py-4">
                <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-black text-emerald-400">{s.n}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white mb-0.5">{s.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Permissões */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Permissões solicitadas</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y divide-gray-800/60 sm:divide-y-0">
            {PERMS.map((p, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 px-5 py-3.5 ${
                  i < PERMS.length - 2 ? 'sm:border-b sm:border-gray-800/60' : ''
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
                  <p.icon size={15} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{p.label}</p>
                  <p className="text-[11px] text-gray-600">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Update info */}
        <div className="bg-blue-500/8 border border-blue-500/15 rounded-2xl p-4 flex gap-3 items-start">
          <RefreshCcw size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-300 mb-1">Atualizações automáticas</p>
            <p className="text-xs text-blue-600 leading-relaxed">
              O app usa <strong className="text-blue-500">Live Update</strong> — toda vez que a equipe de TI lançar uma nova versão,
              o app atualiza sozinho na próxima abertura. Não precisa reinstalar.
            </p>
          </div>
        </div>

        {/* Suporte */}
        <div className="text-center pb-4">
          <p className="text-xs text-gray-600">
            Problemas? Contate o gestor ou acesse o sistema pelo navegador em{' '}
            <a
              href="https://mgr-conect2.web.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-500 hover:text-emerald-400 underline"
            >
              mgr-conect2.web.app
              <ExternalLink size={10} className="inline ml-0.5" />
            </a>
          </p>
        </div>

      </div>
    </div>
  );
}
