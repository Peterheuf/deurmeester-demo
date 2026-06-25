/**
 * DeurMeester pagina-design — strikt binnen huisstijl en homepage-sectietypes.
 * Geen vrije CSS-varianten; alleen bestaande section-patronen uit de site.
 */

const SECTION_TYPES = {
    'page-hero': {
        label: 'Hero + tekst',
        description: 'Donkere kop bovenaan met eyebrow, h1, intro en optioneel script-accent.',
        snippet: '<section class="page-hero">\n' +
            '  <div class="container">\n' +
            '    <span class="eyebrow">Onderwerp</span>\n' +
            '    <h1>Een pakkende <em>kop</em></h1>\n' +
            '    <p class="page-hero-sub">Korte intro van een of twee zinnen.</p>\n' +
            '    <span class="script">optioneel accent</span>\n' +
            '  </div>\n' +
            '</section>'
    },
    'split': {
        label: 'Twee kolommen',
        description: 'Tekst naast beeld (.split) — zoals op de homepage.',
        snippet: '<section class="section section-warm">\n' +
            '  <div class="container">\n' +
            '    <div class="split">\n' +
            '      <div>\n' +
            '        <span class="eyebrow">Label</span>\n' +
            '        <h2>Tekst naast een <em>beeld</em></h2>\n' +
            '        <p>Concrete uitleg in korte alinea\'s.</p>\n' +
            '        <a href="/#boeken" class="btn-link">Vraag een offerte aan</a>\n' +
            '      </div>\n' +
            '      <figure><img src="/images/placeholder-ruimte.svg" alt="Beschrijvende alt-tekst"/></figure>\n' +
            '    </div>\n' +
            '  </div>\n' +
            '</section>'
    },
    'card-grid': {
        label: 'Kaarten-grid',
        description: 'Responsive kaartenraster (.card-grid > .card).',
        snippet: '<section class="section">\n' +
            '  <div class="container">\n' +
            '    <div class="section-head">\n' +
            '      <span class="eyebrow">Overzicht</span>\n' +
            '      <h2>Drie <em>onderdelen</em></h2>\n' +
            '    </div>\n' +
            '    <div class="card-grid">\n' +
            '      <article class="card">\n' +
            '        <h3>Eerste <em>kaart</em></h3>\n' +
            '        <span class="script">kort accent</span>\n' +
            '        <p>Korte toelichting.</p>\n' +
            '      </article>\n' +
            '    </div>\n' +
            '  </div>\n' +
            '</section>'
    },
    'stats': {
        label: 'Statistiekenrij',
        description: 'Cijfers met toelichting — zoals de locatie-sectie op de homepage.',
        snippet: '<section class="section section-warm">\n' +
            '  <div class="container">\n' +
            '    <div class="section-head">\n' +
            '      <span class="eyebrow">In cijfers</span>\n' +
            '      <h2>Wat we <em>leveren</em></h2>\n' +
            '    </div>\n' +
            '    <div class="locatie-stats">\n' +
            '      <div class="locatie-stat">\n' +
            '        <span class="num">15<small>+</small></span>\n' +
            '        <div class="desc"><strong>Jaar ervaring</strong>Maatwerk deuren</div>\n' +
            '      </div>\n' +
            '    </div>\n' +
            '  </div>\n' +
            '</section>'
    },
    'quote': {
        label: 'Quote-blok',
        description: 'Groot citaat met koperen rand (.quote).',
        snippet: '<section class="section">\n' +
            '  <div class="container">\n' +
            '    <div class="section-head">\n' +
            '      <span class="eyebrow">Filosofie</span>\n' +
            '      <h2>Waar we voor <em>staan</em></h2>\n' +
            '    </div>\n' +
            '    <blockquote class="quote">Een krachtige zin die de boodschap samenvat.</blockquote>\n' +
            '  </div>\n' +
            '</section>'
    },
    'donker-blok': {
        label: 'Donker blok',
        description: 'Donkere sectie (.section-ink of .section-sage) met feature-list of tekst.',
        snippet: '<section class="section section-sage">\n' +
            '  <div class="container">\n' +
            '    <div class="section-head">\n' +
            '      <span class="eyebrow">Expertise</span>\n' +
            '      <h2>Donker <em>accent</em></h2>\n' +
            '    </div>\n' +
            '    <ul class="feature-list">\n' +
            '      <li>Eerste punt</li>\n' +
            '      <li>Tweede punt</li>\n' +
            '    </ul>\n' +
            '  </div>\n' +
            '</section>'
    },
    'callout': {
        label: 'Offerte-CTA',
        description: 'Afsluitend callout-blok met knop naar /#boeken.',
        snippet: '<section class="section section-ink">\n' +
            '  <div class="container">\n' +
            '    <div class="callout">\n' +
            '      <div>\n' +
            '        <span class="eyebrow">Volgende stap</span>\n' +
            '        <h2>Klaar voor een <em>offerte</em>?</h2>\n' +
            '        <p>Korte uitnodiging om contact op te nemen.</p>\n' +
            '      </div>\n' +
            '      <a href="/#boeken" class="btn cta">Vraag een offerte aan</a>\n' +
            '    </div>\n' +
            '  </div>\n' +
            '</section>'
    }
};

