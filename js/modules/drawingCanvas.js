/**
 * Módulo de Caneta e Desenhos Livres (Anotações na página)
 */
window.PDFStudio = window.PDFStudio || {};

window.PDFStudio.Drawing = {
  drawCanvas: null,
  activeStroke: [],

  init() {
    this.drawCanvas = document.getElementById('draw-canvas');
    if (!this.drawCanvas) return;

    this._bindEvents();
  },

  _bindEvents() {
    const canvas = this.drawCanvas;

    // Mouse events
    canvas.addEventListener('mousedown', (e) => this._startStroke(e));
    canvas.addEventListener('mousemove', (e) => this._drawMove(e));
    window.addEventListener('mouseup', () => this._endStroke());

    // Touch events (Mobile)
    canvas.addEventListener('touchstart', (e) => {
      if (window.PDFStudio.State.isDrawingMode) {
        e.preventDefault();
        this._startStroke(e);
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      if (window.PDFStudio.State.isDrawingMode) {
        e.preventDefault();
        this._drawMove(e);
      }
    }, { passive: false });

    window.addEventListener('touchend', () => {
      if (window.PDFStudio.State.isDrawingMode) {
        this._endStroke();
      }
    });
  },

  toggleDrawingMode(forceState) {
    const state = window.PDFStudio.State;
    state.isDrawingMode = (typeof forceState === 'boolean') ? forceState : !state.isDrawingMode;

    if (state.isDrawingMode) {
      if (state.isEraserMode && window.PDFStudio.ImageEditor) window.PDFStudio.ImageEditor.toggleEraserMode(false);
      if (state.isWhiteoutMode && window.PDFStudio.ImageEditor) window.PDFStudio.ImageEditor.toggleWhiteoutMode(false);
      if (state.isFontPickerActive && window.PDFStudio.FontDetector) window.PDFStudio.FontDetector.toggleFontPicker(false);
      if (state.isInsertMode && window.PDFStudio.TextEditor) window.PDFStudio.TextEditor.toggleInsertMode(false);
    }

    const btnToggleDraw = document.getElementById('btn-toggle-draw');
    if (btnToggleDraw) {
      btnToggleDraw.classList.toggle('bg-emerald-100', state.isDrawingMode);
      btnToggleDraw.classList.toggle('text-emerald-800', state.isDrawingMode);
    }

    if (this.drawCanvas) {
      this.drawCanvas.classList.toggle('drawing-active', state.isDrawingMode);
    }

    if (state.isDrawingMode) {
      window.PDFStudio.Utils.showToast('Modo Caneta ativado! Desenhe ou rasure sobre a página.', 'info');
    }
  },

  _getCanvasCoords(e) {
    const rect = this.drawCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  },

  _startStroke(e) {
    const state = window.PDFStudio.State;
    if (!state.isDrawingMode) return;

    state.isDrawing = true;
    const pt = this._getCanvasCoords(e);
    // Armazena as coordenadas independentes de zoom (em pontos do PDF)
    this.activeStroke = [{ x: pt.x / state.zoom, y: pt.y / state.zoom }];
  },

  _drawMove(e) {
    const state = window.PDFStudio.State;
    if (!state.isDrawingMode || !state.isDrawing) return;

    const pt = this._getCanvasCoords(e);
    this.activeStroke.push({ x: pt.x / state.zoom, y: pt.y / state.zoom });

    const fontColorPicker = document.getElementById('font-color-picker');
    const color = fontColorPicker ? fontColorPicker.value : window.PDFStudio.Constants.COLORS.DRAWING_DEFAULT;

    const ctx = this.drawCanvas.getContext('2d');
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 * state.zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (this.activeStroke.length > 1) {
      const p1 = this.activeStroke[this.activeStroke.length - 2];
      const p2 = this.activeStroke[this.activeStroke.length - 1];
      ctx.beginPath();
      ctx.moveTo(p1.x * state.zoom, p1.y * state.zoom);
      ctx.lineTo(p2.x * state.zoom, p2.y * state.zoom);
      ctx.stroke();
    }
  },

  _endStroke() {
    const state = window.PDFStudio.State;
    if (!state.isDrawingMode || !state.isDrawing) return;

    state.isDrawing = false;
    if (this.activeStroke.length > 1) {
      const pageNum = state.currentPage;
      if (!state.drawings[pageNum]) {
        state.drawings[pageNum] = [];
      }

      const fontColorPicker = document.getElementById('font-color-picker');
      const color = fontColorPicker ? fontColorPicker.value : window.PDFStudio.Constants.COLORS.DRAWING_DEFAULT;

      state.drawings[pageNum].push({
        color: color,
        points: [...this.activeStroke]
      });

      state.recordState();
    }
    this.activeStroke = [];
  },

  /**
   * Renderiza os traços salvos da página no canvas da tela
   */
  renderDrawingsForPage(pageNum) {
    if (!this.drawCanvas) return;
    const state = window.PDFStudio.State;
    const ctx = this.drawCanvas.getContext('2d');
    ctx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);

    const strokes = state.drawings[pageNum] || [];
    strokes.forEach(s => {
      if (!s.points || s.points.length < 2) return;
      ctx.strokeStyle = s.color || window.PDFStudio.Constants.COLORS.DRAWING_DEFAULT;
      ctx.lineWidth = 3 * state.zoom;
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

  /**
   * Exporta os desenhos de uma página específica como uma imagem PNG transparente
   * com largura e altura em pontos PDF, pronta para ser embutida no PDF-Lib!
   */
  exportDrawingsToDataUrl(pageNum, targetPdfWidth, targetPdfHeight) {
    const state = window.PDFStudio.State;
    const strokes = state.drawings[pageNum] || [];
    if (!strokes || strokes.length === 0) return null;

    const tempCanvas = document.createElement('canvas');
    // Para manter alta nitidez no PDF, renderiza com escala 2x
    const renderScale = 2;
    tempCanvas.width = targetPdfWidth * renderScale;
    tempCanvas.height = targetPdfHeight * renderScale;

    const ctx = tempCanvas.getContext('2d');
    ctx.scale(renderScale, renderScale);

    strokes.forEach(s => {
      if (!s.points || s.points.length < 2) return;
      ctx.strokeStyle = s.color || window.PDFStudio.Constants.COLORS.DRAWING_DEFAULT;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y);
      }
      ctx.stroke();
    });

    return tempCanvas.toDataURL('image/png');
  }
};

