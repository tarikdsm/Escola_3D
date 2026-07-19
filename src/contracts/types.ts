/**
 * types.ts — Tipos fundamentais compartilhados por TODOS os agentes.
 *
 * Convenções globais do projeto:
 * - Unidade = metros. Eixo Y para cima (Y-up). Origem (0,0,0) no centro do pátio.
 * - Piso térreo em y=0, laje intermediária em y=3 (pé-direito de 3 m), telhado acima de y=6.
 * - `Andar` 0 = térreo, 1 = piso superior (base em y=3).
 * - Comentários e strings voltadas ao usuário em PT-BR; identificadores em inglês.
 */

/** Períodos do dia letivo (ver routine.ts para os horários). */
export type Periodo = 'CHEGADA' | 'AULA_1' | 'RECREIO' | 'AULA_2' | 'ALMOCO_SAIDA';

/** Papéis dos personagens na escola. */
export type Papel =
  | 'DIRETORA'
  | 'SECRETARIO'
  | 'PROFESSOR'
  | 'ALUNO'
  | 'COZINHEIRA'
  | 'FAXINEIRO'
  | 'PORTEIRO';

/**
 * Sexo do personagem ('M' | 'F').
 * EDIÇÃO DE CONTRATO AUTORIZADA (melhoria de realismo dos NPCs): usado pelo
 * rig corporal (src/characters/rig.ts) para proporções, detalhePeitoF, saia
 * e estilos de cabelo. Não afeta a simulação.
 */
export type Sexo = 'M' | 'F';

/**
 * Estados de animação dos personagens.
 * São gravados como ÍNDICES no buffer `SIM.anim` (ver simBuffer.ts);
 * use `ANIM_INDEX[estado]` para escrever e `ANIM_STATES[idx]` para ler.
 */
export type AnimState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'sit'
  | 'sitFidget'
  | 'write'
  | 'talk'
  | 'eat'
  | 'sweep'
  | 'playBall';

/** Lista runtime dos estados de animação, na ordem usada pelo buffer `SIM.anim`. */
export const ANIM_STATES: readonly AnimState[] = [
  'idle',
  'walk',
  'run',
  'sit',
  'sitFidget',
  'write',
  'talk',
  'eat',
  'sweep',
  'playBall',
] as const;

/** Mapa estado → índice numérico usado no buffer `SIM.anim`. */
export const ANIM_INDEX: Record<AnimState, number> = {
  idle: 0,
  walk: 1,
  run: 2,
  sit: 3,
  sitFidget: 4,
  write: 5,
  talk: 6,
  eat: 7,
  sweep: 8,
  playBall: 9,
};

/** Vetor 3D imutável por convenção: [x, y, z] em metros. */
export type Vec3 = [number, number, number];

/** Andar da escola: 0 = térreo (y base 0), 1 = superior (y base 3). */
export type Andar = 0 | 1;

/**
 * Caixa sólida alinhada aos eixos (AABB). `min` e `max` são cantos absolutos.
 * Usada para paredes/muros/guarda-corpos/balcão: serve tanto para
 * renderização (um Box por AABB) quanto para colisão.
 */
export interface AABB {
  min: Vec3;
  max: Vec3;
}

/**
 * Retângulo no plano XZ. CONVENÇÃO: `x` e `z` são o CANTO MÍNIMO
 * (menor x, menor z); `w` = largura ao longo de X; `d` = profundidade ao longo de Z.
 */
export interface RectXZ {
  x: number;
  z: number;
  w: number;
  d: number;
}

/**
 * Vão de porta ou janela, centrado em (`x`, `z`) sobre a linha da parede.
 * `eixo` indica a direção ao longo da qual a parede corre:
 * - 'x': parede paralela ao eixo X (o vão abre passagem na direção Z);
 * - 'z': parede paralela ao eixo Z (o vão abre passagem na direção X).
 * Alturas padronizadas (aplicadas em layout.ts ao gerar os WALLS):
 * - portas: do piso até 2,1 m (2,3 m nas portas duplas com largura ≥ 1,8 m);
 * - janelas: de 1,0 m a 2,2 m (banheiros: 1,6 m a 2,2 m).
 */
export interface VaoPorta {
  x: number;
  z: number;
  largura: number;
  eixo: 'x' | 'z';
}

/** Tipos de cômodo da escola. */
export type TipoSala =
  | 'aula'
  | 'admin'
  | 'refeitorio'
  | 'biblioteca'
  | 'banheiro'
  | 'auditorio'
  | 'lab'
  | 'artes'
  | 'secretaria'
  | 'diretoria'
  | 'salaProfessores';

/**
 * Definição estática de um cômodo (sala de aula ou espaço administrativo).
 * `rect` é a área ÚTIL interna; as paredes ficam sobre as bordas do rect.
 */
export interface SalaDef {
  /** Identificador estável, ex.: 'sala-1'…'sala-12', 'refeitorio', 'diretoria'. */
  id: string;
  /** Nome de exibição em PT-BR, ex.: 'Sala 1', 'Diretoria'. */
  nome: string;
  tipo: TipoSala;
  andar: Andar;
  /** Área interna no plano XZ (canto mínimo + dimensões). */
  rect: RectXZ;
  /** Pé-direito em metros (sempre 3 neste projeto). */
  altura: number;
  /** Vãos de porta sobre as paredes do cômodo. */
  portas: VaoPorta[];
  /** Vãos de janela sobre as paredes do cômodo. */
  janelas: VaoPorta[];
  /** Cor hex opcional para destaque no minimapa/legendas. */
  corDestaque?: string;
}

/** Paleta de cores (hex) de um personagem. */
export interface PaletaPersonagem {
  pele: string;
  cabelo: string;
  camisa: string;
  calca: string;
  /** Presente apenas para alunos. */
  mochila?: string;
}

/**
 * Entrada estática do elenco (ver roster.ts).
 * `indice` é a posição estável (0–78) nos buffers de simulação (SIM).
 */
export interface PersonagemInfo {
  /** Identificador estável, ex.: 'prof-3', 'aluno-42', 'porteiro-1'. */
  id: string;
  /** Índice estável nos buffers (0–78) — NUNCA muda em runtime. */
  indice: number;
  nome: string;
  papel: Papel;
  /**
   * Sexo do personagem. EDIÇÃO DE CONTRATO AUTORIZADA (realismo dos NPCs):
   * atribuído nome a nome em roster.ts; consumido apenas pelo rig/render
   * (proporções, saia, detalhePeitoF, cabelo). Ids/índices intactos.
   */
  sexo: Sexo;
  /** Apenas professores: matéria lecionada. */
  materia?: string;
  /** Professores e alunos: id da sala "de origem" ('sala-1'…'sala-12'). */
  salaId?: string;
  paleta: PaletaPersonagem;
}

/** Marco da rotina diária; `inicioMin` em minutos desde 00:00. */
export interface HorarioRotina {
  periodo: Periodo;
  inicioMin: number;
  /** true = toca o sino ao entrar neste período. */
  sino: boolean;
}
