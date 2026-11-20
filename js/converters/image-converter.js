/**
 * OmniConvert - Image Converter Engine
 * Converts images between PNG, JPG/JPEG, WEBP, BMP, ICO, SVG, and PDF
 * Supports scaling, quality adjustment, filters, and transforms.
 */

class ImageConverter {
    /**
     * Load an image file or blob into an HTMLImageElement
     * @param {File|Blob} file 
     * @returns {Promise<HTMLImageElement>}
     */
    static loadImage(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = (err) => {
                URL.revokeObjectURL(url);
                reject(new Error("Failed to load image. The format might be unsupported or corrupted."));
            };
            img.src = url;
        });
    }

    /**
     * Converts an image to the requested format with transformations
     * @param {File|Blob} file 
     * @param {Object} options
     * @param {string} options.format - 'png' | 'jpeg' | 'webp' | 'bmp' | 'ico' | 'svg' | 'pdf'
     * @param {number} [options.quality=0.92] - 0.05 to 1.0
     * @param {number} [options.width] - custom width
     * @param {number} [options.height] - custom height
     * @param {number} [options.rotate=0] - 0, 90, 180, 270
     * @param {boolean} [options.flipH=false]
     * @param {boolean} [options.flipV=false]
     * @param {boolean} [options.grayscale=false]
     * @param {boolean} [options.invert=false]
     * @param {boolean} [options.sepia=false]
     * @param {number} [options.brightness=100] - 0-200
     * @param {number} [options.contrast=100] - 0-200
     * @returns {Promise<{blob: Blob, dataUrl: string, width: number, height: number, size: number, format: string}>}
     */
    static async convert(file, options = {}) {
        const {
            format = 'png',
            quality = 0.92,
            width = null,
            height = null,
            rotate = 0,
            flipH = false,
            flipV = false,
            grayscale = false,
            invert = false,
            sepia = false,
            brightness = 100,
            contrast = 100
        } = options;

        const img = await this.loadImage(file);
        
        let targetWidth = width || img.naturalWidth || img.width;
        let targetHeight = height || img.naturalHeight || img.height;

        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Handle rotation dimensions
        const isPerpendicular = (rotate % 180 !== 0);
        canvas.width = isPerpendicular ? targetHeight : targetWidth;
        canvas.height = isPerpendicular ? targetWidth : targetHeight;

        // Apply filters
        const filterParts = [];
        if (grayscale) filterParts.push('grayscale(100%)');
        if (invert) filterParts.push('invert(100%)');
        if (sepia) filterParts.push('sepia(100%)');
        if (brightness !== 100) filterParts.push(`brightness(${brightness}%)`);
        if (contrast !== 100) filterParts.push(`contrast(${contrast}%)`);
        if (filterParts.length > 0) {
            ctx.filter = filterParts.join(' ');
        }

        // Apply transformations (rotate, flip)
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        if (rotate !== 0) {
            ctx.rotate((rotate * Math.PI) / 180);
        }
        ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

        // Fill background white for JPEG or BMP if transparent
        if (format === 'jpeg' || format === 'jpg' || format === 'bmp') {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
        }

        // Draw image centered
        ctx.drawImage(img, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
        ctx.restore();

        // Target format handling
        const normFormat = format.toLowerCase().replace('image/', '');

        if (normFormat === 'bmp') {
            const bmpBlob = this.canvasToBmp(canvas);
            const dataUrl = URL.createObjectURL(bmpBlob);
            return {
                blob: bmpBlob,
                dataUrl,
                width: canvas.width,
                height: canvas.height,
                size: bmpBlob.size,
                format: 'bmp'
            };
        }

        if (normFormat === 'ico') {
            const icoBlob = await this.canvasToIco(canvas);
            const dataUrl = URL.createObjectURL(icoBlob);
            return {
                blob: icoBlob,
                dataUrl,
                width: canvas.width,
                height: canvas.height,
                size: icoBlob.size,
                format: 'ico'
            };
        }

        if (normFormat === 'svg') {
            const svgBlob = this.canvasToSvg(canvas);
            const dataUrl = URL.createObjectURL(svgBlob);
            return {
                blob: svgBlob,
                dataUrl,
                width: canvas.width,
                height: canvas.height,
                size: svgBlob.size,
                format: 'svg'
            };
        }

        if (normFormat === 'pdf') {
            if (typeof window.jspdf !== 'undefined' && window.jspdf.jsPDF) {
                const { jsPDF } = window.jspdf;
                const orientation = canvas.width > canvas.height ? 'landscape' : 'portrait';
                const pdf = new jsPDF({
                    orientation,
                    unit: 'px',
                    format: [canvas.width, canvas.height]
                });
                const imgData = canvas.toDataURL('image/jpeg', quality);
                pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
                const pdfBlob = pdf.output('blob');
                const dataUrl = URL.createObjectURL(pdfBlob);
                return {
                    blob: pdfBlob,
                    dataUrl,
                    width: canvas.width,
                    height: canvas.height,
                    size: pdfBlob.size,
                    format: 'pdf'
                };
            }
        }

        // Standard formats: png, jpeg, webp
        let mimeType = 'image/png';
        if (normFormat === 'jpeg' || normFormat === 'jpg') mimeType = 'image/jpeg';
        else if (normFormat === 'webp') mimeType = 'image/webp';

        const blob = await new Promise(resolve => canvas.toBlob(resolve, mimeType, quality));
        const dataUrl = URL.createObjectURL(blob);

        return {
            blob,
            dataUrl,
            width: canvas.width,
            height: canvas.height,
            size: blob.size,
            format: normFormat
        };
    }

    /**
     * Pure JavaScript BMP encoder (24-bit uncompressed RGB)
     * Generates standard Windows BMP file
     */
    static canvasToBmp(canvas) {
        const width = canvas.width;
        const height = canvas.height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        const rowSize = Math.floor((24 * width + 31) / 32) * 4;
        const pixelArraySize = rowSize * height;
        const fileHeaderSize = 14;
        const dibHeaderSize = 40;
        const fileSize = fileHeaderSize + dibHeaderSize + pixelArraySize;

        const buffer = new ArrayBuffer(fileSize);
        const view = new DataView(buffer);

        // Bitmap File Header (14 bytes)
        view.setUint16(0, 0x4D42, false); // 'BM' in little-endian (0x42 0x4D)
        view.setUint32(2, fileSize, true);
        view.setUint16(6, 0, true);
        view.setUint16(8, 0, true);
        view.setUint32(10, fileHeaderSize + dibHeaderSize, true); // offset to pixels

        // DIB Header (BITMAPINFOHEADER - 40 bytes)
        view.setUint32(14, dibHeaderSize, true);
        view.setInt32(18, width, true);
        view.setInt32(22, height, true); // positive for bottom-to-top
        view.setUint16(26, 1, true); // 1 color plane
        view.setUint16(28, 24, true); // 24 bits per pixel
        view.setUint32(30, 0, true); // BI_RGB (uncompressed)
        view.setUint32(34, pixelArraySize, true);
        view.setInt32(38, 2835, true); // 72 DPI horizontal (2835 ppm)
        view.setInt32(42, 2835, true); // 72 DPI vertical
        view.setUint32(46, 0, true); // 0 colors in palette
        view.setUint32(50, 0, true); // 0 important colors

        // Pixel data (BGR bottom-to-top with 4-byte row padding)
        let offset = fileHeaderSize + dibHeaderSize;
        for (let y = height - 1; y >= 0; y--) {
            for (let x = 0; x < width; x++) {
                const srcIdx = (y * width + x) * 4;
                const r = data[srcIdx];
                const g = data[srcIdx + 1];
                const b = data[srcIdx + 2];

                view.setUint8(offset++, b);
                view.setUint8(offset++, g);
                view.setUint8(offset++, r);
            }
            // Add padding bytes
            const padding = rowSize - (width * 3);
            for (let p = 0; p < padding; p++) {
                view.setUint8(offset++, 0);
            }
        }

        return new Blob([buffer], { type: 'image/bmp' });
    }

    /**
     * Pure JavaScript ICO encoder containing PNG chunk
     */
    static async canvasToIco(canvas) {
        // Resize to standard icon max 256x256 if larger
        let targetCanvas = canvas;
        const maxDim = Math.max(canvas.width, canvas.height);
        if (maxDim > 256) {
            const scale = 256 / maxDim;
            const w = Math.round(canvas.width * scale);
            const h = Math.round(canvas.height * scale);
            targetCanvas = document.createElement('canvas');
            targetCanvas.width = w;
            targetCanvas.height = h;
            const ctx = targetCanvas.getContext('2d');
            ctx.drawImage(canvas, 0, 0, w, h);
        }

        // Get PNG blob
        const pngBlob = await new Promise(resolve => targetCanvas.toBlob(resolve, 'image/png'));
        const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());

        const icoHeaderSize = 6;
        const icoDirEntrySize = 16;
        const totalSize = icoHeaderSize + icoDirEntrySize + pngBytes.length;

        const buffer = new ArrayBuffer(totalSize);
        const view = new DataView(buffer);

        // ICO Header
        view.setUint16(0, 0, true); // Reserved
        view.setUint16(2, 1, true); // 1 = ICO icon
        view.setUint16(4, 1, true); // 1 image in file

        // Directory Entry
        const w = targetCanvas.width >= 256 ? 0 : targetCanvas.width;
        const h = targetCanvas.height >= 256 ? 0 : targetCanvas.height;
        view.setUint8(6, w); // Width
        view.setUint8(7, h); // Height
        view.setUint8(8, 0); // Palette colors (0 = no palette)
        view.setUint8(9, 0); // Reserved
        view.setUint16(10, 1, true); // Color planes
        view.setUint16(12, 32, true); // Bits per pixel
        view.setUint32(14, pngBytes.length, true); // Image data size
        view.setUint32(18, icoHeaderSize + icoDirEntrySize, true); // Offset

        // Copy PNG bytes into ICO payload
        const uint8Buffer = new Uint8Array(buffer);
        uint8Buffer.set(pngBytes, icoHeaderSize + icoDirEntrySize);

        return new Blob([buffer], { type: 'image/x-icon' });
    }

    /**
     * Canvas to SVG wrapper
     */
    static canvasToSvg(canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">
  <image width="${canvas.width}" height="${canvas.height}" xlink:href="${dataUrl}"/>
</svg>`;
        return new Blob([svgContent], { type: 'image/svg+xml' });
    }
}

window.ImageConverter = ImageConverter;
