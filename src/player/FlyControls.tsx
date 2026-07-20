/**
 * FlyControls.tsx — voo livre (modo 'voar', tecla F), vai DENTRO do <Canvas>,
 * montado pelo PlayerRig apenas quando modoCamera === 'voar'.
 *
 * - Mouse look igual ao WalkControls: clique no canvas → pointer lock manual;
 *   mousemove gira yaw/pitch (pitch até ±89°, quase a vertical). Esc destrava
 *   (comportamento nativo do browser).
 * - Voo SEM colisão e SEM chão (atravessa paredes/telhado):
 *   frente = direção do OLHAR (yaw+pitch) com W/seta-cima ou LMB segurado;
 *   trás com S/seta-baixo ou RMB segurado; A/D (e setas) strafam;
 *   Espaço sobe (Y mundo), ControlLeft ou C desce; Shift = rápido
 *   (~20 m/s; base ~8 m/s). Mesma suavização exponencial do WalkControls
 *   (k = 1 − exp(−10·dt)). Botão direito NUNCA abre menu de contexto.
 * - Clamp de segurança para não se perder: x/z dentro de TERRENO ± 40;
 *   y entre 0,3 e 80.
 * - Convenção de escrita: playerState.pos = [x, y − 1,6, z] e
 *   playerState.andar derivado dessa altura — ATENÇÃO: no voo, pos NÃO são
 *   pés reais (é só para a simulação localizar o jogador).
 * - Não faz subscribe à store: lê modoCamera via getState() no loop/listeners.
 */

import { useEffect, useRef } from 'react';
import { Euler } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { TERRENO } from '../contracts/layout';
import { playerState } from '../contracts/simBuffer';
import type { Vec3 } from '../contracts/types';
import { useSchoolStore } from '../state/useSchoolStore';

const SENSIBILIDADE = 0.0023; // rad por pixel de mouse (igual ao WalkControls)
const PITCH_MAX = (89 * Math.PI) / 180;
const VEL_BASE = 8; // m/s
const VEL_RAPIDA = 20; // m/s com Shift
const MARGEM_VOO = 40; // folga além do TERRENO em x/z
const Y_MIN = 0.3;
const Y_MAX = 80;
const ALTURA_OLHOS = 1.6; // só para a convenção de playerState.pos (ver acima)

// Scratch para ler a orientação atual da câmera no mount (sem alocar).
const scratchEuler = new Euler();

