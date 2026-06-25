/**
 * DeurMeester - wireframe-bibliotheek (structuur, low-fidelity)
 *
 * Eén bron van waarheid voor de WIREFRAME-blokken waarmee een gebruiker eerst
 * de STRUCTUUR van een pagina bepaalt, los van stijl en inhoud. Elk wireframe:
 *   - is NEUTRAAL en low-fi: grijze vlakken voor beeld, balken voor tekst,
 *     knop-omtrekken. Het gebruikt uitsluitend classes uit wireframe.css
 *     (prefix wf-). GEEN huisstijl, GEEN echte content.
 *   - draagt een machine-leesbare `structure` (type, layout, elements) die de
 *     AI-agent gebruikt om er een VOLLEDIG on-brand pagina van te bouwen.
 *   - heeft een optioneel `scaffold`: een minimale on-brand starter-HTML (met
 *     site-base.css classes en placeholder-tekst/-beeld) voor de niet-AI-route
 *     ("Direct als concept opslaan"). Dit is de gestylede render-laag.
 *
 * Scheiding: het wireframe bepaalt de LAYOUT/structuur; de AI-agent (of het
 * scaffold) levert de definitieve STIJL + INHOUD. Daarna is alles bewerkbaar
 * via de live builder.
 *
 * Generalisatie: dit bestand is site-agnostisch op het niveau van de wireframes
 * (de low-fi structuur is voor elke site gelijk). Alleen het `scaffold` en de
 * agent-instructie/styleguide verschillen per site. Zie app/docs/TEMPLATES.md.
 */

'use strict';

// Categorieën in vaste volgorde (groepering + filters in de admin-composer).
const CATEGORIES = [
    { id: 'headers',  name: 'Headers & Hero' },
    { id: 'footers',  name: 'Menu & Footer' },
    { id: 'features', name: 'Features, Prijzen & Teams' },
    { id: 'showcase', name: 'Producten, Portfolio & Galerij' },
    { id: 'contact',  name: 'Bedrijven, Contact & CTA' },
    { id: 'content',  name: 'Content & Content+Foto' }
];

// Korte helpers om de wireframe-HTML leesbaar te houden.
const L = (cls) => '<div class="wf-line' + (cls ? ' ' + cls : '') + '"></div>';
const LINES = (n) => {
    let s = '';
    for (let i = 0; i < n; i++) s += L(i === n - 1 ? 'wf-short' : '');
    return s;
};

