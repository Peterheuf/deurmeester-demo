/**
 * DeurMeester - applicatieserver
 *
 * Serveert de website, bewaart offerteaanvragen (configuraties) en content-overrides,
 * en levert een beveiligde admin-backend met live builder.
 *
 * Opslag gebeurt in JSON-bestanden in /data zodat er geen database-server
 * nodig is. Dit draait lokaal en op elke host die Node.js ondersteunt.
 */

const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieSession = require('cookie-session');
const multer = require('multer');
const { sendMail } = require('./lib/mailer');
const aiagent = require('./lib/aiagent');
const pageDesign = require('./lib/page-design-variants');
const blocks = require('./lib/blocks');
const wireframes = require('./lib/wireframes');
const elements = require('./lib/elements');
const agentActions = require('./lib/agent-actions');
const agentImages = require('./lib/agent-images');
const mediaLibrary = require('./lib/media-library');

// Bij Netlify Functions wordt server.js in de function-bundle geplaatst; paden
// wijzen dan naar netlify/functions/ i.p.v. de projectroot.
const ROOT = /netlify[/\\]functions$/.test(__dirname)
    ? path.resolve(__dirname, '..', '..')
    : __dirname;

const app = express();
const PORT = process.env.PORT || 4000;
const IS_SERVERLESS = !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.NETLIFY;
let mediaIndexCache = null;
let mediaIndexCacheAt = 0;
const MEDIA_CACHE_TTL_MS = 60000;

if (IS_SERVERLESS || process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// Wachtwoord voor de admin-backend. Lokaal prima; in productie via een
// omgevingsvariabele zetten (ADMIN_PASSWORD).
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'democms';

// ---------------------------------------------------------------------------
// Bestandsopslag
// ---------------------------------------------------------------------------
const BUNDLED_DATA_DIR = path.join(ROOT, 'data');
const DATA_DIR = IS_SERVERLESS
    ? path.join('/tmp', 'deurmeester-data')
    : BUNDLED_DATA_DIR;
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const TEMPLATES_FILE = path.join(DATA_DIR, 'email-templates.json');
const OUTBOX_FILE = path.join(DATA_DIR, 'outbox.json');
const STYLEGUIDE_FILE = path.join(DATA_DIR, 'styleguide.json');
const PAGES_FILE = path.join(DATA_DIR, 'pages.json');
const UPLOAD_DIR = IS_SERVERLESS
    ? path.join('/tmp', 'deurmeester-uploads')
    : path.join(ROOT, 'public', 'uploads');
const INDEX_HTML = path.join(ROOT, 'public', 'index.html');
// Theme-manifest: site-specifieke instellingen (selectors, secties, kleur-tokens),
// gescheiden van de generieke CMS-engine. De publieke kopie wordt door de pagina's
// vóór il-scan ingeladen als window.ILSiteConfig.
const SITE_CONFIG_FILE = path.join(ROOT, 'theme', 'site.config.json');
const PUBLIC_SITE_CONFIG_FILE = path.join(ROOT, 'public', 'assets', 'site-config.json');

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function seedServerlessData() {
    if (!IS_SERVERLESS) return;
    ensureDir(DATA_DIR);
    ensureDir(UPLOAD_DIR);
    if (!fs.existsSync(BUNDLED_DATA_DIR)) return;
    for (const name of fs.readdirSync(BUNDLED_DATA_DIR)) {
        const src = path.join(BUNDLED_DATA_DIR, name);
        const dest = path.join(DATA_DIR, name);
        if (!fs.existsSync(dest) && fs.statSync(src).isFile()) {
            fs.copyFileSync(src, dest);
        }
    }
}

if (IS_SERVERLESS) {
    seedServerlessData();
} else {
    ensureDir(DATA_DIR);
    ensureDir(UPLOAD_DIR);
}

function readJSON(file, fallback) {
    try {
        if (!fs.existsSync(file)) return fallback;
        const raw = fs.readFileSync(file, 'utf8').trim();
        if (!raw) return fallback;
        return JSON.parse(raw);
    } catch (e) {
        console.error('Kon ' + file + ' niet lezen:', e.message);
        return fallback;
    }
}

function writeJSON(file, data) {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, file);
}

// Standaard content-structuur: tekst/link overrides per element-key + globale stijl
function defaultContent() {
    return {
        edits: {},
        global: { colors: {}, logoSrc: null, heroBgSrc: null },
        images: {},
        updatedAt: null
    };
}

// Standaard instellingen voor bedrijf, contact en SMTP
function defaultSettings() {
    return {
        bedrijfsnaam: 'DeurMeester',
        tagline: 'Binnendeuren op maat',
        contactEmail: '',
        telefoon: '',
        adres: '',
        meldingsEmail: '',
        smtp: {
            host: '',
            port: 587,
            secure: false,
            user: '',
            pass: '',
            fromNaam: 'DeurMeester',
            fromAdres: ''
        },
        ai: {
            provider: aiagent.DEFAULT_PROVIDER,
            apiKey: '',
            baseUrl: aiagent.DEFAULT_BASE_URL,
            model: aiagent.DEFAULT_MODEL,
            pageBuilderModel: aiagent.DEFAULT_PAGE_BUILDER_MODEL,
            enabled: false
        },
        updatedAt: null
    };
}

// Standaard e-mailsjablonen (Nederlands, passend bij de merkstijl)
function defaultEmailTemplates() {
    const wrap = (title, body) =>
        '<div style="font-family:Georgia,\'Times New Roman\',serif;max-width:560px;margin:0 auto;background:#faf8f5;color:#1e1e1e;border:1px solid #e5ddd2;border-radius:10px;overflow:hidden">' +
          '<div style="background:#1e1e1e;padding:28px 32px;text-align:center">' +
            '<div style="color:#d4b896;font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase">{{siteName}}</div>' +
            '<div style="color:#faf8f5;font-size:24px;margin-top:6px">' + title + '</div>' +
          '</div>' +
          '<div style="padding:32px;font-size:15px;line-height:1.7;color:#3a3a3a">' + body + '</div>' +
          '<div style="padding:18px 32px;background:#f0ebe3;font-family:Arial,sans-serif;font-size:11px;color:#7a7168;text-align:center">' +
            '{{siteName}} · Dit is een automatisch bericht.' +
          '</div>' +
        '</div>';

    const guestBody =
        '<p>Beste {{name}},</p>' +
        '<p>Hartelijk dank voor je offerteaanvraag bij {{siteName}}. We hebben je deurconfiguratie in goede orde ontvangen en sturen binnen 48 uur een vrijblijvende offerte.</p>' +
        '<div style="background:#fff;border:1px solid #e5ddd2;border-radius:8px;padding:18px 20px;margin:20px 0">' +
          '<p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#a67c52">Jouw configuratie</p>' +
          '<p style="margin:4px 0"><strong>Deurtype:</strong> {{deurType}}</p>' +
          '<p style="margin:4px 0"><strong>Materiaal:</strong> {{materiaal}}</p>' +
          '<p style="margin:4px 0"><strong>Afmetingen:</strong> {{afmetingen}}</p>' +
          '<p style="margin:4px 0"><strong>Afwerking:</strong> {{afwerking}}</p>' +
          '<p style="margin:4px 0"><strong>Montage:</strong> {{montage}}</p>' +
          '<p style="margin:4px 0"><strong>Opmerkingen:</strong> {{notes}}</p>' +
          '<p style="margin:10px 0 0;font-size:12px;color:#7a7168">Referentie: {{id}}</p>' +
        '</div>' +
        '<p>Heb je in de tussentijd vragen? Beantwoord dan gerust deze e-mail.</p>' +
        '<p>Met vriendelijke groet,<br/>Het team van {{siteName}}</p>';

    const ownerBody =
        '<p>Er is een nieuwe deurconfiguratie binnengekomen via de website.</p>' +
        '<div style="background:#fff;border:1px solid #e5ddd2;border-radius:8px;padding:18px 20px;margin:20px 0">' +
          '<p style="margin:0 0 10px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#a67c52">Gegevens aanvrager</p>' +
          '<p style="margin:4px 0"><strong>Naam:</strong> {{name}}</p>' +
          '<p style="margin:4px 0"><strong>E-mail:</strong> {{email}}</p>' +
          '<p style="margin:4px 0"><strong>Telefoon:</strong> {{phone}}</p>' +
          '<p style="margin:12px 0 6px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#a67c52">Configuratie</p>' +
          '<p style="margin:4px 0"><strong>Deurtype:</strong> {{deurType}}</p>' +
          '<p style="margin:4px 0"><strong>Materiaal:</strong> {{materiaal}}</p>' +
          '<p style="margin:4px 0"><strong>Afmetingen:</strong> {{afmetingen}}</p>' +
          '<p style="margin:4px 0"><strong>Afwerking:</strong> {{afwerking}}</p>' +
          '<p style="margin:4px 0"><strong>Montage:</strong> {{montage}}</p>' +
          '<p style="margin:4px 0"><strong>Opmerkingen:</strong> {{notes}}</p>' +
          '<p style="margin:10px 0 0;font-size:12px;color:#7a7168">Referentie: {{id}}</p>' +
        '</div>' +
        '<p>Log in op de beheeromgeving om de aanvraag te bekijken en te beantwoorden.</p>';

    return {
        booking_confirmation: {
            naam: 'Bevestiging aan de klant',
            subject: 'Bedankt voor je offerteaanvraag bij {{siteName}}',
            html: wrap('Configuratie ontvangen', guestBody)
        },
        booking_notification: {
            naam: 'Melding aan DeurMeester',
            subject: 'Nieuwe deurconfiguratie van {{name}}',
            html: wrap('Nieuwe configuratie', ownerBody)
        }
    };
}

