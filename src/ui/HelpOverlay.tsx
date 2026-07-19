/**
 * HelpOverlay.tsx — modal central de ajuda (componente DOM comum, montado
 * FORA do <Canvas>).
 *
 * Visibilidade na store local `useAjudaStore` (botão "?" do HUD também usa).
 * Teclas: H ou ? alternam; Esc fecha. O listener de keydown é registrado
 * uma única vez no mount do componente e removido no unmount — por isso o
 * componente deve ficar montado sempre (retorna null quando fechado).
 */

import { Fragment, useEffect } from 'react';
import { COMANDOS } from './comandos';
import { useAjudaStore } from './helpStore';
import './ui.css';

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

        {/* Mapa de controles: mesma fonte (comandos.ts) do painel superior direito. */}
        {COMANDOS.map((secao) => (
          <Fragment key={secao.titulo}>
            <h2>{secao.titulo === 'Geral' ? 'Controles — geral' : secao.titulo}</h2>
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
                    {item.sufixo ? ` ${item.sufixo}` : ''}
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
          A escola vive um dia letivo das 7h às 12h: os alunos chegam pela rua, assistem às
          aulas, saem para o recreio quando o sino toca e almoçam antes de ir embora.
        </p>
        <p>
          Professores, cozinheiras, faxineiros, secretário, diretora e porteiro também seguem
          suas rotinas. Use os botões 1×/2×/4× para acelerar o relógio e o minimapa para
          encontrar cada um.
        </p>
      </div>
    </div>
  );
}
