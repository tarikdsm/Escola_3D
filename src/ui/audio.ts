/**
 * audio.ts — AudioManager WebAudio 100% procedural (NENHUM arquivo de áudio).
 *
 * Uso: chamar `initAudio()` uma vez no arranque da aplicação (é idempotente).
 * O AudioContext só é criado/resumido após o primeiro gesto do usuário
 * (pointerdown/keydown), conforme a política de autoplay dos navegadores.
 *
 * Sons:
 * - SINO: campainha escolar (quadrado ~2,2 kHz com tremolo de 25 Hz, ~2,5 s,
 *   envelopes com rampas — sem cliques), disparada pelo evento 'sino'. Fica
 *   MUDO durante a viagem no tempo (store.viajando): os eventos 'sino'
 *   continuam disparando na lógica, mas tocarSino retorna sem tocar.
 * - MURMÚRIO: loop de ruído branco → lowpass 400 Hz → ganho com LFO lento;
 *   nível depende do período (CHEGADA 0,5 · AULA 0,12 · RECREIO 0,8 · SAÍDA 0,6).
 * - BOLA QUICANDO: só no RECREIO; thumps (seno ~120 Hz com decay rápido) em
 *   intervalos aleatórios de 0,4–1,5 s.
 * - PÁSSAROS: fora das aulas; chirps FM agudos (2–4 notas descendentes) a
 *   cada 3–8 s, volume baixo.
 *
 * Liga/desliga: segue `somLigado` da store (master gain 0 + contexto suspenso
 * ao mutar, retomado ao desmutar). Tecla M → toggleSom. Todos os listeners
 * globais são registrados UMA única vez (initAudio idempotente).
 */

import { on } from '../contracts/events';
import type { Periodo } from '../contracts/types';
import { useSchoolStore } from '../state/useSchoolStore';

// ---------------------------------------------------------------------------
// Estado do módulo
// ---------------------------------------------------------------------------

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ganhoMurmurio: GainNode | null = null;

let iniciado = false; // initAudio já rodou (listeners globais registrados)
let contextoPronto = false; // AudioContext já criado (após o 1º gesto)

const GANHO_MASTER = 0.9;
/** Escala absoluta do murmúrio (os níveis por período são relativos a isto). */
const GANHO_BASE_MURMURIO = 0.14;

/** Nível do murmúrio por período (relativo ao master). */
const NIVEL_MURMURIO: Record<Periodo, number> = {
  CHEGADA: 0.5,
  AULA_1: 0.12,
  AULA_2: 0.12,
  RECREIO: 0.8,
  ALMOCO_SAIDA: 0.6,
};

// ---------------------------------------------------------------------------
// Criação do contexto e grafo permanente
// ---------------------------------------------------------------------------

/** Cria o AudioContext e o grafo permanente (chamado no 1º gesto do usuário). */
function garantirContexto(): void {
  if (contextoPronto) return;
  contextoPronto = true;

  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = useSchoolStore.getState().somLigado ? GANHO_MASTER : 0;
  master.connect(ctx.destination);

  iniciarMurmurio();
  aplicarPeriodo(useSchoolStore.getState().periodo);
  agendarBola();
  agendarPassaros();
}

/** Loop de murmúrio ambiente: ruído branco → lowpass → ganhos (período × LFO). */
function iniciarMurmurio(): void {
  if (!ctx || !master) return;

  // Buffer de ruído branco de 2 s em loop.
  const tamanho = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, tamanho, ctx.sampleRate);
  const dados = buffer.getChannelData(0);
  for (let i = 0; i < tamanho; i++) dados[i] = Math.random() * 2 - 1;
  const ruido = ctx.createBufferSource();
  ruido.buffer = buffer;
  ruido.loop = true;

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 400;

  ganhoMurmurio = ctx.createGain();
  ganhoMurmurio.gain.value = 0;

  // LFO lento (~0,15 Hz) dá "respiração" ao ambiente, num 2º ganho.
  const ganhoLfo = ctx.createGain();
  ganhoLfo.gain.value = 1;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.15;
  const profundidade = ctx.createGain();
  profundidade.gain.value = 0.25;
  lfo.connect(profundidade);
  profundidade.connect(ganhoLfo.gain);

  ruido.connect(lowpass);
  lowpass.connect(ganhoMurmurio);
  ganhoMurmurio.connect(ganhoLfo);
  ganhoLfo.connect(master);

  ruido.start();
  lfo.start();
}

// ---------------------------------------------------------------------------
// Reações à store (som ligado / período)
// ---------------------------------------------------------------------------

/** Aplica o liga/desliga: fade do master + suspende/retoma o contexto. */
function aplicarSom(ligado: boolean): void {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  if (ligado) {
    void ctx.resume();
    master.gain.setTargetAtTime(GANHO_MASTER, t, 0.05);
  } else {
    master.gain.setTargetAtTime(0, t, 0.05);
    // Suspende após o fade (~0,3 s) para parar os nós sem clique.
    window.setTimeout(() => {
      if (!useSchoolStore.getState().somLigado) void ctx?.suspend();
    }, 350);
  }
}

/** Ajusta o nível do murmúrio para o período vigente (transição suave). */
function aplicarPeriodo(p: Periodo): void {
  if (!ctx || !ganhoMurmurio) return;
  const alvo = NIVEL_MURMURIO[p] * GANHO_BASE_MURMURIO;
  ganhoMurmurio.gain.setTargetAtTime(alvo, ctx.currentTime, 0.6);
}

// ---------------------------------------------------------------------------
// Efeitos sonoros
// ---------------------------------------------------------------------------

