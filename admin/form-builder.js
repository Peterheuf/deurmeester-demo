/**
 * DeurMeester Formulierbuilder — admin UI
 */
(function () {
    'use strict';

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

    const INPUT_TYPES = ['text', 'email', 'tel', 'textarea', 'select', 'radio', 'checkbox', 'number', 'date'];

    const TEMPLATES = {
        contact: {
            name: 'Contactformulier', slug: 'contact', submitLabel: 'Versturen',
            successMessage: 'Bedankt! We nemen zo snel mogelijk contact met je op.',
            notifyEmail: 'info@deurmeester.nl',
            fields: [
                { id: 'f1', type: 'heading', label: 'Neem contact op' },
                { id: 'f2', type: 'text', label: 'Naam', required: true, placeholder: 'Je volledige naam' },
                { id: 'f3', type: 'email', label: 'E-mail', required: true },
                { id: 'f4', type: 'tel', label: 'Telefoon' },
                { id: 'f5', type: 'select', label: 'Onderwerp', options: ['Offerte', 'Vraag', 'Anders'], required: true },
                { id: 'f6', type: 'textarea', label: 'Bericht', required: true },
                { id: 'f7', type: 'checkbox', label: 'Ik ga akkoord met de privacyverklaring', required: true }
            ]
        },
        offerte: {
            name: 'Offerte aanvraag', slug: 'offerte', submitLabel: 'Offerte aanvragen',
            successMessage: 'Bedankt! We sturen binnen 48 uur een vrijblijvende offerte.',
            notifyEmail: 'info@deurmeester.nl',
            fields: [
                { id: 'f1', type: 'heading', label: 'Vraag een offerte aan' },
                { id: 'f2', type: 'paragraph', label: 'Vertel kort wat je zoekt.' },
                { id: 'f3', type: 'text', label: 'Naam', required: true },
                { id: 'f4', type: 'email', label: 'E-mail', required: true },
                { id: 'f5', type: 'tel', label: 'Telefoon', required: true },
                { id: 'f6', type: 'select', label: 'Type deur', options: ['Taatsdeur', 'Schuifdeur', 'Draaideur'], required: true },
                { id: 'f7', type: 'textarea', label: 'Wensen' }
            ]
        },
        showroom: {
            name: 'Showroom afspraak', slug: 'showroom', submitLabel: 'Afspraak aanvragen',
            successMessage: 'Bedankt! We bevestigen je showroombezoek per e-mail.',
            notifyEmail: 'info@deurmeester.nl',
            fields: [
                { id: 'f1', type: 'heading', label: 'Plan een showroombezoek' },
                { id: 'f2', type: 'text', label: 'Naam', required: true },
                { id: 'f3', type: 'email', label: 'E-mail', required: true },
                { id: 'f4', type: 'tel', label: 'Telefoon', required: true },
                { id: 'f5', type: 'date', label: 'Gewenste datum', required: true },
                { id: 'f6', type: 'select', label: 'Voorkeurstijd', options: ['Ochtend', 'Middag', 'Geen voorkeur'], required: true }
            ]
        }
    };

    let formsList = [];
    let currentForm = null;
    let selectedFieldId = null;

    function esc(s) {
        const d = document.createElement('div');
        d.textContent = s == null ? '' : String(s);
        return d.innerHTML;
    }

    function toast(msg, type) {
        const t = document.getElementById('toast');
        if (!t) return;
        t.textContent = msg;
        t.className = 'toast ' + (type || 'success') + ' show';
        clearTimeout(t._fb);
        t._fb = setTimeout(() => { t.className = 'toast ' + (type || 'success'); }, 2600);
    }

    async function api(url, opts) {
        const r = await fetch(url, Object.assign({ credentials: 'same-origin' }, opts || {}));
        if (r.status === 401) { location.reload(); throw new Error('unauth'); }
        return r;
    }

    function formatDate(iso) {
        try {
            return new Date(iso).toLocaleString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch (e) { return iso || ''; }
    }

    function newFieldId() {
        return 'f' + Date.now().toString(36) + Math.round(Math.random() * 1e3);
    }

    function defaultField(type) {
        const base = { id: newFieldId(), type: type, label: '', required: false };
        const map = {
            text: { label: 'Tekstveld', placeholder: '' },
            email: { label: 'E-mail', placeholder: 'naam@voorbeeld.nl' },
            tel: { label: 'Telefoon', placeholder: '+31 6 ...' },
            textarea: { label: 'Bericht', placeholder: '' },
            select: { label: 'Keuze', options: ['Optie 1', 'Optie 2'] },
            radio: { label: 'Keuze', options: ['Optie A', 'Optie B'] },
            checkbox: { label: 'Ik ga akkoord', required: true },
            number: { label: 'Aantal', placeholder: '' },
            date: { label: 'Datum' },
            heading: { label: 'Sectietitel' },
            paragraph: { label: 'Voeg hier een toelichting toe.' }
        };
        return Object.assign(base, map[type] || {});
    }

    // ------------------------------------------------------------------ List
    async function loadList() {
        try {
            const r = await api('/api/forms');
            formsList = await r.json();
            renderList();
        } catch (e) {
            if (e.message !== 'unauth') toast('Kon formulieren niet laden', 'error');
        }
    }

    function renderList() {
        const cards = document.getElementById('fbCards');
        const empty = document.getElementById('fbEmpty');
        if (!cards) return;
        if (!formsList.length) {
            cards.innerHTML = '';
            if (empty) empty.hidden = false;
            return;
        }
        if (empty) empty.hidden = true;
        cards.innerHTML = formsList.map(f => {
            const pub = f.status === 'gepubliceerd';
            return '<article class="fb-card" data-id="' + esc(f.id) + '">' +
                '<div class="fb-card-main">' +
                    '<h3>' + esc(f.name) + '</h3>' +
                    '<p class="fb-card-slug">/f/' + esc(f.slug) + '</p>' +
                '</div>' +
                '<div class="fb-card-stats">' +
                    '<span class="status-pill ' + (pub ? 'status-behandeld' : 'status-nieuw') + '">' + (pub ? 'gepubliceerd' : 'concept') + '</span>' +
                    '<span class="fb-card-count">' + (f.submissionCount || 0) + ' inzendingen</span>' +
                '</div>' +
                '<div class="fb-card-actions">' +
                    (pub ? '<a class="mini-btn" href="/f/' + encodeURIComponent(f.slug) + '" target="_blank">Bekijken</a>' : '') +
                    '<button class="mini-btn" data-act="edit">Bewerken</button>' +
                    '<button class="mini-btn danger" data-act="delete">Verwijderen</button>' +
                '</div></article>';
        }).join('');
    }

    function showList() {
        document.getElementById('fbListView').hidden = false;
        document.getElementById('fbEditorView').hidden = true;
        currentForm = null;
        selectedFieldId = null;
    }

    function showEditor() {
        document.getElementById('fbListView').hidden = true;
        document.getElementById('fbEditorView').hidden = false;
        syncFormSettings();
        renderPreview();
        renderInspector();
        renderSubmissions();
        updatePreviewLink();
    }

    // ------------------------------------------------------------------ Editor
    function openNew(templateKey) {
        const tpl = templateKey ? TEMPLATES[templateKey] : null;
        currentForm = {
            id: null,
            name: tpl ? tpl.name : 'Nieuw formulier',
            slug: tpl ? tpl.slug : 'nieuw-formulier',
            status: 'concept',
            fields: tpl ? tpl.fields.map(f => Object.assign({}, f, { id: newFieldId() })) : [
                defaultField('heading'),
                defaultField('text'),
                defaultField('email')
            ],
            submitLabel: tpl ? tpl.submitLabel : 'Versturen',
            successMessage: tpl ? tpl.successMessage : 'Bedankt!',
            notifyEmail: tpl ? tpl.notifyEmail : 'info@deurmeester.nl',
            submissions: []
        };
        selectedFieldId = currentForm.fields[0] ? currentForm.fields[0].id : null;
        showEditor();
        switchTab('builder');
    }

    async function openEdit(id) {
        try {
            const r = await api('/api/forms/' + encodeURIComponent(id));
            if (!r.ok) throw new Error('load');
            currentForm = await r.json();
            if (!currentForm.submissions) currentForm.submissions = [];
            selectedFieldId = currentForm.fields[0] ? currentForm.fields[0].id : null;
            showEditor();
            switchTab('builder');
        } catch (e) {
            toast('Kon formulier niet laden', 'error');
        }
    }

    function syncFormSettings() {
        if (!currentForm) return;
        document.getElementById('fbName').value = currentForm.name || '';
        document.getElementById('fbSlug').value = currentForm.slug || '';
        document.getElementById('fbSubmitLabel').value = currentForm.submitLabel || 'Versturen';
        document.getElementById('fbStatus').value = currentForm.status || 'concept';
        document.getElementById('fbSuccess').value = currentForm.successMessage || '';
        document.getElementById('fbNotify').value = currentForm.notifyEmail || '';
        const cnt = document.getElementById('fbSubCount');
        if (cnt) cnt.textContent = (currentForm.submissions || []).length;
        const exp = document.getElementById('fbExportCsv');
        if (exp && currentForm.id) exp.href = '/api/forms/' + encodeURIComponent(currentForm.id) + '/submissions/export.csv';
    }

    function readFormSettings() {
        if (!currentForm) return;
        currentForm.name = document.getElementById('fbName').value.trim();
        currentForm.slug = document.getElementById('fbSlug').value.trim();
        currentForm.submitLabel = document.getElementById('fbSubmitLabel').value.trim() || 'Versturen';
        currentForm.status = document.getElementById('fbStatus').value;
        currentForm.successMessage = document.getElementById('fbSuccess').value.trim();
        currentForm.notifyEmail = document.getElementById('fbNotify').value.trim();
    }

    function updatePreviewLink() {
        const link = document.getElementById('fbPreviewLink');
        if (!link || !currentForm) return;
        if (currentForm.status === 'gepubliceerd' && currentForm.slug) {
            link.href = '/f/' + encodeURIComponent(currentForm.slug);
            link.hidden = false;
        } else link.hidden = true;
    }

    function previewFieldHtml(field, idx) {
        const sel = field.id === selectedFieldId ? ' fb-preview-field selected' : ' fb-preview-field';
        const req = field.required ? ' <span class="req">*</span>' : '';
        let inner = '';
        if (field.type === 'heading') {
            inner = '<h2 class="dm-form-heading">' + esc(field.label) + '</h2>';
        } else if (field.type === 'paragraph') {
            inner = '<p class="dm-form-paragraph">' + esc(field.label) + '</p>';
        } else if (field.type === 'checkbox') {
            inner = '<label class="dm-checkbox-wrap"><input type="checkbox" disabled/><span>' + esc(field.label) + req + '</span></label>';
        } else if (field.type === 'radio') {
            inner = '<div class="dm-radio-group">' + (field.options || []).map(o =>
                '<label class="dm-radio-opt"><input type="radio" disabled name="p' + idx + '"/> ' + esc(o) + '</label>'
            ).join('') + '</div>';
        } else if (field.type === 'select') {
            inner = '<select disabled><option>Kies…</option>' + (field.options || []).map(o => '<option>' + esc(o) + '</option>').join('') + '</select>';
        } else if (field.type === 'textarea') {
            inner = '<textarea disabled placeholder="' + esc(field.placeholder || '') + '"></textarea>';
        } else {
            const t = ['email', 'tel', 'number', 'date'].indexOf(field.type) >= 0 ? field.type : 'text';
            inner = '<input type="' + t + '" disabled placeholder="' + esc(field.placeholder || '') + '"/>';
        }
        const labelBlock = (field.type === 'heading' || field.type === 'paragraph' || field.type === 'checkbox')
            ? '' : '<label class="dm-label">' + esc(field.label) + req + '</label>';
        return '<div class="' + sel.trim() + '" data-fid="' + esc(field.id) + '" draggable="true">' +
            labelBlock + inner + '</div>';
    }

    function renderPreview() {
        const el = document.getElementById('fbPreview');
        if (!el || !currentForm) return;
        const fields = currentForm.fields || [];
        el.innerHTML = '<link rel="stylesheet" href="/assets/form-widget.css"/>' +
            '<div class="dm-form-card"><div class="dm-form-body">' +
            fields.map((f, i) => previewFieldHtml(f, i)).join('') +
            '<div class="dm-form-actions"><button type="button" class="dm-form-submit" disabled>' +
            esc(currentForm.submitLabel || 'Versturen') + '</button></div></div></div>';
        el.querySelectorAll('.fb-preview-field').forEach(node => {
            node.addEventListener('click', () => {
                selectedFieldId = node.getAttribute('data-fid');
                renderPreview();
                renderInspector();
            });
            node.addEventListener('dragstart', onDragStart);
            node.addEventListener('dragover', onDragOver);
            node.addEventListener('drop', onDrop);
        });
    }

    let dragFid = null;
    function onDragStart(e) {
        dragFid = e.currentTarget.getAttribute('data-fid');
        e.dataTransfer.effectAllowed = 'move';
    }
    function onDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }
    function onDrop(e) {
        e.preventDefault();
        const targetFid = e.currentTarget.getAttribute('data-fid');
        if (!dragFid || !targetFid || dragFid === targetFid || !currentForm) return;
        const fields = currentForm.fields;
        const from = fields.findIndex(f => f.id === dragFid);
        const to = fields.findIndex(f => f.id === targetFid);
        if (from < 0 || to < 0) return;
        const item = fields.splice(from, 1)[0];
        fields.splice(to, 0, item);
        dragFid = null;
        renderPreview();
        renderInspector();
    }

    function renderInspector() {
        const empty = document.getElementById('fbInspectorEmpty');
        const panel = document.getElementById('fbInspector');
        const field = currentForm && selectedFieldId
            ? currentForm.fields.find(f => f.id === selectedFieldId) : null;
        if (!field) {
            if (empty) empty.hidden = false;
            if (panel) panel.hidden = true;
            return;
        }
        if (empty) empty.hidden = true;
        if (panel) panel.hidden = false;
        document.getElementById('fbInspectorTitle').textContent =
            PALETTE.find(p => p.type === field.type)?.label || 'Veld';
        document.getElementById('fbFieldLabel').value = field.label || '';
        const phWrap = document.getElementById('fbPhLabel');
        const phInput = document.getElementById('fbFieldPlaceholder');
        const showPh = ['text', 'email', 'tel', 'textarea', 'number'].indexOf(field.type) >= 0;
        phWrap.hidden = !showPh;
        phInput.hidden = !showPh;
        if (showPh) phInput.value = field.placeholder || '';
        const reqWrap = document.querySelector('.fb-req-switch');
        if (reqWrap) reqWrap.hidden = !INPUT_TYPES.includes(field.type) || field.type === 'heading' || field.type === 'paragraph';
        document.getElementById('fbFieldRequired').checked = !!field.required;
        const optWrap = document.getElementById('fbOptionsWrap');
        const showOpt = field.type === 'select' || field.type === 'radio';
        if (optWrap) optWrap.hidden = !showOpt;
        if (showOpt) document.getElementById('fbFieldOptions').value = (field.options || []).join('\n');
    }

    function applyInspector() {
        const field = currentForm && selectedFieldId
            ? currentForm.fields.find(f => f.id === selectedFieldId) : null;
        if (!field) return;
        field.label = document.getElementById('fbFieldLabel').value;
        if (field.placeholder != null || ['text', 'email', 'tel', 'textarea', 'number'].indexOf(field.type) >= 0) {
            field.placeholder = document.getElementById('fbFieldPlaceholder').value;
        }
        field.required = document.getElementById('fbFieldRequired').checked;
        if (field.type === 'select' || field.type === 'radio') {
            field.options = document.getElementById('fbFieldOptions').value.split('\n').map(s => s.trim()).filter(Boolean);
        }
        renderPreview();
    }

    function moveField(dir) {
        if (!currentForm || !selectedFieldId) return;
        const fields = currentForm.fields;
        const idx = fields.findIndex(f => f.id === selectedFieldId);
        const ni = idx + dir;
        if (idx < 0 || ni < 0 || ni >= fields.length) return;
        const tmp = fields[idx];
        fields[idx] = fields[ni];
        fields[ni] = tmp;
        renderPreview();
    }

    function deleteField() {
        if (!currentForm || !selectedFieldId) return;
        if (!confirm('Dit veld verwijderen?')) return;
        currentForm.fields = currentForm.fields.filter(f => f.id !== selectedFieldId);
        selectedFieldId = currentForm.fields[0] ? currentForm.fields[0].id : null;
        renderPreview();
        renderInspector();
    }

    function addField(type) {
        if (!currentForm) return;
        const f = defaultField(type);
        currentForm.fields.push(f);
        selectedFieldId = f.id;
        renderPreview();
        renderInspector();
    }

    async function saveForm(publish) {
        if (!currentForm) return;
        readFormSettings();
        if (publish) currentForm.status = 'gepubliceerd';
        if (!currentForm.name) { toast('Naam is verplicht', 'error'); return; }
        const payload = {
            name: currentForm.name,
            slug: currentForm.slug,
            status: currentForm.status,
            fields: currentForm.fields,
            submitLabel: currentForm.submitLabel,
            successMessage: currentForm.successMessage,
            notifyEmail: currentForm.notifyEmail
        };
        try {
            let r;
            if (currentForm.id) {
                r = await api('/api/forms/' + encodeURIComponent(currentForm.id), {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                r = await api('/api/forms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }
            const d = await r.json().catch(() => ({}));
            if (!r.ok) { toast(d.error || 'Opslaan mislukt', 'error'); return; }
            currentForm = d.form;
            document.getElementById('fbStatus').value = currentForm.status;
            updatePreviewLink();
            syncFormSettings();
            await loadList();
            toast(publish ? 'Formulier gepubliceerd' : 'Formulier opgeslagen');
        } catch (e) {
            toast('Opslaan mislukt', 'error');
        }
    }

    function switchTab(tab) {
        document.querySelectorAll('.fb-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        document.getElementById('fbTabBuilder').hidden = tab !== 'builder';
        document.getElementById('fbTabSubmissions').hidden = tab !== 'submissions';
        if (tab === 'submissions') renderSubmissions();
    }

    function renderSubmissions() {
        const list = document.getElementById('fbSubmissionsList');
        const empty = document.getElementById('fbSubmissionsEmpty');
        if (!list || !currentForm) return;
        const subs = currentForm.submissions || [];
        const fields = (currentForm.fields || []).filter(f => INPUT_TYPES.includes(f.type));
        if (!subs.length) {
            list.innerHTML = '';
            if (empty) empty.hidden = false;
            return;
        }
        if (empty) empty.hidden = true;
        list.innerHTML = subs.map(s => {
            const rows = fields.map(f =>
                '<div><span class="k">' + esc(f.label) + '</span><span class="v">' + esc((s.data && s.data[f.id]) || '—') + '</span></div>'
            ).join('');
            return '<div class="fb-sub-card">' +
                '<div class="fb-sub-head"><strong>' + esc(s.id) + '</strong><span>' + formatDate(s.createdAt) + '</span></div>' +
                '<div class="fb-sub-grid">' + rows + '</div></div>';
        }).join('');
    }

    function renderPalette() {
        const el = document.getElementById('fbPalette');
        if (!el) return;
        el.innerHTML = PALETTE.map(p =>
            '<button type="button" class="fb-palette-btn" data-type="' + esc(p.type) + '">' +
            '<span class="fb-palette-ico">' + esc(p.icon) + '</span>' + esc(p.label) + '</button>'
        ).join('');
    }

    function bindEvents() {
        document.getElementById('fbNewBtn')?.addEventListener('click', () => openNew(null));
        document.querySelectorAll('[data-tpl]').forEach(btn => {
            btn.addEventListener('click', () => openNew(btn.dataset.tpl));
        });
        document.getElementById('fbRefreshBtn')?.addEventListener('click', () => { loadList(); toast('Vernieuwd'); });
        document.getElementById('fbBackBtn')?.addEventListener('click', () => { showList(); loadList(); });
        document.getElementById('fbSaveBtn')?.addEventListener('click', () => saveForm(false));
        document.getElementById('fbPublishBtn')?.addEventListener('click', () => saveForm(true));

        document.getElementById('fbCards')?.addEventListener('click', async (e) => {
            const card = e.target.closest('.fb-card');
            if (!card) return;
            const id = card.dataset.id;
            const btn = e.target.closest('[data-act]');
            if (!btn) return;
            if (btn.dataset.act === 'edit') { openEdit(id); return; }
            if (btn.dataset.act === 'delete') {
                if (!confirm('Dit formulier definitief verwijderen?')) return;
                const r = await api('/api/forms/' + encodeURIComponent(id), { method: 'DELETE' });
                if (r.ok) { toast('Formulier verwijderd'); loadList(); }
                else toast('Verwijderen mislukt', 'error');
            }
        });

        document.getElementById('fbPalette')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-type]');
            if (btn) addField(btn.dataset.type);
        });

        ['fbName', 'fbSlug', 'fbSubmitLabel', 'fbSuccess'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => {
                readFormSettings();
                renderPreview();
                updatePreviewLink();
            });
        });
        document.getElementById('fbStatus')?.addEventListener('change', updatePreviewLink);

        ['fbFieldLabel', 'fbFieldPlaceholder', 'fbFieldRequired', 'fbFieldOptions'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', applyInspector);
            el.addEventListener('change', applyInspector);
        });

        document.getElementById('fbFieldUp')?.addEventListener('click', () => moveField(-1));
        document.getElementById('fbFieldDown')?.addEventListener('click', () => moveField(1));
        document.getElementById('fbFieldDelete')?.addEventListener('click', deleteField);

        document.querySelectorAll('.fb-tab').forEach(tab => {
            tab.addEventListener('click', () => switchTab(tab.dataset.tab));
        });
    }

    function onRouteEnter() {
        showList();
        loadList();
    }

    window.FormBuilder = { onRouteEnter, loadList };
    renderPalette();
    bindEvents();
})();