// ---------------------------------------------------------------------------
// Huisstijl (stijlgids)
// ---------------------------------------------------------------------------

// Labels bij de bekende kleurvariabelen (voor leesbaarheid in de admin)
const TOKEN_LABELS = {
    '--ink': 'Inkt (donker)',
    '--ink-soft': 'Inkt zacht',
    '--paper': 'Papier (achtergrond)',
    '--paper-warm': 'Papier warm',
    '--paper-deep': 'Papier diep',
    '--sage': 'Salie',
    '--sage-deep': 'Salie diep',
    '--sage-light': 'Salie licht',
    '--copper': 'Koper (accent)',
    '--copper-hot': 'Koper warm',
    '--copper-soft': 'Koper zacht',
    '--stone': 'Steen',
    '--line': 'Lijn',
    '--line-strong': 'Lijn sterk'
};

// Lees de echte tokens en fonts uit public/index.html
function extractBrandFromIndex() {
    const out = { tokens: [], googleFontsHref: '' };
    let html = '';
    try { html = fs.readFileSync(INDEX_HTML, 'utf8'); } catch (e) { return out; }

    // Eerste :root { ... } blok pakken en --var: waarde; eruit halen
    const rootMatch = html.match(/:root\s*\{([\s\S]*?)\}/);
    if (rootMatch) {
        const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
        let m;
        while ((m = re.exec(rootMatch[1])) !== null) {
            const varName = m[1].trim();
            const value = m[2].trim();
            out.tokens.push({
                var: varName,
                hex: value,
                label: TOKEN_LABELS[varName] || varName.replace(/^--/, '')
            });
        }
    }

    // Google Fonts <link href="...fonts.googleapis.com/css2...">
    const hrefMatch = html.match(/href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/);
    if (hrefMatch) out.googleFontsHref = hrefMatch[1].replace(/&amp;/g, '&');

    return out;
}

// Korte documentatie van de beschikbare classes uit site-base.css
function defaultComponentsDoc() {
    return [
        'Layout:',
        '  .container / .container-wide  - gecentreerde inhoud (max 1100 / 1440px).',
        '  section.section               - sectie met ruime padding. Varianten: .section-warm, .section-deep, .section-ink (donker), .section-sage (groen).',
        '  .split                        - tweekoloms-grid (klapt om op mobiel).',
        '  .section-head                 - gecentreerde sectiekop met <span class="eyebrow"> + <h2> + <p>.',
        '',
        'Pagina-intro:',
        '  section.page-hero             - donkere kop bovenaan met .eyebrow, <h1>, .page-hero-sub en optioneel een <span class="script">.',
        '',
        'Typografie:',
        '  .eyebrow                      - klein kapitaal koperen labeltje boven een kop.',
        '  .lead                         - cursieve introzin in serif.',
        '  .script                       - handgeschreven accent (Caveat).',
        '  <em> in koppen kleurt automatisch koper.',
        '',
        'Knoppen:',
        '  .cta of .btn.cta              - koperen call-to-action.',
        '  .btn                          - groene (sage) knop.',
        '  .btn-link                     - tekstlink met koperen onderstreping en pijl.',
        '',
        'Kaarten en blokken:',
        '  .card-grid > .card            - responsive kaartenraster. Gebruik <h3>, .script, <p>.',
        '  .card.card-photo              - kaart met <img> bovenaan en .card-body eronder.',
        '  .feature-list                 - lijst met koperen stip per item.',
        '  .quote                        - groot citaat met koperen rand links.',
        '  .callout                      - donker uitgelicht blok met tekst + knop.'
    ].join('\n');
}

function defaultGuidelines() {
    return [
        "Bouw een pagina van boven naar beneden op: begin met een section.page-hero met een korte, pakkende kop en een zin of twee uitleg.",
        "Wissel daarna lichte en donkere secties af (section / section-warm / section-ink / section-sage) zodat er ritme in de pagina zit.",
        "Houd het rustig: niet te veel knoppen of kleuren per scherm. Veel witruimte hoort bij de stijl.",
        "Gebruik korte alinea's en concrete taal. Schrijf als een vakman die helder uitlegt, niet als een brochure.",
        "Sluit een pagina vaak af met een .callout of een duidelijke call-to-action (bijvoorbeeld een link naar /#boeken voor een offerte).",
        "Verwijs voor de deurconfigurator naar /#boeken en voor contact naar het e-mailadres uit de instellingen.",
        "Gebruik nooit em-dashes (—). Gebruik gewone zinnen, een komma of een punt."
    ].join('\n');
}

function defaultVoice() {
    return [
        "Warm en professioneel Nederlands. Concreet over kwaliteit, maatwerk en montage.",
        "Menselijk en betrouwbaar, alsof een deurmeester het persoonlijk uitlegt.",
        "Niet opgeklopt en niet 'AI-achtig'. Geen loze superlatieven of clichés.",
        "Gebruik GEEN em-dashes (—). Schrijf rustige, korte zinnen.",
        "Liever tonen dan opscheppen: vertel wat je levert en wat het de klant oplevert."
    ].join('\n');
}

function defaultStyleguide() {
    const brand = extractBrandFromIndex();
    const href = brand.googleFontsHref ||
        'https://fonts.googleapis.com/css2?family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@300;400;500;600;700&family=Caveat:wght@500;700&display=swap';
    return {
        tokens: brand.tokens.length ? brand.tokens : [],
        fonts: {
            heading: 'Libre Caslon Text',
            body: 'Montserrat',
            accent: 'Caveat',
            googleFontsHref: href
        },
        voice: defaultVoice(),
        components: defaultComponentsDoc(),
        baseCssUrl: '/assets/site-base.css',
        guidelines: defaultGuidelines(),
        updatedAt: null
    };
}

if (!fs.existsSync(CONTENT_FILE)) writeJSON(CONTENT_FILE, defaultContent());
if (!fs.existsSync(BOOKINGS_FILE)) writeJSON(BOOKINGS_FILE, []);
if (!fs.existsSync(SETTINGS_FILE)) writeJSON(SETTINGS_FILE, defaultSettings());
if (!fs.existsSync(TEMPLATES_FILE)) writeJSON(TEMPLATES_FILE, defaultEmailTemplates());
if (!fs.existsSync(OUTBOX_FILE)) writeJSON(OUTBOX_FILE, []);
if (!fs.existsSync(STYLEGUIDE_FILE)) writeJSON(STYLEGUIDE_FILE, defaultStyleguide());
if (!fs.existsSync(PAGES_FILE)) writeJSON(PAGES_FILE, []);

// Sjabloon renderen: vervang {{var}} door waarden (onbekende vars → leeg)
function renderTemplate(str, vars) {
    return String(str || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (m, key) => {
        return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : '';
    });
}

// Variabelen voor een configuratoraanvraag samenstellen
function formatAfmetingen(b) {
    if (b.standaardMaat && b.standaardMaat !== 'Maatwerk (op maat)') return b.standaardMaat;
    if (b.breedte || b.hoogte) return (b.breedte || '?') + ' × ' + (b.hoogte || '?') + ' cm';
    if (b.size) return b.size;
    return 'niet ingevuld';
}

function formatAfwerking(b) {
    if (b.afwerking === 'Custom RAL' && b.ralKleur) return 'RAL ' + b.ralKleur;
    return b.afwerking || 'niet ingevuld';
}

function aanvraagVars(aanvraag, settings) {
    const b = aanvraag || {};
    const deurType = b.deurType || b.type || 'niet ingevuld';
    const materiaal = b.materiaal || b.space || 'niet ingevuld';
    return {
        name: b.name || '',
        email: b.email || '',
        phone: b.phone || 'niet ingevuld',
        deurType: deurType,
        materiaal: materiaal,
        afmetingen: formatAfmetingen(b),
        afwerking: formatAfwerking(b),
        montage: b.montage || 'niet ingevuld',
        type: deurType,
        period: formatAfmetingen(b),
        size: b.size || formatAfmetingen(b),
        space: materiaal,
        extras: (b.extras && b.extras.length) ? b.extras.join(', ') : 'geen',
        notes: b.notes || 'geen',
        id: b.id || '',
        siteName: (settings && settings.bedrijfsnaam) || 'DeurMeester'
    };
}
const bookingVars = aanvraagVars;

