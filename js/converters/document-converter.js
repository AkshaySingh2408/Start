/**
 * OmniConvert - Document & Data Converter Engine
 * Converts between JSON, CSV, TSV, XML, YAML, Markdown, HTML, and Plain Text
 * Supports bidirectional conversions, code formatting, and table transformations.
 */

class DocumentConverter {
    /**
     * CSV/TSV to Array of Objects or 2D Array
     */
    static parseCsv(csvText, delimiter = ',') {
        const rows = [];
        let currentRow = [];
        let currentCell = '';
        let inQuotes = false;

        // Auto-detect delimiter if comma or tab
        if (delimiter === 'auto') {
            const firstLine = csvText.split('\n')[0] || '';
            const commas = (firstLine.match(/,/g) || []).length;
            const tabs = (firstLine.match(/\t/g) || []).length;
            const semicolons = (firstLine.match(/;/g) || []).length;
            if (tabs > commas && tabs > semicolons) delimiter = '\t';
            else if (semicolons > commas && semicolons > tabs) delimiter = ';';
            else delimiter = ',';
        }

        for (let i = 0; i < csvText.length; i++) {
            const char = csvText[i];
            const nextChar = csvText[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    currentCell += '"';
                    i++; // skip escaped quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === delimiter && !inQuotes) {
                currentRow.push(currentCell.trim());
                currentCell = '';
            } else if ((char === '\r' || char === '\n') && !inQuotes) {
                if (char === '\r' && nextChar === '\n') i++;
                currentRow.push(currentCell.trim());
                if (currentRow.length > 0 && currentRow.some(c => c !== '')) {
                    rows.push(currentRow);
                }
                currentRow = [];
                currentCell = '';
            } else {
                currentCell += char;
            }
        }
        if (currentCell.length > 0 || currentRow.length > 0) {
            currentRow.push(currentCell.trim());
            if (currentRow.some(c => c !== '')) rows.push(currentRow);
        }

        if (rows.length < 2) return rows;

        // Convert to objects using first row as headers
        const headers = rows[0].map(h => h.replace(/^["']|["']$/g, ''));
        const result = [];
        for (let r = 1; r < rows.length; r++) {
            const obj = {};
            for (let c = 0; c < headers.length; c++) {
                let val = rows[r][c] !== undefined ? rows[r][c] : '';
                // Try number conversion
                if (val !== '' && !isNaN(val)) val = Number(val);
                else if (val.toLowerCase() === 'true') val = true;
                else if (val.toLowerCase() === 'false') val = false;
                obj[headers[c]] = val;
            }
            result.push(obj);
        }
        return result;
    }

    /**
     * JSON to CSV
     */
    static jsonToCsv(jsonData, delimiter = ',') {
        let arr = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
        if (!Array.isArray(arr)) {
            arr = [arr];
        }
        if (arr.length === 0) return '';

        // Extract all unique keys across all objects
        const keysSet = new Set();
        arr.forEach(item => {
            if (typeof item === 'object' && item !== null) {
                Object.keys(item).forEach(k => keysSet.add(k));
            }
        });
        const headers = Array.from(keysSet);

        const escapeCell = (val) => {
            if (val === null || val === undefined) return '';
            if (typeof val === 'object') val = JSON.stringify(val);
            const str = String(val);
            if (str.includes(delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const lines = [headers.map(escapeCell).join(delimiter)];
        arr.forEach(item => {
            const row = headers.map(h => escapeCell(item[h]));
            lines.push(row.join(delimiter));
        });

        return lines.join('\n');
    }

    /**
     * JSON to XML
     */
    static jsonToXml(jsonData, rootName = 'root') {
        let obj = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

        const buildXml = (data, indent = 1) => {
            const spaces = '  '.repeat(indent);
            if (data === null || data === undefined) return '';
            if (typeof data !== 'object') {
                return String(data)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
            }

            if (Array.isArray(data)) {
                return data.map(item => `${spaces}<item>\n${buildXml(item, indent + 1)}\n${spaces}</item>`).join('\n');
            }

            const entries = Object.entries(data);
            return entries.map(([key, val]) => {
                const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
                if (typeof val === 'object' && val !== null) {
                    return `${spaces}<${safeKey}>\n${buildXml(val, indent + 1)}\n${spaces}</${safeKey}>`;
                }
                const safeVal = String(val)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                return `${spaces}<${safeKey}>${safeVal}</${safeKey}>`;
            }).join('\n');
        };

        return `<?xml version="1.0" encoding="UTF-8"?>\n<${rootName}>\n${buildXml(obj)}\n</${rootName}>`;
    }

    /**
     * XML to JSON (browser DOMParser)
     */
    static xmlToJson(xmlString) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "application/xml");
        const parserError = xmlDoc.querySelector("parsererror");
        if (parserError) {
            throw new Error("Invalid XML: " + parserError.textContent);
        }

        const nodeToObj = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.trim();
                return text.length > 0 ? text : null;
            }

            const obj = {};
            if (node.hasAttributes()) {
                obj['@attributes'] = {};
                for (let i = 0; i < node.attributes.length; i++) {
                    const attr = node.attributes[i];
                    obj['@attributes'][attr.name] = attr.value;
                }
            }

            let textContent = '';
            let hasChildElements = false;

            for (let i = 0; i < node.childNodes.length; i++) {
                const child = node.childNodes[i];
                if (child.nodeType === Node.ELEMENT_NODE) {
                    hasChildElements = true;
                    const childObj = nodeToObj(child);
                    if (obj[child.nodeName]) {
                        if (!Array.isArray(obj[child.nodeName])) {
                            obj[child.nodeName] = [obj[child.nodeName]];
                        }
                        obj[child.nodeName].push(childObj);
                    } else {
                        obj[child.nodeName] = childObj;
                    }
                } else if (child.nodeType === Node.TEXT_NODE) {
                    textContent += child.textContent.trim();
                }
            }

            if (!hasChildElements) {
                if (Object.keys(obj).length === 0) {
                    return textContent;
                }
                if (textContent) {
                    obj['#text'] = textContent;
                }
            }
            return obj;
        };

        return nodeToObj(xmlDoc.documentElement);
    }

    /**
     * JSON to YAML (lightweight pure JS generator)
     */
    static jsonToYaml(jsonData) {
        let obj = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

        const stringify = (val, indent = 0) => {
            const prefix = '  '.repeat(indent);
            if (val === null || val === undefined) return 'null';
            if (typeof val === 'number' || typeof val === 'boolean') return String(val);
            if (typeof val === 'string') {
                if (val.includes('\n') || val.includes(':') || val.includes('#') || val.startsWith('{') || val.startsWith('[')) {
                    return JSON.stringify(val);
                }
                return val;
            }
            if (Array.isArray(val)) {
                if (val.length === 0) return '[]';
                return '\n' + val.map(item => {
                    if (typeof item === 'object' && item !== null) {
                        const inner = stringify(item, indent + 1).replace(/^\s+/, '');
                        return `${prefix}- ${inner}`;
                    }
                    return `${prefix}- ${stringify(item, indent + 1)}`;
                }).join('\n');
            }
            if (typeof val === 'object') {
                const keys = Object.keys(val);
                if (keys.length === 0) return '{}';
                return '\n' + keys.map(k => {
                    const v = val[k];
                    if (typeof v === 'object' && v !== null) {
                        return `${prefix}${k}:${stringify(v, indent + 1)}`;
                    }
                    return `${prefix}${k}: ${stringify(v, indent + 1)}`;
                }).join('\n');
            }
            return String(val);
        };

        return stringify(obj).trim();
    }

    /**
     * Simple YAML to JSON parser
     */
    static yamlToJson(yamlString) {
        // If js-yaml is present on window, use it
        if (window.jsyaml && window.jsyaml.load) {
            return window.jsyaml.load(yamlString);
        }
        // Basic fallback parser for simple key-value / lists
        const lines = yamlString.split('\n');
        const root = {};
        let currentObj = root;
        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const colonIdx = trimmed.indexOf(':');
            if (colonIdx > 0) {
                const key = trimmed.slice(0, colonIdx).trim();
                let val = trimmed.slice(colonIdx + 1).trim();
                if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
                else if (val.toLowerCase() === 'true') val = true;
                else if (val.toLowerCase() === 'false') val = false;
                else if (!isNaN(val) && val !== '') val = Number(val);
                root[key] = val;
            }
        });
        return root;
    }

