/**
 * DeurMeester CMS - gedeelde apply-logica (ILApply)
 *
 * Past opgeslagen content-overrides toe op de DOM. Gedeeld door:
 *   - content-loader.js  (homepage)
 *   - site-chrome.js     (chrome op elke losse pagina)
 *   - builder.js         (voorvertoning van bestaande overrides in paginamodus)
 *
 * Eén bron van waarheid voor hoe een opgeslagen edit naar het scherm vertaalt.
 */
(function () {
    'use strict';

    const CFG = window.ILSiteConfig || {};
    const DEFAULT_LOGO_SELECTORS = CFG.logoSelectors || '.nav-logo img, .footer-logo, .hero-stamp-center';
    const DEFAULT_HERO_BG_SELECTOR = CFG.heroBgSelector || '.hero-bg img';

    const STYLE_PROPS = ['color', 'backgroundColor', 'fontSize', 'fontWeight', 'textAlign', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'borderRadius'];

    function camelToKebab(str) {
        return String(str || '').replace(/([A-Z])/g, '-$1').toLowerCase();
    }

    function applyElementStyle(el, style) {
        if (!el || !style || typeof style !== 'object') return;
        STYLE_PROPS.forEach(p => {
            const cssProp = camelToKebab(p);
            if (style[p] === undefined || style[p] === null || style[p] === '') {
                el.style.removeProperty(cssProp);
            } else {
                el.style[p] = style[p];
            }
        });
    }

    // Tekst-, link-, afbeelding- en stijl-overrides toepassen op basis van sleutel.
    // edits: { "<key>": { text?, href?, target?, img?, alt?, style? } | "<tekst>" }
    function applyEdits(edits, editablesByKey) {
        Object.entries(edits || {}).forEach(([key, edit]) => {
            const entry = editablesByKey[key];
            if (!entry) return;
            const el = entry.el;
            const e = (typeof edit === 'string') ? { text: edit } : (edit || {});
            if (el.tagName === 'IMG') {
                if (e.img !== undefined && e.img !== null) el.setAttribute('src', e.img);
                if (e.alt !== undefined) el.setAttribute('alt', e.alt);
                if (e.style) applyElementStyle(el, e.style);
                return;
            }
            if (e.text !== undefined) el.innerHTML = e.text;
            if (e.href !== undefined && el.tagName === 'A') el.setAttribute('href', e.href);
            if (e.target !== undefined && el.tagName === 'A') {
                if (e.target) el.setAttribute('target', e.target);
                else el.removeAttribute('target');
            }
            if (e.style) applyElementStyle(el, e.style);
        });
    }

    // Globale stijl toepassen: CSS-kleurtokens, logo's en hero-achtergrond.
    function applyGlobal(global, opts) {
        if (!global) return;
        opts = opts || {};
        const logoSel = opts.logoSelectors || DEFAULT_LOGO_SELECTORS;
        const heroSel = opts.heroBgSelector || DEFAULT_HERO_BG_SELECTOR;
        Object.entries(global.colors || {}).forEach(([varName, value]) => {
            if (value) document.documentElement.style.setProperty(varName, value);
        });
        if (global.logoSrc && logoSel) {
            document.querySelectorAll(logoSel).forEach(img => { img.src = global.logoSrc; });
        }
        if (global.heroBgSrc && heroSel) {
            document.querySelectorAll(heroSel).forEach(img => { img.src = global.heroBgSrc; });
        }
    }

    window.ILApply = { applyEdits, applyGlobal, applyElementStyle, STYLE_PROPS, DEFAULT_LOGO_SELECTORS, DEFAULT_HERO_BG_SELECTOR };
})();