// Bevestigings- en meldingsmails best-effort versturen (mag het opslaan nooit blokkeren)
async function sendAanvraagEmails(aanvraag) {
    try {
        const settings = readJSON(SETTINGS_FILE, defaultSettings());
        const templates = readJSON(TEMPLATES_FILE, defaultEmailTemplates());
        const vars = aanvraagVars(aanvraag, settings);

        const conf = templates.booking_confirmation || {};
        await sendMail({
            to: aanvraag.email,
            subject: renderTemplate(conf.subject, vars),
            html: renderTemplate(conf.html, vars),
            trigger: 'booking_confirmation'
        });

        const notif = templates.booking_notification || {};
        const ownerTo = (settings.meldingsEmail || settings.contactEmail || '').trim();
        await sendMail({
            to: ownerTo,
            subject: renderTemplate(notif.subject, vars),
            html: renderTemplate(notif.html, vars),
            trigger: 'booking_notification'
        });
    } catch (e) {
        console.error('sendAanvraagEmails fout:', e.message);
    }
}
const sendBookingEmails = sendAanvraagEmails;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Stateless signed-cookie sessies: werkt op Netlify serverless (geen in-memory store).
app.use(cookieSession({
    name: 'il.sid',
    keys: [process.env.SESSION_SECRET || 'deurmeester-dev-secret'],
    maxAge: 1000 * 60 * 60 * 8,
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_SERVERLESS || process.env.NODE_ENV === 'production',
    path: '/'
}));

function requireAuth(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    return res.status(401).json({ error: 'Niet ingelogd' });
}

// Upload-config voor logo / hero-afbeeldingen
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const ext = (path.extname(file.originalname) || '.png').toLowerCase();
        const safe = 'upload-' + Date.now() + '-' + Math.round(Math.random() * 1e6) + ext;
        cb(null, safe);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/^image\//.test(file.mimetype)) cb(null, true);
        else cb(new Error('Alleen afbeeldingen toegestaan'));
    }
});

// ---------------------------------------------------------------------------
// Publieke API
// ---------------------------------------------------------------------------

// Content-overrides ophalen (wordt door de site bij elke load gebruikt)
app.get('/api/content', (req, res) => {
    res.json(readJSON(CONTENT_FILE, defaultContent()));
});

// Theme-manifest (publiek, read-only). Levert de site-specifieke instellingen
// (chrome-secties, skip-classes, logo/hero-selectors, homepage-secties,
// kleur-tokens) die de generieke engine als window.ILSiteConfig gebruikt. Leest
// bij voorkeur theme/site.config.json, valt terug op de publieke kopie.
function readSiteConfig() {
    return readJSON(SITE_CONFIG_FILE, null) || readJSON(PUBLIC_SITE_CONFIG_FILE, {}) || {};
}
app.get('/api/site-config', (req, res) => {
    res.json(readSiteConfig());
});

// Publiek menu: gepubliceerde pagina's die in het hoofdmenu horen.
// De homepage injecteert deze items client-side in de navigatie.
app.get('/api/menu', (req, res) => {
    res.json(menuItems());
});

// Publieke (read-only) blokken-catalogus: metadata + html van de herbruikbare
// gestylede template-blokken. Blijft bestaan als interne render-laag/legacy.
app.get('/api/blocks', (req, res) => {
    res.json(blocks.getCatalog());
});

// Publieke (read-only) wireframe-catalogus: low-fi paginaskeletten met een
// machine-leesbare structuur. Dit is de KEUZE-laag waarmee de gebruiker eerst
// de structuur van een pagina bepaalt; de AI-agent bouwt er daarna een on-brand
// pagina van. Levert per item: id, name, category, description, wireframe-HTML,
// structure en (voor de niet-AI-route) een on-brand scaffold.
app.get('/api/wireframes', (req, res) => {
    res.json(wireframes.getCatalog());
});

// Herbruikbare elementen/widgets (publiek read-only).
app.get('/api/elements', (req, res) => {
    res.json(elements.getCatalog());
});

app.get('/api/elements/:id', (req, res) => {
    const el = elements.getElement(req.params.id);
    if (!el) return res.status(404).json({ error: 'Element niet gevonden' });
    res.json({ id: el.id, name: el.name, category: el.category, html: el.html, css: el.css || [], scripts: el.scripts || [] });
});

// Nieuwe configuratoraanvraag opslaan (vanuit de deurconfigurator op de site)
function createAanvraag(req, res) {
    const b = req.body || {};
    const name = String(b.name || '').trim();
    const email = String(b.email || '').trim();
    if (!name || !email) {
        return res.status(400).json({ error: 'Naam en e-mail zijn verplicht' });
    }

    const bookings = readJSON(BOOKINGS_FILE, []);
    const deurType = String(b.deurType || b.type || '').slice(0, 200);
    const materiaal = String(b.materiaal || '').slice(0, 200);
    const booking = {
        id: 'DM-' + Date.now().toString(36).toUpperCase(),
        createdAt: new Date().toISOString(),
        status: 'nieuw',
        deurType: deurType,
        materiaal: materiaal,
        breedte: String(b.breedte || '').slice(0, 20),
        hoogte: String(b.hoogte || '').slice(0, 20),
        standaardMaat: String(b.standaardMaat || '').slice(0, 100),
        afwerking: String(b.afwerking || '').slice(0, 200),
        ralKleur: String(b.ralKleur || '').slice(0, 40),
        montage: String(b.montage || '').slice(0, 100),
        type: deurType,
        start: String(b.start || '').slice(0, 40),
        end: String(b.end || '').slice(0, 40),
        size: formatAfmetingen(b),
        space: materiaal,
        extras: Array.isArray(b.extras) ? b.extras.map(x => String(x).slice(0, 100)).slice(0, 30) : [],
        name: name.slice(0, 200),
        org: String(b.org || '').slice(0, 200),
        email: email.slice(0, 200),
        phone: String(b.phone || '').slice(0, 60),
        notes: String(b.notes || '').slice(0, 4000)
    };
    bookings.unshift(booking);
    writeJSON(BOOKINGS_FILE, bookings);

    sendAanvraagEmails(booking);

    res.status(201).json({ ok: true, id: booking.id });
}
app.post('/api/bookings', createAanvraag);
app.post('/api/aanvragen', createAanvraag);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
app.post('/api/login', (req, res) => {
    const pw = String((req.body && req.body.password) || '');
    if (pw && pw === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        return res.json({ ok: true });
    }
    res.status(401).json({ error: 'Onjuist wachtwoord' });
});