const DESIGN_DEFAULTS = {
    indeling: ['page-hero', 'split', 'card-grid', 'callout'],
    sfeer: 'afwisselend licht en donker',
    heroBeeld: '',
    cta: 'opvallend koper'
};

const DESIGN_LABELS = {
    indeling: 'Indeling',
    sfeer: 'Sfeer',
    heroBeeld: 'Hero-afbeelding',
    cta: 'CTA-stijl'
};

const DESIGN_ICONS = {
    indeling: '▦',
    sfeer: '◐',
    heroBeeld: '🖼',
    cta: '◎'
};

const SFER_MAP = {
    'licht papier': {
        prompt: 'Gebruik lichte achtergronden: section, section-warm, section-deep. Geen donkere secties behalve page-hero en afsluitende CTA.',
        sectionClasses: ['section', 'section-warm', 'section-deep']
    },
    'donkere secties': {
        prompt: 'Gebruik donkere secties: section-ink en section-sage voor contrast. Wissel af met één lichte sectie indien nodig.',
        sectionClasses: ['section-sage', 'section-ink']
    },
    'afwisselend licht en donker': {
        prompt: 'Wissel lichte secties (section, section-warm) en donkere secties (section-ink, section-sage) af voor ritme — zoals de homepage.',
        sectionClasses: ['section', 'section-warm', 'section-sage', 'section-ink']
    }
};

const CTA_MAP = {
    'subtiel': 'Gebruik .btn-link tekstlinks; geen opvallende knoppen behalve in het callout-blok.',
    'opvallend koper': 'Gebruik .btn.cta of .cta voor de hoofdactie — koperen knop uit site-base.css.',
    'donkere knop': 'Gebruik .btn (sage) voor acties; callout met .btn.cta mag koper blijven.'
};

