/**
 * Módulo de Exportação Final do PDF via PDF-Lib
 * Resolve bugs de exclusão de páginas, anotações de caneta, caracteres WinAnsi e máscaras de texto.
 */
window.PDFStudio = window.PDFStudio || {};

window.PDFStudio.Exporter = {
  init() {
    const btnDownload = document.getElementById('btn-download');
    if (btnDownload) {
      btnDownload.addEventListener('click', () => this.exportPdf());
    }
  },

  async exportPdf() {
    const state = window.PDFStudio.State;
    if (!state.pdfBytes) return;

    window.PDFStudio.Utils.showLoading('Reconstruindo tipografia, carimbos e exportando PDF...');

    try {
      const { PDFDocument, rgb, StandardFonts, degrees } = PDFLib;

      // Carrega o documento original
      const sourceDoc = await PDFDocument.load(state.pdfBytes);
      const outputDoc = await PDFDocument.create();

      // Mapeamento de Fontes Standard
      const fontMap = {
        Helvetica: {
          normal: await outputDoc.embedFont(StandardFonts.Helvetica),
          bold: await outputDoc.embedFont(StandardFonts.HelveticaBold),
          italic: await outputDoc.embedFont(StandardFonts.HelveticaOblique),
          boldItalic: await outputDoc.embedFont(StandardFonts.HelveticaBoldOblique)
        },
        TimesRoman: {
          normal: await outputDoc.embedFont(StandardFonts.TimesRoman),
          bold: await outputDoc.embedFont(StandardFonts.TimesRomanBold),
          italic: await outputDoc.embedFont(StandardFonts.TimesRomanItalic),
          boldItalic: await outputDoc.embedFont(StandardFonts.TimesRomanBoldItalic)
        },
        Courier: {
          normal: await outputDoc.embedFont(StandardFonts.Courier),
          bold: await outputDoc.embedFont(StandardFonts.CourierBold),
          italic: await outputDoc.embedFont(StandardFonts.CourierOblique),
          boldItalic: await outputDoc.embedFont(StandardFonts.CourierBoldOblique)
        }
      };

      // Copia apenas as páginas ativas (não deletadas), preservando mapeamento da página original
      const activeOriginalPages = state.getActivePages();
      if (activeOriginalPages.length === 0) {
        throw new Error('Nenhuma página para exportar. Todas foram excluídas.');
      }

      const zeroBasedIndices = activeOriginalPages.map(p => p - 1);
      const copiedPages = await outputDoc.copyPages(sourceDoc, zeroBasedIndices);

      for (let i = 0; i < copiedPages.length; i++) {
        const targetPage = copiedPages[i];
        const originalPageNum = activeOriginalPages[i]; // Página original exata!
        outputDoc.addPage(targetPage);

        // 1. Aplica rotação se configurada
        const currentRot = targetPage.getRotation().angle || 0;
        const extraRot = state.pageRotations[originalPageNum] || 0;
        if (extraRot) {
          targetPage.setRotation(degrees((currentRot + extraRot) % 360));
        }

        const { width, height } = targetPage.getSize();

        // 1.5. Corretivos e Tarjas de Cobertura (Whiteouts)
        const whiteouts = state.whiteouts[originalPageNum] || [];
        for (const wo of whiteouts) {
          const boxColor = window.PDFStudio.Utils.hexToRgb(wo.color || '#ffffff');
          try {
            targetPage.drawRectangle({
              x: Math.max(0, wo.x),
              y: Math.max(0, wo.y),
              width: wo.width,
              height: wo.height,
              color: rgb(boxColor.normR, boxColor.normG, boxColor.normB)
            });
          } catch (woErr) {
            console.warn('Erro ao desenhar tarja de corretivo:', woErr);
          }
        }

        // 1.8. Pincel Borracha de Retoque (Eraser Strokes)
        const eraserStrokes = state.eraserStrokes[originalPageNum] || [];
        if (eraserStrokes.length > 0) {
          try {
            const eraserCanvas = document.createElement('canvas');
            const rScale = 2;
            eraserCanvas.width = width * rScale;
            eraserCanvas.height = height * rScale;
            const eCtx = eraserCanvas.getContext('2d');
            eCtx.scale(rScale, rScale);

            eraserStrokes.forEach(s => {
              if (!s.points || s.points.length < 2) return;
              eCtx.strokeStyle = s.color || '#ffffff';
              eCtx.lineWidth = s.size || 20;
              eCtx.lineCap = 'round';
              eCtx.lineJoin = 'round';
              eCtx.beginPath();
              eCtx.moveTo(s.points[0].x, s.points[0].y);
              for (let p = 1; p < s.points.length; p++) {
                eCtx.lineTo(s.points[p].x, s.points[p].y);
              }
              eCtx.stroke();
            });

            const eraserDataUrl = eraserCanvas.toDataURL('image/png');
            const embeddedEraser = await outputDoc.embedPng(eraserDataUrl);
            targetPage.drawImage(embeddedEraser, {
              x: 0,
              y: 0,
              width: width,
              height: height
            });
          } catch (eraserErr) {
            console.warn('Erro ao embutir borracha de retoque:', eraserErr);
          }
        }

        // 2. Textos Editados da Página Original
        const pageMods = state.modifications[originalPageNum] || {};
        for (const [_, mod] of Object.entries(pageMods)) {
          if (!mod.isNew && mod.original === mod.text && !mod.isDeleted) continue;

          const fontSize = mod.pdfFontSize > 4 ? mod.pdfFontSize : 11;
          const approxHeight = Math.max(mod.pdfHeight || 12, fontSize);
          const boxPadding = 1.5;
          const originalWidth = Math.max(mod.pdfWidth || (mod.original ? mod.original.length * 6 : 20), 20);

          // Máscara branca cobrindo o texto original (com ajuste de baseline descendente)
          if (!mod.isNew) {
            const maskY = mod.y - (approxHeight * 0.25);
            const maskHeight = approxHeight * 1.25 + (boxPadding * 2);
            targetPage.drawRectangle({
              x: Math.max(0, mod.x - boxPadding),
              y: Math.max(0, maskY),
              width: originalWidth + (boxPadding * 2),
              height: maskHeight,
              color: rgb(1, 1, 1)
            });
          }

          // Se não foi deletado, desenha o novo texto higienizado
          if (!mod.isDeleted && mod.text && mod.text.trim().length > 0) {
            const familyKey = mod.fontFamily || window.PDFStudio.Constants.STANDARD_FONTS.HELVETICA;
            const fontGroup = fontMap[familyKey] || fontMap.Helvetica;

            let chosenFont = fontGroup.normal;
            if (mod.isBold && mod.isItalic) chosenFont = fontGroup.boldItalic;
            else if (mod.isBold) chosenFont = fontGroup.bold;
            else if (mod.isItalic) chosenFont = fontGroup.italic;

            const textColor = window.PDFStudio.Utils.hexToRgb(mod.color);
            const safeText = window.PDFStudio.Utils.sanitizeWinAnsi(mod.text);

            try {
              targetPage.drawText(safeText, {
                x: mod.x,
                y: mod.y,
                size: fontSize,
                font: chosenFont,
                color: rgb(textColor.normR, textColor.normG, textColor.normB)
              });
            } catch (textErr) {
              console.warn('Fallback ao desenhar texto:', textErr);
              // Fallback simples sem caracteres problemáticos
              targetPage.drawText(safeText.replace(/[^\x20-\x7E]/g, '?'), {
                x: mod.x,
                y: mod.y,
                size: fontSize,
                font: fontMap.Helvetica.normal,
                color: rgb(0, 0, 0)
              });
            }
          }
        }

        // 3. Assinaturas e Imagens Sobrepostas
        const overlays = state.pageOverlays[originalPageNum] || [];
        for (const item of overlays) {
          try {
            let embeddedImage;
            if (item.dataUrl.includes('image/png')) {
              embeddedImage = await outputDoc.embedPng(item.dataUrl);
            } else {
              embeddedImage = await outputDoc.embedJpg(item.dataUrl);
            }

            // Converte coordenada da tela (Y conta de cima para baixo) para o PDF (Y conta de baixo para cima)
            const pdfY = height - (item.y + item.height);
            targetPage.drawImage(embeddedImage, {
              x: item.x,
              y: Math.max(0, pdfY),
              width: item.width,
              height: item.height
            });
          } catch (overlayErr) {
            console.error('Erro ao embutir overlay:', overlayErr);
          }
        }

        // 4. Anotações de Caneta Livre (Drawings)
        if (window.PDFStudio.Drawing) {
          const drawDataUrl = window.PDFStudio.Drawing.exportDrawingsToDataUrl(originalPageNum, width, height);
          if (drawDataUrl) {
            try {
              const embeddedDraw = await outputDoc.embedPng(drawDataUrl);
              targetPage.drawImage(embeddedDraw, {
                x: 0,
                y: 0,
                width: width,
                height: height
              });
            } catch (drawErr) {
              console.error('Erro ao embutir anotação de caneta:', drawErr);
            }
          }
        }

        // 5. Marca d'Água (se configurada)
        if (state.watermarkText) {
          const wmColor = window.PDFStudio.Utils.hexToRgb(state.watermarkColor);
          const safeWm = window.PDFStudio.Utils.sanitizeWinAnsi(state.watermarkText);
          const wmSize = Math.max(24, Math.min(60, width / 10));

          targetPage.drawText(safeWm, {
            x: width * 0.15,
            y: height * 0.35,
            size: wmSize,
            font: fontMap.Helvetica.bold,
            color: rgb(wmColor.normR, wmColor.normG, wmColor.normB),
            opacity: state.watermarkOpacity || 0.15,
            rotate: degrees(45)
          });
        }

        // 6. Numeração de Páginas no Rodapé
        if (state.addPageNumbers) {
          const numText = `Página ${i + 1} de ${copiedPages.length}`;
          targetPage.drawText(numText, {
            x: (width / 2) - 35,
            y: 18,
            size: 9,
            font: fontMap.Helvetica.normal,
            color: rgb(0.35, 0.35, 0.35)
          });
        }
      }

      let docToSave = outputDoc;
      if (state.standardizePages) {
        window.PDFStudio.Utils.showLoading('Padronizando todas as folhas para A4...');
        const standardizedDoc = await PDFDocument.create();
        const pageIndices = outputDoc.getPageIndices();
        for (const idx of pageIndices) {
          await window.PDFStudio.Utils.addStandardizedPage(standardizedDoc, outputDoc, idx, {
            standardize: true,
            format: 'A4',
            orientation: 'auto'
          });
        }
        docToSave = standardizedDoc;
      }

      const modifiedPdfBytes = await docToSave.save();
      const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      const baseName = state.fileName.replace(/\.[^/.]+$/, "");
      window.PDFStudio.Utils.downloadBlob(blob, `${baseName}_editado.pdf`);

      window.PDFStudio.Utils.showToast('PDF exportado com todas as modificações e anotações!');
    } catch (err) {
      console.error(err);
      window.PDFStudio.Utils.showToast('Erro ao exportar PDF: ' + err.message, 'error');
    } finally {
      window.PDFStudio.Utils.hideLoading();
    }
  }
};

