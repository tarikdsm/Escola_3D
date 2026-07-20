/**
 * estado.ts — ESTADO MUTÁVEL da simulação (fora do React).
 *
 * Um `Mundo` carrega os 712 `Agente`s (um por entrada do ROSTER), as
 * ocupações de lugares disputados (roda de conversa, bancos, mesas do
 * refeitório, lugares da sala dos professores grande, fila da cantina,
 * fila do almoxarifado) e a bola.
 * Tudo é pré-alocado na criação: o loop quente não aloca nada.
 *
 * Convenções:
 * - Tempos de duração (`tempoRestante`) são em SEGUNDOS DE JOGO.
 * - Posições dos agentes vivem nos campos x/y/z do Agente e são copiadas
 *   aos buffers SIM uma vez por frame (agents.ts).
 * - `minutoEntrada`/`grupoChegada`/`offsetEntrada` implementam a CHEGADA
 *   escalonada dos 640 alunos: 32 grupos de 20, com METADE da turma
 *   entrando nos primeiros ~5 min do turno e o restante escalonado até
 *   ~18 min (cabe na janela mais curta, a do turno da noite: 20 min).
 *   O MESMO conjunto de agentes re-entra como "nova turma" a cada turno
 *   (KISS — ver SPEC): `prepararNovoTurno` rearma a entrada a partir do
 *   `offsetEntrada` relativo à abertura do turno.
 */

import { ALMOXARIFADO, CARTEIRAS, CONST, PORTARIA, REFEITORIO } from '../contracts/layout';
import { ROSTER } from '../contracts/roster';
import { ROTINA, type Turno } from '../contracts/routine';
import {
  setAnim,
  setFacing,
  setPhase,
  setPosicao,
  setSpeed,
  setTalkTarget,
} from '../contracts/simBuffer';
import type { AnimState, Periodo, Vec3 } from '../contracts/types';
import { criarBola, resetBola, type Bola } from './ball';
import { faixa, mulberry32, type Rng } from './rng';

/** Semente fixa do RNG (determinismo leve entre sessões). */
const SEMENTE = 20240719;

/** Fases do ciclo de um agente (ver agents.ts). */
export type FaseAgente = 'indo' | 'fazendo' | 'conversando';

/** Comportamentos contínuos tratados a cada frame dentro de 'fazendo'
 *  ('fila' = cantina; 'filaAlmox' = fila do almoxarifado). */
export type ModoTarefa = 'nenhum' | 'bola' | 'fila' | 'filaAlmox';

export interface Agente {
  /** Índice estável no ROSTER/buffers (0–711). */
  indice: number;

  // --- Posição e orientação (espelhados aos buffers a cada frame) ---
  x: number;
  y: number;
  z: number;
  /** Ângulo atual (rad, convenção do SIM: 0 = +Z). */
  angulo: number;
  /** Ângulo desejado; o facing real interpola até ele. */
  anguloAlvo: number;
  /** Fase 0..1 do ciclo de animação (dessincroniza personagens). */
  faseAnim: number;
  /** Velocidade escalar atual (m/s jogo) escrita em SIM.speed. */
  velAtual: number;

  // --- Máquina de estados ---
  fase: FaseAgente;
  /** Índices de WAYPOINTS a percorrer (rota pelo grafo). */
  path: number[];
  pathIdx: number;
  /** Pontos off-graph intermediários (ex.: contornar o balcão da cantina). */
  via: Vec3[];
  viaIdx: number;
  /** Ponto final exato (off-graph), ex.: carteira, lugar na mesa. */
  destino: Vec3 | null;
  /** Nó do grafo usado como alvo do roteamento (para replanejar). −1 = perna direta. */
  nodeAlvo: number;
  /** Tempo restante (s de jogo) da ação em 'fazendo'/'conversando'. */
  tempoRestante: number;
  /** Velocidade do deslocamento atual (m/s jogo). */
  velocidade: number;
  /** Se o deslocamento usa animação de corrida. */
  correr: boolean;
  /** Animação da ação (usada em 'fazendo'). */
  anim: AnimState;
  /** Ponto para o qual olhar quando parado (quadro, mesa, balcão...). */
  face: Vec3 | null;
  /** Interlocutor (−1 = ninguém); espelhado em SIM.talkTarget. */
  parceiroTalk: number;
  /** Texto PT-BR atual (exibido no painel; enviado à store a ~1 Hz). */
  atividade: string;
  /** Texto enquanto se desloca. */
  atvDeslocando: string;
  /** Texto ao executar a ação. */
  atvAcao: string;
  /** Modo contínuo (perseguir bola / andar na fila). */
  modo: ModoTarefa;
  /** Fase a assumir ao chegar ao destino. */
  faseFinal: 'fazendo' | 'conversando';

