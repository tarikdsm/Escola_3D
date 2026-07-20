/**
 * step.ts — Orquestra UM frame da simulação inteira (sem React, testável
 * em Node headless). Ordem por frame:
 *
 * 0) VIAGEM NO TEMPO ativa (store.viajando, ver viagemTempo.ts): o tick
 *    normal do relógio é SUBSTITUÍDO pelo passoPerseguicao — reset do dia
 *    nas viagens ao passado e passos grossos (1–5 s de jogo) em fatias por
 *    frame até o alvo; os buffers SIM são escritos uma única vez por frame;
 * 1) relógio (delta × ESCALA_TEMPO × velocidade → tickClock; wrap às 23h);
 * 2) detecção de troca de período → interrompe todos e replaneja (troca de
 *    TURNO na CHEGADA rearma a entrada dos 640 alunos como "nova turma" —
 *    ver behaviors.aoMudarPeriodo e estado.prepararNovoTurno);
 * 3) portão: aberto em CHEGADA/RECREIO/ALMOCO_SAIDA, fechado em AULA_*
 *    (decisão documentada aqui; aplicada só quando muda);
 * 4) agentes (máquina de estados + modos bola/fila);
 * 5) separação anti-sobreposição (hash espacial);
 * 6) física da bola;
 * 7) escrita dos buffers SIM (pos/facing/anim/phase/speed/talkTarget);
 * 8) atividades PT-BR → store a ~1 Hz (único sync de alta frequência).
 *
 * Os passos 2–6 formam `avancarSim` (avanço do ESTADO do mundo por dtJogo
 * segundos de jogo) e os passos 7–8 formam `sincronizar` (saída para
 * buffers/store) — separados para a perseguição da viagem poder rodar
 * vários avanços por frame pagando a sincronização uma única vez.
 */
import { emit } from '../contracts/events';
import { CONST } from '../contracts/layout';
import { ROSTER } from '../contracts/roster';
import { periodoPara, turnoPara } from '../contracts/routine';
import { useSchoolStore } from '../state/useSchoolStore';
import { escreverAgente, atualizarAgente } from './agents';
import { atualizarBola } from './ball';
import { aoMudarPeriodo } from './behaviors';
import { passoRelogio } from './clock';
import type { Mundo } from './estado';
import { separacao } from './navigation';
import {
  MAX_PASSOS_VIAGEM,
  ORCAMENTO_MS_VIAGEM,
  SEPARACAO_A_CADA_PASSOS_VIAGEM,
  alvoViagem,
  cancelarViagem,
  consumirResetViagem,
  passoAdaptativoViagem,
  resetarDiaViagem,
  viagemAtiva,
} from './viagemTempo';

export function stepMundo(m: Mundo, dtReal: number): void {
  // Viagem no tempo: perseguição em fatias substitui o tick normal do relógio.
  if (viagemAtiva()) {
    const perseguido = passoPerseguicao(m);
    sincronizar(m, perseguido, dtReal);
    return;
  }
  const dtJogo = passoRelogio(m, dtReal);
  avancarSim(m, dtJogo);
  sincronizar(m, dtJogo, dtReal);
}

/**
 * Avança o ESTADO do mundo por `dtJogo` segundos de jogo (passos 2–6).
 * `comSeparacao=false` pula a separação anti-sobreposição (a viagem no tempo
 * a roda só a cada K passos — custa ~90 % do frame em aglomerações e não
 * interfere na lógica, ver passoPerseguicao).
 */
function avancarSim(m: Mundo, dtJogo: number, comSeparacao = true): void {
  const st = useSchoolStore.getState();

  if (st.periodo !== m.periodo) aoMudarPeriodo(m, st.periodo);

  const aberto = st.periodo !== 'AULA_1' && st.periodo !== 'AULA_2';
  if (aberto !== m.portaoAberto) {
    m.portaoAberto = aberto;
    st.setPortaoAberto(aberto);
  }

  for (const a of m.agentes) atualizarAgente(m, a, dtJogo);
  if (comSeparacao) separacao(m, dtJogo);
  atualizarBola(m.bola, dtJogo);
}

/** Escreve os buffers SIM e envia atividades a ~1 Hz (passos 7–8). */
function sincronizar(m: Mundo, dtJogo: number, dtReal: number): void {
  for (const a of m.agentes) escreverAgente(m, a, dtJogo, dtReal);

  m.accAtividades += dtReal;
  if (m.accAtividades >= 1) {
    m.accAtividades = 0;
    const batch: Record<string, string> = {};
    for (const a of m.agentes) batch[ROSTER[a.indice].id] = a.atividade;
    useSchoolStore.getState().setAtividades(batch);
  }
}

