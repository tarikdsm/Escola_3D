/**
 * WalkControls.tsx — controles de caminhada em 1ª pessoa (vai DENTRO do
 * <Canvas>, montado pelo PlayerRig apenas quando modoCamera === 'andar').
 *
 * - Clique no canvas → pointer lock manual; mousemove gira yaw/pitch
 *   (pitch limitado a ±80°). Esc destrava (comportamento nativo do browser).
 * - WASD/setas movem relativo ao yaw; segurar LMB também anda para frente e
 *   segurar RMB para trás (somam ao teclado no mesmo canal frente/trás).
 *   Botão direito NUNCA abre menu de contexto no canvas.
 * - Shift corre (VEL_JOGADOR × 1,8); aceleração suavizada por lerp exponencial.
 * - Sem gravidade: a altura dos olhos é chaoEm(...).y + 1,6, com transição
 *   suave ao subir/descer escada. Colisão eixo a eixo via collision.ts e
 *   clamp dentro do TERRENO.
 * - Convenção escrita em playerState.pos: posição dos PÉS (y = piso sob os
 *   pés; olhos = y + 1,6). playerState.andar acompanha o chão calculado.
 * - Não faz subscribe à store: lê modoCamera via getState() no loop.
 */

import { useEffect, useRef } from 'react';
import { Euler } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { CONST, TERRENO } from '../contracts/layout';
import { playerState } from '../contracts/simBuffer';
import type { Andar, Vec3 } from '../contracts/types';
import { useSchoolStore } from '../state/useSchoolStore';
import { chaoEm, moverComColisao } from './collision';

const RAIO_JOGADOR = 0.35;
const ALTURA_OLHOS = 1.6;
const SENSIBILIDADE = 0.0023; // rad por pixel de mouse
const PITCH_MAX = (80 * Math.PI) / 180;
const MARGEM_TERRENO = 0.6;
const FATOR_CORRER = 1.8;

// Scratch para ler a orientação atual da câmera no mount (sem alocar).
const scratchEuler = new Euler();

