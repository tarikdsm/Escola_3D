/**
 * index.ts — BARREL dos contratos: re-exporta toda a superfície pública.
 * Agentes devem importar daqui (ou dos arquivos específicos) — nunca
 * redefinir localmente tipos/dados que já existam nestes módulos.
 */

export * from './types';
export * from './palette';
export * from './layout';
export * from './waypoints';
export * from './routine';
export * from './roster';
export * from './simBuffer';
export * from './store';
export * from './events';
