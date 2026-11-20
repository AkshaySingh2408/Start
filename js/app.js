/**
 * OmniConvert - Master Application Controller
 * Handles UI events, tabs, universal auto-detection, and bridges converter engines.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // State
    const state = {
        theme: localStorage.getItem('omniconvert_theme') || 'light',
        history: JSON.parse(localStorage.getItem('omniconvert_history') || '[]'),
        universalFile: null,
        universalResult: null,
        imageFile: null,
        imageResult: null,
        imageNaturalW: 0,
        imageNaturalH: 0,
        pdfPages: [],
        audioFile: null,
        audioResult: null,
        batchFiles: [],
        batchResults: []
    };

    // Helper: Format bytes to human readable
    const formatBytes = (bytes, decimals = 2) => {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    // Helper: Toast Notifications
    const showToast = (message, type = 'info') => {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        const colors = {
            success: 'bg-emerald-600 text-white',
            error: 'bg-rose-600 text-white',
            info: 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900',
            warning: 'bg-amber-600 text-white'
        };

        toast.className = `${colors[type] || colors.info} px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xl flex items-center space-x-2 transform transition-all duration-300 translate-y-4 opacity-0 pointer-events-auto`;
        toast.innerHTML = `<span>${message}</span>`;
        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-4', 'opacity-0');
        });

        // Auto remove
        setTimeout(() => {
            toast.classList.add('translate-y-4', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    };

    // History Log management
    const addToHistory = (entry) => {
        const item = {
            id: Date.now(),
            name: entry.name,
            from: entry.from,
            to: entry.to,
            size: entry.size,
            date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        state.history.unshift(item);
        if (state.history.length > 30) state.history.pop();
        localStorage.setItem('omniconvert_history', JSON.stringify(state.history));
        updateHistoryBadge();
    };

    const updateHistoryBadge = () => {
        const badge = document.getElementById('historyCountBadge');
        if (badge) badge.textContent = state.history.length;
    };
    updateHistoryBadge();

    // -------------------------------------------------------------
    // Theme Switcher
    // -------------------------------------------------------------
    const applyTheme = (t) => {
        const html = document.documentElement;
        if (t === 'dark') {
            html.classList.add('dark');
            html.classList.remove('light');
        } else {
            html.classList.remove('dark');
            html.classList.add('light');
        }
        localStorage.setItem('omniconvert_theme', t);
        state.theme = t;
        const icon = document.getElementById('themeIcon');
        if (icon) {
            icon.setAttribute('data-lucide', t === 'dark' ? 'sun' : 'moon');
            if (window.lucide) window.lucide.createIcons();
        }
    };
    applyTheme(state.theme);

    document.getElementById('themeToggleBtn').addEventListener('click', () => {
        applyTheme(state.theme === 'dark' ? 'light' : 'dark');
    });

    // -------------------------------------------------------------
    // Tab Navigation
    // -------------------------------------------------------------
    const tabs = document.querySelectorAll('.nav-tab');
    const panes = document.querySelectorAll('.tab-pane');

    const switchTab = (targetId) => {
        tabs.forEach(tab => {
            const isMatch = tab.dataset.target === targetId;
            if (isMatch) {
                tab.classList.add('active', 'bg-brand-600', 'text-white', 'shadow-md', 'shadow-brand-500/20');
                tab.classList.remove('text-slate-600', 'dark:text-slate-300', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
            } else {
                tab.classList.remove('active', 'bg-brand-600', 'text-white', 'shadow-md', 'shadow-brand-500/20');
                tab.classList.add('text-slate-600', 'dark:text-slate-300', 'hover:bg-slate-100', 'dark:hover:bg-slate-800');
            }
        });

        panes.forEach(pane => {
            if (pane.id === targetId) {
                pane.classList.remove('hidden');
                pane.classList.add('block');
            } else {
                pane.classList.add('hidden');
                pane.classList.remove('block');
            }
        });
        if (window.lucide) window.lucide.createIcons();
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.target));
    });

    // -------------------------------------------------------------
    // Drag & Drop Setup Utility
    // -------------------------------------------------------------
    const setupDropzone = (dropzoneEl, inputEl, onFiles) => {
        if (!dropzoneEl || !inputEl) return;

        dropzoneEl.addEventListener('click', () => inputEl.click());

        inputEl.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                onFiles(Array.from(e.target.files));
                inputEl.value = ''; // allow re-selecting same file
            }
        });

        ['dragenter', 'dragover'].forEach(name => {
            dropzoneEl.addEventListener(name, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzoneEl.classList.add('dropzone-active');
            });
        });

        ['dragleave', 'drop'].forEach(name => {
            dropzoneEl.addEventListener(name, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzoneEl.classList.remove('dropzone-active');
            });
        });

        dropzoneEl.addEventListener('drop', (e) => {
            if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                onFiles(Array.from(e.dataTransfer.files));
            }
        });
    };

    // Global Paste Support (Ctrl+V)
    window.addEventListener('paste', (e) => {
        if (e.clipboardData && e.clipboardData.files.length > 0) {
            handleUniversalFiles(Array.from(e.clipboardData.files));
            switchTab('tab-universal');
            showToast("Pasted file from clipboard!", "success");
        }
    });

    // -------------------------------------------------------------
    // TAB 1: Universal Auto-Detect Dropzone
    // -------------------------------------------------------------
    const universalDropzone = document.getElementById('universalDropzone');
    const universalFileInput = document.getElementById('universalFileInput');
    const universalResultCard = document.getElementById('universalResultCard');
    const uFileName = document.getElementById('uFileName');
    const uFileSize = document.getElementById('uFileSize');
    const uFileType = document.getElementById('uFileType');
    const uTargetFormat = document.getElementById('uTargetFormat');
    const uFormatHint = document.getElementById('uFormatHint');
    const uQualitySlider = document.getElementById('uQualitySlider');
    const uQualityLabel = document.getElementById('uQualityLabel');
    const uConvertBtn = document.getElementById('uConvertBtn');
    const uOutputSection = document.getElementById('uOutputSection');
    const uPreviewBox = document.getElementById('uPreviewBox');
    const uDownloadBtn = document.getElementById('uDownloadBtn');
    const uCopyBtn = document.getElementById('uCopyBtn');
    const uSavingsBadge = document.getElementById('uSavingsBadge');

    uQualitySlider.addEventListener('input', (e) => {
        uQualityLabel.textContent = `${e.target.value}%`;
    });

    const getFileCategory = (file) => {
        const mime = file.type.toLowerCase();
        const ext = (file.name.split('.').pop() || '').toLowerCase();

        if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'ico', 'svg', 'avif'].includes(ext)) {
            return 'image';
        }
        if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'].includes(ext)) {
            return 'audio';
        }
        if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) {
            return 'video';
        }
        if (['json', 'csv', 'tsv', 'xml', 'yaml', 'yml', 'md', 'markdown', 'txt', 'html'].includes(ext) || mime.includes('json') || mime.includes('csv') || mime.includes('xml')) {
            return 'document';
        }
        if (ext === 'pdf' || mime === 'application/pdf') {
            return 'pdf';
        }
        return 'other';
    };

    const populateTargetFormats = (category, ext) => {
        uTargetFormat.innerHTML = '';
        let options = [];

        if (category === 'image') {
            options = [
                { val: 'webp', label: 'WEBP (High Compression Web)' },
                { val: 'png', label: 'PNG (Lossless & Alpha)' },
                { val: 'jpeg', label: 'JPEG (Universal Photo)' },
                { val: 'bmp', label: 'BMP (Bitmap)' },
                { val: 'ico', label: 'ICO (Windows Icon / Favicon)' },
                { val: 'svg', label: 'SVG (Vector Container)' },
                { val: 'pdf', label: 'PDF (Printable Document)' }
            ];
            uFormatHint.textContent = "Adjust quality and scale below for optimal compression.";
        } else if (category === 'document') {
            options = [
                { val: 'json', label: 'JSON Data' },
                { val: 'csv', label: 'CSV Spreadsheet' },
                { val: 'xml', label: 'XML Document' },
                { val: 'yaml', label: 'YAML' },
                { val: 'markdown-table', label: 'Markdown Table' },
                { val: 'html-table', label: 'HTML Table' },
                { val: 'pdf', label: 'Styled PDF' }
            ];
            uFormatHint.textContent = "Data will be parsed and re-formatted cleanly.";
        } else if (category === 'audio' || category === 'video') {
            options = [
                { val: 'wav', label: 'WAV (16-bit Lossless Audio)' },
                { val: 'mp3', label: 'MP3 Audio' }
            ];
            uFormatHint.textContent = category === 'video' ? "Audio track will be extracted directly from this video!" : "High-speed client-side audio encoding.";
        } else {
            options = [
                { val: 'base64', label: 'Base64 Data URI' },
                { val: 'sha256', label: 'SHA-256 Checksum' }
            ];
            uFormatHint.textContent = "Generates developer representations.";
        }

        // Filter out current format if matching
        options.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt.val;
            el.textContent = opt.label;
            uTargetFormat.appendChild(el);
        });
    };

    const handleUniversalFiles = (files) => {
        if (!files || files.length === 0) return;
        if (files.length > 1) {
            // Forward to batch tab
            state.batchFiles = files;
            populateBatchWorkspace(files);
            switchTab('tab-batch');
            showToast(`Loaded ${files.length} files into Batch Mode!`, "info");
            return;
        }

        const file = files[0];
        state.universalFile = file;
        const category = getFileCategory(file);
        const ext = (file.name.split('.').pop() || '').toLowerCase();

        uFileName.textContent = file.name;
        uFileSize.textContent = formatBytes(file.size);
        uFileType.textContent = `${category.toUpperCase()} (${ext.toUpperCase()})`;

        populateTargetFormats(category, ext);

        universalResultCard.classList.remove('hidden');
        uOutputSection.classList.add('hidden');
        universalResultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    setupDropzone(universalDropzone, universalFileInput, handleUniversalFiles);

    document.getElementById('uClearBtn').addEventListener('click', () => {
        state.universalFile = null;
        universalResultCard.classList.add('hidden');
    });

    // Execute Universal Conversion
    uConvertBtn.addEventListener('click', async () => {
        if (!state.universalFile) return;
        const file = state.universalFile;
        const category = getFileCategory(file);
        const targetFormat = uTargetFormat.value;
        const quality = parseInt(uQualitySlider.value, 10) / 100;

        uConvertBtn.disabled = true;
        uConvertBtn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i><span>Converting...</span>';

        try {
            let resultBlob, resultDataUrl, previewContent, copyText = null;

            if (category === 'image') {
                const res = await ImageConverter.convert(file, { format: targetFormat, quality });
                resultBlob = res.blob;
                resultDataUrl = res.dataUrl;

                if (targetFormat === 'pdf') {
                    previewContent = `<div class="p-6 text-center text-xs font-semibold text-slate-500"><i data-lucide="file-text" class="w-12 h-12 mx-auto text-brand-500 mb-2"></i>PDF created successfully (${formatBytes(resultBlob.size)})</div>`;
                } else {
                    previewContent = `<img src="${resultDataUrl}" alt="Converted" class="max-h-[300px] object-contain rounded-lg shadow-sm" />`;
                }
            } else if (category === 'document') {
                const text = await file.text();
                let output = '';
                const srcExt = (file.name.split('.').pop() || 'txt').toLowerCase();

                let dataObj = null;
                if (srcExt === 'json') {
                    dataObj = JSON.parse(text);
                } else if (srcExt === 'csv' || srcExt === 'tsv') {
                    dataObj = DocumentConverter.parseCsv(text, srcExt === 'tsv' ? '\t' : 'auto');
                } else if (srcExt === 'xml') {
                    dataObj = DocumentConverter.xmlToJson(text);
                } else if (srcExt === 'yaml' || srcExt === 'yml') {
                    dataObj = DocumentConverter.yamlToJson(text);
                }

                if (targetFormat === 'csv') {
                    output = DocumentConverter.jsonToCsv(dataObj || text);
                } else if (targetFormat === 'json') {
                    output = JSON.stringify(dataObj || text, null, 2);
                } else if (targetFormat === 'xml') {
                    output = DocumentConverter.jsonToXml(dataObj || { data: text });
                } else if (targetFormat === 'yaml') {
                    output = DocumentConverter.jsonToYaml(dataObj || text);
                } else if (targetFormat === 'markdown-table') {
                    output = DocumentConverter.toMarkdownTable(dataObj || text);
                } else if (targetFormat === 'html-table') {
                    output = DocumentConverter.toHtmlTable(dataObj || text);
                } else if (targetFormat === 'pdf') {
                    const pdfRes = await PdfConverter.textToPdf(text, { title: file.name });
                    resultBlob = pdfRes.blob;
                    resultDataUrl = pdfRes.dataUrl;
                }

                if (targetFormat !== 'pdf') {
                    copyText = output;
                    resultBlob = new Blob([output], { type: 'text/plain;charset=utf-8' });
                    resultDataUrl = URL.createObjectURL(resultBlob);
                    previewContent = `<pre class="text-xs font-mono p-4 max-h-[300px] overflow-auto text-slate-700 dark:text-slate-300 w-full">${output.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`;
                } else {
                    previewContent = `<div class="p-6 text-center text-xs font-semibold text-slate-500"><i data-lucide="file-text" class="w-12 h-12 mx-auto text-brand-500 mb-2"></i>PDF created successfully (${formatBytes(resultBlob.size)})</div>`;
                }
            } else if (category === 'audio' || category === 'video') {
                const res = await AudioConverter.convertMedia(file, targetFormat);
                resultBlob = res.blob;
                resultDataUrl = res.dataUrl;
                previewContent = `<div class="w-full max-w-md py-4 space-y-2"><audio controls src="${resultDataUrl}" class="w-full"></audio><p class="text-xs text-center text-slate-400">Audio extracted & converted (${formatBytes(resultBlob.size)})</p></div>`;
            } else {
                // Other / Dev
                const base64Data = await EncodingConverter.fileToBase64(file);
                copyText = base64Data.dataUrl;
                resultBlob = new Blob([base64Data.dataUrl], { type: 'text/plain' });
                resultDataUrl = URL.createObjectURL(resultBlob);
                previewContent = `<textarea readonly class="w-full h-32 text-xs font-mono p-2 bg-slate-900 text-slate-100 rounded-lg">${base64Data.dataUrl}</textarea>`;
            }

            // Setup download link
            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const finalExt = targetFormat === 'markdown-table' ? 'md' : targetFormat === 'html-table' ? 'html' : targetFormat;
            const outputFilename = `${baseName}.${finalExt}`;

            uDownloadBtn.href = resultDataUrl;
            uDownloadBtn.download = outputFilename;

            // Copy button
            uCopyBtn.onclick = async () => {
                if (copyText) {
                    await navigator.clipboard.writeText(copyText);
                    showToast("Copied to clipboard!", "success");
                } else {
                    showToast("Binary file. Use Download button.", "info");
                }
            };

            // Size comparison & Savings badge
            if (resultBlob && file.size > 0) {
                const savings = Math.round(((file.size - resultBlob.size) / file.size) * 100);
                if (savings > 0) {
                    uSavingsBadge.textContent = `-${savings}% smaller (${formatBytes(file.size)} → ${formatBytes(resultBlob.size)})`;
                    uSavingsBadge.classList.remove('hidden');
                } else {
                    uSavingsBadge.textContent = `${formatBytes(file.size)} → ${formatBytes(resultBlob.size)}`;
                    uSavingsBadge.classList.remove('hidden');
                }
            }

            uPreviewBox.innerHTML = previewContent;
            uOutputSection.classList.remove('hidden');
            if (window.lucide) window.lucide.createIcons();

            addToHistory({
                name: file.name,
                from: category,
                to: targetFormat,
                size: formatBytes(resultBlob.size)
            });

            showToast("Conversion completed successfully!", "success");
        } catch (err) {
            console.error(err);
            showToast(`Conversion failed: ${err.message}`, "error");
        } finally {
            uConvertBtn.disabled = false;
            uConvertBtn.innerHTML = '<i data-lucide="sparkles" class="w-5 h-5"></i><span>Convert Now</span>';
            if (window.lucide) window.lucide.createIcons();
        }
    });

    // Preset Demo Loaders
    document.getElementById('demoSampleImage').addEventListener('click', async () => {
        // Generate a canvas gradient image blob
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 800, 600);
        grad.addColorStop(0, '#6366f1');
        grad.addColorStop(0.5, '#a855f7');
        grad.addColorStop(1, '#ec4899');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 800, 600);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 44px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('OmniConvert Demo Image', 400, 300);
        ctx.font = '22px sans-serif';
        ctx.fillText('High Quality 800 × 600 • 100% Client-Side', 400, 350);

        canvas.toBlob(blob => {
            const file = new File([blob], 'sample-gradient.png', { type: 'image/png' });
            handleUniversalFiles([file]);
            showToast("Sample image loaded!", "info");
        });
    });

    document.getElementById('demoSampleJson').addEventListener('click', () => {
        const sampleData = [
            { id: 101, name: "Alpha Widget", category: "Hardware", price: 49.99, inStock: true },
            { id: 102, name: "Beta Gadget", category: "Accessories", price: 24.50, inStock: true },
            { id: 103, name: "Gamma Pro", category: "Electronics", price: 199.00, inStock: false },
            { id: 104, name: "Delta Sensor", category: "IoT", price: 14.25, inStock: true }
        ];
        const blob = new Blob([JSON.stringify(sampleData, null, 2)], { type: 'application/json' });
        const file = new File([blob], 'products-sample.json', { type: 'application/json' });
        handleUniversalFiles([file]);
        showToast("Sample JSON loaded!", "info");
    });

    document.getElementById('demoSampleCsv').addEventListener('click', () => {
        const sampleCsv = `id,department,employees,budget_usd\n1,Engineering,42,1250000\n2,Design,12,350000\n3,Marketing,24,600000\n4,Customer Support,30,450000`;
        const blob = new Blob([sampleCsv], { type: 'text/csv' });
        const file = new File([blob], 'departments.csv', { type: 'text/csv' });
        handleUniversalFiles([file]);
        showToast("Sample CSV loaded!", "info");
    });

    document.getElementById('demoSampleMarkdown').addEventListener('click', () => {
        const sampleMd = `# Quarterly Product Roadmap\n\n## Overview\nHere is our updated deployment schedule for **OmniConvert**.\n\n| Phase | Deliverable | Target Date | Status |\n|---|---|---|---|\n| 1 | Image Engine | Jan 15 | Complete |\n| 2 | Data Converter | Feb 10 | Complete |\n| 3 | Audio Extractor | Mar 05 | Complete |\n\n> Note: All conversions execute in the client browser with 0 latency.`;
        const blob = new Blob([sampleMd], { type: 'text/markdown' });
        const file = new File([blob], 'roadmap.md', { type: 'text/markdown' });
        handleUniversalFiles([file]);
        showToast("Sample Markdown loaded!", "info");
    });

    // -------------------------------------------------------------
    // TAB 2: Image Studio
    // -------------------------------------------------------------
    const imageDropzone = document.getElementById('imageDropzone');
    const imageFileInput = document.getElementById('imageFileInput');
    const imageWorkspace = document.getElementById('imageWorkspace');
    const imgPreviewElement = document.getElementById('imgPreviewElement');
    const imgWidthInput = document.getElementById('imgWidthInput');
    const imgHeightInput = document.getElementById('imgHeightInput');
    const imgLockAspect = document.getElementById('imgLockAspect');
    const imgQualityInput = document.getElementById('imgQualityInput');
    const imgQualityValue = document.getElementById('imgQualityValue');
    const imgTargetFormat = document.getElementById('imgTargetFormat');
    const imgGrayscale = document.getElementById('imgGrayscale');
    const imgInvert = document.getElementById('imgInvert');
    const imgSepia = document.getElementById('imgSepia');
    const imgRotateBtn = document.getElementById('imgRotateBtn');
    const imgFlipHBtn = document.getElementById('imgFlipHBtn');
    const imgConvertExecuteBtn = document.getElementById('imgConvertExecuteBtn');
    const imgDownloadBtn = document.getElementById('imgDownloadBtn');
    const imgComparisonBadge = document.getElementById('imgComparisonBadge');
    const imgResolutionInfo = document.getElementById('imgResolutionInfo');

    let currentRotation = 0;
    let isFlippedH = false;

    imgQualityInput.addEventListener('input', (e) => {
        imgQualityValue.textContent = `${e.target.value}%`;
    });

    const handleImageFile = async (files) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        state.imageFile = file;

        const img = await ImageConverter.loadImage(file);
        state.imageNaturalW = img.naturalWidth;
        state.imageNaturalH = img.naturalHeight;

        imgWidthInput.value = state.imageNaturalW;
        imgHeightInput.value = state.imageNaturalH;
        currentRotation = 0;
        isFlippedH = false;

        imgPreviewElement.src = img.src;
        imgResolutionInfo.textContent = `${state.imageNaturalW} × ${state.imageNaturalH} px`;
        imgComparisonBadge.textContent = `Original: ${formatBytes(file.size)}`;

        imageWorkspace.classList.remove('hidden');
        imageWorkspace.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    setupDropzone(imageDropzone, imageFileInput, handleImageFile);

    // Dimension aspect ratio locking
    imgWidthInput.addEventListener('input', () => {
        if (imgLockAspect.checked && state.imageNaturalW > 0) {
            const ratio = state.imageNaturalH / state.imageNaturalW;
            imgHeightInput.value = Math.round(imgWidthInput.value * ratio);
        }
    });

    imgHeightInput.addEventListener('input', () => {
        if (imgLockAspect.checked && state.imageNaturalH > 0) {
            const ratio = state.imageNaturalW / state.imageNaturalH;
            imgWidthInput.value = Math.round(imgHeightInput.value * ratio);
        }
    });

    document.querySelectorAll('.img-scale-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const scale = parseFloat(btn.dataset.scale);
            if (state.imageNaturalW > 0) {
                imgWidthInput.value = Math.round(state.imageNaturalW * scale);
                imgHeightInput.value = Math.round(state.imageNaturalH * scale);
            }
        });
    });

    imgRotateBtn.addEventListener('click', () => {
        currentRotation = (currentRotation + 90) % 360;
        showToast(`Rotated to ${currentRotation}°`, "info");
        executeImageConversion();
    });

    imgFlipHBtn.addEventListener('click', () => {
        isFlippedH = !isFlippedH;
        showToast(isFlippedH ? "Flipped Horizontally" : "Normal Orientation", "info");
        executeImageConversion();
    });

    const executeImageConversion = async () => {
        if (!state.imageFile) return;
        const format = imgTargetFormat.value;
        const quality = parseInt(imgQualityInput.value, 10) / 100;
        const width = parseInt(imgWidthInput.value, 10) || state.imageNaturalW;
        const height = parseInt(imgHeightInput.value, 10) || state.imageNaturalH;

        imgConvertExecuteBtn.disabled = true;

        try {
            const res = await ImageConverter.convert(state.imageFile, {
                format,
                quality,
                width,
                height,
                rotate: currentRotation,
                flipH: isFlippedH,
                grayscale: imgGrayscale.checked,
                invert: imgInvert.checked,
                sepia: imgSepia.checked
            });

            state.imageResult = res;
            imgPreviewElement.src = res.dataUrl;
            imgResolutionInfo.textContent = `${res.width} × ${res.height} px`;

            const savings = Math.round(((state.imageFile.size - res.size) / state.imageFile.size) * 100);
            const savingsStr = savings > 0 ? `(-${savings}%)` : `(+${Math.abs(savings)}%)`;
            imgComparisonBadge.textContent = `${formatBytes(state.imageFile.size)} → ${formatBytes(res.size)} ${savingsStr}`;

            const baseName = state.imageFile.name.substring(0, state.imageFile.name.lastIndexOf('.')) || state.imageFile.name;
            imgDownloadBtn.href = res.dataUrl;
            imgDownloadBtn.download = `${baseName}.${res.format}`;

            addToHistory({
                name: state.imageFile.name,
                from: 'IMAGE',
                to: res.format.toUpperCase(),
                size: formatBytes(res.size)
            });

            showToast("Image converted successfully!", "success");
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            imgConvertExecuteBtn.disabled = false;
        }
    };

    imgConvertExecuteBtn.addEventListener('click', executeImageConversion);

    // -------------------------------------------------------------
    // TAB 3: Documents & Data
    // -------------------------------------------------------------
    const docInputText = document.getElementById('docInputText');
    const docOutputText = document.getElementById('docOutputText');
    const docRenderedHtml = document.getElementById('docRenderedHtml');
    const docSourceFormat = document.getElementById('docSourceFormat');
    const docTargetFormat = document.getElementById('docTargetFormat');
    const docExecuteConvertBtn = document.getElementById('docExecuteConvertBtn');
    const docCopyBtn = document.getElementById('docCopyBtn');
    const docDownloadBtn = document.getElementById('docDownloadBtn');
    const docClearInputBtn = document.getElementById('docClearInputBtn');
    const docLoadSampleBtn = document.getElementById('docLoadSampleBtn');
    const docFileInput = document.getElementById('docFileInput');

    docFileInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
            const f = e.target.files[0];
            const content = await f.text();
            docInputText.value = content;
            const ext = (f.name.split('.').pop() || '').toLowerCase();
            if (['json', 'csv', 'xml', 'yaml', 'yml', 'md', 'html'].includes(ext)) {
                docSourceFormat.value = ext === 'yml' ? 'yaml' : ext === 'md' ? 'markdown' : ext;
            }
            showToast(`Loaded ${f.name}`, "info");
        }
    });

    docClearInputBtn.addEventListener('click', () => {
        docInputText.value = '';
        docOutputText.value = '';
        docRenderedHtml.innerHTML = '';
        docRenderedHtml.classList.add('hidden');
        docOutputText.classList.remove('hidden');
    });

    docLoadSampleBtn.addEventListener('click', () => {
        const sample = [
            { "id": 1, "product": "Pro Cloud Storage", "price": 12.99, "status": "active" },
            { "id": 2, "product": "Enterprise Suite", "price": 49.99, "status": "active" },
            { "id": 3, "product": "Developer API Access", "price": 9.99, "status": "pending" }
        ];
        docInputText.value = JSON.stringify(sample, null, 2);
        docSourceFormat.value = 'json';
        docTargetFormat.value = 'csv';
        showToast("Loaded sample JSON data", "info");
    });

    const executeDocumentConversion = async () => {
        const input = docInputText.value.trim();
        if (!input) {
            showToast("Please enter or upload input text/data", "warning");
            return;
        }

        const src = docSourceFormat.value;
        const target = docTargetFormat.value;

        try {
            let dataObj = null;
            if (src === 'json') {
                dataObj = JSON.parse(input);
            } else if (src === 'csv') {
                dataObj = DocumentConverter.parseCsv(input);
            } else if (src === 'xml') {
                dataObj = DocumentConverter.xmlToJson(input);
            } else if (src === 'yaml') {
                dataObj = DocumentConverter.yamlToJson(input);
            } else if (src === 'markdown') {
                if (target === 'html') {
                    const html = DocumentConverter.markdownToHtml(input);
                    docRenderedHtml.innerHTML = html;
                    docRenderedHtml.classList.remove('hidden');
                    docOutputText.classList.add('hidden');
                    docOutputText.value = html;
                    setupDocDownload(html, 'document.html');
                    showToast("Rendered Markdown to HTML!", "success");
                    return;
                }
            } else if (src === 'html') {
                if (target === 'markdown') {
                    const md = DocumentConverter.htmlToMarkdown(input);
                    showDocOutput(md, 'document.md');
                    return;
                }
            }

            let result = '';
            let filename = `converted.${target}`;

            if (target === 'csv') {
                result = DocumentConverter.jsonToCsv(dataObj || input);
                filename = 'data.csv';
            } else if (target === 'json') {
                result = JSON.stringify(dataObj || input, null, 2);
                filename = 'data.json';
            } else if (target === 'xml') {
                result = DocumentConverter.jsonToXml(dataObj || { root: input });
                filename = 'data.xml';
            } else if (target === 'yaml') {
                result = DocumentConverter.jsonToYaml(dataObj || input);
                filename = 'data.yaml';
            } else if (target === 'markdown-table') {
                result = DocumentConverter.toMarkdownTable(dataObj || input);
                filename = 'table.md';
            } else if (target === 'html-table') {
                result = DocumentConverter.toHtmlTable(dataObj || input);
                filename = 'table.html';
            } else if (target === 'pdf') {
                const pdfRes = await PdfConverter.textToPdf(input, { title: "Converted Document" });
                docDownloadBtn.href = pdfRes.dataUrl;
                docDownloadBtn.download = "document.pdf";
                docOutputText.value = `PDF generated successfully (${formatBytes(pdfRes.size)}). Click Download above.`;
                showToast("PDF created successfully!", "success");
                return;
            }

            showDocOutput(result, filename);
            showToast("Converted data successfully!", "success");
        } catch (err) {
            showToast(`Conversion error: ${err.message}`, "error");
        }
    };

    const showDocOutput = (text, filename) => {
        docOutputText.value = text;
        docOutputText.classList.remove('hidden');
        docRenderedHtml.classList.add('hidden');
        setupDocDownload(text, filename);
    };

    const setupDocDownload = (text, filename) => {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        docDownloadBtn.href = URL.createObjectURL(blob);
        docDownloadBtn.download = filename;
    };

    docExecuteConvertBtn.addEventListener('click', executeDocumentConversion);

    docCopyBtn.addEventListener('click', async () => {
        if (!docOutputText.value) return;
        await navigator.clipboard.writeText(docOutputText.value);
        showToast("Copied converted result to clipboard!", "success");
    });

    // -------------------------------------------------------------
    // TAB 4: PDF Studio
    // -------------------------------------------------------------
    const pdfDropzone = document.getElementById('pdfDropzone');
    const pdfFileInput = document.getElementById('pdfFileInput');
    const pdfPageGrid = document.getElementById('pdfPageGrid');
    const pdfPageCount = document.getElementById('pdfPageCount');
    const pdfClearPagesBtn = document.getElementById('pdfClearPagesBtn');
    const pdfGenerateBtn = document.getElementById('pdfGenerateBtn');
    const pdfResultBanner = document.getElementById('pdfResultBanner');
    const pdfDownloadLink = document.getElementById('pdfDownloadLink');

    const renderPdfThumbnails = () => {
        pdfPageGrid.innerHTML = '';
        pdfPageCount.textContent = state.pdfPages.length;

        state.pdfPages.forEach((file, index) => {
            const card = document.createElement('div');
            card.className = 'relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 aspect-[3/4] flex items-center justify-center';

            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.className = 'w-full h-full object-cover';

            const badge = document.createElement('div');
            badge.className = 'absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-slate-900/80 text-white font-bold text-[10px]';
            badge.textContent = `P. ${index + 1}`;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'absolute top-1.5 right-1.5 p-1 rounded-md bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition';
            removeBtn.innerHTML = '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i>';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                state.pdfPages.splice(index, 1);
                renderPdfThumbnails();
            };

            card.appendChild(img);
            card.appendChild(badge);
            card.appendChild(removeBtn);
            pdfPageGrid.appendChild(card);
        });

        if (window.lucide) window.lucide.createIcons();
    };

    setupDropzone(pdfDropzone, pdfFileInput, (files) => {
        state.pdfPages.push(...files);
        renderPdfThumbnails();
        showToast(`Added ${files.length} pages to PDF queue`, "info");
    });

    pdfClearPagesBtn.addEventListener('click', () => {
        state.pdfPages = [];
        renderPdfThumbnails();
        pdfResultBanner.classList.add('hidden');
    });

    pdfGenerateBtn.addEventListener('click', async () => {
        if (state.pdfPages.length === 0) {
            showToast("Please add at least one image page to generate PDF", "warning");
            return;
        }

        const pageSize = document.getElementById('pdfPageSize').value;
        const orientation = document.getElementById('pdfOrientation').value;
        const margin = parseInt(document.getElementById('pdfMargin').value, 10);

        pdfGenerateBtn.disabled = true;
        pdfGenerateBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Compiling PDF...</span>';

        try {
            const res = await PdfConverter.imagesToPdf(state.pdfPages, {
                pageSize,
                orientation,
                margin
            });

            pdfDownloadLink.href = res.dataUrl;
            pdfDownloadLink.download = `omniconvert-document-${Date.now()}.pdf`;
            pdfResultBanner.classList.remove('hidden');

            addToHistory({
                name: `PDF Document (${res.pageCount} pages)`,
                from: 'IMAGES',
                to: 'PDF',
                size: formatBytes(res.size)
            });

            showToast("PDF document generated successfully!", "success");
        } catch (err) {
            showToast(`PDF generation error: ${err.message}`, "error");
        } finally {
            pdfGenerateBtn.disabled = false;
            pdfGenerateBtn.innerHTML = '<i data-lucide="file-check" class="w-4 h-4"></i><span>Generate PDF</span>';
            if (window.lucide) window.lucide.createIcons();
        }
    });

    // -------------------------------------------------------------
    // TAB 5: Audio & Video Extractor
    // -------------------------------------------------------------
    const audioDropzone = document.getElementById('audioDropzone');
    const audioFileInput = document.getElementById('audioFileInput');
    const audioWorkspace = document.getElementById('audioWorkspace');
    const audioFileName = document.getElementById('audioFileName');
    const audioFileMeta = document.getElementById('audioFileMeta');
    const audioNativePlayer = document.getElementById('audioNativePlayer');
    const audioTargetFormat = document.getElementById('audioTargetFormat');
    const audioGainInput = document.getElementById('audioGainInput');
    const audioGainLabel = document.getElementById('audioGainLabel');
    const audioConvertExecuteBtn = document.getElementById('audioConvertExecuteBtn');
    const audioOutputCard = document.getElementById('audioOutputCard');
    const audioDownloadBtn = document.getElementById('audioDownloadBtn');
    const audioOutputSize = document.getElementById('audioOutputSize');
    const audioClearBtn = document.getElementById('audioClearBtn');

    audioGainInput.addEventListener('input', (e) => {
        audioGainLabel.textContent = `${e.target.value}%`;
    });

    const handleAudioFile = (files) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        state.audioFile = file;

        audioFileName.textContent = file.name;
        audioFileMeta.textContent = `Size: ${formatBytes(file.size)} • Type: ${file.type || 'Media'}`;

        const url = URL.createObjectURL(file);
        audioNativePlayer.src = url;

        audioWorkspace.classList.remove('hidden');
        audioOutputCard.classList.add('hidden');
        audioWorkspace.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    setupDropzone(audioDropzone, audioFileInput, handleAudioFile);

    audioClearBtn.addEventListener('click', () => {
        state.audioFile = null;
        audioWorkspace.classList.add('hidden');
    });

    audioConvertExecuteBtn.addEventListener('click', async () => {
        if (!state.audioFile) return;

        const target = audioTargetFormat.value;
        const gain = parseInt(audioGainInput.value, 10) / 100;

        audioConvertExecuteBtn.disabled = true;
        audioConvertExecuteBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Decoding & Encoding...</span>';

        try {
            const res = await AudioConverter.convertMedia(state.audioFile, target, { gain });
            state.audioResult = res;

            audioDownloadBtn.href = res.dataUrl;
            const base = state.audioFile.name.substring(0, state.audioFile.name.lastIndexOf('.')) || state.audioFile.name;
            audioDownloadBtn.download = `${base}.${res.format}`;
            audioOutputSize.textContent = `(${formatBytes(res.size)})`;

            audioOutputCard.classList.remove('hidden');

            addToHistory({
                name: state.audioFile.name,
                from: 'MEDIA',
                to: res.format.toUpperCase(),
                size: formatBytes(res.size)
            });

            showToast("Audio converted successfully!", "success");
        } catch (err) {
            showToast(`Audio conversion failed: ${err.message}`, "error");
        } finally {
            audioConvertExecuteBtn.disabled = false;
            audioConvertExecuteBtn.innerHTML = '<i data-lucide="sparkles" class="w-4 h-4"></i><span>Process & Convert</span>';
            if (window.lucide) window.lucide.createIcons();
        }
    });

    // -------------------------------------------------------------
    // TAB 6: Developer Tools (Base64 & Hash)
    // -------------------------------------------------------------
    const toolDropzone = document.getElementById('toolDropzone');
    const toolFileInput = document.getElementById('toolFileInput');
    const toolDataUriOutput = document.getElementById('toolDataUriOutput');
    const toolRawBase64Output = document.getElementById('toolRawBase64Output');
    const toolSha256Output = document.getElementById('toolSha256Output');
    const toolSha512Output = document.getElementById('toolSha512Output');
    const toolSha1Output = document.getElementById('toolSha1Output');
    const toolBase64Input = document.getElementById('toolBase64Input');
    const toolBase64DecodeBtn = document.getElementById('toolBase64DecodeBtn');

    setupDropzone(toolDropzone, toolFileInput, async (files) => {
        if (!files || files.length === 0) return;
        const file = files[0];

        try {
            const b64 = await EncodingConverter.fileToBase64(file);
            toolDataUriOutput.value = b64.dataUrl;
            toolRawBase64Output.value = b64.base64;

            const hashes = await EncodingConverter.computeAllHashes(file);
            toolSha256Output.value = hashes.sha256;
            toolSha512Output.value = hashes.sha512;
            toolSha1Output.value = hashes.sha1;

            showToast(`Computed Base64 & hashes for ${file.name}`, "success");
        } catch (err) {
            showToast(err.message, "error");
        }
    });

    const copyInputVal = async (inputEl) => {
        if (!inputEl.value) return;
        await navigator.clipboard.writeText(inputEl.value);
        showToast("Copied to clipboard!", "success");
    };

    document.getElementById('toolCopyDataUri').addEventListener('click', () => copyInputVal(toolDataUriOutput));
    document.getElementById('toolCopyRawBase64').addEventListener('click', () => copyInputVal(toolRawBase64Output));
    document.getElementById('toolCopySha256').addEventListener('click', () => copyInputVal(toolSha256Output));
    document.getElementById('toolCopySha512').addEventListener('click', () => copyInputVal(toolSha512Output));
    document.getElementById('toolCopySha1').addEventListener('click', () => copyInputVal(toolSha1Output));

    toolBase64DecodeBtn.addEventListener('click', () => {
        const val = toolBase64Input.value.trim();
        if (!val) {
            showToast("Please paste a Base64 string", "warning");
            return;
        }
        try {
            const res = EncodingConverter.base64ToFile(val, 'decoded-file');
            const link = document.createElement('a');
            link.href = res.dataUrl;
            link.download = res.filename;
            link.click();
            showToast(`Downloaded decoded file (${formatBytes(res.size)})`, "success");
        } catch (err) {
            showToast("Invalid Base64 string", "error");
        }
    });

    // -------------------------------------------------------------
    // TAB 7: Batch Converter & ZIP
    // -------------------------------------------------------------
    const batchDropzone = document.getElementById('batchDropzone');
    const batchFileInput = document.getElementById('batchFileInput');
    const batchWorkspace = document.getElementById('batchWorkspace');
    const batchCount = document.getElementById('batchCount');
    const batchTargetFormat = document.getElementById('batchTargetFormat');
    const batchStartBtn = document.getElementById('batchStartBtn');
    const batchProgressWrapper = document.getElementById('batchProgressWrapper');
    const batchProgressBar = document.getElementById('batchProgressBar');
    const batchProgressPercent = document.getElementById('batchProgressPercent');
    const batchTableBody = document.getElementById('batchTableBody');
    const batchZipRow = document.getElementById('batchZipRow');
    const batchDownloadZipBtn = document.getElementById('batchDownloadZipBtn');

    const populateBatchWorkspace = (files) => {
        state.batchFiles = files;
        batchCount.textContent = files.length;
        batchTableBody.innerHTML = '';
        batchZipRow.classList.add('hidden');
        batchProgressWrapper.classList.add('hidden');

        files.forEach((file) => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-900/40';
            tr.innerHTML = `
                <td class="px-4 py-3 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px]">${file.name}</td>
                <td class="px-4 py-3 text-slate-500">${formatBytes(file.size)}</td>
                <td class="px-4 py-3 text-slate-400">--</td>
                <td class="px-4 py-3 text-slate-400">--</td>
                <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold">Pending</span></td>
            `;
            batchTableBody.appendChild(tr);
        });

        batchWorkspace.classList.remove('hidden');
        batchWorkspace.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    setupDropzone(batchDropzone, batchFileInput, (files) => {
        populateBatchWorkspace(files);
        showToast(`Loaded ${files.length} files into batch queue!`, "info");
    });

    batchStartBtn.addEventListener('click', async () => {
        if (!state.batchFiles || state.batchFiles.length === 0) return;

        const targetFormat = batchTargetFormat.value;
        const processor = new BatchProcessor();

        batchStartBtn.disabled = true;
        batchProgressWrapper.classList.remove('hidden');
        batchZipRow.classList.add('hidden');

        const results = await processor.processImages(state.batchFiles, { format: targetFormat }, (progress) => {
            batchProgressBar.style.width = `${progress.percentage}%`;
            batchProgressPercent.textContent = `${progress.percentage}%`;

            const row = batchTableBody.children[progress.current - 1];
            if (row && progress.latest) {
                const item = progress.latest;
                if (item.success) {
                    const savingsStr = item.savings > 0 ? `-${item.savings}%` : `+${Math.abs(item.savings)}%`;
                    row.children[2].textContent = formatBytes(item.newSize);
                    row.children[3].textContent = savingsStr;
                    row.children[4].innerHTML = '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 font-bold text-[10px]">Done</span>';
                } else {
                    row.children[4].innerHTML = '<span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px]">Failed</span>';
                }
            }
        });

        state.batchResults = results;
        batchStartBtn.disabled = false;
        batchZipRow.classList.remove('hidden');
        showToast("Batch conversion completed!", "success");
    });

    batchDownloadZipBtn.addEventListener('click', async () => {
        if (!state.batchResults || state.batchResults.length === 0) return;

        batchDownloadZipBtn.disabled = true;
        batchDownloadZipBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Zipping files...</span>';

        try {
            const zipRes = await BatchProcessor.createZip(state.batchResults);
            const a = document.createElement('a');
            a.href = zipRes.dataUrl;
            a.download = `omniconvert-batch-${Date.now()}.zip`;
            a.click();
            showToast("Downloaded ZIP package!", "success");
        } catch (err) {
            showToast(`ZIP packaging failed: ${err.message}`, "error");
        } finally {
            batchDownloadZipBtn.disabled = false;
            batchDownloadZipBtn.innerHTML = '<i data-lucide="archive" class="w-4 h-4"></i><span>Download All as ZIP</span>';
            if (window.lucide) window.lucide.createIcons();
        }
    });

    // -------------------------------------------------------------
    // History Drawer Modal
    // -------------------------------------------------------------
    const historyModal = document.getElementById('historyModal');
    const historyModalBtn = document.getElementById('historyModalBtn');
    const closeHistoryBtn = document.getElementById('closeHistoryBtn');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const historyListContainer = document.getElementById('historyListContainer');

    const renderHistoryModal = () => {
        historyListContainer.innerHTML = '';
        if (state.history.length === 0) {
            historyListContainer.innerHTML = '<div class="py-10 text-center text-slate-400">No conversions recorded yet.</div>';
            return;
        }

        state.history.forEach(item => {
            const div = document.createElement('div');
            div.className = 'py-2.5 flex items-center justify-between';
            div.innerHTML = `
                <div class="flex items-center space-x-3">
                    <span class="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-brand-600 dark:text-brand-400">${item.to}</span>
                    <span class="font-medium text-slate-700 dark:text-slate-200 truncate max-w-xs">${item.name}</span>
                </div>
                <div class="flex items-center space-x-3 text-slate-400">
                    <span>${item.size}</span>
                    <span>•</span>
                    <span>${item.date}</span>
                </div>
            `;
            historyListContainer.appendChild(div);
        });
    };

    historyModalBtn.addEventListener('click', () => {
        renderHistoryModal();
        historyModal.classList.remove('hidden');
    });

    closeHistoryBtn.addEventListener('click', () => historyModal.classList.add('hidden'));
    historyModal.addEventListener('click', (e) => {
        if (e.target === historyModal) historyModal.classList.add('hidden');
    });

    clearHistoryBtn.addEventListener('click', () => {
        state.history = [];
        localStorage.removeItem('omniconvert_history');
        renderHistoryModal();
        updateHistoryBadge();
        showToast("Cleared history log", "info");
    });
});
