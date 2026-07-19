/**
 * HUD.tsx — barra superior esquerda da interface (componente DOM comum,
 * montado FORA do <Canvas>).
 *
 * - Relógio digital HH:MM: clockMin muda A CADA FRAME, então NÃO fazemos
 *   subscribe — lemos `useSchoolStore.getState().clockMin` a cada 250 ms.
 * - Badge do período (subscribe a `periodo`, baixa frequência).
 * - Velocidade 1×/2×/4×, som 🔊/🔇 (M), ajuda "?" (H) e modo de câmera.
 */

import { useEffect, useState } from 'react';
import type { Periodo } from '../contracts/types';
import type { Velocidade } from '../contracts/store';
import { useSchoolStore } from '../state/useSchoolStore';
import { useAjudaStore } from './helpStore';
import './ui.css';

const ROTULOS_PERIODO: Record<Periodo, string> = {
  CHEGADA: 'Chegada',
  AULA_1: 'Aula',
  RECREIO: 'Recreio',
  AULA_2: 'Aula',
  ALMOCO_SAIDA: 'Almoço e Saída',
};

const CLASSE_PERIODO: Record<Periodo, string> = {
  CHEGADA: 'periodo-chegada',
  AULA_1: 'periodo-aula',
  RECREIO: 'periodo-recreio',
  AULA_2: 'periodo-aula',
  ALMOCO_SAIDA: 'periodo-almoco',
};

const VELOCIDADES: readonly Velocidade[] = [1, 2, 4];

/**
 * Rótulo do indicador de modo e dica (tooltip) com os gestos do mouse.
 * Mapa por string (e não Record<ModoCamera, …>) para compilar mesmo durante
 * a transição do tipo para 'andar' | 'aereo' | 'voar'.
 */
const ROTULOS_MODO: Record<string, string> = {
  andar: 'Caminhando',
  aereo: 'Aéreo (Tab)',
  voar: 'Voando (F)',
};

const DICAS_MODO: Record<string, string> = {
  andar:
    'Segurar botão esquerdo/direito do mouse ou W/S: frente/trás · Shift: correr · Tab: vista aérea · F: voar',
  aereo:
    'Segurar botão esquerdo/direito do mouse: avançar/recuar · rodinha: zoom · botão do meio: girar · Tab: caminhar · F: voar',
  voar:
    'Voo livre (atravessa paredes e telhado) · Espaço/Ctrl: subir/descer · F ou Tab: sair do voo',
};

/** Formata minutos desde 00:00 como "HH:MM". */
function formataRelogio(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = Math.floor(minutos % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function HUD() {
  const periodo = useSchoolStore((s) => s.periodo);
  const velocidade = useSchoolStore((s) => s.velocidade);
  const somLigado = useSchoolStore((s) => s.somLigado);
  const modoCamera = useSchoolStore((s) => s.modoCamera);
  const setVelocidade = useSchoolStore((s) => s.setVelocidade);
  const toggleSom = useSchoolStore((s) => s.toggleSom);
  const toggleAjuda = useAjudaStore((s) => s.toggleAjuda);

  // Relógio: leitura por intervalo próprio (sem subscribe ao clockMin,
  // que mudaria o componente a cada frame da simulação).
  const [relogio, setRelogio] = useState(() => formataRelogio(useSchoolStore.getState().clockMin));
  useEffect(() => {
    const id = window.setInterval(() => {
      setRelogio(formataRelogio(useSchoolStore.getState().clockMin));
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="hud">
      <div className="hud-grupo">
        <span className="hud-relogio">{relogio}</span>
        <span className={`hud-badge ${CLASSE_PERIODO[periodo]}`}>{ROTULOS_PERIODO[periodo]}</span>
      </div>

      <div className="hud-grupo" role="group" aria-label="Velocidade da simulação">
        {VELOCIDADES.map((v) => (
          <button
            key={v}
            type="button"
            className={`hud-botao${velocidade === v ? ' ativo' : ''}`}
            onClick={() => setVelocidade(v)}
            title={`Velocidade ${v}×`}
          >
            {v}×
          </button>
        ))}
      </div>

      <div className="hud-grupo">
        <button
          type="button"
          className="hud-botao"
          onClick={toggleSom}
          title={somLigado ? 'Desligar o som (M)' : 'Ligar o som (M)'}
        >
          {somLigado ? '🔊' : '🔇'}
        </button>
        <button type="button" className="hud-botao" onClick={toggleAjuda} title="Ajuda (H)">
          ?
        </button>
      </div>

      <div className="hud-grupo">
        <span className="hud-modo" title={DICAS_MODO[modoCamera]}>
          {ROTULOS_MODO[modoCamera] ?? modoCamera}
        </span>
      </div>
    </div>
  );
}
