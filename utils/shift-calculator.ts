import { TimeEntry } from '../types';

// ─── Turno de Trabalho ────────────────────────────────────────────────────────
// Um turno é definido pelo conjunto de registros pertencentes ao MESMO DIA
// CALENDÁRIO do registro "entry" que o inicia.

export interface Turno {
  /** Data do entry que iniciou o turno — "YYYY-MM-DD" */
  data: string;
  entry: TimeEntry | null;
  lunchStart: TimeEntry | null;
  lunchEnd: TimeEntry | null;
  exit: TimeEntry | null;
  /**
   * completo    — entry + lunch_start + lunch_end + exit no mesmo dia
   * sem_almoco  — entry + exit (sem registros de almoço)
   * incompleto  — lunch_start ou lunch_end ausente mas exit existe
   * sem_saida   — entry existe mas exit está ausente
   */
  status: 'completo' | 'sem_almoco' | 'incompleto' | 'sem_saida';
  /**
   * Duração bruta do turno em minutos (exit − entry).
   * null → turno sem exit OU duração > 16h (inconsistente).
   */
  duracaoTotalMinutos: number | null;
  /**
   * Duração de trabalho líquida (descontado almoço), em minutos.
   * null quando duracaoTotalMinutos é null.
   */
  duracaoTrabalhoMinutos: number | null;
  /** Duração do intervalo de almoço em minutos. null se não registrado. */
  intervaloAlmocoMinutos: number | null;
  /** true quando a duração calculada ultrapassou o limite de segurança de 16h */
  inconsistente: boolean;
}

// ─── Limite de segurança ──────────────────────────────────────────────────────
// Turnos com duração bruta > 16h são marcados como inconsistentes (provavelmente
// um exit de outro dia foi associado a um entry antigo).
const MAX_SHIFT_MINUTES = 16 * 60; // 960 minutos

/**
 * Calcula os turnos de trabalho a partir de uma lista de TimeEntries.
 *
 * Regra principal: cada registro `type === "entry"` inicia UM turno.
 * Todos os demais registros (lunch_start, lunch_end, exit) que pertencem ao
 * MESMO DIA CALENDÁRIO desse entry são associados a ele.
 *
 * @param entries - Array de TimeEntry (qualquer ordem, qualquer período).
 * @returns Array de Turno ordenado por data crescente (um por entry encontrado).
 */
export function calcularTurnos(entries: TimeEntry[]): Turno[] {
  // 1. Descartar registros soft-deleted e ordenar por timestamp crescente
  const sorted = [...entries]
    .filter((e) => !e.excluido)
    .sort(
      (a, b) => a.timestamp.toDate().getTime() - b.timestamp.toDate().getTime()
    );

  const turnos: Turno[] = [];

  for (const e of sorted) {
    if (e.type !== 'entry') continue;

    // 2. Determinar o dia calendário deste entry
    const dataDoTurno = toDateStr(e.timestamp.toDate());
    const inicioDoDia = new Date(dataDoTurno + 'T00:00:00');
    const fimDoDia = new Date(dataDoTurno + 'T23:59:59.999');

    // 3. Coletar APENAS registros cujo timestamp cabe nesse mesmo dia
    const registrosDoDia = sorted.filter((r) => {
      const t = r.timestamp.toDate();
      return t >= inicioDoDia && t <= fimDoDia;
    });

    const lunchStart =
      registrosDoDia.find((r) => r.type === 'lunch_start') ?? null;
    const lunchEnd =
      registrosDoDia.find((r) => r.type === 'lunch_end') ?? null;
    const exit = registrosDoDia.find((r) => r.type === 'exit') ?? null;

    // 4. Calcular durações
    let duracaoTotal: number | null = null;
    let duracaoTrabalho: number | null = null;
    let intervaloAlmoco: number | null = null;
    let inconsistente = false;

    if (exit) {
      const rawMinutes = Math.round(
        (exit.timestamp.toDate().getTime() - e.timestamp.toDate().getTime()) /
          60000
      );

      if (rawMinutes > MAX_SHIFT_MINUTES) {
        // Duração improvável — provavelmente exit de outro dia contaminando
        inconsistente = true;
        duracaoTotal = null;
      } else {
        duracaoTotal = rawMinutes;
      }
    }

    if (lunchStart && lunchEnd) {
      intervaloAlmoco = Math.round(
        (lunchEnd.timestamp.toDate().getTime() -
          lunchStart.timestamp.toDate().getTime()) /
          60000
      );
      if (duracaoTotal !== null) {
        duracaoTrabalho = Math.max(0, duracaoTotal - intervaloAlmoco);
      }
    } else if (duracaoTotal !== null) {
      duracaoTrabalho = duracaoTotal;
    }

    // 5. Determinar status
    let status: Turno['status'];
    if (!exit) {
      status = 'sem_saida';
    } else if (!lunchStart && !lunchEnd) {
      status = 'sem_almoco';
    } else if (!lunchStart || !lunchEnd) {
      status = 'incompleto';
    } else {
      status = 'completo';
    }

    turnos.push({
      data: dataDoTurno,
      entry: e,
      lunchStart,
      lunchEnd,
      exit,
      status,
      duracaoTotalMinutos: duracaoTotal,
      duracaoTrabalhoMinutos: duracaoTrabalho,
      intervaloAlmocoMinutos: intervaloAlmoco,
      inconsistente,
    });
  }

  return turnos;
}

/** Converte um Date para "YYYY-MM-DD" no fuso local da máquina */
export function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Formata minutos em "Xh YYm" */
export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}
