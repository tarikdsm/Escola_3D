/**
 * comandos.ts — fonte única do mapa de comandos (teclado + mouse).
 *
 * Consumida pelo HelpOverlay (modal da tecla H) e pelo ControlsPanel
 * (HUD fixo no canto superior direito) — mudou aqui, muda nos dois.
 */

export interface ComandoItem {
  /** Teclas exibidas como chips <kbd> (ex.: ['W', 'A', 'S', 'D']). */
  teclas?: string[];
  /** Texto entre os chips (ex.: 'ou' em H ou ?; '/' em Espaço / Ctrl). */
  juncao?: string;
  /** Texto após os chips (ex.: 'ou setas' depois de W A S D). */
  sufixo?: string;
  /** Rótulo livre quando o comando não é uma tecla (ex.: 'Mouse'). */
  rotulo?: string;
  /** O que o comando faz. */
  acao: string;
}

export interface ComandoSecao {
  titulo: string;
  itens: ComandoItem[];
}

export const COMANDOS: ComandoSecao[] = [
  {
    titulo: 'Geral',
    itens: [
      { teclas: ['Tab'], acao: 'alternar caminhar / vista aérea (sai do voo)' },
      { teclas: ['F'], acao: 'modo voar — liga / desliga (atravessa paredes)' },
      { teclas: ['M'], acao: 'ligar / desligar sons' },
      { teclas: ['H', '?'], juncao: 'ou', acao: 'abrir / fechar a ajuda' },
      { teclas: ['Esc'], acao: 'liberar o mouse' },
      { rotulo: 'Clique num personagem', acao: 'ver detalhes (nome, função, ação atual)' },
    ],
  },
  {
    titulo: 'Caminhando e voando',
    itens: [
      { rotulo: 'Mouse', acao: 'olhar — clique na tela para travar o cursor' },
      { rotulo: 'Segurar botão esquerdo', acao: 'ir para frente (no voo, na direção do olhar)' },
      { rotulo: 'Segurar botão direito', acao: 'ir para trás' },
      { teclas: ['W', 'A', 'S', 'D'], sufixo: 'ou setas', acao: 'mover' },
      { teclas: ['Shift'], acao: 'correr / voar rápido' },
      { teclas: ['Espaço', 'Ctrl'], juncao: '/', acao: 'subir / descer (só no voo)' },
    ],
  },
  {
    titulo: 'Vista aérea',
    itens: [
      { rotulo: 'Segurar botão esquerdo / direito', acao: 'avançar / recuar a câmera' },
      { rotulo: 'Rodinha do mouse', acao: 'zoom' },
      { rotulo: 'Arrastar com o botão do meio', acao: 'girar em volta da escola' },
    ],
  },
];
