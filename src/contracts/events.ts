/**
 * events.ts — Pub/sub mínimo e tipado, sem dependências.
 *
 * Eventos:
 * - 'sino': disparado quando o relógio cruza um marco da ROTINA com sino=true
 *   (payload: período que está começando).
 * - 'periodo': disparado quando o período vigente muda (payload: novo período).
 *
 * Uso:
 *   const off = on('sino', (p) => tocarSino());
 *   ...
 *   off(); // cancela a inscrição
 */

import type { Periodo } from './types';

/** Mapa de payloads por evento. */
export interface EventoPayloads {
  sino: Periodo;
  periodo: Periodo;
}

export type NomeEvento = keyof EventoPayloads;
export type CallbackEvento<K extends NomeEvento> = (payload: EventoPayloads[K]) => void;

const ouvintes: { [K in NomeEvento]: Set<CallbackEvento<K>> } = {
  sino: new Set(),
  periodo: new Set(),
};

/** Inscreve um callback; retorna função para cancelar a inscrição. */
export function on<K extends NomeEvento>(evt: K, cb: CallbackEvento<K>): () => void {
  (ouvintes[evt] as Set<CallbackEvento<K>>).add(cb);
  return () => {
    (ouvintes[evt] as Set<CallbackEvento<K>>).delete(cb);
  };
}

/** Dispara um evento para todos os inscritos (síncrono). */
export function emit<K extends NomeEvento>(evt: K, payload: EventoPayloads[K]): void {
  for (const cb of ouvintes[evt] as Set<CallbackEvento<K>>) {
    cb(payload);
  }
}
