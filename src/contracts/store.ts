/**
 * store.ts — CONTRATO do estado global (Zustand).
 *
 * Guarda apenas estado "grosso" (baixa frequência: cliques, trocas de período,
 * atualizações ~1 Hz). Dados por frame (posições/animação dos 79 personagens)
 * NÃO passam por aqui — ficam em simBuffer.ts (SIM/playerState).
 *
 * A implementação fica em `src/state/useSchoolStore.ts`.
 */

import type { Andar, Periodo } from './types';

/** Multiplicador da escala de tempo (1×, 2× ou 4× sobre ESCALA_TEMPO). */
export type Velocidade = 1 | 2 | 4;

/** Modo da câmera: a pé na escola ou vista aérea. */
export type ModoCamera = 'andar' | 'aereo';

export interface SchoolState {
  /** Relógio do jogo em minutos desde 00:00 (inicia em 7·60 = 7h00). */
  clockMin: number;
  /** Período vigente (derivado de clockMin via ROTINA). */
  periodo: Periodo;
  /** Multiplicador de velocidade da simulação. */
  velocidade: Velocidade;
  /** Som ambiente/efeitos ligado. */
  somLigado: boolean;
  /** Modo da câmera atual. */
  modoCamera: ModoCamera;
  /** Andar exibido no minimapa. */
  andarMinimap: Andar;
  /** Id do personagem selecionado (painel de detalhes), ou null. */
  selecionadoId: string | null;
  /**
   * Mapa id-personagem → texto PT-BR do que está fazendo agora
   * (ex.: 'Assistindo à aula de Matemática'), atualizado ~1 Hz pela simulação.
   */
  atividades: Record<string, string>;
  /** Portão da rua aberto/fechado (visual e regra de spawn dos alunos). */
  portaoAberto: boolean;

  // --- Actions ---
  setVelocidade: (v: Velocidade) => void;
  toggleSom: () => void;
  toggleModoCamera: () => void;
  setAndarMinimap: (a: Andar) => void;
  selecionar: (id: string | null) => void;
  /**
   * Avança o relógio em `minutos` (minutos de JOGO), sem passar de
   * HORA_FECHAMENTO. Atualiza `periodo` e emite os eventos 'sino'/'periodo'
   * (events.ts) ao cruzar marcos da ROTINA.
   */
  tickClock: (minutos: number) => void;
  /** Aplica em lote as descrições de atividade (~1 Hz pela simulação). */
  setAtividades: (batch: Record<string, string>) => void;
  setPortaoAberto: (aberto: boolean) => void;
}
