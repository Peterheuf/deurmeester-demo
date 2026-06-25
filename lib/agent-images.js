/**
 * Afbeeldingen voor de bouw-assistent: curated Unsplash-URL's per onderwerp.
 * Op Netlify geen lokale image-gen; externe URL's worden in de pagina-HTML gezet.
 */
'use strict';

const TOPIC_IMAGES = {
    deur: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80',
    hout: 'https://images.unsplash.com/photo-1615874959471-d37b4a8b2c1e?w=1200&q=80',
    houten_deur: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80',
    onderhoud: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200&q=80',
    montage: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&q=80',
    showroom: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=1200&q=80',
    interieur: 'https://images.unsplash.com/photo-1618221197210-5fe3b4e3e3f3?w=1200&q=80',
    materiaal: 'https://images.unsplash.com/photo-1615529328331-f8917597711f?w=1200&q=80',
    schuifdeur: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&q=80',
    taatsdeur: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200&q=80',
    glas: 'https://images.unsplash.com/photo-1600607687644-c7171b42498f?w=1200&q=80',
    vakmanschap: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1200&q=80',
    default: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80'
};

function normalizeTopic(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
}

function pickImageUrl(topic) {
    const t = normalizeTopic(topic);
    if (TOPIC_IMAGES[t]) return TOPIC_IMAGES[t];
    const keys = Object.keys(TOPIC_IMAGES).filter(k => k !== 'default');
    for (const key of keys) {
        if (t.includes(key) || key.includes(t)) return TOPIC_IMAGES[key];
    }
    if (/hout|eiken|beuken|fineer/.test(t)) return TOPIC_IMAGES.hout;
    if (/deur|kozijn|scharnier/.test(t)) return TOPIC_IMAGES.deur;
    if (/onderhoud|schoon|lak|olie|was/.test(t)) return TOPIC_IMAGES.onderhoud;
    if (/montage|plaats|install/.test(t)) return TOPIC_IMAGES.montage;
    return TOPIC_IMAGES.default;
}

function enrichPlanImages(plan) {
    if (!plan || typeof plan !== 'object') return plan;
    const copy = { ...plan };
    if (!copy.images && Array.isArray(copy.beelden)) copy.images = copy.beelden;
    const images = Array.isArray(copy.images) ? copy.images : [];
    copy.images = images.map(img => {
        const item = (img && typeof img === 'object') ? { ...img } : { label: String(img || '') };
        if (!item.url || !String(item.url).trim()) {
            item.url = pickImageUrl(item.topic || item.label || copy.title || '');
        }
        return item;
    });
    if (!copy.images.length && (copy.title || copy.titel)) {
        const t = copy.title || copy.titel;
        copy.images = [{ label: 'Hero-afbeelding', topic: t, url: pickImageUrl(t) }];
    }
    if (!copy.beelden) copy.beelden = copy.images;
    return copy;
}

function imageHintsForPrompt(plan) {
    const images = (plan && Array.isArray(plan.images)) ? plan.images : [];
    if (!images.length) return '';
    return '\nAfbeeldingen (gebruik deze URL\'s in <img src="..."> met beschrijvende alt-tekst):\n' +
        images.map((img, i) => '  ' + (i + 1) + '. ' + (img.label || 'Afbeelding') + ': ' + img.url).join('\n');
}

module.exports = { pickImageUrl, enrichPlanImages, imageHintsForPrompt, TOPIC_IMAGES };
