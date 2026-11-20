/**
 * OmniConvert - Batch Processor Engine
 * Handles multi-file conversions with queue, progress tracking, and ZIP packaging
 */

class BatchProcessor {
    constructor() {
        this.queue = [];
        this.results = [];
        this.isProcessing = false;
        this.onProgress = null;
        this.onComplete = null;
    }

    /**
     * Batch convert images to target format
     * @param {File[]} files 
     * @param {Object} options 
     */
    async processImages(files, options, progressCallback) {
        this.isProcessing = true;
        this.results = [];
        const total = files.length;

        for (let i = 0; i < total; i++) {
            const file = files[i];
            const originalName = file.name;
            const baseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
            const targetFormat = options.format || 'png';
            const newName = `${baseName}.${targetFormat}`;

            try {
                const converted = await ImageConverter.convert(file, options);
                this.results.push({
                    success: true,
                    originalName,
                    outputName: newName,
                    blob: converted.blob,
                    dataUrl: converted.dataUrl,
                    originalSize: file.size,
                    newSize: converted.size,
                    savings: Math.round(((file.size - converted.size) / file.size) * 100)
                });
            } catch (err) {
                this.results.push({
                    success: false,
                    originalName,
                    outputName: newName,
                    error: err.message
                });
            }

            if (progressCallback) {
                progressCallback({
                    current: i + 1,
                    total,
                    percentage: Math.round(((i + 1) / total) * 100),
                    latest: this.results[this.results.length - 1]
                });
            }
        }

        this.isProcessing = false;
        return this.results;
    }

    /**
     * Create a ZIP file of all successful conversions
     * @param {Array} results 
     * @param {string} zipName 
     */
    static async createZip(results, zipName = 'omniconvert-files.zip') {
        if (!window.JSZip) {
            throw new Error("JSZip library is not loaded.");
        }

        const zip = new window.JSZip();
        results.forEach(item => {
            if (item.success && item.blob) {
                zip.file(item.outputName, item.blob);
            }
        });

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const dataUrl = URL.createObjectURL(zipBlob);

        return {
            blob: zipBlob,
            dataUrl,
            filename: zipName,
            size: zipBlob.size
        };
    }
}

window.BatchProcessor = BatchProcessor;