/**
 * HOOK DA VIAGEM NO TEMPO (um frame): viagem ao passado reinicia o dia
 * primeiro (7h, todos nos spawns, pincéis resetados — replay consistente,
 * mesmo efeito do wrap diário); depois a simulação "persegue" o alvo em
 * passos grossos (1–5 s de jogo, adaptativos) dentro do orçamento do frame
 * (ORCAMENTO_MS_VIAGEM / MAX_PASSOS_VIAGEM) — o restante continua no frame
 * seguinte, sem travar o render. A separação anti-sobreposição (só visual,
 * ~90–100 % do custo do passo em aglomerações) fica DESLIGADA na perseguição
 * (SEPARACAO_A_CADA_PASSOS_VIAGEM = 0), com uma separação ao chegar ao alvo.
 * Devolve o total de segundos de jogo simulados neste frame (para a fase de
 * animação dos buffers).
 */
function passoPerseguicao(m: Mundo): number {
  const st = useSchoolStore.getState();

  // PASSADO: reinicia o dia antes de perseguir (replay das 7h). Mesmo
  // efeito do wrapDia (clock.ts), duplicado aqui para a viagem não depender
  // de editar o relógio normal.
  if (consumirResetViagem()) {
    resetarDiaViagem(m);
    useSchoolStore.setState({
      clockMin: CONST.HORA_ABERTURA,
      periodo: periodoPara(CONST.HORA_ABERTURA),
      turno: turnoPara(CONST.HORA_ABERTURA),
    });
    emit('periodo', 'CHEGADA');
    m.clockMin = CONST.HORA_ABERTURA;
  }

  const alvo = alvoViagem();
  if (alvo === null) return 0;

  const t0 = performance.now();
  let passos = 0;
  let totalJogo = 0;
  let ultimoDt = 0;
  let separou = false;
  let chegou = false;

  for (;;) {
    const atual = useSchoolStore.getState().clockMin;
    const restanteMin = alvo - atual;
    if (restanteMin <= 1e-6) {
      chegou = true; // chegou (tolerância de ponto flutuante)
      break;
    }
    // Fatia do frame estourada: a perseguição continua no próximo frame.
    if (passos >= MAX_PASSOS_VIAGEM) break;
    if (passos > 0 && performance.now() - t0 >= ORCAMENTO_MS_VIAGEM) break;

    const dtJogo = Math.min(passoAdaptativoViagem(restanteMin), restanteMin * 60);
    st.tickClock(dtJogo / 60); // sinos/períodos disparam na lógica (som mudo)
    const novoClock = useSchoolStore.getState().clockMin;
    m.clockMin = novoClock;
    if (novoClock <= atual) {
      // Absorção de ponto flutuante colada no alvo: crava o valor exato.
      useSchoolStore.setState({
        clockMin: alvo,
        periodo: periodoPara(alvo),
        turno: turnoPara(alvo),
      });
      m.clockMin = alvo;
      chegou = true;
      break;
    }
    // A separação (anti-sobreposição) é só visual e caríssima em aglomera-
    // ções: na perseguição fica desligada (K=0) ou roda a cada K passos.
    const comSeparacao =
      SEPARACAO_A_CADA_PASSOS_VIAGEM > 0 &&
      passos % SEPARACAO_A_CADA_PASSOS_VIAGEM === SEPARACAO_A_CADA_PASSOS_VIAGEM - 1;
    avancarSim(m, dtJogo, comSeparacao);
    separou = separou || comSeparacao;
    ultimoDt = dtJogo;
    totalJogo += dtJogo;
    passos++;
  }

  // Separação complementar: ao CHEGAR ao alvo sempre (inicia o relaxamento
  // das aglomerações do avanço grosso); com K>0, também ao fim de cada fatia.
  if (ultimoDt > 0 && (chegou || (SEPARACAO_A_CADA_PASSOS_VIAGEM > 0 && !separou))) {
    separacao(m, ultimoDt);
  }

  if (chegou) {
    // Alvo atingido: encerra a viagem — o tick normal volta no próximo frame.
    cancelarViagem();
    useSchoolStore.setState({ viajando: false, minutoAlvoViagem: null });
  }
  return totalJogo;
}