  // --- Memória de comportamento ---
  /** Segundos de jogo sem progresso (repath após 3 s). */
  semProgresso: number;
  /** Última distância ao alvo do segmento (detecção de progresso). */
  ultimaDist: number;
  /** Já passou pelo portão hoje. */
  entrouHoje: boolean;
  /** Minuto do dia em que entra (CHEGADA escalonada). */
  minutoEntrada: number;
  /** Deslocamento de `minutoEntrada` em relação à abertura do turno. */
  offsetEntrada: number;
  /** Grupo de chegada (alunos; −1 para os demais). */
  grupoChegada: number;
  /** Uso livre por papel (rotação de rondas, flag de atendimento das filas). */
  memoria: number;
  /** Alternância de ciclos (ex.: quadro ↔ mesa do professor). */
  alterna: boolean;
  /** Professor executando a ação de aula AGORA (drena o pincel ativo). */
  ensinando: boolean;
  /** Assento fixo determinístico do aluno (CARTEIRAS[salaId][k]). */
  assentoFixo: Vec3 | null;
  /** Lugar reservado na mesa do refeitório (0–17; −1 = nenhum). */
  lugarRef: number;
  /** Slot reservado na roda de conversa (0–23; −1). */
  rodaRef: number;
  /** Lugar reservado no banco do pátio (0–11; −1). */
  bancoRef: number;
  /** Lugar reservado na sala dos professores grande (0–39; −1). */
  profMesaRef: number;
  /** Cooldown entre chutes (s de jogo). */
  cooldownChute: number;
  /** Já comeu neste período (recreio/almoço). */
  comeu: boolean;
  /** Decidiu sair direto (sem comer) no ALMOCO_SAIDA. */
  vaiSair: boolean;
  /** Já está na rua após a saída. */
  saiu: boolean;
  /** Índice do nó da rua usado como ponto de saída. */
  ruaNode: number;
  /** Posição de espera na rua (spawn com jitter determinístico). */
  spawnPos: Vec3;
}

export interface Mundo {
  agentes: Agente[];
  rng: Rng;
  /** Período visto na última atualização (detecção de troca de período). */
  periodo: Periodo;
  /** Turno vigente ('manha' | 'tarde' | 'noite') — a troca rearma a turma. */
  turno: Turno;
  /** Relógio do jogo (minutos) da última atualização. */
  clockMin: number;
  /** Fila da cantina: índices dos agentes, do atendido ao último. */
  filaRefeitorio: number[];
  /** Fila do almoxarifado: índices dos professores, do atendido ao último. */
  filaAlmoxarifado: number[];
  /** Ocupação dos 24 lugares das 4 mesas do refeitório (1 = ocupado). */
  lugaresRefeitorio: Int8Array;
  /** Ocupação dos 24 slots das 4 rodas de conversa (6 por roda). */
  rodas: Int8Array;
  /** Ocupação dos 12 lugares dos 4 bancos do pátio (3 por banco). */
  bancos: Int8Array;
  /** Ocupação dos 40 lugares da sala dos professores grande (8 mesas × 5). */
  profMesas: Int8Array;
  /** Grupos de chegada dos alunos (índices por grupo). */
  gruposChegada: number[][];
  /** Acumulador (s reais) para o envio de atividades a ~1 Hz. */
  accAtividades: number;
  /** Último estado do portão enviado à store. */
  portaoAberto: boolean;
  bola: Bola;
}

