/**
 * TimeSlider.tsx — controle de VIAGEM NO TEMPO no rodapé da tela (componente
 * DOM comum, montado FORA do <Canvas>, centro inferior).
 *
 * - Trilho absoluto do dia letivo (7h00–23h00, de CONST.HORA_ABERTURA/
 *   HORA_FECHAMENTO) com faixas coloridas sutis por turno e ticks nos
 *   horários de sino (ambos derivados da ROTINA — nada hardcoded);
 * - arrastar para a direita viaja ao futuro, para a esquerda ao passado
 *   (reset das 7h + replay — ver simulation/viagemTempo.ts); um novo arraste
 *   durante a viagem REDEFINE o alvo; botões ◀ ▶ pulam ±30 min;
 * - thumb com bolha HH:MM enquanto arrasta; marcador fino mostra o horário
 *   atual do relógio; durante a viagem, preenchimento de progresso animado
 *   (origem → relógio) + texto "Viajando para HH:MM…";
 * - relógio e progresso lidos por POLLING de 100 ms em
 *   useSchoolStore.getState().clockMin (NUNCA subscribe — muda a cada frame,
 *   padrão do HUD.tsx); apenas `viajando`/`minutoAlvoViagem` (baixa
 *   frequência) são assinados;
 * - recolhível: o botão "−" colapsa o slider num chip "🕒 Tempo" (estado em
 *   `paineisOcultos.tempo` da store — no touch os painéis abrem recolhidos).
 */

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { CONST } from '../contracts/layout';
import { ROTINA, type Turno } from '../contracts/routine';
import { inicioViagem, progressoViagem } from '../simulation/viagemTempo';
import { useSchoolStore } from '../state/useSchoolStore';
import './ui.css';

const MIN = CONST.HORA_ABERTURA; // 7h00
const MAX = CONST.HORA_FECHAMENTO; // 23h00
const PASSO_BOTAO_MIN = 30; // botões ◀ ▶ (±30 min)
const PASSO_SETA_MIN = 5; // setas do teclado (±5 min)
const INTERVALO_REDISPARO_MS = 150; // re-disparo do alvo durante o arraste

