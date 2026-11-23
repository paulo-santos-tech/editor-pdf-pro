/**
 * Utilitários e Helpers gerais
 */
window.PDFStudio = window.PDFStudio || {};

window.PDFStudio.Utils = {
  /**
   * Converte cor hexadecimal (#rrggbb) para RGB normalizado [0, 1] ou [0, 255]
   */
  hexToRgb(hex) {
    if (!hex || !hex.startsWith('#')) return { r: 0, g: 0, b: 0, normR: 0, normG: 0, normB: 0 };
    let cleanHex = hex.slice(1);
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    const bigint = parseInt(cleanHex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return {
      r,
      g,
      b,
      normR: r / 255,
      normG: g / 255,
      normB: b / 255
    };
  },

  /**
   * Higieniza texto para compatibilidade com WinAnsiEncoding (Standard Fonts do PDFLib).
   * Evita a exceção fatal: "WinAnsi cannot encode <char>".
   */
  sanitizeWinAnsi(text) {
    if (!text) return '';
    return text
      // Aspas curvas e apóstrofos
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      // Travessões e hífens especiais
      .replace(/[\u2013\u2014\u2015]/g, '-')
      // Reticências
      .replace(/\u2026/g, '...')
      // Espaços especiais (non-breaking, zero-width, etc)
      .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
      // Bullets e marcadores
      .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '*')
      // Setas comuns
      .replace(/[\u2192\u2794]/g, '->')
      .replace(/[\u2190]/g, '<-')
      // Frações e símbolos comuns
      .replace(/\u00BD/g, '1/2')
      .replace(/\u00BC/g, '1/4')
      .replace(/\u00BE/g, '3/4')
      .replace(/[\u2264]/g, '<=')
      .replace(/[\u2265]/g, '>=')
      .replace(/[\u2260]/g, '!=');
  },

  /**
   * Identifica a família tipográfica compatível baseando-se no nome da fonte do PDF.js
   */
  identifyFontFamily(pdfFontName) {
    if (!pdfFontName) return window.PDFStudio.Constants.STANDARD_FONTS.HELVETICA;
    const name = pdfFontName.toLowerCase();
    if (name.includes('times') || name.includes('serif') || name.includes('garamond') || name.includes('minion') || name.includes('georgia')) {
      return window.PDFStudio.Constants.STANDARD_FONTS.TIMES_ROMAN;
    } else if (name.includes('courier') || name.includes('mono') || name.includes('consolas') || name.includes('typewriter')) {
      return window.PDFStudio.Constants.STANDARD_FONTS.COURIER;
    }
    return window.PDFStudio.Constants.STANDARD_FONTS.HELVETICA;
  },

  /**
   * Verifica se o nome da fonte indica estilo Negrito (Bold)
   */
  isFontBold(pdfFontName) {
    if (!pdfFontName) return false;
    const name = pdfFontName.toLowerCase();
    return name.includes('bold') || name.includes('black') || name.includes('heavy') || name.includes('700') || name.includes('800') || name.includes('900');
  },

  /**
   * Verifica se o nome da fonte indica estilo Itálico (Italic/Oblique)
   */
  isFontItalic(pdfFontName) {
    if (!pdfFontName) return false;
    const name = pdfFontName.toLowerCase();
    return name.includes('italic') || name.includes('oblique') || name.includes('slanted');
  },

  /**
   * Exibe notificação flutuante (Toast)
   */
  showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-msg');
    const toastIcon = document.getElementById('toast-icon');
    if (!toast || !toastMsg || !toastIcon) return;

    toastMsg.textContent = message;
    if (type === 'success') {
      toastIcon.className = 'fa-solid fa-circle-check text-emerald-400 text-sm';
    } else if (type === 'info') {
      toastIcon.className = 'fa-solid fa-circle-info text-blue-400 text-sm';
    } else if (type === 'error') {
      toastIcon.className = 'fa-solid fa-circle-exclamation text-rose-400 text-sm';
    } else {
      toastIcon.className = 'fa-solid fa-triangle-exclamation text-amber-400 text-sm';
    }

    toast.classList.remove('opacity-0', 'pointer-events-none');
    toast.classList.add('opacity-100');

    if (this._toastTimeout) clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.classList.remove('opacity-100');
      toast.classList.add('opacity-0', 'pointer-events-none');
    }, window.PDFStudio.Constants.TOAST_DURATION);
  },

  /**
   * Exibe overlay de carregamento
   */
  showLoading(msg = 'Carregando...') {
    const loadingSpinner = document.getElementById('loading-spinner');
    const loadingMsg = document.getElementById('loading-msg');
    if (loadingSpinner && loadingMsg) {
      loadingMsg.textContent = msg;
      loadingSpinner.classList.remove('hidden');
    }
  },

  /**
   * Oculta overlay de carregamento
   */
  hideLoading() {
    const loadingSpinner = document.getElementById('loading-spinner');
    if (loadingSpinner) {
      loadingSpinner.classList.add('hidden');
    }
  },

  /**
   * Dispara o download de um Blob no navegador
   */
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  /**
   * Converte strings como "1-3, 5, 8-10" em lista ordenada e sem duplicatas de páginas
   */
  parsePageRange(rangeStr, maxPages) {
    const pages = new Set();
    if (!rangeStr) return [];
    const parts = rangeStr.split(',');

    for (const part of parts) {
      const clean = part.trim();
      if (!clean) continue;

      if (clean.includes('-')) {
        const [startStr, endStr] = clean.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const min = Math.max(1, Math.min(start, end));
          const max = Math.min(maxPages, Math.max(start, end));
          for (let i = min; i <= max; i++) {
            pages.add(i);
          }
        }
      } else {
        const num = parseInt(clean, 10);
        if (!isNaN(num) && num >= 1 && num <= maxPages) {
          pages.add(num);
        }
      }
    }
    return Array.from(pages).sort((a, b) => a - b);
  },

  /**
   * Adiciona uma página ao documento de destino padronizando suas dimensões.
   * Redimensiona proporcionalmente mantendo o aspecto sem cortes nem distorções,
   * centralizando o conteúdo perfeitamente na folha padronizada (ex: A4).
   *
   * @param {PDFLib.PDFDocument} targetDoc - Documento que receberá a nova página
   * @param {PDFLib.PDFDocument} sourceDoc - Documento de origem
   * @param {number} pageIndex - Índice da página de origem (0-based)
   * @param {Object} [options={}] - Configurações de padronização
   */
  async addStandardizedPage(targetDoc, sourceDoc, pageIndex, options = {}) {
    const {
      standardize = true,
      format = 'A4',
      orientation = 'auto',
      margin = 0
    } = options;

    if (!standardize || format === 'ORIGINAL') {
      const [copiedPage] = await targetDoc.copyPages(sourceDoc, [pageIndex]);
      targetDoc.addPage(copiedPage);
      return;
    }

    const { degrees } = PDFLib;
    const sourcePage = sourceDoc.getPage(pageIndex);
    const rot = (sourcePage.getRotation()?.angle || 0) % 360;

    // Dimensões do formato base
    const baseFormat = window.PDFStudio.Constants.PAGE_SIZES[format] || window.PDFStudio.Constants.PAGE_SIZES.A4;
    const baseW = baseFormat.width;
    const baseH = baseFormat.height;

    // Incorpora a página como objeto vetorial
    const [embeddedPage] = await targetDoc.embedPdf(sourceDoc, [pageIndex]);
    const origW = embeddedPage.width;
    const origH = embeddedPage.height;

    // Dimensões visuais considerando rotação nativa do documento
    const isRotatedQuarter = (rot === 90 || rot === 270);
    const visualW = isRotatedQuarter ? origH : origW;
    const visualH = isRotatedQuarter ? origW : origH;
    const isLandscape = visualW > visualH;

    // Define dimensões padronizadas da folha alvo
    let targetPageW = baseW;
    let targetPageH = baseH;

    if (orientation === 'landscape' || (orientation === 'auto' && isLandscape)) {
      targetPageW = Math.max(baseW, baseH);
      targetPageH = Math.min(baseW, baseH);
    } else {
      targetPageW = Math.min(baseW, baseH);
      targetPageH = Math.max(baseW, baseH);
    }

    // Cria folha padronizada
    const newPage = targetDoc.addPage([targetPageW, targetPageH]);

    // Área útil disponível na nova folha
    const availW = Math.max(10, targetPageW - (margin * 2));
    const availH = Math.max(10, targetPageH - (margin * 2));

    // Escala proporcional exata sem distorção nem corte
    const scale = Math.min(availW / visualW, availH / visualH);
    const scaledW = visualW * scale;
    const scaledH = visualH * scale;

    // Centralização perfeita
    const offsetX = (targetPageW - scaledW) / 2;
    const offsetY = (targetPageH - scaledH) / 2;

    if (rot === 0) {
      newPage.drawPage(embeddedPage, {
        x: offsetX,
        y: offsetY,
        width: origW * scale,
        height: origH * scale
      });
    } else if (rot === 90) {
      newPage.drawPage(embeddedPage, {
        x: offsetX,
        y: offsetY + scaledH,
        width: origW * scale,
        height: origH * scale,
        rotate: degrees(-90)
      });
    } else if (rot === 180) {
      newPage.drawPage(embeddedPage, {
        x: offsetX + scaledW,
        y: offsetY + scaledH,
        width: origW * scale,
        height: origH * scale,
        rotate: degrees(-180)
      });
    } else if (rot === 270) {
      newPage.drawPage(embeddedPage, {
        x: offsetX + scaledW,
        y: offsetY,
        width: origW * scale,
        height: origH * scale,
        rotate: degrees(-270)
      });
    }
  }
};

