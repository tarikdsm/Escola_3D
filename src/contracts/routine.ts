/**
 * routine.ts — ROTINA DIÁRIA da escola (dados estáticos da jornada).
 * Horários em minutos desde 00:00. O relógio do jogo roda de 7h00 a 12h00.
 */

import type { HorarioRotina, Periodo } from './types';

/** Marcos do dia letivo, em ordem cronológica. */
export const ROTINA: HorarioRotina[] = [
  { periodo: 'CHEGADA', inicioMin: 7 * 60, sino: false }, // 7h00 — portão abre, alunos chegam
  { periodo: 'AULA_1', inicioMin: 7 * 60 + 30, sino: true }, // 7h30 — 1º tempo
  { periodo: 'RECREIO', inicioMin: 9 * 60 + 30, sino: true }, // 9h30 — recreio
  { periodo: 'AULA_2', inicioMin: 10 * 60, sino: true }, // 10h00 — 2º tempo
  { periodo: 'ALMOCO_SAIDA', inicioMin: 11 * 60 + 30, sino: true }, // 11h30 — almoço/saída
];

/** Período vigente num dado minuto do dia (último marco ≤ min). */
export function periodoPara(min: number): Periodo {
  let atual: Periodo = ROTINA[0].periodo;
  for (const marco of ROTINA) {
    if (marco.inicioMin <= min) atual = marco.periodo;
    else break;
  }
  return atual;
}

/** Próximo marco COM sino depois de `min` (ou null se não houver mais no dia). */
export function proximoSino(min: number): HorarioRotina | null {
  for (const marco of ROTINA) {
    if (marco.sino && marco.inicioMin > min) return marco;
  }
  return null;
}
