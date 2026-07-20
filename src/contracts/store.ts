/**
 * store.ts — CONTRATO do estado global (Zustand).
 *
 * Guarda apenas estado "grosso" (baixa frequência: cliques, trocas de período,
 * atualizações ~1 Hz). Dados por frame (posições/animação dos 712 personagens)
 * NÃO passam por aqui — ficam em simBuffer.ts (SIM/playerState).
 *
 * A implementação fica em `src/state/useSchoolStore.ts`.
 */

import type { Periodo } from './types';
import type { Turno } from './routine';

/** Multiplicador da escala de tempo (1×, 2× ou 4× sobre ESCALA_TEMPO). */
export type Velocidade = 1 | 2 | 4;

/**
 * Modo da câmera: a pé na escola, vista aérea ou voo livre.
 * ('voar' incluído neste contrato: voo sem colisão nem chão, alternado pela
 * tecla F — ver PlayerRig.tsx/FlyControls.tsx. O retorno do voo usa
 * `modoAnterior`.)
 */
export type ModoCamera = 'andar' | 'aereo' | 'voar';

export interface SchoolState {
  /** Relógio do jogo em minutos desde 00:00 (inicia em 7·60 = 7h00). */
  clockMin: number;
  /** Período vigente (derivado de clockMin via ROTINA). */
  periodo: Periodo;
  /** Turno vigente ('manha' | 'tarde' | 'noite'), derivado de clockMin via turnoPara. */
  turno: Turno;
  /** Multiplicador de velocidade da simulação. */
  velocidade: Velocidade;
  /** Som ambiente/efeitos ligado. */
  somLigado: boolean;
  /** Modo da câmera atual. */
  modoCamera: ModoCamera;
  /**
   * Modo para o qual se volta ao sair do voo (tecla F ou Tab durante o voo).
   * Nunca é 'voar'; inicia em 'aereo'.
   */
  modoAnterior: 'andar' | 'aereo';
  /** Id do personagem selecionado (painel de detalhes), ou null. */
  selecionadoId: string | null;
  /**
   * Mapa id-personagem → texto PT-BR do que está fazendo agora
   * (ex.: 'Assistindo à aula de Matemática'), atualizado ~1 Hz pela simulação.
   */
  atividades: Record<string, string>;
  /** Portão da rua aberto/fechado (visual e regra de spawn dos alunos). */
  portaoAberto: boolean;
  /**
   * Modo dos pincéis de quadro: false = descartáveis ("Sem Allcanci"),
   * true = recarga na máquina Fill ("Com Allcanci"). Espelhado no módulo
   * `simulation/pinceis.ts` (setComAllcanci), que a simulação lê.
   */
  comAllcanci: boolean;
  /**
   * true durante uma VIAGEM NO TEMPO (slider do rodapé): o tick normal do
   * relógio é substituído pelos passos de perseguição (ver
   * simulation/viagemTempo.ts e o hook em step.ts) e o som do sino fica mudo.
   */
  viajando: boolean;
  /** Minuto-alvo da viagem em curso (7·60–23·60), ou null fora de viagem. */
  minutoAlvoViagem: number | null;

  // --- Actions ---
  setVelocidade: (v: Velocidade) => void;
  toggleSom: () => void;
  /**
   * Tab: se estiver voando, sai do voo para `modoAnterior`; senão alterna
   * 'andar' ↔ 'aereo'.
   */
  toggleModoCamera: () => void;
  /**
   * Tecla F: se estiver voando, volta a `modoAnterior`; senão grava o modo
   * atual em `modoAnterior` e entra em 'voar'.
   */
  toggleVoo: () => void;
  /** Alterna Sem/Com Allcanci, espelhando a escolha em simulation/pinceis.ts. */
  toggleAllcanci: () => void;
  /** Repõe o estoque do almoxarifado (64 de cada cor) — delega a simulation/pinceis.ts. */
  reporEstoque: () => void;
  selecionar: (id: string | null) => void;
  /**
   * Avança o relógio em `minutos` (minutos de JOGO), sem passar de
   * HORA_FECHAMENTO. Atualiza `periodo` e `turno` e emite os eventos
   * 'sino'/'periodo' (events.ts) ao cruzar marcos da ROTINA.
   */
  tickClock: (minutos: number) => void;
  /** Aplica em lote as descrições de atividade (~1 Hz pela simulação). */
  setAtividades: (batch: Record<string, string>) => void;
  setPortaoAberto: (aberto: boolean) => void;
  /**
   * Inicia (ou redefine, se já estiver viajando) uma viagem no tempo para
   * `minuto` (clamp 7h00–23h00). Futuro: perseguição em passos grossos;
   * passado: reset do dia (7h) + perseguição. Delega a
   * simulation/viagemTempo.ts (estado) e ao hook em step.ts (execução).
   */
  viajarPara: (minuto: number) => void;
  /**
   * Cancela a viagem em curso: o relógio fica onde estiver e retoma o tick
   * normal no próximo frame.
   */
  cancelarViagem: () => void;
}
