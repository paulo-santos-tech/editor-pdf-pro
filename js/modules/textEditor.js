/**
 * Módulo de Edição de Texto e Inspetor Tipográfico
 */
window.PDFStudio = window.PDFStudio || {};

window.PDFStudio.TextEditor = {
  editOverlay: null,
  textItemsList: null,

  init() {
    this.editOverlay = document.getElementById('edit-overlay');
    this.textItemsList = document.getElementById('text-items-list');
    this._bindInspectorEvents();
    this._bindFindReplaceEvents();
    this._bindInsertModeEvents();
  },

  _bindInspectorEvents() {
    const fontFamilySelect = document.getElementById('font-family-select');
    const fontSizeInput = document.getElementById('font-size-input');
    const btnFontInc = document.getElementById('btn-font-inc');
    const btnFontDec = document.getElementById('btn-font-dec');
    const btnFontBold = document.getElementById('btn-font-bold');
    const btnFontItalic = document.getElementById('btn-font-it');
    const fontColorPicker = document.getElementById('font-color-picker');
    const btnDeleteSelected = document.getElementById('btn-delete-selected');
    const btnHighlightAll = document.getElementById('btn-highlight-all');
    const btnClearEdits = document.getElementById('btn-clear-edits');
    const searchInput = document.getElementById('search-input');

    // Troca de Fonte
    if (fontFamilySelect) {
      fontFamilySelect.addEventListener('change', () => {
        const item = this.getSelectedItem();
        if (!item) return;

        item.fontFamily = fontFamilySelect.value;
        item.isModified = true;
        this.syncModificationObject(item);

        const domEl = this.editOverlay.querySelector(`[data-index="${item.index}"]`);
        if (domEl) {
          if (item.fontFamily === 'TimesRoman') domEl.style.fontFamily = '"Times New Roman", Times, serif';
          else if (item.fontFamily === 'Courier') domEl.style.fontFamily = 'Courier, monospace';
          else domEl.style.fontFamily = 'Helvetica, Arial, sans-serif';
        }
        window.PDFStudio.State.recordState();
      });
    }

    // Tamanho da Fonte
    const setFontSize = (newSize) => {
      const item = this.getSelectedItem();
      if (!item) return;

      const size = Math.max(
        window.PDFStudio.Constants.FONT_SIZE_MIN,
        Math.min(window.PDFStudio.Constants.FONT_SIZE_MAX, newSize)
      );
      item.pdfFontSize = size;
      if (fontSizeInput) fontSizeInput.value = size;
      item.isModified = true;
      this.syncModificationObject(item);

      const domEl = this.editOverlay.querySelector(`[data-index="${item.index}"]`);
      if (domEl) {
        domEl.style.fontSize = `${size * window.PDFStudio.State.zoom}px`;
      }
      window.PDFStudio.State.recordState();
    };

    if (fontSizeInput) {
      fontSizeInput.addEventListener('change', (e) => setFontSize(parseInt(e.target.value, 10) || 12));
    }
    if (btnFontInc && fontSizeInput) {
      btnFontInc.addEventListener('click', () => setFontSize(parseInt(fontSizeInput.value, 10) + 1));
    }
    if (btnFontDec && fontSizeInput) {
      btnFontDec.addEventListener('click', () => setFontSize(parseInt(fontSizeInput.value, 10) - 1));
    }

    // Negrito
    if (btnFontBold) {
      btnFontBold.addEventListener('click', () => {
        const item = this.getSelectedItem();
        if (!item) return;

        item.isBold = !item.isBold;
        item.isModified = true;
        this.syncModificationObject(item);

        btnFontBold.classList.toggle('tool-btn-active', item.isBold);
        btnFontBold.classList.toggle('bg-blue-600', item.isBold);
        btnFontBold.classList.toggle('text-white', item.isBold);

        const domEl = this.editOverlay.querySelector(`[data-index="${item.index}"]`);
        if (domEl) domEl.style.fontWeight = item.isBold ? 'bold' : 'normal';
        window.PDFStudio.State.recordState();
      });
    }

    // Itálico
    if (btnFontItalic) {
      btnFontItalic.addEventListener('click', () => {
        const item = this.getSelectedItem();
        if (!item) return;

        item.isItalic = !item.isItalic;
        item.isModified = true;
        this.syncModificationObject(item);

        btnFontItalic.classList.toggle('tool-btn-active', item.isItalic);
        btnFontItalic.classList.toggle('bg-blue-600', item.isItalic);
        btnFontItalic.classList.toggle('text-white', item.isItalic);

        const domEl = this.editOverlay.querySelector(`[data-index="${item.index}"]`);
        if (domEl) domEl.style.fontStyle = item.isItalic ? 'italic' : 'normal';
        window.PDFStudio.State.recordState();
      });
    }

    // Cor do Texto
    if (fontColorPicker) {
      fontColorPicker.addEventListener('input', (e) => {
        const item = this.getSelectedItem();
        if (!item) return;

        item.color = e.target.value;
        item.isModified = true;
        this.syncModificationObject(item);

        const domEl = this.editOverlay.querySelector(`[data-index="${item.index}"]`);
        if (domEl) domEl.style.color = item.color;
      });

      fontColorPicker.addEventListener('change', () => {
        window.PDFStudio.State.recordState();
      });
    }

    // Remover Bloco
    if (btnDeleteSelected) {
      btnDeleteSelected.addEventListener('click', () => {
        const item = this.getSelectedItem();
        if (!item) {
          window.PDFStudio.Utils.showToast('Nenhum texto selecionado.', 'warn');
          return;
        }

        item.isDeleted = true;
        item.currentText = '';
        item.isModified = true;
        this.syncModificationObject(item);

        const domEl = this.editOverlay.querySelector(`[data-index="${item.index}"]`);
        if (domEl) domEl.remove();

        window.PDFStudio.State.selectedItemIndex = null;
        this.renderSidebarList();
        window.PDFStudio.State.updateStatusBadge();
        window.PDFStudio.State.recordState();
        window.PDFStudio.Utils.showToast('Texto removido da folha.');
      });
    }

    // Alternar visualização de bordas de blocos
    if (btnHighlightAll) {
      btnHighlightAll.addEventListener('click', () => {
        const state = window.PDFStudio.State;
        state.showBoxes = !state.showBoxes;
        btnHighlightAll.classList.toggle('bg-blue-100', state.showBoxes);
        btnHighlightAll.classList.toggle('text-blue-700', state.showBoxes);

        const items = this.editOverlay.querySelectorAll('.text-block-item');
        items.forEach(el => {
          const isMod = el.classList.contains('is-modified');
          if (!isMod) {
            el.style.borderColor = state.showBoxes ? 'rgba(59, 130, 246, 0.45)' : 'transparent';
            el.style.backgroundColor = state.showBoxes ? 'rgba(255, 255, 255, 0.2)' : 'transparent';
          }
        });
      });
    }

    // Restaurar página original
    if (btnClearEdits) {
      btnClearEdits.addEventListener('click', () => {
        const state = window.PDFStudio.State;
        state.modifications[state.currentPage] = {};
        state.drawings[state.currentPage] = [];
        state.pageOverlays[state.currentPage] = [];
        if (window.PDFStudio.Renderer) {
          window.PDFStudio.Renderer.renderCurrentPage();
        }
        state.recordState();
        window.PDFStudio.Utils.showToast('Página restaurada ao formato original.', 'info');
      });
    }

    // Filtro de Busca de Blocos
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const items = this.editOverlay.querySelectorAll('.text-block-item');
        items.forEach(el => {
          const text = el.innerText.toLowerCase();
          if (term && text.includes(term)) {
            el.style.backgroundColor = '#fef08a';
            el.style.borderColor = '#ca8a04';
          } else {
            el.style.backgroundColor = '';
            el.style.borderColor = '';
          }
        });
      });
    }
  },

  _bindFindReplaceEvents() {
    const findText = document.getElementById('find-text');
    const replaceText = document.getElementById('replace-text');
    const btnExecuteReplace = document.getElementById('btn-execute-replace');
    const btnExecuteReplaceAll = document.getElementById('btn-execute-replace-all');

    // Substituição na página atual
    if (btnExecuteReplace) {
      btnExecuteReplace.addEventListener('click', () => {
        const findVal = findText.value;
        const replaceVal = replaceText.value;
        if (!findVal) {
          window.PDFStudio.Utils.showToast('Digite o termo a localizar.', 'warn');
          return;
        }

        let count = 0;
        window.PDFStudio.State.currentItems.forEach(item => {
          if (!item.isDeleted && item.currentText.includes(findVal)) {
            const updated = item.currentText.replaceAll(findVal, replaceVal);
            this.handleTextChange(item.index, updated);
            const domEl = this.editOverlay.querySelector(`[data-index="${item.index}"]`);
            if (domEl) domEl.innerText = updated;
            count++;
          }
        });

        if (count > 0) {
          window.PDFStudio.Utils.showToast(`${count} ocorrência(s) substituída(s) nesta página!`);
        } else {
          window.PDFStudio.Utils.showToast('Nenhuma ocorrência encontrada.', 'info');
        }
      });
    }

    // Substituição em todas as páginas
    if (btnExecuteReplaceAll) {
      btnExecuteReplaceAll.addEventListener('click', async () => {
        const findVal = findText.value;
        const replaceVal = replaceText.value;
        if (!findVal) {
          window.PDFStudio.Utils.showToast('Digite o termo a localizar.', 'warn');
          return;
        }

        const state = window.PDFStudio.State;
        if (!state.pdfDocument) return;

        window.PDFStudio.Utils.showLoading('Substituindo em todas as páginas...');
        let totalReplaced = 0;

        try {
          const activePages = state.getActivePages();

          for (const p of activePages) {
            const page = await state.pdfDocument.getPage(p);
            const textContent = await page.getTextContent();

            if (!state.modifications[p]) {
              state.modifications[p] = {};
            }

            let itemIdx = 0;
            textContent.items.forEach(item => {
              if (!item.str || item.str.trim() === '') return;

              const existingMod = state.modifications[p][itemIdx];
              const currentStr = existingMod ? existingMod.text : item.str;

              if (currentStr.includes(findVal)) {
                const updated = currentStr.replaceAll(findVal, replaceVal);
                const tx = item.transform;
                const detectedFamily = window.PDFStudio.Utils.identifyFontFamily(item.fontName);

                state.modifications[p][itemIdx] = {
                  original: item.str,
                  text: updated,
                  fontFamily: existingMod ? existingMod.fontFamily : detectedFamily,
                  fontSize: Math.round(Math.hypot(tx[2], tx[3])),
                  pdfFontSize: Math.round(Math.hypot(tx[2], tx[3])),
                  isBold: existingMod ? existingMod.isBold : window.PDFStudio.Utils.isFontBold(item.fontName),
                  isItalic: existingMod ? existingMod.isItalic : window.PDFStudio.Utils.isFontItalic(item.fontName),
                  color: existingMod ? existingMod.color : window.PDFStudio.Constants.COLORS.TEXT_DEFAULT,
                  x: tx[4],
                  y: tx[5],
                  pdfWidth: item.width,
                  pdfHeight: item.height || Math.hypot(tx[2], tx[3]),
                  isDeleted: false,
                  isNew: false
                };
                totalReplaced++;
              }
              itemIdx++;
            });
          }

          if (window.PDFStudio.Renderer) {
            await window.PDFStudio.Renderer.renderCurrentPage();
          }
          state.recordState();
          window.PDFStudio.Utils.showToast(`${totalReplaced} ocorrência(s) substituída(s) em todo o PDF!`);
        } catch (err) {
          console.error(err);
          window.PDFStudio.Utils.showToast('Erro na substituição: ' + err.message, 'error');
        } finally {
          window.PDFStudio.Utils.hideLoading();
        }
      });
    }
  },

  toggleInsertMode(forceState) {
    const state = window.PDFStudio.State;
    state.isInsertMode = (typeof forceState === 'boolean') ? forceState : !state.isInsertMode;

    if (state.isInsertMode) {
      if (state.isEraserMode && window.PDFStudio.ImageEditor) window.PDFStudio.ImageEditor.toggleEraserMode(false);
      if (state.isWhiteoutMode && window.PDFStudio.ImageEditor) window.PDFStudio.ImageEditor.toggleWhiteoutMode(false);
      if (state.isDrawingMode && window.PDFStudio.Drawing) window.PDFStudio.Drawing.toggleDrawingMode(false);
      if (state.isFontPickerActive && window.PDFStudio.FontDetector) window.PDFStudio.FontDetector.toggleFontPicker(false);
    }

    const btnAddText = document.getElementById('btn-add-text');
    if (btnAddText) {
      btnAddText.classList.toggle('bg-indigo-100', state.isInsertMode);
      btnAddText.classList.toggle('text-indigo-700', state.isInsertMode);
    }
    if (this.editOverlay) {
      this.editOverlay.classList.toggle('insert-mode', state.isInsertMode);
    }

    if (state.isInsertMode) {
      window.PDFStudio.Utils.showToast('Clique em qualquer lugar da folha para escrever.', 'info');
    }
  },

  _bindInsertModeEvents() {
    const btnAddText = document.getElementById('btn-add-text');
    if (btnAddText) {
      btnAddText.addEventListener('click', () => this.toggleInsertMode());
    }

    if (this.editOverlay) {
      this.editOverlay.addEventListener('click', (e) => {
        const state = window.PDFStudio.State;
        if (!state.isInsertMode || !state.pageViewport) return;

        // Se clicou em um bloco existente, não insere outro por cima
        if (e.target.closest('.text-block-item') || e.target.closest('.overlay-element')) {
          return;
        }

        const rect = this.editOverlay.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const [pdfX, pdfY] = state.pageViewport.convertToPdfPoint(clickX, clickY);

        const fontFamilySelect = document.getElementById('font-family-select');
        const fontSizeInput = document.getElementById('font-size-input');
        const fontColorPicker = document.getElementById('font-color-picker');

        const newIndex = 10000 + Math.floor(Math.random() * 90000);
        const fontSize = parseInt(fontSizeInput ? fontSizeInput.value : 12, 10) || 12;

        const newBlock = {
          index: newIndex,
          originalText: '',
          currentText: 'Novo Texto',
          isModified: true,
          isDeleted: false,
          rawFontName: 'Novo Bloco',
          fontFamily: fontFamilySelect ? fontFamilySelect.value : window.PDFStudio.Constants.STANDARD_FONTS.HELVETICA,
          isBold: false,
          isItalic: false,
          color: fontColorPicker ? fontColorPicker.value : window.PDFStudio.Constants.COLORS.TEXT_DEFAULT,
          x: pdfX,
          y: pdfY,
          pdfWidth: 90,
          pdfHeight: fontSize * 1.2,
          pdfFontSize: fontSize,
          viewLeft: clickX,
          viewTop: clickY,
          viewWidth: 100,
          viewHeight: fontSize * state.zoom * 1.3,
          fontSizePx: fontSize * state.zoom,
          isNew: true
        };

        state.currentItems.push(newBlock);
        this.syncModificationObject(newBlock);
        this.createEditableElement(newBlock);

        // Desativa modo inserção após adicionar
        state.isInsertMode = false;
        if (btnAddText) btnAddText.classList.remove('bg-indigo-100', 'text-indigo-700');
        this.editOverlay.classList.remove('insert-mode');

        this.selectBlock(newIndex);
        const domEl = this.editOverlay.querySelector(`[data-index="${newIndex}"]`);
        if (domEl) {
          domEl.focus();
          const range = document.createRange();
          range.selectNodeContents(domEl);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }

        this.renderSidebarList();
        state.updateStatusBadge();
        state.recordState();
        window.PDFStudio.Utils.showToast('Novo texto adicionado!');
      });
    }
  },

  createEditableElement(itemObj) {
    const state = window.PDFStudio.State;
    const el = document.createElement('div');
    el.contentEditable = "true";
    el.spellcheck = false;
    el.className = `text-block-item ${itemObj.isModified ? 'is-modified' : ''} ${itemObj.isNew ? 'is-new-block' : ''}`;

    if (!state.showBoxes && !itemObj.isModified && !itemObj.isNew) {
      el.style.borderColor = 'transparent';
      el.style.backgroundColor = 'transparent';
    }

    el.style.left = `${itemObj.viewLeft}px`;
    el.style.top = `${itemObj.viewTop}px`;
    el.style.minWidth = `${itemObj.viewWidth}px`;
    el.style.minHeight = `${itemObj.viewHeight}px`;
    el.style.fontSize = `${itemObj.fontSizePx * 0.95}px`;
    el.style.color = itemObj.color;
    el.style.fontWeight = itemObj.isBold ? 'bold' : 'normal';
    el.style.fontStyle = itemObj.isItalic ? 'italic' : 'normal';

    if (itemObj.fontFamily === 'TimesRoman') {
      el.style.fontFamily = '"Times New Roman", Times, serif';
    } else if (itemObj.fontFamily === 'Courier') {
      el.style.fontFamily = 'Courier, monospace';
    } else {
      el.style.fontFamily = 'Helvetica, Arial, sans-serif';
    }

    el.dataset.index = itemObj.index;
    el.innerText = itemObj.currentText;

    el.addEventListener('focus', () => this.selectBlock(itemObj.index));
    el.addEventListener('input', () => this.handleTextChange(itemObj.index, el.innerText, false));
    el.addEventListener('blur', () => {
      window.PDFStudio.State.recordState();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        el.blur();
      }
    });

    this.editOverlay.appendChild(el);
  },

  selectBlock(index) {
    const state = window.PDFStudio.State;
    state.selectedItemIndex = index;
    const item = state.currentItems.find(it => it.index === index);
    if (!item) return;

    this.editOverlay.querySelectorAll('.text-block-item').forEach(el => el.classList.remove('is-active'));
    const activeEl = this.editOverlay.querySelector(`[data-index="${index}"]`);
    if (activeEl) activeEl.classList.add('is-active');

    const fontDetectedName = document.getElementById('font-detected-name');
    const fontFamilySelect = document.getElementById('font-family-select');
    const fontSizeInput = document.getElementById('font-size-input');
    const fontColorPicker = document.getElementById('font-color-picker');
    const btnFontBold = document.getElementById('btn-font-bold');
    const btnFontItalic = document.getElementById('btn-font-it');

    if (fontDetectedName) fontDetectedName.textContent = item.rawFontName.replace(/^[A-Z]{6}\+/, '');
    if (fontFamilySelect) fontFamilySelect.value = item.fontFamily;
    if (fontSizeInput) fontSizeInput.value = item.pdfFontSize;
    if (fontColorPicker) fontColorPicker.value = item.color.startsWith('#') ? item.color : '#000000';

    if (btnFontBold) {
      btnFontBold.classList.toggle('tool-btn-active', item.isBold);
      btnFontBold.classList.toggle('bg-blue-600', item.isBold);
      btnFontBold.classList.toggle('text-white', item.isBold);
    }
    if (btnFontItalic) {
      btnFontItalic.classList.toggle('tool-btn-active', item.isItalic);
      btnFontItalic.classList.toggle('bg-blue-600', item.isItalic);
      btnFontItalic.classList.toggle('text-white', item.isItalic);
    }
  },

  getSelectedItem() {
    const state = window.PDFStudio.State;
    if (state.selectedItemIndex === null) return null;
    return state.currentItems.find(it => it.index === state.selectedItemIndex);
  },

  handleTextChange(index, newText, shouldRecord = true) {
    const state = window.PDFStudio.State;
    const item = state.currentItems.find(it => it.index === index);
    if (!item) return;

    item.currentText = newText;
    const isChanged = (newText !== item.originalText);
    item.isModified = isChanged;

    this.syncModificationObject(item);

    const domEl = this.editOverlay.querySelector(`[data-index="${index}"]`);
    if (domEl) {
      domEl.classList.toggle('is-modified', isChanged);
    }

    state.updateStatusBadge();
    this.updateSidebarItem(index, newText, isChanged);
    if (shouldRecord) {
      state.recordState();
    }
  },

  syncModificationObject(item) {
    const state = window.PDFStudio.State;
    if (!state.modifications[state.currentPage]) {
      state.modifications[state.currentPage] = {};
    }

    state.modifications[state.currentPage][item.index] = {
      original: item.originalText,
      text: item.currentText,
      fontFamily: item.fontFamily,
      fontSize: item.pdfFontSize,
      pdfFontSize: item.pdfFontSize,
      isBold: item.isBold,
      isItalic: item.isItalic,
      color: item.color,
      x: item.x,
      y: item.y,
      pdfWidth: item.pdfWidth,
      pdfHeight: item.pdfHeight,
      isNew: item.isNew,
      isDeleted: item.isDeleted
    };
  },

  renderSidebarList() {
    if (!this.textItemsList) return;
    this.textItemsList.innerHTML = '';

    const state = window.PDFStudio.State;
    const activeItems = state.currentItems.filter(i => !i.isDeleted);
    const itemsCountEl = document.getElementById('items-count');
    if (itemsCountEl) itemsCountEl.textContent = activeItems.length;

    if (activeItems.length === 0) {
      this.textItemsList.innerHTML = `<p class="text-slate-400 text-center py-6 text-xs">Nenhum texto nesta página.</p>`;
      return;
    }

    activeItems.forEach(item => {
      const itemCard = document.createElement('div');
      itemCard.id = `sidebar-item-${item.index}`;
      itemCard.className = `p-2.5 rounded-xl border transition cursor-pointer text-xs ${
        item.isModified ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50/80 border-slate-200/80 hover:bg-slate-100'
      }`;

      itemCard.innerHTML = `
        <div class="flex items-center justify-between mb-1">
          <span class="font-semibold text-slate-400 text-[10px]">#${item.index + 1}</span>
          <div class="flex items-center gap-1">
            <span class="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">${item.fontFamily}</span>
            ${item.isModified ? '<span class="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">Modificado</span>' : ''}
          </div>
        </div>
        <div class="text-slate-800 font-medium truncate" title="${item.currentText}">${item.currentText}</div>
        ${item.isModified && item.originalText ? `<div class="text-[10px] text-slate-400 mt-0.5 truncate">Original: ${item.originalText}</div>` : ''}
      `;

      itemCard.addEventListener('click', () => {
        this.selectBlock(item.index);
        const domEl = this.editOverlay.querySelector(`[data-index="${item.index}"]`);
        if (domEl) {
          domEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          domEl.focus();
        }
        if (window.innerWidth < 768 && window.PDFStudio.App) {
          window.PDFStudio.App.closeMobileDrawer();
        }
      });

      this.textItemsList.appendChild(itemCard);
    });
  },

  updateSidebarItem(index, newText, isModified) {
    const card = document.getElementById(`sidebar-item-${index}`);
    if (!card) return;
    const item = window.PDFStudio.State.currentItems.find(it => it.index === index);

    card.className = `p-2.5 rounded-xl border transition cursor-pointer text-xs ${
      isModified ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50/80 border-slate-200/80 hover:bg-slate-100'
    }`;

    card.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <span class="font-semibold text-slate-400 text-[10px]">#${index + 1}</span>
        <div class="flex items-center gap-1">
          <span class="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">${item ? item.fontFamily : 'Fonte'}</span>
          ${isModified ? '<span class="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">Modificado</span>' : ''}
        </div>
      </div>
      <div class="text-slate-800 font-medium truncate" title="${newText}">${newText}</div>
      ${isModified && item && item.originalText ? `<div class="text-[10px] text-slate-400 mt-0.5 truncate">Original: ${item.originalText}</div>` : ''}
    `;
  }
};