const WIREFRAMES = [
    // ============================ HEADERS & HERO ============================
    {
        id: 'hero-image-right',
        name: 'Hero met beeld rechts',
        category: 'headers',
        description: 'Openingsblok: tekst links (eyebrow, titel, intro, knop) naast een groot beeld rechts.',
        structure: { type: 'hero', layout: 'image-right', elements: ['eyebrow', 'title', 'subtitle', 'cta', 'image'] },
        wireframe: [
            '<div class="wf-section">',
            '  <div class="wf-container">',
            '    <div class="wf-split">',
            '      <div>',
            '        <div class="wf-eyebrow"></div>',
            '        <div class="wf-title wf-lg"></div>',
            '        ' + LINES(2),
            '        <div class="wf-btn-row"><span class="wf-btn wf-btn-solid"></span><span class="wf-btn"></span></div>',
            '      </div>',
            '      <div class="wf-img wf-img-tall"></div>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('\n'),
        scaffold: [
            '<section class="section">',
            '  <div class="container">',
            '    <div class="split">',
            '      <div>',
            '        <span class="eyebrow">Welkom</span>',
            '        <h1>Een titel die <em>blijft hangen</em></h1>',
            '        <p class="lead">Een korte, warme introductie van een of twee zinnen.</p>',
            '        <a href="/#boeken" class="cta">Plan een bezoek</a>',
            '      </div>',
            '      <figure class="bl-figure"><img src="/images/placeholder-ruimte.svg" alt="Vervang door een eigen foto"/></figure>',
            '    </div>',
            '  </div>',
            '</section>'
        ].join('\n')
    },
    {
        id: 'hero-centered',
        name: 'Hero gecentreerd',
        category: 'headers',
        description: 'Gecentreerde openingskop met titel en intro, en een groot breedbeeld eronder.',
        structure: { type: 'hero', layout: 'centered-image-below', elements: ['eyebrow', 'title', 'subtitle', 'cta', 'image'] },
        wireframe: [
            '<div class="wf-section">',
            '  <div class="wf-container">',
            '    <div class="wf-center">',
            '      <div class="wf-eyebrow"></div>',
            '      <div class="wf-title wf-lg"></div>',
            '      ' + L('') + L('wf-short'),
            '      <div class="wf-btn-row"><span class="wf-btn wf-btn-solid"></span></div>',
            '    </div>',
            '    <div class="wf-img wf-img-wide" style="margin-top:24px"></div>',
            '  </div>',
            '</div>'
        ].join('\n'),
        scaffold: [
            '<section class="page-hero">',
            '  <div class="container">',
            '    <span class="eyebrow">Welkom</span>',
            '    <h1>Een titel die <em>blijft hangen</em></h1>',
            '    <p class="page-hero-sub">Korte, pakkende introductie in een of twee zinnen.</p>',
            '  </div>',
            '</section>',
            '<section class="section">',
            '  <div class="container-wide">',
            '    <figure class="bl-figure"><img src="/images/placeholder-natuur.svg" alt="Vervang door een eigen foto"/></figure>',
            '  </div>',
            '</section>'
        ].join('\n')
    },
    {
        id: 'page-header-simple',
        name: 'Simpele paginakop',
        category: 'headers',
        description: 'Compacte donkere paginakop met eyebrow, titel en korte ondertitel. Goed om een pagina te openen.',
        structure: { type: 'page-header', layout: 'simple', elements: ['eyebrow', 'title', 'subtitle'] },
        wireframe: [
            '<div class="wf-section wf-dark">',
            '  <div class="wf-container wf-center">',
            '    <div class="wf-eyebrow"></div>',
            '    <div class="wf-title wf-lg"></div>',
            '    ' + L('wf-short'),
            '  </div>',
            '</div>'
        ].join('\n'),
        scaffold: [
            '<section class="page-hero">',
            '  <div class="container">',
            '    <span class="eyebrow">Eyebrow</span>',
            '    <h1>Een <em>titel</em></h1>',
            '    <p class="page-hero-sub">Korte introtekst van een of twee zinnen.</p>',
            '  </div>',
            '</section>'
        ].join('\n')
    },

    // ============================ MENU & FOOTER ============================
    {
        id: 'footer-columns',
        name: 'Footer met kolommen',
        category: 'footers',
        description: 'Brede footer met merkblok plus drie kolommen links, en een onderbalk.',
        structure: { type: 'footer', layout: 'brand-plus-columns', elements: ['brand', 'tagline', 'column-links-3', 'bottom-bar'] },
        wireframe: [
            '<div class="wf-section wf-footer">',
            '  <div class="wf-container">',
            '    <div class="wf-footer-grid">',
            '      <div><div class="wf-title wf-sm"></div>' + LINES(2) + '</div>',
            '      <div><div class="wf-title wf-sm"></div>' + L('') + L('') + L('') + '</div>',
            '      <div><div class="wf-title wf-sm"></div>' + L('') + L('') + L('') + '</div>',
            '      <div><div class="wf-title wf-sm"></div>' + L('') + L('') + L('') + '</div>',
            '    </div>',
            '    <div class="wf-footer-bottom"><span class="wf-line wf-xshort"></span><span class="wf-line wf-xshort"></span></div>',
            '  </div>',
            '</div>'
        ].join('\n'),
        scaffold: [
            '<section class="section section-ink">',
            '  <div class="container">',
            '    <div class="card-grid">',
            '      <div><h3>DeurMeester</h3><p>Een korte zin over wie je bent.</p></div>',
            '      <div><h3>Aanbod</h3><ul class="feature-list"><li>Eerste link</li><li>Tweede link</li><li>Derde link</li></ul></div>',
            '      <div><h3>Beleving</h3><ul class="feature-list"><li>Eerste link</li><li>Tweede link</li><li>Derde link</li></ul></div>',
            '      <div><h3>Informatie</h3><ul class="feature-list"><li>Eerste link</li><li>Tweede link</li><li>Derde link</li></ul></div>',
            '    </div>',
            '  </div>',
            '</section>'
        ].join('\n')
    },
    {
        id: 'footer-compact',
        name: 'Compacte footer',
        category: 'footers',
        description: 'Smalle afsluitende balk met merknaam links en een paar links rechts.',
        structure: { type: 'footer', layout: 'compact', elements: ['brand', 'inline-links', 'copyright'] },
        wireframe: [
            '<div class="wf-section wf-footer">',
            '  <div class="wf-container">',
            '    <div class="wf-footer-bottom">',
            '      <span class="wf-title wf-sm" style="margin:0"></span>',
            '      <span><span class="wf-tag"></span><span class="wf-tag"></span><span class="wf-tag"></span></span>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('\n'),
        scaffold: [
            '<section class="section section-ink">',
            '  <div class="container">',
            '    <div class="callout">',
            '      <div><h3>DeurMeester</h3><p>Veenendaal, Utrecht</p></div>',
            '      <a href="/#boeken" class="cta">Neem contact op</a>',
            '    </div>',
            '  </div>',
            '</section>'
        ].join('\n')
    },

    // ===================== FEATURES / PRICING / TEAMS =====================
    {
        id: 'features-3col',
        name: 'Feature-grid (3 kolommen)',
        category: 'features',
        description: 'Sectiekop met drie kaarten naast elkaar om kenmerken of voordelen uit te lichten.',
        structure: { type: 'features', layout: 'grid-3', elements: ['section-eyebrow', 'section-title', 'cards:3{title,text}'] },
        wireframe: [
            '<div class="wf-section">',
            '  <div class="wf-container">',
            '    <div class="wf-head"><div class="wf-eyebrow"></div><div class="wf-title"></div></div>',
            '    <div class="wf-grid wf-grid-3">',
            '      <div class="wf-card wf-card-feature"><div class="wf-title wf-sm" style="margin:0 auto 10px"></div>' + LINES(3) + '</div>',
            '      <div class="wf-card wf-card-feature"><div class="wf-title wf-sm" style="margin:0 auto 10px"></div>' + LINES(3) + '</div>',
            '      <div class="wf-card wf-card-feature"><div class="wf-title wf-sm" style="margin:0 auto 10px"></div>' + LINES(3) + '</div>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('\n'),
        scaffold: [
            '<section class="section section-warm">',
            '  <div class="container">',
            '    <div class="section-head"><span class="eyebrow">Waarom hier</span><h2>Drie redenen om te <em>komen</em></h2></div>',
            '    <div class="card-grid">',
            '      <article class="card"><h3>Eerste <em>kenmerk</em></h3><p>Beschrijf kort wat dit kenmerk inhoudt.</p></article>',
            '      <article class="card"><h3>Tweede <em>kenmerk</em></h3><p>Beschrijf kort wat dit kenmerk inhoudt.</p></article>',
            '      <article class="card"><h3>Derde <em>kenmerk</em></h3><p>Beschrijf kort wat dit kenmerk inhoudt.</p></article>',
            '    </div>',
            '  </div>',
            '</section>'
        ].join('\n')
    },
    {
        id: 'feature-image',
        name: 'Feature met beeld',
        category: 'features',
        description: 'Eén kenmerk uitgelicht: beeld links, opsomming met punten rechts.',
        structure: { type: 'feature', layout: 'image-left', elements: ['image', 'eyebrow', 'title', 'bullet-list'] },
        wireframe: [
            '<div class="wf-section">',
            '  <div class="wf-container">',
            '    <div class="wf-split">',
            '      <div class="wf-img"></div>',
            '      <div>',
            '        <div class="wf-eyebrow"></div>',
            '        <div class="wf-title"></div>',
            '        ' + L('') + L('') + L('') + L('wf-short'),
            '      </div>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('\n'),
        scaffold: [
            '<section class="section">',
            '  <div class="container">',
            '    <div class="split">',
            '      <figure class="bl-figure"><img src="/images/placeholder-sfeer.svg" alt="Vervang door een eigen foto"/></figure>',
            '      <div>',
            '        <span class="eyebrow">Wat je krijgt</span>',
            '        <h2>Alles wat <em>inbegrepen</em> is</h2>',
            '        <ul class="feature-list"><li>Eerste punt</li><li>Tweede punt</li><li>Derde punt</li><li>Vierde punt</li></ul>',
            '      </div>',
            '    </div>',
            '  </div>',
            '</section>'
        ].join('\n')
    },
    {
        id: 'pricing-3',
        name: 'Prijstabel (3 pakketten)',
        category: 'features',
        description: 'Drie prijskaarten naast elkaar met bedrag, kenmerken en een knop per pakket.',
        structure: { type: 'pricing', layout: 'cards-3', elements: ['section-title', 'plans:3{name,price,features,cta}'] },
        wireframe: [
            '<div class="wf-section">',
            '  <div class="wf-container">',
            '    <div class="wf-head"><div class="wf-title"></div></div>',
            '    <div class="wf-grid wf-grid-3">',
            '      <div class="wf-card wf-card-feature"><div class="wf-title wf-sm" style="margin:0 auto"></div><div class="wf-price-amount"></div>' + L('') + L('') + L('wf-short') + '<div class="wf-btn-row" style="justify-content:center"><span class="wf-btn wf-btn-sm wf-btn-solid"></span></div></div>',
            '      <div class="wf-card wf-card-feature"><div class="wf-title wf-sm" style="margin:0 auto"></div><div class="wf-price-amount"></div>' + L('') + L('') + L('wf-short') + '<div class="wf-btn-row" style="justify-content:center"><span class="wf-btn wf-btn-sm wf-btn-solid"></span></div></div>',
            '      <div class="wf-card wf-card-feature"><div class="wf-title wf-sm" style="margin:0 auto"></div><div class="wf-price-amount"></div>' + L('') + L('') + L('wf-short') + '<div class="wf-btn-row" style="justify-content:center"><span class="wf-btn wf-btn-sm wf-btn-solid"></span></div></div>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('\n'),
        scaffold: [
            '<section class="section section-warm">',
            '  <div class="container">',
            '    <div class="section-head"><span class="eyebrow">Tarieven</span><h2>Onze <em>pakketten</em></h2></div>',
            '    <div class="card-grid">',
            '      <article class="card bl-price"><span class="mono-label">Basis</span><div class="bl-price-amount">&euro; 295</div><ul class="feature-list"><li>Eerste kenmerk</li><li>Tweede kenmerk</li></ul><a href="/#boeken" class="cta">Reserveer</a></article>',
            '      <article class="card bl-price bl-price-featured"><span class="mono-label">Compleet</span><div class="bl-price-amount">&euro; 495</div><ul class="feature-list"><li>Eerste kenmerk</li><li>Tweede kenmerk</li><li>Derde kenmerk</li></ul><a href="/#boeken" class="cta">Reserveer</a></article>',
            '      <article class="card bl-price"><span class="mono-label">Op maat</span><div class="bl-price-amount">In overleg</div><ul class="feature-list"><li>Eerste kenmerk</li><li>Tweede kenmerk</li></ul><a href="/#boeken" class="cta">Vraag aan</a></article>',
            '    </div>',
            '  </div>',
            '</section>'
        ].join('\n')
    },
    {
        id: 'team-grid',
        name: 'Teamleden-grid',
        category: 'features',
        description: 'Rij met teamleden: ronde portretfoto met naam en rol per persoon.',
        structure: { type: 'team', layout: 'grid-4', elements: ['section-title', 'members:4{avatar,name,role}'] },
        wireframe: [
            '<div class="wf-section">',
            '  <div class="wf-container">',
            '    <div class="wf-head"><div class="wf-eyebrow"></div><div class="wf-title"></div></div>',
            '    <div class="wf-grid wf-grid-4">',
            '      <div class="wf-card-feature"><div class="wf-avatar"></div><div class="wf-title wf-sm" style="margin:0 auto 8px"></div>' + L('wf-short') + '</div>',
            '      <div class="wf-card-feature"><div class="wf-avatar"></div><div class="wf-title wf-sm" style="margin:0 auto 8px"></div>' + L('wf-short') + '</div>',
            '      <div class="wf-card-feature"><div class="wf-avatar"></div><div class="wf-title wf-sm" style="margin:0 auto 8px"></div>' + L('wf-short') + '</div>',
            '      <div class="wf-card-feature"><div class="wf-avatar"></div><div class="wf-title wf-sm" style="margin:0 auto 8px"></div>' + L('wf-short') + '</div>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('\n'),
        scaffold: [
            '<section class="section">',
            '  <div class="container">',
            '    <div class="section-head"><span class="eyebrow">Het team</span><h2>De mensen <em>achter de plek</em></h2></div>',
            '    <div class="card-grid">',
            '      <article class="card card-photo"><img src="/images/placeholder-portret.svg" alt="Vervang door een foto"/><div class="card-body"><h3>Naam</h3><span class="script">rol of functie</span></div></article>',
            '      <article class="card card-photo"><img src="/images/placeholder-portret.svg" alt="Vervang door een foto"/><div class="card-body"><h3>Naam</h3><span class="script">rol of functie</span></div></article>',
            '      <article class="card card-photo"><img src="/images/placeholder-portret.svg" alt="Vervang door een foto"/><div class="card-body"><h3>Naam</h3><span class="script">rol of functie</span></div></article>',
            '    </div>',
            '  </div>',
            '</section>'
        ].join('\n')
    },

    // ============ PRODUCTS / PORTFOLIO / GRID / GALLERIES / SPECS ============
    {
        id: 'portfolio-grid',
        name: 'Portfolio / galerij-grid',
        category: 'showcase',
        description: 'Raster van beelden (2 rijen van 3) onder een sectiekop. Goed voor werk, ruimtes of sfeerbeelden.',
        structure: { type: 'gallery', layout: 'grid-3x2', elements: ['section-title', 'images:6'] },
        wireframe: [
            '<div class="wf-section">',
            '  <div class="wf-container">',
            '    <div class="wf-head"><div class="wf-eyebrow"></div><div class="wf-title"></div></div>',
            '    <div class="wf-grid wf-grid-3">',
            '      <div class="wf-img wf-img-square"></div><div class="wf-img wf-img-square"></div><div class="wf-img wf-img-square"></div>',
            '      <div class="wf-img wf-img-square"></div><div class="wf-img wf-img-square"></div><div class="wf-img wf-img-square"></div>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('\n'),
        scaffold: [
            '<section class="section section-deep">',
            '  <div class="container"><div class="section-head"><span class="eyebrow">Beeld</span><h2>Een <em>indruk</em> in beeld</h2></div></div>',
            '  <div class="container-wide">',
            '    <div class="bl-gallery">',
            '      <figure class="bl-gallery-item"><img src="/images/placeholder-natuur.svg" alt="Vervang door een foto"/></figure>',
            '      <figure class="bl-gallery-item"><img src="/images/placeholder-ruimte.svg" alt="Vervang door een foto"/></figure>',
            '      <figure class="bl-gallery-item"><img src="/images/placeholder-sfeer.svg" alt="Vervang door een foto"/></figure>',
            '    </div>',
            '  </div>',
            '</section>'
        ].join('\n')
    },
    {
        id: 'services-list',
        name: 'Services-lijst',
        category: 'showcase',
        description: 'Lijst van diensten, elk met een klein beeld of icoon, titel en korte beschrijving.',
        structure: { type: 'services', layout: 'list-rows', elements: ['section-title', 'rows:3{thumb,title,text}'] },
        wireframe: [
            '<div class="wf-section">',
            '  <div class="wf-container">',
            '    <div class="wf-head"><div class="wf-title"></div></div>',
            '    <div class="wf-grid">',
            '      <div class="wf-card"><div class="wf-split" style="grid-template-columns:120px 1fr;gap:18px"><div class="wf-img" style="min-height:90px"></div><div><div class="wf-title wf-sm"></div>' + LINES(2) + '</div></div></div>',
            '      <div class="wf-card"><div class="wf-split" style="grid-template-columns:120px 1fr;gap:18px"><div class="wf-img" style="min-height:90px"></div><div><div class="wf-title wf-sm"></div>' + LINES(2) + '</div></div></div>',
            '      <div class="wf-card"><div class="wf-split" style="grid-template-columns:120px 1fr;gap:18px"><div class="wf-img" style="min-height:90px"></div><div><div class="wf-title wf-sm"></div>' + LINES(2) + '</div></div></div>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('\n'),
        scaffold: [
            '<section class="section">',
            '  <div class="container">',
            '    <div class="section-head"><span class="eyebrow">Aanbod</span><h2>Onze <em>diensten</em></h2></div>',
            '    <div class="card-grid">',
            '      <article class="card card-photo"><img src="/images/placeholder-sfeer.svg" alt="Vervang door een foto"/><div class="card-body"><h3>Eerste dienst</h3><p>Korte beschrijving van deze dienst.</p></div></article>',
            '      <article class="card card-photo"><img src="/images/placeholder-ruimte.svg" alt="Vervang door een foto"/><div class="card-body"><h3>Tweede dienst</h3><p>Korte beschrijving van deze dienst.</p></div></article>',
            '      <article class="card card-photo"><img src="/images/placeholder-natuur.svg" alt="Vervang door een foto"/><div class="card-body"><h3>Derde dienst</h3><p>Korte beschrijving van deze dienst.</p></div></article>',
            '    </div>',
            '  </div>',
            '</section>'
        ].join('\n')
    },
    {
        id: 'specs-table',
        name: 'Specs / kenmerken-tabel',
        category: 'showcase',
        description: 'Tweekoloms tabel met kenmerk en waarde per rij. Goed voor specificaties of praktische info.',
        structure: { type: 'specs', layout: 'two-column-table', elements: ['section-title', 'rows:5{label,value}'] },
        wireframe: [
            '<div class="wf-section">',
            '  <div class="wf-container wf-narrow">',
            '    <div class="wf-head"><div class="wf-title"></div></div>',
            '    <div class="wf-table">',
            '      <div class="wf-table-row wf-table-head"><span class="wf-line wf-short" style="margin:0"></span><span class="wf-line wf-short" style="margin:0"></span></div>',
            '      <div class="wf-table-row"><span class="wf-line wf-short" style="margin:0"></span><span class="wf-line" style="margin:0"></span></div>',
            '      <div class="wf-table-row"><span class="wf-line wf-short" style="margin:0"></span><span class="wf-line" style="margin:0"></span></div>',
            '      <div class="wf-table-row"><span class="wf-line wf-short" style="margin:0"></span><span class="wf-line" style="margin:0"></span></div>',
            '      <div class="wf-table-row"><span class="wf-line wf-short" style="margin:0"></span><span class="wf-line" style="margin:0"></span></div>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('\n'),
        scaffold: [
            '<section class="section section-warm">',
            '  <div class="container">',
            '    <div class="section-head"><span class="eyebrow">Praktisch</span><h2>Kenmerken &amp; <em>specificaties</em></h2></div>',
            '    <div class="split">',
            '      <ul class="feature-list"><li>Kenmerk een: waarde</li><li>Kenmerk twee: waarde</li><li>Kenmerk drie: waarde</li></ul>',
            '      <ul class="feature-list"><li>Kenmerk vier: waarde</li><li>Kenmerk vijf: waarde</li><li>Kenmerk zes: waarde</li></ul>',
            '    </div>',
            '  </div>',
            '</section>'
        ].join('\n')
    },

    // ===================== COMPANIES / CONTACT / CTA =====================
    {
        id: 'contact-form',
        name: 'Contactblok met formulier',
        category: 'contact',
        description: 'Tweekoloms contact: tekst en gegevens links, een formulier-skelet rechts.',
        structure: { type: 'contact', layout: 'text-plus-form', elements: ['title', 'intro', 'contact-details', 'form{name,email,message,submit}'] },
        wireframe: [
            '<div class="wf-section">',
            '  <div class="wf-container">',
            '    <div class="wf-split">',
            '      <div><div class="wf-eyebrow"></div><div class="wf-title"></div>' + LINES(3) + '</div>',
            '      <div class="wf-card"><div class="wf-field"></div><div class="wf-field"></div><div class="wf-field wf-field-area"></div><div class="wf-btn wf-btn-solid" style="width:100%"></div></div>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('\n'),
        scaffold: [
            '<section class="section">',
            '  <div class="container">',
            '    <div class="split">',
            '      <div><span class="eyebrow">Contact</span><h2>Neem <em>contact</em> op</h2><p>Een korte uitnodigende tekst. Vermeld hoe en wanneer je bereikbaar bent.</p><p>info@deurmeester.nl</p></div>',
            '      <div class="callout"><div><h3>Liever direct boeken?</h3><p>Plan je bezoek via de boekingspagina.</p></div><a href="/#boeken" class="cta">Boek nu</a></div>',
            '    </div>',
            '  </div>',
            '</section>'
        ].join('\n')
    },
    {
        id: 'cta-band',
        name: 'Grote CTA-band',
        category: 'contact',
        description: 'Brede, uitgelichte oproepbalk met korte tekst en een prominente knop.',
        structure: { type: 'cta', layout: 'band', elements: ['title', 'subtitle', 'cta'] },
        wireframe: [
            '<div class="wf-section wf-dark">',
            '  <div class="wf-container wf-center">',
            '    <div class="wf-title"></div>',
            '    ' + L('wf-short'),
            '    <div class="wf-btn-row"><span class="wf-btn wf-btn-solid"></span></div>',
            '  </div>',
            '</div>'
        ].join('\n'),
        scaffold: [
            '<section class="section section-ink">',
            '  <div class="container">',
            '    <div class="callout">',
            '      <div><span class="eyebrow">Kom langs</span><h3>Klaar om te <em>boeken</em>?</h3><p>Een korte, uitnodigende afsluiter.</p></div>',
            '      <a href="/#boeken" class="cta">Boek nu</a>',
            '    </div>',
            '  </div>',
            '</section>'
        ].join('\n')
    },
    {
        id: 'logo-strip',
        name: 'Logo- / partnerstrook',
        category: 'contact',
        description: 'Rij met logo-vlakken van partners of klanten onder een kort kopje.',
        structure: { type: 'logos', layout: 'strip', elements: ['caption', 'logos:5'] },
        wireframe: [
            '<div class="wf-section">',
            '  <div class="wf-container wf-center">',
            '    <div class="wf-line wf-xshort" style="margin:0 auto 22px"></div>',
            '    <div class="wf-logos"><span class="wf-logo"></span><span class="wf-logo"></span><span class="wf-logo"></span><span class="wf-logo"></span><span class="wf-logo"></span></div>',
            '  </div>',
            '</div>'
        ].join('\n'),
        scaffold: [
            '<section class="section section-warm">',
            '  <div class="container">',
            '    <div class="section-head"><span class="eyebrow">Samenwerkingen</span><h2>Zij gingen je <em>voor</em></h2></div>',
            '    <div class="card-grid">',
            '      <figure class="bl-figure"><img src="/images/placeholder-ruimte.svg" alt="Logo van een partner"/></figure>',
            '      <figure class="bl-figure"><img src="/images/placeholder-sfeer.svg" alt="Logo van een partner"/></figure>',
            '      <figure class="bl-figure"><img src="/images/placeholder-natuur.svg" alt="Logo van een partner"/></figure>',
            '    </div>',
            '  </div>',
            '</section>'
        ].join('\n')
    },

    // ===================== CONTENT / CONTENT+PHOTO =====================
    {
        id: 'content-text',
        name: 'Tekstsectie',
        category: 'content',
        description: 'Rustige tekstsectie met een introzin en twee alinea\u0027s. Geen beeld.',
        structure: { type: 'content', layout: 'text-only', elements: ['lead', 'paragraphs:2'] },
        wireframe: [
            '<div class="wf-section">',
            '  <div class="wf-container wf-narrow">',
            '    <div class="wf-title wf-sm"></div>',
            '    <div class="wf-lines">' + LINES(4) + '</div>',
            '    <div class="wf-lines">' + LINES(3) + '</div>',
            '  </div>',
            '</div>'
        ].join('\n'),
        scaffold: [
            '<section class="section">',
            '  <div class="container">',
            '    <p class="lead">Een korte, cursieve introzin die de toon zet.</p>',
            '    <p>Vertel hier in een paar alinea\u0027s waar het op deze pagina over gaat. Houd het concreet en menselijk.</p>',
            '    <p>Een tweede alinea geeft ruimte voor detail of een voorbeeld.</p>',
            '  </div>',
            '</section>'
        ].join('\n')
    },
    {
        id: 'content-photo',
        name: 'Tekst met foto',
        category: 'content',
        description: 'Tweekolomsblok met tekst naast een sfeerbeeld (beeld rechts).',
        structure: { type: 'content', layout: 'text-with-image-right', elements: ['eyebrow', 'title', 'paragraphs:2', 'link', 'image'] },
        wireframe: [
            '<div class="wf-section">',
            '  <div class="wf-container">',
            '    <div class="wf-split">',
            '      <div><div class="wf-eyebrow"></div><div class="wf-title"></div>' + LINES(3) + '<div class="wf-btn-row"><span class="wf-btn"></span></div></div>',
            '      <div class="wf-img wf-img-tall"></div>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('\n'),
        scaffold: [
            '<section class="section section-sage">',
            '  <div class="container">',
            '    <div class="split">',
            '      <div>',
            '        <span class="eyebrow">In het kort</span>',
            '        <h2>Tekst naast een <em>sfeerbeeld</em></h2>',
            '        <p>Beschrijf hier het onderwerp. De foto vervang je later in de live builder.</p>',
            '        <a href="/#boeken" class="btn-link">Plan een bezoek</a>',
            '      </div>',
            '      <figure class="bl-figure"><img src="/images/placeholder-ruimte.svg" alt="Vervang door een eigen foto"/></figure>',
            '    </div>',
            '  </div>',
            '</section>'
        ].join('\n')
    },
    {
        id: 'quote',
        name: 'Citaat',
        category: 'content',
        description: 'Eén groot citaat, gecentreerd. Goed als rustpunt tussen secties.',
        structure: { type: 'quote', layout: 'centered', elements: ['quote', 'attribution'] },
        wireframe: [
            '<div class="wf-section wf-dark">',
            '  <div class="wf-container wf-narrow wf-center">',
            '    <div class="wf-line"></div>',
            '    <div class="wf-line"></div>',
            '    <div class="wf-line wf-short"></div>',
            '    <div class="wf-line wf-xshort" style="margin:18px auto 0"></div>',
            '  </div>',
            '</div>'
        ].join('\n'),
        scaffold: [
            '<section class="section section-ink">',
            '  <div class="container">',
            '    <blockquote class="quote">Een krachtig citaat dat blijft hangen. Gebruik <em>cursief</em> voor de kern.</blockquote>',
            '  </div>',
            '</section>'
        ].join('\n')
    }
];

// Publieke catalogus: metadata + wireframe-HTML + structure (+ scaffold) per item.
function getCatalog() {
    return {
        categories: CATEGORIES.slice(),
        wireframes: WIREFRAMES.map(w => ({
            id: w.id,
            name: w.name,
            category: w.category,
            description: w.description,
            wireframe: w.wireframe,
            structure: w.structure,
            scaffold: w.scaffold || ''
        }))
    };
}

// Eén wireframe op id opzoeken.
function getWireframe(id) {
    return WIREFRAMES.find(w => w.id === id) || null;
}

// De gecombineerde, machine-leesbare structuur voor een lijst van id's (in
// volgorde). Dit is wat de AI-agent gebruikt om de pagina te bouwen.
function assembleStructure(ids) {
    if (!Array.isArray(ids)) return [];
    return ids
        .map(id => getWireframe(id))
        .filter(Boolean)
        .map((w, i) => Object.assign({ order: i + 1, id: w.id, name: w.name, category: w.category }, w.structure));
}

// De low-fi preview-HTML voor een lijst van id's (in volgorde).
function assembleWireframeHtml(ids) {
    if (!Array.isArray(ids)) return '';
    return ids
        .map(id => getWireframe(id))
        .filter(Boolean)
        .map(w => w.wireframe)
        .join('\n');
}

// De on-brand starter-HTML (scaffold) voor een lijst van id's. Voor de niet-AI
// route ("Direct als concept opslaan"): een bewerkbare pagina zonder generatie.
function assembleScaffoldHtml(ids) {
    if (!Array.isArray(ids)) return '';
    return ids
        .map(id => getWireframe(id))
        .filter(Boolean)
        .map(w => w.scaffold || '')
        .filter(Boolean)
        .join('\n\n');
}

module.exports = {
    CATEGORIES,
    WIREFRAMES,
    getCatalog,
    getWireframe,
    assembleStructure,
    assembleWireframeHtml,
    assembleScaffoldHtml
};
