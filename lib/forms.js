/**
 * Formulierbuilder — data-model, validatie en HTML-rendering.
 */
'use strict';

const FIELD_TYPES = [
    'text', 'email', 'tel', 'textarea', 'select', 'radio', 'checkbox',
    'number', 'date', 'heading', 'paragraph'
];

const INPUT_TYPES = ['text', 'email', 'tel', 'textarea', 'select', 'radio', 'checkbox', 'number', 'date'];

const PALETTE = [
    { type: 'text', label: 'Tekstveld', icon: 'Aa' },
    { type: 'email', label: 'E-mail', icon: '@' },
    { type: 'tel', label: 'Telefoon', icon: '☎' },
    { type: 'textarea', label: 'Tekstvak', icon: '¶' },
    { type: 'select', label: 'Dropdown', icon: '▾' },
    { type: 'radio', label: 'Keuzerondjes', icon: '◎' },
    { type: 'checkbox', label: 'Checkbox', icon: '☑' },
    { type: 'number', label: 'Nummer', icon: '#' },
    { type: 'date', label: 'Datum', icon: '📅' },
    { type: 'heading', label: 'Koptekst', icon: 'H' },
    { type: 'paragraph', label: 'Infotekst', icon: 'i' }
];

function slugify(str) {
    return String(str || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

function uniqueFormSlug(base, forms, ignoreId) {
    let slug = slugify(base) || 'formulier';
    let n = 2;
    const taken = (s) => forms.some(f => f.slug === s && f.id !== ignoreId);
    let candidate = slug;
    while (taken(candidate)) { candidate = slug + '-' + n; n++; }
    return candidate;
}

function newFieldId() {
    return 'f' + Date.now().toString(36) + Math.round(Math.random() * 1e4);
}

function newFormId() {
    return 'form-' + Date.now().toString(36) + Math.round(Math.random() * 1e4);
}

function defaultField(type) {
    const base = { id: newFieldId(), type: type, label: '', required: false };
    switch (type) {
        case 'text': return Object.assign(base, { label: 'Tekstveld', placeholder: '' });
        case 'email': return Object.assign(base, { label: 'E-mail', placeholder: 'naam@voorbeeld.nl' });
        case 'tel': return Object.assign(base, { label: 'Telefoon', placeholder: '+31 6 ...' });
        case 'textarea': return Object.assign(base, { label: 'Bericht', placeholder: '' });
        case 'select': return Object.assign(base, { label: 'Keuze', options: ['Optie 1', 'Optie 2'] });
        case 'radio': return Object.assign(base, { label: 'Keuze', options: ['Optie A', 'Optie B'] });
        case 'checkbox': return Object.assign(base, { label: 'Ik ga akkoord', required: true });
        case 'number': return Object.assign(base, { label: 'Aantal', placeholder: '' });
        case 'date': return Object.assign(base, { label: 'Datum' });
        case 'heading': return Object.assign(base, { label: 'Sectietitel' });
        case 'paragraph': return Object.assign(base, { label: 'Voeg hier een toelichting toe.' });
        default: return base;
    }
}

const FORM_TEMPLATES = {
    contact: {
        name: 'Contactformulier',
        slug: 'contact',
        submitLabel: 'Versturen',
        successMessage: 'Bedankt! We nemen zo snel mogelijk contact met je op.',
        notifyEmail: 'info@deurmeester.nl',
        fields: [
            { id: 'f1', type: 'heading', label: 'Neem contact op' },
            { id: 'f2', type: 'text', label: 'Naam', required: true, placeholder: 'Je volledige naam' },
            { id: 'f3', type: 'email', label: 'E-mail', required: true, placeholder: 'naam@voorbeeld.nl' },
            { id: 'f4', type: 'tel', label: 'Telefoon', required: false, placeholder: '+31 6 ...' },
            { id: 'f5', type: 'select', label: 'Onderwerp', options: ['Offerte', 'Vraag', 'Anders'], required: true },
            { id: 'f6', type: 'textarea', label: 'Bericht', required: true, placeholder: 'Waar kunnen we je mee helpen?' },
            { id: 'f7', type: 'checkbox', label: 'Ik ga akkoord met de privacyverklaring', required: true }
        ]
    },
    offerte: {
        name: 'Offerte aanvraag',
        slug: 'offerte',
        submitLabel: 'Offerte aanvragen',
        successMessage: 'Bedankt! We sturen binnen 48 uur een vrijblijvende offerte.',
        notifyEmail: 'info@deurmeester.nl',
        fields: [
            { id: 'f1', type: 'heading', label: 'Vraag een offerte aan' },
            { id: 'f2', type: 'paragraph', label: 'Vertel kort wat je zoekt. We nemen contact op voor de details.' },
            { id: 'f3', type: 'text', label: 'Naam', required: true },
            { id: 'f4', type: 'email', label: 'E-mail', required: true },
            { id: 'f5', type: 'tel', label: 'Telefoon', required: true },
            { id: 'f6', type: 'select', label: 'Type deur', options: ['Taatsdeur', 'Schuifdeur', 'Draaideur', 'Weet ik nog niet'], required: true },
            { id: 'f7', type: 'number', label: 'Aantal deuren', required: false, placeholder: '1' },
            { id: 'f8', type: 'textarea', label: 'Wensen of opmerkingen', required: false }
        ]
    },
    showroom: {
        name: 'Showroom afspraak',
        slug: 'showroom',
        submitLabel: 'Afspraak aanvragen',
        successMessage: 'Bedankt! We bevestigen je showroombezoek per e-mail.',
        notifyEmail: 'info@deurmeester.nl',
        fields: [
            { id: 'f1', type: 'heading', label: 'Plan een showroombezoek' },
            { id: 'f2', type: 'text', label: 'Naam', required: true },
            { id: 'f3', type: 'email', label: 'E-mail', required: true },
            { id: 'f4', type: 'tel', label: 'Telefoon', required: true },
            { id: 'f5', type: 'date', label: 'Gewenste datum', required: true },
            { id: 'f6', type: 'select', label: 'Voorkeurstijd', options: ['Ochtend (9–12u)', 'Middag (12–17u)', 'Geen voorkeur'], required: true },
            { id: 'f7', type: 'radio', label: 'Aantal personen', options: ['Alleen', 'Met partner', 'Met adviseur'], required: false },
            { id: 'f8', type: 'textarea', label: 'Opmerkingen', required: false }
        ]
    }
};

function defaultForms() {
    const now = new Date().toISOString();
    return ['contact', 'offerte', 'showroom'].map(key => {
        const t = FORM_TEMPLATES[key];
        return {
            id: newFormId(),
            name: t.name,
            slug: t.slug,
            status: 'gepubliceerd',
            fields: t.fields.map(f => Object.assign({}, f)),
            submitLabel: t.submitLabel,
            successMessage: t.successMessage,
            notifyEmail: t.notifyEmail,
            createdAt: now,
            updatedAt: now,
            submissions: []
        };
    });
}

function normalizeField(raw) {
    const type = FIELD_TYPES.includes(raw.type) ? raw.type : 'text';
    const f = {
        id: String(raw.id || newFieldId()).slice(0, 40),
        type: type,
        label: String(raw.label || '').slice(0, 500),
        required: !!raw.required
    };
    if (raw.placeholder != null) f.placeholder = String(raw.placeholder).slice(0, 300);
    if (type === 'select' || type === 'radio') {
        f.options = Array.isArray(raw.options)
            ? raw.options.map(o => String(o).slice(0, 200)).filter(Boolean).slice(0, 30)
            : ['Optie 1', 'Optie 2'];
    }
    return f;
}

function normalizeForm(body, forms, existing) {
    const b = body || {};
    const name = String(b.name || (existing && existing.name) || '').trim().slice(0, 200);
    if (!name) return { error: 'Naam is verplicht' };
    const status = (b.status === 'gepubliceerd') ? 'gepubliceerd' : 'concept';
    const fields = Array.isArray(b.fields)
        ? b.fields.map(normalizeField).slice(0, 50)
        : (existing ? existing.fields : []);
    return {
        name,
        slug: uniqueFormSlug(b.slug || name, forms, existing ? existing.id : null),
        status,
        fields,
        submitLabel: String(b.submitLabel != null ? b.submitLabel : (existing && existing.submitLabel) || 'Versturen').slice(0, 80),
        successMessage: String(b.successMessage != null ? b.successMessage : (existing && existing.successMessage) || 'Bedankt!').slice(0, 500),
        notifyEmail: String(b.notifyEmail != null ? b.notifyEmail : (existing && existing.notifyEmail) || '').slice(0, 200)
    };
}

function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function validateSubmission(form, data) {
    const errors = {};
    const values = {};
    const fields = form.fields || [];

    fields.forEach(field => {
        if (!INPUT_TYPES.includes(field.type)) return;
        const key = field.id;
        let val = data[key];
        if (field.type === 'checkbox') {
            val = val === true || val === 'true' || val === 'on' || val === '1';
            if (field.required && !val) errors[key] = 'Dit veld is verplicht';
            values[key] = val ? 'Ja' : 'Nee';
            return;
        }
        val = val == null ? '' : String(val).trim();
        if (field.required && !val) {
            errors[key] = 'Dit veld is verplicht';
            values[key] = '';
            return;
        }
        if (field.type === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
            errors[key] = 'Voer een geldig e-mailadres in';
        }
        if ((field.type === 'select' || field.type === 'radio') && val) {
            const opts = field.options || [];
            if (opts.length && opts.indexOf(val) === -1) errors[key] = 'Ongeldige keuze';
        }
        values[key] = val.slice(0, 4000);
    });

    return { errors, values, ok: Object.keys(errors).length === 0 };
}

function expandFormShortcodes(html, forms) {
    return String(html || '').replace(/\{\{form:([a-z0-9-]+)\}\}/gi, (m, slug) => {
        const form = forms.find(f => f.slug === slug && f.status === 'gepubliceerd');
        if (!form) return '<!-- formulier niet gevonden: ' + escapeHtml(slug) + ' -->';
        return renderFormEmbed(form);
    });
}

function renderFormEmbed(form) {
    return '' +
        '<section class="section section-warm il-element" data-il-element="form" data-form-slug="' + escapeHtml(form.slug) + '">' +
        '<div class="container">' +
        '<div class="dm-form-wrap" data-dm-form="' + escapeHtml(form.slug) + '"></div>' +
        '</div></section>';
}

function renderFormPageBody(form) {
    return '' +
        '<section class="page-hero">' +
        '<div class="container">' +
        '<span class="eyebrow">Formulier</span>' +
        '<h1>' + escapeHtml(form.name) + '</h1>' +
        '</div></section>' +
        '<section class="section section-warm">' +
        '<div class="container">' +
        '<div class="dm-form-page">' +
        '<div class="dm-form-wrap" data-dm-form="' + escapeHtml(form.slug) + '"></div>' +
        '</div></div></section>';
}

function publicFormMeta(form) {
    return {
        id: form.id,
        name: form.name,
        slug: form.slug,
        fields: form.fields,
        submitLabel: form.submitLabel,
        successMessage: form.successMessage
    };
}

module.exports = {
    FIELD_TYPES,
    INPUT_TYPES,
    PALETTE,
    FORM_TEMPLATES,
    slugify,
    uniqueFormSlug,
    newFieldId,
    newFormId,
    defaultField,
    defaultForms,
    normalizeField,
    normalizeForm,
    validateSubmission,
    expandFormShortcodes,
    renderFormEmbed,
    renderFormPageBody,
    publicFormMeta,
    escapeHtml
};
