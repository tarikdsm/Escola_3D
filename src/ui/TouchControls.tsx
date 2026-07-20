/**
 * TouchControls.tsx — CONTROLES DE TOQUE da câmera/interação (componente DOM
 * comum, montado FORA do <Canvas>). Só existe em dispositivos com ponteiro
 * "coarse" (celular/tablet — ver usePointerCoarse): no desktop NÃO renderiza
 * nada nem instala listeners.
 *
 * - JOYSTICK VIRTUAL (canto inferior esquerdo, acima do chip/painel de
 *   pincéis): arrastar o knob num raio de 48 px alimenta entradaMover(vx, vz)
 *   — vz = −knobY normalizado (empurrar p/ cima = frente), vx = strafe;
 *   soltar zera com entradaMover(0, 0). No voo = voar na direção do olhar;
 *   possuído = andar (a semântica de sinais é de src/player/entrada.ts; os
 *   controladores leem os eixos a cada frame MESMO sem pointer lock, que não
 *   existe no mobile).
 * - ARRASTAR com 1 dedo começando NO CANVAS: olhar — girarVisao(dx, dy) com
 *   fator FATOR_OLHAR sobre os px (≈ 0,0035 rad/px efetivos; o mouse usa
 *   0,0023 rad/px nos controladores).
 * - PINÇA com 2 dedos no canvas: zoomCam pela variação da distância entre os
 *   dedos (1 px ≈ 1 unidade de zoom; ~100 unidades = 1 "notch" de rodinha).
 * - TOQUE RÁPIDO (tap: < 250 ms, deslocamento < 10 px, sem 2º dedo no gesto):
 *   interagir. Como o toque não tem pointer lock nem ESC, o tap garante o
 *   modo 'livre' (câmera fixa) e delega ao toqueTela(x, y): tocar num
 *   personagem possui (3ª pessoa — inclusive troca de alvo), tocar no vazio
 *   volta a voar (soltando o NPC, se houver).
 * - Gestos começados EM CIMA de qualquer painel/chip do HUD NÃO acionam
 *   câmera nem tap: só entram toques cujo alvo é um <canvas> (os painéis são
 *   elementos DOM irmãos — o alvo do toque é o elemento do painel).
 * - CHIP de dica ao carregar: some após 8 s ou no primeiro gesto.
 */

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { entradaMover, girarVisao, toqueTela, zoomCam } from '../player';
import { useSchoolStore } from '../state/useSchoolStore';
import { usePointerCoarse } from './usePointerCoarse';
import './ui.css';

/** Curso máximo do knob a partir do centro da base (px). */
const RAIO_JOYSTICK = 48;
/**
 * Fator do arraste de olhar sobre os "px equivalentes" da API (a mesma
 * sensibilidade do mouse é 0,0023 rad/px nos controladores): 1,5 × px do
 * toque ≈ 0,0035 rad/px efetivos — o dedo cobre a tela, então pede um giro
 * um pouco mais rápido que o mouse.
 */
const FATOR_OLHAR = 1.5;
/** px de variação da pinça → unidades de zoom (~100 unidades = 1 notch). */
const FATOR_PINCA = 1;
/** Duração máxima de um toque rápido (tap), em ms. */
const TAP_MS = 250;
/** Deslocamento máximo para o gesto ainda contar como tap (px). */
const TAP_PX = 10;
/** Tempo de exibição do chip de dica (ms). */
const DICA_MS = 8000;

/** Um dedo rastreado do gesto de câmera (olhar/pinça/tap). */
interface ToqueAtivo {
  x: number; // última posição conhecida
  y: number;
  sx: number; // posição inicial (filtro do tap)
  sy: number;
  t0: number; // timestamp do touchstart
}

