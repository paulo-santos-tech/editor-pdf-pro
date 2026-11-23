/**
 * Módulo de Ferramentas Auxiliares: Merge, Split, Marca d'Água, TXT e PNG
 */
window.PDFStudio = window.PDFStudio || {};

window.PDFStudio.Tools = {
  init() {
    this._bindMergeEvents();
    this._bindSplitEvents();
    this._bindWatermarkEvents();
    this._bindExportExportEvents();
  },

  // ==========================================
  // JUNTAR (MERGE) PDFs
  // ==========================================
  _bindMergeEvents() {
    const modalMerge = document.getElementById('modal-merge');
    const menuBtnMerge = document.getElementById('menu-btn-merge');
    const btnCloseMerge = document.getElementById('btn-close-merge');
    const btnCancelMerge = document.getElementById('btn-cancel-merge');
    const btnAddMergeFiles = document.getElementById('btn-add-merge-files');
    const mergeFileInput = document.getElementById('merge-file-input');
    const btnRunMerge = document.getElementById('btn-run-merge');

    if (menuBtnMerge) menuBtnMerge.addEventListener('click', () => this.openMergeModal());
    if (btnCloseMerge && modalMerge) btnCloseMerge.addEventListener('click', () => modalMerge.classList.add('hidden'));
    if (btnCancelMerge && modalMerge) btnCancelMerge.addEventListener('click', () => modalMerge.classList.add('hidden'));
    if (btnAddMergeFiles && mergeFileInput) btnAddMergeFiles.addEventListener('click', () => mergeFileInput.click());

    if (mergeFileInput) {
      mergeFileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        window.PDFStudio.Utils.showLoading('Lendo arquivos para junção...');
        try {
          for (const file of files) {
            if (file.type !== 'application/pdf') continue;
            const buf = await file.arrayBuffer();
            const doc = await PDFLib.PDFDocument.load(buf);
            window.PDFStudio.State.mergeFiles.push({
              name: file.name,
              buffer: buf,
              pages: doc.getPageCount()
            });
          }
          this.renderMergeList();
        } catch (err) {
          console.error(err);
          window.PDFStudio.Utils.showToast('Erro ao processar arquivos: ' + err.message, 'error');
        } finally {
          window.PDFStudio.Utils.hideLoading();
          mergeFileInput.value = '';
        }
      });
    }

    if (btnRunMerge) {
      btnRunMerge.addEventListener('click', async () => {
        const state = window.PDFStudio.State;
        if (state.mergeFiles.length < 2) return;

        const standardize = document.getElementById('merge-standardize-check')?.checked ?? true;
        const format = document.getElementById('merge-format-select')?.value || 'A4';
        const orientation = document.getElementById('merge-orientation-select')?.value || 'auto';

        window.PDFStudio.Utils.showLoading('Unificando e padronizando todas as folhas...');
        try {
          const mergedPdf = await PDFLib.PDFDocument.create();

          for (const file of state.mergeFiles) {
            const loadedDoc = await PDFLib.PDFDocument.load(file.buffer);
            const pageIndices = loadedDoc.getPageIndices();
            for (const idx of pageIndices) {
              await window.PDFStudio.Utils.addStandardizedPage(mergedPdf, loadedDoc, idx, {
                standardize,
                format,
                orientation
              });
            }
          }

          const mergedBytes = await mergedPdf.save();
          const blob = new Blob([mergedBytes], { type: 'application/pdf' });
          window.PDFStudio.Utils.downloadBlob(blob, `PDFs_Unificados_${Date.now()}.pdf`);

          if (modalMerge) modalMerge.classList.add('hidden');
          window.PDFStudio.Utils.showToast('PDFs unificados com folhas padronizadas!');
        } catch (err) {
          console.error(err);
          window.PDFStudio.Utils.showToast('Erro ao unir os PDFs: ' + err.message, 'error');
        } finally {
          window.PDFStudio.Utils.hideLoading();
        }
      });
    }
  },

  openMergeModal() {
    const state = window.PDFStudio.State;
    const modalMerge = document.getElementById('modal-merge');
    if (!modalMerge) return;

    if (state.pdfBytes && state.mergeFiles.length === 0) {
      state.mergeFiles.push({
        name: state.fileName,
        buffer: state.pdfBytes,
        pages: state.totalPages
      });
    }
    this.renderMergeList();
    modalMerge.classList.remove('hidden');
  },

  renderMergeList() {
    const mergeFilesList = document.getElementById('merge-files-list');
    const btnRunMerge = document.getElementById('btn-run-merge');
    if (!mergeFilesList) return;

    const state = window.PDFStudio.State;
    mergeFilesList.innerHTML = '';

    if (state.mergeFiles.length === 0) {
      mergeFilesList.innerHTML = '<p class="text-[11px] text-slate-400 text-center py-4">Nenhum arquivo adicionado ainda.</p>';
      if (btnRunMerge) btnRunMerge.disabled = true;
      return;
    }

    if (btnRunMerge) btnRunMerge.disabled = state.mergeFiles.length < 2;

    state.mergeFiles.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs';
      item.innerHTML = `
        <div class="flex items-center space-x-2.5 truncate">
          <span class="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-[10px] shrink-0">${index + 1}</span>
          <div class="truncate">
            <span class="font-medium text-slate-800 truncate block">${file.name}</span>
            <span class="text-[10px] text-slate-400">${file.pages} pág(s)</span>
          </div>
        </div>
        <div class="flex items-center space-x-1 shrink-0 ml-2">
          <button class="btn-move-up p-1 text-slate-500 hover:text-slate-800 disabled:opacity-20" ${index === 0 ? 'disabled' : ''} title="Subir">
            <i class="fa-solid fa-chevron-up text-[10px]"></i>
          </button>
          <button class="btn-move-down p-1 text-slate-500 hover:text-slate-800 disabled:opacity-20" ${index === state.mergeFiles.length - 1 ? 'disabled' : ''} title="Descer">
            <i class="fa-solid fa-chevron-down text-[10px]"></i>
          </button>
          <button class="btn-remove-merge p-1 text-rose-500 hover:text-rose-700 ml-1" title="Remover">
            <i class="fa-solid fa-trash-can text-xs"></i>
          </button>
        </div>
      `;

      item.querySelector('.btn-move-up').addEventListener('click', () => {
        if (index > 0) {
          const temp = state.mergeFiles[index];
          state.mergeFiles[index] = state.mergeFiles[index - 1];
          state.mergeFiles[index - 1] = temp;
          this.renderMergeList();
        }
      });

      item.querySelector('.btn-move-down').addEventListener('click', () => {
        if (index < state.mergeFiles.length - 1) {
          const temp = state.mergeFiles[index];
          state.mergeFiles[index] = state.mergeFiles[index + 1];
          state.mergeFiles[index + 1] = temp;
          this.renderMergeList();
        }
      });

      item.querySelector('.btn-remove-merge').addEventListener('click', () => {
        state.mergeFiles.splice(index, 1);
        this.renderMergeList();
      });

      mergeFilesList.appendChild(item);
    });
  },

  // ==========================================
  // SEPARAR / EXTRAIR PÁGINAS (SPLIT)
  // ==========================================
  _bindSplitEvents() {
    const modalSplit = document.getElementById('modal-split');
    const menuBtnSplit = document.getElementById('menu-btn-split');
    const btnCloseSplit = document.getElementById('btn-close-split');
    const btnCancelSplit = document.getElementById('btn-cancel-split');
    const btnRunSplit = document.getElementById('btn-run-split');
    const splitTotalPagesLabel = document.getElementById('split-total-pages-label');
    const splitCurrentPageLabel = document.getElementById('split-current-page-label');
    const splitRangeInput = document.getElementById('split-range-input');

    if (menuBtnSplit) {
      menuBtnSplit.addEventListener('click', () => {
        const state = window.PDFStudio.State;
        if (!state.pdfBytes) {
          window.PDFStudio.Utils.showToast('Abra um PDF primeiro.', 'warn');
          return;
        }
        if (splitTotalPagesLabel) splitTotalPagesLabel.textContent = state.totalPages;
        if (splitCurrentPageLabel) splitCurrentPageLabel.textContent = state.currentPage;
        if (splitRangeInput) splitRangeInput.value = `1-${Math.min(state.totalPages, 2)}`;
        if (modalSplit) modalSplit.classList.remove('hidden');
      });
    }

    if (btnCloseSplit && modalSplit) btnCloseSplit.addEventListener('click', () => modalSplit.classList.add('hidden'));
    if (btnCancelSplit && modalSplit) btnCancelSplit.addEventListener('click', () => modalSplit.classList.add('hidden'));

    if (btnRunSplit) {
      btnRunSplit.addEventListener('click', async () => {
        const state = window.PDFStudio.State;
        if (!state.pdfBytes) return;

        const selectedOption = document.querySelector('input[name="split-option"]:checked')?.value || 'range';
        let pagesToExtract = [];

        if (selectedOption === 'current') {
          pagesToExtract = [state.currentPage];
        } else {
          const rangeText = splitRangeInput ? splitRangeInput.value : '';
          pagesToExtract = window.PDFStudio.Utils.parsePageRange(rangeText, state.totalPages);
          if (pagesToExtract.length === 0) {
            window.PDFStudio.Utils.showToast('Nenhuma página válida selecionada.', 'warn');
            return;
          }
        }

        const standardize = document.getElementById('split-standardize-check')?.checked ?? true;
        const format = document.getElementById('split-format-select')?.value || 'A4';

        window.PDFStudio.Utils.showLoading(`Extraindo ${pagesToExtract.length} página(s) padronizada(s)...`);
        try {
          const originalDoc = await PDFLib.PDFDocument.load(state.pdfBytes);
          const newDoc = await PDFLib.PDFDocument.create();

          for (const pageNum of pagesToExtract) {
            const pageIndex = pageNum - 1;
            await window.PDFStudio.Utils.addStandardizedPage(newDoc, originalDoc, pageIndex, {
              standardize,
              format,
              orientation: 'auto'
            });
          }

          const extractedBytes = await newDoc.save();
          const blob = new Blob([extractedBytes], { type: 'application/pdf' });
          const baseName = state.fileName.replace(/\.[^/.]+$/, "");
          const rangeLabel = selectedOption === 'current' ? `pag_${state.currentPage}` : `pags_${pagesToExtract.join('_')}`;

          window.PDFStudio.Utils.downloadBlob(blob, `${baseName}_${rangeLabel}.pdf`);
          if (modalSplit) modalSplit.classList.add('hidden');
          window.PDFStudio.Utils.showToast('Páginas extraídas e padronizadas com sucesso!');
        } catch (err) {
          console.error(err);
          window.PDFStudio.Utils.showToast('Erro ao separar páginas: ' + err.message, 'error');
        } finally {
          window.PDFStudio.Utils.hideLoading();
        }
      });
    }
  },

  // ==========================================
  // MARCA D'ÁGUA & NUMERAÇÃO
  // ==========================================
  _bindWatermarkEvents() {
    const modalWatermark = document.getElementById('modal-watermark');
    const menuBtnWatermark = document.getElementById('menu-btn-watermark');
    const btnCloseWatermark = document.getElementById('btn-close-watermark');
    const btnCancelWatermark = document.getElementById('btn-cancel-watermark');
    const btnApplyWatermark = document.getElementById('btn-apply-watermark');
    const watermarkTextInput = document.getElementById('watermark-text-input');
    const watermarkOpacityInput = document.getElementById('watermark-opacity-input');
    const watermarkColorInput = document.getElementById('watermark-color-input');
    const addPageNumbersCheck = document.getElementById('add-page-numbers-check');
    const standardizePagesCheck = document.getElementById('standardize-pages-check');

    if (menuBtnWatermark) {
      menuBtnWatermark.addEventListener('click', () => {
        const state = window.PDFStudio.State;
        if (!state.pdfBytes) {
          window.PDFStudio.Utils.showToast('Abra um PDF primeiro.', 'warn');
          return;
        }
        if (watermarkTextInput) watermarkTextInput.value = state.watermarkText;
        if (watermarkOpacityInput) watermarkOpacityInput.value = state.watermarkOpacity;
        if (watermarkColorInput) watermarkColorInput.value = state.watermarkColor;
        if (addPageNumbersCheck) addPageNumbersCheck.checked = state.addPageNumbers;
        if (standardizePagesCheck) standardizePagesCheck.checked = state.standardizePages;
        if (modalWatermark) modalWatermark.classList.remove('hidden');
      });
    }

    if (btnCloseWatermark && modalWatermark) btnCloseWatermark.addEventListener('click', () => modalWatermark.classList.add('hidden'));
    if (btnCancelWatermark && modalWatermark) btnCancelWatermark.addEventListener('click', () => modalWatermark.classList.add('hidden'));

    if (btnApplyWatermark) {
      btnApplyWatermark.addEventListener('click', () => {
        const state = window.PDFStudio.State;
        state.watermarkText = watermarkTextInput ? watermarkTextInput.value.trim() : '';
        state.watermarkOpacity = watermarkOpacityInput ? parseFloat(watermarkOpacityInput.value) : 0.15;
        state.watermarkColor = watermarkColorInput ? watermarkColorInput.value : window.PDFStudio.Constants.COLORS.WATERMARK_DEFAULT;
        state.addPageNumbers = addPageNumbersCheck ? addPageNumbersCheck.checked : false;
        state.standardizePages = standardizePagesCheck ? standardizePagesCheck.checked : false;

        if (modalWatermark) modalWatermark.classList.add('hidden');
        state.recordState();
        window.PDFStudio.Utils.showToast('Configurações salvas! Elas serão aplicadas ao exportar.');
      });
    }
  },

  // ==========================================
  // EXPORTAÇÃO TXT E PNG
  // ==========================================
  _bindExportExportEvents() {
    const menuBtnExportImg = document.getElementById('menu-btn-export-img');
    const menuBtnExportTxt = document.getElementById('menu-btn-export-txt');

    // Exportar página como imagem PNG
    if (menuBtnExportImg) {
      menuBtnExportImg.addEventListener('click', () => {
        const state = window.PDFStudio.State;
        const canvas = document.getElementById('pdf-render-canvas');
        const drawCanvas = document.getElementById('draw-canvas');
        if (!state.pdfDocument || !canvas) return;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, 0);
        if (drawCanvas) ctx.drawImage(drawCanvas, 0, 0);

        tempCanvas.toBlob((blob) => {
          if (blob) {
            const baseName = state.fileName.replace(/\.[^/.]+$/, "");
            window.PDFStudio.Utils.downloadBlob(blob, `${baseName}_pag_${state.currentPage}.png`);
            window.PDFStudio.Utils.showToast('Página salva como imagem PNG!');
          }
        }, 'image/png');
      });
    }

    // Extrair texto puro em arquivo TXT
    if (menuBtnExportTxt) {
      menuBtnExportTxt.addEventListener('click', async () => {
        const state = window.PDFStudio.State;
        if (!state.pdfDocument) return;

        window.PDFStudio.Utils.showLoading('Extraindo textos de todas as páginas...');
        try {
          let fullText = '';
          const activePages = state.getActivePages();

          for (const p of activePages) {
            fullText += `--- PÁGINA ${p} ---\n\n`;
            const page = await state.pdfDocument.getPage(p);
            const content = await page.getTextContent();
            content.items.forEach(item => {
              if (item.str) fullText += item.str + ' ';
            });
            fullText += '\n\n';
          }

          const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
          const baseName = state.fileName.replace(/\.[^/.]+$/, "");
          window.PDFStudio.Utils.downloadBlob(blob, `${baseName}_texto.txt`);
          window.PDFStudio.Utils.showToast('Texto puro extraído com sucesso!');
        } catch (err) {
          console.error(err);
          window.PDFStudio.Utils.showToast('Erro ao extrair texto: ' + err.message, 'error');
        } finally {
          window.PDFStudio.Utils.hideLoading();
        }
      });
    }
  }
};