export function WalkControls() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  const teclas = useRef<Set<string>>(new Set());
  // Botões do mouse segurados (0 = esquerdo → frente; 2 = direito → trás).
  const botoes = useRef<Set<number>>(new Set());
  // Posição dos PÉS. O spawn do contrato ([0, 1.6, 30]) é altura dos OLHOS;
  // chaoEm resolve o piso correto também nas remontagens (aéreo → andar).
  const pes = useRef<Vec3>([0, 0, 30]);
  const vel = useRef<Vec3>([0, 0, 0]);
  const yaw = useRef(0);
  const pitch = useRef(0);
  // Scratches reutilizados no loop (sem alocação por frame).
  const tmpDesejado = useRef<Vec3>([0, 0, 0]);
  const tmpResolvido = useRef<Vec3>([0, 0, 0]);
  const tmpChao = useRef<{ y: number; andar: Andar }>({ y: 0, andar: 0 });

  // Estado inicial derivado do playerState (uma vez por montagem).
  useEffect(() => {
    const chao = chaoEm(playerState.pos[0], playerState.pos[2], playerState.pos[1]);
    pes.current[0] = playerState.pos[0];
    pes.current[1] = chao.y;
    pes.current[2] = playerState.pos[2];
    // Preserva a orientação atual da câmera (ex.: ao voltar do modo voar):
    // decompõe o quaternion em YXZ em vez de zerar yaw/pitch.
    scratchEuler.setFromQuaternion(camera.quaternion, 'YXZ');
    yaw.current = scratchEuler.y;
    pitch.current = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, scratchEuler.x));
    camera.rotation.order = 'YXZ';
    camera.position.set(pes.current[0], pes.current[1] + ALTURA_OLHOS, pes.current[2]);
    camera.rotation.set(pitch.current, yaw.current, 0);
  }, [camera]);

  // Teclado + botões do mouse + pointer lock manual + mouse look.
  useEffect(() => {
    const canvas = gl.domElement;

    const onKeyDown = (e: KeyboardEvent) => {
      teclas.current.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      teclas.current.delete(e.code);
    };
    const onBlur = () => {
      teclas.current.clear();
      botoes.current.clear();
    };
    const onClick = () => {
      if (useSchoolStore.getState().modoCamera !== 'andar') return;
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
    };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      yaw.current -= e.movementX * SENSIBILIDADE;
      pitch.current = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, pitch.current - e.movementY * SENSIBILIDADE));
    };
    // Segurar LMB/RMB também anda (com e sem pointer lock).
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0 || e.button === 2) botoes.current.add(e.button);
    };
    const onMouseUp = (e: MouseEvent) => {
      botoes.current.delete(e.button);
    };
    const onMouseLeave = () => botoes.current.clear();
    // Botão direito nunca abre menu de contexto no canvas.
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('mousemove', onMouseMove);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('mousemove', onMouseMove);
      teclas.current.clear();
      botoes.current.clear();
      // Ao sair do modo a pé, devolve o mouse (OrbitControls precisa dele).
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
  }, [gl]);

  useFrame((_, dtBruto) => {
    if (useSchoolStore.getState().modoCamera !== 'andar') return;
    const dt = Math.min(dtBruto, 0.05); // evita saltos ao trocar de aba

    // --- Entrada (WASD/setas + botões do mouse) ---
    const t = teclas.current;
    let ix = 0;
    let iz = 0;
    if (t.has('KeyW') || t.has('ArrowUp')) iz += 1;
    if (t.has('KeyS') || t.has('ArrowDown')) iz -= 1;
    if (t.has('KeyA') || t.has('ArrowLeft')) ix -= 1;
    if (t.has('KeyD') || t.has('ArrowRight')) ix += 1;
    // Botões do mouse somam no mesmo canal frente/trás (LMB = W, RMB = S).
    if (botoes.current.has(0)) iz += 1;
    if (botoes.current.has(2)) iz -= 1;
    const correndo = t.has('ShiftLeft') || t.has('ShiftRight');
    const velAlvo = CONST.VEL_JOGADOR * (correndo ? FATOR_CORRER : 1);

    // Direção relativa ao yaw: frente = (−sin, 0, −cos); direita = (cos, 0, −sin).
    let alvoX = 0;
    let alvoZ = 0;
    if (ix !== 0 || iz !== 0) {
      const inv = 1 / Math.hypot(ix, iz);
      const sin = Math.sin(yaw.current);
      const cos = Math.cos(yaw.current);
      alvoX = (-sin * iz + cos * ix) * inv * velAlvo;
      alvoZ = (-cos * iz - sin * ix) * inv * velAlvo;
    }

    // Aceleração suave (lerp exponencial em direção à velocidade-alvo).
    const k = 1 - Math.exp(-10 * dt);
    vel.current[0] += (alvoX - vel.current[0]) * k;
    vel.current[2] += (alvoZ - vel.current[2]) * k;

    // --- Movimento com colisão eixo a eixo ---
    const p = pes.current;
    tmpDesejado.current[0] = p[0] + vel.current[0] * dt;
    tmpDesejado.current[1] = p[1];
    tmpDesejado.current[2] = p[2] + vel.current[2] * dt;
    moverComColisao(p, tmpDesejado.current, RAIO_JOGADOR, tmpResolvido.current);

    // Clamp dentro do terreno.
    const nx = Math.max(TERRENO.minX + MARGEM_TERRENO, Math.min(TERRENO.maxX - MARGEM_TERRENO, tmpResolvido.current[0]));
    const nz = Math.max(TERRENO.minZ + MARGEM_TERRENO, Math.min(TERRENO.maxZ - MARGEM_TERRENO, tmpResolvido.current[2]));

    // --- Altura do chão (rampa/laje/térreo) com transição suave ---
    const chao = chaoEm(nx, nz, p[1], tmpChao.current);
    let ny: number;
    if (Math.abs(chao.y - p[1]) > 1.5) {
      ny = chao.y; // salto grande (spawn/troca de modo): ajusta na hora
    } else {
      const kv = 1 - Math.exp(-12 * dt);
      ny = p[1] + (chao.y - p[1]) * kv;
    }
    p[0] = nx;
    p[1] = ny;
    p[2] = nz;

    // --- Publica o estado (pos = PÉS) e move a câmera para os olhos ---
    playerState.pos[0] = nx;
    playerState.pos[1] = ny;
    playerState.pos[2] = nz;
    playerState.andar = chao.andar;

    camera.position.set(nx, ny + ALTURA_OLHOS, nz);
    camera.rotation.set(pitch.current, yaw.current, 0);
  });

  return null; // controle puro: nada é renderizado
}