/** Formata minutos desde 00:00 como "HH:MM". */
function hhmm(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = Math.floor(minutos % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Posição percentual (0–100) de um minuto no trilho. */
function pct(minuto: number): number {
  return ((minuto - MIN) / (MAX - MIN)) * 100;
}

const ROTULOS_TURNO: Record<Turno, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
};

/** Faixas dos turnos: da CHEGADA de cada turno até a CHEGADA do seguinte. */
const FAIXAS_TURNO: readonly { turno: Turno; inicio: number; fim: number }[] = (() => {
  const chegadas = ROTINA.filter((r) => r.periodo === 'CHEGADA');
  return chegadas.map((c, i) => ({
    turno: c.turno,
    inicio: c.inicioMin,
    fim: i + 1 < chegadas.length ? chegadas[i + 1].inicioMin : MAX,
  }));
})();

/** Ticks dos horários de sino (marcos da ROTINA com sino=true). */
const SINOS: readonly number[] = ROTINA.filter((r) => r.sino).map((r) => r.inicioMin);

export function TimeSlider() {
  // Baixa frequência: subscribe. Alta frequência (clockMin): polling abaixo.
  const viajando = useSchoolStore((s) => s.viajando);
  const alvoViagemStore = useSchoolStore((s) => s.minutoAlvoViagem);
  const viajarPara = useSchoolStore((s) => s.viajarPara);
  const oculto = useSchoolStore((s) => !!s.paineisOcultos.tempo);
  const togglePainel = useSchoolStore((s) => s.togglePainel);

  // Relógio e progresso da viagem por intervalo próprio (padrão do HUD).
  const [relogio, setRelogio] = useState(() => useSchoolStore.getState().clockMin);
  const [progresso, setProgresso] = useState(1);
  useEffect(() => {
    const id = window.setInterval(() => {
      const c = useSchoolStore.getState().clockMin;
      setRelogio(c);
      setProgresso(progressoViagem(c));
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  // Arraste do thumb (pointer events com capture no trilho).
  const trilhoRef = useRef<HTMLDivElement>(null);
  const [arraste, setArraste] = useState<number | null>(null); // minuto sob o ponteiro
  const ultimoDisparo = useRef(0);

  const minutoDoPonteiro = (clientX: number): number => {
    const el = trilhoRef.current;
    if (!el) return MIN;
    const r = el.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return Math.round(MIN + t * (MAX - MIN));
  };

  /** Define/redefine o alvo da viagem (novo arraste cancela a anterior). */
  const disparar = (minuto: number) => {
    viajarPara(minuto);
    ultimoDisparo.current = performance.now();
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const minuto = minutoDoPonteiro(e.clientX);
    setArraste(minuto);
    disparar(minuto);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (arraste === null) return;
    const minuto = minutoDoPonteiro(e.clientX);
    setArraste(minuto);
    // Arraste fluido: re-dispara no máximo a cada 150 ms (sem thrash de reset).
    if (performance.now() - ultimoDisparo.current >= INTERVALO_REDISPARO_MS) {
      disparar(minuto);
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (arraste === null) return;
    setArraste(null);
    disparar(minutoDoPonteiro(e.clientX)); // alvo final exato
  };

  const onPointerCancel = () => setArraste(null);

  // Teclado no trilho: ←/→ ±5 min, PageUp/PageDown ±30 min, Home/End pontas.
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const base = arraste ?? alvoViagemStore ?? relogio;
    let destino: number | null = null;
    if (e.key === 'ArrowLeft') destino = base - PASSO_SETA_MIN;
    else if (e.key === 'ArrowRight') destino = base + PASSO_SETA_MIN;
    else if (e.key === 'PageDown') destino = base - PASSO_BOTAO_MIN;
    else if (e.key === 'PageUp') destino = base + PASSO_BOTAO_MIN;
    else if (e.key === 'Home') destino = MIN;
    else if (e.key === 'End') destino = MAX;
    if (destino === null) return;
    e.preventDefault();
    viajarPara(destino); // o clamp 7h–23h é aplicado na store
  };

  /** Botões ◀ ▶: ±30 min a partir do alvo da viagem (ou do relógio atual). */
  const passoBotao = (deltaMin: number) => {
    viajarPara((alvoViagemStore ?? relogio) + deltaMin);
  };

  // Thumb: arraste > alvo da viagem (fixo, pulsando) > relógio (acompanha).
  const minThumb = arraste ?? (viajando && alvoViagemStore !== null ? alvoViagemStore : relogio);

  // Preenchimento animado da viagem: da origem (7h se houve reset) até o
  // ponto já perseguido (progresso 0..1 do trecho origem → alvo).
  const inicio = inicioViagem();
  const fillEsq = viajando && alvoViagemStore !== null ? pct(inicio) : 0;
  const fillLarg =
    viajando && alvoViagemStore !== null
      ? Math.max(0, pct(inicio + (alvoViagemStore - inicio) * progresso) - fillEsq)
      : 0;

  // Recolhido: vira um chip no rodapé centro (toque para reexpandir).
  if (oculto) {
    return (
      <button
        type="button"
        className="painel-chip chip-tempo"
        onClick={() => togglePainel('tempo')}
        title="Mostrar a viagem no tempo"
        aria-label="Mostrar a viagem no tempo"
      >
        🕒 Tempo
      </button>
    );
  }

  return (
    <div className="time-slider">
      <button
        type="button"
        className="hud-botao time-slider-botao"
        onClick={() => passoBotao(-PASSO_BOTAO_MIN)}
        title="Voltar 30 minutos"
        aria-label="Voltar 30 minutos"
      >
        ◀
      </button>

      <div className="time-slider-corpo">
        <div
          ref={trilhoRef}
          className="time-slider-trilho"
          role="slider"
          tabIndex={0}
          aria-label="Viagem no tempo do dia letivo"
          aria-valuemin={MIN}
          aria-valuemax={MAX}
          aria-valuenow={Math.round(minThumb)}
          aria-valuetext={hhmm(minThumb)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onKeyDown={onKeyDown}
        >
          <div className="time-slider-base">
            {FAIXAS_TURNO.map((f) => (
              <div
                key={f.turno}
                className={`time-slider-faixa faixa-${f.turno}`}
                style={{ left: `${pct(f.inicio)}%`, width: `${pct(f.fim) - pct(f.inicio)}%` }}
                title={`Turno da ${ROTULOS_TURNO[f.turno].toLowerCase()}: ${hhmm(f.inicio)}–${hhmm(f.fim)}`}
              />
            ))}
            {fillLarg > 0 && (
              <div
                className="time-slider-preenchimento"
                style={{ left: `${fillEsq}%`, width: `${fillLarg}%` }}
              />
            )}
          </div>

          {SINOS.map((s) => (
            <div
              key={s}
              className="time-slider-tick"
              style={{ left: `${pct(s)}%` }}
              title={`Sino às ${hhmm(s)}`}
            />
          ))}

          <div
            className="time-slider-marcador"
            style={{ left: `${pct(relogio)}%` }}
            title={`Agora: ${hhmm(relogio)}`}
          />
          <div
            className={`time-slider-thumb${viajando ? ' viajando' : ''}`}
            style={{ left: `${pct(minThumb)}%` }}
          />
          {arraste !== null && (
            <div
              className="time-slider-bolha"
              style={{ left: `${Math.min(96, Math.max(4, pct(arraste)))}%` }}
            >
              {hhmm(arraste)}
            </div>
          )}
        </div>

        <div className="time-slider-rodape">
          <span>{hhmm(MIN)}</span>
          <span className="time-slider-status" aria-live="polite">
            {viajando && alvoViagemStore !== null
              ? `Viajando para ${hhmm(alvoViagemStore)}…`
              : ''}
          </span>
          <span>{hhmm(MAX)}</span>
        </div>
      </div>

      <button
        type="button"
        className="hud-botao time-slider-botao"
        onClick={() => passoBotao(PASSO_BOTAO_MIN)}
        title="Avançar 30 minutos"
        aria-label="Avançar 30 minutos"
      >
        ▶
      </button>

      <button
        type="button"
        className="hud-botao time-slider-botao painel-min"
        onClick={() => togglePainel('tempo')}
        title="Recolher o painel"
        aria-label="Recolher o painel"
      >
        −
      </button>
    </div>
  );
}
