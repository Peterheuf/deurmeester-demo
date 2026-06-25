/**
 * DeurMeester - beheeromgeving (SPA)
 *
 * Login + dashboard met vaste zijbalk. Secties worden client-side gewisseld via
 * hash-routing (#dashboard, #aanvragen, #website, #media, #emails, #instellingen).
 */
(function () {
    'use strict';

    const loginView = document.getElementById('loginView');
    const appView = document.getElementById('appView');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const pwInput = document.getElementById('pw');

    let allAanvragen = [];
    let activeFilter = 'alle';
    let aanvraagQuery = '';
    let templates = null;
    let currentTpl = 'booking_confirmation';

    const ROUTES = ['dashboard', 'aanvragen', 'paginas', 'agent', 'website', 'media', 'emails', 'huisstijl', 'instellingen'];
    const ROUTE_ALIASES = { boekingen: 'aanvragen', bouwer: 'agent' };

    let pages = [];
    let styleguide = null;
    let aiConfigured = false;
    let editingPageId = null;

    // Testwaarden voor sjabloon-voorbeeld
    const SAMPLE_VARS = {
        name: 'Anna de Vries', email: 'anna@voorbeeld.nl', phone: '+31 6 12345678',
        deurType: 'Taatsdeur', materiaal: 'Massief hout', afmetingen: '830 × 2115 mm',
        afwerking: 'Eiken', montage: 'Inclusief montage',
        notes: 'Graag offerte voor 4 deuren.',
        id: 'DM-VOORBEELD', siteName: 'DeurMeester'
    };

    const STATUS_LABELS = {
        nieuw: 'Nieuw',
        in_behandeling: 'In behandeling',
        behandeld: 'Afgehandeld',
        geannuleerd: 'Geannuleerd'
    };

    function statusLabel(status) {
        return STATUS_LABELS[status] || status || '';
    }

    // ------------------------------------------------------------------ Helpers
    function showToast(msg, type) {
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.className = 'toast ' + (type || 'success') + ' show';
        clearTimeout(t._t);
        t._t = setTimeout(() => { t.className = 'toast ' + (type || 'success'); }, 2600);
    }

    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str == null ? '' : String(str);
        return d.innerHTML;
    }

    function formatDate(iso) {
        try {
            const d = new Date(iso);
            return d.toLocaleString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch (e) { return iso || ''; }
    }

    function renderTemplate(str, vars) {
        return String(str || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (m, k) =>
            Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : '');
    }

    async function api(url, opts, timeoutMs) {
        const o = opts || {};
        const ms = typeof timeoutMs === 'number' ? timeoutMs : 0;
        if (!ms) {
            const r = await fetch(url, o);
            if (r.status === 401) { showLogin(); throw new Error('unauth'); }
            return r;
        }
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), ms);
        try {
            const r = await fetch(url, { ...o, signal: ctrl.signal });
            if (r.status === 401) { showLogin(); throw new Error('unauth'); }
            return r;
        } catch (e) {
            if (e && e.name === 'AbortError') {
                const err = new Error('timeout');
                err.code = 'TIMEOUT';
                throw err;
            }
            throw e;
        } finally {
            clearTimeout(timer);
        }
    }

    async function apiWithRetry(url, opts, timeoutMs, retries) {
        const max = typeof retries === 'number' ? retries : 1;
        let lastErr;
        for (let attempt = 0; attempt <= max; attempt++) {
            try {
                return await api(url, opts, timeoutMs);
            } catch (e) {
                lastErr = e;
                if (attempt >= max) break;
            }
        }
        throw lastErr;
    }

    // ------------------------------------------------------------------ Auth
    async function checkAuth() {
        try {
            const r = await fetch('/api/me');
            const me = await r.json();
            if (me && me.isAdmin) showApp();
            else showLogin();
        } catch (e) { showLogin(); }
    }

    function showLogin() {
        loginView.hidden = false;
        appView.hidden = true;
        setTimeout(() => pwInput && pwInput.focus(), 50);
    }

    function showApp() {
        loginView.hidden = true;
        appView.hidden = false;
        loadAanvragen();
        if (!location.hash || ROUTES.indexOf(location.hash.slice(1)) === -1) location.hash = '#agent';
        else route();
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.hidden = true;
        try {
            const r = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pwInput.value })
            });
            if (r.ok) { pwInput.value = ''; showApp(); }
            else { loginError.textContent = 'Onjuist wachtwoord. Probeer het opnieuw.'; loginError.hidden = false; }
        } catch (err) {
            loginError.textContent = 'Kan geen verbinding maken met de server.';
            loginError.hidden = false;
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' });
        showLogin();
    });

    // ------------------------------------------------------------------ Routing
    function route() {
        let r = location.hash.slice(1);
        if (ROUTE_ALIASES[r]) {
            location.replace('#' + ROUTE_ALIASES[r]);
            return;
        }
        if (ROUTES.indexOf(r) === -1) r = 'dashboard';
        document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== 'view-' + r; });
        document.querySelectorAll('.sidenav-item').forEach(a => a.classList.toggle('active', a.dataset.route === r));
        document.getElementById('sidebar').classList.remove('open');

        if (r === 'dashboard') renderDashboard();
        if (r === 'aanvragen') renderAanvragen();
        if (r === 'paginas') loadPages();
        if (r === 'agent') loadAgent();
        if (r === 'media') loadMedia();
        if (r === 'emails') { loadOutbox(); loadTemplates(); }
        if (r === 'huisstijl') loadStyleguide();
        if (r === 'instellingen') loadSettings();
    }
    window.addEventListener('hashchange', route);

    document.getElementById('menuToggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });

    // ------------------------------------------------------------------ Offerteaanvragen
    async function loadAanvragen() {
        try {
            const r = await api('/api/aanvragen');
            allAanvragen = await r.json();
            const navCount = document.getElementById('navAanvraagCount');
            if (navCount) navCount.textContent = allAanvragen.length;
            renderDashboard();
            renderAanvragen();
        } catch (e) { if (e.message !== 'unauth') showToast('Kon aanvragen niet laden', 'error'); }
    }

    function aanvraagCardHtml(b) {
        const deurType = b.deurType || b.type || '';
        const materiaal = b.materiaal || '';
        const afmetingen = (b.standaardMaat && b.standaardMaat !== 'Maatwerk (op maat)')
            ? b.standaardMaat
            : ((b.breedte || b.hoogte) ? (b.breedte || '?') + ' × ' + (b.hoogte || '?') + ' cm' : (b.size || 'niet ingevuld'));
        const afwerking = (b.afwerking === 'Custom RAL' && b.ralKleur) ? ('RAL ' + b.ralKleur) : (b.afwerking || 'niet ingevuld');
        return '' +
            '<div class="aanvraag" data-id="' + escapeHtml(b.id) + '">' +
              '<div class="aanvraag-top">' +
                '<div class="aanvraag-who">' +
                  '<span class="aanvraag-name">' + escapeHtml(b.name) + '</span>' +
                  (b.org ? '<span class="aanvraag-org">' + escapeHtml(b.org) + '</span>' : '') +
                '</div>' +
                '<div class="aanvraag-meta">' +
                  '<span class="aanvraag-date">' + formatDate(b.createdAt) + '</span>' +
                  '<span class="status-pill status-' + escapeHtml(b.status) + '">' + escapeHtml(statusLabel(b.status)) + '</span>' +
                '</div>' +
              '</div>' +
              '<div class="aanvraag-tags">' +
                (deurType ? '<span class="tag"><strong>' + escapeHtml(deurType) + '</strong></span>' : '') +
                (materiaal ? '<span class="tag">' + escapeHtml(materiaal) + '</span>' : '') +
                (b.montage ? '<span class="tag">' + escapeHtml(b.montage) + '</span>' : '') +
              '</div>' +
              '<div class="aanvraag-detail-grid">' +
                '<div><div class="k">Deurtype</div><div class="v">' + escapeHtml(deurType || 'niet ingevuld') + '</div></div>' +
                '<div><div class="k">Materiaal</div><div class="v">' + escapeHtml(materiaal || 'niet ingevuld') + '</div></div>' +
                '<div><div class="k">Afmetingen</div><div class="v">' + escapeHtml(afmetingen) + '</div></div>' +
                '<div><div class="k">Afwerking</div><div class="v">' + escapeHtml(afwerking) + '</div></div>' +
                '<div><div class="k">Montage</div><div class="v">' + escapeHtml(b.montage || 'niet ingevuld') + '</div></div>' +
                '<div><div class="k">E-mail</div><div class="v"><a href="mailto:' + escapeHtml(b.email) + '">' + escapeHtml(b.email) + '</a></div></div>' +
                (b.phone ? '<div><div class="k">Telefoon</div><div class="v"><a href="tel:' + escapeHtml(b.phone) + '">' + escapeHtml(b.phone) + '</a></div></div>' : '') +
              '</div>' +
              (b.notes ? '<div class="aanvraag-notes">"' + escapeHtml(b.notes) + '"</div>' : '') +
              '<div class="aanvraag-actions">' +
                (b.status !== 'in_behandeling' ? '<button class="mini-btn" data-act="in_behandeling">In behandeling</button>' : '') +
                (b.status !== 'behandeld' ? '<button class="mini-btn" data-act="behandeld">Markeer afgehandeld</button>' : '') +
                (b.status !== 'nieuw' ? '<button class="mini-btn" data-act="nieuw">Terug naar nieuw</button>' : '') +
                (b.status !== 'geannuleerd' ? '<button class="mini-btn" data-act="geannuleerd">Annuleren</button>' : '') +
                '<button class="mini-btn" data-act="resend">Stuur bevestiging aan klant</button>' +
                '<button class="mini-btn danger" data-act="delete">Verwijderen</button>' +
              '</div>' +
            '</div>';
    }

    function renderAanvragen() {
        const list = document.getElementById('aanvragenList');
        const empty = document.getElementById('aanvragenEmpty');
        const countEl = document.getElementById('aanvraagCount');
        if (countEl) countEl.textContent = allAanvragen.length;

        let filtered = activeFilter === 'alle' ? allAanvragen.slice() : allAanvragen.filter(b => b.status === activeFilter);
        if (aanvraagQuery) {
            const q = aanvraagQuery.toLowerCase();
            filtered = filtered.filter(b =>
                (b.name || '').toLowerCase().includes(q) ||
                (b.email || '').toLowerCase().includes(q) ||
                (b.deurType || b.type || '').toLowerCase().includes(q) ||
                (b.materiaal || '').toLowerCase().includes(q));
        }

        if (!filtered.length) {
            if (list) list.innerHTML = '';
            if (empty) {
                empty.hidden = false;
                empty.textContent = allAanvragen.length
                    ? 'Geen aanvragen die aan de filters voldoen.'
                    : 'Nog geen offerteaanvragen. Configuraties via de website verschijnen hier automatisch.';
            }
            return;
        }
        if (empty) empty.hidden = true;
        if (list) list.innerHTML = filtered.map(aanvraagCardHtml).join('');
    }

    function renderDashboard() {
        const total = allAanvragen.length;
        const nieuw = allAanvragen.filter(b => b.status === 'nieuw').length;
        const afgehandeld = allAanvragen.filter(b => b.status === 'behandeld').length;
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const week = allAanvragen.filter(b => { const t = new Date(b.createdAt).getTime(); return t >= weekAgo; }).length;
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('statTotal', total); set('statNew', nieuw); set('statDone', afgehandeld); set('statWeek', week);

        const recent = document.getElementById('recentList');
        const empty = document.getElementById('recentEmpty');
        if (!recent) return;
        const five = allAanvragen.slice(0, 5);
        if (!five.length) { recent.innerHTML = ''; if (empty) empty.hidden = false; return; }
        if (empty) empty.hidden = true;
        recent.innerHTML = five.map(aanvraagCardHtml).join('');
    }

    async function aanvraagAction(id, act) {
        if (act === 'delete') {
            if (!confirm('Deze offerteaanvraag definitief verwijderen?')) return;
            const r = await api('/api/aanvragen/' + encodeURIComponent(id), { method: 'DELETE' });
            if (r.ok) {
                allAanvragen = allAanvragen.filter(b => b.id !== id);
                const navCount = document.getElementById('navAanvraagCount');
                if (navCount) navCount.textContent = allAanvragen.length;
                renderAanvragen(); renderDashboard();
                showToast('Aanvraag verwijderd');
            } else showToast('Verwijderen mislukt', 'error');
            return;
        }
        if (act === 'resend') {
            const r = await api('/api/aanvragen/' + encodeURIComponent(id) + '/resend', { method: 'POST' });
            if (r.ok) { const d = await r.json(); showToast('E-mail ' + (d.record && d.record.status === 'verzonden' ? 'verzonden' : 'gelogd in postvak')); }
            else showToast('Versturen mislukt', 'error');
            return;
        }
        const r = await api('/api/aanvragen/' + encodeURIComponent(id), {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: act })
        });
        if (r.ok) {
            const data = await r.json();
            const idx = allAanvragen.findIndex(b => b.id === id);
            if (idx !== -1 && data.booking) allAanvragen[idx] = data.booking;
            renderAanvragen(); renderDashboard(); showToast('Status bijgewerkt');
        } else showToast('Bijwerken mislukt', 'error');
    }

    function wireAanvraagClicks(containerId) {
        const el = document.getElementById(containerId);
        if (!el) return;
        el.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-act]');
            if (!btn) return;
            const card = e.target.closest('.aanvraag');
            const id = card && card.dataset.id;
            if (id) aanvraagAction(id, btn.dataset.act);
        });
    }
    wireAanvraagClicks('aanvragenList');
    wireAanvraagClicks('recentList');

    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeFilter = chip.dataset.filter;
            renderAanvragen();
        });
    });
    const aanvraagSearch = document.getElementById('aanvraagSearch');
    if (aanvraagSearch) aanvraagSearch.addEventListener('input', (e) => { aanvraagQuery = e.target.value.trim(); renderAanvragen(); });
    document.getElementById('refreshBtn').addEventListener('click', () => { loadAanvragen(); showToast('Vernieuwd'); });

    // ------------------------------------------------------------------ Mediabibliotheek
    let allMediaItems = [];
    let mediaQuery = '';
    let mediaSourceFilter = 'alle';

    const MEDIA_SOURCE_LABELS = { site: 'Site', upload: 'Upload', referenced: 'Referentie' };

    function renderMediaGrid() {
        const grid = document.getElementById('mediaGrid');
        const empty = document.getElementById('mediaEmpty');
        if (!grid) return;
        const q = mediaQuery.toLowerCase();
        const items = allMediaItems.filter(m => {
            if (mediaSourceFilter !== 'alle' && m.source !== mediaSourceFilter) return false;
            if (!q) return true;
            const hay = [m.filename, m.url, m.alt, m.source].join(' ').toLowerCase();
            return hay.indexOf(q) !== -1;
        });
        if (!items.length) { grid.innerHTML = ''; if (empty) empty.hidden = false; return; }
        if (empty) empty.hidden = true;
        grid.innerHTML = items.map(m => {
            const kb = m.size ? (m.size / 1024).toFixed(0) + ' kB' : '';
            const dim = (m.width && m.height) ? (m.width + '×' + m.height) : '';
            const srcLabel = MEDIA_SOURCE_LABELS[m.source] || m.source || '';
            const canDelete = m.source === 'upload';
            return '<div class="media-item" data-id="' + escapeHtml(m.id || m.filename) + '">' +
                '<div class="media-thumb" style="background-image:url(' + escapeHtml(m.url) + ')"></div>' +
                '<div class="media-info">' +
                  '<span class="media-name" title="' + escapeHtml(m.filename) + '">' + escapeHtml(m.filename) + '</span>' +
                  '<span class="media-meta">' + escapeHtml([srcLabel, dim, kb].filter(Boolean).join(' · ')) + '</span>' +
                  (m.alt ? '<span class="media-alt">' + escapeHtml(m.alt) + '</span>' : '') +
                  '<div class="media-actions">' +
                    '<button class="mini-btn" data-act="copy" data-url="' + escapeHtml(m.url) + '">URL kopiëren</button>' +
                    (canDelete ? '<button class="mini-btn danger" data-act="del">Verwijderen</button>' : '') +
                  '</div>' +
                '</div></div>';
        }).join('');
    }

    async function loadMedia() {
        try {
            const r = await api('/api/media');
            allMediaItems = await r.json();
            renderMediaGrid();
        } catch (e) { if (e.message !== 'unauth') showToast('Kon mediabibliotheek niet laden', 'error'); }
    }

    async function uploadMediaFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            showToast('Alleen afbeeldingen toegestaan', 'error');
            return;
        }
        const fd = new FormData();
        fd.append('image', file);
        try {
            const r = await api('/api/media/upload', { method: 'POST', body: fd });
            if (r.ok) { loadMedia(); showToast('Afbeelding geüpload'); }
            else { const d = await r.json().catch(() => ({})); showToast(d.error || 'Upload mislukt', 'error'); }
        } catch (err) { showToast('Upload mislukt', 'error'); }
    }

    document.getElementById('mediaGrid').addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const item = e.target.closest('.media-item');
        const id = item && item.dataset.id;
        if (btn.dataset.act === 'copy') {
            const url = location.origin + btn.dataset.url;
            try { await navigator.clipboard.writeText(url); showToast('URL gekopieerd'); }
            catch (err) { showToast(url, 'success'); }
            return;
        }
        if (btn.dataset.act === 'del') {
            if (!id || !confirm('Deze upload verwijderen?')) return;
            const r = await api('/api/media/' + encodeURIComponent(id), { method: 'DELETE' });
            if (r.ok) { loadMedia(); showToast('Afbeelding verwijderd'); }
            else { const d = await r.json().catch(() => ({})); showToast(d.error || 'Verwijderen mislukt', 'error'); }
        }
    });

    document.getElementById('mediaUpload').addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) await uploadMediaFile(file);
        e.target.value = '';
    });
    document.getElementById('mediaRefresh').addEventListener('click', () => { loadMedia(); showToast('Vernieuwd'); });
    const mediaSearch = document.getElementById('mediaSearch');
    if (mediaSearch) mediaSearch.addEventListener('input', (e) => { mediaQuery = e.target.value.trim(); renderMediaGrid(); });
    const mediaFilter = document.getElementById('mediaFilter');
    if (mediaFilter) mediaFilter.addEventListener('change', (e) => { mediaSourceFilter = e.target.value; renderMediaGrid(); });

    (function wireMediaDrop() {
        const zone = document.getElementById('mediaDropZone');
        const panel = document.querySelector('#view-media .panel');
        if (!zone || !panel) return;
        zone.hidden = false;
        ['dragenter', 'dragover'].forEach(ev => {
            panel.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('active'); });
        });
        ['dragleave', 'drop'].forEach(ev => {
            panel.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('active'); });
        });
        panel.addEventListener('drop', (e) => {
            const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (file) uploadMediaFile(file);
        });
    })();

    // ------------------------------------------------------------------ E-mails: postvak
    function statusClass(s) {
        s = (s || '').toLowerCase();
        if (s.indexOf('verzonden') === 0) return 'st-sent';
        if (s.indexOf('mislukt') === 0) return 'st-fail';
        return 'st-pending';
    }

    async function loadOutbox() {
        try {
            const r = await api('/api/emails');
            const list = await r.json();
            const wrap = document.getElementById('outboxList');
            const empty = document.getElementById('outboxEmpty');
            if (!list.length) { wrap.innerHTML = ''; empty.hidden = false; return; }
            empty.hidden = true;
            wrap.innerHTML = list.map(m =>
                '<div class="email-row" data-id="' + escapeHtml(m.id) + '">' +
                  '<div class="email-main">' +
                    '<div class="email-subj">' + escapeHtml(m.subject || '(geen onderwerp)') + '</div>' +
                    '<div class="email-to">aan ' + escapeHtml(m.to || '—') + ' · ' + escapeHtml(m.trigger || '') + '</div>' +
                  '</div>' +
                  '<div class="email-side">' +
                    '<span class="email-date">' + formatDate(m.createdAt) + '</span>' +
                    '<span class="email-status ' + statusClass(m.status) + '">' + escapeHtml(m.status || '') + '</span>' +
                  '</div>' +
                  '<button class="email-del" data-del="1" title="Verwijderen">✕</button>' +
                '</div>').join('');
        } catch (e) { if (e.message !== 'unauth') showToast('Kon postvak niet laden', 'error'); }
    }

    document.getElementById('outboxList').addEventListener('click', async (e) => {
        const row = e.target.closest('.email-row');
        if (!row) return;
        const id = row.dataset.id;
        if (e.target.closest('[data-del]')) {
            if (!confirm('Dit bericht uit het postvak verwijderen?')) return;
            const r = await api('/api/emails/' + encodeURIComponent(id), { method: 'DELETE' });
            if (r.ok) { loadOutbox(); showToast('Bericht verwijderd'); }
            else showToast('Verwijderen mislukt', 'error');
            return;
        }
        try {
            const r = await api('/api/emails/' + encodeURIComponent(id));
            const m = await r.json();
            openEmailModal(m);
        } catch (err) { showToast('Kon bericht niet laden', 'error'); }
    });

    document.getElementById('emailsRefresh').addEventListener('click', () => { loadOutbox(); showToast('Vernieuwd'); });

    function openEmailModal(m) {
        document.getElementById('emailModalSubject').textContent = m.subject || '(geen onderwerp)';
        document.getElementById('emailModalMeta').textContent = 'aan ' + (m.to || '—') + ' · ' + formatDate(m.createdAt) + ' · ' + (m.status || '');
        document.getElementById('emailModalFrame').srcdoc = m.html || '<p style="font-family:sans-serif;padding:20px;color:#888">Geen inhoud</p>';
        document.getElementById('emailModal').hidden = false;
    }
    document.getElementById('emailModalClose').addEventListener('click', () => { document.getElementById('emailModal').hidden = true; });
    document.getElementById('emailModal').addEventListener('click', (e) => { if (e.target.id === 'emailModal') e.currentTarget.hidden = true; });

    // ------------------------------------------------------------------ E-mails: sjablonen
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const t = tab.dataset.tab;
            document.getElementById('tab-outbox').hidden = t !== 'outbox';
            document.getElementById('tab-templates').hidden = t !== 'templates';
        });
    });

    async function loadTemplates() {
        try {
            const r = await api('/api/email-templates');
            templates = await r.json();
            fillTemplateEditor();
        } catch (e) { if (e.message !== 'unauth') showToast('Kon sjablonen niet laden', 'error'); }
    }

    function fillTemplateEditor() {
        if (!templates) return;
        const tpl = templates[currentTpl] || { subject: '', html: '' };
        document.getElementById('tplSubject').value = tpl.subject || '';
        document.getElementById('tplHtml').value = tpl.html || '';
        updatePreview();
    }

    function updatePreview() {
        const subject = document.getElementById('tplSubject').value;
        const html = document.getElementById('tplHtml').value;
        document.getElementById('tplPreviewSubject').textContent = renderTemplate(subject, SAMPLE_VARS);
        document.getElementById('tplPreviewFrame').srcdoc = renderTemplate(html, SAMPLE_VARS);
    }

    document.getElementById('templateSelect').addEventListener('change', (e) => { currentTpl = e.target.value; fillTemplateEditor(); });
    document.getElementById('tplSubject').addEventListener('input', updatePreview);
    document.getElementById('tplHtml').addEventListener('input', updatePreview);

    document.getElementById('tplSave').addEventListener('click', async () => {
        if (!templates) return;
        templates[currentTpl] = templates[currentTpl] || {};
        templates[currentTpl].subject = document.getElementById('tplSubject').value;
        templates[currentTpl].html = document.getElementById('tplHtml').value;
        try {
            const r = await api('/api/email-templates', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(templates)
            });
            if (r.ok) { const d = await r.json(); templates = d.templates; showToast('Sjabloon opgeslagen'); }
            else showToast('Opslaan mislukt', 'error');
        } catch (e) { showToast('Opslaan mislukt', 'error'); }
    });

    // ------------------------------------------------------------------ Instellingen
    async function loadSettings() {
        try {
            const r = await api('/api/settings');
            const s = await r.json();
            const form = document.getElementById('settingsForm');
            const set = (n, v) => { const el = form.elements[n]; if (el) el.value = v == null ? '' : v; };
            set('bedrijfsnaam', s.bedrijfsnaam); set('tagline', s.tagline); set('contactEmail', s.contactEmail);
            set('telefoon', s.telefoon); set('adres', s.adres); set('meldingsEmail', s.meldingsEmail);
            const sm = s.smtp || {};
            set('smtp.host', sm.host); set('smtp.port', sm.port); set('smtp.user', sm.user);
            set('smtp.pass', sm.pass); set('smtp.fromNaam', sm.fromNaam); set('smtp.fromAdres', sm.fromAdres);
            const sec = form.elements['smtp.secure']; if (sec) sec.checked = !!sm.secure;
            const ai = s.ai || {};
            const aiProvider = ai.provider || 'kimi';
            set('ai.provider', aiProvider);
            set('ai.apiKey', ai.apiKey); set('ai.baseUrl', ai.baseUrl); set('ai.model', ai.model);
            set('ai.pageBuilderModel', ai.pageBuilderModel || 'anthropic/claude-opus-4.7');
            rebuildAiModelOptions(aiProvider, ai.model || '');
            aiConfigured = !!(ai.apiKey && String(ai.apiKey).trim());
            updateAiProviderHint();
        } catch (e) { if (e.message !== 'unauth') showToast('Kon instellingen niet laden', 'error'); }
    }

    function collectSettings() {
        const form = document.getElementById('settingsForm');
        const g = (n) => { const el = form.elements[n]; return el ? el.value : ''; };
        return {
            bedrijfsnaam: g('bedrijfsnaam'), tagline: g('tagline'), contactEmail: g('contactEmail'),
            telefoon: g('telefoon'), adres: g('adres'), meldingsEmail: g('meldingsEmail'),
            smtp: {
                host: g('smtp.host'), port: g('smtp.port'),
                secure: form.elements['smtp.secure'].checked,
                user: g('smtp.user'), pass: g('smtp.pass'),
                fromNaam: g('smtp.fromNaam'), fromAdres: g('smtp.fromAdres')
            },
            ai: {
                provider: g('ai.provider'), apiKey: g('ai.apiKey'), baseUrl: g('ai.baseUrl'), model: g('ai.model'),
                pageBuilderModel: g('ai.pageBuilderModel')
            }
        };
    }

    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const r = await api('/api/settings', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(collectSettings())
            });
            if (r.ok) showToast('Instellingen opgeslagen'); else showToast('Opslaan mislukt', 'error');
        } catch (err) { showToast('Opslaan mislukt', 'error'); }
    });

    document.getElementById('testEmailBtn').addEventListener('click', async () => {
        const to = prompt('Naar welk adres? (laat leeg voor de meldingsontvanger)') || '';
        try {
            const r = await api('/api/emails/test', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: to.trim() })
            });
            if (r.ok) {
                const d = await r.json();
                const st = d.record && d.record.status;
                showToast(st === 'verzonden' ? 'Test-e-mail verzonden' : 'Geen SMTP: bericht in postvak gelogd');
                if (location.hash.slice(1) === 'emails') loadOutbox();
            } else { const d = await r.json().catch(() => ({})); showToast(d.error || 'Versturen mislukt', 'error'); }
        } catch (err) { showToast('Versturen mislukt', 'error'); }
    });

    // ------------------------------------------------------------------ AI-provider (Kimi direct / OpenRouter)
    const AI_PROVIDER_DEFAULTS = {
        kimi:       { baseUrl: 'https://api.moonshot.ai/v1', model: 'kimi-k2.6',
                      hint: 'Rechtstreeks bij Moonshot. Maak een sleutel aan op platform.moonshot.ai.' },
        openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'moonshotai/kimi-k2.6',
                      hint: 'Via OpenRouter. Maak een sleutel aan op openrouter.ai/keys. Je kunt later ook andere modellen kiezen, bv. moonshotai/kimi-k2.5.' }
    };

    // Veelgebruikte modellen per koppeling. De gekozen waarde belandt in ai.model.
    const AI_MODEL_PRESETS = {
        kimi: [
            { value: 'kimi-k2.6', label: 'Kimi K2.6 (aanbevolen)' }
        ],
        openrouter: [
            { value: 'moonshotai/kimi-k2.6', label: 'Kimi K2.6 (aanbevolen chat)' },
            { value: 'moonshotai/kimi-k2.5', label: 'Kimi K2.5' },
            { value: 'moonshotai/kimi-k2', label: 'Kimi K2' },
            { value: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4' },
            { value: 'openai/gpt-4.1-mini', label: 'OpenAI GPT-4.1 mini' }
        ]
    };
    const AI_MODEL_CUSTOM = '__custom__';

    function allKnownPresetModels() {
        return Object.keys(AI_MODEL_PRESETS).reduce((acc, k) =>
            acc.concat(AI_MODEL_PRESETS[k].map(p => p.value)), []);
    }

    // Het verborgen/zichtbare tekstveld name="ai.model" blijft de bron voor
    // collectSettings(); het dropdownveld stuurt alleen die waarde aan.
    function syncAiModelFromSelect(keepCustomValue) {
        const sel = document.getElementById('aiModelSelect');
        const form = document.getElementById('settingsForm');
        const modelInput = form && form.elements['ai.model'];
        const wrap = document.getElementById('aiModelCustomWrap');
        if (!sel || !modelInput) return;
        if (sel.value === AI_MODEL_CUSTOM) {
            if (wrap) wrap.hidden = false;
            if (!keepCustomValue) { modelInput.value = ''; modelInput.focus(); }
        } else {
            if (wrap) wrap.hidden = true;
            modelInput.value = sel.value;
        }
    }

    // Vul de dropdown met de presets van de provider en selecteer het juiste item.
    function rebuildAiModelOptions(provider, selectedModel) {
        const sel = document.getElementById('aiModelSelect');
        if (!sel) return;
        const presets = AI_MODEL_PRESETS[provider] || AI_MODEL_PRESETS.kimi;
        let html = presets.map(p =>
            '<option value="' + escapeHtml(p.value) + '">' + escapeHtml(p.label) + '</option>').join('');
        html += '<option value="' + AI_MODEL_CUSTOM + '">Aangepast model…</option>';
        sel.innerHTML = html;
        const match = presets.find(p => p.value === selectedModel);
        if (selectedModel && !match) sel.value = AI_MODEL_CUSTOM;
        else sel.value = match ? match.value : presets[0].value;
        syncAiModelFromSelect(true);
    }

    function updateAiProviderHint() {
        const form = document.getElementById('settingsForm');
        const sel = form.elements['ai.provider'];
        const hintEl = document.getElementById('aiProviderHint');
        if (!sel) return;
        const def = AI_PROVIDER_DEFAULTS[sel.value] || AI_PROVIDER_DEFAULTS.kimi;
        if (hintEl) hintEl.textContent = def.hint;
        const base = form.elements['ai.baseUrl'];
        const model = form.elements['ai.model'];
        if (base) base.placeholder = def.baseUrl;
        if (model) model.placeholder = def.model;
    }

    // Bij wisselen van koppeling: vul base URL + model met de standaard van die
    // provider (alleen als ze leeg zijn of nog op de andere standaard staan).
    document.getElementById('aiProvider').addEventListener('change', (e) => {
        const provider = e.target.value;
        const form = document.getElementById('settingsForm');
        const def = AI_PROVIDER_DEFAULTS[provider] || AI_PROVIDER_DEFAULTS.kimi;
        const base = form.elements['ai.baseUrl'];
        const model = form.elements['ai.model'];
        const knownBases = Object.values(AI_PROVIDER_DEFAULTS).map(d => d.baseUrl);
        if (base && (!base.value.trim() || knownBases.includes(base.value.trim()))) base.value = def.baseUrl;
        // Kies een passend model: behoud een geldig model voor deze provider, val
        // terug op de aanbevolen waarde als het leeg is of bij een andere provider hoort.
        const cur = model ? model.value.trim() : '';
        const presets = AI_MODEL_PRESETS[provider] || [];
        let target;
        if (presets.some(p => p.value === cur)) target = cur;
        else if (!cur || allKnownPresetModels().includes(cur)) target = def.model;
        else target = cur;
        if (model) model.value = target;
        rebuildAiModelOptions(provider, target);
        updateAiProviderHint();
    });

    // Modelkeuze uit de dropdown: zet de waarde voor collectSettings of toon het
    // vrije tekstveld bij "Aangepast model".
    document.getElementById('aiModelSelect').addEventListener('change', () => {
        syncAiModelFromSelect(false);
    });

    // ------------------------------------------------------------------ AI verbinding testen (instellingen)
    document.getElementById('aiTestBtn').addEventListener('click', async () => {
        const status = document.getElementById('aiTestStatus');
        status.textContent = 'Bezig met testen…';
        status.className = 'agent-status';
        // Eerst opslaan zodat de ingevulde sleutel wordt meegenomen
        try {
            await api('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(collectSettings()) });
        } catch (e) { /* test geeft zelf wel de fout */ }
        try {
            const r = await api('/api/ai/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
            const d = await r.json().catch(() => ({}));
            if (r.ok && d.ok) { status.textContent = 'Verbinding gelukt (' + (d.provider ? d.provider + ' · ' : '') + (d.model || '') + ')'; status.className = 'agent-status ok'; aiConfigured = true; }
            else { status.textContent = d.error || 'Verbinding mislukt'; status.className = 'agent-status fail'; }
        } catch (e) { status.textContent = 'Verbinding mislukt'; status.className = 'agent-status fail'; }
    });

    // ------------------------------------------------------------------ Pagina's
    async function loadPages() {
        try {
            const r = await api('/api/pages');
            pages = await r.json();
            renderPages();
        } catch (e) { if (e.message !== 'unauth') showToast('Kon pagina\u0027s niet laden', 'error'); }
    }

    function renderPages() {
        const list = document.getElementById('pagesList');
        const empty = document.getElementById('pagesEmpty');
        if (!pages.length) { list.innerHTML = ''; empty.hidden = false; return; }
        empty.hidden = true;
        list.innerHTML = pages.map(p => {
            const pub = p.status === 'gepubliceerd';
            return '<div class="page-row" data-id="' + escapeHtml(p.id) + '">' +
                '<div class="page-main">' +
                    '<div class="page-title">' + escapeHtml(p.title) +
                        (p.source === 'ai' ? '<span class="page-src">AI</span>' : '') +
                    '</div>' +
                    '<div class="page-slug">/p/' + escapeHtml(p.slug) + '</div>' +
                '</div>' +
                '<div class="page-side">' +
                    '<span class="page-date">' + formatDate(p.updatedAt) + '</span>' +
                    '<span class="status-pill ' + (pub ? 'status-behandeld' : 'status-nieuw') + '">' + (pub ? 'gepubliceerd' : 'concept') + '</span>' +
                '</div>' +
                '<div class="page-actions">' +
                    (pub ? '<a class="mini-btn" href="/p/' + encodeURIComponent(p.slug) + '" target="_blank">Bekijken</a>' : '') +
                    '<a class="mini-btn" href="/p/' + encodeURIComponent(p.slug) + '?edit=1" target="_blank">Live builder</a>' +
                    '<button class="mini-btn" data-act="assist">Pas aan via Assistent</button>' +
                    '<button class="mini-btn" data-act="toggle">' + (pub ? 'Depubliceren' : 'Publiceren') + '</button>' +
                    '<button class="mini-btn danger" data-act="delete">Verwijderen</button>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    document.getElementById('pagesList').addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const row = e.target.closest('.page-row');
        const id = row && row.dataset.id;
        const page = pages.find(p => p.id === id);
        if (!page) return;
        if (btn.dataset.act === 'assist') { openAgentForPage(page); return; }
        if (btn.dataset.act === 'edit') { openPageModal(page); return; }
        if (btn.dataset.act === 'toggle') {
            const status = page.status === 'gepubliceerd' ? 'concept' : 'gepubliceerd';
            const r = await api('/api/pages/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
            if (r.ok) { loadPages(); showToast(status === 'gepubliceerd' ? 'Pagina gepubliceerd' : 'Pagina op concept gezet'); }
            else showToast('Bijwerken mislukt', 'error');
            return;
        }
        if (btn.dataset.act === 'delete') {
            if (!confirm('Deze pagina definitief verwijderen?')) return;
            const r = await api('/api/pages/' + encodeURIComponent(id), { method: 'DELETE' });
            if (r.ok) { loadPages(); showToast('Pagina verwijderd'); }
            else showToast('Verwijderen mislukt', 'error');
        }
    });

    document.getElementById('pagesRefresh').addEventListener('click', () => { loadPages(); showToast('Vernieuwd'); });
    document.getElementById('pageNewBtn').addEventListener('click', () => {
        openAgentWithPrefill('Ik wil een nieuwe pagina maken');
    });

    function openAgentWithPrefill(text) {
        try { sessionStorage.setItem('deurmeester-agent-prefill', text); } catch (e) {}
        location.hash = '#agent';
    }

    function openAgentForPage(page) {
        if (!page) return;
        openAgentWithPrefill('Pas de pagina "' + page.title + '" aan (slug: ' + page.slug + '). Ik wil het volgende wijzigen: ');
    }

    function openPageModal(page) {
        editingPageId = page ? page.id : null;
        document.getElementById('pageModalTitle').textContent = page ? 'Pagina bewerken' : 'Nieuwe pagina';
        document.getElementById('pageModalMeta').textContent = page ? ('Aangemaakt ' + formatDate(page.createdAt)) : 'Nieuwe pagina in de huisstijl';
        document.getElementById('pageTitle').value = page ? page.title : '';
        document.getElementById('pageSlug').value = page ? page.slug : '';
        document.getElementById('pageStatus').value = page ? page.status : 'concept';
        document.getElementById('pageInMenu').checked = page ? !!page.inMenu : false;
        document.getElementById('pageMenuLabel').value = page ? (page.menuLabel || '') : '';
        document.getElementById('pageHtml').value = page ? page.html : '<section class="page-hero">\n  <div class="container">\n    <span class="eyebrow">Eyebrow</span>\n    <h1>Een <em>titel</em></h1>\n    <p class="page-hero-sub">Korte introtekst.</p>\n  </div>\n</section>';
        const link = document.getElementById('pageOpenLink');
        if (page && page.status === 'gepubliceerd') { link.href = '/p/' + encodeURIComponent(page.slug); link.hidden = false; }
        else { link.hidden = true; }
        // De live builder werkt op de gerenderde /p/-pagina. Voor bestaande pagina's
        // (ook concept) kunnen we hem openen; voor een nieuwe pagina moet eerst worden opgeslagen.
        const builderLink = document.getElementById('pageBuilderLink');
        if (page) { builderLink.href = '/p/' + encodeURIComponent(page.slug) + '?edit=1'; builderLink.hidden = false; }
        else { builderLink.hidden = true; }
        document.getElementById('pageModal').hidden = false;
    }
    function closePageModal() { document.getElementById('pageModal').hidden = true; editingPageId = null; }
    document.getElementById('pageModalClose').addEventListener('click', closePageModal);
    document.getElementById('pageModalCancel').addEventListener('click', closePageModal);
    document.getElementById('pageModal').addEventListener('click', (e) => { if (e.target.id === 'pageModal') closePageModal(); });

    document.getElementById('pageSave').addEventListener('click', async () => {
        const payload = {
            title: document.getElementById('pageTitle').value.trim(),
            slug: document.getElementById('pageSlug').value.trim(),
            status: document.getElementById('pageStatus').value,
            inMenu: document.getElementById('pageInMenu').checked,
            menuLabel: document.getElementById('pageMenuLabel').value.trim(),
            html: document.getElementById('pageHtml').value
        };
        if (!payload.title) { showToast('Titel is verplicht', 'error'); return; }
        try {
            let r;
            if (editingPageId) r = await api('/api/pages/' + encodeURIComponent(editingPageId), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            else r = await api('/api/pages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (r.ok) { closePageModal(); loadPages(); showToast('Pagina opgeslagen'); }
            else { const d = await r.json().catch(() => ({})); showToast(d.error || 'Opslaan mislukt', 'error'); }
        } catch (e) { showToast('Opslaan mislukt', 'error'); }
    });

    // ------------------------------------------------------------------ Huisstijl (stijlgids)
    async function loadStyleguide() {
        try {
            const r = await api('/api/styleguide');
            styleguide = await r.json();
            renderStyleguide();
        } catch (e) { if (e.message !== 'unauth') showToast('Kon stijlgids niet laden', 'error'); }
    }

    function renderStyleguide() {
        if (!styleguide) return;
        const tokens = styleguide.tokens || [];
        document.getElementById('sgTokens').innerHTML = tokens.map((t, i) =>
            '<div class="sg-token" data-i="' + i + '">' +
                '<span class="sg-swatch" style="background:' + escapeHtml(t.hex) + '"></span>' +
                '<div class="sg-token-fields">' +
                    '<span class="sg-var">' + escapeHtml(t.var) + '</span>' +
                    '<span class="sg-label">' + escapeHtml(t.label || '') + '</span>' +
                '</div>' +
                '<input class="text-input sg-hex" data-i="' + i + '" value="' + escapeHtml(t.hex) + '"/>' +
            '</div>').join('');
        const f = styleguide.fonts || {};
        document.getElementById('sgFontHeading').value = f.heading || '';
        document.getElementById('sgFontBody').value = f.body || '';
        document.getElementById('sgFontAccent').value = f.accent || '';
        document.getElementById('sgBaseCss').value = styleguide.baseCssUrl || '';
        document.getElementById('sgFontsHref').value = f.googleFontsHref || '';
        document.getElementById('sgVoice').value = styleguide.voice || '';
        document.getElementById('sgComponents').value = styleguide.components || '';
        document.getElementById('sgGuidelines').value = styleguide.guidelines || '';
    }

    // Live swatch bijwerken bij typen
    document.getElementById('sgTokens').addEventListener('input', (e) => {
        const inp = e.target.closest('.sg-hex');
        if (!inp) return;
        const row = inp.closest('.sg-token');
        const sw = row && row.querySelector('.sg-swatch');
        if (sw) sw.style.background = inp.value;
    });

    function collectStyleguide() {
        const tokens = Array.from(document.querySelectorAll('#sgTokens .sg-token')).map(row => {
            const i = parseInt(row.dataset.i, 10);
            const base = (styleguide.tokens && styleguide.tokens[i]) || {};
            const hex = row.querySelector('.sg-hex').value.trim();
            return { var: base.var, hex: hex, label: base.label };
        });
        return {
            tokens,
            fonts: {
                heading: document.getElementById('sgFontHeading').value.trim(),
                body: document.getElementById('sgFontBody').value.trim(),
                accent: document.getElementById('sgFontAccent').value.trim(),
                googleFontsHref: document.getElementById('sgFontsHref').value.trim()
            },
            baseCssUrl: document.getElementById('sgBaseCss').value.trim(),
            voice: document.getElementById('sgVoice').value,
            components: document.getElementById('sgComponents').value,
            guidelines: document.getElementById('sgGuidelines').value
        };
    }

    document.getElementById('sgSave').addEventListener('click', async () => {
        try {
            const r = await api('/api/styleguide', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(collectStyleguide()) });
            if (r.ok) { const d = await r.json(); styleguide = d.styleguide; renderStyleguide(); showToast('Huisstijl opgeslagen'); }
            else showToast('Opslaan mislukt', 'error');
        } catch (e) { showToast('Opslaan mislukt', 'error'); }
    });

    document.getElementById('sgSync').addEventListener('click', async () => {
        try {
            const r = await api('/api/styleguide/sync', { method: 'POST' });
            if (r.ok) { const d = await r.json(); styleguide = d.styleguide; renderStyleguide(); showToast('Bijgewerkt uit website (' + (d.synced || 0) + ' kleuren)'); }
            else showToast('Sync mislukt', 'error');
        } catch (e) { showToast('Sync mislukt', 'error'); }
    });

    // ------------------------------------------------------------------ AI-assistent (pagina-bouwer via gesprek)
    const AGENT_STORAGE_KEY = 'deurmeester-agent-chat';
    const AGENT_PREFILL_KEY = 'deurmeester-agent-prefill';
    let agentChatMessages = [];
    let agentChatBusy = false;
    let agentLastSuggestions = [];
    let agentPendingPlan = null;

    const AGENT_CHAT_TIMEOUT_MS = 45000;
    const AGENT_BUILD_TIMEOUT_MS = 60000;

    const AGENT_MODE_LABELS = {
        begrip: 'Doorvragen',
        voorstel: 'Voorbeeld',
        antwoord: 'Antwoord'
    };

    const PAGE_BUILD_STARTERS = [
        'Ik wil een pagina over onderhoud van binnendeuren',
        'Voeg een sectie toe over maatwerk taatsdeuren',
        'Pas de homepage aan',
        'Ik wil een nieuwe dienstenpagina met warme luxe sfeer',
        'Welke offerteaanvragen zijn nieuw?'
    ];

    const DESIGN_DIMENSION_LABELS = {
        sfeer: { label: 'Sfeer', icon: '✨' },
        layout: { label: 'Layout', icon: '📐' },
        kleuraccent: { label: 'Kleuraccent', icon: '🎨' },
        typografie: { label: 'Typografie', icon: 'Aa' },
        beelden: { label: 'Beelden', icon: '🖼' },
        sectiestijl: { label: 'Sectiestijl', icon: '▦' },
        cta: { label: 'CTA-stijl', icon: '◎' },
        uniek: { label: 'Uniek element', icon: '★' }
    };

    function formatDesignSummaryHtml(design) {
        if (!design || typeof design !== 'object') return '';
        const keys = Object.keys(DESIGN_DIMENSION_LABELS);
        const rows = keys.filter(k => design[k]).map(k => {
            const meta = DESIGN_DIMENSION_LABELS[k];
            return '<span class="agent-design-chip" title="' + escapeHtml(meta.label) + '">' +
                '<span class="agent-design-icon" aria-hidden="true">' + meta.icon + '</span>' +
                '<span class="agent-design-key">' + escapeHtml(meta.label) + '</span>' +
                '<span class="agent-design-val">' + escapeHtml(String(design[k])) + '</span>' +
                '</span>';
        });
        if (!rows.length) return '';
        return '<div class="agent-plan-design"><span class="agent-plan-label">Pagina-design</span><div class="agent-design-chips">' + rows.join('') + '</div></div>';
    }

    function saveAgentHistory() {
        try {
            sessionStorage.setItem(AGENT_STORAGE_KEY, JSON.stringify({
                messages: agentChatMessages,
                pendingPlan: agentPendingPlan
            }));
        } catch (e) { /* quota */ }
    }

    function loadAgentHistory() {
        try {
            const raw = sessionStorage.getItem(AGENT_STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (Array.isArray(data.messages) && data.messages.length) {
                agentChatMessages = data.messages;
                agentPendingPlan = data.pendingPlan || null;
                const thread = document.getElementById('agentChatThread');
                if (thread) {
                    thread.innerHTML = '';
                    agentChatMessages.forEach(m => {
                        if (m.role === 'user') appendChatBubble('user', m.content);
                        else {
                            appendChatBubble('assistant', m.content, m.plan || null, {
                                choices: m.choices || [],
                                choicesMultiple: !!m.choicesMultiple
                            });
                            if (m.plan) agentPendingPlan = m.plan;
                        }
                    });
                if (agentPendingPlan && thread) {
                    const planCards = thread.querySelectorAll('.agent-plan-inline');
                    const lastPlanBubble = planCards.length ? planCards[planCards.length - 1] : null;
                    if (lastPlanBubble) bindPlanBuildButtons(lastPlanBubble.parentElement || thread);
                }
                }
            }
        } catch (e) { /* corrupt */ }
        updateAgentWelcome();
    }

    function updateAgentWelcome() {
        const welcome = document.getElementById('agentWelcome');
        if (!welcome) return;
        welcome.hidden = !!(agentChatMessages && agentChatMessages.length);
    }

    function userWantsBuild(text) {
        const t = String(text || '').toLowerCase().trim();
        return /\b(ja|akkoord|goed|doe maar|maak de pagina|maak hem|maak m|ziet er goed uit|prima|oké|oke|bevestig|ga door|klopt|akkoord met plan|plan is goed)\b/.test(t);
    }

    function setAgentLoading(text) {
        const thinking = document.getElementById('agentChatThinking');
        if (thinking) {
            thinking.hidden = !text;
            const label = thinking.querySelector('.agent-thinking-label');
            if (label) label.textContent = text || 'Bezig…';
        }
    }

    function formatAgentError(d, fallback) {
        if (!d || typeof d !== 'object') return fallback || 'Opdracht mislukt';
        if (d.error) return d.error;
        if (d.code === 'NO_KEY') return 'API-sleutel ontbreekt. Stel deze in bij Instellingen.';
        if (d.code === 'BAD_JSON') return 'AI-antwoord onleesbaar. Probeer opnieuw.';
        if (d.code === 'NO_PLAN') return 'Nog geen voorstel om te bouwen. Praat eerst verder met de assistent.';
        return fallback || 'Opdracht mislukt';
    }

    function getContextualAgentSuggestions() {
        const route = location.hash.slice(1) || 'agent';
        if (agentPendingPlan) {
            return ['Ziet er goed uit, maak de pagina', 'Andere sfeer of layout', 'Andere afbeelding voor de hero', 'Nog iets aanpassen'];
        }
        if (route === 'aanvragen') {
            return ['Welke offerteaanvragen zijn nieuw?'].concat(PAGE_BUILD_STARTERS.slice(0, 3));
        }
        if (route === 'media') {
            return ['Welke hero-afbeelding past bij luxe deuren?', 'Ik wil een pagina met deze foto\'s'].concat(PAGE_BUILD_STARTERS.slice(0, 2));
        }
        return PAGE_BUILD_STARTERS;
    }

    function renderAgentSuggestions(items, sendOnClick) {
        const box = document.getElementById('agentChatSuggestions');
        if (!box) return;
        const list = (items && items.length) ? items : getContextualAgentSuggestions();
        agentLastSuggestions = list.filter(t => t).slice(0, 5);
        if (!agentLastSuggestions.length) { box.hidden = true; box.innerHTML = ''; return; }
        box.hidden = false;
        let html = '<div class="agent-suggestions-label">Suggesties</div>';
        agentLastSuggestions.forEach(text => {
            html += '<button type="button" class="agent-suggestion" data-text="' + escapeHtml(text) + '">' + escapeHtml(text) + '</button>';
        });
        box.innerHTML = html;
        box.querySelectorAll('.agent-suggestion').forEach(btn => {
            btn.addEventListener('click', () => {
                const t = btn.getAttribute('data-text') || '';
                const input = document.getElementById('agentChatInput');
                if (!input) return;
                if (sendOnClick) { input.value = t; sendAgentChat(); }
                else { input.value = t; input.focus(); }
            });
        });
    }

    function setAgentModeBadge(mode) {
        const badge = document.getElementById('agentChatMode');
        if (!badge) return;
        const label = AGENT_MODE_LABELS[mode] || '';
        if (!label) { badge.hidden = true; badge.textContent = ''; badge.className = 'agent-mode-badge'; return; }
        badge.hidden = false;
        badge.textContent = label;
        badge.className = 'agent-mode-badge mode-' + (mode || 'antwoord');
    }

    function formatAgentPlanHtml(plan) {
        if (!plan || typeof plan !== 'object') return '';
        const secties = Array.isArray(plan.secties) ? plan.secties : (Array.isArray(plan.sections) ? plan.sections : []);
        const beelden = Array.isArray(plan.beelden) ? plan.beelden : (Array.isArray(plan.images) ? plan.images : []);
        const title = plan.title || plan.titel || '';
        const slug = plan.slug || '';
        let html = '<div class="agent-plan-card agent-plan-inline">';
        html += '<h3>' + (title ? escapeHtml(title) : 'Voorbeeld van je pagina') + '</h3>';
        if (slug) html += '<p class="agent-plan-slug">Wordt live op <code>/p/' + escapeHtml(slug) + '</code></p>';
        html += '<dl class="agent-plan-meta">';
        if (plan.doel) html += '<div><dt>Doel</dt><dd>' + escapeHtml(plan.doel) + '</dd></div>';
        if (plan.doelgroep) html += '<div><dt>Doelgroep</dt><dd>' + escapeHtml(plan.doelgroep) + '</dd></div>';
        if (plan.toon) html += '<div><dt>Toon</dt><dd>' + escapeHtml(plan.toon) + '</dd></div>';
        if (plan.cta) html += '<div><dt>Actie</dt><dd>' + escapeHtml(plan.cta) + '</dd></div>';
        html += '</dl>';
        if (plan.design) html += formatDesignSummaryHtml(plan.design);
        if (beelden.length) {
            html += '<div class="agent-plan-images">';
            beelden.forEach(img => {
                const url = (img && img.url) || '';
                const label = (img && img.label) || 'Afbeelding';
                if (url) {
                    html += '<figure class="agent-plan-thumb"><img src="' + escapeHtml(url) + '" alt="' + escapeHtml(label) + '"/><figcaption>' + escapeHtml(label) + '</figcaption></figure>';
                } else if (label) {
                    html += '<p class="agent-plan-preview">' + escapeHtml(label) + '</p>';
                }
            });
            html += '</div>';
        }
        if (secties.length) {
            html += '<div class="agent-plan-sections"><span class="agent-plan-label">Secties op de pagina</span><ol>';
            secties.forEach(s => {
                if (s && typeof s === 'object' && (s.headline || s.title)) {
                    html += '<li><strong>' + escapeHtml(s.headline || s.title) + '</strong>';
                    if (s.preview) html += '<span class="agent-plan-preview">' + escapeHtml(s.preview) + '</span>';
                    html += '</li>';
                } else {
                    html += '<li>' + escapeHtml(String(s)) + '</li>';
                }
            });
            html += '</ol></div>';
        }
        if (plan.tips || plan.summary) html += '<p class="agent-plan-summary">' + escapeHtml(plan.tips || plan.summary || '') + '</p>';
        html += '<div class="agent-plan-actions-bar">';
        html += '<button type="button" class="btn-primary small agent-build-btn">Maak de pagina</button>';
        html += '<span class="agent-plan-hint">Ziet dit er goed uit? Dan maak ik de pagina voor je.</span>';
        html += '</div>';
        html += '</div>';
        return html;
    }

    function bindPlanBuildButtons(container) {
        if (!container) return;
        container.querySelectorAll('.agent-build-btn').forEach(btn => {
            btn.addEventListener('click', () => buildPageFromPlan());
        });
    }

    async function buildPageFromPlan(retryAttempt) {
        if (agentChatBusy) return;
        if (!agentPendingPlan) {
            showToast('Nog geen voorstel om te bouwen. Praat eerst verder met de assistent.', 'error');
            return;
        }
        agentChatBusy = true;
        const attempt = typeof retryAttempt === 'number' ? retryAttempt : 0;
        setAgentLoading(attempt > 0
            ? 'Nog een poging… je pagina wordt gemaakt'
            : 'Je pagina wordt gemaakt… dit duurt even');
        const status = document.getElementById('agentChatStatus');
        if (status) { status.textContent = 'Even geduld, de pagina wordt gebouwd…'; status.className = 'agent-status'; }
        const sendBtn = document.getElementById('agentChatSend');
        if (sendBtn) sendBtn.disabled = true;
        try {
            const r = await apiWithRetry('/api/agent/build-page', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan: agentPendingPlan })
            }, AGENT_BUILD_TIMEOUT_MS, attempt > 0 ? 0 : 1);
            const d = await r.json().catch(() => ({}));
            if (!r.ok) {
                if (status) { status.textContent = formatAgentError(d, 'Pagina maken mislukt'); status.className = 'agent-status fail'; }
                return;
            }
            const result = (d.results && d.results[0] && d.results[0].result) || {};
            const page = result.page;
            const url = result.url || (page && page.slug ? '/p/' + page.slug : '');
            const msg = 'Klaar! Je pagina staat live.' + (url ? ' Bekijk hem via de link hieronder.' : '');
            agentChatMessages.push({ role: 'assistant', content: msg });
            appendChatBubble('assistant', msg);
            if (url) {
                const thread = document.getElementById('agentChatThread');
                const linkDiv = document.createElement('div');
                linkDiv.className = 'agent-step agent-action-ok';
                linkDiv.innerHTML = '<a href="' + escapeHtml(url) + '" target="_blank">Bekijk pagina ↗</a> · <button type="button" class="agent-suggestion agent-inline-suggestion" data-text="Nog iets aanpassen">Nog iets aanpassen?</button>';
                thread.appendChild(linkDiv);
                linkDiv.querySelector('.agent-inline-suggestion').addEventListener('click', (e) => {
                    const input = document.getElementById('agentChatInput');
                    if (input) { input.value = e.target.getAttribute('data-text') || 'Nog iets aanpassen'; input.focus(); }
                });
                thread.scrollTop = thread.scrollHeight;
            }
            agentPendingPlan = null;
            saveAgentHistory();
            renderAgentSuggestions(['Nog iets aanpassen', 'Ik wil een andere pagina', 'Voeg een sectie toe over montage'], false);
            if (status) { status.textContent = 'Pagina aangemaakt.'; status.className = 'agent-status ok'; }
            loadPages();
        } catch (e) {
            if (e && e.code === 'TIMEOUT' && attempt < 1) {
                agentChatBusy = false;
                if (sendBtn) sendBtn.disabled = false;
                return buildPageFromPlan(1);
            }
            if (status) {
                status.textContent = (e && e.code === 'TIMEOUT')
                    ? 'Het bouwen duurde te lang. Probeer opnieuw via "Maak de pagina".'
                    : 'Verbinding mislukt. Probeer het opnieuw.';
                status.className = 'agent-status fail';
            }
        }
        agentChatBusy = false;
        if (sendBtn) sendBtn.disabled = false;
        setAgentLoading(null);
    }

    async function loadAgent() {
        try {
            const r = await api('/api/settings');
            const s = await r.json();
            aiConfigured = !!(s.ai && s.ai.apiKey && String(s.ai.apiKey).trim());
        } catch (e) { /* */ }
        document.getElementById('agentNotConfigured').hidden = aiConfigured;
        document.getElementById('agentConfigured').hidden = !aiConfigured;
        loadAgentHistory();
        if (aiConfigured) {
            if (!agentChatMessages.length) renderAgentSuggestions(null, false);
            setAgentModeBadge(null);
            consumeAgentPrefill();
        }
        updateAgentWelcome();
    }

    function consumeAgentPrefill() {
        let text = '';
        try {
            text = sessionStorage.getItem(AGENT_PREFILL_KEY) || '';
            if (text) sessionStorage.removeItem(AGENT_PREFILL_KEY);
        } catch (e) {}
        if (!text) return;
        const input = document.getElementById('agentChatInput');
        if (input) { input.value = text; input.focus(); }
    }

    function appendChatBubble(role, text, plan, meta) {
        const thread = document.getElementById('agentChatThread');
        if (!thread) return;
        updateAgentWelcome();
        const m = meta || {};
        const div = document.createElement('div');
        div.className = 'agent-step agent-chat-' + role;
        if (role === 'user') {
            div.innerHTML = '<div class="agent-step-a">' + escapeHtml(text) + '</div>';
        } else {
            let inner = '<div class="agent-step-q">Assistent</div><div class="agent-step-a agent-step-rich">' + formatAgentReplyHtml(text) + '</div>';
            if (m.choices && m.choices.length) inner += renderMessageChoicesHtml(m.choices, !!m.choicesMultiple);
            if (plan) inner += formatAgentPlanHtml(plan);
            div.innerHTML = inner;
            if (m.choices && m.choices.length) bindMessageChoices(div, !!m.choicesMultiple);
            if (plan) bindPlanBuildButtons(div);
        }
        thread.appendChild(div);
        thread.scrollTop = thread.scrollHeight;
    }

    function renderMessageChoicesHtml(choices, multiple) {
        const list = (choices || []).filter(c => c && c.label);
        if (!list.length) return '';
        let html = '<div class="agent-choices' + (multiple ? ' agent-choices-multi' : '') + '">';
        html += '<div class="agent-choices-label">' + (multiple ? 'Kies één of meer opties' : 'Kies een optie') + '</div>';
        html += '<div class="agent-choices-list">';
        list.forEach(c => {
            const val = c.value != null ? c.value : c.label;
            if (multiple) {
                html += '<label class="agent-choice agent-choice-check"><input type="checkbox" data-value="' + escapeHtml(val) + '" data-label="' + escapeHtml(c.label) + '"/><span>' + escapeHtml(c.label) + '</span></label>';
            } else {
                html += '<button type="button" class="agent-choice" data-value="' + escapeHtml(val) + '" data-label="' + escapeHtml(c.label) + '">' + escapeHtml(c.label) + '</button>';
            }
        });
        html += '</div>';
        if (multiple) {
            html += '<button type="button" class="btn-primary small agent-choices-confirm" disabled>Bevestig keuze</button>';
        }
        html += '</div>';
        return html;
    }

    function bindMessageChoices(container, multiple) {
        if (!container) return;
        const input = document.getElementById('agentChatInput');
        const box = container.querySelector('.agent-choices');
        if (!box) return;

        if (multiple) {
            const confirm = box.querySelector('.agent-choices-confirm');
            const checkboxes = box.querySelectorAll('.agent-choice-check input[type="checkbox"]');
            const syncConfirm = () => {
                if (confirm) confirm.disabled = !Array.from(checkboxes).some(cb => cb.checked);
            };
            checkboxes.forEach(cb => cb.addEventListener('change', syncConfirm));
            if (confirm) {
                confirm.addEventListener('click', () => {
                    if (agentChatBusy) return;
                    const picked = Array.from(checkboxes).filter(cb => cb.checked);
                    if (!picked.length) return;
                    const parts = picked.map(cb => cb.getAttribute('data-value') || cb.getAttribute('data-label') || '');
                    submitAgentChoice(parts.join('; '), true);
                });
            }
            return;
        }

        box.querySelectorAll('.agent-choice').forEach(btn => {
            btn.addEventListener('click', () => {
                if (agentChatBusy) return;
                const val = btn.getAttribute('data-value') || '';
                if (val === '__custom__') {
                    if (input) {
                        input.placeholder = 'Typ je eigen antwoord…';
                        input.focus();
                    }
                    return;
                }
                submitAgentChoice(val, true);
            });
        });
    }

    function disableStaleChoices() {
        const thread = document.getElementById('agentChatThread');
        if (!thread) return;
        thread.querySelectorAll('.agent-choice, .agent-choices-confirm').forEach(el => {
            el.disabled = true;
            el.classList.add('agent-choice-used');
        });
        thread.querySelectorAll('.agent-choice-check input').forEach(el => { el.disabled = true; });
    }

    function submitAgentChoice(text, fromChoice) {
        const input = document.getElementById('agentChatInput');
        if (!text || agentChatBusy) return;
        if (input) input.value = text;
        sendAgentChat(!!fromChoice);
    }

    function formatAgentReplyHtml(text) {
        const lines = String(text || '').split('\n');
        let html = '';
        let inList = false;
        lines.forEach(line => {
            const trimmed = line.trim();
            const numbered = trimmed.match(/^(\d+)[.)]\s+(.+)/);
            if (numbered) {
                if (!inList) { html += '<ol class="agent-reply-list">'; inList = true; }
                html += '<li>' + escapeHtml(numbered[2]) + '</li>';
            } else {
                if (inList) { html += '</ol>'; inList = false; }
                if (trimmed) html += '<p>' + escapeHtml(trimmed) + '</p>';
            }
        });
        if (inList) html += '</ol>';
        return html || escapeHtml(text);
    }

    async function sendAgentChat(fromChoice, retryAttempt) {
        if (agentChatBusy) return;
        const input = document.getElementById('agentChatInput');
        const status = document.getElementById('agentChatStatus');
        const sendBtn = document.getElementById('agentChatSend');
        const text = (input && input.value || '').trim();
        if (!text) return;

        if (agentPendingPlan && userWantsBuild(text)) {
            input.value = '';
            agentChatMessages.push({ role: 'user', content: text });
            appendChatBubble('user', text);
            saveAgentHistory();
            await buildPageFromPlan();
            return;
        }

        agentChatMessages.push({ role: 'user', content: text });
        appendChatBubble('user', text);
        disableStaleChoices();
        input.value = '';
        if (input) input.placeholder = 'Bijv.: Ik wil een pagina over onderhoud van binnendeuren…';
        saveAgentHistory();
        agentChatBusy = true;
        if (sendBtn) sendBtn.disabled = true;
        const attempt = typeof retryAttempt === 'number' ? retryAttempt : 0;
        setAgentLoading(attempt > 0 ? 'Nog een poging… even geduld' : 'Even geduld, de assistent denkt na…');
        if (status) { status.textContent = 'Even geduld, de assistent denkt na…'; status.className = 'agent-status'; }
        try {
            const r = await apiWithRetry('/api/agent/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: agentChatMessages, history: agentChatMessages })
            }, AGENT_CHAT_TIMEOUT_MS, attempt > 0 ? 0 : 1);
            const d = await r.json().catch(() => ({}));
            if (!r.ok) {
                if (d.code === 'BAD_JSON' && attempt < 1) {
                    agentChatBusy = false;
                    if (sendBtn) sendBtn.disabled = false;
                    return sendAgentChat(fromChoice, 1);
                }
                if (d.code === 'NO_KEY') { aiConfigured = false; loadAgent(); }
                if (status) { status.textContent = formatAgentError(d, 'Opdracht mislukt'); status.className = 'agent-status fail'; }
                return;
            }
            const reply = d.reply || 'Klaar.';
            const planForBubble = (d.mode === 'voorstel' && d.plan) ? d.plan : null;
            if (planForBubble) agentPendingPlan = planForBubble;
            else if (d.mode === 'begrip') agentPendingPlan = null;
            const choiceMeta = {
                choices: d.choices || [],
                choicesMultiple: !!d.choicesMultiple
            };
            agentChatMessages.push({
                role: 'assistant',
                content: reply,
                plan: planForBubble,
                choices: choiceMeta.choices,
                choicesMultiple: choiceMeta.choicesMultiple
            });
            appendChatBubble('assistant', reply, planForBubble, choiceMeta);
            setAgentModeBadge(d.mode || null);
            saveAgentHistory();
            if (d.suggestions && d.suggestions.length) {
                renderAgentSuggestions(d.suggestions, true);
            } else if (d.mode === 'begrip') {
                renderAgentSuggestions(null, true);
            } else if (d.mode === 'voorstel') {
                renderAgentSuggestions(['Ziet er goed uit, maak de pagina', 'Nog iets aanpassen', 'Andere afbeelding voor de hero'], true);
            }
            if (status && d.mode === 'begrip') {
                status.textContent = choiceMeta.choices.length
                    ? 'Klik een optie of typ je antwoord.'
                    : 'Beantwoord de vragen om verder te verfijnen.';
                status.className = 'agent-status';
            } else if (status && d.mode === 'voorstel') {
                status.textContent = 'Controleer het voorbeeld en klik op Maak de pagina als je tevreden bent.';
                status.className = 'agent-status';
            } else if (status) {
                status.textContent = '';
            }
        } catch (e) {
            if (e && e.code === 'TIMEOUT' && attempt < 1) {
                agentChatBusy = false;
                if (sendBtn) sendBtn.disabled = false;
                return sendAgentChat(fromChoice, 1);
            }
            if (status) {
                status.textContent = (e && e.code === 'TIMEOUT')
                    ? 'Het duurde te lang. Probeer het nog eens.'
                    : 'Verbinding mislukt. Controleer je internet.';
                status.className = 'agent-status fail';
            }
        }
        agentChatBusy = false;
        if (sendBtn) sendBtn.disabled = false;
        setAgentLoading(null);
    }

    (function bindSiteAgent() {
        const form = document.getElementById('agentChatForm');
        if (form) form.addEventListener('submit', (e) => { e.preventDefault(); sendAgentChat(); });
        const reset = document.getElementById('agentChatReset');
        if (reset) reset.addEventListener('click', () => {
            agentChatMessages = [];
            agentPendingPlan = null;
            try { sessionStorage.removeItem(AGENT_STORAGE_KEY); } catch (e) {}
            const thread = document.getElementById('agentChatThread');
            if (thread) thread.innerHTML = '';
            const status = document.getElementById('agentChatStatus');
            if (status) { status.textContent = ''; status.className = 'agent-status'; }
            setAgentModeBadge(null);
            renderAgentSuggestions(null, false);
            updateAgentWelcome();
        });
    })();

    // ------------------------------------------------------------------ Start
    checkAuth();
})();