/**
 * EDIÇÃO MÍNIMA (rodada de posse — agente C1): referência ao mundo ativo,
 * registrada em `criarMundo`. A simulação em si NÃO a usa; ela existe para
 * `src/player/possessao.ts` tirar/devolver o NPC possuído (liberar recursos,
 * sincronizar posição ao soltar). Leitura/escrita só nas TRANSIÇÕES de
 * posse — nunca no loop por frame.
 */
export let mundoAtivo: Mundo | null = null;

/** Cria um agente com valores iniciais neutros. */
function criarAgente(indice: number): Agente {
  return {
    indice,
    x: 0,
    y: 0,
    z: 0,
    angulo: Math.PI,
    anguloAlvo: Math.PI,
    faseAnim: 0,
    velAtual: 0,
    fase: 'fazendo',
    path: [],
    pathIdx: 0,
    via: [],
    viaIdx: 0,
    destino: null,
    nodeAlvo: -1,
    tempoRestante: 0,
    velocidade: CONST.VEL_ANDAR,
    correr: false,
    anim: 'idle',
    face: null,
    parceiroTalk: -1,
    atividade: 'Aguardando',
    atvDeslocando: '',
    atvAcao: '',
    modo: 'nenhum',
    faseFinal: 'fazendo',
    semProgresso: 0,
    ultimaDist: Infinity,
    entrouHoje: false,
    minutoEntrada: CONST.HORA_ABERTURA,
    offsetEntrada: 0,
    grupoChegada: -1,
    memoria: 0,
    alterna: false,
    ensinando: false,
    assentoFixo: null,
    lugarRef: -1,
    rodaRef: -1,
    bancoRef: -1,
    profMesaRef: -1,
    cooldownChute: 0,
    comeu: false,
    vaiSair: false,
    saiu: false,
    ruaNode: -1,
    spawnPos: [0, 0, 0],
  };
}

/**
 * Posiciona todos os personagens para o início do dia e zera o estado
 * dinâmico (usado na montagem E no wrap diário 23h → 7h):
 * - alunos e professores: na calçada (PORTARIA.spawnRua, com jitter
 *   determinístico do RNG), aguardando seu horário de entrada;
 * - equipe (diretora, secretário, cozinheiras, faxineiros, porteiro,
 *   almoxarife): já nos seus postos.
 */
export function resetDia(m: Mundo): void {
  m.turno = 'manha';
  m.filaRefeitorio.length = 0;
  m.filaAlmoxarifado.length = 0;
  m.lugaresRefeitorio.fill(0);
  m.rodas.fill(0);
  m.bancos.fill(0);
  m.profMesas.fill(0);
  m.bola.ativa = false;
  resetBola(m.bola);

  for (const a of m.agentes) {
    a.fase = 'fazendo';
    a.path.length = 0;
    a.pathIdx = 0;
    a.via.length = 0;
    a.viaIdx = 0;
    a.destino = null;
    a.nodeAlvo = -1;
    a.tempoRestante = 0;
    a.velAtual = 0;
    a.anim = 'idle';
    a.face = null;
    a.parceiroTalk = -1;
    a.modo = 'nenhum';
    a.faseFinal = 'fazendo';
    a.semProgresso = 0;
    a.ultimaDist = Infinity;
    a.entrouHoje = false;
    a.lugarRef = -1;
    a.rodaRef = -1;
    a.bancoRef = -1;
    a.profMesaRef = -1;
    a.cooldownChute = 0;
    a.comeu = false;
    a.vaiSair = false;
    a.saiu = false;
    a.ensinando = false;

    const info = ROSTER[a.indice];
    if (info.papel === 'ALUNO' || info.papel === 'PROFESSOR') {
      // Rearma a entrada do primeiro turno (7h) a partir do offset relativo.
      a.minutoEntrada = CONST.HORA_ABERTURA + a.offsetEntrada;
      // Calçada da rua: ponto do spawn + jitter para não sobrepor.
      a.x = a.spawnPos[0];
      a.y = 0;
      a.z = a.spawnPos[2];
      a.angulo = Math.PI; // olhando para a escola (portão a −Z da calçada)
      a.anguloAlvo = a.angulo;
      a.atividade = 'Aguardando na rua para entrar';
    } else {
      // Equipe já começa nos postos.
      switch (info.papel) {
        case 'DIRETORA':
          a.x = -20;
          a.y = 0;
          a.z = 42.5;
          a.angulo = 0; // olhando o portão
          a.atividade = 'Acompanhando a chegada dos alunos';
          break;
        case 'SECRETARIO':
          a.x = 1;
          a.y = 0;
          a.z = 16.8;
          a.angulo = Math.PI;
          a.atividade = 'Organizando documentos na secretaria';
          break;
        case 'COZINHEIRA': {
          const spot = REFEITORIO.balcao[a.indice === 706 ? 1 : 3];
          a.x = spot[0];
          a.y = 0;
          a.z = spot[2];
          a.angulo = Math.PI;
          a.atividade = 'Preparando a merenda';
          break;
        }
        case 'FAXINEIRO':
          if (a.indice === 708) {
            a.x = -10;
            a.z = -5;
          } else {
            a.x = 0;
            a.z = -21.5;
          }
          a.y = 0;
          a.angulo = 0;
          a.atividade = 'Varrendo';
          break;
        case 'PORTEIRO':
          a.x = PORTARIA.porteiroPos[0];
          a.y = 0;
          a.z = PORTARIA.porteiroPos[2];
          a.angulo = -1.3; // de dentro da guarita, olhando o vão do portão
          a.atividade = 'No portão';
          break;
        case 'almoxarife':
          a.x = ALMOXARIFADO.postoAlmoxarife[0];
          a.y = 0;
          a.z = ALMOXARIFADO.postoAlmoxarife[2];
          a.angulo = 0; // atrás da mesa, de frente para a máquina Fill/fila (+Z)
          a.atividade = 'No almoxarifado';
          break;
      }
      a.anguloAlvo = a.angulo;
    }
  }
}

