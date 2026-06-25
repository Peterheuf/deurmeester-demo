/**
 * DeurMeester pagina-design varianten — maps design choices to CSS + generator instructions.
 * Blijft binnen het DeurMeester merk (--ink, --paper, --copper) maar maakt elke pagina visueel uniek.
 */

const DESIGN_DEFAULTS = {
    sfeer: 'warm luxe',
    layout: 'veel witruimte',
    kleuraccent: 'eiken',
    typografie: 'editorial',
    beelden: 'grote hero',
    sectiestijl: 'afwisselend',
    cta: 'opvallend koper',
    uniek: 'statistieken'
};

const DESIGN_LABELS = {
    sfeer: 'Sfeer',
    layout: 'Layout',
    kleuraccent: 'Kleuraccent',
    typografie: 'Typografie',
    beelden: 'Beelden',
    sectiestijl: 'Sectiestijl',
    cta: 'CTA-stijl',
    uniek: 'Uniek element'
};

const DESIGN_ICONS = {
    sfeer: '✨',
    layout: '📐',
    kleuraccent: '🎨',
    typografie: 'Aa',
    beelden: '🖼',
    sectiestijl: '▦',
    cta: '◎',
    uniek: '★'
};

/** Normaliseer ruwe design-waarden uit het plan of gesprek. */
function normalizeDesign(raw) {
    const d = raw && typeof raw === 'object' ? { ...raw } : {};
    const out = { ...DESIGN_DEFAULTS };
    Object.keys(DESIGN_DEFAULTS).forEach(key => {
        const val = String(d[key] || d[key === 'kleuraccent' ? 'kleur' : ''] || '').trim();
        if (val) out[key] = val;
    });
    return out;
}

/** Welke design-dimensies zijn nog niet ingevuld (voor agent-hints). */
function missingDesignKeys(design) {
    const d = normalizeDesign(design);
    return Object.keys(DESIGN_DEFAULTS).filter(k => !d[k] || d[k] === DESIGN_DEFAULTS[k]);
}

