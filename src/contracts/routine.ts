/**
 * routine.ts — ROTINA DIÁRIA da escola (dados estáticos da jornada).
 * Horários em minutos desde 00:00. O relógio do jogo roda de 7h00 a 23h00
 * (wrap diário 23h → 7h, ver CONST.HORA_ABERTURA/HORA_FECHAMENTO).
 *
 * EXPANSÃO (ver docs/SPEC.md): 3 turnos — manhã, tarde e noite — cada um
 * repetindo o ciclo CHEGADA → AULA_1 → RECREIO → AULA_2 → SAÍDA. Entre a
 * SAÍDA de um turno e a CHEGADA do seguinte, a turma fica fora do campus
 * (pontos PORTARIA.spawnRua); na CHEGADA seguinte o MESMO conjunto de
 * agentes re-entra (buffers reutilizados, mesma aparência).
 */

import type { HorarioRotina, Periodo } from './types';

/** Turnos do dia letivo. */
export type Turno = 'manha' | 'tarde' | 'noite';

/** Marco da rotina diária com o turno ao qual pertence. */
export interface MarcoRotina extends HorarioRotina {
  turno: Turno;
}

/**
 * Marcos do dia letivo, em ordem cronológica (3 turnos × 5 fases).
 * A fase de saída mantém o id estável 'ALMOCO_SAIDA' (tipo Periodo de
 * types.ts) — na prática é a SAÍDA do turno (almoço só faz sentido no
 * turno da manhã, mas o nome foi preservado p/ não quebrar consumidores).
 */
export const ROTINA: MarcoRotina[] = [
  // --- MANHÃ (7h–12h) ---
  { periodo: 'CHEGADA', inicioMin: 7 * 60, sino: false, turno: 'manha' }, // 7h00 — portão abre, turma entra
  { periodo: 'AULA_1', inicioMin: 7 * 60 + 30, sino: true, turno: 'manha' }, // 7h30 — 1º tempo
  { periodo: 'RECREIO', inicioMin: 9 * 60 + 30, sino: true, turno: 'manha' }, // 9h30 — recreio
  { periodo: 'AULA_2', inicioMin: 10 * 60, sino: true, turno: 'manha' }, // 10h00 — 2º tempo
  { periodo: 'ALMOCO_SAIDA', inicioMin: 11 * 60 + 30, sino: true, turno: 'manha' }, // 11h30 — saída
  // --- TARDE (13h–18h) ---
  { periodo: 'CHEGADA', inicioMin: 13 * 60, sino: false, turno: 'tarde' }, // 13h00 — turma da tarde entra
  { periodo: 'AULA_1', inicioMin: 13 * 60 + 30, sino: true, turno: 'tarde' }, // 13h30 — 1º tempo
  { periodo: 'RECREIO', inicioMin: 15 * 60 + 30, sino: true, turno: 'tarde' }, // 15h30 — recreio
  { periodo: 'AULA_2', inicioMin: 16 * 60, sino: true, turno: 'tarde' }, // 16h00 — 2º tempo
  { periodo: 'ALMOCO_SAIDA', inicioMin: 17 * 60 + 30, sino: true, turno: 'tarde' }, // 17h30 — saída
  // --- NOITE (19h–23h) ---
  { periodo: 'CHEGADA', inicioMin: 19 * 60, sino: false, turno: 'noite' }, // 19h00 — turma da noite entra
  { periodo: 'AULA_1', inicioMin: 19 * 60 + 20, sino: true, turno: 'noite' }, // 19h20 — 1º tempo
  { periodo: 'RECREIO', inicioMin: 21 * 60, sino: true, turno: 'noite' }, // 21h00 — recreio
  { periodo: 'AULA_2', inicioMin: 21 * 60 + 20, sino: true, turno: 'noite' }, // 21h20 — 2º tempo
  { periodo: 'ALMOCO_SAIDA', inicioMin: 22 * 60 + 50, sino: true, turno: 'noite' }, // 22h50 — saída (fecha 23h)
];

/**
 * Marco vigente num dado minuto do dia (último marco ≤ min).
 * Antes do 1º marco do dia (madrugada, fora do relógio do jogo), devolve
 * o marco da CHEGADA da manhã — o relógio do jogo nunca fica aí (wrap 23h→7h).
 */
export function marcoPara(min: number): MarcoRotina {
  let atual: MarcoRotina = ROTINA[0];
  for (const marco of ROTINA) {
    if (marco.inicioMin <= min) atual = marco;
    else break;
  }
  return atual;
}

/** Período (fase) vigente num dado minuto do dia. */
export function periodoPara(min: number): Periodo {
  return marcoPara(min).periodo;
}

/** Turno vigente num dado minuto do dia ('manha' | 'tarde' | 'noite'). */
export function turnoPara(min: number): Turno {
  return marcoPara(min).turno;
}

/** Próximo marco COM sino depois de `min` (ou null se não houver mais no dia). */
export function proximoSino(min: number): MarcoRotina | null {
  for (const marco of ROTINA) {
    if (marco.sino && marco.inicioMin > min) return marco;
  }
  return null;
}