/**
 * Cria o mundo da simulação e escreve os buffers iniciais ANTES do
 * primeiro frame (ninguém aparece em 0,0,0).
 */
export function criarMundo(): Mundo {
  const rng = mulberry32(SEMENTE);
  const agentes = ROSTER.map((info) => criarAgente(info.indice));
  const m: Mundo = {
    agentes,
    rng,
    periodo: 'CHEGADA',
    turno: 'manha',
    clockMin: CONST.HORA_ABERTURA,
    filaRefeitorio: [],
    filaAlmoxarifado: [],
    lugaresRefeitorio: new Int8Array(24),
    rodas: new Int8Array(24),
    bancos: new Int8Array(12),
    profMesas: new Int8Array(40),
    gruposChegada: [],
    accAtividades: 0,
    portaoAberto: true,
    bola: criarBola(),
  };

  // Parâmetros por personagem (spawns, grupos, assentos, horários).
  for (const a of agentes) {
    const info = ROSTER[a.indice];
    a.faseAnim = rng(); // dessincroniza ciclos de animação
    if (info.papel === 'ALUNO') {
      const i = a.indice - 66; // 0..639
      const grupo = Math.floor(i / 20); // 32 grupos de 20
      a.grupoChegada = grupo;
      // Chegada escalonada com GRUPOS MAIORES NOS 5 MIN INICIAIS: metade
      // da turma (16 grupos) entra nos primeiros ~5 min; o restante até
      // ~18 min (cabe na janela mais curta, a do turno da noite: 20 min).
      a.offsetEntrada =
        (grupo < 16 ? grupo * 0.32 : 5 + (grupo - 15) * 0.8) + faixa(rng, 0, 0.6);
      a.minutoEntrada = CONST.HORA_ABERTURA + a.offsetEntrada;
      const base = PORTARIA.spawnRua[i % 12];
      // Jitter largo: ~54 alunos dividem o mesmo ponto de spawn — espalha
      // para a separação não criar congestionamento no portão/calçada.
      a.spawnPos = [base[0] + faixa(rng, -2.2, 2.2), 0, base[2] + faixa(rng, -0.9, 0.9)];
      a.ruaNode = i % 12; // nó `rua-${k}` (resolvido em behaviors)
      // Assento fixo: os 20 alunos da sala ocupam as carteiras de índices
      // 0–19 do contrato CARTEIRAS (ver behaviors.irParaCarteira).
      if (info.salaId) {
        const k = i % 20;
        a.assentoFixo = CARTEIRAS[info.salaId][k];
      }
      while (m.gruposChegada.length <= grupo) m.gruposChegada.push([]);
      m.gruposChegada[grupo].push(a.indice);
    } else if (info.papel === 'PROFESSOR') {
      const i = a.indice - 2; // 0..63
      a.offsetEntrada = faixa(rng, 0, 12);
      a.minutoEntrada = CONST.HORA_ABERTURA + a.offsetEntrada;
      const base = PORTARIA.spawnRua[(i * 5 + 3) % 12];
      a.spawnPos = [base[0] + faixa(rng, -1.2, 1.2), 0, base[2] + faixa(rng, -0.5, 0.5)];
      a.ruaNode = (i * 5 + 3) % 12;
    } else if (info.papel === 'DIRETORA' || info.papel === 'FAXINEIRO') {
      // Começam em pontos diferentes das suas rondas.
      a.memoria = Math.floor(rng() * 7);
    }
  }

  resetDia(m);

  // Buffers iniciais (posição/anim/facing coerentes já no frame 0).
  for (const a of agentes) {
    setPosicao(a.indice, a.x, a.y, a.z);
    setFacing(a.indice, a.angulo);
    setAnim(a.indice, 'idle');
    setPhase(a.indice, a.faseAnim);
    setSpeed(a.indice, 0);
    setTalkTarget(a.indice, -1);
  }
  mundoAtivo = m; // registro p/ a posse (src/player/possessao.ts — ver acima)
  return m;
}

