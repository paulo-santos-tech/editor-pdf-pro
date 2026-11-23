/**
 * Constantes globais do PDF Studio Pro
 */
window.PDFStudio = window.PDFStudio || {};

window.PDFStudio.Constants = {
  // Limites de Zoom
  ZOOM_MIN: 0.3,
  ZOOM_MAX: 3.0,
  ZOOM_STEP: 0.15,
  ZOOM_DEFAULT: 1.0,

  // Limites de Tamanho de Fonte
  FONT_SIZE_MIN: 6,
  FONT_SIZE_MAX: 120,
  FONT_SIZE_DEFAULT: 12,

  // Fontes suportadas pelo PDF-Lib Standard
  STANDARD_FONTS: {
    HELVETICA: 'Helvetica',
    TIMES_ROMAN: 'TimesRoman',
    COURIER: 'Courier'
  },

  // Cores Padrão
  COLORS: {
    TEXT_DEFAULT: '#0f172a',
    DRAWING_DEFAULT: '#2563eb',
    SIGNATURE_DEFAULT: '#002b80',
    WATERMARK_DEFAULT: '#94a3b8'
  },

  // Dimensões Padrão de Folhas (em pontos: 72 pt = 1 pol, 1 mm ≈ 2.83465 pt)
  PAGE_SIZES: {
    A4: {
      name: 'A4 (210 × 297 mm)',
      width: 595.28,
      height: 841.89
    },
    LETTER: {
      name: 'Carta / Letter (216 × 279 mm)',
      width: 612.0,
      height: 792.0
    },
    LEGAL: {
      name: 'Ofício / Legal (216 × 356 mm)',
      width: 612.0,
      height: 1008.0
    }
  },

  // Dimensões Padrão de Novos Elementos (em pontos)
  DEFAULT_OVERLAY_WIDTH: 150,
  DEFAULT_OVERLAY_HEIGHT: 75,
  DEFAULT_NEW_TEXT_WIDTH: 120,
  DEFAULT_NEW_TEXT_HEIGHT: 18,

  // Timeout para Toasts (ms)
  TOAST_DURATION: 3200
};

