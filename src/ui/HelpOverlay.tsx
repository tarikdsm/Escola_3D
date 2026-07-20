/**
 * HelpOverlay.tsx — modal central de ajuda (componente DOM comum, montado
 * FORA do <Canvas>).
 *
 * Visibilidade na store local `useAjudaStore` (botão "?" do HUD também usa).
 * Teclas: H ou ? alternam; Esc fecha. O listener de keydown é registrado
 * uma única vez no mount do componente e removido no unmount — por isso o
 * componente deve ficar montado sempre (retorna null quando fechado).
 *
 * O mapa de controles é LOCAL (antes vinha de comandos.ts, removido com o
 * antigo ControlsPanel): descreve o modelo mouse-first — voo (padrão),
 * mouse livre (ESC) e 3ª pessoa (clique em personagem), SEM teclado de
 * movimento — mais a seção "No celular/toque" com os gestos do
 * TouchControls (joystick, arrastar, pinça, toque).
 */

import { Fragment, useEffect } from 'react';
import { useAjudaStore } from './helpStore';
import './ui.css';

interface ItemAjuda {
  /** Teclas exibidas como chips <kbd> (ex.: ['Esc']). */
  teclas?: string[];
  /** Texto entre os chips (ex.: 'ou' em H ou ?). */
  juncao?: string;
  /** Rótulo livre quando o comando é um gesto de mouse (ex.: 'Mouse'). */
  rotulo?: string;
  /** O que o comando faz. */
  acao: string;
}

interface SecaoAjuda {
  titulo: string;
  itens: ItemAjuda[];
}

/** Mapa de controles do modelo mouse-first (única fonte — este overlay). */
const SECOES: SecaoAjuda[] = [
  {
    titulo: 'Voando (modo padrão)',
    itens: [
      { rotulo: 'Clique na tela', acao: 'travar o mouse e voar (a câmera atravessa paredes)' },
      { rotulo: 'Mouse', acao: 'direção da câmera' },
      { rotulo: 'Segurar botão esquerdo', acao: 'mover para frente (na direção do olhar)' },
      { rotulo: 'Segurar botão direito', acao: 'mover para trás' },
      { rotulo: 'Rodinha do mouse', acao: 'zoom (aproximar / afastar)' },
      { teclas: ['Esc'], acao: 'liberar o mouse (a câmera para onde está)' },
    ],
  },
  {
    titulo: 'Mouse livre (após Esc)',
    itens: [
      { rotulo: 'Clique num personagem', acao: 'controlá-lo em 3ª pessoa (possuir)' },
      { rotulo: 'Clique no vazio', acao: 'voltar a voar (libera o personagem, se estiver controlando)' },
      { rotulo: 'Botão "Soltar" (no HUD)', acao: 'liberar o personagem e continuar com o mouse livre' },
    ],
  },
  {
    titulo: 'Controlando um personagem (3ª pessoa)',
    itens: [
      { rotulo: 'Mouse', acao: 'direção do personagem no plano (ele não voa)' },
      { rotulo: 'Segurar botão esquerdo', acao: 'andar para frente' },
      { rotulo: 'Rodinha do mouse', acao: 'zoom da câmera (que segue atrás e acima)' },
      {
        teclas: ['Esc'],
        acao: 'liberar o mouse: o personagem para, mas continua com você',
      },
    ],
  },
  {
    titulo: 'No celular/toque',
    itens: [
      { rotulo: 'Joystick (canto inferior esquerdo)', acao: 'mover — voar na direção do olhar ou andar com o personagem' },
      { rotulo: 'Arrastar na tela', acao: 'olhar ao redor' },
      { rotulo: 'Pinça com dois dedos', acao: 'zoom (aproximar / afastar)' },
      { rotulo: 'Toque num personagem', acao: 'controlá-lo em 3ª pessoa (possuir)' },
      { rotulo: 'Toque no vazio', acao: 'voltar a voar (solta o personagem, se estiver controlando)' },
      { rotulo: 'Botão "−" nos painéis', acao: 'recolher o painel num chip; toque no chip para reabrir' },
    ],
  },
  {
    titulo: 'Geral',
    itens: [
      { teclas: ['M'], acao: 'ligar / desligar sons' },
      { teclas: ['H', '?'], juncao: 'ou', acao: 'abrir / fechar a ajuda' },
      { rotulo: 'Botões 1× 2× 4× (HUD)', acao: 'velocidade da simulação' },
      { rotulo: 'Slider do rodapé', acao: 'viajar no tempo do dia letivo (7h–23h)' },
    ],
  },
];

export function HelpOverlay() {
  const aberta = useAjudaStore((s) => s.ajudaAberta);
  const setAjuda = useAjudaStore((s) => s.setAjuda);
  const toggleAjuda = useAjudaStore((s) => s.toggleAjuda);

  // Atalhos de teclado (registrados uma vez; removidos no unmount).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'h' || e.key === '?') {
        toggleAjuda();
      } else if (e.key === 'Escape' && useAjudaStore.getState().ajudaAberta) {
        setAjuda(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleAjuda, setAjuda]);

  if (!aberta) return null;

  return (
    <div className="ajuda-fundo" onClick={() => setAjuda(false)}>
      <div
        className="ajuda-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Ajuda"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="ajuda-fechar"
          onClick={() => setAjuda(false)}
          title="Fechar (Esc)"
          aria-label="Fechar ajuda"
        >
          ✕
        </button>

        <h1>Explorador de Escola Virtual Brasileira 3D</h1>

        {/* Mapa de controles do modelo mouse-first (fonte local, ver acima). */}
        {SECOES.map((secao) => (
          <Fragment key={secao.titulo}>
            <h2>{secao.titulo}</h2>
            <ul className="ajuda-controles">
              {secao.itens.map((item) => (
                <li key={item.rotulo ?? item.teclas?.join('+') ?? item.acao}>
                  <span className="teclas">
                    {item.teclas?.map((t, i) => (
                      <span key={t}>
                        {i > 0 && item.juncao ? ` ${item.juncao} ` : ''}
                        <kbd>{t}</kbd>
                      </span>
                    ))}
                    {item.rotulo}
                  </span>
                  {item.acao}
                </li>
              ))}
            </ul>
          </Fragment>
        ))}

        <h2>Sobre a simulação</h2>
        <p>
          A escola vive três turnos por dia — manhã, tarde e noite, das 7h às 23h: os
          alunos chegam pela rua, assistem às aulas, saem para o recreio quando o sino
          toca e vão embora no fim do turno.
        </p>
        <p>
          Professores, cozinheiras, faxineiros, secretário, diretora, porteiro e
          almoxarife também seguem suas rotinas. Use os botões 1×/2×/4× para acelerar o
          relógio e clique num personagem (com o mouse livre) para controlá-lo em
          terceira pessoa — ande pela escola no lugar dele e solte quando quiser:
          ele retoma a rotina de onde estiver.
        </p>
      </div>
    </div>
  );
}
