/**
 * OmniConvert - Encoding & Developer Tools Engine
 * Base64 conversions, Cryptographic checksums (SHA-256/512/1), Text transforms, and QR generation
 */

class EncodingConverter {
    /**
     * Convert any file to Base64 formats
     * @param {File|Blob} file 
     * @returns {Promise<{dataUrl: string, base64: string, css: string, html: string, mimeType: string}>}
     */
    static fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = reader.result;
                const base64 = dataUrl.split(',')[1] || '';
                const mimeType = file.type || 'application/octet-stream';

                resolve({
                    dataUrl,
                    base64,
                    css: `background-image: url('${dataUrl}');`,
                    html: `<img src="${dataUrl}" alt="${file.name || 'embedded image'}" />`,
                    mimeType
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Convert Base64 string back into a File Blob
     */
    static base64ToFile(base64String, filename = 'converted-file') {
        let cleanStr = base64String.trim();
        let mimeType = 'application/octet-stream';

        if (cleanStr.startsWith('data:')) {
            const matches = cleanStr.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
            if (matches) {
                mimeType = matches[1];
                cleanStr = cleanStr.slice(matches[0].length);
            }
        }

        const byteCharacters = atob(cleanStr);
        const byteArrays = [];

        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }
            byteArrays.push(new Uint8Array(byteNumbers));
        }

        const blob = new Blob(byteArrays, { type: mimeType });
        let ext = mimeType.split('/')[1] || 'bin';
        if (ext === 'jpeg') ext = 'jpg';
        if (!filename.includes('.')) filename += `.${ext}`;

        return {
            blob,
            filename,
            mimeType,
            size: blob.size,
            dataUrl: URL.createObjectURL(blob)
        };
    }

    /**
     * Calculate file hash using native Web Crypto API
     * @param {File|Blob} file 
     * @param {'SHA-256'|'SHA-512'|'SHA-384'|'SHA-1'} algorithm 
     */
    static async computeHash(file, algorithm = 'SHA-256') {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest(algorithm, buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hex;
    }

    /**
     * Compute all standard hashes at once
     */
    static async computeAllHashes(file) {
        const buffer = await file.arrayBuffer();
        const [sha256Buf, sha512Buf, sha1Buf] = await Promise.all([
            crypto.subtle.digest('SHA-256', buffer),
            crypto.subtle.digest('SHA-512', buffer),
            crypto.subtle.digest('SHA-1', buffer)
        ]);

        const toHex = (buf) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');

        return {
            sha256: toHex(sha256Buf),
            sha512: toHex(sha512Buf),
            sha1: toHex(sha1Buf),
            size: file.size
        };
    }

    /**
     * Convert text casing
     */
    static convertCase(text, format) {
        switch (format) {
            case 'upper':
                return text.toUpperCase();
            case 'lower':
                return text.toLowerCase();
            case 'title':
                return text.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase());
            case 'camel':
                return text.toLowerCase()
                    .replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase())
                    .replace(/^[A-Z]/, c => c.toLowerCase());
            case 'pascal':
                return text.toLowerCase()
                    .replace(/(?:^|[^a-zA-Z0-9]+)(.)/g, (m, chr) => chr.toUpperCase());
            case 'snake':
                return text
                    .replace(/([a-z])([A-Z])/g, "$1_$2")
                    .replace(/[\s\W-]+/g, "_")
                    .toLowerCase();
            case 'kebab':
                return text
                    .replace(/([a-z])([A-Z])/g, "$1-$2")
                    .replace(/[\s\W_]+/g, "-")
                    .toLowerCase();
            default:
                return text;
        }
    }
}

window.EncodingConverter = EncodingConverter;
