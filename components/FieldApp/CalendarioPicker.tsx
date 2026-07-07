/**
 * CalendarioPicker — seletor de data em grade de calendário (dark theme).
 * Mostra o mês com dia da semana visível, para facilitar decisões
 * estratégicas de reagendamento (ex: evitar cair num fim de semana).
 * A data é opcional — sempre há um botão "Sem data definida".
 */
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

const WEEK_DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

interface Props {
  value: string;               // ISO 'YYYY-MM-DD' ou ''
  onChange: (iso: string) => void;
  accentClass?: string;        // ex: 'bg-orange-500 border-orange-500'
}

const toISO = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function CalendarioPicker({ value, onChange, accentClass = 'bg-orange-500 border-orange-500' }: Props) {
  const [mesAtual, setMesAtual] = useState(() => {
    const base = value ? new Date(`${value}T12:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const hojeISO = toISO(hoje);

  const dias: (Date | null)[] = [];
  const primeiroDia = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1);
  const ultimoDia   = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0);
  for (let i = 0; i < primeiroDia.getDay(); i++) dias.push(null);
  for (let d = 1; d <= ultimoDia.getDate(); d++) dias.push(new Date(mesAtual.getFullYear(), mesAtual.getMonth(), d));

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3">
      {/* Sem data */}
      <button
        onClick={() => onChange('')}
        className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold mb-3 transition-colors ${
          !value ? `${accentClass} text-white` : 'bg-gray-800 border border-gray-700 text-gray-400'
        }`}
      >
        <X size={12} /> Sem data definida
      </button>

      {/* Navegação de mês */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setMesAtual(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          className="p-1.5 rounded-lg bg-gray-800 active:bg-gray-700">
          <ChevronLeft size={14} className="text-gray-400" />
        </button>
        <span className="text-xs font-bold text-white capitalize">
          {mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={() => setMesAtual(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          className="p-1.5 rounded-lg bg-gray-800 active:bg-gray-700">
          <ChevronRight size={14} className="text-gray-400" />
        </button>
      </div>

      {/* Cabeçalho dos dias da semana */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEK_DAYS.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-bold text-gray-600 py-1">{d}</div>
        ))}
      </div>

      {/* Grade de dias */}
      <div className="grid grid-cols-7 gap-1">
        {dias.map((d, i) => {
          if (!d) return <div key={i} />;
          const iso = toISO(d);
          const isSelected = iso === value;
          const isHoje = iso === hojeISO;
          const isPassado = d < hoje;
          const isFimDeSemana = d.getDay() === 0 || d.getDay() === 6;
          return (
            <button
              key={i}
              onClick={() => onChange(iso)}
              className={`aspect-square rounded-lg text-xs font-semibold flex items-center justify-center transition-colors ${
                isSelected
                  ? `${accentClass} text-white`
                  : isHoje
                  ? 'border border-emerald-500/50 text-emerald-400'
                  : isPassado
                  ? 'text-gray-700'
                  : isFimDeSemana
                  ? 'text-orange-400/70 bg-gray-800/40'
                  : 'text-gray-300 bg-gray-800/40 active:bg-gray-700'
              }`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      {value && (
        <p className="text-[11px] text-gray-400 text-center mt-2.5">
          {new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
        </p>
      )}
    </div>
  );
}