/** Normaliseer design-waarden; map oude vrije varianten naar toegestane keuzes. */
function normalizeDesign(raw) {
    const d = raw && typeof raw === 'object' ? { ...raw } : {};
    const out = { ...DESIGN_DEFAULTS };

    if (Array.isArray(d.indeling) && d.indeling.length) {
        out.indeling = d.indeling.map(s => normalizeSectionKey(s)).filter(Boolean);
    } else if (Array.isArray(d.secties) && d.secties.length) {
        out.indeling = d.secties.map(s => {
            const t = typeof s === 'object' ? (s.type || s.headline || '') : String(s);
            return guessSectionType(t);
        }).filter(Boolean);
    } else if (d.layout) {
        const lay = String(d.layout).toLowerCase();
        if (lay.includes('kaart') || lay.includes('card')) out.indeling = ['page-hero', 'card-grid', 'callout'];
        else if (lay.includes('hero')) out.indeling = ['page-hero', 'split', 'callout'];
        else if (lay.includes('compact')) out.indeling = ['page-hero', 'quote', 'callout'];
    }

    if (!out.indeling.length) out.indeling = [...DESIGN_DEFAULTS.indeling];

    const sfeerRaw = String(d.sfeer || d.sectiestijl || '').toLowerCase();
    if (sfeerRaw.includes('donker') || sfeerRaw.includes('industrie')) out.sfeer = 'donkere secties';
    else if (sfeerRaw.includes('licht') || sfeerRaw.includes('scandi') || sfeerRaw.includes('minimal')) out.sfeer = 'licht papier';
    else if (d.sfeer) out.sfeer = String(d.sfeer).trim();
    else out.sfeer = DESIGN_DEFAULTS.sfeer;

    if (d.heroBeeld) out.heroBeeld = String(d.heroBeeld).trim();
    else if (Array.isArray(d.beelden) && d.beelden[0] && d.beelden[0].url) {
        out.heroBeeld = String(d.beelden[0].url).trim();
    }

    const ctaRaw = String(d.cta || '').toLowerCase();
    if (ctaRaw.includes('subtiel')) out.cta = 'subtiel';
    else if (ctaRaw.includes('donker')) out.cta = 'donkere knop';
    else if (d.cta) out.cta = String(d.cta).trim();
    else out.cta = DESIGN_DEFAULTS.cta;

    return out;
}

function normalizeSectionKey(val) {
    const v = String(val || '').toLowerCase().trim();
    const keys = Object.keys(SECTION_TYPES);
    const exact = keys.find(k => k === v || SECTION_TYPES[k].label.toLowerCase() === v);
    if (exact) return exact;
    return guessSectionType(v);
}

function guessSectionType(text) {
    const v = String(text || '').toLowerCase();
    if (v.includes('hero') || v.includes('kop')) return 'page-hero';
    if (v.includes('kaart') || v.includes('card') || v.includes('grid')) return 'card-grid';
    if (v.includes('stat') || v.includes('cijfer') || v.includes('locatie')) return 'stats';
    if (v.includes('split') || v.includes('kolom') || v.includes('beeld')) return 'split';
    if (v.includes('quote') || v.includes('citaat')) return 'quote';
    if (v.includes('donker') || v.includes('sage') || v.includes('ink')) return 'donker-blok';
    if (v.includes('cta') || v.includes('callout') || v.includes('offerte')) return 'callout';
    return null;
}

function missingDesignKeys(design) {
    const d = normalizeDesign(design);
    const missing = [];
    if (!d.indeling || !d.indeling.length) missing.push('indeling');
    if (!d.sfeer) missing.push('sfeer');
    if (!d.heroBeeld) missing.push('heroBeeld');
    return missing;
}

function getSectionSnippets() {
    return Object.keys(SECTION_TYPES).map(key => SECTION_TYPES[key].snippet);
}

function getBodyClasses() {
    return 'dm-page';
}

function getDesignCss() {
    return '';
}

function getSfeerPrompt(sfeer) {
    const key = Object.keys(SFER_MAP).find(k => k.toLowerCase() === String(sfeer || '').toLowerCase())
        || Object.keys(SFER_MAP).find(k => String(sfeer || '').toLowerCase().includes(k.split(' ')[0]));
    return (key && SFER_MAP[key]) ? SFER_MAP[key].prompt : SFER_MAP['afwisselend licht en donker'].prompt;
}

