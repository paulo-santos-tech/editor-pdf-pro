/**
 * Módulo de Edição de Imagem, Corretivo / Tarja, Borracha de Retoque, Filtros de Scan e OCR
 * Transforma PDFs em formato de imagem/escaneados em documentos 100% editáveis e nítidos.
 */
window.PDFStudio = window.PDFStudio || {};

window.PDFStudio.ImageEditor = {
  activeWhiteoutId: null,
  isDraggingWhiteout: false,
  isResizingWhiteout: false,
  dragStartX: 0,
  dragStartY: 0,
  initialBoxX: 0,
  initialBoxY: 0,
  initialBoxW: 0,
  initialBoxH: 0,

  init() {
    this._bindToolbarButtons();
    this._bindWhiteoutCanvasEvents();
    this._bindFilterModalEvents();
    this._bindOcrEvents();
  },

  _bindToolbarButtons() {
    const btnWhiteout = document.getElementById('btn-toggle-whiteout');
    const btnEraser = document.getElementById('btn-toggle-eraser');
    const btnFilters = document.getElementById('menu-btn-image-filters');
    const btnOcr = document.getElementById('menu-btn-ocr');

    if (btnWhiteout) {
      btnWhiteout.addEventListener('click', () => this.toggleWhiteoutMode());
    }

    if (btnEraser) {
      btnEraser.addEventListener('click', () => this.toggleEraserMode());
    }

    if (btnFilters) {
      btnFilters.addEventListener('click', () => this.openFiltersModal());
    }

    if (btnOcr) {
      btnOcr.addEventListener('click', () => this.openOcrModal());
    }
  },

  /* ========================================================================== */
  /* 1. MODO CORRETIVO / TARJA (WHITEOUT MASK)                                  */
  /* ========================================================================== */

  toggleWhiteoutMode(forceState) {
    const state = window.PDFStudio.State;
    state.isWhiteoutMode = (typeof forceState === 'boolean') ? forceState : !state.isWhiteoutMode;

    if (state.isWhiteoutMode) {
      // Desativa outros modos conflitantes
      if (state.isEraserMode) this.toggleEraserMode(false);
      if (state.isDrawingMode && window.PDFStudio.Drawing) window.PDFStudio.Drawing.toggleDrawingMode();
      if (state.isFontPickerActive && window.PDFStudio.FontDetector) window.PDFStudio.FontDetector.toggleFontPicker(false);
      if (state.isInsertMode && window.PDFStudio.TextEditor) window.PDFStudio.TextEditor.toggleInsertMode();
    }

    const btnWhiteout = document.getElementById('btn-toggle-whiteout');
    if (btnWhiteout) {
      btnWhiteout.classList.toggle('tool-btn-active', state.isWhiteoutMode);
      btnWhiteout.classList.toggle('bg-blue-600', state.isWhiteoutMode);
      btnWhiteout.classList.toggle('text-white', state.isWhiteoutMode);
    }

    const editOverlay = document.getElementById('edit-overlay');
    if (editOverlay) {
      editOverlay.style.cursor = state.isWhiteoutMode ? 'crosshair' : '';
    }

    if (state.isWhiteoutMode) {
      window.PDFStudio.Utils.showToast('Modo Corretivo Ativo: Clique ou arraste sobre qualquer texto para cobri-lo com a tarja!', 'info');
    }
  },

  _bindWhiteoutCanvasEvents() {
    const editOverlay = document.getElementById('edit-overlay');
    if (!editOverlay) return;

    let isCreatingBox = false;
    let startPdfPt = null;

    editOverlay.addEventListener('mousedown', (e) => {
      const state = window.PDFStudio.State;
      if (!state.isWhiteoutMode || !state.pageViewport) return;
      if (e.target.closest('.whiteout-element') || e.target.closest('.text-block-item') || e.target.closest('.overlay-element')) {
        return;
      }

      const rect = editOverlay.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const pdfPt = state.pageViewport.convertToPdfPoint(clickX, clickY);
      startPdfPt = { viewX: clickX, viewY: clickY, pdfX: pdfPt[0], pdfY: pdfPt[1] };
      isCreatingBox = true;
    });

    window.addEventListener('mouseup', (e) => {
      if (!isCreatingBox || !startPdfPt) return;
      isCreatingBox = false;

      const state = window.PDFStudio.State;
      if (!state.isWhiteoutMode || !state.pageViewport) return;

      const editOverlay = document.getElementById('edit-overlay');
      const rect = editOverlay.getBoundingClientRect();
      const currentX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const currentY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

      const widthPx = Math.abs(currentX - startPdfPt.viewX);
      const heightPx = Math.abs(currentY - startPdfPt.viewY);

      // Se foi apenas um clique rápido, cria caixa de tamanho padrão (100x24 em pts)
      let finalBox;
      if (widthPx < 8 || heightPx < 8) {
        finalBox = {
          id: 'wo_' + Date.now(),
          x: Math.round(startPdfPt.pdfX),
          y: Math.max(0, Math.round(startPdfPt.pdfY - 20)),
          width: 100,
          height: 20,
          color: '#ffffff'
        };
      } else {
        const currentPdfPt = state.pageViewport.convertToPdfPoint(currentX, currentY);
        const minX = Math.min(startPdfPt.pdfX, currentPdfPt[0]);
        const minY = Math.min(startPdfPt.pdfY, currentPdfPt[1]);
        const wPdf = Math.abs(startPdfPt.pdfX - currentPdfPt[0]);
        const hPdf = Math.abs(startPdfPt.pdfY - currentPdfPt[1]);

        finalBox = {
          id: 'wo_' + Date.now(),
          x: Math.round(minX),
          y: Math.round(minY),
          width: Math.round(Math.max(wPdf, 15)),
          height: Math.round(Math.max(hPdf, 10)),
          color: '#ffffff'
        };
      }

      const pageNum = state.currentPage;
      if (!state.whiteouts[pageNum]) state.whiteouts[pageNum] = [];
      state.whiteouts[pageNum].push(finalBox);

      this.renderWhiteoutsForPage(pageNum);
      state.recordState();
      this.toggleWhiteoutMode(false);
      window.PDFStudio.Utils.showToast('Tarja corretiva inserida! Redimensione ou digite por cima se desejar.', 'success');
    });
  },

  renderWhiteoutsForPage(pageNum) {
    const state = window.PDFStudio.State;
    const editOverlay = document.getElementById('edit-overlay');
    if (!editOverlay || !state.pageViewport) return;

    // Remove elementos de corretivo anteriores
    const existing = editOverlay.querySelectorAll('.whiteout-element');
    existing.forEach(el => el.remove());

    const pageBoxes = state.whiteouts[pageNum] || [];
    pageBoxes.forEach(box => {
      const el = document.createElement('div');
      el.className = 'whiteout-element';
      el.dataset.id = box.id;

      // Converte coordenadas do PDF para Viewport da tela
      // No PDF-Lib: box.x, box.y representa canto inferior esquerdo
      const [viewX, viewY] = state.pageViewport.convertToViewportPoint(box.x, box.y + box.height);
      const widthPx = box.width * state.zoom;
      const heightPx = box.height * state.zoom;

      el.style.left = `${viewX}px`;
      el.style.top = `${viewY}px`;
      el.style.width = `${widthPx}px`;
      el.style.height = `${heightPx}px`;
      el.style.backgroundColor = box.color || '#ffffff';

      // Botão de excluir
      const deleteBtn = document.createElement('div');
      deleteBtn.className = 'whiteout-delete-btn';
      deleteBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      deleteBtn.title = 'Remover esta tarja';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteWhiteout(box.id);
      });
      el.appendChild(deleteBtn);

      // Alça de redimensionamento
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'whiteout-resize-handle';
      resizeHandle.title = 'Arrastar para redimensionar';
      el.appendChild(resizeHandle);

      // Interações de Arrastar e Redimensionar
      this._setupWhiteoutInteractions(el, box);

      editOverlay.appendChild(el);
    });
  },

  _setupWhiteoutInteractions(el, box) {
    const state = window.PDFStudio.State;

    el.addEventListener('mousedown', (e) => {
      if (e.target.closest('.whiteout-delete-btn')) return;
      e.stopPropagation();

      const isHandle = e.target.closest('.whiteout-resize-handle');
      if (isHandle) {
        this.isResizingWhiteout = true;
      } else {
        this.isDraggingWhiteout = true;
      }

      this.activeWhiteoutId = box.id;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;

      const editOverlay = document.getElementById('edit-overlay');
      const rect = editOverlay.getBoundingClientRect();
      const curLeft = parseFloat(el.style.left) || 0;
      const curTop = parseFloat(el.style.top) || 0;

      this.initialBoxX = curLeft;
      this.initialBoxY = curTop;
      this.initialBoxW = el.offsetWidth;
      this.initialBoxH = el.offsetHeight;

      const onMouseMove = (moveEvt) => {
        const dx = moveEvt.clientX - this.dragStartX;
        const dy = moveEvt.clientY - this.dragStartY;

        if (this.isDraggingWhiteout) {
          el.style.left = `${this.initialBoxX + dx}px`;
          el.style.top = `${this.initialBoxY + dy}px`;
        } else if (this.isResizingWhiteout) {
          el.style.width = `${Math.max(15, this.initialBoxW + dx)}px`;
          el.style.height = `${Math.max(10, this.initialBoxH + dy)}px`;
        }
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);

        if (!this.isDraggingWhiteout && !this.isResizingWhiteout) return;

        // Atualiza as coordenadas em pontos do PDF
        const finalLeft = parseFloat(el.style.left);
        const finalTop = parseFloat(el.style.top);
        const finalW = el.offsetWidth;
        const finalH = el.offsetHeight;

        const [pdfX, pdfY] = state.pageViewport.convertToPdfPoint(finalLeft, finalTop + finalH);

        box.x = Math.round(pdfX);
        box.y = Math.round(pdfY);
        box.width = Math.round(finalW / state.zoom);
        box.height = Math.round(finalH / state.zoom);

        this.isDraggingWhiteout = false;
        this.isResizingWhiteout = false;
        state.recordState();
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  },

  deleteWhiteout(boxId) {
    const state = window.PDFStudio.State;
    const pageNum = state.currentPage;
    if (!state.whiteouts[pageNum]) return;

    state.whiteouts[pageNum] = state.whiteouts[pageNum].filter(b => b.id !== boxId);
    this.renderWhiteoutsForPage(pageNum);
    state.recordState();
    window.PDFStudio.Utils.showToast('Tarja removida com sucesso.', 'info');
  },

  /* ========================================================================== */
  /* 2. MODO BORRACHA DE RETOQUE                                                */
  /* ========================================================================== */

  toggleEraserMode(forceState) {
    const state = window.PDFStudio.State;
    state.isEraserMode = (typeof forceState === 'boolean') ? forceState : !state.isEraserMode;

    if (state.isEraserMode) {
      if (state.isWhiteoutMode) this.toggleWhiteoutMode(false);
      if (state.isDrawingMode && window.PDFStudio.Drawing) window.PDFStudio.Drawing.toggleDrawingMode();
      if (state.isFontPickerActive && window.PDFStudio.FontDetector) window.PDFStudio.FontDetector.toggleFontPicker(false);
    }

    const btnEraser = document.getElementById('btn-toggle-eraser');
    if (btnEraser) {
      btnEraser.classList.toggle('tool-btn-active', state.isEraserMode);
      btnEraser.classList.toggle('bg-rose-600', state.isEraserMode);
      btnEraser.classList.toggle('text-white', state.isEraserMode);
    }

    const drawCanvas = document.getElementById('draw-canvas');
    if (drawCanvas) {
      drawCanvas.classList.toggle('drawing-active', state.isEraserMode);
      drawCanvas.style.cursor = state.isEraserMode ? 'cell' : '';
    }

    if (state.isEraserMode) {
      window.PDFStudio.Utils.showToast('Pincel Borracha Ativo: Pinte sobre qualquer mancha ou texto indesejado para apagar.', 'info');
      this._setupEraserDrawing();
    }
  },

  _setupEraserDrawing() {
    const drawCanvas = document.getElementById('draw-canvas');
    if (!drawCanvas) return;

    let isErasing = false;
    let activeStroke = [];

    const getCanvasCoords = (e) => {
      const rect = drawCanvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const startErasing = (e) => {
      const state = window.PDFStudio.State;
      if (!state.isEraserMode) return;
      isErasing = true;
      const pt = getCanvasCoords(e);
      activeStroke = [{ x: pt.x / state.zoom, y: pt.y / state.zoom }];
    };

    const moveErasing = (e) => {
      const state = window.PDFStudio.State;
      if (!state.isEraserMode || !isErasing) return;
      const pt = getCanvasCoords(e);
      activeStroke.push({ x: pt.x / state.zoom, y: pt.y / state.zoom });

      const ctx = drawCanvas.getContext('2d');
      ctx.strokeStyle = '#ffffff'; // Cor de cobertura branca padrão
      ctx.lineWidth = (state.eraserSize || 20) * state.zoom;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (activeStroke.length > 1) {
        const p1 = activeStroke[activeStroke.length - 2];
        const p2 = activeStroke[activeStroke.length - 1];
        ctx.beginPath();
        ctx.moveTo(p1.x * state.zoom, p1.y * state.zoom);
        ctx.lineTo(p2.x * state.zoom, p2.y * state.zoom);
        ctx.stroke();
      }
    };

    const stopErasing = () => {
      const state = window.PDFStudio.State;
      if (!state.isEraserMode || !isErasing) return;
      isErasing = false;

      if (activeStroke.length > 1) {
        const pageNum = state.currentPage;
        if (!state.eraserStrokes[pageNum]) state.eraserStrokes[pageNum] = [];
        state.eraserStrokes[pageNum].push({
          color: '#ffffff',
          size: state.eraserSize || 20,
          points: [...activeStroke]
        });
        state.recordState();
      }
      activeStroke = [];
    };

    drawCanvas.onmousedown = startErasing;
    drawCanvas.onmousemove = moveErasing;
    window.addEventListener('mouseup', stopErasing);
  },

  renderEraserStrokesForPage(pageNum) {
    const drawCanvas = document.getElementById('draw-canvas');
    if (!drawCanvas) return;

    const state = window.PDFStudio.State;
    const strokes = state.eraserStrokes[pageNum] || [];
    if (strokes.length === 0) return;

    const ctx = drawCanvas.getContext('2d');
    strokes.forEach(s => {
      if (!s.points || s.points.length < 2) return;
      ctx.strokeStyle = s.color || '#ffffff';
      ctx.lineWidth = (s.size || 20) * state.zoom;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(s.points[0].x * state.zoom, s.points[0].y * state.zoom);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x * state.zoom, s.points[i].y * state.zoom);
      }
      ctx.stroke();
    });
  },

  /* ========================================================================== */
  /* 3. FILTROS DE IMAGEM DA PÁGINA (BRILHO, CONTRASTE, P&B, BINARIZAÇÃO)       */
  /* ========================================================================== */

  openFiltersModal() {
    const modal = document.getElementById('modal-image-filters');
    if (!modal) return;

    const state = window.PDFStudio.State;
    const current = state.pageFilters[state.currentPage] || {
      brightness: 100,
      contrast: 100,
      grayscale: false,
      binarize: false,
      threshold: 135
    };

    const brightInput = document.getElementById('filter-brightness');
    const contrastInput = document.getElementById('filter-contrast');
    const grayCheck = document.getElementById('filter-grayscale');
    const binarizeCheck = document.getElementById('filter-binarize');
    const threshInput = document.getElementById('filter-threshold');

    if (brightInput) brightInput.value = current.brightness;
    if (contrastInput) contrastInput.value = current.contrast;
    if (grayCheck) grayCheck.checked = !!current.grayscale;
    if (binarizeCheck) binarizeCheck.checked = !!current.binarize;
    if (threshInput) threshInput.value = current.threshold || 135;

    this._updateFilterLabels();
    modal.classList.remove('hidden');
  },

  closeFiltersModal() {
    const modal = document.getElementById('modal-image-filters');
    if (modal) modal.classList.add('hidden');
  },

  _bindFilterModalEvents() {
    const modal = document.getElementById('modal-image-filters');
    const btnClose = document.getElementById('btn-close-filters');
    const btnCancel = document.getElementById('btn-cancel-filters');
    const btnApply = document.getElementById('btn-apply-filters');
    const btnApplyAll = document.getElementById('btn-apply-filters-all');
    const btnReset = document.getElementById('btn-reset-filters');

    const brightInput = document.getElementById('filter-brightness');
    const contrastInput = document.getElementById('filter-contrast');
    const grayCheck = document.getElementById('filter-grayscale');
    const binarizeCheck = document.getElementById('filter-binarize');
    const threshInput = document.getElementById('filter-threshold');

    if (btnClose) btnClose.addEventListener('click', () => this.closeFiltersModal());
    if (btnCancel) btnCancel.addEventListener('click', () => this.closeFiltersModal());

    const onFilterChange = () => {
      this._updateFilterLabels();
      this.applyLivePreview();
    };

    [brightInput, contrastInput, threshInput].forEach(inp => {
      if (inp) inp.addEventListener('input', onFilterChange);
    });

    [grayCheck, binarizeCheck].forEach(chk => {
      if (chk) chk.addEventListener('change', onFilterChange);
    });

    if (btnApply) {
      btnApply.addEventListener('click', () => {
        const state = window.PDFStudio.State;
        state.pageFilters[state.currentPage] = this._getFilterValues();
        state.recordState();
        this.closeFiltersModal();
        window.PDFStudio.Utils.showToast('Filtro de nitidez aplicado na página atual!', 'success');
      });
    }

    if (btnApplyAll) {
      btnApplyAll.addEventListener('click', () => {
        const state = window.PDFStudio.State;
        const vals = this._getFilterValues();
        const active = state.getActivePages();
        active.forEach(p => {
          state.pageFilters[p] = { ...vals };
        });
        state.recordState();
        this.closeFiltersModal();
        window.PDFStudio.Utils.showToast('Filtro de nitidez aplicado em todas as páginas!', 'success');
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', () => {
        const state = window.PDFStudio.State;
        delete state.pageFilters[state.currentPage];
        state.recordState();
        if (window.PDFStudio.Renderer) window.PDFStudio.Renderer.renderCurrentPage();
        this.closeFiltersModal();
        window.PDFStudio.Utils.showToast('Filtros restaurados para o original.', 'info');
      });
    }
  },

  _getFilterValues() {
    return {
      brightness: parseInt(document.getElementById('filter-brightness')?.value || '100', 10),
      contrast: parseInt(document.getElementById('filter-contrast')?.value || '100', 10),
      grayscale: !!document.getElementById('filter-grayscale')?.checked,
      binarize: !!document.getElementById('filter-binarize')?.checked,
      threshold: parseInt(document.getElementById('filter-threshold')?.value || '135', 10)
    };
  },

  _updateFilterLabels() {
    const bVal = document.getElementById('filter-brightness')?.value;
    const cVal = document.getElementById('filter-contrast')?.value;
    const tVal = document.getElementById('filter-threshold')?.value;

    const bLbl = document.getElementById('filter-brightness-val');
    const cLbl = document.getElementById('filter-contrast-val');
    const tLbl = document.getElementById('filter-threshold-val');

    if (bLbl && bVal) bLbl.textContent = `${bVal}%`;
    if (cLbl && cVal) cLbl.textContent = `${cVal}%`;
    if (tLbl && tVal) tLbl.textContent = tVal;
  },

  applyLivePreview() {
    const canvas = document.getElementById('pdf-render-canvas');
    if (!canvas) return;

    const filters = this._getFilterValues();
    this.applyFiltersToCanvas(canvas, filters);
  },

  applyFiltersToCanvas(canvas, filters) {
    if (!canvas || !filters) return;
    const ctx = canvas.getContext('2d');

    // 1. Aplica CSS Filters para brilho, contraste e escala de cinza
    let filterString = `brightness(${filters.brightness}%) contrast(${filters.contrast}%)`;
    if (filters.grayscale) filterString += ` grayscale(100%)`;

    ctx.save();
    ctx.filter = filterString;
    ctx.drawImage(canvas, 0, 0);
    ctx.restore();

    // 2. Binarização inteligente (Limiar P&B para fotos de documentos/escaneamentos)
    if (filters.binarize) {
      try {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const thresh = filters.threshold || 135;

        for (let i = 0; i < data.length; i += 4) {
          // Luminância perceptual
          const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
          const val = lum > thresh ? 255 : 0;
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        }
        ctx.putImageData(imgData, 0, 0);
      } catch (e) {
        console.warn('Erro ao aplicar binarização:', e);
      }
    }
  },

  /* ========================================================================== */
  /* 4. RECONHECIMENTO DE TEXTO OCR VIA TESSERACT.JS (SCAN-TO-TEXT)             */
  /* ========================================================================== */

  openOcrModal() {
    const modal = document.getElementById('modal-ocr');
    if (modal) modal.classList.remove('hidden');
  },

  closeOcrModal() {
    const modal = document.getElementById('modal-ocr');
    if (modal) modal.classList.add('hidden');
  },

  _bindOcrEvents() {
    const modal = document.getElementById('modal-ocr');
    const btnClose = document.getElementById('btn-close-ocr');
    const btnCancel = document.getElementById('btn-cancel-ocr');
    const btnRunOcr = document.getElementById('btn-run-ocr');

    if (btnClose) btnClose.addEventListener('click', () => this.closeOcrModal());
    if (btnCancel) btnCancel.addEventListener('click', () => this.closeOcrModal());

    if (btnRunOcr) {
      btnRunOcr.addEventListener('click', () => this.executeOcrOnCurrentPage());
    }
  },

  async executeOcrOnCurrentPage() {
    const state = window.PDFStudio.State;
    const canvas = document.getElementById('pdf-render-canvas');
    if (!canvas || !state.pdfDocument) {
      window.PDFStudio.Utils.showToast('Abra um PDF antes de executar o OCR.', 'warn');
      return;
    }

    this.closeOcrModal();
    window.PDFStudio.Utils.showLoading('Inicializando motor OCR e analisando caracteres...');

    try {
      // Garante carregamento do Tesseract.js se não estiver carregado
      if (typeof Tesseract === 'undefined') {
        await this._loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
      }

      const langSelect = document.getElementById('ocr-lang-select');
      const lang = langSelect ? langSelect.value : 'por';

      window.PDFStudio.Utils.showLoading('Reconhecendo textos na imagem da página...');

      const worker = await Tesseract.createWorker(lang, 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const pct = Math.round((m.progress || 0) * 100);
            window.PDFStudio.Utils.showLoading(`Reconhecendo texto via OCR (${pct}%)...`);
          }
        }
      });

      const { data } = await worker.recognize(canvas);
      await worker.terminate();

      if (!data || !data.words || data.words.length === 0) {
        window.PDFStudio.Utils.showToast('Nenhum texto detectado nesta página.', 'info');
        return;
      }

      const pageNum = state.currentPage;
      if (!state.modifications[pageNum]) state.modifications[pageNum] = {};
      if (!state.whiteouts[pageNum]) state.whiteouts[pageNum] = [];

      let addedCount = 0;
      let nextIndex = 1000 + Object.keys(state.modifications[pageNum]).length;

      // Agrupa palavras com confiança suficiente em blocos editáveis
      data.lines.forEach((line) => {
        const text = line.text.trim();
        if (!text || text.length < 2) return;

        const bbox = line.bbox; // { x0, y0, x1, y1 } em pixels do canvas
        const viewX = bbox.x0;
        const viewY = bbox.y0;
        const viewW = bbox.x1 - bbox.x0;
        const viewH = bbox.y1 - bbox.y0;

        // Converte coordenadas do canvas para pontos do PDF
        const [pdfX, pdfY] = state.pageViewport.convertToPdfPoint(viewX, viewY + viewH);
        const pdfWidth = Math.round(viewW / state.zoom);
        const pdfHeight = Math.round(viewH / state.zoom);
        const approxFontSize = Math.max(9, Math.round(pdfHeight * 0.75));

        // 1. Cria cobertura branca (whiteout) automática para cobrir a imagem original
        state.whiteouts[pageNum].push({
          id: 'wo_ocr_' + Date.now() + '_' + nextIndex,
          x: Math.round(pdfX),
          y: Math.round(pdfY),
          width: pdfWidth + 4,
          height: pdfHeight + 2,
          color: '#ffffff'
        });

        // 2. Injeta bloco de texto editável com tipografia configurável
        state.modifications[pageNum][nextIndex] = {
          text: text,
          original: '',
          fontFamily: state.clonedStyle.fontFamily || 'Helvetica',
          pdfFontSize: approxFontSize,
          isBold: false,
          isItalic: false,
          color: state.clonedStyle.color || '#0f172a',
          isNew: true,
          isDeleted: false,
          x: Math.round(pdfX),
          y: Math.round(pdfY),
          pdfWidth: pdfWidth,
          pdfHeight: pdfHeight
        };

        nextIndex++;
        addedCount++;
      });

      // Recarrega visualização da página com os novos elementos interativos
      if (window.PDFStudio.Renderer) {
        await window.PDFStudio.Renderer.renderCurrentPage();
      }

      state.recordState();
      window.PDFStudio.Utils.showToast(
        `OCR Concluído: ${addedCount} blocos de texto reconhecidos e prontos para edição!`,
        'success'
      );
    } catch (err) {
      console.error('Erro no processamento OCR:', err);
      window.PDFStudio.Utils.showToast('Falha no reconhecimento OCR: ' + err.message, 'error');
    } finally {
      window.PDFStudio.Utils.hideLoading();
    }
  },

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Erro ao carregar script OCR: ' + src));
      document.head.appendChild(script);
    });
  },

  /**
   * Chamado pelo renderizador para aplicar filtros e melhorias salvas da página
   */
  renderPageEnhancements(pageNum) {
    const state = window.PDFStudio.State;
    
    // 1. Aplica filtros visuais salvos na folha renderizada
    const filters = state.pageFilters[pageNum];
    if (filters) {
      const canvas = document.getElementById('pdf-render-canvas');
      this.applyFiltersToCanvas(canvas, filters);
    }

    // 2. Renderiza corretivos e tarjas
    this.renderWhiteoutsForPage(pageNum);

    // 3. Renderiza traços de borracha
    this.renderEraserStrokesForPage(pageNum);
  }
};
