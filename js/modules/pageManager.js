/**
 * Módulo de Gerenciamento e Organização de Páginas (Girar, Deletar, Miniaturas)
 */
window.PDFStudio = window.PDFStudio || {};

window.PDFStudio.Pages = {
  modalPages: null,
  pagesThumbnailsGrid: null,

  init() {
    this.modalPages = document.getElementById('modal-pages');
    this.pagesThumbnailsGrid = document.getElementById('pages-thumbnails-grid');
    this._bindEvents();
  },

  _bindEvents() {
    const menuBtnPages = document.getElementById('menu-btn-pages');
    const btnMobilePages = document.getElementById('btn-mobile-pages');
    const btnClosePages = document.getElementById('btn-close-pages');
    const btnClosePagesModal = document.getElementById('btn-close-pages-modal');

    if (menuBtnPages) menuBtnPages.addEventListener('click', () => this.openPagesManager());
    if (btnMobilePages) {
      btnMobilePages.addEventListener('click', () => {
        if (window.PDFStudio.App) window.PDFStudio.App.closeMobileDrawer();
        this.openPagesManager();
      });
    }

    if (btnClosePages && this.modalPages) {
      btnClosePages.addEventListener('click', () => this.modalPages.classList.add('hidden'));
    }

    if (btnClosePagesModal && this.modalPages) {
      btnClosePagesModal.addEventListener('click', () => {
        this.modalPages.classList.add('hidden');
        if (window.PDFStudio.Renderer) {
          window.PDFStudio.Renderer.renderCurrentPage();
        }
      });
    }
  },

  async openPagesManager() {
    const state = window.PDFStudio.State;
    if (!state.pdfDocument) {
      window.PDFStudio.Utils.showToast('Abra um PDF primeiro.', 'warn');
      return;
    }

    if (!this.modalPages || !this.pagesThumbnailsGrid) return;

    this.modalPages.classList.remove('hidden');
    this.pagesThumbnailsGrid.innerHTML = '';
    window.PDFStudio.Utils.showLoading('Gerando miniaturas das páginas...');

    try {
      const activePages = state.getActivePages();

      for (const p of activePages) {
        const card = document.createElement('div');
        card.id = `thumb-card-${p}`;
        card.className = 'bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-col items-center relative shadow-sm hover:border-blue-300 transition';

        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.className = 'w-full h-auto rounded border border-slate-200 bg-white shadow-inner mb-2 cursor-pointer';

        const page = await state.pdfDocument.getPage(p);
        const rot = state.pageRotations[p] || 0;
        const vp = page.getViewport({ scale: 0.25, rotation: rot });
        thumbCanvas.width = vp.width;
        thumbCanvas.height = vp.height;

        await page.render({ canvasContext: thumbCanvas.getContext('2d'), viewport: vp }).promise;

        card.innerHTML = `
          <div class="w-full flex items-center justify-between text-xs mb-1 px-1">
            <span class="font-bold text-slate-700">Pág ${p}</span>
            <span class="text-[10px] text-slate-400 font-semibold">${rot}°</span>
          </div>
        `;
        card.appendChild(thumbCanvas);

        // Ações: Girar e Excluir
        const actions = document.createElement('div');
        actions.className = 'flex items-center gap-1 w-full mt-1';
        actions.innerHTML = `
          <button class="btn-rotate-thumb flex-1 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 text-xs transition" title="Girar 90°">
            <i class="fa-solid fa-rotate-right"></i>
          </button>
          <button class="btn-delete-page flex-1 py-1 bg-white hover:bg-rose-50 border border-slate-200 rounded text-rose-600 text-xs transition" title="Excluir página">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        `;

        // Girar Página
        actions.querySelector('.btn-rotate-thumb').addEventListener('click', async () => {
          state.pageRotations[p] = ((state.pageRotations[p] || 0) + 90) % 360;
          state.recordState();
          this.openPagesManager();
        });

        // Excluir Página
        actions.querySelector('.btn-delete-page').addEventListener('click', () => {
          if (state.getActivePages().length <= 1) {
            window.PDFStudio.Utils.showToast('O documento não pode ficar sem nenhuma página.', 'warn');
            return;
          }

          state.deletedPages.add(p);
          card.remove();
          state.recordState();

          // Se a página excluída for a atual, ajusta para uma página válida
          if (state.currentPage === p) {
            const remaining = state.getActivePages();
            state.currentPage = remaining[0] || 1;
          }

          window.PDFStudio.Utils.showToast(`Página ${p} excluída.`);
        });

        // Clique na miniatura para ir até a página
        thumbCanvas.addEventListener('click', () => {
          state.currentPage = p;
          this.modalPages.classList.add('hidden');
          if (window.PDFStudio.Renderer) {
            window.PDFStudio.Renderer.renderCurrentPage();
          }
        });

        card.appendChild(actions);
        this.pagesThumbnailsGrid.appendChild(card);
      }
    } catch (err) {
      console.error('Erro ao gerar miniaturas:', err);
    } finally {
      window.PDFStudio.Utils.hideLoading();
    }
  }
};