function getDesignPromptBlock(design) {
    const d = normalizeDesign(design);
    const lines = [
        '## HUISSTIJL-OPBOUW (strikt — geen vrije design-varianten)',
        'Gebruik ALLEEN componenten en classes uit de styleguide en onderstaande snippets.',
        'Gebruik EXACT deze CSS-variabelen (--ink, --paper, --copper, enz.). GEEN inline hex-kleuren, GEEN nieuwe classes, GEEN <style>-blokken.',
        'Typografie: Libre Caslon Text (koppen), Montserrat (body), Caveat (.script). Geen andere fonts.',
        '',
        'Sfeer: ' + d.sfeer,
        '→ ' + getSfeerPrompt(d.sfeer),
        '',
        'CTA-stijl: ' + d.cta,
        '→ ' + (CTA_MAP[d.cta] || CTA_MAP['opvallend koper']),
        '',
        'Sectietypes in volgorde (gebruik exact deze HTML-patronen):'
    ];

    d.indeling.forEach((key, i) => {
        const sec = SECTION_TYPES[key];
        if (!sec) return;
        lines.push('');
        lines.push((i + 1) + '. ' + sec.label + ' (' + key + ')');
        lines.push(sec.snippet);
    });

    if (d.heroBeeld) {
        lines.push('');
        lines.push('Hero-afbeelding (indien split of page-hero met beeld): gebruik EXACT deze URL in <img src="...">:');
        lines.push(d.heroBeeld);
    }

    lines.push('');
    lines.push('VERBODEN: custom kleuren, dm-sfeer-*, dm-layout-*, eigen CSS, placeholder-URLs als er mediabibliotheek-URL\'s in het plan staan.');
    lines.push('Begin met page-hero. Sluit af met callout (offerte-CTA naar /#boeken).');

    return lines.join('\n');
}

const DESIGN_QUESTION_BANK = [
    {
        id: 'design_indeling',
        question: 'Welke sectietypes wil je op de pagina (en in welke volgorde)?',
        dimension: 'indeling',
        multiple: true,
        choices: Object.keys(SECTION_TYPES).map(key => ({
            id: 'sec_' + key,
            label: SECTION_TYPES[key].label,
            value: 'Sectietype: ' + SECTION_TYPES[key].label + ' (' + key + ')'
        }))
    },
    {
        id: 'design_sfeer',
        question: 'Welke sfeer past bij de sectie-achtergronden?',
        dimension: 'sfeer',
        choices: [
            { id: 'sfeer_licht', label: 'Licht papier', value: 'Lichte secties op papier' },
            { id: 'sfeer_donker', label: 'Donkere secties', value: 'Donkere sage/ink secties' },
            { id: 'sfeer_afw', label: 'Afwisselend', value: 'Afwisselend licht en donker' }
        ]
    },
    {
        id: 'design_hero_beeld',
        question: 'Welke afbeelding uit de mediabibliotheek voor de hero of het hoofdbeeld?',
        dimension: 'heroBeeld',
        choices: []
    },
    {
        id: 'design_sectie_beeld',
        question: 'Welke afbeelding voor de sectie met tekst+beeld (split)?',
        dimension: 'sectieBeeld',
        choices: []
    },
    {
        id: 'design_cta',
        question: 'Hoe opvallend moet de call-to-action zijn?',
        dimension: 'cta',
        choices: [
            { id: 'cta_sub', label: 'Subtiel (tekstlink)', value: 'Subtiele CTA met btn-link' },
            { id: 'cta_koper', label: 'Opvallend koper', value: 'Opvallende koperen CTA-knop' },
            { id: 'cta_donker', label: 'Donkere knop', value: 'Donkere sage-knop als CTA' }
        ]
    }
];

function designSummaryForDisplay(design) {
    const d = normalizeDesign(design);
    const rows = Object.keys(DESIGN_LABELS).map(key => ({
        key,
        label: DESIGN_LABELS[key],
        icon: DESIGN_ICONS[key],
        value: key === 'indeling'
            ? (d.indeling || []).map(k => (SECTION_TYPES[k] && SECTION_TYPES[k].label) || k).join(' → ')
            : d[key]
    }));
    return rows;
}

function matchVariant() {
    return { classes: '', prompt: '', css: '' };
}

module.exports = {
    SECTION_TYPES,
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
    getSectionSnippets,
    designSummaryForDisplay,
    normalizeSectionKey,
    guessSectionType
};