/** Campainha escolar: quadrado 2,2 kHz + tremolo 25 Hz, ~2,5 s, sem cliques. */
function tocarSino(): void {
  if (!ctx || !master || ctx.state !== 'running') return;
  // Viagem no tempo: os sinos disparam na lógica, mas o som fica mudo.
  if (useSchoolStore.getState().viajando) return;
  const t0 = ctx.currentTime + 0.02;
  const dur = 2.5;

  const portadora = ctx.createOscillator();
  portadora.type = 'square';
  portadora.frequency.value = 2200;

  // Tremolo: ganho oscilando 0…1 a 25 Hz.
  const ganhoTremolo = ctx.createGain();
  ganhoTremolo.gain.value = 0.5;
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 25;
  const profLfo = ctx.createGain();
  profLfo.gain.value = 0.5;
  lfo.connect(profLfo);
  profLfo.connect(ganhoTremolo.gain);

  // Envelope com rampas (ataque/release curtos evitam cliques).
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(0.22, t0 + 0.02);
  env.gain.setValueAtTime(0.22, t0 + dur - 0.25);
  env.gain.linearRampToValueAtTime(0, t0 + dur);

  portadora.connect(ganhoTremolo);
  ganhoTremolo.connect(env);
  env.connect(master);

  portadora.start(t0);
  lfo.start(t0);
  portadora.stop(t0 + dur + 0.05);
  lfo.stop(t0 + dur + 0.05);
  portadora.onended = () => {
    portadora.disconnect();
    lfo.disconnect();
    ganhoTremolo.disconnect();
    env.disconnect();
  };
}

/** Thump de bola: seno ~120 Hz caindo, decay rápido. */
function thumpBola(): void {
  if (!ctx || !master || ctx.state !== 'running') return;
  const t0 = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, t0);
  osc.frequency.exponentialRampToValueAtTime(65, t0 + 0.16);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(0.16, t0 + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);

  osc.connect(env);
  env.connect(master);
  osc.start(t0);
  osc.stop(t0 + 0.22);
  osc.onended = () => {
    osc.disconnect();
    env.disconnect();
  };
}

/** Agenda thumps aleatórios (0,4–1,5 s) durante o RECREIO. */
function agendarBola(): void {
  const delay = 400 + Math.random() * 1100;
  window.setTimeout(() => {
    if (useSchoolStore.getState().periodo === 'RECREIO') thumpBola();
    agendarBola();
  }, delay);
}

/** Chirp de pássaro: 2–4 notas FM agudas e descendentes, volume baixo. */
function chirpPassaro(): void {
  if (!ctx || !master || ctx.state !== 'running') return;
  const notas = 2 + Math.floor(Math.random() * 3); // 2–4
  const base = 3000 + Math.random() * 800;
  const t0 = ctx.currentTime + 0.02;

  for (let i = 0; i < notas; i++) {
    const ti = t0 + i * 0.13;
    const freq = base * (1 - i * 0.12); // descendentes

    const port = ctx.createOscillator();
    port.type = 'sine';
    port.frequency.setValueAtTime(freq, ti);
    port.frequency.exponentialRampToValueAtTime(freq * 0.8, ti + 0.09);

    // Modulador FM (o "trilo").
    const mod = ctx.createOscillator();
    mod.frequency.value = 140;
    const profMod = ctx.createGain();
    profMod.gain.value = freq * 0.12;
    mod.connect(profMod);
    profMod.connect(port.frequency);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, ti);
    env.gain.exponentialRampToValueAtTime(0.05, ti + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, ti + 0.1);

    port.connect(env);
    env.connect(master);
    port.start(ti);
    mod.start(ti);
    port.stop(ti + 0.12);
    mod.stop(ti + 0.12);
    port.onended = () => {
      port.disconnect();
      mod.disconnect();
      env.disconnect();
      profMod.disconnect();
    };
  }
}

/** Agenda chirps aleatórios (3–8 s) fora dos períodos de aula. */
function agendarPassaros(): void {
  const delay = 3000 + Math.random() * 5000;
  window.setTimeout(() => {
    const p = useSchoolStore.getState().periodo;
    if (p !== 'AULA_1' && p !== 'AULA_2') chirpPassaro();
    agendarPassaros();
  }, delay);
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Inicializa o AudioManager (idempotente). Registra, UMA única vez:
 * - listeners de primeiro gesto (pointerdown/keydown) que criam o AudioContext;
 * - tecla M → toggleSom;
 * - inscrição no evento 'sino';
 * - inscrição na store (somLigado / periodo).
 */
export function initAudio(): void {
  if (iniciado) return;
  iniciado = true;

  // Cria o AudioContext no primeiro gesto do usuário (política de autoplay).
  const gesto = () => {
    window.removeEventListener('pointerdown', gesto);
    window.removeEventListener('keydown', gesto);
    garantirContexto();
  };
  window.addEventListener('pointerdown', gesto);
  window.addEventListener('keydown', gesto);

  // Tecla M liga/desliga o som.
  window.addEventListener('keydown', (e) => {
    if (!e.repeat && e.key.toLowerCase() === 'm') {
      useSchoolStore.getState().toggleSom();
    }
  });

  // Sino nos marcos da rotina.
  on('sino', () => tocarSino());

  // Reage a somLigado e período (uma única inscrição na store).
  useSchoolStore.subscribe((s, prev) => {
    if (s.somLigado !== prev.somLigado) aplicarSom(s.somLigado);
    if (s.periodo !== prev.periodo) aplicarPeriodo(s.periodo);
  });
}
