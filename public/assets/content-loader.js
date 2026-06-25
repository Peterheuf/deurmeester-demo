/**
 * DeurMeester - content loader (homepage)
 *
 * Draait op ELKE homepage-load. Injecteert het menu uit /api/menu in desktop-
 * en mobiele navigatie, scant daarna bewerkbare elementen en past overrides toe.
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

    const Scan = window.ILScan || {};
    const Apply = window.ILApply || {};

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

    function createMenuLink(it) {
        const a = document.createElement('a');
        a.href = it.url;
        a.textContent = it.label || it.url;
        if (it.slug || (it.url && it.url.indexOf('/p/') === 0)) {
            a.className = 'il-menu-link';
            const slug = it.slug || it.url.split(/[?#]/)[0].split('/').filter(Boolean).pop();
            if (slug) a.dataset.slug = slug;
        }
        return a;
    }

    function injectMenu() {
        return fetch('/api/menu')
            .then(r => (r.ok ? r.json() : []))
            .then(items => {
                if (!Array.isArray(items) || !items.length) return;

                document.querySelectorAll('.nav-links').forEach(nav => {
                    nav.innerHTML = '';
                    items.forEach(it => {
                        if (!it || !it.url) return;
                        nav.appendChild(createMenuLink(it));
                    });
                });

                document.querySelectorAll('.mobile-nav-links').forEach(nav => {
                    const cta = nav.querySelector('.mobile-nav-cta');
                    nav.innerHTML = '';
                    items.forEach(it => {
                        if (!it || !it.url) return;
                        nav.appendChild(createMenuLink(it));
                    });
                    if (cta) nav.appendChild(cta);
                    else {
                        const offerte = document.createElement('a');
                        offerte.href = '#boeken';
                        offerte.className = 'mobile-nav-cta';
                        offerte.textContent = 'Offerte aanvragen';
                        nav.appendChild(offerte);
                    }
                });
            })
            .catch(() => { /* zonder server: statische nav blijft staan */ });
    }

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
        injectMenu().finally(() => {
            const scan = scanEditables();
            ILContent.editables = scan.editables;
            ILContent.editablesByKey = scan.editablesByKey;
            ILContent.defaultColors = readDefaultColors();

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
