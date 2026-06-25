/**
 * Mediabibliotheek: indexeert site-afbeeldingen, uploads en referenties in content.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif']);

function isImageFile(name) {
    return IMAGE_EXT.has(path.extname(name || '').toLowerCase());
}

function readImageDimensions(filePath) {
    try {
        const buf = fs.readFileSync(filePath);
        if (buf.length < 24) return null;
        // PNG
        if (buf[0] === 0x89 && buf[1] === 0x50) {
            return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
        }
        // JPEG
        if (buf[0] === 0xff && buf[1] === 0xd8) {
            let i = 2;
            while (i < buf.length - 8) {
                if (buf[i] !== 0xff) { i++; continue; }
                const marker = buf[i + 1];
                if (marker === 0xc0 || marker === 0xc2) {
                    return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
                }
                const len = buf.readUInt16BE(i + 2);
                if (len < 2) break;
                i += 2 + len;
            }
        }
        // GIF
        if (buf.toString('ascii', 0, 3) === 'GIF') {
            return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
        }
        // WebP (RIFF)
        if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
            const chunk = buf.toString('ascii', 12, 16);
            if (chunk === 'VP8 ') {
                return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
            }
            if (chunk === 'VP8L') {
                const bits = buf.readUInt32LE(21);
                return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
            }
        }
    } catch (e) { /* ignore */ }
    return null;
}

function normalizeUrl(url) {
    let u = String(url || '').trim();
    if (!u || /^data:/i.test(u) || /^https?:\/\//i.test(u)) return u || '';
    if (u.startsWith('//')) return u;
    if (!u.startsWith('/')) u = '/' + u;
    return u.replace(/\/+/g, '/');
}

function urlToId(url) {
    return normalizeUrl(url).replace(/^\//, '').replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function scanDir(dir, source, urlPrefix) {
    const items = [];
    if (!dir || !fs.existsSync(dir)) return items;
    try {
        for (const name of fs.readdirSync(dir)) {
            if (name.startsWith('.')) continue;
            const full = path.join(dir, name);
            let st;
            try { st = fs.statSync(full); } catch (e) { continue; }
            if (!st.isFile() || !isImageFile(name)) continue;
            const url = urlPrefix + name;
            const dims = readImageDimensions(full);
            items.push({
                id: urlToId(url),
                filename: name,
                url,
                alt: '',
                source,
                size: st.size,
                mtime: st.mtimeMs,
                width: dims ? dims.width : null,
                height: dims ? dims.height : null
            });
        }
    } catch (e) {
        console.error('Media scan mislukt (' + dir + '):', e.message);
    }
    return items;
}

function extractFromHtml(html, altsByUrl) {
    const found = new Set();
    const re = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let m;
    while ((m = re.exec(String(html || ''))) !== null) {
        const raw = m[0];
        const src = normalizeUrl(m[1]);
        if (!src || /^https?:\/\//i.test(src) || src.startsWith('data:')) continue;
        found.add(src);
        const altM = raw.match(/\balt\s*=\s*["']([^"']*)["']/i);
        if (altM && altM[1]) altsByUrl.set(src, altM[1]);
    }
    const bgRe = /url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
    while ((m = bgRe.exec(String(html || ''))) !== null) {
        const src = normalizeUrl(m[1]);
        if (!src || /^https?:\/\//i.test(src) || src.startsWith('data:')) continue;
        if (isImageFile(src)) found.add(src);
    }
    return found;
}

function extractReferencedUrls(files) {
    const urls = new Set();
    const altsByUrl = new Map();
    for (const { content } of files) {
        if (!content) continue;
        extractFromHtml(content, altsByUrl).forEach(u => urls.add(u));
        if (typeof content === 'object') {
            JSON.stringify(content).replace(/\/(?:images|uploads)\/[^"'\s\\]+/g, (match) => {
                urls.add(normalizeUrl(match));
            });
        }
    }
    return { urls, altsByUrl };
}

function mergeItems(lists) {
    const byUrl = new Map();
    for (const list of lists) {
        for (const item of list) {
            const url = normalizeUrl(item.url);
            if (!url) continue;
            const prev = byUrl.get(url);
            if (!prev) {
                byUrl.set(url, { ...item, url });
            } else {
                byUrl.set(url, {
                    ...prev,
                    ...item,
                    alt: item.alt || prev.alt,
                    source: prev.source === item.source ? prev.source : (prev.source || item.source),
                    size: item.size != null ? item.size : prev.size,
                    width: item.width != null ? item.width : prev.width,
                    height: item.height != null ? item.height : prev.height
                });
            }
        }
    }
    return Array.from(byUrl.values()).sort((a, b) => {
        const sa = a.source === 'upload' ? 0 : a.source === 'site' ? 1 : 2;
        const sb = b.source === 'upload' ? 0 : b.source === 'site' ? 1 : 2;
        if (sa !== sb) return sa - sb;
        return (b.mtime || 0) - (a.mtime || 0);
    });
}

/**
 * @param {Object} opts
 * @param {string} opts.root - project root
 * @param {string} [opts.uploadDir] - uploads directory (kan /tmp zijn op serverless)
 * @param {Array<{content:string|object}>} [opts.contentFiles]
 */
function indexMedia(opts) {
    const o = opts || {};
    const root = o.root || path.join(__dirname, '..');
    const imagesDir = path.join(root, 'public', 'images');
    const uploadDir = o.uploadDir || path.join(root, 'public', 'uploads');

    const siteItems = scanDir(imagesDir, 'site', '/images/');
    const uploadItems = scanDir(uploadDir, 'upload', '/uploads/');

    const { urls, altsByUrl } = extractReferencedUrls(o.contentFiles || []);

    const referencedItems = [];
    for (const url of urls) {
        if (!/\/(images|uploads)\//i.test(url) && !url.startsWith('/images/') && !url.startsWith('/uploads/')) continue;
        const filename = path.basename(url);
        if (!isImageFile(filename)) continue;
        const localPath = url.startsWith('/uploads/')
            ? path.join(uploadDir, filename)
            : path.join(imagesDir, filename);
        let size = null;
        let mtime = null;
        let dims = null;
        if (fs.existsSync(localPath)) {
            try {
                const st = fs.statSync(localPath);
                size = st.size;
                mtime = st.mtimeMs;
                dims = readImageDimensions(localPath);
            } catch (e) { /* */ }
        }
        referencedItems.push({
            id: urlToId(url),
            filename,
            url,
            alt: altsByUrl.get(url) || '',
            source: url.startsWith('/uploads/') ? 'upload' : (url.startsWith('/images/') ? 'site' : 'referenced'),
            size,
            mtime,
            width: dims ? dims.width : null,
            height: dims ? dims.height : null
        });
    }

    const merged = mergeItems([uploadItems, siteItems, referencedItems]);
    merged.forEach(item => {
        if (!item.id) item.id = urlToId(item.url);
    });
    return merged;
}

function summarizeForAgent(items, limit) {
    const list = (items || []).slice(0, limit || 40);
    if (!list.length) return '(geen afbeeldingen in de mediabibliotheek)';
    return list.map(m => {
        const dim = (m.width && m.height) ? (' (' + m.width + '×' + m.height + ')') : '';
        const alt = m.alt ? ' — alt: "' + m.alt + '"' : '';
        return '- ' + m.url + dim + alt + ' [' + m.source + ']';
    }).join('\n');
}

module.exports = {
    indexMedia,
    summarizeForAgent,
    isImageFile,
    normalizeUrl,
    readImageDimensions
};
