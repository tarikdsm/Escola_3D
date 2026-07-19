/**
 * ControlsPanel.tsx — HUD de comandos no canto superior direito (componente
 * DOM comum, montado FORA do <Canvas>).
 *
 * Lista todo o mapa de teclado + mouse (dados de `comandos.ts`, a mesma
 * fonte do HelpOverlay) em painel compacto e recolhível: o botão do
 * cabeçalho alterna entre a lista completa e só a barra de título.
 * Estado local (useState) — nada entra na store global.
 */

import { useState } from 'react';
import { COMANDOS } from './comandos';
import './ui.css';

export function ControlsPanel() {
  const [recolhido, setRecolhido] = useState(false);

  return (
    <aside className="comandos" aria-label="Comandos de teclado e mouse">
      <div className="comandos-cab">
        <span className="comandos-titulo">Comandos</span>
        <button
          type="button"
          className="comandos-toggle"
          onClick={() => setRecolhido((r) => !r)}
          title={recolhido ? 'Mostrar comandos' : 'Ocultar comandos'}
          aria-label={recolhido ? 'Mostrar comandos' : 'Ocultar comandos'}
          aria-expanded={!recolhido}
        >
          {recolhido ? '+' : '−'}
        </button>
      </div>

      {!recolhido && (
        <div className="comandos-corpo">
          {COMANDOS.map((secao) => (
            <section key={secao.titulo} className="comandos-secao">
              <h3>{secao.titulo}</h3>
              <ul>
                {secao.itens.map((item) => (
                  <li key={item.rotulo ?? item.teclas?.join('+') ?? item.acao}>
                    <span className="comandos-teclas">
                      {item.teclas?.map((t, i) => (
                        <span key={t}>
                          {i > 0 && item.juncao ? ` ${item.juncao} ` : ''}
                          <kbd>{t}</kbd>
                        </span>
                      ))}
                      {item.sufixo ? ` ${item.sufixo}` : ''}
                      {item.rotulo}
                    </span>
                    <span className="comandos-acao">{item.acao}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </aside>
  );
}
