/**
 * rng.ts — Gerador pseudo-aleatório com semente (mulberry32).
 *
 * A simulação usa um RNG próprio (e NÃO Math.random) para ter
 * determinismo leve: mesma semente + mesma sequência de frames →
 * mesmas decisões de comportamento. Facilita depuração e testes.
 */

/** Função geradora: retorna float em [0, 1). */
export type Rng = () => number;

/** mulberry32 clássico: rápido, sem alocação, boa distribuição. */
export function mulberry32(semente: number): Rng {
  let a = semente >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Float uniforme em [min, max). */
export function faixa(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Inteiro uniforme em [min, max] (ambos inclusos). */
export function inteiro(rng: Rng, min: number, max: number): number {
  return Math.floor(faixa(rng, min, max + 1));
}

/** true com probabilidade p. */
export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}
