/**
 * estado.ts — ESTADO MUTÁVEL da simulação (fora do React).
 *
 * Um `Mundo` carrega os 79 `Agente`s (um por entrada do ROSTER), as
 * ocupações de lugares disputados (roda de conversa, bancos, mesas do
 * refeitório, mesas da sala dos professores, fila da cantina) e a bola.
 * Tudo é pré-alocado na criação: o loop quente não aloca nada.
 *
 * Convenções:
 * - Tempos de duração (`tempoRestante`) são em SEGUNDOS DE JOGO.
 * - Posições dos agentes vivem nos campos x/y/z do Agente e são copiadas
 *   aos buffers SIM uma vez por frame (agents.ts).
 * - `minutoEntrada`/`grupoChegada` implementam a CHEGADA escalonada:
 *   os 60 alunos entram em 15 grupos de 4 (grupos de 3–5 pedidos; aqui
 *   60/15 = 4 por grupo), com horários de entrada entre 7h00 e ~7h24.
 */

import { CARTEIRAS, CONST, PORTARIA, REFEITORIO } from '../contracts/layout';
import { ROSTER } from '../contracts/roster';
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

/** Comportamentos contínuos tratados a cada frame dentro de 'fazendo'. */
export type ModoTarefa = 'nenhum' | 'bola' | 'fila';

export interface Agente {
  /** Índice estável no ROSTER/buffers (0–78). */
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
  /** Grupo de chegada (alunos; −1 para os demais). */
  grupoChegada: number;
  /** Uso livre por papel (rotação de rondas, flag de atendimento da fila). */
  memoria: number;
  /** Alternância de ciclos (ex.: quadro ↔ mesa do professor). */
  alterna: boolean;
  /** Assento fixo determinístico do aluno (CARTEIRAS[salaId][k]). */
  assentoFixo: Vec3 | null;
  /** Lugar reservado na mesa do refeitório (0–17; −1 = nenhum). */
  lugarRef: number;
  /** Slot reservado na roda de conversa (0–23; −1). */
  rodaRef: number;
  /** Lugar reservado no banco do pátio (0–11; −1). */
  bancoRef: number;
  /** Lugar reservado na sala dos professores (0–7; −1). */
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
  /** Relógio do jogo (minutos) da última atualização. */
  clockMin: number;
  /** Fila da cantina: índices dos agentes, do atendido ao último. */
  filaRefeitorio: number[];
  /** Ocupação dos 18 lugares das mesas do refeitório (1 = ocupado). */
  lugaresRefeitorio: Int8Array;
  /** Ocupação dos 24 slots das 4 rodas de conversa (6 por roda). */
  rodas: Int8Array;
  /** Ocupação dos 12 lugares dos 4 bancos do pátio (3 por banco). */
  bancos: Int8Array;
  /** Ocupação dos 8 lugares das 4 mesas da sala dos professores (2 por mesa). */
  profMesas: Int8Array;
  /** Grupos de chegada dos alunos (índices por grupo). */
  gruposChegada: number[][];
  /** Acumulador (s reais) para o envio de atividades a ~1 Hz. */
  accAtividades: number;
  /** Último estado do portão enviado à store. */
  portaoAberto: boolean;
  bola: Bola;
}

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
    grupoChegada: -1,
    memoria: 0,
    alterna: false,
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
 * dinâmico (usado na montagem E no wrap diário 12h → 7h):
 * - alunos e professores: na calçada (PORTARIA.spawnRua, com jitter
 *   determinístico do RNG), aguardando seu horário de entrada;
 * - equipe (diretora, secretário, cozinheiras, faxineiros, porteiro):
 *   já nos seus postos.
 */
export function resetDia(m: Mundo): void {
  m.filaRefeitorio.length = 0;
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

    const info = ROSTER[a.indice];
    if (info.papel === 'ALUNO' || info.papel === 'PROFESSOR') {
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
          const spot = REFEITORIO.balcao[a.indice === 74 ? 1 : 3];
          a.x = spot[0];
          a.y = 0;
          a.z = spot[2];
          a.angulo = Math.PI;
          a.atividade = 'Preparando a merenda';
          break;
        }
        case 'FAXINEIRO':
          if (a.indice === 76) {
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
    clockMin: CONST.HORA_ABERTURA,
    filaRefeitorio: [],
    lugaresRefeitorio: new Int8Array(18),
    rodas: new Int8Array(24),
    bancos: new Int8Array(12),
    profMesas: new Int8Array(8),
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
      const i = a.indice - 14; // 0..59
      const grupo = Math.floor(i / 4); // 15 grupos de 4
      a.grupoChegada = grupo;
      a.minutoEntrada = CONST.HORA_ABERTURA + grupo * 1.6 + faixa(rng, 0, 1);
      const base = PORTARIA.spawnRua[i % 12];
      // Jitter largo: ~5 alunos dividem o mesmo ponto de spawn — espalha
      // para a separação não criar congestionamento no portão/calçada.
      a.spawnPos = [base[0] + faixa(rng, -1.2, 1.2), 0, base[2] + faixa(rng, -0.5, 0.5)];
      a.ruaNode = i % 12; // nó `rua-${k}` (resolvido em behaviors)
      // Assento fixo: os 5 alunos da sala ocupam as 5 primeiras carteiras
      // (fileira da frente, mais perto do quadro — ver behaviors.irParaCarteira).
      if (info.salaId) {
        const k = i % 5;
        a.assentoFixo = CARTEIRAS[info.salaId][k];
      }
      while (m.gruposChegada.length <= grupo) m.gruposChegada.push([]);
      m.gruposChegada[grupo].push(a.indice);
    } else if (info.papel === 'PROFESSOR') {
      const i = a.indice - 2; // 0..11
      a.minutoEntrada = CONST.HORA_ABERTURA + faixa(rng, 0, 12);
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
  if (a.parceiroTalk >= 0) {
    const outro = m.agentes[a.parceiroTalk];
    if (outro.parceiroTalk === a.indice) outro.parceiroTalk = -1;
    a.parceiroTalk = -1;
  }
  a.modo = 'nenhum';
}