const VARIANT_MAP = {
    sfeer: {
        'minimalistisch': {
            classes: 'dm-sfeer-minimal',
            prompt: 'Minimalistische sfeer: veel witruimte, strakke grids, weinig decoratie, subtiele borders, rustige typografie. Koper spaarzaam als accent.',
            css: `.dm-sfeer-minimal .section { padding: 8rem 5vw; }
.dm-sfeer-minimal .card { border-radius: 2px; box-shadow: none; }
.dm-sfeer-minimal .page-hero h1 { font-size: clamp(32px, 5vw, 56px); max-width: 18ch; }`
        },
        'warm luxe': {
            classes: 'dm-sfeer-warm',
            prompt: 'Warm & luxe sfeer: rijke paper-warm/paper-deep achtergronden, zachte schaduwen op kaarten, elegante serif-koppen, gouden koper-accenten.',
            css: `.dm-sfeer-warm .section-warm { background: var(--paper-warm); }
.dm-sfeer-warm .card:hover { box-shadow: 0 32px 64px -24px rgba(92,74,58,0.25); }`
        },
        'industrieel': {
            classes: 'dm-sfeer-industrieel',
            prompt: 'Industriële sfeer: donkere secties (section-ink), strakke lijnen, minder koper — meer zwart staal en grijstinten. Robuust en modern.',
            css: `.dm-sfeer-industrieel { --copper: #6b6b6b; --copper-hot: #4a4a4a; }
.dm-sfeer-industrieel .section-ink { background: #141414; }
.dm-sfeer-industrieel .eyebrow { color: #999; letter-spacing: 0.35em; }`
        },
        'scandinavisch licht': {
            classes: 'dm-sfeer-scandi',
            prompt: 'Scandinavisch licht: helder papier, lichte secties, veel lucht, zachte sage-tinten, natuurlijke houtreferenties.',
            css: `.dm-sfeer-scandi .section { background: #fdfcfa; padding: 6.5rem 5vw; }
.dm-sfeer-scandi .section-warm { background: #f7f3ee; }`
        },
        'klassiek chique': {
            classes: 'dm-sfeer-klassiek',
            prompt: 'Klassiek chique: serif-heavy koppen, elegante borders, verfijnde spacing, traditionele luxe uitstraling voor maatwerk deuren.',
            css: `.dm-sfeer-klassiek h2 { font-style: italic; }
.dm-sfeer-klassiek .section-head { border-bottom: 1px solid var(--line); padding-bottom: 2rem; }`
        }
    },
    layout: {
        'veel witruimte': {
            classes: 'dm-layout-spacious',
            prompt: 'Layout met veel witruimte: ruime padding (8rem+), smalle tekstkolommen (max 640px), grote gaps tussen secties.',
            css: `.dm-layout-spacious .section { padding: 8.5rem 5vw; }
.dm-layout-spacious .section-head { margin-bottom: 4.5rem; }
.dm-layout-spacious .container { max-width: 960px; }`
        },
        'compact': {
            classes: 'dm-layout-compact',
            prompt: 'Compacte layout: minder verticale padding (4-5rem), dichtere grids, meer inhoud per scherm.',
            css: `.dm-layout-compact .section { padding: 4.5rem 5vw; }
.dm-layout-compact .card-grid { gap: 1.25rem; }
.dm-layout-compact .section-head { margin-bottom: 2rem; }`
        },
        'asymmetrisch': {
            classes: 'dm-layout-asym',
            prompt: 'Asymmetrische layout: offset grids, split-kolommen met 60/40 verhouding, overlappende beelden, niet-gecentreerde section-heads.',
            css: `.dm-layout-asym .split { grid-template-columns: 1.15fr 0.85fr; gap: 3rem; align-items: center; }
.dm-layout-asym .section-head { text-align: left; margin-left: 0; max-width: 560px; }
.dm-layout-asym .dm-overlap-img { margin-top: -3rem; position: relative; z-index: 2; box-shadow: 0 24px 48px rgba(0,0,0,0.15); }`
        },
        'full-width hero': {
            classes: 'dm-layout-hero-fw',
            prompt: 'Full-width hero: grote hero met achtergrondafbeelding over volle breedte, container-wide voor content eronder.',
            css: `.dm-layout-hero-fw .page-hero { padding: 0; min-height: 72vh; display: flex; align-items: flex-end; background-size: cover; background-position: center; }
.dm-layout-hero-fw .page-hero .container { padding: 4rem 5vw; background: linear-gradient(transparent, rgba(30,30,30,0.85)); width: 100%; text-align: left; }
.dm-layout-hero-fw .page-hero h1 { max-width: 16ch; text-align: left; margin-left: 0; }`
        },
        'kaarten-grid': {
            classes: 'dm-layout-cards',
            prompt: 'Kaarten-grid layout: hoofdinhoud in card-grid (3 kolommen), secties als kaartenclusters.',
            css: `.dm-layout-cards .card-grid { grid-template-columns: repeat(3, 1fr); gap: 1.75rem; }
@media (max-width: 900px) { .dm-layout-cards .card-grid { grid-template-columns: 1fr; } }`
        }
    },
    kleuraccent: {
        'eiken': {
            classes: 'dm-accent-eiken',
            prompt: 'Kleuraccent eiken (standaard DeurMeester): warme koper- en houttinten via --copper en --paper-warm.',
            css: ''
        },
        'donker hout': {
            classes: 'dm-accent-donker-hout',
            prompt: 'Kleuraccent donker hout: diepere sage/sage-deep tinten, warme donkere borders.',
            css: `.dm-accent-donker-hout { --sage-deep: #1f1814; --copper: #8f6b4a; }
.dm-accent-donker-hout .btn { background: var(--sage-deep); }`
        },
        'zwart staal': {
            classes: 'dm-accent-staal',
            prompt: 'Kleuraccent zwart staal: --ink dominant, koper vervangen door koel grijs-zwart, industriële accenten.',
            css: `.dm-accent-staal { --copper: #3d3d3d; --copper-hot: #1e1e1e; --copper-soft: #6b6b6b; }
.dm-accent-staal .eyebrow { color: #555; }`
        },
        'sage groen': {
            classes: 'dm-accent-sage',
            prompt: 'Kleuraccent sage groen: zachte sage-tinten als accent naast koper.',
            css: `.dm-accent-sage { --copper: #6b7c5e; --copper-hot: #4a5a42; --copper-soft: #9aab8c; }`
        },
        'custom': {
            classes: 'dm-accent-custom',
            prompt: 'Custom kleuraccent: behoud DeurMeester basis maar varieer accent subtiel op basis van pagina-inhoud.',
            css: ''
        }
    },
    typografie: {
        'editorial': {
            classes: 'dm-type-editorial',
            prompt: 'Editorial typografie: grote h1/h2 (clamp 40-72px), lead prominent, ruime line-height.',
            css: `.dm-type-editorial h1 { font-size: clamp(40px, 7vw, 72px); }
.dm-type-editorial h2 { font-size: clamp(36px, 5vw, 60px); }
.dm-type-editorial .lead { font-size: clamp(22px, 2.8vw, 30px); }`
        },
        'zakelijk compact': {
            classes: 'dm-type-compact',
            prompt: 'Zakelijk compact: kleinere koppen, strakke Montserrat-body, efficiënte hiërarchie.',
            css: `.dm-type-compact h1 { font-size: clamp(28px, 4.5vw, 44px); font-family: Montserrat, sans-serif; font-weight: 600; }
.dm-type-compact h2 { font-size: clamp(24px, 3vw, 36px); }
.dm-type-compact p { font-size: 15px; line-height: 1.6; }`
        },
        'elegant serif-heavy': {
            classes: 'dm-type-serif',
            prompt: 'Elegant serif-heavy: Libre Caslon overal waar mogelijk, italic accenten, Caveat voor handgeschreven details.',
            css: `.dm-type-serif h3, .dm-type-serif h4 { font-family: 'Libre Caslon Text', serif; }
.dm-type-serif .card h3 { font-style: italic; }`
        }
    },
    beelden: {
        'grote hero': {
            classes: 'dm-beeld-hero',
            prompt: 'Grote hero-foto: prominente hero-afbeelding (full-width of grote split), beelden groot en sfeervol.',
            css: `.dm-beeld-hero .page-hero-img { width: 100%; aspect-ratio: 21/9; object-fit: cover; border-radius: 4px; }`
        },
        'kleine beelden': {
            classes: 'dm-beeld-klein',
            prompt: 'Kleine beelden: compacte thumbnails in cards, geen dominante hero-foto.',
            css: `.dm-beeld-klein .card.card-photo img { aspect-ratio: 16/10; max-height: 180px; }
.dm-beeld-klein .page-hero { background: var(--paper-warm); color: var(--ink); }
.dm-beeld-klein .page-hero h1 { color: var(--ink); }`
        },
        'geen foto focus op tekst': {
            classes: 'dm-beeld-tekst',
            prompt: 'Geen foto-focus: tekstgedreven pagina, minimale of geen afbeeldingen, typografie en copy centraal.',
            css: `.dm-beeld-tekst .page-hero { background: var(--paper-warm); color: var(--ink); padding: 7rem 5vw; }
.dm-beeld-tekst .page-hero h1 { color: var(--ink); max-width: 20ch; }`
        },
        'galerij': {
            classes: 'dm-beeld-galerij',
            prompt: 'Galerij: een sectie met 3-6 beelden in grid (dm-gallery), showcase van deuren/projecten.',
            css: `.dm-gallery { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
.dm-gallery img { aspect-ratio: 4/3; object-fit: cover; width: 100%; border-radius: 4px; }
@media (max-width: 700px) { .dm-gallery { grid-template-columns: 1fr 1fr; } }`
        }
    },
    sectiestijl: {
        'donkere blokken': {
            classes: 'dm-secties-donker',
            prompt: 'Donkere sectieblokken: meeste secties section-ink of section-sage.',
            css: ''
        },
        'lichte blokken': {
            classes: 'dm-secties-licht',
            prompt: 'Lichte sectieblokken: paper en paper-warm, geen donkere secties behalve hero/CTA.',
            css: `.dm-secties-licht .section { background: var(--paper); }
.dm-secties-licht .section:nth-child(even) { background: var(--paper-warm); }`
        },
        'afwisselend': {
            classes: 'dm-secties-afwisselend',
            prompt: 'Afwisselende secties: wissel section, section-warm, section-ink af voor ritme.',
            css: ''
        },
        'één doorlopend': {
            classes: 'dm-secties-doorlopend',
            prompt: 'Één doorlopende stijl: uniforme achtergrond, subtiele scheidingen via borders.',
            css: `.dm-secties-doorlopend .section { background: var(--paper); border-top: 1px solid var(--line); padding: 5rem 5vw; }`
        }
    },
    cta: {
        'subtiel': {
            classes: 'dm-cta-subtiel',
            prompt: 'Subtiele CTA: btn-link tekstlinks, geen opvallende knoppen.',
            css: `.dm-cta-subtiel .cta, .dm-cta-subtiel .btn.cta { background: transparent; color: var(--ink); border: 1px solid var(--line); box-shadow: none; }
.dm-cta-subtiel .cta:hover { background: var(--paper-warm); }`
        },
        'opvallend koper': {
            classes: 'dm-cta-koper',
            prompt: 'Opvallende koperen CTA: grote .cta knoppen in --copper, duidelijk zichtbaar.',
            css: `.dm-cta-koper .cta { padding: 1.15rem 2.2rem; font-size: 12px; background: var(--copper); }`
        },
        'donkere knop': {
            classes: 'dm-cta-donker',
            prompt: 'Donkere knop CTA: .btn in sage-deep/ink, krachtig contrast.',
            css: `.dm-cta-donker .cta, .dm-cta-donker .btn.cta { background: var(--sage-deep); }
.dm-cta-donker .cta:hover { background: var(--ink); }`
        }
    },
    uniek: {
        'quote-blok': {
            classes: 'dm-uniek-quote',
            prompt: 'Uniek element: prominent quote-blok (class quote) met getuigenis of filosofie.',
            css: `.dm-uniek-quote .quote { margin: 2rem 0; padding: 2rem 0 2rem 2rem; }`
        },
        'statistieken': {
            classes: 'dm-uniek-stats',
            prompt: 'Uniek element: statistiekenrij (dm-stats) zoals homepage locatie-sectie — 3-4 cijfers met korte toelichting.',
            css: `.dm-stats { display: grid; gap: 1rem; margin: 2rem 0; }
.dm-stat { display: grid; grid-template-columns: 90px 1fr; gap: 1.25rem; padding: 1.25rem 0; border-top: 1px solid var(--line); align-items: baseline; }
.dm-stat:last-child { border-bottom: 1px solid var(--line); }
.dm-stat .num { font-family: 'Libre Caslon Text', serif; font-style: italic; font-size: 30px; color: var(--copper); line-height: 1; }
.dm-stat .desc { font-size: 14px; color: var(--ink-soft); }
.dm-stat .desc strong { display: block; color: var(--ink); font-weight: 600; }`
        },
        'tijdlijn': {
            classes: 'dm-uniek-timeline',
            prompt: 'Uniek element: tijdlijn (dm-timeline) met stappen/proces (meten, bestellen, monteren).',
            css: `.dm-timeline { border-left: 2px solid var(--copper); margin: 2rem 0; padding-left: 1.5rem; }
.dm-timeline-item { margin-bottom: 1.75rem; position: relative; }
.dm-timeline-item::before { content: ''; position: absolute; left: -1.65rem; top: 0.35rem; width: 10px; height: 10px; background: var(--copper); border-radius: 50%; }
.dm-timeline-item strong { display: block; font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--copper); margin-bottom: 0.35rem; }`
        },
        'before-after': {
            classes: 'dm-uniek-before-after',
            prompt: 'Uniek element: before/after vergelijking (dm-before-after) — twee kolommen oud vs nieuw.',
            css: `.dm-before-after { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin: 2rem 0; }
.dm-before-after figure { margin: 0; }
.dm-before-after img { width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 4px; }
.dm-before-after figcaption { font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--stone); margin-top: 0.5rem; }
@media (max-width: 700px) { .dm-before-after { grid-template-columns: 1fr; } }`
        },
        'faq accordion': {
            classes: 'dm-uniek-faq',
            prompt: 'Uniek element: FAQ accordion (dm-faq) met details/summary voor veelgestelde vragen.',
            css: `.dm-faq { margin: 2rem 0; border-top: 1px solid var(--line); }
.dm-faq details { border-bottom: 1px solid var(--line); padding: 1rem 0; }
.dm-faq summary { font-weight: 600; cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; }
.dm-faq summary::-webkit-details-marker { display: none; }
.dm-faq summary::after { content: '+'; color: var(--copper); font-size: 1.25rem; }
.dm-faq details[open] summary::after { content: '−'; }
.dm-faq p { margin-top: 0.75rem; font-size: 14px; color: var(--ink-soft); }`
        }
    }
};

