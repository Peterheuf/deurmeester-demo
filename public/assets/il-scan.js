/**
 * DeurMeester CMS - gedeelde scanner (ILScan)
 *
 * Bevat de heuristiek om bewerkbare tekst-, link-, knop- en afbeelding-elementen
 * te vinden en stabiele sleutels toe te kennen. Gedeeld door:
 *   - content-loader.js  (homepage: scant vaste SECTIONS)
 *   - builder.js         (paginamodus: scant chrome-regio's + <main>)
 *   - site-chrome.js     (elke publieke pagina: past chrome-overrides toe)
 *
 * Eén bron van waarheid voor welke elementen bewerkbaar zijn en hoe de sleutels
 * worden toegekend. Sleutels zijn positioneel per regio (bijv. "footer.3"), zodat
 * dezelfde DOM-structuur op homepage en losse pagina's dezelfde sleutel oplevert
 * en een nav-/footer-bewerking overal geldt.
 *
 * Toekomstbestendig: de regels zijn bewust ruim. Nieuwe (AI-)content is meteen
 * bewerkbaar zonder dat hier iets aan hoeft te veranderen.
 */
(function () {
    'use strict';

    const CFG = window.ILSiteConfig || {};

    // LABEL is toegevoegd zodat formulier-labels bewerkbaar zijn.
    const EDITABLE_TAGS = ['H1','H2','H3','H4','H5','H6','P','BLOCKQUOTE','LI','SPAN','A','BUTTON','DIV','STRONG','SMALL','LABEL'];
    const INLINE_TAGS = ['EM','STRONG','I','B','SMALL','BR','SPAN','SVG','IMG'];
    const SKIP_TAGS = ['SCRIPT','STYLE','SVG','PATH','RECT','CIRCLE','TEXT','TEXTPATH','G','DEFS','INPUT','SELECT','OPTION','TEXTAREA','FORM','META','LINK','HEAD','TITLE','NOSCRIPT'];
    const SKIP_CLASSES = CFG.skipClasses || ['marquee-track','hero-corner-tl','hero-corner-tr','hero-corner-bl','hero-corner-br','hero-stamp-ring','chapter-decor','fac-icon','step-num','model-badge'];
    const SKIP_SUBTREES = CFG.skipSubtrees || '.marquee, .hero-stamp, .hero-bg';

    const CHROME_SECTIONS = CFG.chromeSections || [
        { id: 'topstrip', name: 'Top strip', selector: '.topstrip' },
        { id: 'nav',      name: 'Navigatie', selector: 'nav.global' },
        { id: 'footer',   name: 'Footer',    selector: 'footer' }
    ];

    const LOGO_IMG_SELECTOR = CFG.logoSelectors || '.nav-logo img, .footer-logo, .hero-stamp-center';
    const HERO_BG_IMG_SELECTOR = CFG.heroBgSelector || '.hero-bg img';

    function isEditableEl(el) {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
        if (SKIP_TAGS.includes(el.tagName)) return false;
        if (!EDITABLE_TAGS.includes(el.tagName)) return false;
        if (el.closest('.lb-toolbar, .lb-panel, .lb-toast')) return false;
        if (el.closest('svg')) return false;
        if (el.closest(SKIP_SUBTREES)) return false;
        for (const c of SKIP_CLASSES) if (el.classList.contains(c)) return false;
        const text = el.textContent.trim();
        if (text.length === 0 || text.length > 2500) return false;
        const hasBlockChild = Array.from(el.children).some(child => !INLINE_TAGS.includes(child.tagName));
        if (hasBlockChild) return false;
        return true;
    }

    function detectType(el) {
        if (el.tagName === 'IMG') return 'image';
        if (el.tagName === 'A') return 'link';
        if (el.tagName === 'BUTTON') return 'button';
        if (el.classList.contains('nav-cta') || el.classList.contains('cta-button') ||
            el.classList.contains('ruimte-link') || el.classList.contains('btn-next') ||
            el.classList.contains('btn-prev') || el.classList.contains('bw-cta')) return 'button';
        return 'text';
    }

    // Slug uit een menu-link-href (/p/<slug>) halen, voor een stabiele sleutel.
    function menuSlug(el) {
        const href = el.getAttribute('href') || '';
        const parts = href.split(/[?#]/)[0].split('/').filter(Boolean);
        return parts.length ? parts[parts.length - 1] : 'item';
    }

    // Rol van een afbeelding bepalen: logo / hero-achtergrond / gewone content.
    function imageRole(img) {
        try {
            if (img.matches(LOGO_IMG_SELECTOR)) return 'logo';
        } catch (e) {}
        if (img.closest('.hero-bg')) return 'herobg';
        return 'content';
    }

    function isSkippableImage(img) {
        if (img.closest('.lb-toolbar, .lb-panel, .lb-toast')) return true;
        return false;
    }

    // Scant één root-element op bewerkbare tekst + afbeeldingen en kent stabiele
    // sleutels toe. Resultaten worden toegevoegd aan out.editables / out.editablesByKey.
    // Reeds gesleutelde elementen (eerdere pass) worden overgeslagen.
    // opts.region tagt de bestemming ('home' | 'chrome' | 'main').
    function scanRoot(root, keyPrefix, sectionId, sectionName, out, opts) {
        if (!root) return 0;
        opts = opts || {};
        const region = opts.region || 'home';

        // --- Tekst / links / knoppen ---
        const candidates = root.querySelectorAll('*');
        const sectionEditables = [];
        candidates.forEach(el => { if (el.dataset.lbKey === undefined && isEditableEl(el)) sectionEditables.push(el); });
        const filtered = sectionEditables.filter(el => {
            const children = Array.from(el.children).filter(c => sectionEditables.includes(c));
            if (children.length === 0) return true;
            const parentText = el.textContent.trim();
            return !children.some(c => c.textContent.trim() === parentText);
        });
        let pos = 0;
        filtered.forEach(el => {
            let key;
            if (el.classList.contains('il-menu-link')) {
                // Dynamische menu-items: stabiele sleutel op slug, telt NIET mee in de
                // positionele index zodat de vaste nav-elementen hun sleutel houden.
                key = 'menu.' + menuSlug(el);
            } else {
                key = keyPrefix + '.' + (pos++);
            }
            el.dataset.lbKey = key;
            if (el.dataset.lbOriginal === undefined) el.dataset.lbOriginal = el.innerHTML;
            if (el.tagName === 'A' && el.dataset.lbHrefOriginal === undefined) {
                el.dataset.lbHrefOriginal = el.getAttribute('href') || '';
            }
            const entry = { key, el, section: sectionId, sectionName, type: detectType(el), region };
            out.editables.push(entry);
            out.editablesByKey[key] = entry;
        });

        // --- Afbeeldingen ---
        if (opts.images !== false) {
            let imgPos = 0;
            root.querySelectorAll('img').forEach(img => {
                if (img.dataset.lbKey !== undefined) return;
                if (isSkippableImage(img)) return;
                const key = keyPrefix + '.img.' + (imgPos++);
                img.dataset.lbKey = key;
                if (img.dataset.lbImgOriginal === undefined) img.dataset.lbImgOriginal = img.getAttribute('src') || '';
                const entry = { key, el: img, section: sectionId, sectionName, type: 'image', region, imgRole: imageRole(img) };
                out.editables.push(entry);
                out.editablesByKey[key] = entry;
            });
        }

        return filtered.length;
    }

    // Homepage-modus: scan op basis van de vaste SECTIONS (id/selector/name).
    function scanSections(sections) {
        const out = { editables: [], editablesByKey: {}, sections: sections };
        sections.forEach(section => {
            scanRoot(document.querySelector(section.selector), section.id, section.id, section.name, out, { region: 'home' });
        });
        return out;
    }

    // Een leesbare sectienaam afleiden uit eyebrow/kop, anders een nummer.
    function sectionNameFor(sec, n) {
        const h = sec.querySelector('h1,h2,h3');
        const eyebrow = sec.querySelector('.eyebrow');
        let label = '';
        if (h) label = h.textContent.trim().slice(0, 40);
        else if (eyebrow) label = eyebrow.textContent.trim().slice(0, 40);
        return label ? ('Sectie ' + n + ' \u00b7 ' + label) : ('Sectie ' + n);
    }

    // Paginamodus: scan een container (<main>). Groepeert per <section> met een
    // restgroep "Pagina". Alle elementen krijgen region 'main'.
    function scanContainer(rootEl) {
        const out = { editables: [], editablesByKey: {}, sections: [] };
        if (!rootEl) return out;
        const childSections = Array.from(rootEl.children).filter(c => c.tagName === 'SECTION');
        if (childSections.length) {
            childSections.forEach((sec, i) => {
                const id = 'sec' + (i + 1);
                const name = sectionNameFor(sec, i + 1);
                const before = out.editables.length;
                scanRoot(sec, id, id, name, out, { region: 'main' });
                if (out.editables.length > before) out.sections.push({ id, name, selector: null });
            });
        }
        const before = out.editables.length;
        scanRoot(rootEl, 'pagina', 'pagina', 'Pagina', out, { region: 'main' });
        if (out.editables.length > before) out.sections.push({ id: 'pagina', name: 'Pagina', selector: null });
        return out;
    }

    // Volledige pagina (losse /p/-pagina in bewerkmodus): chrome-regio's
    // (topstrip/nav/footer) als region 'chrome' + <main> als region 'main'.
    // Chrome deelt sleutels met de homepage; main wordt in de pagina-HTML bewaard.
    function scanPageDocument() {
        const out = { editables: [], editablesByKey: {}, sections: [] };
        CHROME_SECTIONS.forEach(s => {
            const before = out.editables.length;
            scanRoot(document.querySelector(s.selector), s.id, s.id, s.name, out, { region: 'chrome' });
            if (out.editables.length > before) out.sections.push({ id: s.id, name: s.name, selector: s.selector });
        });
        const main = document.querySelector('main');
        if (main) {
            const childSections = Array.from(main.children).filter(c => c.tagName === 'SECTION');
            if (childSections.length) {
                childSections.forEach((sec, i) => {
                    const id = 'sec' + (i + 1);
                    const name = sectionNameFor(sec, i + 1);
                    const before = out.editables.length;
                    scanRoot(sec, id, id, name, out, { region: 'main' });
                    if (out.editables.length > before) out.sections.push({ id, name, selector: null });
                });
            }
            const before = out.editables.length;
            scanRoot(main, 'pagina', 'pagina', 'Pagina', out, { region: 'main' });
            if (out.editables.length > before) out.sections.push({ id: 'pagina', name: 'Pagina', selector: null });
        }
        return out;
    }

    window.ILScan = {
        EDITABLE_TAGS, INLINE_TAGS, SKIP_TAGS, SKIP_CLASSES,
        CHROME_SECTIONS, LOGO_IMG_SELECTOR, HERO_BG_IMG_SELECTOR,
        isEditableEl, detectType, menuSlug, imageRole,
        scanRoot, scanSections, scanContainer, scanPageDocument, sectionNameFor
    };
})();
