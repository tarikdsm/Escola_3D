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
 * Modo de câmera/interação (modelo mouse-first, sem teclado de movimento):
 * - 'voo': pointer lock no canvas; mouse = direção da câmera, LMB/RMB
 *   segurados = frente/trás, scroll = zoom. Ao carregar a página o modo voo
 *   já vem ARMADO (sem trava, por política do browser): o primeiro clique no
 *   canvas trava o ponteiro — ver src/player/VooControls.tsx.
 * - 'livre': mouse solto (ESC ou perda do pointer lock); a câmera fica fixa
 *   e o cursor interage: clique em personagem = possuir, clique no vazio =
 *   voltar a voar — ver src/characters/picking.ts.
 * - 'possuido': 3ª pessoa controlando o NPC de índice `possuidoIdx` (pointer
 *   lock de novo) — ver src/player/PossuidoControls.tsx e possessao.ts.
 */
export type ModoCam = 'voo' | 'livre' | 'possuido';

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
  /** Modo de câmera/interação atual (ver ModoCam acima). Inicia em 'voo' (armado). */
  modoCam: ModoCam;
  /**
   * Índice estável (ROSTER/SIM) do NPC possuído, ou null. Permanece
   * preenchido no modo 'livre' após um ESC estando possuído (o NPC para mas
   * CONTINUA possuído até ser solto — chip do HUD ou clique no vazio).
   * A simulação pula este índice (ver step.ts) — SIM.pos/facing/anim dele
   * são dirigidos pelo controlador em src/player/.
   */
  possuidoIdx: number | null;
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
  /**
   * Painéis da UI recolhidos em chip (id → true). Ids vigentes: 'hud',
   * 'pinceis' e 'tempo' (TimeSlider). No arranque todos vêm RECOLHIDOS em
   * dispositivos touch (pointer coarse) e expandidos no desktop — ver a
   * inicialização em state/useSchoolStore.ts.
   */
  paineisOcultos: Record<string, boolean>;

  // --- Actions ---
  setVelocidade: (v: Velocidade) => void;
  toggleSom: () => void;
  /**
   * Vai para o modo voo (clique no vazio com o mouse livre). NÃO mexe na
   * posse — quem chama decide (src/player/possessao.ts libera o NPC antes).
   * A trava do ponteiro é pedida no próprio gesto do usuário (click).
   */
  entrarVoo: () => void;
  /**
   * Vai para o modo livre (ESC / perda do pointer lock): câmera fixa, cursor
   * interage. Preserva `possuidoIdx` (ESC estando possuído só pausa o
   * controle — o NPC continua possuído).
   */
  entrarLivre: () => void;
  /**
   * Possui o NPC de índice `idx` (clique em personagem no modo livre):
   * modo 'possuido' + `possuidoIdx`. Os efeitos na simulação (liberar
   * lugar/fila/conversa, atividade) ficam em src/player/possessao.ts.
   */
  possuir: (idx: number) => void;
  /**
   * Limpa a posse e fica no modo livre (botão "Soltar" do HUD). Para voar em
   * seguida, chame `entrarVoo` (é o que o clique no vazio faz).
   */
  soltarPossuido: () => void;
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
  /** Recolhe/expande um painel da UI ('hud' | 'pinceis' | 'tempo'). */
  togglePainel: (id: string) => void;
}