function matchVariant(dimension, value) {
    const map = VARIANT_MAP[dimension] || {};
    const v = String(value || '').toLowerCase().trim();
    const keys = Object.keys(map);
    const exact = keys.find(k => k.toLowerCase() === v);
    if (exact) return map[exact];
    const partial = keys.find(k => v.includes(k.toLowerCase()) || k.toLowerCase().includes(v));
    if (partial) return map[partial];
    return map[keys[0]] || { classes: '', prompt: '', css: '' };
}

function getBodyClasses(design) {
    const d = normalizeDesign(design);
    const classes = ['dm-page'];
    Object.keys(DESIGN_DEFAULTS).forEach(dim => {
        const v = matchVariant(dim, d[dim]);
        if (v.classes) classes.push(v.classes);
    });
    return classes.join(' ');
}

function getDesignCss(design) {
    const d = normalizeDesign(design);
    const chunks = [];
    Object.keys(DESIGN_DEFAULTS).forEach(dim => {
        const v = matchVariant(dim, d[dim]);
        if (v.css) chunks.push(v.css);
    });
    return chunks.filter(Boolean).join('\n\n');
}

function getDesignPromptBlock(design) {
    const d = normalizeDesign(design);
    const lines = [
        '## PAGINA-DESIGN (strikt toepassen — pagina moet UNIEK ogen binnen DeurMeester huisstijl)',
        'Wrap de volledige body-inhoud in: <div class="' + getBodyClasses(d) + '">...</div>',
        '',
        'Designkeuzes:'
    ];
    Object.keys(DESIGN_DEFAULTS).forEach(dim => {
        const label = DESIGN_LABELS[dim] || dim;
        const v = matchVariant(dim, d[dim]);
        lines.push('- ' + label + ': ' + d[dim]);
        if (v.prompt) lines.push('  → ' + v.prompt);
    });
    const css = getDesignCss(d);
    if (css) {
        lines.push('');
        lines.push('Voeg ÉÉN <style>-blok toe direct na de opening <div class="dm-page..."> met deze pagina-specifieke CSS:');
        lines.push(css);
        lines.push('Gebruik bestaande site-base.css classes daarnaast. Blijf binnen --ink, --paper, --copper tokens.');
    }
    const uniek = matchVariant('uniek', d.uniek);
    lines.push('');
    lines.push('VERPLICHT uniek element: bouw een volledige sectie met het gekozen type ("' + d.uniek + '"). Gebruik de bijbehorende HTML-structuur en classes.');
    if (d.uniek.toLowerCase().includes('stat')) {
        lines.push('Voorbeeld stats HTML: <div class="dm-stats"><div class="dm-stat"><span class="num">15+</span><div class="desc"><strong>Jaar ervaring</strong>Maatwerk deuren</div></div>...</div>');
    }
    return lines.join('\n');
}

