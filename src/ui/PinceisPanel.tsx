/**
 * PinceisPanel.tsx — painel dos pincéis de quadro no canto inferior esquerdo
 * (componente DOM comum, montado FORA do <Canvas>), no lugar do antigo minimapa.
 *
 * Resume a simulação de pincéis (simulation/pinceis.ts): chave Sem/Com
 * Allcanci, total de ativos, por cor (total + carga média %), estoque do
 * almoxarifado por cor, descartados e o botão "Repor estoque".
 *
 * O resumo é lido por POLLING a cada 500 ms chamando obterResumoPinceis()
 * direto do módulo — SEM subscribe ao clockMin da store (muda a cada frame).
 */

import { useEffect, useState } from 'react';
import { obterResumoPinceis } from '../simulation/pinceis';
import type { CorPincel, ResumoPinceis } from '../simulation/pinceis';
import { useSchoolStore } from '../state/useSchoolStore';
import './ui.css';

/** Cores exibidas no painel, com rótulo PT-BR e classe CSS da bolinha. */
const CORES: readonly { cor: CorPincel; rotulo: string; classe: string }[] = [
  { cor: 'azul', rotulo: 'Azul', classe: 'pincel-azul' },
  { cor: 'verde', rotulo: 'Verde', classe: 'pincel-verde' },
  { cor: 'vermelho', rotulo: 'Vermelho', classe: 'pincel-vermelho' },
];

export function PinceisPanel() {
  const comAllcanci = useSchoolStore((s) => s.comAllcanci);
  const toggleAllcanci = useSchoolStore((s) => s.toggleAllcanci);
  const reporEstoque = useSchoolStore((s) => s.reporEstoque);

  // Resumo lido por intervalo próprio (500 ms) direto do módulo de simulação.
  const [resumo, setResumo] = useState<ResumoPinceis>(() => obterResumoPinceis());
  useEffect(() => {
    const id = window.setInterval(() => setResumo(obterResumoPinceis()), 500);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="pinceis-panel">
      <h3 className="pinceis-titulo">Pincéis de quadro</h3>

      <div className="pinceis-chave" role="group" aria-label="Modo de reposição dos pincéis">
        <button
          type="button"
          className={`hud-botao${comAllcanci ? '' : ' ativo'}`}
          onClick={() => {
            if (comAllcanci) toggleAllcanci();
          }}
          title="Pincéis descartáveis: os vazios são trocados por novos do estoque do almoxarifado"
        >
          Sem Allcanci
        </button>
        <button
          type="button"
          className={`hud-botao${comAllcanci ? ' ativo' : ''}`}
          onClick={() => {
            if (!comAllcanci) toggleAllcanci();
          }}
          title="Recarga na máquina Fill do almoxarifado: o estoque não é consumido"
        >
          Com Allcanci
        </button>
      </div>

      <p className="pinceis-linha pinceis-total">
        <span className="rotulo">Ativos: </span>
        {resumo.totalAtivos}
      </p>

      <ul className="pinceis-cores">
        {CORES.map(({ cor, rotulo, classe }) => (
          <li key={cor}>
            <span className={`ponto ${classe}`} />
            <span className="pinceis-cor-nome">{rotulo}</span>
            <span className="pinceis-cor-valor">
              {resumo.porCor[cor].total} · {Math.round(resumo.porCor[cor].cargaMedia)}%
            </span>
          </li>
        ))}
      </ul>

      <p className="pinceis-linha">
        <span className="rotulo">Estoque: </span>
        {CORES.map(({ cor, classe }, i) => (
          <span key={cor}>
            {i > 0 ? ' · ' : ''}
            <span className={`ponto ${classe}`} />
            {resumo.estoque[cor]}
          </span>
        ))}
      </p>

      <p className="pinceis-linha">
        <span className="rotulo">Descartados: </span>
        {resumo.descartados}
      </p>

      <button
        type="button"
        className="hud-botao pinceis-repor"
        onClick={() => {
          reporEstoque();
          setResumo(obterResumoPinceis()); // reflete a reposição já no próximo paint
        }}
        title="Repõe o estoque do almoxarifado (64 pincéis de cada cor)"
      >
        Repor estoque
      </button>
    </div>
  );
}
