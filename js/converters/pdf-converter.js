/**
 * OmniConvert - PDF Studio Engine
 * Converts Images to PDF (single & multi-page), Markdown to PDF, and Text to PDF
 * Powered by jsPDF with high DPI rendering and custom layout options.
 */

class PdfConverter {
    /**
     * Convert one or multiple image files to a single PDF
     * @param {File[]|Blob[]} imageFiles 
     * @param {Object} options 
     * @returns {Promise<{blob: Blob, dataUrl: string, pageCount: number, size: number}>}
     */
    static async imagesToPdf(imageFiles, options = {}) {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            throw new Error("jsPDF library is not loaded. Please check your internet connection.");
        }

        const {
            pageSize = 'a4', // 'a4', 'letter', 'fit'
            orientation = 'auto', // 'portrait', 'landscape', 'auto'
            margin = 10, // mm
            quality = 0.92
        } = options;

        const { jsPDF } = window.jspdf;
        let pdf = null;

        for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i];
            const img = await ImageConverter.loadImage(file);
            const imgW = img.naturalWidth || img.width;
            const imgH = img.naturalHeight || img.height;
            const imgAspect = imgW / imgH;

            let pageOrientation = orientation;
            if (pageOrientation === 'auto') {
                pageOrientation = imgW > imgH ? 'landscape' : 'portrait';
            }

            let pageWidth, pageHeight;
            if (pageSize === 'fit') {
                // Dimensions in mm (assuming 96 DPI: 1px = 0.264583 mm)
                pageWidth = imgW * 0.264583;
                pageHeight = imgH * 0.264583;
            } else if (pageSize === 'letter') {
                pageWidth = pageOrientation === 'portrait' ? 215.9 : 279.4;
                pageHeight = pageOrientation === 'portrait' ? 279.4 : 215.9;
            } else { // 'a4'
                pageWidth = pageOrientation === 'portrait' ? 210 : 297;
                pageHeight = pageOrientation === 'portrait' ? 297 : 210;
            }

            if (i === 0) {
                pdf = new jsPDF({
                    orientation: pageOrientation,
                    unit: 'mm',
                    format: pageSize === 'fit' ? [pageWidth, pageHeight] : pageSize
                });
            } else {
                pdf.addPage(pageSize === 'fit' ? [pageWidth, pageHeight] : pageSize, pageOrientation);
            }

            // Convert image to JPEG data url for embedding
            const canvas = document.createElement('canvas');
            canvas.width = imgW;
            canvas.height = imgH;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, imgW, imgH);
            ctx.drawImage(img, 0, 0);
            const imgData = canvas.toDataURL('image/jpeg', quality);

            if (pageSize === 'fit' || margin === 0) {
                pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
            } else {
                const availW = pageWidth - (margin * 2);
                const availH = pageHeight - (margin * 2);
                const availAspect = availW / availH;

                let drawW, drawH;
                if (imgAspect > availAspect) {
                    drawW = availW;
                    drawH = availW / imgAspect;
                } else {
                    drawH = availH;
                    drawW = availH * imgAspect;
                }

                const posX = margin + ((availW - drawW) / 2);
                const posY = margin + ((availH - drawH) / 2);

                pdf.addImage(imgData, 'JPEG', posX, posY, drawW, drawH, undefined, 'FAST');
            }
        }

        const blob = pdf.output('blob');
        const dataUrl = URL.createObjectURL(blob);

        return {
            blob,
            dataUrl,
            pageCount: imageFiles.length,
            size: blob.size
        };
    }

    /**
     * Convert Markdown or Plain Text to a styled PDF document
     */
    static async textToPdf(text, options = {}) {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            throw new Error("jsPDF library is not loaded.");
        }

        const {
            title = 'Document',
            pageSize = 'a4',
            orientation = 'portrait',
            fontSize = 11,
            lineHeight = 1.4,
            margin = 20
        } = options;

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation,
            unit: 'mm',
            format: pageSize
        });

        const pageWidth = orientation === 'portrait' ? 210 : 297;
        const pageHeight = orientation === 'portrait' ? 297 : 210;
        const contentWidth = pageWidth - (margin * 2);

        // Header Title
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(18);
        pdf.setTextColor(30, 41, 59);
        pdf.text(title, margin, margin + 4);

        // Subtitle / generated info
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);
        pdf.text(`Generated with OmniConvert • ${new Date().toLocaleDateString()}`, margin, margin + 11);

        // Divider line
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.5);
        pdf.line(margin, margin + 14, pageWidth - margin, margin + 14);

        // Body Text
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(fontSize);
        pdf.setTextColor(51, 65, 85);

        const lines = pdf.splitTextToSize(text, contentWidth);
        const lineSpacing = fontSize * 0.45 * lineHeight;
        let cursorY = margin + 22;

        lines.forEach(line => {
            if (cursorY + lineSpacing > pageHeight - margin) {
                pdf.addPage(pageSize, orientation);
                cursorY = margin + 10;
            }
            pdf.text(line, margin, cursorY);
            cursorY += lineSpacing;
        });

        const blob = pdf.output('blob');
        const dataUrl = URL.createObjectURL(blob);

        return {
            blob,
            dataUrl,
            size: blob.size
        };
    }
}

window.PdfConverter = PdfConverter;
