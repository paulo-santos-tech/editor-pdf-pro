# PDF Studio Pro - Editor Completo de PDF

Sistema avançado de visualização, edição tipográfica, anotações, assinaturas digitais e manipulação de documentos PDF diretamente no navegador.

---

## 🚀 Arquitetura e Modularização

O projeto foi completamente refatorado e modularizado, saindo de um script monolítico para uma arquitetura limpa, escalável e de fácil manutenção:

```
EDITOR DE PDF PRO/
├── css/
│   └── styles.css              # Estilos da folha, caixas de edição, overlays, handles e responsividade
├── js/
│   ├── constants.js            # Limites de zoom, fontes padrão, cores e configurações globais
│   ├── state.js                # Estado global reativo, snapshots de histórico (Undo / Redo) e navegação
│   ├── utils/
│   │   └── helpers.js          # Utilitários (RGB, higienização WinAnsi, Toasts, downloads, range parser)
│   ├── modules/
│   │   ├── drawingCanvas.js    # Modo caneta, captura touch/mouse de traços livres e exportação transparente
│   │   ├── fontDetector.js     # Rastreador de fontes (conta-gotas tipográfico: família, tamanho, peso, cor)
│   │   ├── imageEditor.js      # Corretivo/tarja, borracha de retoque, filtros de scan e OCR (Tesseract.js)
│   │   ├── overlayManager.js   # Assinaturas e imagens com suporte a arrastar e alça de redimensionamento
│   │   ├── pageManager.js      # Miniaturas, rotação de páginas (90°/180°/270°) e exclusão segura
│   │   ├── textEditor.js       # Detecção de blocos de texto, inspetor tipográfico, busca e substituição
│   │   ├── pdfTools.js         # Juntar PDFs (Merge), Separar páginas (Split), Marca d'água, TXT e PNG
│   │   ├── pdfRenderer.js      # Integração PDF.js, auto-fit zoom, sincronização de viewports e canvas
│   │   └── pdfExporter.js      # Reconstrução do PDF final via PDF-Lib com embutimento de camadas
│   └── app.js                  # Ponto de entrada (Entrypoint), atalhos de teclado e drag & drop
├── index.html                  # Interface moderna e modularizada (pronta para GitHub Pages)
└── editor_de_textos_em_pdf.html # Arquivo espelho mantido 100% sincronizado
```

---

## 🎨 Recursos de Edição de Imagem e Tipografia em Documentos Escaneados

1. **Rastreador de Fonte Tipográfica (Eye-dropper de Tipografia):**
   - Rastreia e clona instantaneamente qualquer texto existente no PDF ou pixel da imagem amostrada: detecta família da fonte, tamanho exato em pontos (pt), espessura (Bold/Normal), estilo (Itálico) e valor hexadecimal da cor.
   - Sincroniza o estilo capturado com a barra de ferramentas, permitindo escrever novas palavras ou substituir trechos exatamente com o mesmo padrão visual do documento original.

2. **Corretivo / Tarja (Whiteout):**
   - Cria tarjas retangulares redimensionáveis e arrastáveis para cobrir textos ou informações antigas em PDFs compostos por fotos ou escaneamentos, permitindo digitar novos textos por cima com tipografia idêntica.

3. **Pincel Borracha de Retoque:**
   - Permite apagar manchas, carimbos indesejados, traços de caneta ou sujeiras de escaneamento com espessura de pincel ajustável.

4. **Filtros de Nitidez e Binarização P&B (Scan Limpo):**
   - Modos de ajuste de brilho, contraste e binarização inteligente (Threshold/Limiar) que transformam fotos amareladas ou tiradas pelo celular em folhas brancas com letras pretas nítidas, simulando scanners profissionais de alta resolução.

5. **Reconhecimento Óptico de Caracteres (OCR via Tesseract.js):**
   - Processa a imagem da folha no próprio navegador, reconhece linhas e palavras, cobrindo automaticamente a imagem original e gerando blocos de textos nativos e editáveis na mesma posição.

---

## 🛠️ Bugs Identificados e Corrigidos

