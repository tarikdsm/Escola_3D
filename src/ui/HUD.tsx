/**
 * HUD.tsx — barra superior esquerda da interface (componente DOM comum,
 * montado FORA do <Canvas>).
 *
 * - Relógio digital HH:MM: clockMin muda A CADA FRAME, então NÃO fazemos
 *   subscribe — lemos `useSchoolStore.getState().clockMin` a cada 250 ms.
 * - Badge do turno + período (subscribe a `turno`/`periodo`, baixa frequência).
 * - Velocidade 1×/2×/4×, som 🔊/🔇 (M), ajuda "?" (H) e modo de câmera.
 * - Recolhível: o botão "−" colapsa a barra num chip com o relógio (estado
 *   em `paineisOcultos.hud` da store — no touch os painéis abrem recolhidos).
 * - CHIPS fixos (rodapé centro, acima do TimeSlider; estilo inline para não
 *   inchar o ui.css):
 *   - modo voo ARMADO (sem pointer lock): "Clique para voar · ESC libera
 *     o mouse" — some assim que o 1º clique trava o ponteiro. NÃO aparece
 *     no toque (mobile não tem pointer lock nem ESC — a dica é do
 *     TouchControls);
 *   - posse ativa: "Controlando: <nome> · …" — texto adaptado ao toque
 *     (toque no vazio solta e voa); no modo 'livre' inclui o botão
 *     "Soltar" (libera o NPC e fica com o mouse livre).
 * - Estado do pointer lock lido via evento 'pointerlockchange' (baixa
 *   frequência — pode ser useState).
 */

import { useEffect, useState, type CSSProperties } from 'react';
import type { Periodo } from '../contracts/types';
import type { Turno } from '../contracts/routine';
import { ROSTER } from '../contracts/roster';
import type { Velocidade } from '../contracts/store';
import { soltarPosse } from '../player/possessao';
import { useSchoolStore } from '../state/useSchoolStore';
import { useAjudaStore } from './helpStore';
import { usePointerCoarse } from './usePointerCoarse';
import './ui.css';

const ROTULOS_TURNO: Record<Turno, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
};

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

/** Rótulos e dicas (tooltip) do indicador de modo de câmera/interação. */
const ROTULOS_MODO: Record<string, string> = {
  voo: 'Voando',
  livre: 'Mouse livre',
  possuido: 'Controlando',
};

const DICAS_MODO: Record<string, string> = {
  voo: 'Mouse: direção da câmera · segurar botão esquerdo/direito: frente/trás · rodinha: zoom · Esc: liberar o mouse',
  livre:
    'Mouse livre: clique num personagem para controlá-lo (3ª pessoa) · clique no vazio para voltar a voar',
  possuido:
    'Mouse: direção do personagem · segurar botão esquerdo: andar · rodinha: zoom da câmera · Esc: mouse livre (o personagem para e continua com você)',
};

/** Estilo base dos chips do rodapé (inline: ui.css não ganha classes novas). */
const ESTILO_CHIP: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 64, // acima do TimeSlider (rodapé centro)
  transform: 'translateX(-50%)',
  zIndex: 20,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px',
  background: 'rgba(247, 242, 231, 0.94)', // paredeInterna (mesma dos painéis)
  color: '#1d3557',
  borderRadius: 999,
  boxShadow: '0 2px 10px rgba(20, 24, 40, 0.18)',
  fontSize: 13,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  userSelect: 'none',
};

/** Formata minutos desde 00:00 como "HH:MM". */
function formataRelogio(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = Math.floor(minutos % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function HUD() {
  const periodo = useSchoolStore((s) => s.periodo);
  const turno = useSchoolStore((s) => s.turno);
  const velocidade = useSchoolStore((s) => s.velocidade);
  const somLigado = useSchoolStore((s) => s.somLigado);
  const modoCam = useSchoolStore((s) => s.modoCam);
  const possuidoIdx = useSchoolStore((s) => s.possuidoIdx);
  const setVelocidade = useSchoolStore((s) => s.setVelocidade);
  const toggleSom = useSchoolStore((s) => s.toggleSom);
  const hudOculto = useSchoolStore((s) => !!s.paineisOcultos.hud);
  const togglePainel = useSchoolStore((s) => s.togglePainel);
  const toggleAjuda = useAjudaStore((s) => s.toggleAjuda);
  const toque = usePointerCoarse();

  // Pointer lock: evento de baixa frequência → useState é suficiente.
  const [travado, setTravado] = useState(false);
  useEffect(() => {
    const onLock = () => setTravado(document.pointerLockElement !== null);
    document.addEventListener('pointerlockchange', onLock);
    return () => document.removeEventListener('pointerlockchange', onLock);
  }, []);

  // Relógio: leitura por intervalo próprio (sem subscribe ao clockMin,
  // que mudaria o componente a cada frame da simulação).
  const [relogio, setRelogio] = useState(() => formataRelogio(useSchoolStore.getState().clockMin));
  useEffect(() => {
    const id = window.setInterval(() => {
      setRelogio(formataRelogio(useSchoolStore.getState().clockMin));
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  const nomePossuido =
    possuidoIdx !== null && possuidoIdx >= 0 && possuidoIdx < ROSTER.length
      ? ROSTER[possuidoIdx].nome
      : null;
  // No toque não há pointer lock: o voo nunca fica "armado" nem há ESC.
  const rotuloModo =
    modoCam === 'voo' && !travado && !toque
      ? 'Voo (clique p/ travar)'
      : (ROTULOS_MODO[modoCam] ?? modoCam);

  // Recolhido: vira um chip com o relógio (toque para reexpandir).
  if (hudOculto) {
    return (
      <button
        type="button"
        className="painel-chip chip-hud"
        onClick={() => togglePainel('hud')}
        title="Mostrar o painel"
        aria-label="Mostrar o painel"
      >
        🕒 {relogio}
      </button>
    );
  }

  return (
    <div className="hud">
      <div className="hud-grupo">
        <span className="hud-relogio">{relogio}</span>
        <span className={`hud-badge ${CLASSE_PERIODO[periodo]}`}>
          {ROTULOS_TURNO[turno]} · {ROTULOS_PERIODO[periodo]}
        </span>
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
        <span className="hud-modo" title={DICAS_MODO[modoCam]}>
          {rotuloModo}
        </span>
      </div>

      <div className="hud-grupo">
        <button
          type="button"
          className="hud-botao painel-min"
          onClick={() => togglePainel('hud')}
          title="Recolher o painel"
          aria-label="Recolher o painel"
        >
          −
        </button>
      </div>

      {/* Chip do modo voo ARMADO: some quando o 1º clique trava o ponteiro.
          No toque não existe trava — a dica de gestos é do TouchControls. */}
      {modoCam === 'voo' && !travado && !toque && (
        <div style={ESTILO_CHIP} role="status">
          Clique para voar · ESC libera o mouse
        </div>
      )}

      {/* Chip da posse: no modo 'livre' ganha o botão "Soltar" (clicável).
          No toque a saída é o tap no vazio (não há ESC). */}
      {nomePossuido !== null && (
        <div style={ESTILO_CHIP} role="status">
          {toque
            ? `Controlando: ${nomePossuido} · toque no vazio para soltar e voar`
            : modoCam === 'possuido'
              ? `Controlando: ${nomePossuido} · ESC libera o mouse (o personagem para e continua com você)`
              : `Controlando: ${nomePossuido} · clique no vazio para voar`}
          {modoCam === 'livre' && (
            <button
              type="button"
              className="hud-botao"
              onClick={soltarPosse}
              title="Liberar o personagem e ficar com o mouse livre"
            >
              Soltar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
