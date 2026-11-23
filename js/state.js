/**
 * Gerenciador de Estado Global e Histórico (Undo / Redo)
 */
window.PDFStudio = window.PDFStudio || {};

window.PDFStudio.State = {
  pdfBytes: null,
  pdfDocument: null,
  currentPage: 1,
  totalPages: 0,
  zoom: 1.0,
  fileName: 'documento.pdf',
  pageViewport: null,

  // Modificações de Texto: pageNum (1-based) -> { [index]: itemData }
  modifications: {},
  currentItems: [],
  selectedItemIndex: null,
  showBoxes: true,
  isInsertMode: false,

  // Rotações e Páginas Excluídas
  pageRotations: {}, // pageNum -> 0 | 90 | 180 | 270
  deletedPages: new Set(), // Set<pageNum>

  // Elementos Sobrepostos: Assinaturas e Imagens (pageNum -> Array<Overlay>)
  pageOverlays: {},

  // Anotações e Desenhos livres de caneta (pageNum -> Array<Stroke>)
  drawings: {},
  isDrawing: false,
  isDrawingMode: false,

  // Corretivos / Tarjas de Cobertura (pageNum -> Array<WhiteoutBox>)
  whiteouts: {},
  isWhiteoutMode: false,

  // Pincel Borracha de Retoque (pageNum -> Array<EraserStroke>)
  eraserStrokes: {},
  isEraserMode: false,
  eraserSize: 20,

  // Filtros de Imagem da Página Escaneada (pageNum -> { brightness, contrast, binarize, grayscale })
  pageFilters: {},

  // Rastreador e Clone de Fonte Tipográfica
  isFontPickerActive: false,
  clonedStyle: {
    fontFamily: 'Helvetica',
    fontSize: 12,
    isBold: false,
    isItalic: false,
    color: '#0f172a'
  },

  // Marca d'água & Numeração de página & Padronização
  watermarkText: '',
  watermarkOpacity: 0.15,
  watermarkColor: '#94a3b8',
  addPageNumbers: false,
  standardizePages: false,

  // Junção de PDFs (Merge)
  mergeFiles: [],

  // Histórico Undo / Redo
  history: [],
  historyIndex: -1,
  maxHistorySteps: 30,

  /**
   * Retorna array ordenado com os números das páginas ativas (não deletadas)
   */
  getActivePages() {
    const list = [];
    for (let p = 1; p <= this.totalPages; p++) {
      if (!this.deletedPages.has(p)) {
        list.push(p);
      }
    }
    return list;
  },

  /**
   * Reseta todo o estado para um novo documento
   */
  async reset() {
    if (this.pdfDocument && typeof this.pdfDocument.destroy === 'function') {
      try {
        await this.pdfDocument.destroy();
      } catch (e) {
        console.warn('Erro ao destruir documento anterior:', e);
      }
    }

    this.pdfBytes = null;
    this.pdfDocument = null;
    this.currentPage = 1;
    this.totalPages = 0;
    this.zoom = 1.0;
    this.fileName = 'documento.pdf';
    this.pageViewport = null;
    this.modifications = {};
    this.currentItems = [];
    this.selectedItemIndex = null;
    this.showBoxes = true;
    this.isInsertMode = false;
    this.pageRotations = {};
    this.deletedPages.clear();
    this.pageOverlays = {};
    this.drawings = {};
    this.isDrawing = false;
    this.isDrawingMode = false;
    this.whiteouts = {};
    this.isWhiteoutMode = false;
    this.eraserStrokes = {};
    this.isEraserMode = false;
    this.pageFilters = {};
    this.isFontPickerActive = false;
    this.watermarkText = '';
    this.watermarkOpacity = 0.15;
    this.watermarkColor = '#94a3b8';
    this.addPageNumbers = false;
    this.standardizePages = false;
    this.mergeFiles = [];
    this.history = [];
    this.historyIndex = -1;
    this.updateHistoryButtons();
    this.updateStatusBadge();
  },

  /**
   * Salva um snapshot do estado no histórico para Undo / Redo
   */
  recordState() {
    const snapshot = JSON.stringify({
      modifications: this.modifications,
      overlays: this.pageOverlays,
      drawings: this.drawings,
      whiteouts: this.whiteouts,
      eraserStrokes: this.eraserStrokes,
      pageFilters: this.pageFilters,
      rotations: this.pageRotations,
      deletedPages: Array.from(this.deletedPages)
    });

    // Se já estiver no mesmo estado que o último, não duplica
    if (this.historyIndex >= 0 && this.history[this.historyIndex] === snapshot) {
      return;
    }

    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(snapshot);

    if (this.history.length > this.maxHistorySteps) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }

    this.updateHistoryButtons();
    this.updateStatusBadge();
  },

  /**
   * Desfaz a última ação
   */
  async triggerUndo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this._applyHistorySnapshot(this.history[this.historyIndex]);
      this.updateHistoryButtons();
      this.updateStatusBadge();

      if (window.PDFStudio.Renderer) {
        await window.PDFStudio.Renderer.renderCurrentPage();
      }
      window.PDFStudio.Utils.showToast('Ação desfeita.', 'info');
    }
  },

  /**
   * Refaz a última ação desfeita
   */
  async triggerRedo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this._applyHistorySnapshot(this.history[this.historyIndex]);
      this.updateHistoryButtons();
      this.updateStatusBadge();

      if (window.PDFStudio.Renderer) {
        await window.PDFStudio.Renderer.renderCurrentPage();
      }
      window.PDFStudio.Utils.showToast('Ação refeita.', 'info');
    }
  },

  _applyHistorySnapshot(snapshotStr) {
    try {
      const parsed = JSON.parse(snapshotStr);
      this.modifications = parsed.modifications || {};
      this.pageOverlays = parsed.overlays || {};
      this.drawings = parsed.drawings || {};
      this.whiteouts = parsed.whiteouts || {};
      this.eraserStrokes = parsed.eraserStrokes || {};
      this.pageFilters = parsed.pageFilters || {};
      this.pageRotations = parsed.rotations || {};
      this.deletedPages = new Set(parsed.deletedPages || []);
    } catch (e) {
      console.error('Falha ao restaurar snapshot de histórico:', e);
    }
  },

  updateHistoryButtons() {
    const canUndo = this.historyIndex > 0;
    const canRedo = this.historyIndex < this.history.length - 1;

    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    const btnMobileUndo = document.getElementById('btn-mobile-undo');
    const btnMobileRedo = document.getElementById('btn-mobile-redo');

    if (btnUndo) btnUndo.disabled = !canUndo;
    if (btnRedo) btnRedo.disabled = !canRedo;
    if (btnMobileUndo) btnMobileUndo.disabled = !canUndo;
    if (btnMobileRedo) btnMobileRedo.disabled = !canRedo;
  },

  updateStatusBadge() {
    const statusText = document.getElementById('status-text');
    const statusDot = document.getElementById('status-dot');
    if (!statusText || !statusDot) return;

    let totalChanges = 0;
    Object.keys(this.modifications).forEach(p => {
      totalChanges += Object.keys(this.modifications[p]).length;
    });

    Object.keys(this.pageOverlays).forEach(p => {
      totalChanges += (this.pageOverlays[p] || []).length;
    });

    Object.keys(this.drawings).forEach(p => {
      totalChanges += (this.drawings[p] || []).length;
    });

    Object.keys(this.whiteouts).forEach(p => {
      totalChanges += (this.whiteouts[p] || []).length;
    });

    Object.keys(this.eraserStrokes).forEach(p => {
      totalChanges += (this.eraserStrokes[p] || []).length;
    });

    Object.keys(this.pageFilters).forEach(p => {
      const f = this.pageFilters[p];
      if (f && (f.brightness !== 100 || f.contrast !== 100 || f.binarize || f.grayscale)) totalChanges++;
    });

    totalChanges += this.deletedPages.size;
    totalChanges += Object.keys(this.pageRotations).length;

    if (totalChanges > 0) {
      statusDot.className = 'w-2 h-2 rounded-full bg-emerald-500';
      statusText.textContent = `${totalChanges} alteraçõ${totalChanges > 1 ? 'es' : 'o'}`;
      statusText.className = 'font-semibold text-emerald-600 text-[11px]';
    } else {
      statusDot.className = 'w-2 h-2 rounded-full bg-slate-400';
      statusText.textContent = 'Sem alterações';
      statusText.className = 'font-semibold text-slate-500 text-[11px]';
    }
  }
};