/**
 * Libera TODOS os recursos disputados do agente (lugares, fila) e desfaz
 * parcerias de conversa (limpando o lado de lá também, se mútuo).
 * Chamado ao trocar de tarefa e ao mudar de período.
 */
export function liberarTudo(m: Mundo, a: Agente): void {
  if (a.lugarRef >= 0) {
    m.lugaresRefeitorio[a.lugarRef] = 0;
    a.lugarRef = -1;
  }
  if (a.rodaRef >= 0) {
    m.rodas[a.rodaRef] = 0;
    a.rodaRef = -1;
  }
  if (a.bancoRef >= 0) {
    m.bancos[a.bancoRef] = 0;
    a.bancoRef = -1;
  }
  if (a.profMesaRef >= 0) {
    m.profMesas[a.profMesaRef] = 0;
    a.profMesaRef = -1;
  }
  const naFila = m.filaRefeitorio.indexOf(a.indice);
  if (naFila >= 0) m.filaRefeitorio.splice(naFila, 1);
  const naFilaAlmox = m.filaAlmoxarifado.indexOf(a.indice);
  if (naFilaAlmox >= 0) m.filaAlmoxarifado.splice(naFilaAlmox, 1);
  if (a.parceiroTalk >= 0) {
    const outro = m.agentes[a.parceiroTalk];
    if (outro.parceiroTalk === a.indice) outro.parceiroTalk = -1;
    a.parceiroTalk = -1;
  }
  a.modo = 'nenhum';
}

/**
 * Troca de TURNO (manhã → tarde → noite): os MESMOS 640 agentes-alunos
 * re-entram como a "nova turma" (KISS — ver SPEC). Eles já estão esperando
 * na rua desde a SAÍDA anterior; aqui só se rearma a entrada (flags +
 * `minutoEntrada` relativo à abertura do novo turno). Professores e
 * funcionários ficam no campus entre turnos (rotina idle plausível).
 */
export function prepararNovoTurno(m: Mundo, turno: Turno): void {
  m.turno = turno;
  const abertura =
    ROTINA.find((r) => r.turno === turno && r.periodo === 'CHEGADA')?.inicioMin ??
    CONST.HORA_ABERTURA;
  for (const a of m.agentes) {
    if (ROSTER[a.indice].papel !== 'ALUNO') continue;
    a.entrouHoje = false;
    a.saiu = false;
    a.comeu = false;
    a.vaiSair = false;
    a.minutoEntrada = abertura + a.offsetEntrada;
  }
}