1. **Dessincronização de Páginas na Exportação vs Exclusão (Bug Crítico):**
   - *Antes:* Quando uma página era excluída, a exportação usava um índice sequencial (`const pageNum = i + 1`), fazendo com que modificações de páginas posteriores fossem aplicadas nas páginas erradas.
   - *Correção:* O exportador agora mapeia explicitamente as páginas ativas preservando o número da página original (`activeOriginalPages`), garantindo sincronização 100% perfeita.

2. **Anotações de Caneta Livre Não Eram Salvas (Bug Crítico):**
   - *Antes:* Os traços desenhados com a caneta (`#draw-canvas`) eram visíveis apenas no navegador e sumiam ao baixar o PDF.
   - *Correção:* Desenvolvida a função `exportDrawingsToDataUrl()`, que rasteriza os traços da caneta em PNG transparente de alta definição e os embute com o PDF-Lib em cada página correspondente.

3. **Crash Fatal de Caracteres Especiais no PDF-Lib (Bug Crítico - WinAnsi):**
   - *Antes:* Caracteres como aspas tipográficas (`“ ”`), apóstrofos curvos (`’`), travessões (`—`) ou caracteres matemáticos lançavam o erro fatal `WinAnsi cannot encode` interrompendo o download.
   - *Correção:* Implementado o sanitizador `sanitizeWinAnsi()` que normaliza caracteres especiais de forma transparente antes de desenhar no PDF.

4. **Máscara Branca do Texto Original (Bug Visual):**
   - *Antes:* O retângulo de máscara usava a baseline do texto como base, deixando a parte inferior de letras descendentes (`g`, `p`, `q`, `j`) visíveis ou cobrindo linhas superiores.
   - *Correção:* Ajuste no cálculo de cobertura vertical (`maskY = mod.y - approxHeight * 0.25`) cobrindo totalmente os caracteres originais sem vazar nas linhas vizinhas.

5. **Assinaturas e Imagens Sem Redimensionamento (Limitação Crítica):**
   - *Antes:* O usuário só conseguia mover imagens e assinaturas, mas não conseguia mudar o tamanho.
   - *Correção:* Implementado o `overlay-resize-handle`, permitindo ajustar interativamente a largura e altura de qualquer carimbo, assinatura ou logotipo.

6. **Bloqueio de Scroll no Celular por Listeners de Toque:**
   - *Antes:* O canvas de anotações chamava `e.preventDefault()` mesmo quando a caneta estava desativada, impedindo o usuário de rolar a página em telas sensíveis ao toque.
   - *Correção:* Os listeners agora verificam o modo ativo (`isDrawingMode`) antes de cancelar o comportamento padrão do navegador.

7. **Vazamento de Memória ao Abrir Vários PDFs:**
   - *Antes:* Abrir sucessivos PDFs não destruía a instância de worker e páginas do PDF anterior.
   - *Correção:* O método `State.reset()` executa `pdfDocument.destroy()` limpando a memória e cancela tarefas de renderização pendentes via `renderTask.cancel()`.

8. **Histórico Undo / Redo Incompleto:**
   - *Antes:* Desfazer e refazer ignorava páginas excluídas porque o `Set` não era serializado.
   - *Correção:* Snapshot completo convertendo `deletedPages` em array para JSON e restaurando o estado fiel do documento.

9. **Padronização Automática de Folhas (A4 Uniforme ao Juntar e Separar):**
   - *Antes:* Ao juntar PDFs vindos de diferentes fontes (scanners, formatos Letter, notas fiscais ou PDFs desiguais), as páginas ficavam com tamanhos visivelmente desproporcionais (uma enorme, outra minúscula, uma estreita e outra larga).
   - *Correção:* Implementado o algoritmo vetorial `addStandardizedPage` no `PDFStudio.Utils`. Ele incorpora cada página no PDF-Lib, recalcula sua escala proporcional (mantendo a razão de aspecto sem cortes nem distorções) e a centraliza perfeitamente em uma folha A4 padronizada (595.28 × 841.89 pt), garantindo uniformidade total ao juntar (Merge), ao separar/extrair (Split) e ao salvar o documento.

---

## 💻 Como Utilizar

Basta abrir o arquivo `index.html` ou `editor_de_textos_em_pdf.html` diretamente em qualquer navegador moderno (Chrome, Edge, Firefox, Safari). Não requer instalação de dependências ou servidores backend.

