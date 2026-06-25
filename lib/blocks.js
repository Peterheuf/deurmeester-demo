/**
 * DeurMeester - blokkenbibliotheek (templates)
 *
 * Eén bron van waarheid voor de herbruikbare sectie-blokken waarmee een klant
 * een nieuwe pagina kan samenstellen. Elk blok is een schoon HTML-snippet dat:
 *   - uitsluitend classes uit site-base.css en blocks.css gebruikt (huisstijl);
 *   - realistische Nederlandse placeholder-teksten bevat;
 *   - placeholder-afbeeldingen gebruikt uit /images (geen externe hotlinks);
 *   - volledig bewerkbaar is via de live builder (de gedeelde scanner ILScan
 *     herkent de standaard-tags h1-h3/p/span/a/li/blockquote en img automatisch).
 *
 * De catalogus wordt zowel server-side (GET /api/blocks, prompt-context voor de
 * AI-agent) als client-side (admin-composer) gebruikt. De HTML wordt bij het
 * opslaan van een pagina door stripBuilderArtifacts() schoongehouden.
 *
 * Generalisatie: dit bestand is bewust losgekoppeld van de rest van de server.
 * Voor een andere site vervang je de teksten/afbeeldingen en de bijbehorende
 * tokens in site-base.css; de structuur en de classes blijven gelijk. Zie
 * app/docs/TEMPLATES.md.
 */

'use strict';

// Categorieën in vaste volgorde (voor groepering in de admin-UI).
const CATEGORIES = [
    { id: 'koppen',      name: 'Koppen' },
    { id: 'tekst',       name: 'Tekst' },
    { id: 'kenmerken',   name: 'Kenmerken' },
    { id: 'media',       name: 'Media' },
    { id: 'aanbod',      name: 'Aanbod' },
    { id: 'informatie',  name: 'Informatie' },
    { id: 'actie',       name: 'Actie' }
];

