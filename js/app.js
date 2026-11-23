/**
 * Ponto de Entrada (Entrypoint) da Aplicação PDF Studio Pro
 */
window.PDFStudio = window.PDFStudio || {};

window.PDFStudio.App = {
  sidebarContainer: null,
  mobileBackdrop: null,
  toolsDropdown: null,

  init() {
    this.sidebarContainer = document.getElementById('sidebar-container');
    this.mobileBackdrop = document.getElementById('mobile-sidebar-backdrop');
    this.toolsDropdown = document.getElementById('tools-dropdown');

    // Inicializa todos os módulos
    if (window.PDFStudio.Drawing) window.PDFStudio.Drawing.init();
    if (window.PDFStudio.Overlay) window.PDFStudio.Overlay.init();
    if (window.PDFStudio.TextEditor) window.PDFStudio.TextEditor.init();
    if (window.PDFStudio.Pages) window.PDFStudio.Pages.init();
    if (window.PDFStudio.Tools) window.PDFStudio.Tools.init();
    if (window.PDFStudio.Renderer) window.PDFStudio.Renderer.init();
    if (window.PDFStudio.Exporter) window.PDFStudio.Exporter.init();
    if (window.PDFStudio.FontDetector) window.PDFStudio.FontDetector.init();
    if (window.PDFStudio.ImageEditor) window.PDFStudio.ImageEditor.init();

    this._bindNavigationAndFileEvents();
    this._bindKeyboardShortcuts();
    this._bindDragAndDrop();
    this._bindResponsiveEvents();
  },

  _bindNavigationAndFileEvents() {
    const fileInput = document.getElementById('pdf-file-input');
    const btnOpen = document.getElementById('btn-open');
    const btnStartUpload = document.getElementById('btn-start-upload');
    const btnToggleDraw = document.getElementById('btn-toggle-draw');

    if (btnOpen && fileInput) btnOpen.addEventListener('click', () => fileInput.click());
    if (btnStartUpload && fileInput) btnStartUpload.addEventListener('click', () => fileInput.click());

    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          await this.loadPdfFile(file);
          fileInput.value = '';
        }
      });
    }

    if (btnToggleDraw) {
      btnToggleDraw.addEventListener('click', () => {
        if (window.PDFStudio.Drawing) {
          window.PDFStudio.Drawing.toggleDrawingMode();
        }
      });
    }

    // Dropdown de Ferramentas
    const btnToolsMenu = document.getElementById('btn-tools-menu');
    const btnMobileTools = document.getElementById('btn-mobile-tools');

    if (btnToolsMenu && this.toolsDropdown) {
      btnToolsMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toolsDropdown.classList.toggle('hidden');
      });
    }

    if (btnMobileTools && this.toolsDropdown) {
      btnMobileTools.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toolsDropdown.classList.toggle('hidden');
      });
    }

    if (this.toolsDropdown) {
      this.toolsDropdown.addEventListener('click', (e) => {
        if (e.target.closest('button')) {
          this.toolsDropdown.classList.add('hidden');
        }
      });
    }

    document.addEventListener('click', (e) => {
      if (this.toolsDropdown && !e.target.closest('#btn-tools-menu') && !e.target.closest('#btn-mobile-tools') && !e.target.closest('#tools-dropdown')) {
        this.toolsDropdown.classList.add('hidden');
      }
    });

    // Mobile Drawer
    const btnToggleMobileSidebar = document.getElementById('btn-toggle-mobile-sidebar');
    const btnCloseMobileSidebar = document.getElementById('btn-close-mobile-sidebar');
    const btnMobileOpenDrawer = document.getElementById('btn-mobile-open-drawer');

    if (btnToggleMobileSidebar) btnToggleMobileSidebar.addEventListener('click', () => this.openMobileDrawer());
    if (btnMobileOpenDrawer) btnMobileOpenDrawer.addEventListener('click', () => this.openMobileDrawer());
    if (btnCloseMobileSidebar) btnCloseMobileSidebar.addEventListener('click', () => this.closeMobileDrawer());
    if (this.mobileBackdrop) this.mobileBackdrop.addEventListener('click', () => this.closeMobileDrawer());
  },

  openMobileDrawer() {
    if (this.sidebarContainer && this.mobileBackdrop) {
      this.sidebarContainer.classList.remove('translate-x-full');
      this.mobileBackdrop.classList.remove('hidden');
    }
  },

  closeMobileDrawer() {
    if (this.sidebarContainer && this.mobileBackdrop) {
      this.sidebarContainer.classList.add('translate-x-full');
      this.mobileBackdrop.classList.add('hidden');
    }
  },

  async loadPdfFile(file) {
    if (!file || (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))) {
      window.PDFStudio.Utils.showToast('Escolha um arquivo PDF válido.', 'warn');
      return;
    }

    const state = window.PDFStudio.State;
    await state.reset();

    state.fileName = file.name;
    const fileNameLabel = document.getElementById('file-name-label');
    if (fileNameLabel) fileNameLabel.textContent = file.name;

    window.PDFStudio.Utils.showLoading('Mapeando textos e estrutura do PDF...');

    try {
      const arrayBuffer = await file.arrayBuffer();
      state.pdfBytes = arrayBuffer;

      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) });
      state.pdfDocument = await loadingTask.promise;
      state.totalPages = state.pdfDocument.numPages;
      state.currentPage = 1;

      const emptyState = document.getElementById('empty-state');
      const pageContainer = document.getElementById('pdf-page-container');
      const btnDownload = document.getElementById('btn-download');

      if (emptyState) emptyState.classList.add('hidden');
      if (pageContainer) pageContainer.classList.remove('hidden');
      if (btnDownload) btnDownload.disabled = false;

      if (window.PDFStudio.Renderer) {
        window.PDFStudio.Renderer.autoFitZoom();
        await window.PDFStudio.Renderer.renderCurrentPage();
      }

      state.recordState();
      window.PDFStudio.Utils.showToast('PDF aberto com sucesso!');
    } catch (err) {
      console.error(err);
      window.PDFStudio.Utils.showToast('Erro ao carregar o PDF: ' + err.message, 'error');
    } finally {
      window.PDFStudio.Utils.hideLoading();
    }
  },

  _bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      const isInputActive = document.activeElement && (
        document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.isContentEditable
      );

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (!isInputActive) {
          e.preventDefault();
          if (e.shiftKey) {
            window.PDFStudio.State.triggerRedo();
          } else {
            window.PDFStudio.State.triggerUndo();
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (!isInputActive) {
          e.preventDefault();
          window.PDFStudio.State.triggerRedo();
        }
      }

      // Atalhos de Zoom com Teclado (+ e -)
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        const zoomInBtn = document.getElementById('zoom-in');
        if (zoomInBtn) zoomInBtn.click();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        const zoomOutBtn = document.getElementById('zoom-out');
        if (zoomOutBtn) zoomOutBtn.click();
      }
    });

    // Botões de Undo/Redo na barra superior e mobile
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    const btnMobileUndo = document.getElementById('btn-mobile-undo');
    const btnMobileRedo = document.getElementById('btn-mobile-redo');

    if (btnUndo) btnUndo.addEventListener('click', () => window.PDFStudio.State.triggerUndo());
    if (btnRedo) btnRedo.addEventListener('click', () => window.PDFStudio.State.triggerRedo());
    if (btnMobileUndo) btnMobileUndo.addEventListener('click', () => window.PDFStudio.State.triggerUndo());
    if (btnMobileRedo) btnMobileRedo.addEventListener('click', () => window.PDFStudio.State.triggerRedo());
  },

  _bindDragAndDrop() {
    const scrollWrapper = document.getElementById('canvas-scroll-wrapper');
    if (!scrollWrapper) return;

    ['dragenter', 'dragover'].forEach(eventName => {
      scrollWrapper.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        scrollWrapper.classList.add('bg-blue-50/70');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      scrollWrapper.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        scrollWrapper.classList.remove('bg-blue-50/70');
      });
    });

    scrollWrapper.addEventListener('drop', async (e) => {
      const dt = e.dataTransfer;
      const files = dt ? dt.files : null;
      if (files && files.length > 0) {
        await this.loadPdfFile(files[0]);
      }
    });
  },

  _bindResponsiveEvents() {
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (window.PDFStudio.State.pdfDocument && window.PDFStudio.Renderer) {
          window.PDFStudio.Renderer.autoFitZoom();
          window.PDFStudio.Renderer.renderCurrentPage();
        }
      }, 250);
    });
  }
};

// Inicialização automática quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  window.PDFStudio.App.init();
});