    /**
     * Markdown to HTML converter (pure JS with support for headings, bold, italics, code, tables, links, quotes)
     */
    static markdownToHtml(md) {
        let html = md
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Code blocks
        html = html.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre class="bg-gray-900 text-gray-100 p-4 rounded-xl overflow-x-auto my-4 text-sm font-mono"><code class="language-${lang}">${code.trim()}</code></pre>`;
        });

        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code class="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-mono text-sm">$1</code>');

        // Headers
        html = html.replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold mt-4 mb-2">$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-6 mb-3 border-b border-gray-200 dark:border-gray-800 pb-1">$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1 class="text-3xl font-extrabold mt-8 mb-4 border-b-2 border-indigo-500 pb-2">$1</h1>');

        // Blockquotes
        html = html.replace(/^\> (.*$)/gim, '<blockquote class="border-l-4 border-indigo-500 pl-4 py-1 italic my-2 text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/40 rounded-r">$1</blockquote>');

        // Bold & Italic
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
        html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

        // Links and Images
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full rounded-lg shadow-md my-4"/>');
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-800">$1</a>');

        // Markdown Tables
        html = html.replace(/((?:\|[^\n]+\|\r?\n)+)/g, (tableText) => {
            const rows = tableText.trim().split('\n').map(r => r.trim()).filter(Boolean);
            if (rows.length < 2) return tableText;
            const headerCells = rows[0].split('|').slice(1, -1).map(c => `<th class="border border-gray-300 dark:border-gray-700 px-4 py-2 bg-gray-100 dark:bg-gray-800 font-semibold">${c.trim()}</th>`).join('');
            const bodyRows = rows.slice(2).map(row => {
                const cells = row.split('|').slice(1, -1).map(c => `<td class="border border-gray-300 dark:border-gray-700 px-4 py-2">${c.trim()}</td>`).join('');
                return `<tr>${cells}</tr>`;
            }).join('');
            return `<div class="overflow-x-auto my-4"><table class="table-auto border-collapse border border-gray-300 dark:border-gray-700 w-full text-left text-sm"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;
        });

        // Lists
        html = html.replace(/^\s*-\s+(.*$)/gim, '<li class="ml-6 list-disc">$1</li>');
        html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<li class="ml-6 list-decimal">$1</li>');

        // Paragraphs
        const paragraphs = html.split(/\n{2,}/);
        html = paragraphs.map(p => {
            p = p.trim();
            if (p.startsWith('<h') || p.startsWith('<pre') || p.startsWith('<blockquote') || p.startsWith('<div') || p.startsWith('<li')) {
                return p;
            }
            return `<p class="my-2 leading-relaxed">${p.replace(/\n/g, '<br/>')}</p>`;
        }).join('\n');

        return html;
    }

    /**
     * HTML to Markdown converter
     */
    static htmlToMarkdown(html) {
        const div = document.createElement('div');
        div.innerHTML = html;

        const traverse = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                return node.textContent;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return '';

            const tag = node.tagName.toLowerCase();
            const children = Array.from(node.childNodes).map(traverse).join('');

            switch (tag) {
                case 'h1': return `\n# ${children.trim()}\n\n`;
                case 'h2': return `\n## ${children.trim()}\n\n`;
                case 'h3': return `\n### ${children.trim()}\n\n`;
                case 'h4': return `\n#### ${children.trim()}\n\n`;
                case 'p': return `\n${children.trim()}\n\n`;
                case 'strong':
                case 'b': return `**${children}**`;
                case 'em':
                case 'i': return `*${children}*`;
                case 'code': return `\`${children}\``;
                case 'pre': return `\n\`\`\`\n${children.trim()}\n\`\`\`\n\n`;
                case 'blockquote': return `\n> ${children.trim()}\n\n`;
                case 'a': return `[${children}](${node.getAttribute('href') || ''})`;
                case 'img': return `![${node.getAttribute('alt') || 'image'}](${node.getAttribute('src') || ''})`;
                case 'li': return `- ${children.trim()}\n`;
                case 'ul':
                case 'ol': return `\n${children}\n`;
                case 'br': return '\n';
                case 'table': {
                    const rows = Array.from(node.querySelectorAll('tr'));
                    if (rows.length === 0) return '';
                    let mdTable = '\n';
                    rows.forEach((row, idx) => {
                        const cells = Array.from(row.querySelectorAll('th, td')).map(c => c.textContent.trim().replace(/\|/g, '\\|'));
                        mdTable += `| ${cells.join(' | ')} |\n`;
                        if (idx === 0) {
                            mdTable += `| ${cells.map(() => '---').join(' | ')} |\n`;
                        }
                    });
                    return mdTable + '\n';
                }
                default: return children;
            }
        };

        return traverse(div).trim().replace(/\n{3,}/g, '\n\n');
    }

    /**
     * CSV/JSON to Markdown Table
     */
    static toMarkdownTable(data) {
        let arr = data;
        if (typeof data === 'string') {
            try {
                arr = JSON.parse(data);
            } catch {
                arr = this.parseCsv(data);
            }
        }
        if (!Array.isArray(arr) || arr.length === 0) return '';

        const headers = Object.keys(arr[0]);
        let md = `| ${headers.join(' | ')} |\n`;
        md += `| ${headers.map(() => '---').join(' | ')} |\n`;

        arr.forEach(row => {
            const vals = headers.map(h => String(row[h] !== undefined ? row[h] : '').replace(/\|/g, '\\|'));
            md += `| ${vals.join(' | ')} |\n`;
        });
        return md;
    }

    /**
     * CSV/JSON to HTML Table
     */
    static toHtmlTable(data) {
        let arr = data;
        if (typeof data === 'string') {
            try {
                arr = JSON.parse(data);
            } catch {
                arr = this.parseCsv(data);
            }
        }
        if (!Array.isArray(arr) || arr.length === 0) return '';

        const headers = Object.keys(arr[0]);
        let html = '<table class="table-auto border-collapse border border-gray-300 w-full text-left">\n  <thead>\n    <tr class="bg-gray-100">\n';
        headers.forEach(h => {
            html += `      <th class="border border-gray-300 px-4 py-2 font-bold">${h}</th>\n`;
        });
        html += '    </tr>\n  </thead>\n  <tbody>\n';

        arr.forEach(row => {
            html += '    <tr>\n';
            headers.forEach(h => {
                html += `      <td class="border border-gray-300 px-4 py-2">${row[h] !== undefined ? row[h] : ''}</td>\n`;
            });
            html += '    </tr>\n';
        });
        html += '  </tbody>\n</table>';
        return html;
    }
}

window.DocumentConverter = DocumentConverter;