app.post('/api/logout', (req, res) => {
    req.session = null;
    res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
    res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// ---------------------------------------------------------------------------
// Beveiligde admin-API
// ---------------------------------------------------------------------------

function listAanvragen(req, res) {
    res.json(readJSON(BOOKINGS_FILE, []));
}

function patchAanvraag(req, res) {
    const bookings = readJSON(BOOKINGS_FILE, []);
    const idx = bookings.findIndex(b => b.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Niet gevonden' });
    const allowed = ['nieuw', 'in_behandeling', 'behandeld', 'geannuleerd'];
    if (req.body && allowed.includes(req.body.status)) {
        bookings[idx].status = req.body.status;
        writeJSON(BOOKINGS_FILE, bookings);
    }
    res.json({ ok: true, booking: bookings[idx] });
}

function deleteAanvraag(req, res) {
    let bookings = readJSON(BOOKINGS_FILE, []);
    bookings = bookings.filter(b => b.id !== req.params.id);
    writeJSON(BOOKINGS_FILE, bookings);
    res.json({ ok: true });
}

// Alle offerteaanvragen bekijken (/api/bookings blijft alias)
app.get('/api/bookings', requireAuth, listAanvragen);
app.get('/api/aanvragen', requireAuth, listAanvragen);

// Status bijwerken (nieuw / in_behandeling / afgehandeld / geannuleerd)
app.patch('/api/bookings/:id', requireAuth, patchAanvraag);
app.patch('/api/aanvragen/:id', requireAuth, patchAanvraag);

// Offerteaanvraag verwijderen
app.delete('/api/bookings/:id', requireAuth, deleteAanvraag);
app.delete('/api/aanvragen/:id', requireAuth, deleteAanvraag);

// Content-overrides opslaan (vanuit de live builder)
app.put('/api/content', requireAuth, (req, res) => {
    const body = req.body || {};
    const content = {
        edits: (body.edits && typeof body.edits === 'object') ? body.edits : {},
        global: {
            colors: (body.global && body.global.colors) || {},
            logoSrc: (body.global && body.global.logoSrc) || null,
            heroBgSrc: (body.global && body.global.heroBgSrc) || null
        },
        images: (body.images && typeof body.images === 'object') ? body.images : {},
        updatedAt: new Date().toISOString()
    };
    writeJSON(CONTENT_FILE, content);
    res.json({ ok: true, updatedAt: content.updatedAt });
});

// Afbeelding uploaden (logo / hero), geeft het pad terug
app.post('/api/upload', requireAuth, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Geen bestand ontvangen' });
    res.json({ ok: true, src: '/uploads/' + req.file.filename });
});

// --------------------------- Instellingen ---------------------------
app.get('/api/settings', requireAuth, (req, res) => {
    res.json(readJSON(SETTINGS_FILE, defaultSettings()));
});

app.put('/api/settings', requireAuth, (req, res) => {
    const cur = readJSON(SETTINGS_FILE, defaultSettings());
    const b = req.body || {};
    const s = b.smtp || {};
    const settings = {
        bedrijfsnaam: String(b.bedrijfsnaam != null ? b.bedrijfsnaam : cur.bedrijfsnaam || '').slice(0, 200),
        tagline: String(b.tagline != null ? b.tagline : cur.tagline || '').slice(0, 300),
        contactEmail: String(b.contactEmail != null ? b.contactEmail : cur.contactEmail || '').slice(0, 200),
        telefoon: String(b.telefoon != null ? b.telefoon : cur.telefoon || '').slice(0, 60),
        adres: String(b.adres != null ? b.adres : cur.adres || '').slice(0, 400),
        meldingsEmail: String(b.meldingsEmail != null ? b.meldingsEmail : cur.meldingsEmail || '').slice(0, 200),
        smtp: {
            host: String(s.host != null ? s.host : (cur.smtp && cur.smtp.host) || '').slice(0, 200),
            port: Number(s.port != null ? s.port : (cur.smtp && cur.smtp.port) || 587) || 587,
            secure: !!(s.secure != null ? s.secure : (cur.smtp && cur.smtp.secure)),
            user: String(s.user != null ? s.user : (cur.smtp && cur.smtp.user) || '').slice(0, 200),
            pass: String(s.pass != null ? s.pass : (cur.smtp && cur.smtp.pass) || '').slice(0, 400),
            fromNaam: String(s.fromNaam != null ? s.fromNaam : (cur.smtp && cur.smtp.fromNaam) || '').slice(0, 200),
            fromAdres: String(s.fromAdres != null ? s.fromAdres : (cur.smtp && cur.smtp.fromAdres) || '').slice(0, 200)
        },
        updatedAt: new Date().toISOString()
    };

    // AI-instellingen (Kimi via Moonshot of OpenRouter).
    // enabled wordt afgeleid van of er een sleutel is.
    const curAi = cur.ai || {};
    const a = b.ai || {};
    const apiKey = String(a.apiKey != null ? a.apiKey : curAi.apiKey || '').trim().slice(0, 400);
    const reqProvider = a.provider != null ? a.provider : curAi.provider;
    const provider = aiagent.PROVIDERS[reqProvider] ? reqProvider : aiagent.DEFAULT_PROVIDER;
    const providerDef = aiagent.PROVIDERS[provider];
    settings.ai = {
        provider: provider,
        apiKey: apiKey,
        baseUrl: String(a.baseUrl != null ? a.baseUrl : curAi.baseUrl || providerDef.baseUrl).trim().slice(0, 300) || providerDef.baseUrl,
        model: String(a.model != null ? a.model : curAi.model || providerDef.model).trim().slice(0, 120) || providerDef.model,
        pageBuilderModel: String(a.pageBuilderModel != null ? a.pageBuilderModel : curAi.pageBuilderModel || aiagent.DEFAULT_PAGE_BUILDER_MODEL).trim().slice(0, 120) || aiagent.DEFAULT_PAGE_BUILDER_MODEL,
        enabled: !!apiKey
    };

    writeJSON(SETTINGS_FILE, settings);
    res.json({ ok: true, settings });
});

// --------------------------- E-mailsjablonen ---------------------------
app.get('/api/email-templates', requireAuth, (req, res) => {
    res.json(readJSON(TEMPLATES_FILE, defaultEmailTemplates()));
});

app.put('/api/email-templates', requireAuth, (req, res) => {
    const cur = readJSON(TEMPLATES_FILE, defaultEmailTemplates());
    const b = req.body || {};
    const merge = (key) => {
        const incoming = b[key] || {};
        const base = cur[key] || {};
        return {
            naam: String(incoming.naam != null ? incoming.naam : base.naam || '').slice(0, 200),
            subject: String(incoming.subject != null ? incoming.subject : base.subject || '').slice(0, 500),
            html: String(incoming.html != null ? incoming.html : base.html || '').slice(0, 50000)
        };
    };
    const templates = {
        booking_confirmation: merge('booking_confirmation'),
        booking_notification: merge('booking_notification')
    };
    writeJSON(TEMPLATES_FILE, templates);
    res.json({ ok: true, templates });
});

// --------------------------- Postvak (outbox) ---------------------------
// Lijst zonder volledige HTML (lichter); detail bevat de HTML
app.get('/api/emails', requireAuth, (req, res) => {
    const outbox = readJSON(OUTBOX_FILE, []);
    res.json(outbox.map(m => ({
        id: m.id, createdAt: m.createdAt, to: m.to,
        subject: m.subject, status: m.status, trigger: m.trigger
    })));
});

app.get('/api/emails/:id', requireAuth, (req, res) => {
    const outbox = readJSON(OUTBOX_FILE, []);
    const msg = outbox.find(m => m.id === req.params.id);
    if (!msg) return res.status(404).json({ error: 'Niet gevonden' });
    res.json(msg);
});

app.delete('/api/emails/:id', requireAuth, (req, res) => {
    let outbox = readJSON(OUTBOX_FILE, []);
    outbox = outbox.filter(m => m.id !== req.params.id);
    writeJSON(OUTBOX_FILE, outbox);
    res.json({ ok: true });
});

// Test-e-mail versturen naar opgegeven adres of de meldingsontvanger
app.post('/api/emails/test', requireAuth, async (req, res) => {
    const settings = readJSON(SETTINGS_FILE, defaultSettings());
    const to = String((req.body && req.body.to) || settings.meldingsEmail || settings.contactEmail || '').trim();
    if (!to) return res.status(400).json({ error: 'Geen ontvanger opgegeven en geen meldings-e-mail ingesteld' });
    const record = await sendMail({
        to,
        subject: 'Testbericht van ' + (settings.bedrijfsnaam || 'DeurMeester'),
        html: '<div style="font-family:Georgia,serif;padding:24px;color:#1a1714">' +
              '<h2 style="color:#b8693a">Test geslaagd</h2>' +
              '<p>Dit is een testbericht vanuit de beheeromgeving van ' +
              (settings.bedrijfsnaam || 'DeurMeester') + '.</p>' +
              '<p>Als je dit per e-mail ontvangt, is SMTP correct ingesteld.</p></div>',
        trigger: 'test'
    });
    res.json({ ok: true, record });
});

function loadMediaIndex() {
    const now = Date.now();
    if (mediaIndexCache && (now - mediaIndexCacheAt) < MEDIA_CACHE_TTL_MS) {
        return mediaIndexCache;
    }
    let indexHtml = '';
    try { indexHtml = fs.readFileSync(INDEX_HTML, 'utf8'); } catch (e) { /* */ }
    const pages = readJSON(PAGES_FILE, []);
    const content = readJSON(CONTENT_FILE, {});
    mediaIndexCache = mediaLibrary.indexMedia({
        root: ROOT,
        uploadDir: UPLOAD_DIR,
        contentFiles: [
            { content: indexHtml },
            { content: JSON.stringify(pages) },
            { content: content }
        ]
    });
    mediaIndexCacheAt = now;
    return mediaIndexCache;
}

function invalidateMediaCache() {
    mediaIndexCache = null;
    mediaIndexCacheAt = 0;
}

// --------------------------- Mediabibliotheek ---------------------------
app.get('/api/media', requireAuth, (req, res) => {
    try {
        res.json(loadMediaIndex());
    } catch (e) {
        console.error('Media index mislukt:', e.message);
        res.status(500).json({ error: 'Mediabibliotheek kon niet worden geladen' });
    }
});

app.post('/api/media/upload', requireAuth, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Geen bestand ontvangen' });
    const url = '/uploads/' + req.file.filename;
    const full = path.join(UPLOAD_DIR, req.file.filename);
    let dims = null;
    try { dims = mediaLibrary.readImageDimensions(full); } catch (e) { /* */ }
    invalidateMediaCache();
    res.json({
        ok: true,
        id: mediaLibrary.normalizeUrl(url).replace(/^\//, '').replace(/[^a-zA-Z0-9._-]+/g, '_'),
        filename: req.file.filename,
        url,
        source: 'upload',
        width: dims ? dims.width : null,
        height: dims ? dims.height : null
    });
});

app.post('/api/media', requireAuth, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Geen bestand ontvangen' });
    res.json({ ok: true, filename: req.file.filename, url: '/uploads/' + req.file.filename });
});

app.delete('/api/media/:id', requireAuth, (req, res) => {
    const id = String(req.params.id || '').trim();
    const items = loadMediaIndex();
    const item = items.find(m => m.id === id || m.filename === id);
    if (!item) return res.status(404).json({ error: 'Niet gevonden' });
    if (item.source === 'site' || item.source === 'referenced') {
        return res.status(403).json({ error: 'Site-afbeeldingen kunnen niet worden verwijderd' });
    }
    const base = path.basename(item.filename || '');
    if (!base || base.startsWith('.')) return res.status(400).json({ error: 'Ongeldige bestandsnaam' });
    const target = path.join(UPLOAD_DIR, base);
    const resolved = path.resolve(target);
    if (path.dirname(resolved) !== path.resolve(UPLOAD_DIR)) {
        return res.status(400).json({ error: 'Ongeldig pad' });
    }
    if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'Niet gevonden' });
    try {
        fs.unlinkSync(resolved);
        invalidateMediaCache();
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: 'Verwijderen mislukt' });
    }
});

