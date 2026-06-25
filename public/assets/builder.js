/**
 * DeurMeester - Live Builder
 *
 * Visuele editor bovenop de live site. Werkt in twee modi:
 *
 *  1. Homepage-modus  (window.ILContent aanwezig, geladen via content-loader.js)
 *     - Hergebruikt de scan van content-loader (vaste SECTIONS) zodat sleutels matchen.
 *     - Bewerkt tekst/links/knoppen + ALLE afbeeldingen.
 *     - Slaat op via PUT /api/content (tekst/link/afbeelding-overrides + globale stijl).
 *
 *  2. Paginamodus     (window.IL_PAGE aanwezig, op /p/<slug>?edit=1 als admin)
 *     - Scant topstrip + nav + <main> + footer via ILScan.scanPageDocument().
 *     - Split-save:
 *         * <main> innerHTML  -> PUT /api/pages/:id { html }
 *         * chrome (topstrip/nav/footer) tekst/link-edits -> PUT /api/content (zelfde
 *           sleutelsysteem als de homepage, zodat nav/footer overal synchroon zijn)
 *     - Bewerkt tekst/links/knoppen/afbeeldingen over de volledige pagina.
 */
(function () {
    'use strict';

    function boot() {
        // Paginamodus: wacht op de DOM, de scanner en de apply-logica.
        if (window.IL_PAGE) {
            const begin = () => {
                if (window.ILScan && window.ILApply && document.querySelector('main')) startPageMode();
                else setTimeout(begin, 30);
            };
            if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', begin);
            else begin();
            return;
        }
        // Homepage-modus: wacht op content-loader.
        const C = window.ILContent;
        if (!C) { setTimeout(boot, 30); return; }
        C.onReady(() => startHomeMode(C));
    }

    function startHomeMode(C) {
        start({
            mode: 'home',
            SECTIONS: C.SECTIONS,
            COLOR_TOKENS: C.COLOR_TOKENS,
            LOGO_SELECTORS: C.LOGO_SELECTORS,
            HERO_BG_SELECTOR: C.HERO_BG_SELECTOR,
            DEFAULT_COLORS: C.defaultColors || {},
            editables: C.editables,
            editablesByKey: C.editablesByKey,
            initialEdits: C.state.edits || {},
            initialGlobal: C.state.global || {},
            showGlobal: true
        });
    }

    // Paginamodus: volledige pagina scannen en bestaande chrome-overrides voorvertonen.
    function startPageMode() {
        const main = document.querySelector('main');
        const scan = window.ILScan.scanPageDocument();
        const CFG = window.ILSiteConfig || {};
        const LOGO_SELECTORS = CFG.logoSelectors || '.nav-logo img, .footer-logo';
        const PAGE_COLOR_TOKENS = CFG.colorTokens || [];

        fetch('/api/content')
            .then(r => (r.ok ? r.json() : null))
            .then(content => {
                content = content || { edits: {}, global: {} };
                // Bestaande chrome-overrides + globaal logo meteen tonen.
                window.ILApply.applyEdits(content.edits || {}, scan.editablesByKey);
                window.ILApply.applyGlobal(content.global || {}, { logoSelectors: LOGO_SELECTORS, heroBgSelector: '' });

                // Alleen de chrome-edits als startwaarde overnemen (main zit in de HTML).
                const chromeInit = {};
                Object.keys(content.edits || {}).forEach(k => {
                    const e = scan.editablesByKey[k];
                    if (e && e.region === 'chrome') chromeInit[k] = content.edits[k];
                });

                start({
                    mode: 'page',
                    SECTIONS: scan.sections,
                    COLOR_TOKENS: PAGE_COLOR_TOKENS,
                    LOGO_SELECTORS: LOGO_SELECTORS,
                    HERO_BG_SELECTOR: '',
                    DEFAULT_COLORS: {},
                    editables: scan.editables,
                    editablesByKey: scan.editablesByKey,
                    initialEdits: chromeInit,
                    initialGlobal: content.global || {},
                    showGlobal: false,
                    main: main,
                    page: window.IL_PAGE
                });
            });
    }

    function start(ctx) {
        const MODE            = ctx.mode;
        const SECTIONS        = ctx.SECTIONS;
        const COLOR_TOKENS    = ctx.COLOR_TOKENS;
        const LOGO_SELECTORS  = ctx.LOGO_SELECTORS;
        const HERO_BG_SELECTOR = ctx.HERO_BG_SELECTOR;
        const DEFAULT_COLORS  = ctx.DEFAULT_COLORS || {};
        const DEFAULT_LOGO_SRC = 'images/logo.png';
        const DEFAULT_HERO_SRC = 'images/heide.png';

        const editables = ctx.editables;
        const editablesByKey = ctx.editablesByKey;

        const state = {
            editMode: false,
            activeTab: 'page',
            selectedKey: null,
            selectedImg: null,
            edits: ctx.initialEdits || {},
            global: Object.assign({ colors: {}, logoSrc: null, heroBgSrc: null }, ctx.initialGlobal || {})
        };
        let activeContentEditableEl = null;
        let elementCatalog = null;
        const STYLE_KEYS = (window.ILApply && window.ILApply.STYLE_PROPS) ||
            ['color', 'backgroundColor', 'fontSize', 'fontWeight', 'textAlign', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'borderRadius'];

        function usesInlineStyle(entry) {
            return MODE === 'page' && entry && entry.region === 'main';
        }

        function tokenColor(varName) {
            if (!varName) return '';
            return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        }

        function getStoredStyle(key, el) {
            const entry = editablesByKey[key];
            if (usesInlineStyle(entry)) {
                const style = {};
                STYLE_KEYS.forEach(p => { if (el.style[p]) style[p] = el.style[p]; });
                return style;
            }
            const edit = state.edits[key];
            return (edit && edit.style) ? Object.assign({}, edit.style) : {};
        }

        function setStyleProp(key, prop, value) {
            const entry = editablesByKey[key];
            if (!entry) return;
            const el = entry.el;
            const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
            if (usesInlineStyle(entry)) {
                if (!value) el.style.removeProperty(cssProp);
                else el.style[prop] = value;
                return;
            }
            if (!state.edits[key]) state.edits[key] = {};
            if (!state.edits[key].style) state.edits[key].style = {};
            if (!value) {
                delete state.edits[key].style[prop];
                if (Object.keys(state.edits[key].style).length === 0) delete state.edits[key].style;
            } else {
                state.edits[key].style[prop] = value;
            }
            if (window.ILApply && window.ILApply.applyElementStyle) {
                window.ILApply.applyElementStyle(el, state.edits[key].style || {});
            }
        }

        function setPaddingY(key, val) {
            setStyleProp(key, 'paddingTop', val);
            setStyleProp(key, 'paddingBottom', val);
        }

        function setPaddingX(key, val) {
            setStyleProp(key, 'paddingLeft', val);
            setStyleProp(key, 'paddingRight', val);
        }

        if (MODE === 'page') {
            fetch('/api/elements').then(r => (r.ok ? r.json() : null)).then(d => { elementCatalog = d; });
        }

        // -------------------------------------------------------------------
        // Helpers
        // -------------------------------------------------------------------
        function escapeHtml(str) {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }
        function escapeAttr(str) {
            return String(str == null ? '' : str)
                .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
                .replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
        function ensureHex(c) {
            c = (c || '').trim();
            if (c.startsWith('#')) {
                if (c.length === 4) return '#' + c[1]+c[1]+c[2]+c[2]+c[3]+c[3];
                return c;
            }
            const m = c.match(/rgba?\(\s*(\d+)[, ]+(\d+)[, ]+(\d+)/i);
            if (m) {
                const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
                return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
            }
            return c || '#000000';
        }
        function isMenuKey(key) { return /^menu\./.test(key || ''); }
        function tagLabelFor(el) {
            const tag = el.tagName.toLowerCase();
            if (tag === 'img') return 'Afb';
            if (el.classList && el.classList.contains('il-menu-link')) return 'Menu';
            if (el.classList.contains('hero-tagline')) return 'Tag';
            if (el.classList.contains('hero-script') || el.classList.contains('script')) return 'Scr';
            if (el.classList.contains('mono-label')) return 'Lbl';
            if (el.classList.contains('nav-cta') || el.classList.contains('bw-cta') ||
                el.classList.contains('btn-next') || el.classList.contains('btn-prev') ||
                el.classList.contains('cta-button')) return 'Knop';
            if (el.classList.contains('ruimte-link') || el.classList.contains('space-cta') ||
                el.classList.contains('hero-cta')) return 'Link';
            if (el.classList.contains('ruimte-cap')) return 'Sub';
            if (el.classList.contains('huis-badge') || el.classList.contains('ruimte-tag')) return 'Tag';
            if (el.classList.contains('pillar')) return 'Pil';
            if (el.classList.contains('activiteit')) return 'Act';
            if (el.classList.contains('locatie-map-title')) return 'Tit';
            if (el.classList.contains('locatie-coord')) return 'Crd';
            if (el.classList.contains('locatie-pin')) return 'Pin';
            if (el.classList.contains('huis-spec')) return 'Spe';
            if (el.classList.contains('space-meta')) return 'Met';
            if (tag === 'a') return 'Link';
            if (tag === 'button') return 'Knop';
            const map = { h1:'H1', h2:'H2', h3:'H3', h4:'H4', h5:'H5', h6:'H6', p:'Tek', blockquote:'Quo', li:'Itm', span:'Tek', div:'Tek', strong:'Bld', small:'Sml', label:'Lbl' };
            return map[tag] || tag.toUpperCase();
        }

        // -------------------------------------------------------------------
        // UI opbouw
        // -------------------------------------------------------------------
        function renderUI() {
            const toolbar = document.createElement('div');
            toolbar.className = 'lb-toolbar';
            toolbar.innerHTML =
                '<button class="lb-toggle" id="lbToggle" title="Edit-modus aan/uit">' +
                '<svg viewBox="0 0 24 24" fill="none"><path d="M3 17v4h4l11-11-4-4L3 17z" stroke="currentColor" stroke-width="1.6"/></svg>' +
                '<span class="lb-label">Bewerken</span></button>' +
                '<span class="lb-sep"></span>' +
                '<button id="lbSave" title="Wijzigingen opslaan">' +
                '<svg viewBox="0 0 24 24" fill="none"><path d="M5 5h13l3 3v11H5zM5 5v6h11V5" stroke="currentColor" stroke-width="1.6"/></svg>' +
                '<span class="lb-label">Opslaan</span></button>' +
                '<button id="lbReset" class="lb-icon" title="Reset / opnieuw laden">' +
                '<svg viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 1 0 3-6.7M3 3v6h6" stroke="currentColor" stroke-width="1.6"/></svg></button>' +
                '<span class="lb-sep"></span>' +
                '<button id="lbExit" class="lb-exit" title="Terug naar admin">' +
                '<svg viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" stroke-width="1.6"/></svg>' +
                '<span class="lb-label">Admin</span></button>';
            document.body.appendChild(toolbar);

            const subtitle = MODE === 'page'
                ? ('Pagina: ' + escapeHtml((ctx.page && ctx.page.title) || ''))
                : 'Visuele editor';

            // De Stijl-tab is alleen zinvol op de homepage (site-brede kleuren/logo/hero).
            const globalTab = ctx.showGlobal
                ? '<button class="lb-tab" data-tab="global">' +
                  '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" stroke="currentColor" stroke-width="1.6"/></svg>Stijl</button>'
                : '';

            const panel = document.createElement('aside');
            panel.className = 'lb-panel';
            panel.id = 'lbPanel';
            panel.innerHTML =
                '<div class="lb-panel-header">' +
                '<div><span class="lb-panel-sub">' + subtitle + '</span><h2>Live <em>Builder</em></h2></div>' +
                '<button class="lb-panel-close" id="lbPanelClose">&times;</button>' +
                '</div>' +
                '<div class="lb-panel-tabs">' +
                '<button class="lb-tab" data-tab="element">' +
                '<svg viewBox="0 0 24 24" fill="none"><path d="M3 17v4h4l11-11-4-4L3 17z" stroke="currentColor" stroke-width="1.6"/></svg>Element</button>' +
                '<button class="lb-tab active" data-tab="page">' +
                '<svg viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="1.6"/></svg>Pagina</button>' +
                globalTab +
                '</div>' +
                '<div class="lb-panel-body" id="lbPanelBody"></div>' +
                '<div class="lb-panel-footer">' +
                '<button class="lb-btn-secondary" id="lbResetPanel">' + (MODE === 'page' ? 'Herladen' : 'Reset') + '</button>' +
                '<button class="lb-btn-primary" id="lbSavePanel">Opslaan</button>' +
                '</div>';
            document.body.appendChild(panel);

            const toast = document.createElement('div');
            toast.className = 'lb-toast';
            toast.id = 'lbToast';
            document.body.appendChild(toast);

            renderActiveTab();
        }

        function renderActiveTab() {
            const body = document.getElementById('lbPanelBody');
            if (!body) return;
            if (state.activeTab === 'element')      body.innerHTML = renderElementTab();
            else if (state.activeTab === 'page')    body.innerHTML = renderPageTab();
            else if (state.activeTab === 'global' && ctx.showGlobal) body.innerHTML = renderGlobalTab();
            document.querySelectorAll('.lb-tab').forEach(t => {
                t.classList.toggle('active', t.dataset.tab === state.activeTab);
            });
        }

        function itemPreview(item) {
            if (item.type === 'image') {
                const src = item.el.getAttribute('src') || '';
                return src.split('/').pop() || 'afbeelding';
            }
            return item.el.textContent.trim().substring(0, 100);
        }

        function renderPageTab() {
            const sectionMap = {};
            editables.forEach(e => {
                if (!sectionMap[e.section]) sectionMap[e.section] = { name: e.sectionName, items: [] };
                sectionMap[e.section].items.push(e);
            });
            let html = '';
            SECTIONS.forEach((section, sIdx) => {
                const data = sectionMap[section.id];
                if (!data || data.items.length === 0) return;
                const isCollapsed = sIdx !== 0;
                html += '<div class="lb-section ' + (isCollapsed ? 'collapsed' : '') + '" data-section="' + section.id + '">' +
                    '<div class="lb-section-header" data-action="toggle" data-section-id="' + section.id + '">' +
                    '<span class="lb-section-header-left"><span class="lb-chevron">&#9654;</span><span>' + escapeHtml(data.name) + '</span></span>' +
                    '<span class="lb-count">' + data.items.length + '</span>' +
                    '</div>' +
                    '<div class="lb-section-items">' +
                    data.items.map(item => {
                        const tagLabel = tagLabelFor(item.el);
                        const preview = itemPreview(item);
                        const activeClass = (item.key === state.selectedKey) ? ' active' : '';
                        const action = item.type === 'image' ? 'focusImg' : 'focus';
                        return '<div class="lb-item' + activeClass + '" data-action="' + action + '" data-key="' + item.key + '">' +
                            '<span class="lb-item-tag">' + tagLabel + '</span>' +
                            '<span class="lb-item-preview">' + escapeHtml(preview) + '</span>' +
                            '</div>';
                    }).join('') +
                    '</div></div>';
            });
            const hint = MODE === 'page'
                ? 'Bewerk tekst, knoppen en afbeeldingen over de hele pagina (nav, footer en inhoud). Nav/footer-wijzigingen gelden site-breed.'
                : 'Klik op een tekst, knop of afbeelding om die te bewerken.';
            let header = '';
            if (MODE === 'page' && ctx.main) {
                header = '<div class="lb-add-element">' +
                    '<button type="button" class="lb-btn-add-element" data-action="toggleElements">+ Element toevoegen</button>' +
                    '<div class="lb-element-picker" id="lbElementPicker" hidden></div></div>';
            }
            html = header + '<p class="lb-global-hint" style="padding:0 0 .75rem;">' + hint + '</p>' + html;
            return html || '<div class="lb-empty-state"><strong>Geen bewerkbare elementen gevonden</strong>Voeg eerst inhoud toe.</div>';
        }

        function renderElementPicker() {
            const picker = document.getElementById('lbElementPicker');
            if (!picker) return;
            const items = (elementCatalog && elementCatalog.elements) || [];
            if (!items.length) {
                picker.innerHTML = '<p class="lb-field-hint">Elementen laden…</p>';
                picker.hidden = false;
                return;
            }
            picker.innerHTML = items.map(it =>
                '<button type="button" class="lb-element-option" data-action="pickElement" data-element-id="' + escapeAttr(it.id) + '">' +
                '<strong>' + escapeHtml(it.name) + '</strong>' +
                '<span>' + escapeHtml(it.description || it.category || '') + '</span></button>'
            ).join('');
            picker.hidden = !picker.hidden;
        }

        function renderStyleSection(entry) {
            const el = entry.el;
            const style = getStoredStyle(entry.key, el);
            const py = style.paddingTop || style.paddingBottom || '';
            const px = style.paddingLeft || style.paddingRight || '';
            let html = '<div class="lb-style-section">' +
                '<h3 class="lb-style-title">Stijl</h3>';

            function colorField(label, prop, defaultVar) {
                let block = '<div class="lb-field"><label class="lb-field-label">' + label + '</label><div class="lb-style-swatches">';
                COLOR_TOKENS.forEach(t => {
                    const c = ensureHex(tokenColor(t.var) || '#333333');
                    block += '<button type="button" class="lb-style-swatch" data-action="styleSwatch" data-prop="' + prop + '" data-value="' + escapeAttr(c) + '" style="background:' + c + '" title="' + escapeAttr(t.label) + '"></button>';
                });
                const cur = ensureHex(style[prop] || tokenColor(defaultVar) || '#333333');
                block += '<input type="color" class="lb-style-color" data-action="styleColor" data-prop="' + prop + '" value="' + escapeAttr(cur) + '"/></div></div>';
                return block;
            }

            html += colorField('Tekstkleur', 'color', '--ink');
            html += colorField('Achtergrond', 'backgroundColor', '--paper-warm');

            html += '<div class="lb-field"><label class="lb-field-label">Lettergrootte</label>' +
                '<select class="lb-input" data-action="styleSelect" data-prop="fontSize">' +
                ['', '0.75rem', '0.875rem', '1rem', '1.125rem', '1.25rem', '1.5rem', '2rem'].map(v =>
                    '<option value="' + v + '"' + ((style.fontSize || '') === v ? ' selected' : '') + '>' + (v || 'Standaard') + '</option>'
                ).join('') + '</select></div>';

            html += '<div class="lb-field"><label class="lb-field-label">Letterdikte</label>' +
                '<select class="lb-input" data-action="styleSelect" data-prop="fontWeight">' +
                ['', '400', '500', '600', '700'].map(v =>
                    '<option value="' + v + '"' + ((style.fontWeight || '') === v ? ' selected' : '') + '>' + (v || 'Standaard') + '</option>'
                ).join('') + '</select></div>';

            html += '<div class="lb-field"><label class="lb-field-label">Uitlijning</label>' +
                '<div class="lb-style-align">' +
                ['left', 'center', 'right'].map(v =>
                    '<button type="button" class="lb-style-align-btn' + ((style.textAlign || '') === v ? ' active' : '') + '" data-action="styleAlign" data-value="' + v + '">' + v + '</button>'
                ).join('') + '</div></div>';

            html += '<div class="lb-field"><label class="lb-field-label">Ruimte verticaal</label>' +
                '<input type="range" min="0" max="48" step="4" data-action="stylePadY" value="' + (parseInt(py, 10) || 0) + '"/>' +
                '<span class="lb-range-val">' + (py || '0') + '</span></div>';
            html += '<div class="lb-field"><label class="lb-field-label">Ruimte horizontaal</label>' +
                '<input type="range" min="0" max="48" step="4" data-action="stylePadX" value="' + (parseInt(px, 10) || 0) + '"/>' +
                '<span class="lb-range-val">' + (px || '0') + '</span></div>';

            html += '<div class="lb-field"><label class="lb-field-label">Hoekradius</label>' +
                '<input type="range" min="0" max="32" step="2" data-action="styleRadius" value="' + (parseInt(style.borderRadius, 10) || 0) + '"/>' +
                '<span class="lb-range-val">' + (style.borderRadius || '0') + '</span></div>';

            html += '<button type="button" class="lb-action-button" data-action="resetStyle" style="margin-top:.5rem;width:100%;">Reset stijl</button></div>';
            return html;
        }

        function renderElementTab() {
            if (state.selectedImg) return renderImageInspector(state.selectedImg);
            if (!state.selectedKey || !editablesByKey[state.selectedKey]) {
                return '<div class="lb-empty-state">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 3h7v7M10 21H3v-7M21 3l-7 7M3 21l7-7"/></svg>' +
                    '<strong>Geen element geselecteerd</strong>' +
                    'Klik op een tekst, knop of afbeelding op de pagina,<br/>of kies een item via de Pagina-tab.' +
                    '</div>';
            }
            const entry = editablesByKey[state.selectedKey];
            const el = entry.el;
            const type = entry.type;
            const isMenu = isMenuKey(entry.key);
            const typeLabels = { text: 'Tekst', link: 'Link', button: 'Knop', image: 'Afbeelding' };

            let html = '<div class="lb-inspector">' +
                '<div class="lb-inspector-head">' +
                '<div class="lb-inspector-row">' +
                '<span class="lb-type-badge">' + (isMenu ? 'Menu-link' : (typeLabels[type] || 'Element')) + '</span>' +
                '<span class="lb-inspector-tag">&lt;' + el.tagName.toLowerCase() + '&gt;</span>' +
                '</div>' +
                '<span class="lb-inspector-section">' + escapeHtml(entry.sectionName) + '</span>' +
                '</div>';

            const storedText = state.edits[entry.key] && state.edits[entry.key].text;
            const currentText = storedText !== undefined ? storedText : el.innerHTML;
            const plainLength = el.textContent.length;
            const isShort = plainLength < 60 && !/(<br|<em|<strong)/.test(currentText);
            const fieldLabel = (type === 'link' || type === 'button') ? 'Knop-tekst' : 'Tekst inhoud';

            if (isShort) {
                html += '<div class="lb-field">' +
                    '<label class="lb-field-label">' + fieldLabel + '</label>' +
                    '<input class="lb-input" type="text" data-action="text" value="' + escapeAttr(currentText) + '"/>' +
                    '</div>';
            } else {
                html += '<div class="lb-field">' +
                    '<label class="lb-field-label">' + fieldLabel + '</label>' +
                    '<textarea class="lb-textarea" data-action="text" rows="5">' + escapeAttr(currentText) + '</textarea>' +
                    '<div class="lb-field-hint">Tip: gebruik <code>&lt;em&gt;tekst&lt;/em&gt;</code> voor italic, <code>&lt;br/&gt;</code> voor nieuwe regel.</div>' +
                    '</div>';
            }

            if (isMenu) {
                html += '<div class="lb-field-hint" style="margin-top:.5rem;">Menu-link. De bestemming blijft <code>' + escapeAttr(el.getAttribute('href') || '') + '</code>. De paginatitel zelf wijzig je via Admin &rarr; Pagina\u0027s.</div>';
            } else if (type === 'link' || (type === 'button' && el.tagName === 'A')) {
                const storedHref = state.edits[entry.key] && state.edits[entry.key].href;
                const currentHref = storedHref !== undefined ? storedHref : (el.getAttribute('href') || '');
                const storedTarget = state.edits[entry.key] && state.edits[entry.key].target;
                const currentTarget = storedTarget !== undefined ? storedTarget : (el.getAttribute('target') || '');
                html += '<div class="lb-field">' +
                    '<label class="lb-field-label">URL / link</label>' +
                    '<input class="lb-input" type="text" data-action="href" value="' + escapeAttr(currentHref) + '" placeholder="https:// of #anchor"/>' +
                    '<div class="lb-field-hint">Voorbeelden: <code>#boeken</code>, <code>https://...</code>, <code>tel:+316...</code>, <code>mailto:info@...</code></div>' +
                    '</div>' +
                    '<label class="lb-checkbox-row">' +
                    '<input type="checkbox" data-action="target" ' + (currentTarget === '_blank' ? 'checked' : '') + '/>' +
                    'Open in nieuw tabblad' +
                    '</label>';
            }

            html += renderStyleSection(entry);

            html += '<div class="lb-inspector-actions">' +
                '<button class="lb-action-button" data-action="goToEl">Toon op pagina</button>' +
                '<button class="lb-action-button" data-action="resetEl">Reset dit element</button>' +
                '</div></div>';
            return html;
        }

        // Inspector voor een geselecteerde afbeelding.
        function renderImageInspector(img) {
            const src = img.getAttribute('src') || '';
            const entry = editablesByKey[img.dataset.lbKey];
            const role = entry ? entry.imgRole : 'content';
            const roleHint = role === 'logo'
                ? 'Dit is het site-logo. De wijziging geldt overal (nav, footer, hero-stempel).'
                : role === 'herobg'
                    ? 'Dit is de grote hero-achtergrond.'
                    : 'Vervang via upload, bibliotheek of URL.';
            return '<div class="lb-inspector">' +
                '<div class="lb-inspector-head">' +
                '<div class="lb-inspector-row">' +
                '<span class="lb-type-badge">Afbeelding</span>' +
                '<span class="lb-inspector-tag">&lt;img&gt;</span>' +
                '</div>' +
                '<span class="lb-inspector-section">' + escapeHtml(roleHint) + '</span>' +
                '</div>' +
                renderImageUploadHTML('sel', src) +
                '<div class="lb-field">' +
                '<label class="lb-field-label">Alt-tekst</label>' +
                '<input class="lb-input" type="text" data-action="imgAlt" value="' + escapeAttr(img.getAttribute('alt') || '') + '"/>' +
                '</div>' +
                '<div class="lb-inspector-actions">' +
                '<button class="lb-action-button" data-action="goToImg">Toon op pagina</button>' +
                '</div></div>';
        }

        function renderGlobalTab() {
            let html = '<div class="lb-global-section">' +
                '<h3>Logo</h3>' +
                '<p class="lb-global-hint">Verandert alle logo\u0027s tegelijk: navigatie, hero-stempel en footer.</p>' +
                renderImageUploadHTML('logo', state.global.logoSrc || DEFAULT_LOGO_SRC) +
                '</div>';
            html += '<div class="lb-global-section">' +
                '<h3>Hero achtergrond</h3>' +
                '<p class="lb-global-hint">De grote achtergrondfoto bovenaan de pagina.</p>' +
                renderImageUploadHTML('heroBg', state.global.heroBgSrc || DEFAULT_HERO_SRC) +
                '</div>';
            html += '<div class="lb-global-section">' +
                '<h3>Kleuren</h3>' +
                '<p class="lb-global-hint">Pas de kleuren van het hele design aan. Klik op een swatch om een kleur te kiezen.</p>';
            COLOR_TOKENS.forEach(t => {
                const current = state.global.colors[t.var] || DEFAULT_COLORS[t.var] || '#000000';
                const hex = ensureHex(current);
                html += '<div class="lb-color-row">' +
                    '<span class="lb-color-swatch" style="background:' + hex + '">' +
                    '<input type="color" data-action="color" data-var="' + t.var + '" value="' + hex + '"/>' +
                    '</span>' +
                    '<div class="lb-color-info">' + t.label + '<small>' + t.var + '</small></div>' +
                    '<input class="lb-color-hex" type="text" data-action="colorHex" data-var="' + t.var + '" value="' + hex + '"/>' +
                    '</div>';
            });
            html += '<button class="lb-action-button" data-action="resetColors" style="margin-top: 0.75rem; width: 100%;">Reset alle kleuren</button>' +
                '</div>';
            return html;
        }

        function renderImageUploadHTML(field, currentSrc) {
            return '<div class="lb-image-upload" data-field="' + field + '">' +
                '<div class="lb-image-preview-wrap">' +
                '<img class="lb-image-preview" src="' + escapeAttr(currentSrc) + '" alt=""/>' +
                '</div>' +
                '<div class="lb-image-actions">' +
                '<label class="lb-image-button">' +
                '<svg viewBox="0 0 24 24" fill="none"><path d="M12 4v16M4 12h16" stroke="currentColor" stroke-width="2"/></svg>' +
                'Upload' +
                '<input type="file" accept="image/*" data-action="imgUpload" data-field="' + field + '"/>' +
                '</label>' +
                '<button class="lb-image-button secondary" data-action="imgLibrary" data-field="' + field + '">Bibliotheek</button>' +
                '<button class="lb-image-button secondary" data-action="imgUrl" data-field="' + field + '">URL...</button>' +
                '<button class="lb-image-button secondary" data-action="imgReset" data-field="' + field + '">Origineel</button>' +
                '</div></div>';
        }

        let mediaLibraryCache = null;
        let mediaPickerField = null;

        function ensureMediaModal() {
            let modal = document.getElementById('lbMediaModal');
            if (modal) return modal;
            modal = document.createElement('div');
            modal.className = 'lb-media-modal';
            modal.id = 'lbMediaModal';
            modal.hidden = true;
            modal.innerHTML =
                '<div class="lb-media-backdrop" data-action="mediaClose"></div>' +
                '<div class="lb-media-card" role="dialog" aria-label="Mediabibliotheek">' +
                '<div class="lb-media-head">' +
                '<h3>Mediabibliotheek</h3>' +
                '<button type="button" class="lb-media-close" data-action="mediaClose">&times;</button>' +
                '</div>' +
                '<input type="search" class="lb-media-search" placeholder="Zoek afbeelding…" data-action="mediaSearch"/>' +
                '<div class="lb-media-grid" id="lbMediaGrid"></div>' +
                '<p class="lb-media-hint" id="lbMediaHint">Kies een afbeelding uit de bibliotheek.</p>' +
                '</div>';
            document.body.appendChild(modal);
            modal.addEventListener('click', handleMediaModalClick);
            modal.querySelector('[data-action="mediaSearch"]').addEventListener('input', (e) => {
                renderMediaPickerGrid(e.target.value.trim());
            });
            return modal;
        }

        async function loadMediaLibrary() {
            if (mediaLibraryCache) return mediaLibraryCache;
            try {
                const res = await fetch('/api/media', { credentials: 'same-origin' });
                if (res.status === 401) {
                    showToast('Log in via /admin om de bibliotheek te gebruiken', 'error');
                    return [];
                }
                if (!res.ok) throw new Error('load failed');
                mediaLibraryCache = await res.json();
                return mediaLibraryCache;
            } catch (err) {
                showToast('Mediabibliotheek laden mislukt', 'error');
                return [];
            }
        }

        function renderMediaPickerGrid(query) {
            const grid = document.getElementById('lbMediaGrid');
            const hint = document.getElementById('lbMediaHint');
            if (!grid) return;
            const q = String(query || '').toLowerCase();
            const items = (mediaLibraryCache || []).filter(m => {
                if (!q) return true;
                const hay = [m.filename, m.url, m.alt, m.source].join(' ').toLowerCase();
                return hay.indexOf(q) !== -1;
            });
            if (!items.length) {
                grid.innerHTML = '';
                if (hint) hint.textContent = q ? 'Geen afbeeldingen gevonden.' : 'Geen afbeeldingen in de bibliotheek.';
                return;
            }
            if (hint) hint.textContent = items.length + ' afbeelding' + (items.length === 1 ? '' : 'en') + ' — klik om te gebruiken.';
            grid.innerHTML = items.map(m => {
                const label = escapeHtml(m.alt || m.filename || '');
                const src = escapeHtml(m.url || '');
                return '<button type="button" class="lb-media-item" data-action="mediaPick" data-src="' + src + '" title="' + label + '">' +
                    '<span class="lb-media-thumb" style="background-image:url(' + src + ')"></span>' +
                    '<span class="lb-media-name">' + escapeHtml(m.filename || '') + '</span>' +
                    '</button>';
            }).join('');
        }

        async function openMediaPicker(field) {
            mediaPickerField = field || 'sel';
            const modal = ensureMediaModal();
            modal.hidden = false;
            document.body.classList.add('lb-media-open');
            const grid = document.getElementById('lbMediaGrid');
            if (grid) grid.innerHTML = '<p class="lb-media-loading">Laden…</p>';
            await loadMediaLibrary();
            renderMediaPickerGrid('');
            const search = modal.querySelector('[data-action="mediaSearch"]');
            if (search) { search.value = ''; search.focus(); }
        }

        function closeMediaPicker() {
            const modal = document.getElementById('lbMediaModal');
            if (modal) modal.hidden = true;
            document.body.classList.remove('lb-media-open');
            mediaPickerField = null;
        }

        function applyMediaPick(src) {
            const field = mediaPickerField || 'sel';
            if (field === 'sel') {
                if (state.selectedImg) {
                    changeImageSrc(state.selectedImg, src);
                    renderActiveTab();
                    showToast('Afbeelding gekozen', 'success');
                }
            } else {
                setGlobalImage(field, src);
                showToast('Afbeelding gekozen', 'success');
            }
            closeMediaPicker();
        }

        function handleMediaModalClick(e) {
            const pick = e.target.closest('[data-action="mediaPick"]');
            if (pick && pick.dataset.src) {
                applyMediaPick(pick.dataset.src);
                return;
            }
            if (e.target.closest('[data-action="mediaClose"]')) closeMediaPicker();
        }

        // -------------------------------------------------------------------
        // State mutators
        // -------------------------------------------------------------------
        function setEdit(key, prop, value) {
            if (!state.edits[key]) state.edits[key] = {};
            if (value === null || value === undefined || value === '') {
                delete state.edits[key][prop];
            } else {
                state.edits[key][prop] = value;
            }
            if (Object.keys(state.edits[key]).length === 0) delete state.edits[key];
        }

        function setGlobalImage(field, src) {
            if (field === 'logo') {
                state.global.logoSrc = src;
                const target = src || DEFAULT_LOGO_SRC;
                if (LOGO_SELECTORS) document.querySelectorAll(LOGO_SELECTORS).forEach(img => { img.src = target; });
            } else if (field === 'heroBg') {
                state.global.heroBgSrc = src;
                const target = src || DEFAULT_HERO_SRC;
                if (HERO_BG_SELECTOR) document.querySelectorAll(HERO_BG_SELECTOR).forEach(img => { img.src = target; });
            }
            if (state.activeTab === 'global') renderActiveTab();
        }

        // -------------------------------------------------------------------
        // Afbeelding-routing
        // -------------------------------------------------------------------
        function imgEntry(img) { return editablesByKey[img.dataset.lbKey]; }
        function imgRoleOf(img) { const e = imgEntry(img); return e ? e.imgRole : 'content'; }
        function imgRegionOf(img) { const e = imgEntry(img); return e ? e.region : MODE; }
        // Main-afbeeldingen op een /p/-pagina worden inline in de pagina-HTML bewaard.
        function imgIsInlineMain(img) { return MODE === 'page' && imgRegionOf(img) === 'main'; }

        function changeImageSrc(img, src) {
            img.src = src;
            const role = imgRoleOf(img);
            if (role === 'logo') {
                state.global.logoSrc = src;
                if (LOGO_SELECTORS) document.querySelectorAll(LOGO_SELECTORS).forEach(i => { i.src = src; });
            } else if (role === 'herobg') {
                state.global.heroBgSrc = src;
                if (HERO_BG_SELECTOR) document.querySelectorAll(HERO_BG_SELECTOR).forEach(i => { i.src = src; });
            } else if (!imgIsInlineMain(img)) {
                setEdit(img.dataset.lbKey, 'img', src);
            }
            updatePageItemPreview(img.dataset.lbKey, (src.split('/').pop() || 'afbeelding'));
        }

        function changeImageAlt(img, alt) {
            img.setAttribute('alt', alt);
            const role = imgRoleOf(img);
            if (role === 'content' && !imgIsInlineMain(img)) setEdit(img.dataset.lbKey, 'alt', alt);
        }

        function resetImage(img) {
            const orig = img.dataset.lbImgOriginal;
            if (orig !== undefined) img.src = orig;
            const role = imgRoleOf(img);
            if (role === 'logo') {
                state.global.logoSrc = null;
                if (LOGO_SELECTORS) document.querySelectorAll(LOGO_SELECTORS).forEach(i => { i.src = orig || DEFAULT_LOGO_SRC; });
            } else if (role === 'herobg') {
                state.global.heroBgSrc = null;
                if (HERO_BG_SELECTOR) document.querySelectorAll(HERO_BG_SELECTOR).forEach(i => { i.src = orig || DEFAULT_HERO_SRC; });
            } else if (!imgIsInlineMain(img)) {
                setEdit(img.dataset.lbKey, 'img', null);
                setEdit(img.dataset.lbKey, 'alt', null);
            }
            renderActiveTab();
        }

        function bindEditableEntry(entry) {
            const el = entry.el;
            if (entry.type === 'image') {
                el.classList.add('lb-img-editable');
                el.addEventListener('click', e => {
                    if (!state.editMode) return;
                    e.preventDefault();
                    e.stopPropagation();
                    selectImage(el);
                });
                return;
            }
            el.addEventListener('click', e => {
                if (!state.editMode) return;
                if (el.getAttribute('contenteditable') === 'true') return;
                e.preventDefault();
                e.stopPropagation();
                selectElement(el.dataset.lbKey);
            });
            el.addEventListener('blur', () => {
                if (el.getAttribute('contenteditable') === 'true') deactivateContentEditable(el);
            }, true);
            el.addEventListener('input', () => {
                if (el.getAttribute('contenteditable') !== 'true') return;
                setEdit(el.dataset.lbKey, 'text', el.innerHTML);
                if (state.activeTab === 'element' && state.selectedKey === el.dataset.lbKey) {
                    const fieldEl = document.querySelector('[data-action="text"]');
                    if (fieldEl && document.activeElement !== fieldEl) fieldEl.value = el.innerHTML;
                }
                updatePageItemPreview(el.dataset.lbKey, el.textContent.trim().substring(0, 100));
            });
            el.addEventListener('keydown', e => {
                if (e.key === 'Escape') { e.preventDefault(); el.blur(); }
                if (e.key === 'Enter' && !e.shiftKey && el.tagName !== 'P' && el.tagName !== 'BLOCKQUOTE') {
                    e.preventDefault(); el.blur();
                }
            });
        }

        function rescanMain() {
            if (MODE !== 'page' || !ctx.main || !window.ILScan) return;
            const mainScan = window.ILScan.scanContainer(ctx.main);
            for (let i = editables.length - 1; i >= 0; i--) {
                if (editables[i].region === 'main') editables.splice(i, 1);
            }
            Object.keys(editablesByKey).forEach(k => {
                if (editablesByKey[k].region === 'main') delete editablesByKey[k];
            });
            mainScan.editables.forEach(e => {
                editables.push(e);
                editablesByKey[e.key] = e;
                bindEditableEntry(e);
            });
            const chromeIds = (window.ILSiteConfig && window.ILSiteConfig.chromeSections || []).map(s => s.id);
            const chromeSections = SECTIONS.filter(s => chromeIds.indexOf(s.id) !== -1);
            SECTIONS.length = 0;
            chromeSections.concat(mainScan.sections).forEach(s => SECTIONS.push(s));
        }

        async function addElement(elementId) {
            if (MODE !== 'page' || !ctx.main) return;
            try {
                const r = await fetch('/api/elements/' + encodeURIComponent(elementId));
                const d = await r.json();
                if (!r.ok || !d.html) { showToast(d.error || 'Element laden mislukt', 'error'); return; }
                const wrap = document.createElement('div');
                wrap.innerHTML = d.html.trim();
                while (wrap.firstChild) ctx.main.appendChild(wrap.firstChild);
                if (window.ILBooking && window.ILBooking.initAll) window.ILBooking.initAll();
                rescanMain();
                const picker = document.getElementById('lbElementPicker');
                if (picker) picker.hidden = true;
                renderActiveTab();
                showToast((d.name || 'Element') + ' toegevoegd — vergeet niet op te slaan', 'success');
            } catch (e) {
                showToast('Element toevoegen mislukt', 'error');
            }
        }

        // -------------------------------------------------------------------
        // Events
        // -------------------------------------------------------------------
        function bindEvents() {
            document.getElementById('lbToggle').addEventListener('click', toggleEditMode);
            document.getElementById('lbSave').addEventListener('click', () => save(true));
            document.getElementById('lbSavePanel').addEventListener('click', () => save(true));
            document.getElementById('lbReset').addEventListener('click', reset);
            document.getElementById('lbResetPanel').addEventListener('click', reset);
            document.getElementById('lbExit').addEventListener('click', exitToAdmin);
            document.getElementById('lbPanelClose').addEventListener('click', () => setEditMode(false));

            document.querySelectorAll('.lb-tab').forEach(t => {
                t.addEventListener('click', () => switchTab(t.dataset.tab));
            });

            const panelBody = document.getElementById('lbPanelBody');
            panelBody.addEventListener('click', handlePanelClick);
            panelBody.addEventListener('input', handlePanelInput);
            panelBody.addEventListener('change', handlePanelChange);

            editables.forEach(entry => bindEditableEntry(entry));

            // Cmd/Ctrl+S = opslaan
            document.addEventListener('keydown', e => {
                if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
                    e.preventDefault();
                    save(true);
                }
            });
        }

        function handlePanelClick(e) {
            const toggleEl = e.target.closest('[data-action="toggle"]');
            if (toggleEl) {
                const id = toggleEl.dataset.sectionId;
                const section = document.querySelector('.lb-section[data-section="' + id + '"]');
                if (section) section.classList.toggle('collapsed');
                return;
            }
            const focusEl = e.target.closest('[data-action="focus"]');
            if (focusEl) { selectElement(focusEl.dataset.key, true); return; }
            const focusImg = e.target.closest('[data-action="focusImg"]');
            if (focusImg) {
                const entry = editablesByKey[focusImg.dataset.key];
                if (entry) selectImage(entry.el, true);
                return;
            }
            const resetEl = e.target.closest('[data-action="resetEl"]');
            if (resetEl) { resetCurrentElement(); return; }
            const goEl = e.target.closest('[data-action="goToEl"]');
            if (goEl) { flashSelectedElement(); return; }
            const goImg = e.target.closest('[data-action="goToImg"]');
            if (goImg) { flashSelectedImage(); return; }
            const imgLibrary = e.target.closest('[data-action="imgLibrary"]');
            if (imgLibrary) {
                const field = imgLibrary.dataset.field;
                if (field === 'sel' && !state.selectedImg) return;
                openMediaPicker(field);
                return;
            }
            const imgUrl = e.target.closest('[data-action="imgUrl"]');
            if (imgUrl) {
                const field = imgUrl.dataset.field;
                if (field === 'sel') {
                    if (!state.selectedImg) return;
                    const u = prompt('Voer een URL in voor de afbeelding:', state.selectedImg.getAttribute('src') || '');
                    if (u !== null && u.trim()) { changeImageSrc(state.selectedImg, u.trim()); renderActiveTab(); }
                    return;
                }
                const cur = field === 'logo' ? (state.global.logoSrc || DEFAULT_LOGO_SRC) : (state.global.heroBgSrc || DEFAULT_HERO_SRC);
                const u = prompt('Voer een URL in voor de afbeelding:', cur);
                if (u !== null && u.trim()) setGlobalImage(field, u.trim());
                return;
            }
            const imgReset = e.target.closest('[data-action="imgReset"]');
            if (imgReset) {
                const field = imgReset.dataset.field;
                if (field === 'sel') {
                    if (state.selectedImg) resetImage(state.selectedImg);
                    return;
                }
                setGlobalImage(field, null);
                return;
            }
            const resetColors = e.target.closest('[data-action="resetColors"]');
            if (resetColors) {
                state.global.colors = {};
                COLOR_TOKENS.forEach(t => document.documentElement.style.removeProperty(t.var));
                renderActiveTab();
                return;
            }
            const toggleElements = e.target.closest('[data-action="toggleElements"]');
            if (toggleElements) { renderElementPicker(); return; }
            const pickElement = e.target.closest('[data-action="pickElement"]');
            if (pickElement) { addElement(pickElement.dataset.elementId); return; }
            const styleSwatch = e.target.closest('[data-action="styleSwatch"]');
            if (styleSwatch && state.selectedKey) {
                setStyleProp(state.selectedKey, styleSwatch.dataset.prop, styleSwatch.dataset.value);
                renderActiveTab();
                return;
            }
            const styleAlign = e.target.closest('[data-action="styleAlign"]');
            if (styleAlign && state.selectedKey) {
                setStyleProp(state.selectedKey, 'textAlign', styleAlign.dataset.value);
                renderActiveTab();
                return;
            }
            const resetStyle = e.target.closest('[data-action="resetStyle"]');
            if (resetStyle && state.selectedKey) {
                STYLE_KEYS.forEach(p => setStyleProp(state.selectedKey, p, null));
                renderActiveTab();
                return;
            }
        }

        function handlePanelInput(e) {
            const t = e.target;
            const action = t.dataset.action;
            if (!action) return;
            if (action === 'text') {
                if (!state.selectedKey) return;
                const entry = editablesByKey[state.selectedKey];
                if (!entry) return;
                entry.el.innerHTML = t.value;
                setEdit(state.selectedKey, 'text', t.value);
                updatePageItemPreview(state.selectedKey, entry.el.textContent.trim().substring(0, 100));
            } else if (action === 'href') {
                if (!state.selectedKey) return;
                const entry = editablesByKey[state.selectedKey];
                if (!entry || entry.el.tagName !== 'A') return;
                entry.el.setAttribute('href', t.value);
                setEdit(state.selectedKey, 'href', t.value);
            } else if (action === 'imgAlt') {
                if (state.selectedImg) changeImageAlt(state.selectedImg, t.value);
            } else if (action === 'color' || action === 'colorHex') {
                const varName = t.dataset.var;
                const value = t.value;
                if (!varName) return;
                state.global.colors[varName] = value;
                document.documentElement.style.setProperty(varName, value);
                const row = t.closest('.lb-color-row');
                if (row) {
                    const swatch = row.querySelector('.lb-color-swatch');
                    if (swatch) swatch.style.background = value;
                    const colorInput = row.querySelector('input[type="color"]');
                    const hexInput = row.querySelector('.lb-color-hex');
                    if (action === 'color' && hexInput) hexInput.value = value;
                    if (action === 'colorHex' && colorInput && /^#[0-9a-f]{6}$/i.test(value)) colorInput.value = value;
                }
            } else if (action === 'styleColor') {
                if (!state.selectedKey) return;
                setStyleProp(state.selectedKey, t.dataset.prop, t.value);
            } else if (action === 'stylePadY') {
                if (!state.selectedKey) return;
                const val = t.value ? (t.value + 'px') : null;
                setPaddingY(state.selectedKey, val);
                const lbl = t.closest('.lb-field') && t.closest('.lb-field').querySelector('.lb-range-val');
                if (lbl) lbl.textContent = val || '0';
            } else if (action === 'stylePadX') {
                if (!state.selectedKey) return;
                const val = t.value ? (t.value + 'px') : null;
                setPaddingX(state.selectedKey, val);
                const lbl = t.closest('.lb-field') && t.closest('.lb-field').querySelector('.lb-range-val');
                if (lbl) lbl.textContent = val || '0';
            } else if (action === 'styleRadius') {
                if (!state.selectedKey) return;
                const val = t.value ? (t.value + 'px') : null;
                setStyleProp(state.selectedKey, 'borderRadius', val);
                const lbl = t.closest('.lb-field') && t.closest('.lb-field').querySelector('.lb-range-val');
                if (lbl) lbl.textContent = val || '0';
            }
        }

        function handlePanelChange(e) {
            const t = e.target;
            const action = t.dataset.action;
            if (action === 'styleSelect') {
                if (!state.selectedKey) return;
                setStyleProp(state.selectedKey, t.dataset.prop, t.value || null);
                return;
            }
            if (action === 'target') {
                if (!state.selectedKey) return;
                const entry = editablesByKey[state.selectedKey];
                if (!entry || entry.el.tagName !== 'A') return;
                if (t.checked) {
                    entry.el.setAttribute('target', '_blank');
                    setEdit(state.selectedKey, 'target', '_blank');
                } else {
                    entry.el.removeAttribute('target');
                    setEdit(state.selectedKey, 'target', null);
                }
            } else if (action === 'imgUpload') {
                const field = t.dataset.field;
                const file = t.files && t.files[0];
                if (!file) return;
                if (file.size > 8 * 1024 * 1024) { showToast('Bestand te groot (max 8MB)', 'error'); return; }
                if (field === 'sel') uploadSelectedImage(state.selectedImg, file);
                else uploadGlobalImage(field, file);
            }
        }

        async function uploadGlobalImage(field, file) {
            showToast('Bezig met uploaden...', 'success');
            try {
                const fd = new FormData();
                fd.append('image', file);
                const res = await fetch('/api/upload', { method: 'POST', body: fd });
                if (res.status === 401) { showToast('Niet ingelogd - log in via /admin', 'error'); return; }
                const data = await res.json();
                if (data && data.src) {
                    setGlobalImage(field, data.src);
                    showToast('Afbeelding geüpload', 'success');
                } else {
                    showToast('Upload mislukt', 'error');
                }
            } catch (err) {
                showToast('Upload mislukt', 'error');
            }
        }

        async function uploadSelectedImage(img, file) {
            if (!img) return;
            showToast('Bezig met uploaden...', 'success');
            try {
                const fd = new FormData();
                fd.append('image', file);
                const res = await fetch('/api/upload', { method: 'POST', body: fd });
                if (res.status === 401) { showToast('Niet ingelogd - log in via /admin', 'error'); return; }
                const data = await res.json();
                if (data && data.src) {
                    changeImageSrc(img, data.src);
                    renderActiveTab();
                    showToast('Afbeelding vervangen', 'success');
                } else {
                    showToast('Upload mislukt', 'error');
                }
            } catch (err) {
                showToast('Upload mislukt', 'error');
            }
        }

        // -------------------------------------------------------------------
        // Selectie
        // -------------------------------------------------------------------
        function selectElement(key, scrollTo) {
            document.querySelectorAll('.lb-selected').forEach(el => el.classList.remove('lb-selected'));
            if (activeContentEditableEl) deactivateContentEditable(activeContentEditableEl);
            state.selectedImg = null;

            const entry = editablesByKey[key];
            if (!entry) { state.selectedKey = null; renderActiveTab(); return; }

            state.selectedKey = key;
            entry.el.classList.add('lb-selected');

            if (state.activeTab !== 'element') switchTab('element');
            else renderActiveTab();

            if (scrollTo) {
                entry.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => {
                    entry.el.classList.add('lb-flash');
                    setTimeout(() => entry.el.classList.remove('lb-flash'), 1300);
                }, 400);
            }

            if (entry.type === 'text' || entry.type === 'link' || entry.type === 'button') {
                setTimeout(() => activateContentEditable(entry.el), scrollTo ? 700 : 50);
            }
        }

        function selectImage(img, scrollTo) {
            document.querySelectorAll('.lb-selected').forEach(el => el.classList.remove('lb-selected'));
            if (activeContentEditableEl) deactivateContentEditable(activeContentEditableEl);
            state.selectedKey = null;
            state.selectedImg = img;
            img.classList.add('lb-selected');
            if (state.activeTab !== 'element') switchTab('element');
            else renderActiveTab();
            if (scrollTo) flashEl(img);
        }

        function activateContentEditable(el) {
            el.setAttribute('contenteditable', 'true');
            el.focus();
            setTimeout(() => {
                try {
                    const range = document.createRange();
                    range.selectNodeContents(el);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                } catch(e) {}
            }, 10);
            activeContentEditableEl = el;
        }

        function deactivateContentEditable(el) {
            el.removeAttribute('contenteditable');
            if (activeContentEditableEl === el) activeContentEditableEl = null;
        }

        function flashSelectedElement() {
            if (!state.selectedKey) return;
            const entry = editablesByKey[state.selectedKey];
            if (!entry) return;
            flashEl(entry.el);
        }

        function flashSelectedImage() {
            if (state.selectedImg) flashEl(state.selectedImg);
        }

        function flashEl(el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
                el.classList.add('lb-flash');
                setTimeout(() => el.classList.remove('lb-flash'), 1300);
            }, 400);
        }

        function resetCurrentElement() {
            if (!state.selectedKey) return;
            const entry = editablesByKey[state.selectedKey];
            if (!entry) return;
            const el = entry.el;
            if (el.dataset.lbOriginal !== undefined) el.innerHTML = el.dataset.lbOriginal;
            if (el.tagName === 'A' && el.dataset.lbHrefOriginal !== undefined) {
                el.setAttribute('href', el.dataset.lbHrefOriginal);
                el.removeAttribute('target');
            }
            STYLE_KEYS.forEach(p => setStyleProp(state.selectedKey, p, null));
            delete state.edits[state.selectedKey];
            renderActiveTab();
            showToast('Element gereset', 'success');
        }

        function updatePageItemPreview(key, text) {
            const item = document.querySelector('.lb-item[data-key="' + key + '"]');
            if (item) {
                const preview = item.querySelector('.lb-item-preview');
                if (preview) preview.textContent = text;
            }
        }

        // -------------------------------------------------------------------
        // Tabs & modus
        // -------------------------------------------------------------------
        function switchTab(tab) { state.activeTab = tab; renderActiveTab(); }
        function toggleEditMode() { setEditMode(!state.editMode); }

        function setEditMode(on) {
            state.editMode = on;
            document.body.classList.toggle('lb-edit-mode', on);
            document.body.classList.toggle('lb-panel-open', on);
            document.getElementById('lbToggle').classList.toggle('active', on);
            document.getElementById('lbPanel').classList.toggle('open', on);
            if (!on) {
                document.querySelectorAll('.lb-selected').forEach(el => el.classList.remove('lb-selected'));
                if (activeContentEditableEl) deactivateContentEditable(activeContentEditableEl);
                state.selectedKey = null;
                state.selectedImg = null;
            }
        }

        // -------------------------------------------------------------------
        // Opslaan / reset (server)
        // -------------------------------------------------------------------
        async function save(notify) {
            if (MODE === 'page') return savePage(notify);
            try {
                const res = await fetch('/api/content', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ edits: state.edits, global: state.global })
                });
                if (res.status === 401) { showToast('Niet ingelogd - log in via /admin', 'error'); return false; }
                if (!res.ok) throw new Error('save failed');
                if (notify) showToast('Wijzigingen opgeslagen en live', 'success');
                return true;
            } catch (err) {
                showToast('Opslaan mislukt', 'error');
                return false;
            }
        }

        // Paginamodus: split-save.
        //   <main>  -> PUT /api/pages/:id { html }
        //   chrome  -> PUT /api/content  (gemerged met bestaande overrides)
        async function savePage(notify) {
            if (activeContentEditableEl) deactivateContentEditable(activeContentEditableEl);
            const html = serializePageHtml();

            // 1. Main-HTML opslaan.
            try {
                const pageRes = await fetch('/api/pages/' + encodeURIComponent(ctx.page.id), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ html: html })
                });
                if (pageRes.status === 401) { showToast('Niet ingelogd - log in via /admin', 'error'); return false; }
                if (!pageRes.ok) throw new Error('page save failed');
            } catch (err) {
                showToast('Opslaan pagina mislukt', 'error');
                return false;
            }

            // 2. Chrome-edits (topstrip/nav/footer) + globaal logo mergen in content.json.
            const chromeEdits = {};
            Object.keys(state.edits).forEach(k => {
                const e = editablesByKey[k];
                if (e && e.region === 'chrome') chromeEdits[k] = state.edits[k];
            });
            const hasGlobal = state.global.logoSrc != null;
            if (Object.keys(chromeEdits).length || hasGlobal) {
                try {
                    const cur = await fetch('/api/content').then(r => (r.ok ? r.json() : {})).catch(() => ({}));
                    const mergedEdits = Object.assign({}, cur.edits || {}, chromeEdits);
                    const mergedGlobal = Object.assign({ colors: {}, logoSrc: null, heroBgSrc: null }, cur.global || {});
                    if (state.global.logoSrc != null) mergedGlobal.logoSrc = state.global.logoSrc;
                    const res = await fetch('/api/content', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ edits: mergedEdits, global: mergedGlobal })
                    });
                    if (!res.ok) throw new Error('content save failed');
                } catch (err) {
                    showToast('Pagina opgeslagen, nav/footer-sync mislukt', 'error');
                    return false;
                }
            }
            if (notify) showToast('Pagina opgeslagen en live', 'success');
            return true;
        }

        function serializePageHtml() {
            const clone = ctx.main.cloneNode(true);
            clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
            ['data-lb-key', 'data-lb-original', 'data-lb-href-original', 'data-lb-secid', 'data-lb-img-original'].forEach(attr => {
                clone.querySelectorAll('[' + attr + ']').forEach(el => el.removeAttribute(attr));
            });
            clone.querySelectorAll('[data-cursor-ref]').forEach(el => el.removeAttribute('data-cursor-ref'));
            clone.querySelectorAll('[class]').forEach(el => {
                const kept = Array.from(el.classList).filter(c => !/^lb-/.test(c));
                if (kept.length) el.setAttribute('class', kept.join(' '));
                else el.removeAttribute('class');
            });
            return clone.innerHTML.trim();
        }

        async function reset() {
            if (MODE === 'page') {
                if (!confirm('Pagina opnieuw laden? Niet-opgeslagen wijzigingen gaan verloren.')) return;
                window.location.reload();
                return;
            }
            if (!confirm('Alle wijzigingen verwijderen en terug naar het origineel?')) return;
            state.edits = {};
            state.global = { colors: {}, logoSrc: null, heroBgSrc: null };
            state.selectedKey = null;
            state.selectedImg = null;
            editables.forEach(entry => {
                const el = entry.el;
                if (entry.type === 'image') {
                    if (el.dataset.lbImgOriginal !== undefined) el.src = el.dataset.lbImgOriginal;
                    return;
                }
                if (el.dataset.lbOriginal !== undefined) el.innerHTML = el.dataset.lbOriginal;
                if (el.tagName === 'A' && el.dataset.lbHrefOriginal !== undefined) {
                    el.setAttribute('href', el.dataset.lbHrefOriginal);
                    el.removeAttribute('target');
                }
            });
            COLOR_TOKENS.forEach(t => document.documentElement.style.removeProperty(t.var));
            if (LOGO_SELECTORS) document.querySelectorAll(LOGO_SELECTORS).forEach(img => { img.src = DEFAULT_LOGO_SRC; });
            if (HERO_BG_SELECTOR) document.querySelectorAll(HERO_BG_SELECTOR).forEach(img => { img.src = DEFAULT_HERO_SRC; });
            renderActiveTab();
            await save(false);
            showToast('Alles gereset', 'success');
        }

        function exitToAdmin() {
            window.location.href = '/admin';
        }

        function showToast(message, type) {
            const toast = document.getElementById('lbToast');
            if (!toast) return;
            const icon = type === 'error'
                ? '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2"/></svg>';
            toast.innerHTML = icon + '<span>' + message + '</span>';
            toast.className = 'lb-toast ' + (type || 'success') + ' show';
            clearTimeout(toast._timeout);
            toast._timeout = setTimeout(() => { toast.className = 'lb-toast ' + (type || 'success'); }, 2600);
        }

        // -------------------------------------------------------------------
        // Init: controleer of we ingelogd zijn, daarna UI tonen
        // -------------------------------------------------------------------
        const startHint = MODE === 'page'
            ? 'Klik op een element of afbeelding om het te bewerken'
            : 'Klik op een element of afbeelding om het te bewerken';

        fetch('/api/me').then(r => r.json()).then(me => {
            if (!me || !me.isAdmin) {
                alert('Je bent niet ingelogd. Je wordt doorgestuurd naar de admin-login.');
                window.location.href = '/admin';
                return;
            }
            renderUI();
            bindEvents();
            setEditMode(true);
            setTimeout(() => showToast(startHint, 'success'), 500);
        }).catch(() => {
            renderUI();
            bindEvents();
            setEditMode(true);
        });
    }

    boot();
})();
