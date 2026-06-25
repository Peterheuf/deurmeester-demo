/**
 * DeurMeester - mailer
 *
 * Eén centrale functie sendMail() die e-mails verstuurt via nodemailer wanneer
 * er SMTP is geconfigureerd in data/settings.json. Is er geen SMTP ingesteld,
 * dan faalt er niets: het bericht wordt alleen opgeslagen in het postvak
 * (data/outbox.json) met een duidelijke status. Elk (gepoogd) bericht wordt
 * sowieso in het postvak gelogd zodat de eigenaar altijd kan terugkijken.
 */

const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const IS_SERVERLESS = !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.NETLIFY;
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = IS_SERVERLESS
    ? path.join('/tmp', 'deurmeester-data')
    : path.join(ROOT, 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const OUTBOX_FILE = path.join(DATA_DIR, 'outbox.json');

const NO_SMTP_STATUS = 'niet-verzonden (geen SMTP geconfigureerd)';

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

// Bericht aan het postvak toevoegen (nieuwste eerst)
function logToOutbox(entry) {
    const outbox = readJSON(OUTBOX_FILE, []);
    const record = Object.assign({
        id: 'ML-' + Date.now().toString(36).toUpperCase() + '-' + Math.round(Math.random() * 1e4),
        createdAt: new Date().toISOString()
    }, entry);
    outbox.unshift(record);
    writeJSON(OUTBOX_FILE, outbox);
    return record;
}

// Is SMTP voldoende ingevuld om echt te kunnen versturen?
function smtpConfigured(smtp) {
    return !!(smtp && String(smtp.host || '').trim() && String(smtp.user || '').trim());
}

/**
 * Verstuur (of log) een e-mail.
 * @param {Object} opts {to, subject, html, text, trigger}
 * @returns {Promise<Object>} het opgeslagen postvak-record
 */
async function sendMail(opts) {
    const o = opts || {};
    const to = String(o.to || '').trim();
    const subject = String(o.subject || '');
    const html = o.html || '';
    const text = o.text || htmlToText(html);
    const trigger = o.trigger || 'handmatig';

    const settings = readJSON(SETTINGS_FILE, {});
    const smtp = settings.smtp || {};

    // Geen ontvanger → niets te doen, wel loggen als fout
    if (!to) {
        return logToOutbox({ to: '', subject, html, status: 'mislukt (geen ontvanger)', trigger });
    }

    // Geen SMTP geconfigureerd → opslaan, niet versturen, niet falen
    if (!smtpConfigured(smtp)) {
        return logToOutbox({ to, subject, html, status: NO_SMTP_STATUS, trigger });
    }

    const fromAdres = String(smtp.fromAdres || smtp.user || '').trim();
    const fromNaam = String(smtp.fromNaam || settings.bedrijfsnaam || 'DeurMeester').trim();
    const from = fromNaam ? '"' + fromNaam + '" <' + fromAdres + '>' : fromAdres;

    try {
        const transporter = nodemailer.createTransport({
            host: String(smtp.host).trim(),
            port: Number(smtp.port) || 587,
            secure: !!smtp.secure,
            auth: { user: String(smtp.user).trim(), pass: String(smtp.pass || '') }
        });
        await transporter.sendMail({ from, to, subject, html, text });
        return logToOutbox({ to, subject, html, status: 'verzonden', trigger });
    } catch (err) {
        console.error('E-mail versturen mislukt:', err.message);
        return logToOutbox({ to, subject, html, status: 'mislukt: ' + err.message, trigger });
    }
}

// Heel eenvoudige HTML→tekst fallback voor het text-deel van de mail
function htmlToText(html) {
    return String(html || '')
        .replace(/<\s*br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

module.exports = { sendMail, smtpConfigured, NO_SMTP_STATUS };