export function TouchControls() {
  const coarse = usePointerCoarse();

  // Chip de dica: some no primeiro gesto (joystick/canvas) ou após DICA_MS.
  const [dica, setDica] = useState(true);
  useEffect(() => {
    const id = window.setTimeout(() => setDica(false), DICA_MS);
    return () => window.clearTimeout(id);
  }, []);

  // --- Joystick virtual (pointer events com capture na base) ---
  const baseRef = useRef<HTMLDivElement>(null);
  const joyId = useRef<number | null>(null); // pointerId dono do joystick
  const [knob, setKnob] = useState<{ x: number; y: number } | null>(null);

  /** Posiciona o knob (clamp no raio) e publica os eixos na API de entrada. */
  const aplicarJoystick = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let dx = clientX - (r.left + r.width / 2);
    let dy = clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > RAIO_JOYSTICK) {
      dx *= RAIO_JOYSTICK / d;
      dy *= RAIO_JOYSTICK / d;
    }
    setKnob({ x: dx, y: dy });
    // Convenção da API: vz > 0 = frente (knob p/ CIMA), vx > 0 = strafe p/ a direita.
    entradaMover(dx / RAIO_JOYSTICK, -dy / RAIO_JOYSTICK);
  };

  const soltarJoystick = () => {
    joyId.current = null;
    setKnob(null);
    entradaMover(0, 0);
  };

  // Segurança: se desmontar com o joystick ativo (ex.: conectaram um mouse),
  // zera os eixos para o personagem/câmera não ficarem andando sozinhos.
  useEffect(() => () => entradaMover(0, 0), []);

  const onJoyDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    joyId.current = e.pointerId;
    setDica(false);
    aplicarJoystick(e.clientX, e.clientY);
  };
  const onJoyMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (joyId.current !== e.pointerId) return;
    aplicarJoystick(e.clientX, e.clientY);
  };
  const onJoyUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (joyId.current !== e.pointerId) return;
    soltarJoystick();
  };

  // --- Gestos no canvas: olhar (1 dedo), pinça (2 dedos), tap (interagir) ---
  useEffect(() => {
    if (!coarse) return; // desktop: nenhum listener

    const toques = new Map<number, ToqueAtivo>();
    let distPinca = 0;
    // Um gesto que teve 2+ dedos suprime o tap de TODOS os dedos dele
    // (levantar os dedos de uma pinça não pode disparar interação).
    let suprimirTap = false;

    /** Só o canvas do R3F vale: toques em painéis/chips do HUD ficam de fora. */
    const ehCanvas = (t: Touch): boolean =>
      t.target instanceof HTMLElement && t.target.tagName === 'CANVAS';

    const onStart = (e: TouchEvent) => {
      let entrou = false;
      for (const t of Array.from(e.changedTouches)) {
        if (!ehCanvas(t)) continue;
        entrou = true;
        toques.set(t.identifier, {
          x: t.clientX,
          y: t.clientY,
          sx: t.clientX,
          sy: t.clientY,
          t0: performance.now(),
        });
      }
      if (!entrou) return;
      setDica(false);
      if (toques.size >= 2) {
        suprimirTap = true;
        const [a, b] = [...toques.values()];
        distPinca = Math.hypot(a.x - b.x, a.y - b.y);
      }
      // Sem clique sintético pós-toque: a interação já é tratada no tap.
      if (e.cancelable) e.preventDefault();
    };

    const onMove = (e: TouchEvent) => {
      let mudou = false;
      for (const t of Array.from(e.changedTouches)) {
        const reg = toques.get(t.identifier);
        if (!reg) continue;
        mudou = true;
        if (toques.size === 1) {
          girarVisao((t.clientX - reg.x) * FATOR_OLHAR, (t.clientY - reg.y) * FATOR_OLHAR);
        }
        reg.x = t.clientX;
        reg.y = t.clientY;
      }
      if (!mudou) return;
      if (toques.size >= 2) {
        const [a, b] = [...toques.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        zoomCam((d - distPinca) * FATOR_PINCA);
        distPinca = d;
      }
      // O gesto de câmera nunca rola/zooma a página.
      if (e.cancelable) e.preventDefault();
    };

    const onEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        const reg = toques.get(t.identifier);
        if (!reg) continue;
        toques.delete(t.identifier);
        const dur = performance.now() - reg.t0;
        const desl = Math.hypot(t.clientX - reg.sx, t.clientY - reg.sy);
        if (toques.size === 0) {
          // Tap: rápido, sem arrastar e sem ter havido 2º dedo no gesto.
          if (!suprimirTap && dur < TAP_MS && desl < TAP_PX) {
            const st = useSchoolStore.getState();
            if (st.modoCam !== 'livre') st.entrarLivre(); // ver cabeçalho
            toqueTela(t.clientX, t.clientY);
          }
          suprimirTap = false;
        }
      }
      if (toques.size < 2) distPinca = 0;
    };

    window.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
      toques.clear();
    };
  }, [coarse]);

  if (!coarse) return null; // desktop: nada é renderizado

  return (
    <>
      <div
        ref={baseRef}
        className="joy-base"
        aria-label="Joystick de movimento"
        onPointerDown={onJoyDown}
        onPointerMove={onJoyMove}
        onPointerUp={onJoyUp}
        onPointerCancel={onJoyUp}
      >
        <div
          className="joy-knob"
          style={{
            transform: knob
              ? `translate(-50%, -50%) translate(${knob.x}px, ${knob.y}px)`
              : 'translate(-50%, -50%)',
          }}
        />
      </div>

      {dica && (
        <div className="toque-dica" role="status">
          Joystick: mover · arrastar: olhar · pinça: zoom · tocar: interagir
        </div>
      )}
    </>
  );
}
