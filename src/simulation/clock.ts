/**
 * clock.ts — RELÓGIO acelerado e wrap diário.
 *
 * A cada frame: delta real × CONST.ESCALA_TEMPO (10 s de jogo por 1 s real)
 * × velocidade (store: 1×/2×/4×) → minutos de jogo → tickClock da store,
 * que já emite os eventos 'sino'/'periodo' ao cruzar os marcos da ROTINA
 * e trava em HORA_FECHAMENTO (12h00 = 720 min).
 *
 * WRAP DIÁRIO (decisão documentada, simplificação permitida pela missão):
 * quando o relógio atinge 720, o dia reinicia IMEDIATAMENTE em 420 (7h00),
 * sem esperar todos saírem — os personagens são reposicionados nos pontos
 * de spawn/postos (resetDia) e o ciclo CHEGADA recomeça. Como `tickClock`
 * só AVANÇA o relógio (contrato), o retrocesso 720→420 é feito com
 * `useSchoolStore.setState` direto + emissão manual do evento 'periodo'.
 */
import { emit } from '../contracts/events';
import { CONST } from '../contracts/layout';
import { periodoPara } from '../contracts/routine';
import { useSchoolStore } from '../state/useSchoolStore';
import { resetDia, type Mundo } from './estado';

/**
 * Avança o relógio de um frame e devolve o delta em SEGUNDOS DE JOGO
 * (0 no frame do wrap — o movimento é pulado nesse frame).
 */
export function passoRelogio(m: Mundo, dtReal: number): number {
  const st = useSchoolStore.getState();
  if (st.clockMin >= CONST.HORA_FECHAMENTO) {
    wrapDia(m);
    return 0;
  }
  const dtJogo = dtReal * CONST.ESCALA_TEMPO * st.velocidade;
  st.tickClock(dtJogo / 60);
  m.clockMin = useSchoolStore.getState().clockMin;
  return dtJogo;
}

/** Reinicia o dia: 12h → 7h, todos de volta aos pontos de origem. */
function wrapDia(m: Mundo): void {
  resetDia(m);
  useSchoolStore.setState({
    clockMin: CONST.HORA_ABERTURA,
    periodo: periodoPara(CONST.HORA_ABERTURA),
  });
  emit('periodo', 'CHEGADA');
  m.clockMin = CONST.HORA_ABERTURA;
}