// De blokken. Volgorde = standaard weergavevolgorde in de bibliotheek.
const BLOCKS = [
    {
        id: 'pagina-kop',
        name: 'Pagina-kop',
        category: 'koppen',
        description: 'Donkere openingskop met eyebrow, titel en korte intro. Begin een pagina hiermee.',
        html: [
            '<section class="page-hero">',
            '  <div class="container">',
            '    <span class="eyebrow">Welkom</span>',
            '    <h1>Een titel die <em>blijft hangen</em></h1>',
            '    <p class="page-hero-sub">Schrijf hier een korte, warme introductie van een of twee zinnen. Vertel wat deze pagina te bieden heeft.</p>',
            '    <span class="script">een plek om te landen</span>',
            '  </div>',
            '</section>'
        ].join('\n')
    },
    {
        id: 'intro-tekst',
        name: 'Introductie',
        category: 'tekst',
        description: 'Rustig tekstblok met een cursieve introzin en twee alinea\u0027s.',
        html: [
            '<section class="section">',
            '  <div class="container">',
            '    <p class="lead">Een korte, cursieve introzin die de toon zet voor wat volgt.</p>',
            '    <p>Vertel hier in een paar alinea\u0027s waar het op deze pagina over gaat. Houd het concreet en menselijk, alsof je het tegen een gast vertelt. Wissel korte en wat langere zinnen af.</p>',
            '    <p>Een tweede alinea geeft ruimte voor detail. Beschrijf de sfeer, wat een bezoek oplevert of wat iemand kan verwachten.</p>',
            '  </div>',
            '</section>'
        ].join('\n')
    },
    {
        id: 'intro-foto',
        name: 'Tekst met foto',
        category: 'tekst',
        description: 'Tweekolomsblok met tekst naast een sfeerbeeld. Foto vervangbaar in de builder.',
        html: [
            '<section class="section section-sage">',
            '  <div class="container">',
            '    <div class="split">',
            '      <div>',
            '        <span class="eyebrow">In het kort</span>',
            '        <h2>Tekst naast een <em>sfeerbeeld</em></h2>',
            '        <p>Beschrijf hier het onderwerp. Deze opzet werkt goed om tekst en beeld naast elkaar te tonen. De foto vervang je later eenvoudig in de live builder.</p>',
            '        <p>Voeg gerust een tweede alinea toe met een concreet voorbeeld of een persoonlijk detail.</p>',
            '        <a href="/#boeken" class="btn-link">Plan een bezoek</a>',
            '      </div>',
            '      <figure class="bl-figure">',
            '        <img src="/images/placeholder-ruimte.svg" alt="Voorbeeldafbeelding, vervang door een eigen foto"/>',
            '      </figure>',
            '    </div>',
            '  </div>',
            '</section>'
        ].join('\n')
    },
    {
        id: 'kenmerken',
        name: 'Kenmerken / USP\u0027s',
        category: 'kenmerken',
        description: 'Sectiekop met drie kaarten om voordelen of kenmerken uit te lichten.',
        html: [
            '<section class="section section-warm">',
            '  <div class="container">',
            '    <div class="section-head">',
            '      <span class="eyebrow">Waarom hier</span>',
            '      <h2>Drie redenen om te <em>komen</em></h2>',
            '      <p>Een korte ondertitel die de kaarten hieronder introduceert.</p>',
            '    </div>',
            '    <div class="card-grid">',
            '      <article class="card">',
            '        <h3>Eerste <em>kenmerk</em></h3>',
            '        <span class="script">kort accent</span>',
            '        <p>Beschrijf hier kort en concreet wat dit kenmerk inhoudt en wat het de bezoeker oplevert.</p>',
            '      </article>',
            '      <article class="card">',
            '        <h3>Tweede <em>kenmerk</em></h3>',
            '        <span class="script">kort accent</span>',
            '        <p>Beschrijf hier kort en concreet wat dit kenmerk inhoudt en wat het de bezoeker oplevert.</p>',
            '      </article>',
            '      <article class="card">',
            '        <h3>Derde <em>kenmerk</em></h3>',
            '        <span class="script">kort accent</span>',
            '        <p>Beschrijf hier kort en concreet wat dit kenmerk inhoudt en wat het de bezoeker oplevert.</p>',
            '      </article>',
            '    </div>',
            '  </div>',
            '</section>'
        ].join('\n')
    },
    {
        id: 'kenmerken-lijst',
        name: 'Kenmerken met foto',
        category: 'kenmerken',
        description: 'Foto naast een opsomming met koperen opsommingstekens. Goed voor \u201cwat is inbegrepen\u201d.',
        html: [
            '<section class="section">',
            '  <div class="container">',
            '    <div class="split">',
            '      <figure class="bl-figure">',
            '        <img src="/images/placeholder-sfeer.svg" alt="Voorbeeldafbeelding, vervang door een eigen foto"/>',
            '      </figure>',
            '      <div>',
            '        <span class="eyebrow">Wat je krijgt</span>',
            '        <h2>Alles wat <em>inbegrepen</em> is</h2>',
            '        <ul class="feature-list">',
            '          <li>Eerste punt dat je aanbod beschrijft</li>',
            '          <li>Tweede punt met een concreet voordeel</li>',
            '          <li>Derde punt over comfort of sfeer</li>',
            '          <li>Vierde punt dat het geheel afmaakt</li>',
            '        </ul>',
            '      </div>',
            '    </div>',
            '  </div>',
            '</section>'
        ].join('\n')
    },
    {
        id: 'foto-galerij',
        name: 'Foto-galerij',
        category: 'media',
        description: 'Brede rij van drie beelden onder een sectiekop. Elk beeld vervangbaar.',
        html: [
            '<section class="section section-deep">',
            '  <div class="container">',
            '    <div class="section-head">',
            '      <span class="eyebrow">Beeld</span>',
            '      <h2>Een <em>indruk</em> in beeld</h2>',
            '    </div>',
            '  </div>',
            '  <div class="container-wide">',
            '    <div class="bl-gallery">',
            '      <figure class="bl-gallery-item"><img src="/images/placeholder-natuur.svg" alt="Voorbeeldafbeelding, vervang door een eigen foto"/></figure>',
            '      <figure class="bl-gallery-item"><img src="/images/placeholder-ruimte.svg" alt="Voorbeeldafbeelding, vervang door een eigen foto"/></figure>',
            '      <figure class="bl-gallery-item"><img src="/images/placeholder-sfeer.svg" alt="Voorbeeldafbeelding, vervang door een eigen foto"/></figure>',
            '    </div>',
            '  </div>',
            '</section>'
        ].join('\n')
    },
    {
        id: 'foto-tekst-portret',
        name: 'Portret met tekst',
        category: 'media',
        description: 'Staand portretbeeld naast een persoonlijk verhaal. Ideaal voor \u201cover ons\u201d.',
        html: [
            '<section class="section">',
            '  <div class="container">',
            '    <div class="split bl-split-portret">',
            '      <div>',
            '        <span class="eyebrow">Wie wij zijn</span>',
            '        <h2>Het verhaal <em>achter de plek</em></h2>',
            '        <p>Vertel hier wie je bent en waarom je doet wat je doet. Een persoonlijk verhaal maakt het verschil en geeft bezoekers vertrouwen.</p>',
            '        <p>Houd het warm en oprecht. Eén concreet detail zegt vaak meer dan tien mooie woorden.</p>',
            '        <blockquote class="quote">Een korte uitspraak die jullie drijfveer samenvat.</blockquote>',
            '      </div>',
            '      <figure class="bl-figure bl-figure-portret">',
            '        <img src="/images/placeholder-portret.svg" alt="Voorbeeldafbeelding, vervang door een eigen foto"/>',
            '      </figure>',
            '    </div>',
            '  </div>',
            '</section>'
        ].join('\n')
    },
    {
        id: 'citaat',
        name: 'Citaat',
        category: 'tekst',
        description: 'Groot citaat op een donkere achtergrond, met koperen rand.',
        html: [
            '<section class="section section-ink">',
            '  <div class="container">',
            '    <blockquote class="quote">Een krachtig citaat of een uitspraak die blijft hangen. Gebruik <em>cursief</em> voor nadruk op de kern.</blockquote>',
            '  </div>',
            '</section>'
        ].join('\n')
    },
    {
        id: 'prijzen-pakketten',
        name: 'Prijzen / pakketten',
        category: 'aanbod',
        description: 'Drie pakketkaarten met prijs, kenmerken en een reserveerknop.',
        html: [
            '<section class="section section-warm">',
            '  <div class="container">',
            '    <div class="section-head">',
            '      <span class="eyebrow">Tarieven</span>',
            '      <h2>Onze <em>pakketten</em></h2>',
            '      <p>Kies wat past. De prijzen en kenmerken pas je eenvoudig aan.</p>',
            '    </div>',
            '    <div class="card-grid">',
            '      <article class="card bl-price">',
            '        <span class="mono-label">Basis</span>',
            '        <div class="bl-price-amount">&euro; 295</div>',
            '        <span class="script">per dagdeel</span>',
            '        <ul class="feature-list">',
            '          <li>Gebruik van de ruimte</li>',
            '          <li>Koffie en thee</li>',
            '          <li>Wifi en faciliteiten</li>',
            '        </ul>',
            '        <a href="/#boeken" class="cta">Reserveer</a>',
            '      </article>',
            '      <article class="card bl-price bl-price-featured">',
            '        <span class="mono-label">Compleet</span>',
            '        <div class="bl-price-amount">&euro; 495</div>',
            '        <span class="script">per dag</span>',
            '        <ul class="feature-list">',
            '          <li>De hele dag de ruimte</li>',
            '          <li>Lunch met streekproducten</li>',
            '          <li>Koffie, thee en water</li>',
            '          <li>Begeleiding op aanvraag</li>',
            '        </ul>',
            '        <a href="/#boeken" class="cta">Reserveer</a>',
            '      </article>',
            '      <article class="card bl-price">',
            '        <span class="mono-label">Op maat</span>',
            '        <div class="bl-price-amount">In overleg</div>',
            '        <span class="script">jouw wensen</span>',
            '        <ul class="feature-list">',
            '          <li>Meerdaags verblijf</li>',
            '          <li>Eigen programma</li>',
            '          <li>Overnachten in de B&amp;B</li>',
            '        </ul>',
            '        <a href="/#boeken" class="cta">Vraag aan</a>',
            '      </article>',
            '    </div>',
            '  </div>',
            '</section>'
        ].join('\n')
    },
    {
        id: 'stappenplan',
        name: 'Stappenplan',
        category: 'informatie',
        description: 'Drie genummerde stappen die een proces of werkwijze uitleggen.',
        html: [
            '<section class="section">',
            '  <div class="container">',
            '    <div class="section-head">',
            '      <span class="eyebrow">Hoe het werkt</span>',
            '      <h2>In <em>drie stappen</em></h2>',
            '    </div>',
            '    <div class="bl-steps">',
            '      <div class="bl-step">',
            '        <span class="bl-step-num">1</span>',
            '        <h3>Eerste stap</h3>',
            '        <p>Beschrijf kort wat er in deze stap gebeurt en wat de bezoeker kan verwachten.</p>',
            '      </div>',
            '      <div class="bl-step">',
            '        <span class="bl-step-num">2</span>',
            '        <h3>Tweede stap</h3>',
            '        <p>Beschrijf kort wat er in deze stap gebeurt en wat de bezoeker kan verwachten.</p>',
            '      </div>',
            '      <div class="bl-step">',
            '        <span class="bl-step-num">3</span>',
            '        <h3>Derde stap</h3>',
            '        <p>Beschrijf kort wat er in deze stap gebeurt en wat de bezoeker kan verwachten.</p>',
            '      </div>',
            '    </div>',
            '  </div>',
            '</section>'
        ].join('\n')
    },
    {
        id: 'faq',
        name: 'Veelgestelde vragen',
        category: 'informatie',
        description: 'Lijst met vraag-en-antwoord, elk afzonderlijk te bewerken.',
        html: [
            '<section class="section section-warm">',
            '  <div class="container">',
            '    <div class="section-head">',
            '      <span class="eyebrow">Goed om te weten</span>',
            '      <h2>Veelgestelde <em>vragen</em></h2>',
            '    </div>',
            '    <div class="bl-faq">',
            '      <div class="bl-faq-item">',
            '        <h3>Een vraag die vaak gesteld wordt?</h3>',
            '        <p>Het antwoord op de vraag, kort en duidelijk geformuleerd zodat de bezoeker meteen weet waar hij aan toe is.</p>',
            '      </div>',
            '      <div class="bl-faq-item">',
            '        <h3>Een tweede veelgestelde vraag?</h3>',
            '        <p>Geef een helder antwoord. Verwijs gerust naar de boekingspagina of het contactadres als dat helpt.</p>',
            '      </div>',
            '      <div class="bl-faq-item">',
            '        <h3>En nog een vraag?</h3>',
            '        <p>Houd antwoorden bondig. Twee tot drie zinnen is meestal genoeg.</p>',
            '      </div>',
            '    </div>',
            '  </div>',
            '</section>'
        ].join('\n')
    },
    {
        id: 'contact-cta',
        name: 'Contact / oproep',
        category: 'actie',
        description: 'Donker uitgelicht blok met een uitnodigende afsluiter en knop.',
        html: [
            '<section class="section section-ink">',
            '  <div class="container">',
            '    <div class="callout">',
            '      <div>',
            '        <span class="eyebrow">Kom langs</span>',
            '        <h3>Klaar om te <em>boeken</em>?</h3>',
            '        <p>Een korte, uitnodigende afsluiter. Nodig de bezoeker uit om contact op te nemen of een datum te reserveren.</p>',
            '      </div>',
            '      <a href="/#boeken" class="cta">Boek nu</a>',
            '    </div>',
            '  </div>',
            '</section>'
        ].join('\n')
    }
];

// Publieke catalogus: metadata + html per blok, plus de categorieën.
function getCatalog() {
    return {
        categories: CATEGORIES.slice(),
        blocks: BLOCKS.map(b => ({
            id: b.id,
            name: b.name,
            category: b.category,
            description: b.description,
            html: b.html
        }))
    };
}

// Eén blok op id opzoeken.
function getBlock(id) {
    return BLOCKS.find(b => b.id === id) || null;
}

// Een pagina-HTML samenstellen uit een lijst van blok-id's (server-side vangnet
// en herbruikbaar voor de AI-koppeling). Onbekende id's worden overgeslagen.
function assembleHtml(ids) {
    if (!Array.isArray(ids)) return '';
    return ids
        .map(id => getBlock(id))
        .filter(Boolean)
        .map(b => b.html)
        .join('\n\n');
}

module.exports = { CATEGORIES, BLOCKS, getCatalog, getBlock, assembleHtml };
