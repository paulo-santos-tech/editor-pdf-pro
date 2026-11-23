/**
 * Módulo de Rastreamento e Clonagem de Tipografia (Font Tracker & Matcher)
 * Permite capturar e replicar fielmente a fonte, tamanho, estilo e cor de qualquer texto do documento.
 */
window.PDFStudio = window.PDFStudio || {};

window.PDFStudio.FontDetector = {
  btnFontPicker: null,
  btnCopyStyle: null,

  init() {
    this.btnFontPicker = document.getElementById('btn-font-picker');
    this.btnCopyStyle = document.getElementById('btn-copy-style');
    this._bindEvents();
  },

  _bindEvents() {
    if (this.btnFontPicker) {
      this.btnFontPicker.addEventListener('click', () => this.toggleFontPicker());
    }

    if (this.btnCopyStyle) {
      this.btnCopyStyle.addEventListener('click', () => this.cloneSelectedTextStyle());
    }

    // Listener global na camada de edição para rastreamento
    const editOverlay = document.getElementById('edit-overlay');
    if (editOverlay) {
      editOverlay.addEventListener('click', (e) => {
        if (!window.PDFStudio.State.isFontPickerActive) return;

        // Se clicou em um bloco de texto existente
        const textBlock = e.target.closest('.text-block-item');
        if (textBlock) {
          const index = parseInt(textBlock.dataset.index, 10);
          this.inspectAndCloneFromIndex(index);
          e.stopPropagation();
          e.preventDefault();
          this.toggleFontPicker(false);
          return;
        }

        // Se clicou na folha/imagem (scan)
        this.sampleFromCanvasCoordinates(e.clientX, e.clientY);
        e.stopPropagation();
        e.preventDefault();
        this.toggleFontPicker(false);
      }, true);
    }
  },

  toggleFontPicker(forceState) {
    const state = window.PDFStudio.State;
    state.isFontPickerActive = (typeof forceState === 'boolean') ? forceState : !state.isFontPickerActive;

    if (state.isFontPickerActive) {
      if (state.isEraserMode && window.PDFStudio.ImageEditor) window.PDFStudio.ImageEditor.toggleEraserMode(false);
      if (state.isWhiteoutMode && window.PDFStudio.ImageEditor) window.PDFStudio.ImageEditor.toggleWhiteoutMode(false);
      if (state.isDrawingMode && window.PDFStudio.Drawing) window.PDFStudio.Drawing.toggleDrawingMode(false);
      if (state.isInsertMode && window.PDFStudio.TextEditor) window.PDFStudio.TextEditor.toggleInsertMode(false);
    }

    if (this.btnFontPicker) {
      this.btnFontPicker.classList.toggle('tool-btn-active', state.isFontPickerActive);
      this.btnFontPicker.classList.toggle('bg-blue-600', state.isFontPickerActive);
      this.btnFontPicker.classList.toggle('text-white', state.isFontPickerActive);
    }

    const editOverlay = document.getElementById('edit-overlay');
    if (editOverlay) {
      if (state.isFontPickerActive) {
        editOverlay.style.cursor = 'crosshair';
        window.PDFStudio.Utils.showToast('Rastreador de Fonte Ativo: Clique em qualquer palavra para clonar sua tipografia exata!', 'info');
      } else {
        editOverlay.style.cursor = '';
      }
    }
  },

  inspectAndCloneFromIndex(index) {
    const state = window.PDFStudio.State;
    const item = state.currentItems.find(it => it.index === index);
    if (!item) return;

    // Atualiza o estilo clonado
    state.clonedStyle = {
      fontFamily: item.fontFamily || 'Helvetica',
      fontSize: item.pdfFontSize || 12,
      isBold: !!item.isBold,
      isItalic: !!item.isItalic,
      color: item.color || '#0f172a'
    };

    // Atualiza a barra do Inspetor Tipográfico
    this.applyClonedStyleToToolbar(state.clonedStyle);

    const fontDisplayName = (item.rawFontName || item.fontFamily).replace(/^[A-Z]{6}\+/, '');
    window.PDFStudio.Utils.showToast(
      `Tipografia Rastreada: ${fontDisplayName} (${item.pdfFontSize}pt, ${item.isBold ? 'Negrito' : 'Normal'}). O próximo texto inserido usará esse estilo idêntico!`,
      'success'
    );
  },

  cloneSelectedTextStyle() {
    const state = window.PDFStudio.State;
    const selectedItem = window.PDFStudio.TextEditor ? window.PDFStudio.TextEditor.getSelectedItem() : null;

    if (!selectedItem) {
      this.toggleFontPicker(true);
      return;
    }

    this.inspectAndCloneFromIndex(selectedItem.index);
  },

  sampleFromCanvasCoordinates(clientX, clientY) {
    const canvas = document.getElementById('pdf-render-canvas');
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.round(clientX - rect.left);
    const y = Math.round(clientY - rect.top);

    if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;

    try {
      const ctx = canvas.getContext('2d');
      // Amostra uma pequena vizinhança de pixels (5x5)
      const pixelData = ctx.getImageData(Math.max(0, x - 2), Math.max(0, y - 2), 5, 5).data;
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < pixelData.length; i += 4) {
        r += pixelData[i];
        g += pixelData[i + 1];
        b += pixelData[i + 2];
        count++;
      }
      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);

      const hexColor = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
      
      // Estima se a área amostrada é escura (texto) ou clara (papel)
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      const state = window.PDFStudio.State;

      // Se for escuro, adota como cor do texto; se for claro, adota cor padrão preta e guarda cor de papel
      const textColor = brightness < 150 ? hexColor : '#0f172a';

      state.clonedStyle.color = textColor;
      const fontColorPicker = document.getElementById('font-color-picker');
      if (fontColorPicker) fontColorPicker.value = textColor;

      window.PDFStudio.Utils.showToast(
        `Cor da Imagem Rastreada: ${textColor} (RGB: ${r}, ${g}, ${b}). Estilo sincronizado!`,
        'success'
      );
    } catch (err) {
      console.warn('Não foi possível amostrar pixel do canvas:', err);
    }
  },

  applyClonedStyleToToolbar(style) {
    const fontFamilySelect = document.getElementById('font-family-select');
    const fontSizeInput = document.getElementById('font-size-input');
    const fontColorPicker = document.getElementById('font-color-picker');
    const btnFontBold = document.getElementById('btn-font-bold');
    const btnFontItalic = document.getElementById('btn-font-it');
    const fontDetectedName = document.getElementById('font-detected-name');

    if (fontFamilySelect) fontFamilySelect.value = style.fontFamily;
    if (fontSizeInput) fontSizeInput.value = style.fontSize;
    if (fontColorPicker) fontColorPicker.value = style.color;
    if (fontDetectedName) fontDetectedName.textContent = style.fontFamily;

    if (btnFontBold) {
      btnFontBold.classList.toggle('tool-btn-active', style.isBold);
      btnFontBold.classList.toggle('bg-blue-600', style.isBold);
      btnFontBold.classList.toggle('text-white', style.isBold);
    }

    if (btnFontItalic) {
      btnFontItalic.classList.toggle('tool-btn-active', style.isItalic);
      btnFontItalic.classList.toggle('bg-blue-600', style.isItalic);
      btnFontItalic.classList.toggle('text-white', style.isItalic);
    }
  }
};
