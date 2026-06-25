/**
 * DeurMeester - content loader (homepage)
 *
 * Draait op ELKE homepage-load. Injecteert eerst de dynamische menu-items
 * (gepubliceerde pagina's met inMenu) in de navigatie, scant daarna de bewerkbare
 * elementen (via de gedeelde scanner ILScan, zodat de sleutels exact matchen met
 * de live builder en met losse pagina's), haalt de opgeslagen content-overrides
 * op van de server en past ze toe (via de gedeelde ILApply).
 */
(function () {
    'use strict';

    const CFG = window.ILSiteConfig || {};
    const SECTIONS = CFG.homepageSections || [
        { id: 'topstrip', name: 'Top strip', selector: '.topstrip' },
        { id: 'nav',      name: 'Navigatie', selector: 'nav.global' },
        { id: 'hero',     name: 'Hero',      selector: '.hero' },
        { id: 'marquee',  name: 'Marquee',   selector: '.marquee' },
        { id: 'filosofie',    name: 'Filosofie · 01',    selector: '#filosofie' },
        { id: 'ruimtes',      name: 'Ruimtes · 02',      selector: '#ruimtes' },
        { id: 'faciliteiten', name: 'Faciliteiten · 03', selector: '#faciliteiten' },
        { id: 'verblijf',     name: 'Verblijf · 04',     selector: '#verblijf' },
        { id: 'locatie',      name: 'Locatie · 05',      selector: '#locatie' },
        { id: 'boeken',       name: 'Boeking · 06',      selector: '#boeken' },
        { id: 'footer',       name: 'Footer',            selector: 'footer' }
    ];

    const COLOR_TOKENS = CFG.colorTokens || [
        { var: '--ink',         label: 'Donker (tekst & dark sections)' },
        { var: '--paper',       label: 'Crème (achtergrond)' },
        { var: '--paper-warm',  label: 'Crème warm (panel & cards)' },
        { var: '--sage-deep',   label: 'Sage donker (groen accent)' },
        { var: '--sage',        label: 'Sage' },
        { var: '--copper',      label: 'Koper (primair accent)' },
        { var: '--copper-hot',  label: 'Koper helder (hover)' },
        { var: '--copper-soft', label: 'Koper zacht (subtiel)' }
    ];

    const LOGO_SELECTORS   = (window.ILApply && window.ILApply.DEFAULT_LOGO_SELECTORS) || '.nav-logo img, .footer-logo, .hero-stamp-center';
    const HERO_BG_SELECTOR = (window.ILApply && window.ILApply.DEFAULT_HERO_BG_SELECTOR) || '.hero-bg img';

    // De gedeelde scanner (il-scan.js) en apply-logica (il-apply.js).
    const Scan = window.ILScan || {};
    const Apply = window.ILApply || {};

    // Homepage-scan op basis van de vaste SECTIONS.
    function scanEditables() {
        if (!Scan.scanSections) return { editables: [], editablesByKey: {} };
        const out = Scan.scanSections(SECTIONS);
        return { editables: out.editables, editablesByKey: out.editablesByKey };
    }

    function applyEdits(edits, editablesByKey) {
        if (Apply.applyEdits) Apply.applyEdits(edits, editablesByKey);
    }

    function applyGlobal(global) {
        if (Apply.applyGlobal) Apply.applyGlobal(global, { logoSelectors: LOGO_SELECTORS, heroBgSelector: HERO_BG_SELECTOR });
    }

    function readDefaultColors() {
        const cs = getComputedStyle(document.documentElement);
        const defaults = {};
        COLOR_TOKENS.forEach(t => { defaults[t.var] = cs.getPropertyValue(t.var).trim(); });
        return defaults;
    }

    // Dynamische menu-items ophalen en in de navigatie injecteren. Markeert elke
    // link met class il-menu-link + data-slug, zodat de scanner ze een stabiele
    // sleutel (menu.<slug>) geeft die overal (homepage + losse pagina's) matcht.
    // Geeft een Promise terug zodat de scan ná de injectie kan draaien.
    function injectMenu() {
        return fetch('/api/menu')
            .then(r => (r.ok ? r.json() : []))
            .then(items => {
                if (!Array.isArray(items) || !items.length) return;
                document.querySelectorAll('.nav-links').forEach(nav => {
                    if (nav.dataset.ilMenu === '1') return;
                    nav.dataset.ilMenu = '1';
                    items.forEach(it => {
                        if (!it || !it.url) return;
                        const a = document.createElement('a');
                        a.href = it.url;
                        a.textContent = it.label || it.url;
                        a.className = 'il-menu-link';
                        const slug = it.url.split(/[?#]/)[0].split('/').filter(Boolean).pop();
                        if (slug) a.dataset.slug = slug;
                        nav.appendChild(a);
                    });
                });
            })
            .catch(() => { /* zonder server: geen extra menu-items */ });
    }

    // Gedeelde namespace voor de live builder.
    const ILContent = {
        SECTIONS, COLOR_TOKENS,
        EDITABLE_TAGS: Scan.EDITABLE_TAGS || [], INLINE_TAGS: Scan.INLINE_TAGS || [],
        LOGO_SELECTORS, HERO_BG_SELECTOR,
        scanEditables, applyEdits, applyGlobal, readDefaultColors,
        editables: [], editablesByKey: {},
        state: { edits: {}, global: { colors: {}, logoSrc: null, heroBgSrc: null } },
        defaultColors: {},
        ready: false,
        _readyCallbacks: [],
        onReady(cb) { this.ready ? cb() : this._readyCallbacks.push(cb); }
    };
    window.ILContent = ILContent;

    function init() {
        // 1. Eerst menu-items injecteren, daarna scannen zodat de menu-links
        //    meteen een stabiele sleutel krijgen en bewerkbaar zijn.
        injectMenu().finally(() => {
            const scan = scanEditables();
            ILContent.editables = scan.editables;
            ILContent.editablesByKey = scan.editablesByKey;
            ILContent.defaultColors = readDefaultColors();

            // 2. Opgeslagen content ophalen en toepassen.
            fetch('/api/content')
                .then(r => (r.ok ? r.json() : null))
                .then(content => {
                    if (content) {
                        ILContent.state.edits = content.edits || {};
                        ILContent.state.global = Object.assign(
                            { colors: {}, logoSrc: null, heroBgSrc: null },
                            content.global || {}
                        );
                        applyEdits(ILContent.state.edits, ILContent.editablesByKey);
                        applyGlobal(ILContent.state.global);
                    }
                })
                .catch(() => { /* zonder server: gewoon originele content tonen */ })
                .finally(() => {
                    ILContent.ready = true;
                    ILContent._readyCallbacks.forEach(cb => { try { cb(); } catch (e) {} });
                    ILContent._readyCallbacks = [];
                });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
