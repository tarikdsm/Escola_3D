/**
 * pointerLock.ts — pedido de trava do ponteiro (pointer lock) no canvas.
 *
 * Os browsers exigem gesto do usuário (por isso esta função só é chamada de
 * handlers de clique/toque) e impõem um cooldown após saída por ESC: falhas
 * são engolidas aqui — o próximo clique tenta de novo e o evento
 * 'pointerlockerror' é tratado no PlayerRig (modo 'possuido' volta a 'livre',
 * preservando a posse).
 */

/** Pede a trava do ponteiro no canvas (idempotente; falhas ignoradas). */
export function pedirTravaPointer(canvas: HTMLCanvasElement): void {
  if (document.pointerLockElement === canvas) return;
  try {
    // TS: conforme a versão da lib.dom, o retorno é Promise<void> ou void.
    const req = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
    if (req && typeof req.catch === 'function') req.catch(() => {});
  } catch {
    /* cooldown do browser — o próximo clique tenta de novo */
  }
}
