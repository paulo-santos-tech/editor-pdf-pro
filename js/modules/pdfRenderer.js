/**
 * Módulo de Renderização do Documento PDF via PDF.js
 */
window.PDFStudio = window.PDFStudio || {};

window.PDFStudio.Renderer = {
  canvas: null,
  drawCanvas: null,
  pageContainer: null,
  editOverlay: null,
  currentRenderTask: null,
  pristineImageData: null,

  init() {
    this.canvas = document.getElementById('pdf-render-canvas');
    this.drawCanvas = document.getElementById('draw-canvas');
    this.pageContainer = document.getElementById('pdf-page-container');
    this.editOverlay = document.getElementById('edit-overlay');

    // Configuração do Worker do PDF.js
    if (window.pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    this._bindPaginationAndZoom();
  },

  _bindPaginationAndZoom() {
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const zoomFitBtn = document.getElementById('zoom-fit');

    // Navegação Anterior
    if (prevPageBtn) {
      prevPageBtn.addEventListener('click', () => {
        const state = window.PDFStudio.State;
        const active = state.getActivePages();
        const currentIndex = active.indexOf(state.currentPage);
        if (currentIndex > 0) {
          state.currentPage = active[currentIndex - 1];
          this.renderCurrentPage();
        }
      });
    }

    // Navegação Próxima
    if (nextPageBtn) {
      nextPageBtn.addEventListener('click', () => {
        const state = window.PDFStudio.State;
        const active = state.getActivePages();
        const currentIndex = active.indexOf(state.currentPage);
        if (currentIndex >= 0 && currentIndex < active.length - 1) {
          state.currentPage = active[currentIndex + 1];
          this.renderCurrentPage();
        }
      });
    }

    // Zoom In
    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
        const state = window.PDFStudio.State;
        if (state.zoom < window.PDFStudio.Constants.ZOOM_MAX) {
          state.zoom = Math.round((state.zoom + window.PDFStudio.Constants.ZOOM_STEP) * 100) / 100;
          this._updateZoomLabel();
          this.renderCurrentPage();
        }
      });
    }

    // Zoom Out
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        const state = window.PDFStudio.State;
        if (state.zoom > window.PDFStudio.Constants.ZOOM_MIN) {
          state.zoom = Math.round((state.zoom - window.PDFStudio.Constants.ZOOM_STEP) * 100) / 100;
          this._updateZoomLabel();
          this.renderCurrentPage();
        }
      });
    }

    // Zoom Fit
    if (zoomFitBtn) {
      zoomFitBtn.addEventListener('click', () => {
        this.autoFitZoom();
        this.renderCurrentPage();
      });
    }
  },

  autoFitZoom() {
    const wrapper = document.getElementById('canvas-scroll-wrapper');
    if (!wrapper) return;
    const containerWidth = wrapper.clientWidth - 48;
    const targetZoom = Math.min(1.6, Math.max(0.4, containerWidth / 620));
    window.PDFStudio.State.zoom = Math.round(targetZoom * 100) / 100;
    this._updateZoomLabel();
  },

  _updateZoomLabel() {
    const zoomValEl = document.getElementById('zoom-val');
    if (zoomValEl) {
      zoomValEl.textContent = `${Math.round(window.PDFStudio.State.zoom * 100)}%`;
    }
  },

  async renderCurrentPage() {
    const state = window.PDFStudio.State;
    if (!state.pdfDocument) return;

    // Cancela qualquer tarefa de renderização em andamento
    if (this.currentRenderTask) {
      try {
        this.currentRenderTask.cancel();
      } catch (e) {}
      this.currentRenderTask = null;
    }

    const activePages = state.getActivePages();
    if (activePages.length === 0) {
      window.PDFStudio.Utils.showToast('Nenhuma página disponível no documento.', 'warn');
      return;
    }

    // Se a página atual não está mais ativa, ajusta para a mais próxima
    if (!activePages.includes(state.currentPage)) {
      state.currentPage = activePages[0];
    }

    const pageNum = state.currentPage;
    const pageIndexInActive = activePages.indexOf(pageNum);

    // Atualiza controles de paginação
    const currentPageNumEl = document.getElementById('current-page-num');
    const totalPagesNumEl = document.getElementById('total-pages-num');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');

    if (currentPageNumEl) currentPageNumEl.textContent = pageIndexInActive + 1;
    if (totalPagesNumEl) totalPagesNumEl.textContent = activePages.length;
    if (prevPageBtn) prevPageBtn.disabled = pageIndexInActive <= 0;
    if (nextPageBtn) nextPageBtn.disabled = pageIndexInActive >= activePages.length - 1;

    window.PDFStudio.Utils.showLoading(`Renderizando página ${pageNum}...`);

    try {
      const page = await state.pdfDocument.getPage(pageNum);
      const rotation = state.pageRotations[pageNum] || 0;
      const viewport = page.getViewport({ scale: state.zoom, rotation: rotation });
      state.pageViewport = viewport;

      const ctx = this.canvas.getContext('2d');
      this.canvas.width = viewport.width;
      this.canvas.height = viewport.height;
      this.drawCanvas.width = viewport.width;
      this.drawCanvas.height = viewport.height;

      this.pageContainer.style.width = `${viewport.width}px`;
      this.pageContainer.style.height = `${viewport.height}px`;

      this.currentRenderTask = page.render({ canvasContext: ctx, viewport: viewport });
      await this.currentRenderTask.promise;
      this.currentRenderTask = null;

      // Guarda uma cópia limpa da renderização da página para filtros não destrutivos
      try {
        this.pristineImageData = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      } catch (imgErr) {
        this.pristineImageData = null;
      }

      // Renderiza anotações de caneta
      if (window.PDFStudio.Drawing) {
        window.PDFStudio.Drawing.renderDrawingsForPage(pageNum);
      }

      // Extrai e renderiza a camada de texto
      const textContent = await page.getTextContent();
      this.editOverlay.innerHTML = '';
      state.currentItems = [];

      if (!state.modifications[pageNum]) {
        state.modifications[pageNum] = {};
      }

      let itemIndex = 0;
      textContent.items.forEach((item) => {
        if (!item.str || item.str.trim() === '') return;

        const tx = item.transform;
        const [transformedX, transformedY] = viewport.convertToViewportPoint(tx[4], tx[5]);

        const fontSize = Math.hypot(tx[2], tx[3]) * state.zoom;
        const width = (item.width || (item.str.length * 6)) * state.zoom;
        const height = (item.height ? item.height * state.zoom : fontSize);

        const left = transformedX;
        const top = transformedY - height;

        const detectedFamily = window.PDFStudio.Utils.identifyFontFamily(item.fontName);
        const detectedBold = window.PDFStudio.Utils.isFontBold(item.fontName);
        const detectedItalic = window.PDFStudio.Utils.isFontItalic(item.fontName);

        const savedEdit = state.modifications[pageNum][itemIndex];
        const currentText = savedEdit ? savedEdit.text : item.str;
        const isModified = Boolean(savedEdit && (savedEdit.text !== item.str || savedEdit.isDeleted));

        const itemObj = {
          index: itemIndex,
          originalText: item.str,
          currentText: currentText,
          isModified: isModified,
          isDeleted: savedEdit ? !!savedEdit.isDeleted : false,
          rawFontName: item.fontName || 'Desconhecida',
          fontFamily: savedEdit ? savedEdit.fontFamily : detectedFamily,
          isBold: savedEdit ? savedEdit.isBold : detectedBold,
          isItalic: savedEdit ? savedEdit.isItalic : detectedItalic,
          color: savedEdit ? savedEdit.color : window.PDFStudio.Constants.COLORS.TEXT_DEFAULT,
          x: tx[4],
          y: tx[5],
          pdfWidth: item.width,
          pdfHeight: item.height || (Math.hypot(tx[2], tx[3])),
          pdfFontSize: Math.round(Math.hypot(tx[2], tx[3])),
          viewLeft: left,
          viewTop: top,
          viewWidth: Math.max(width, 18),
          viewHeight: Math.max(height, 12),
          fontSizePx: fontSize,
          isNew: false
        };

        state.currentItems.push(itemObj);

        if (!itemObj.isDeleted && window.PDFStudio.TextEditor) {
          window.PDFStudio.TextEditor.createEditableElement(itemObj);
        }
        itemIndex++;
      });

      // Adiciona novos blocos manuais criados pelo usuário
      Object.entries(state.modifications[pageNum]).forEach(([idx, mod]) => {
        if (mod.isNew && !mod.isDeleted) {
          const numIdx = parseInt(idx, 10);
          const [viewX, viewY] = viewport.convertToViewportPoint(mod.x, mod.y);
          const itemObj = {
            index: numIdx,
            originalText: '',
            currentText: mod.text,
            isModified: true,
            isDeleted: false,
            rawFontName: 'Novo Bloco',
            fontFamily: mod.fontFamily || window.PDFStudio.Constants.STANDARD_FONTS.HELVETICA,
            isBold: !!mod.isBold,
            isItalic: !!mod.isItalic,
            color: mod.color || window.PDFStudio.Constants.COLORS.TEXT_DEFAULT,
            x: mod.x,
            y: mod.y,
            pdfWidth: mod.pdfWidth || 90,
            pdfHeight: mod.pdfHeight || 16,
            pdfFontSize: mod.pdfFontSize || 12,
            viewLeft: viewX,
            viewTop: viewY - (mod.pdfFontSize * state.zoom),
            viewWidth: 100,
            viewHeight: mod.pdfFontSize * state.zoom * 1.3,
            fontSizePx: mod.pdfFontSize * state.zoom,
            isNew: true
          };
          state.currentItems.push(itemObj);
          if (window.PDFStudio.TextEditor) {
            window.PDFStudio.TextEditor.createEditableElement(itemObj);
          }
        }
      });

      // Renderiza overlays (assinaturas e imagens)
      if (window.PDFStudio.Overlay) {
        window.PDFStudio.Overlay.renderPageOverlays(pageNum);
      }

      // Renderiza melhorias de imagem, corretivos, borracha e filtros
      if (window.PDFStudio.ImageEditor) {
        window.PDFStudio.ImageEditor.renderPageEnhancements(pageNum);
      }

      // Sincroniza lista da sidebar
      if (window.PDFStudio.TextEditor) {
        window.PDFStudio.TextEditor.renderSidebarList();
      }

      state.updateStatusBadge();
    } catch (err) {
      if (err.name !== 'RenderingCancelledException') {
        console.error(err);
        window.PDFStudio.Utils.showToast('Erro ao carregar a página: ' + err.message, 'error');
      }
    } finally {
      window.PDFStudio.Utils.hideLoading();
    }
  }
};

