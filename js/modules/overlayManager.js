/**
 * Módulo de Elementos Sobrepostos: Assinaturas Digitais e Imagens/Logos
 */
window.PDFStudio = window.PDFStudio || {};

window.PDFStudio.Overlay = {
  signPadCanvas: null,
  signCtx: null,
  isSigning: false,

  init() {
    this.signPadCanvas = document.getElementById('sign-pad-canvas');
    if (this.signPadCanvas) {
      this.signCtx = this.signPadCanvas.getContext('2d');
      this._bindSignPadEvents();
    }
    this._bindDomEvents();
  },

  _bindDomEvents() {
    const modalSign = document.getElementById('modal-sign');
    const btnCloseSign = document.getElementById('btn-close-sign');
    const btnCancelSign = document.getElementById('btn-cancel-sign');
    const btnClearSign = document.getElementById('btn-clear-sign');
    const btnApplySign = document.getElementById('btn-apply-sign');
    const menuBtnSign = document.getElementById('menu-btn-sign');
    const btnMobileSign = document.getElementById('btn-mobile-sign');

    const menuBtnImage = document.getElementById('menu-btn-image');
    const imageOverlayInput = document.getElementById('image-overlay-input');

    if (menuBtnSign) menuBtnSign.addEventListener('click', () => this.openSignModal());
    if (btnMobileSign) {
      btnMobileSign.addEventListener('click', () => {
        if (window.PDFStudio.App) window.PDFStudio.App.closeMobileDrawer();
        this.openSignModal();
      });
    }

    if (btnCloseSign && modalSign) btnCloseSign.addEventListener('click', () => modalSign.classList.add('hidden'));
    if (btnCancelSign && modalSign) btnCancelSign.addEventListener('click', () => modalSign.classList.add('hidden'));
    if (btnClearSign) btnClearSign.addEventListener('click', () => this.clearSignPad());
    if (btnApplySign) btnApplySign.addEventListener('click', () => this.applySignature());

    // Inserção de Imagens / Logos
    if (menuBtnImage && imageOverlayInput) {
      menuBtnImage.addEventListener('click', () => imageOverlayInput.click());
      imageOverlayInput.addEventListener('change', (e) => this.handleImageUpload(e));
    }
  },

  _bindSignPadEvents() {
    const canvas = this.signPadCanvas;
    const signColorInput = document.getElementById('sign-color');

    // Mouse
    canvas.addEventListener('mousedown', (e) => {
      this.isSigning = true;
      this.signCtx.strokeStyle = signColorInput ? signColorInput.value : window.PDFStudio.Constants.COLORS.SIGNATURE_DEFAULT;
      this.signCtx.lineWidth = 2.5;
      this.signCtx.lineCap = 'round';
      this.signCtx.lineJoin = 'round';
      this.signCtx.beginPath();
      this.signCtx.moveTo(e.offsetX, e.offsetY);
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!this.isSigning) return;
      this.signCtx.lineTo(e.offsetX, e.offsetY);
      this.signCtx.stroke();
    });

    window.addEventListener('mouseup', () => { this.isSigning = false; });

    // Touch Mobile
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.isSigning = true;
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      this.signCtx.strokeStyle = signColorInput ? signColorInput.value : window.PDFStudio.Constants.COLORS.SIGNATURE_DEFAULT;
      this.signCtx.lineWidth = 2.5;
      this.signCtx.lineCap = 'round';
      this.signCtx.lineJoin = 'round';
      this.signCtx.beginPath();
      this.signCtx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!this.isSigning) return;
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      this.signCtx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
      this.signCtx.stroke();
    }, { passive: false });

    canvas.addEventListener('touchend', () => { this.isSigning = false; });
  },

  openSignModal() {
    const modalSign = document.getElementById('modal-sign');
    if (!modalSign || !this.signPadCanvas) return;
    modalSign.classList.remove('hidden');

    setTimeout(() => {
      const container = this.signPadCanvas.parentElement;
      this.signPadCanvas.width = container.clientWidth;
      this.signPadCanvas.height = container.clientHeight;
      this.clearSignPad();
    }, 60);
  },

  clearSignPad() {
    if (!this.signPadCanvas || !this.signCtx) return;
    this.signCtx.clearRect(0, 0, this.signPadCanvas.width, this.signPadCanvas.height);
  },

  applySignature() {
    const state = window.PDFStudio.State;
    if (!this.signPadCanvas) return;

    const dataUrl = this.signPadCanvas.toDataURL('image/png');
    const pageNum = state.currentPage;
    if (!state.pageOverlays[pageNum]) {
      state.pageOverlays[pageNum] = [];
    }

    state.pageOverlays[pageNum].push({
      dataUrl: dataUrl,
      x: 80,
      y: 80,
      width: 150,
      height: 75
    });

    const modalSign = document.getElementById('modal-sign');
    if (modalSign) modalSign.classList.add('hidden');

    this.renderPageOverlays(pageNum);
    state.recordState();
    window.PDFStudio.Utils.showToast('Assinatura inserida! Arraste ou redimensione na página.');
  },

  handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const state = window.PDFStudio.State;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Calcula aspecto proporcional para a imagem inserida
        let w = 140;
        let h = Math.round((img.height / img.width) * w);
        if (h > 200) {
          h = 200;
          w = Math.round((img.width / img.height) * h);
        }

        const pageNum = state.currentPage;
        if (!state.pageOverlays[pageNum]) state.pageOverlays[pageNum] = [];

        state.pageOverlays[pageNum].push({
          dataUrl: event.target.result,
          x: 60,
          y: 60,
          width: w,
          height: h
        });

        this.renderPageOverlays(pageNum);
        state.recordState();
        window.PDFStudio.Utils.showToast('Imagem adicionada com sucesso!');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  },

  renderPageOverlays(pageNum) {
    const editOverlay = document.getElementById('edit-overlay');
    if (!editOverlay) return;

    // Remove overlays anteriores do DOM mantendo os blocos de texto
    editOverlay.querySelectorAll('.overlay-element').forEach(el => el.remove());

    const state = window.PDFStudio.State;
    const overlays = state.pageOverlays[pageNum] || [];

    overlays.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = 'overlay-element rounded-lg overflow-visible';
      el.style.left = `${item.x * state.zoom}px`;
      el.style.top = `${item.y * state.zoom}px`;
      el.style.width = `${item.width * state.zoom}px`;
      el.style.height = `${item.height * state.zoom}px`;

      const img = document.createElement('img');
      img.src = item.dataUrl;
      img.className = 'w-full h-full object-contain pointer-events-none';
      el.appendChild(img);

      // Botão de Deletar
      const delBtn = document.createElement('div');
      delBtn.className = 'overlay-delete-btn';
      delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      delBtn.title = 'Remover elemento';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.pageOverlays[pageNum].splice(index, 1);
        this.renderPageOverlays(pageNum);
        state.recordState();
        window.PDFStudio.Utils.showToast('Elemento removido.');
      });
      el.appendChild(delBtn);

      // Alça de Redimensionamento (Resize Handle)
      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'overlay-resize-handle';
      resizeHandle.title = 'Arrastar para redimensionar';
      el.appendChild(resizeHandle);

      this._makeInteractive(el, resizeHandle, item);
      editOverlay.appendChild(el);
    });
  },

  _makeInteractive(el, resizeHandle, item) {
    const state = window.PDFStudio.State;
    let isDragging = false;
    let isResizing = false;
    let startX, startY, initX, initY, initW, initH;

    // --- ARRASTAR ---
    function onDragStart(e) {
      if (state.isDrawingMode || state.isInsertMode) return;
      isDragging = true;
      document.querySelectorAll('.overlay-element').forEach(o => o.classList.remove('selected'));
      el.classList.add('selected');

      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      startX = cx;
      startY = cy;
      initX = item.x * state.zoom;
      initY = item.y * state.zoom;
      e.stopPropagation();
    }

    function onDragMove(e) {
      if (!isDragging) return;
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = cx - startX;
      const dy = cy - startY;

      const newLeft = Math.max(0, initX + dx);
      const newTop = Math.max(0, initY + dy);
      el.style.left = `${newLeft}px`;
      el.style.top = `${newTop}px`;
      item.x = newLeft / state.zoom;
      item.y = newTop / state.zoom;
    }

    function onDragEnd() {
      if (isDragging) {
        isDragging = false;
        state.recordState();
      }
    }

    // --- REDIMENSIONAR ---
    function onResizeStart(e) {
      isResizing = true;
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      startX = cx;
      startY = cy;
      initW = item.width * state.zoom;
      initH = item.height * state.zoom;
      e.stopPropagation();
      e.preventDefault();
    }

    function onResizeMove(e) {
      if (!isResizing) return;
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      const dw = cx - startX;
      const dh = cy - startY;

      const newWidth = Math.max(30, initW + dw);
      const newHeight = Math.max(20, initH + dh);

      el.style.width = `${newWidth}px`;
      el.style.height = `${newHeight}px`;

      item.width = newWidth / state.zoom;
      item.height = newHeight / state.zoom;
    }

    function onResizeEnd() {
      if (isResizing) {
        isResizing = false;
        state.recordState();
      }
    }

    // Attach drag events
    el.addEventListener('mousedown', onDragStart);
    el.addEventListener('touchstart', onDragStart, { passive: true });

    // Attach resize events
    resizeHandle.addEventListener('mousedown', onResizeStart);
    resizeHandle.addEventListener('touchstart', onResizeStart, { passive: false });

    // Window events
    window.addEventListener('mousemove', (e) => {
      if (isDragging) onDragMove(e);
      if (isResizing) onResizeMove(e);
    });

    window.addEventListener('touchmove', (e) => {
      if (isDragging) onDragMove(e);
      if (isResizing) onResizeMove(e);
    }, { passive: true });

    window.addEventListener('mouseup', () => {
      onDragEnd();
      onResizeEnd();
    });

    window.addEventListener('touchend', () => {
      onDragEnd();
      onResizeEnd();
    });
  }
};