export function FlyControls() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  const teclas = useRef<Set<string>>(new Set());
  // Botões do mouse segurados (0 = esquerdo → frente; 2 = direito → trás).
  const botoes = useRef<Set<number>>(new Set());
  // Posição da CÂMERA (olhos). O voo não tem pés nem chão.
  const pos = useRef<Vec3>([0, 0, 0]);
  const vel = useRef<Vec3>([0, 0, 0]);
  const yaw = useRef(0);
  const pitch = useRef(0);

  // Estado inicial: a câmera continua de onde está (posição E orientação),
  // para a transição andar/aéreo → voar ser contínua.
  useEffect(() => {
    pos.current[0] = camera.position.x;
    pos.current[1] = camera.position.y;
    pos.current[2] = camera.position.z;
    scratchEuler.setFromQuaternion(camera.quaternion, 'YXZ');
    yaw.current = scratchEuler.y;
    pitch.current = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, scratchEuler.x));
    vel.current[0] = 0;
    vel.current[1] = 0;
    vel.current[2] = 0;
    camera.rotation.order = 'YXZ';
    camera.rotation.set(pitch.current, yaw.current, 0);
  }, [camera]);

  // Teclado + botões do mouse + pointer lock manual + mouse look.
  useEffect(() => {
    const canvas = gl.domElement;

    const onKeyDown = (e: KeyboardEvent) => {
      // Evita que o Espaço role a página enquanto voa.
      if (e.code === 'Space') e.preventDefault();
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
      if (useSchoolStore.getState().modoCamera !== 'voar') return;
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
    };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      yaw.current -= e.movementX * SENSIBILIDADE;
      pitch.current = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, pitch.current - e.movementY * SENSIBILIDADE));
    };
    // Segurar LMB/RMB também voa para frente/trás (com e sem pointer lock).
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
      // Ao sair do voo, devolve o mouse (OrbitControls precisa dele).
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
  }, [gl]);

  useFrame((_, dtBruto) => {
    if (useSchoolStore.getState().modoCamera !== 'voar') return;
    const dt = Math.min(dtBruto, 0.05); // evita saltos ao trocar de aba

    // --- Entrada (WASD/setas + botões do mouse + vertical) ---
    const t = teclas.current;
    let ix = 0;
    let iy = 0;
    let iz = 0;
    if (t.has('KeyW') || t.has('ArrowUp')) iz += 1;
    if (t.has('KeyS') || t.has('ArrowDown')) iz -= 1;
    if (t.has('KeyA') || t.has('ArrowLeft')) ix -= 1;
    if (t.has('KeyD') || t.has('ArrowRight')) ix += 1;
    if (t.has('Space')) iy += 1;
    if (t.has('ControlLeft') || t.has('KeyC')) iy -= 1;
    if (botoes.current.has(0)) iz += 1;
    if (botoes.current.has(2)) iz -= 1;
    const rapido = t.has('ShiftLeft') || t.has('ShiftRight');
    const velMax = rapido ? VEL_RAPIDA : VEL_BASE;

    // Frente = direção do olhar (yaw+pitch); strafe fica no plano horizontal.
    const sinY = Math.sin(yaw.current);
    const cosY = Math.cos(yaw.current);
    const sinP = Math.sin(pitch.current);
    const cosP = Math.cos(pitch.current);
    const fx = -sinY * cosP;
    const fy = sinP;
    const fz = -cosY * cosP;
    const rx = cosY;
    const rz = -sinY;

    let alvoX = fx * iz + rx * ix;
    let alvoY = fy * iz + iy;
    let alvoZ = fz * iz + rz * ix;
    const comp = Math.hypot(alvoX, alvoY, alvoZ);
    if (comp > 1) {
      // Diagonais não ficam mais rápidas.
      const inv = 1 / comp;
      alvoX *= inv;
      alvoY *= inv;
      alvoZ *= inv;
    }
    alvoX *= velMax;
    alvoY *= velMax;
    alvoZ *= velMax;

    // Aceleração suave (lerp exponencial, igual ao WalkControls).
    const k = 1 - Math.exp(-10 * dt);
    vel.current[0] += (alvoX - vel.current[0]) * k;
    vel.current[1] += (alvoY - vel.current[1]) * k;
    vel.current[2] += (alvoZ - vel.current[2]) * k;

    // --- Movimento livre, com clamp de segurança para não se perder ---
    const p = pos.current;
    p[0] = Math.max(TERRENO.minX - MARGEM_VOO, Math.min(TERRENO.maxX + MARGEM_VOO, p[0] + vel.current[0] * dt));
    p[1] = Math.max(Y_MIN, Math.min(Y_MAX, p[1] + vel.current[1] * dt));
    p[2] = Math.max(TERRENO.minZ - MARGEM_VOO, Math.min(TERRENO.maxZ + MARGEM_VOO, p[2] + vel.current[2] * dt));

    // --- Publica o estado e move a câmera ---
    // Convenção: pos = "pés" = olhos − 1,6. NO VOO NÃO SÃO PÉS REAIS —
    // serve só para a simulação saber onde o jogador está.
    playerState.pos[0] = p[0];
    playerState.pos[1] = p[1] - ALTURA_OLHOS;
    playerState.pos[2] = p[2];
    playerState.andar = p[1] - ALTURA_OLHOS >= 2 ? 1 : 0;

    camera.position.set(p[0], p[1], p[2]);
    camera.rotation.set(pitch.current, yaw.current, 0);
  });

  return null; // controle puro: nada é renderizado
}
