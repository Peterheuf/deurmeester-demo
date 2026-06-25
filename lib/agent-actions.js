/**
 * AI-agent acties: voert concrete site-wijzigingen uit (pagina's, elementen, wireframes).
 * Gebruikt door POST /api/agent/run.
 */
'use strict';

const elements = require('./elements');
const wireframes = require('./wireframes');

function slugify(str) {
    return String(str || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
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

function stripBuilderArtifacts(html) {
    let s = String(html || '');
    s = s.replace(/\s+contenteditable(?:="[^"]*")?/gi, '');
    s = s.replace(/\s+data-lb-[a-z-]+(?:="[^"]*")?/gi, '');
    s = s.replace(/\s+data-il-menu-url(?:="[^"]*")?/gi, '');
    s = s.replace(/\sclass="([^"]*)"/gi, (m, cls) => {
        const kept = cls.split(/\s+/).filter(c => c && !/^lb-/.test(c));
        return kept.length ? ' class="' + kept.join(' ') + '"' : '';
    });
    return s;
}

async function executeAction(action, ctx) {
    const a = action || {};
    const type = a.type;
    const pages = ctx.readPages();
    const now = new Date().toISOString();

    if (type === 'list_pages') {
        return { ok: true, pages: pages.map(p => ({ id: p.id, title: p.title, slug: p.slug, status: p.status, url: '/p/' + p.slug })) };
    }

    if (type === 'list_elements') {
        return { ok: true, elements: elements.getCatalog().elements };
    }

    if (type === 'create_page' || type === 'append_wireframe_page') {
        const title = String(a.title || '').trim().slice(0, 200);
        if (!title) return { ok: false, error: 'Titel is verplicht' };
        let html = String(a.html || '');
        if (type === 'append_wireframe_page' && Array.isArray(a.wireframeIds) && a.wireframeIds.length) {
            html = wireframes.assembleScaffoldHtml(a.wireframeIds.filter(id => wireframes.getWireframe(id)));
        }
        if (!html.trim()) return { ok: false, error: 'Geen HTML-inhoud om op te slaan' };
        const page = {
            id: 'PG-' + Date.now().toString(36).toUpperCase() + '-' + Math.round(Math.random() * 1e4),
            slug: uniqueSlug(a.slug || title, pages, null),
            title,
            html: stripBuilderArtifacts(html.slice(0, 200000)),
            status: a.status === 'gepubliceerd' ? 'gepubliceerd' : 'concept',
            source: 'ai',
            inMenu: !!a.inMenu,
            menuLabel: String(a.menuLabel || '').slice(0, 60),
            createdAt: now,
            updatedAt: now
        };
        pages.unshift(page);
        ctx.writePages(pages);
        return { ok: true, page, url: '/p/' + page.slug, editUrl: '/p/' + page.slug + '?edit=1' };
    }

    if (type === 'update_page') {
        const slug = slugify(a.slug || a.pageSlug || '');
        if (!slug) return { ok: false, error: 'Slug is verplicht' };
        const idx = pages.findIndex(p => p.slug === slug);
        if (idx === -1) return { ok: false, error: 'Pagina niet gevonden: ' + slug };
        const html = String(a.html || '').trim();
        if (!html) return { ok: false, error: 'Geen HTML-inhoud om bij te werken' };
        if (a.title) pages[idx].title = String(a.title).trim().slice(0, 200);
        pages[idx].html = stripBuilderArtifacts(html.slice(0, 200000));
        pages[idx].updatedAt = now;
        if (a.status === 'gepubliceerd' || a.status === 'concept') pages[idx].status = a.status;
        ctx.writePages(pages);
        return { ok: true, page: pages[idx], url: '/p/' + pages[idx].slug, editUrl: '/p/' + pages[idx].slug + '?edit=1' };
    }

    if (type === 'place_element') {
        const el = elements.getElement(String(a.elementId || ''));
        if (!el) return { ok: false, error: 'Onbekend element: ' + a.elementId };
        const slug = slugify(a.pageSlug || '');
        const idx = pages.findIndex(p => p.slug === slug);
        if (idx === -1) return { ok: false, error: 'Pagina niet gevonden: ' + slug };
        pages[idx].html = stripBuilderArtifacts((pages[idx].html || '') + '\n' + el.html);
        pages[idx].updatedAt = now;
        ctx.writePages(pages);
        return { ok: true, page: pages[idx], url: '/p/' + pages[idx].slug, editUrl: '/p/' + pages[idx].slug + '?edit=1' };
    }

    return { ok: false, error: 'Onbekende actie: ' + type };
}

async function executeActions(actions, ctx) {
    const results = [];
    for (const action of (actions || [])) {
        results.push({ action, result: await executeAction(action, ctx) });
    }
    return results;
}

module.exports = { executeAction, executeActions, stripBuilderArtifacts };