/** Design-vraag opties voor de agent (clickable choices). */
const DESIGN_QUESTION_BANK = [
    {
        id: 'design_sfeer',
        question: 'Welke sfeer past bij deze pagina?',
        dimension: 'sfeer',
        choices: [
            { id: 'sfeer_min', label: 'Minimalistisch', value: 'Ik kies voor een minimalistische sfeer' },
            { id: 'sfeer_warm', label: 'Warm & luxe', value: 'Ik kies voor een warme, luxe sfeer' },
            { id: 'sfeer_ind', label: 'Industrieel', value: 'Ik kies voor een industriële sfeer' },
            { id: 'sfeer_scandi', label: 'Scandinavisch licht', value: 'Ik kies voor een Scandinavisch lichte sfeer' },
            { id: 'sfeer_klassiek', label: 'Klassiek chique', value: 'Ik kies voor een klassiek chique sfeer' }
        ]
    },
    {
        id: 'design_layout',
        question: 'Hoe moet de layout aanvoelen?',
        dimension: 'layout',
        choices: [
            { id: 'lay_space', label: 'Veel witruimte', value: 'Layout met veel witruimte' },
            { id: 'lay_compact', label: 'Compact', value: 'Compacte layout' },
            { id: 'lay_asym', label: 'Asymmetrisch', value: 'Asymmetrische layout' },
            { id: 'lay_hero', label: 'Full-width hero', value: 'Full-width hero layout' },
            { id: 'lay_cards', label: 'Kaarten-grid', value: 'Kaarten-grid layout' }
        ]
    },
    {
        id: 'design_kleur',
        question: 'Welk kleuraccent past het beste?',
        dimension: 'kleuraccent',
        choices: [
            { id: 'kleur_eiken', label: 'Eiken (standaard)', value: 'Kleuraccent eiken' },
            { id: 'kleur_hout', label: 'Donker hout', value: 'Kleuraccent donker hout' },
            { id: 'kleur_staal', label: 'Zwart staal', value: 'Kleuraccent zwart staal' },
            { id: 'kleur_sage', label: 'Sage groen', value: 'Kleuraccent sage groen' },
            { id: 'kleur_custom', label: 'Iets anders', value: 'Een custom kleuraccent' }
        ]
    },
    {
        id: 'design_type',
        question: 'Welk typografie-gevoel wil je?',
        dimension: 'typografie',
        choices: [
            { id: 'type_edit', label: 'Groot & editorial', value: 'Grote editorial typografie' },
            { id: 'type_compact', label: 'Zakelijk compact', value: 'Zakelijk compacte typografie' },
            { id: 'type_serif', label: 'Elegant serif-heavy', value: 'Elegant serif-heavy typografie' }
        ]
    },
    {
        id: 'design_beelden',
        question: 'Hoe wil je met beelden omgaan?',
        dimension: 'beelden',
        choices: [
            { id: 'beeld_hero', label: 'Grote hero-foto', value: 'Grote hero-foto' },
            { id: 'beeld_klein', label: 'Kleine beelden', value: 'Kleine beelden' },
            { id: 'beeld_tekst', label: 'Focus op tekst', value: 'Geen foto, focus op tekst' },
            { id: 'beeld_gal', label: 'Galerij', value: 'Beeldengalerij' }
        ]
    },
    {
        id: 'design_secties',
        question: 'Welke sectiestijl past bij de pagina?',
        dimension: 'sectiestijl',
        choices: [
            { id: 'sec_donker', label: 'Donkere blokken', value: 'Donkere sectieblokken' },
            { id: 'sec_licht', label: 'Lichte blokken', value: 'Lichte sectieblokken' },
            { id: 'sec_afw', label: 'Afwisselend', value: 'Afwisselende sectiestijl' },
            { id: 'sec_door', label: 'Één doorlopend', value: 'Één doorlopende sectiestijl' }
        ]
    },
    {
        id: 'design_cta',
        question: 'Hoe opvallend moet de call-to-action zijn?',
        dimension: 'cta',
        choices: [
            { id: 'cta_sub', label: 'Subtiel', value: 'Subtiele CTA-stijl' },
            { id: 'cta_koper', label: 'Opvallend koper', value: 'Opvallende koperen CTA' },
            { id: 'cta_donker', label: 'Donkere knop', value: 'Donkere knop als CTA' }
        ]
    },
    {
        id: 'design_uniek',
        question: 'Welk uniek element wil je op de pagina?',
        dimension: 'uniek',
        choices: [
            { id: 'uniek_quote', label: 'Quote-blok', value: 'Een quote-blok als uniek element' },
            { id: 'uniek_stats', label: 'Statistieken', value: 'Statistieken als uniek element' },
            { id: 'uniek_time', label: 'Tijdlijn', value: 'Een tijdlijn als uniek element' },
            { id: 'uniek_ba', label: 'Before/after', value: 'Before/after vergelijking als uniek element' },
            { id: 'uniek_faq', label: 'FAQ accordion', value: 'FAQ accordion als uniek element' }
        ]
    }
];

function designSummaryForDisplay(design) {
    const d = normalizeDesign(design);
    return Object.keys(DESIGN_LABELS).map(key => ({
        key,
        label: DESIGN_LABELS[key],
        icon: DESIGN_ICONS[key],
        value: d[key]
    }));
}

module.exports = {
    DESIGN_DEFAULTS,
    DESIGN_LABELS,
    DESIGN_ICONS,
    DESIGN_QUESTION_BANK,
    normalizeDesign,
    missingDesignKeys,
    matchVariant,
    getBodyClasses,
    getDesignCss,
    getDesignPromptBlock,
    designSummaryForDisplay
};