// --------------------------- Offerteaanvragen: CSV-export & mail opnieuw ---------------------------
function exportAanvragenCsv(req, res) {
    const bookings = readJSON(BOOKINGS_FILE, []);
    const cols = ['id', 'createdAt', 'status', 'deurType', 'materiaal', 'breedte', 'hoogte', 'standaardMaat', 'afwerking', 'ralKleur', 'montage', 'name', 'org', 'email', 'phone', 'notes'];
    const headers = ['Referentie', 'Datum', 'Status', 'Deurtype', 'Materiaal', 'Breedte', 'Hoogte', 'Standaardmaat', 'Afwerking', 'RAL-kleur', 'Montage', 'Naam', 'Organisatie', 'E-mail', 'Telefoon', 'Opmerkingen'];
    const esc = (v) => {
        let s = Array.isArray(v) ? v.join('; ') : (v == null ? '' : String(v));
        if (/[",\n;]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
    };
    const lines = [headers.join(',')];
    bookings.forEach(b => lines.push(cols.map(c => esc(b[c])).join(',')));
    const csv = '\uFEFF' + lines.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="aanvragen-' + new Date().toISOString().slice(0, 10) + '.csv"');
    res.send(csv);
}
app.get('/api/bookings/export.csv', requireAuth, exportAanvragenCsv);
app.get('/api/aanvragen/export.csv', requireAuth, exportAanvragenCsv);

// Bevestigingsmail opnieuw sturen aan de klant
async function resendAanvraagMail(req, res) {
    const bookings = readJSON(BOOKINGS_FILE, []);
    const booking = bookings.find(b => b.id === req.params.id);
    if (!booking) return res.status(404).json({ error: 'Niet gevonden' });
    const settings = readJSON(SETTINGS_FILE, defaultSettings());
    const templates = readJSON(TEMPLATES_FILE, defaultEmailTemplates());
    const vars = aanvraagVars(booking, settings);
    const conf = templates.booking_confirmation || {};
    const record = await sendMail({
        to: booking.email,
        subject: renderTemplate(conf.subject, vars),
        html: renderTemplate(conf.html, vars),
        trigger: 'booking_confirmation (handmatig)'
    });
    res.json({ ok: true, record });
}
app.post('/api/bookings/:id/resend', requireAuth, resendAanvraagMail);
app.post('/api/aanvragen/:id/resend', requireAuth, resendAanvraagMail);

// --------------------------- Huisstijl (stijlgids) ---------------------------
app.get('/api/styleguide', requireAuth, (req, res) => {
    res.json(readJSON(STYLEGUIDE_FILE, defaultStyleguide()));
});

app.put('/api/styleguide', requireAuth, (req, res) => {
    const cur = readJSON(STYLEGUIDE_FILE, defaultStyleguide());
    const b = req.body || {};
    const f = b.fonts || {};
    const curF = cur.fonts || {};
    const sg = {
        tokens: Array.isArray(b.tokens)
            ? b.tokens.map(t => ({
                var: String(t.var || '').slice(0, 60),
                hex: String(t.hex || '').slice(0, 80),
                label: String(t.label || '').slice(0, 120)
            })).filter(t => t.var)
            : (cur.tokens || []),
        fonts: {
            heading: String(f.heading != null ? f.heading : curF.heading || '').slice(0, 120),
            body: String(f.body != null ? f.body : curF.body || '').slice(0, 120),
            accent: String(f.accent != null ? f.accent : curF.accent || '').slice(0, 120),
            googleFontsHref: String(f.googleFontsHref != null ? f.googleFontsHref : curF.googleFontsHref || '').slice(0, 1000)
        },
        voice: String(b.voice != null ? b.voice : cur.voice || '').slice(0, 8000),
        components: String(b.components != null ? b.components : cur.components || '').slice(0, 12000),
        baseCssUrl: String(b.baseCssUrl != null ? b.baseCssUrl : cur.baseCssUrl || '/assets/site-base.css').slice(0, 300),
        guidelines: String(b.guidelines != null ? b.guidelines : cur.guidelines || '').slice(0, 12000),
        updatedAt: new Date().toISOString()
    };
    writeJSON(STYLEGUIDE_FILE, sg);
    res.json({ ok: true, styleguide: sg });
});

// Kleur-tokens + fonts opnieuw uit public/index.html lezen en bijwerken
app.post('/api/styleguide/sync', requireAuth, (req, res) => {
    const cur = readJSON(STYLEGUIDE_FILE, defaultStyleguide());
    const brand = extractBrandFromIndex();
    const sg = Object.assign({}, cur, {
        tokens: brand.tokens.length ? brand.tokens : (cur.tokens || []),
        fonts: Object.assign({}, cur.fonts, {
            googleFontsHref: brand.googleFontsHref || (cur.fonts && cur.fonts.googleFontsHref) || ''
        }),
        updatedAt: new Date().toISOString()
    });
    writeJSON(STYLEGUIDE_FILE, sg);
    res.json({ ok: true, styleguide: sg, synced: brand.tokens.length });
});

// --------------------------- Pagina's (CRUD) ---------------------------

// Slug opschonen: kleine letters, a-z 0-9 en koppeltekens
function slugify(str) {
    return String(str || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // accenten weg
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

function uniqueSlug(base, pages, ignoreId) {
    let slug = slugify(base) || 'pagina';
    let n = 2;
    const taken = (s) => pages.some(p => p.slug === s && p.id !== ignoreId);
    let candidate = slug;
    while (taken(candidate)) { candidate = slug + '-' + n; n++; }
    return candidate;
}

// Builder-artefacten uit opgeslagen pagina-HTML strippen. De live builder voegt
// tijdens het bewerken hulp-attributen/-classes toe (data-lb-*, contenteditable,
// lb-*); die horen niet in de opgeslagen, publieke HTML. Dit is een serverside
// vangnet bovenop het schoonmaken dat de builder zelf al doet.
function stripBuilderArtifacts(html) {
    let s = String(html || '');
    // contenteditable verwijderen (met of zonder waarde)
    s = s.replace(/\s+contenteditable(?:="[^"]*")?/gi, '');
    // alle data-lb-* attributen verwijderen (met of zonder waarde)
    s = s.replace(/\s+data-lb-[a-z-]+(?:="[^"]*")?/gi, '');
    s = s.replace(/\s+data-il-menu-url(?:="[^"]*")?/gi, '');
    // data-cursor-* attributen (door browser-tooling geïnjecteerd) verwijderen
    s = s.replace(/\s+data-cursor-[a-z-]+(?:="[^"]*")?/gi, '');
    // lb-* classes en selectie/flash-classes uit class-attributen halen
    s = s.replace(/\sclass="([^"]*)"/gi, (m, cls) => {
        const kept = cls.split(/\s+/).filter(c => c && !/^lb-/.test(c));
        return kept.length ? ' class="' + kept.join(' ') + '"' : '';
    });
    return s;
}

// Menu-items: gepubliceerde pagina's met inMenu=true, in opslagvolgorde.
function menuItems() {
    const pages = readJSON(PAGES_FILE, []);
    return pages
        .filter(p => p.status === 'gepubliceerd' && p.inMenu)
        .map(p => ({
            label: (p.menuLabel && String(p.menuLabel).trim()) || p.title,
            url: '/p/' + p.slug
        }));
}

app.get('/api/pages', requireAuth, (req, res) => {
    res.json(readJSON(PAGES_FILE, []));
});

app.get('/api/pages/:id', requireAuth, (req, res) => {
    const pages = readJSON(PAGES_FILE, []);
    const page = pages.find(p => p.id === req.params.id);
    if (!page) return res.status(404).json({ error: 'Niet gevonden' });
    res.json(page);
});

app.post('/api/pages', requireAuth, (req, res) => {
    const b = req.body || {};
    const title = String(b.title || '').trim().slice(0, 200);
    if (!title) return res.status(400).json({ error: 'Titel is verplicht' });
    const pages = readJSON(PAGES_FILE, []);
    const status = (b.status === 'gepubliceerd') ? 'gepubliceerd' : 'concept';
    const source = (b.source === 'ai') ? 'ai' : 'handmatig';
    const now = new Date().toISOString();
    const page = {
        id: 'PG-' + Date.now().toString(36).toUpperCase() + '-' + Math.round(Math.random() * 1e4),
        slug: uniqueSlug(b.slug || title, pages, null),
        title: title,
        html: stripBuilderArtifacts(String(b.html || '').slice(0, 200000)),
        status: status,
        source: source,
        inMenu: !!b.inMenu,
        menuLabel: String(b.menuLabel || '').slice(0, 60),
        createdAt: now,
        updatedAt: now
    };
    pages.unshift(page);
    writeJSON(PAGES_FILE, pages);
    res.status(201).json({ ok: true, page });
});

app.put('/api/pages/:id', requireAuth, (req, res) => {
    const pages = readJSON(PAGES_FILE, []);
    const idx = pages.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Niet gevonden' });
    const cur = pages[idx];
    const b = req.body || {};
    if (b.title != null) cur.title = String(b.title).trim().slice(0, 200) || cur.title;
    if (b.slug != null) cur.slug = uniqueSlug(b.slug, pages, cur.id);
    if (b.html != null) cur.html = stripBuilderArtifacts(String(b.html).slice(0, 200000));
    if (b.status != null) cur.status = (b.status === 'gepubliceerd') ? 'gepubliceerd' : 'concept';
    if (b.source != null) cur.source = (b.source === 'ai') ? 'ai' : 'handmatig';
    if (b.inMenu != null) cur.inMenu = !!b.inMenu;
    if (b.menuLabel != null) cur.menuLabel = String(b.menuLabel).slice(0, 60);
    cur.updatedAt = new Date().toISOString();
    pages[idx] = cur;
    writeJSON(PAGES_FILE, pages);
    res.json({ ok: true, page: cur });
});

app.delete('/api/pages/:id', requireAuth, (req, res) => {
    let pages = readJSON(PAGES_FILE, []);
    const before = pages.length;
    pages = pages.filter(p => p.id !== req.params.id);
    if (pages.length === before) return res.status(404).json({ error: 'Niet gevonden' });
    writeJSON(PAGES_FILE, pages);
    res.json({ ok: true });
});

// --------------------------- AI-agent (Kimi) ---------------------------

// Een door de client meegestuurde lijst van gekozen blokken normaliseren naar
// betrouwbare metadata uit de catalogus. Accepteert een array van id-strings of
// objecten { id }. Onbekende id's worden genegeerd. Houdt de gekozen volgorde aan.
function normalizeChosenBlocks(input) {
    if (!Array.isArray(input)) return [];
    return input
        .map(item => (typeof item === 'string' ? item : (item && item.id)))
        .map(id => blocks.getBlock(id))
        .filter(Boolean)
        .map(b => ({ id: b.id, name: b.name, category: b.category, description: b.description }));
}

// Een door de client meegestuurde lijst van gekozen wireframes normaliseren naar
// betrouwbare id's uit de catalogus (volgorde behouden, onbekende id's weg).
// Accepteert een array van id-strings of objecten { id }.
function normalizeWireframeIds(input) {
    if (!Array.isArray(input)) return [];
    return input
        .map(item => (typeof item === 'string' ? item : (item && item.id)))
        .filter(id => !!wireframes.getWireframe(id));
}

// 1-2 voorbeeld-sectiesnippets uit de echte site, voor in de prompt
function exampleSnippets() {
    return [
        '<section class="section">\n' +
        '  <div class="container">\n' +
        '    <div class="section-head">\n' +
        '      <span class="eyebrow">Vakmanschap</span>\n' +
        '      <h2>Deuren die <em>passen</em></h2>\n' +
        '    </div>\n' +
        '    <blockquote class="quote">Elke deur wordt op maat gemaakt en met zorg gemonteerd, zodat hij naadloos in je interieur past.</blockquote>\n' +
        '  </div>\n' +
        '</section>',
        '<section class="section section-warm">\n' +
        '  <div class="container">\n' +
        '    <div class="card-grid">\n' +
        '      <article class="card">\n' +
        '        <h3>Taats<em>deuren</em></h3>\n' +
        '        <span class="script">stijlvol, ruimtelijk</span>\n' +
        '        <p>Moderne taatsdeuren in massief hout of fineer, afgestemd op je woning.</p>\n' +
        '        <a href="/#boeken" class="btn-link">Vraag een offerte aan</a>\n' +
        '      </article>\n' +
        '    </div>\n' +
        '  </div>\n' +
        '</section>'
    ];
}

app.post('/api/ai/test', requireAuth, async (req, res) => {
    const settings = readJSON(SETTINGS_FILE, defaultSettings());
    if (!aiagent.isConfigured(settings)) {
        return res.status(400).json({ ok: false, error: 'Geen API-sleutel ingesteld. Vul deze in bij Instellingen > AI-agent.' });
    }
    const result = await aiagent.testConnection(settings);
    if (!result.ok) return res.status(502).json(result);
    res.json(result);
});

// Nederlandse foutmelding voor de bouw-assistent (met code voor debugging).
function agentErrorResponse(e, res) {
    const code = e.code || 'ERROR';
    let message = e.message || 'De assistent kon de opdracht niet uitvoeren';
    if (code === 'BAD_JSON') {
        message = 'Het AI-antwoord was onleesbaar (geen geldige JSON). Probeer opnieuw of formuleer korter.';
    } else if (code === 'NO_KEY') {
        message = 'Geen API-sleutel ingesteld. Vul deze in bij Instellingen > AI-agent.';
    } else if (code === 'NETWORK') {
        message = 'Geen verbinding met de AI-dienst. Controleer je internet en API-instellingen.';
    } else if (code === 'API_ERROR') {
        message = 'De AI-dienst weigerde het verzoek: ' + (e.message || 'onbekende fout');
    } else if (code === 'TIMEOUT') {
        message = 'Het duurde te lang (server-timeout). Probeer opnieuw; op Netlify wordt een sneller model gebruikt.';
    } else if (code === 'TRUNCATED' || code === 'EMPTY') {
        message = e.message;
    }
    const status = (code === 'NO_KEY') ? 400 : 502;
    return res.status(status).json({ error: message, code, detail: e.message });
}

// Plan-object omzetten naar een create_page-actie.
function buildGenerationPromptFromPlan(plan) {
    if (!plan || typeof plan !== 'object') return '';
    const parts = [];
    const title = String(plan.title || plan.titel || '').trim();
    if (title) parts.push('Paginatitel: ' + title);
    if (plan.doel) parts.push('Doel: ' + plan.doel);
    if (plan.doelgroep) parts.push('Doelgroep: ' + plan.doelgroep);
    if (plan.toon) parts.push('Toon: ' + plan.toon);
    if (plan.cta) parts.push('Call-to-action: ' + plan.cta);

    const design = pageDesign.normalizeDesign(plan.design);
    parts.push('');
    parts.push('Designkeuzes (strikt toepassen):');
    pageDesign.designSummaryForDisplay(design).forEach(row => {
        parts.push('- ' + row.label + ': ' + row.value);
    });
    parts.push('');
    parts.push(pageDesign.getDesignPromptBlock(design));

    const secties = Array.isArray(plan.secties) ? plan.secties : (Array.isArray(plan.sections) ? plan.sections : []);
    if (secties.length) {
        parts.push('');
        parts.push('Secties in volgorde:');
        secties.forEach((s, i) => {
            if (s && typeof s === 'object') {
                parts.push('  ' + (i + 1) + '. ' + (s.headline || s.title || '') + (s.preview ? ' — ' + s.preview : ''));
            } else {
                parts.push('  ' + (i + 1) + '. ' + String(s));
            }
        });
    }
    const beelden = Array.isArray(plan.beelden) ? plan.beelden : (Array.isArray(plan.images) ? plan.images : []);
    if (beelden.length) {
        parts.push('');
        parts.push('Afbeeldingen (gebruik exact deze URL\'s in img-tags):');
        beelden.forEach((img, i) => {
            const label = (img && img.label) || 'Afbeelding';
            const url = (img && img.url) || '';
            parts.push('  ' + (i + 1) + '. ' + label + ': ' + url);
        });
    }
    parts.push('');
    parts.push('Bouw een complete body-HTML in de DeurMeester huisstijl. Pas ALLE design-keuzes toe zodat de pagina uniek oogt.');
    return parts.join('\n');
}

function normalizePlanForBuild(plan) {
    if (!plan || typeof plan !== 'object') return plan;
    const normalized = { ...plan };
    if (!normalized.images && Array.isArray(normalized.beelden)) normalized.images = normalized.beelden;
    if (!normalized.title && normalized.titel) normalized.title = normalized.titel;
    normalized.design = pageDesign.normalizeDesign(normalized.design);
    if (!normalized.generationPrompt || !String(normalized.generationPrompt).trim()) {
        normalized.generationPrompt = buildGenerationPromptFromPlan(normalized);
    } else if (!String(normalized.generationPrompt).includes('PAGINA-DESIGN')) {
        normalized.generationPrompt = String(normalized.generationPrompt).trim() + '\n\n' + pageDesign.getDesignPromptBlock(normalized.design);
    }
    return normalized;
}

function actionFromPlan(plan) {
    const p = normalizePlanForBuild(plan);
    if (!p || typeof p !== 'object') return null;
    const title = String(p.title || '').trim();
    const generationPrompt = String(p.generationPrompt || '').trim();
    if (!title || !generationPrompt) return null;
    return {
        type: 'create_page',
        title,
        slug: String(p.slug || '').trim(),
        generationPrompt,
        inMenu: !!p.inMenu,
        menuLabel: String(p.menuLabel || '').slice(0, 60),
        status: p.status === 'concept' ? 'concept' : 'gepubliceerd'
    };
}
async function enrichAgentActions(actions, settings, styleguide, examples, plan) {
    const list = Array.isArray(actions) ? actions : [];
    const enriched = [];
    const imageHints = plan ? agentImages.imageHintsForPrompt(agentImages.enrichPlanImages(plan)) : '';
    for (const action of list) {
        const a = action || {};
        const type = a.type;
        const needsGen = (type === 'create_page' || type === 'update_page' || type === 'append_wireframe_page')
            && a.generationPrompt && !String(a.html || '').trim();

        if (!needsGen) {
            enriched.push(a);
            continue;
        }

        let baseHtml = String(a.html || '').trim();
        let structure = null;
        if (type === 'append_wireframe_page' && Array.isArray(a.wireframeIds) && a.wireframeIds.length) {
            baseHtml = wireframes.assembleScaffoldHtml(a.wireframeIds.filter(id => wireframes.getWireframe(id)));
        }
        if (type === 'update_page') {
            const slug = String(a.slug || a.pageSlug || '').trim();
            const pages = readJSON(PAGES_FILE, []);
            const page = pages.find(p => p.slug === slug);
            if (page && page.html) baseHtml = page.html;
        }

        const prompt = [
            String(a.generationPrompt).trim(),
            a.title ? '\nPaginatitel: ' + a.title : '',
            a.slug ? '\nURL-slug: ' + a.slug : '',
            imageHints
        ].join('');

        const gen = await aiagent.generatePage({
            prompt,
            styleguide,
            settings,
            examples,
            baseHtml: baseHtml || undefined,
            structure: structure || undefined,
            design: plan && plan.design ? plan.design : undefined,
            preferFast: IS_SERVERLESS
        });
        enriched.push({ ...a, html: gen.html });
    }
    return enriched;
}

// Centrale site-agent: gesprek en plan (geen pagina-generatie; dat is /api/agent/build-page).
app.post('/api/agent/run', requireAuth, async (req, res) => {
    const settings = readJSON(SETTINGS_FILE, defaultSettings());
    if (!aiagent.isConfigured(settings)) {
        return res.status(400).json({
            error: 'Assistent is nog niet ingesteld. Vul de API-sleutel in bij Instellingen > AI-agent.',
            code: 'NO_KEY'
        });
    }
    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : (Array.isArray(body.history) ? body.history : []);
    const styleguide = readJSON(STYLEGUIDE_FILE, defaultStyleguide());
    const pages = readJSON(PAGES_FILE, []);
    const bookings = readJSON(BOOKINGS_FILE, [])
        .slice()
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    const wfCat = wireframes.getCatalog();
    const examples = exampleSnippets();
    const mediaItems = loadMediaIndex();
    const mediaSummary = mediaLibrary.summarizeForAgent(mediaItems, 50);
    try {
        const plan = await aiagent.runSiteAgent({
            messages,
            settings,
            styleguide,
            pages,
            bookings,
            elements: elements.getCatalog().elements,
            wireframes: wfCat.wireframes || [],
            examples,
            mediaSummary
        });
        res.json({
            ok: true,
            mode: plan.mode,
            reply: plan.reply,
            choices: plan.choices || [],
            choicesMultiple: !!plan.choicesMultiple,
            suggestions: plan.suggestions || [],
            plan: plan.plan,
            chatModel: plan.modelUsed,
            serverless: IS_SERVERLESS,
            degraded: !!plan.degraded
        });
    } catch (e) {
        console.error('Agent run fout:', e.message, e.cause ? String(e.cause).slice(0, 500) : '');
        return agentErrorResponse(e, res);
    }
});

// Pagina bouwen: HTML genereren + opslaan (aparte stap i.v.m. Netlify-timeout).
app.post('/api/agent/build-page', requireAuth, async (req, res) => {
    const settings = readJSON(SETTINGS_FILE, defaultSettings());
    if (!aiagent.isConfigured(settings)) {
        return res.status(400).json({
            error: 'Assistent is nog niet ingesteld. Vul de API-sleutel in bij Instellingen > AI-agent.',
            code: 'NO_KEY'
        });
    }
    const body = req.body || {};
    const styleguide = readJSON(STYLEGUIDE_FILE, defaultStyleguide());
    const examples = exampleSnippets();
    const pageBuilderAi = aiagent.resolvePageBuilderAi(settings, { preferFast: IS_SERVERLESS });

    let plan = body.plan && typeof body.plan === 'object' ? normalizePlanForBuild(body.plan) : null;
    let actions = Array.isArray(body.actions) ? body.actions : [];
    if (!actions.length && plan) {
        const act = actionFromPlan(plan);
        if (act && act.title && act.generationPrompt) actions = [act];
    }
    if (!actions.length) {
        return res.status(400).json({
            error: 'Geen bouwplan ontvangen. Praat eerst met de assistent tot je een voorbeeld ziet, en klik dan op "Maak de pagina".',
            code: 'NO_PLAN'
        });
    }

    if (plan) plan = agentImages.enrichPlanImages(plan);

    try {
        const enriched = await enrichAgentActions(actions, settings, styleguide, examples, plan);
        const results = await agentActions.executeActions(enriched, {
            readPages: () => readJSON(PAGES_FILE, []),
            writePages: (p) => writeJSON(PAGES_FILE, p)
        });
        const failed = results.find(r => r.result && !r.result.ok);
        if (failed) {
            return res.status(502).json({
                error: 'Pagina opslaan mislukt: ' + (failed.result.error || 'onbekende fout'),
                code: 'ACTION_FAILED',
                results,
                pageBuilderModel: pageBuilderAi.model
            });
        }
        res.json({
            ok: true,
            results,
            pageBuilderModel: pageBuilderAi.model,
            serverless: IS_SERVERLESS
        });
    } catch (e) {
        console.error('Build-page fout:', e.message);
        return agentErrorResponse(e, res);
    }
});

// Afbeelding-suggestie voor een onderwerp (curated Unsplash-URL).
app.post('/api/agent/generate-image', requireAuth, (req, res) => {
    const topic = String((req.body && req.body.topic) || '').trim();
    if (!topic) return res.status(400).json({ error: 'Geef een onderwerp op (topic).', code: 'NO_TOPIC' });
    const url = agentImages.pickImageUrl(topic);
    res.json({ ok: true, url, topic, source: 'unsplash' });
});

// ---------------------------------------------------------------------------
// Statische bestanden + publieke pagina-rendering
// ---------------------------------------------------------------------------
const PUBLIC_DIR = path.join(ROOT, 'public');
const ADMIN_DIR = path.join(ROOT, 'admin');

// Eenvoudige HTML-escape voor in attributen/titels
function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// De site-nav, identiek aan index.html (links wijzen naar de homepage-secties).
// De dynamische menu-items (gepubliceerde pagina's met inMenu) komen achter de
// vaste links en vóór de "Boek nu"-cta.
function siteNavHtml() {
    // Menu-links krijgen class il-menu-link + data-slug zodat de scanner ze een
    // stabiele sleutel (menu.<slug>) geeft die overal (homepage + losse pagina's)
    // matcht. De link zelf blijft /p/<slug>.
    const menuHtml = menuItems()
        .map(it => {
            const slug = String(it.url || '').split(/[?#]/)[0].split('/').filter(Boolean).pop() || '';
            return '<a class="il-menu-link" data-slug="' + escapeHtml(slug) + '" href="' + escapeHtml(it.url) + '">' + escapeHtml(it.label) + '</a>';
        })
        .join('');
    return '' +
    '<div class="topstrip">' +
        '<div class="topstrip-left">' +
            '<span><span class="topstrip-dot"></span>Showroom op afspraak</span>' +
            '<span>Veenendaal &middot; NL</span>' +
        '</div>' +
        '<div class="topstrip-right">' +
            '<a href="tel:+31600000000">+31 (0)6 XX XX XX XX</a>' +
            '<span>&middot;</span>' +
            '<a href="mailto:info@deurmeester.nl">info@deurmeester.nl</a>' +
        '</div>' +
    '</div>' +
    '<nav class="global" id="global-nav">' +
        '<a href="/" class="nav-logo"><img src="/images/logo.png" alt="DeurMeester logo"/> DeurMeester</a>' +
        '<div class="nav-links">' +
            '<a href="/#filosofie">Vakmanschap</a>' +
            '<a href="/#ruimtes">Collectie</a>' +
            '<a href="/#faciliteiten">Materialen</a>' +
            '<a href="/#verblijf">Montage</a>' +
            '<a href="/#locatie">Showroom</a>' +
            menuHtml +
        '</div>' +
        '<a href="/#boeken" class="nav-cta">Offerte</a>' +
        '<button class="mobile-toggle" id="mobile-toggle" aria-label="Menu" aria-expanded="false" aria-controls="mobile-nav">' +
            '<span></span><span></span><span></span>' +
        '</button>' +
    '</nav>' +
    '<div class="mobile-nav" id="mobile-nav" aria-hidden="true">' +
        '<div class="mobile-nav-panel">' +
            '<div class="mobile-nav-links">' +
                '<a href="/#filosofie">Vakmanschap</a>' +
                '<a href="/#ruimtes">Collectie</a>' +
                '<a href="/#faciliteiten">Materialen</a>' +
                '<a href="/#verblijf">Montage</a>' +
                '<a href="/#locatie">Showroom</a>' +
                '<a href="/#boeken" class="mobile-nav-cta">Offerte aanvragen</a>' +
            '</div>' +
        '</div>' +
    '</div>';
}

// De site-footer, identiek aan index.html
function siteFooterHtml() {
    return '' +
    '<footer>' +
        '<div class="footer-grid">' +
            '<div class="footer-brand">' +
                '<img src="/images/logo.png" alt="" class="footer-logo"/>' +
                '<h4>DeurMeester</h4>' +
                '<p>"De juiste deur maakt het verschil."</p>' +
                '<div class="footer-contact">Veenendaal, Utrecht<br/>' +
                    '<a href="tel:+31600000000">+31 (0)6 XX XX XX XX</a><br/>' +
                    '<a href="mailto:info@deurmeester.nl">info@deurmeester.nl</a>' +
                '</div>' +
            '</div>' +
            '<div class="footer-col"><strong>Collectie</strong><ul>' +
                '<li><a href="/#ruimtes">Taatsdeuren</a></li>' +
                '<li><a href="/#ruimtes">Schuifdeuren</a></li>' +
                '<li><a href="/#faciliteiten">Materialen</a></li>' +
                '<li><a href="/#verblijf">Montage</a></li>' +
            '</ul></div>' +
            '<div class="footer-col"><strong>Service</strong><ul>' +
                '<li><a href="/#locatie">Showroom</a></li>' +
                '<li><a href="/#verblijf">Thuis inmeten</a></li>' +
                '<li><a href="/#boeken">Offerte aanvragen</a></li>' +
                '<li><a href="/#faciliteiten">Garantie</a></li>' +
            '</ul></div>' +
            '<div class="footer-col"><strong>Informatie</strong><ul>' +
                '<li><a href="/#boeken">Offerte</a></li>' +
                '<li><a href="/#locatie">Routebeschrijving</a></li>' +
                '<li><a href="/#">Algemene voorwaarden</a></li>' +
                '<li><a href="/#">Privacy</a></li>' +
            '</ul></div>' +
        '</div>' +
        '<div class="footer-bottom">' +
            '<span>&copy; 2026 DeurMeester &middot; Veenendaal, NL</span>' +
            '<span>Vakmanschap in elke deuropening</span>' +
        '</div>' +
    '</footer>';
}

// Body-HTML in een net paginaskelet wikkelen (fonts + site-base.css + nav/footer)
function renderPageSkeleton(opts) {
    const o = opts || {};
    const sg = readJSON(STYLEGUIDE_FILE, defaultStyleguide());
    const fontsHref = (sg.fonts && sg.fonts.googleFontsHref) ||
        'https://fonts.googleapis.com/css2?family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@300;400;500;600;700&family=Caveat:wght@500;700&display=swap';
    const baseCss = (sg.baseCssUrl || '/assets/site-base.css');
    const title = escapeHtml(o.title || 'DeurMeester');

    // De gedeelde scanner + apply-logica draaien op ELKE pagina. Daarbovenop:
    //   - Normale weergave: site-chrome.js past de site-brede overrides uit
    //     content.json toe (nav/footer-tekst, menu-links, globaal logo/kleuren),
    //     zodat losse pagina's synchroon blijven met de homepage.
    //   - Bewerkmodus (?edit=1): de live builder scant de volledige pagina
    //     (topstrip/nav/main/footer) en doet zelf de apply + split-save. We laden
    //     dan GEEN site-chrome.js: dat zou de chrome al sleutelen waardoor de
    //     builder die elementen zou overslaan.
    const baseScripts =
        '<script src="/assets/site-config.js"></script>\n' +
        '<script src="/assets/site-nav.js"></script>\n' +
        '<script src="/assets/il-scan.js"></script>\n' +
        '<script src="/assets/il-apply.js"></script>\n' +
        '<link rel="stylesheet" href="/assets/booking-widget.css"/>\n' +
        '<script src="/assets/booking-widget.js"></script>\n' +
        '<script src="/assets/elements-init.js"></script>\n';
    let editHead = '';
    let editBody = '';
    if (o.edit && o.page) {
        editHead = '<link rel="stylesheet" href="/assets/builder.css"/>\n';
        editBody =
            '<script>window.IL_PAGE = ' + JSON.stringify({
                id: o.page.id, slug: o.page.slug, title: o.page.title
            }) + ';</script>\n' +
            baseScripts +
            '<script src="/assets/builder.js"></script>\n';
    } else {
        editBody = baseScripts + '<script src="/assets/site-chrome.js"></script>\n';
    }

    return '<!DOCTYPE html>\n' +
        '<html lang="nl">\n<head>\n' +
        '<meta charset="utf-8"/>\n' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>\n' +
        '<title>' + title + ' &middot; DeurMeester</title>\n' +
        '<link rel="preconnect" href="https://fonts.googleapis.com"/>\n' +
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>\n' +
        '<link href="' + escapeHtml(fontsHref) + '" rel="stylesheet"/>\n' +
        '<link rel="stylesheet" href="' + escapeHtml(baseCss) + '"/>\n' +
        '<link rel="stylesheet" href="/assets/blocks.css"/>\n' +
        editHead +
        '</head>\n<body>\n' +
        siteNavHtml() + '\n' +
        '<main>\n' + (o.body || '') + '\n</main>\n' +
        siteFooterHtml() + '\n' +
        editBody +
        '</body>\n</html>';
}

// Publieke route: gepubliceerde pagina tonen op /p/:slug.
// Ingelogde admins mogen met ?edit=1 ook concepten openen in de live builder.
app.get('/p/:slug', (req, res) => {
    const slug = slugify(req.params.slug);
    const pages = readJSON(PAGES_FILE, []);
    const isAdmin = !!(req.session && req.session.isAdmin);
    const editMode = req.query.edit === '1' && isAdmin;

    // In bewerkmodus mogen ook concepten worden geopend; anders alleen gepubliceerd.
    const page = editMode
        ? pages.find(p => p.slug === slug)
        : pages.find(p => p.slug === slug && p.status === 'gepubliceerd');

    res.set('Content-Type', 'text/html; charset=utf-8');
    if (!page) {
        const body = '<section class="page-status">' +
            '<span class="eyebrow">Pagina niet gevonden</span>' +
            '<h1>404</h1>' +
            '<p>Deze pagina bestaat niet of is nog niet gepubliceerd. Kijk gerust even op de homepage.</p>' +
            '<a href="/" class="cta">Naar de homepage</a>' +
            '</section>';
        return res.status(404).send(renderPageSkeleton({ title: 'Niet gevonden', body }));
    }
    res.send(renderPageSkeleton({
        title: page.title,
        body: page.html,
        edit: editMode,
        page: editMode ? { id: page.id, slug: page.slug, title: page.title } : null
    }));
});

// Admin-backend
app.use('/admin', express.static(ADMIN_DIR));
app.get('/admin', (req, res) => res.sendFile(path.join(ADMIN_DIR, 'index.html')));

// Statische bestanden van de site
if (IS_SERVERLESS) {
    app.use('/uploads', express.static(UPLOAD_DIR));
}
app.use(express.static(PUBLIC_DIR));

// Homepage (de site)
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

module.exports = app;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log('DeurMeester draait op http://localhost:' + PORT);
        console.log('  Website:  http://localhost:' + PORT + '/');
        console.log('  Admin:    http://localhost:' + PORT + '/admin  (wachtwoord: ' + ADMIN_PASSWORD + ')');
    });
}
