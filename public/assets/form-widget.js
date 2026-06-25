/**
 * DeurMeester formulier-widget — rendert en verstuurt custom forms.
 */
(function () {
    'use strict';

    function esc(s) {
        const d = document.createElement('div');
        d.textContent = s == null ? '' : String(s);
        return d.innerHTML;
    }

    function fieldHtml(field) {
        const id = 'dmf-' + field.id;
        const req = field.required ? ' <span class="req">*</span>' : '';
        if (field.type === 'heading') {
            return '<h2 class="dm-form-heading">' + esc(field.label) + '</h2>';
        }
        if (field.type === 'paragraph') {
            return '<p class="dm-form-paragraph">' + esc(field.label) + '</p>';
        }
        let inner = '';
        const ph = field.placeholder ? ' placeholder="' + esc(field.placeholder) + '"' : '';
        if (field.type === 'textarea') {
            inner = '<textarea id="' + id + '" name="' + esc(field.id) + '"' + ph + (field.required ? ' required' : '') + '></textarea>';
        } else if (field.type === 'select') {
            const opts = (field.options || []).map(o =>
                '<option value="' + esc(o) + '">' + esc(o) + '</option>'
            ).join('');
            inner = '<select id="' + id + '" name="' + esc(field.id) + '"' + (field.required ? ' required' : '') + '>' +
                '<option value="">Kies…</option>' + opts + '</select>';
        } else if (field.type === 'radio') {
            const opts = (field.options || []).map((o, i) =>
                '<label class="dm-radio-opt"><input type="radio" name="' + esc(field.id) + '" value="' + esc(o) + '"' +
                (field.required && i === 0 ? ' required' : '') + '/> ' + esc(o) + '</label>'
            ).join('');
            inner = '<div class="dm-radio-group" role="radiogroup">' + opts + '</div>';
        } else if (field.type === 'checkbox') {
            return '<div class="dm-form-field" data-field="' + esc(field.id) + '">' +
                '<label class="dm-checkbox-wrap">' +
                '<input type="checkbox" id="' + id + '" name="' + esc(field.id) + '"' + (field.required ? ' required' : '') + '/>' +
                '<span>' + esc(field.label) + req + '</span></label>' +
                '<div class="dm-field-error" hidden></div></div>';
        } else {
            const type = ['email', 'tel', 'number', 'date'].indexOf(field.type) >= 0 ? field.type : 'text';
            inner = '<input type="' + type + '" id="' + id + '" name="' + esc(field.id) + '"' + ph + (field.required ? ' required' : '') + '/>';
        }
        return '<div class="dm-form-field" data-field="' + esc(field.id) + '">' +
            '<label class="dm-label" for="' + id + '">' + esc(field.label) + req + '</label>' +
            inner +
            '<div class="dm-field-error" hidden></div></div>';
    }

    function renderForm(el, form) {
        el.innerHTML = '<div class="dm-form-card"><form class="dm-form-body" novalidate>' +
            (form.fields || []).map(fieldHtml).join('') +
            '<div class="dm-form-actions"><button type="submit" class="dm-form-submit">' + esc(form.submitLabel || 'Versturen') + '</button></div>' +
            '</form></div>';
        const formEl = el.querySelector('form');
        formEl.addEventListener('submit', function (e) {
            e.preventDefault();
            submitForm(el, form, formEl);
        });
    }

    function showSuccess(el, message) {
        el.innerHTML = '<div class="dm-form-card"><div class="dm-form-success">' +
            '<div class="check">✓</div>' +
            '<h3>Verzonden</h3>' +
            '<p>' + esc(message) + '</p></div></div>';
    }

    function collectData(formEl) {
        const data = {};
        formEl.querySelectorAll('input, select, textarea').forEach(inp => {
            if (!inp.name) return;
            if (inp.type === 'checkbox') data[inp.name] = inp.checked;
            else if (inp.type === 'radio') { if (inp.checked) data[inp.name] = inp.value; }
            else data[inp.name] = inp.value;
        });
        return data;
    }

    function showErrors(formEl, errors) {
        formEl.querySelectorAll('.dm-form-field').forEach(wrap => {
            const fid = wrap.getAttribute('data-field');
            const errEl = wrap.querySelector('.dm-field-error');
            if (!fid || !errEl) return;
            if (errors[fid]) {
                wrap.classList.add('has-error');
                errEl.textContent = errors[fid];
                errEl.hidden = false;
            } else {
                wrap.classList.remove('has-error');
                errEl.hidden = true;
            }
        });
    }

    async function submitForm(container, form, formEl) {
        const btn = formEl.querySelector('.dm-form-submit');
        if (btn) { btn.disabled = true; btn.textContent = 'Bezig…'; }
        const data = collectData(formEl);
        try {
            const r = await fetch('/api/forms/' + encodeURIComponent(form.slug) + '/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const d = await r.json().catch(() => ({}));
            if (r.ok && d.ok) {
                showSuccess(container, d.message || form.successMessage || 'Bedankt!');
                return;
            }
            if (d.errors) showErrors(formEl, d.errors);
            else alert(d.error || 'Verzenden mislukt. Probeer het opnieuw.');
        } catch (e) {
            alert('Geen verbinding met de server.');
        }
        if (btn) { btn.disabled = false; btn.textContent = form.submitLabel || 'Versturen'; }
    }

    async function loadAndRender(el) {
        const slug = el.getAttribute('data-dm-form') || el.dataset.dmForm;
        if (!slug) return;
        el.innerHTML = '<div class="dm-form-card"><div class="dm-form-loading">Formulier laden…</div></div>';
        try {
            const r = await fetch('/api/forms/public/' + encodeURIComponent(slug));
            if (!r.ok) throw new Error('not found');
            const form = await r.json();
            renderForm(el, form);
        } catch (e) {
            el.innerHTML = '<div class="dm-form-card"><div class="dm-form-loading">Formulier niet beschikbaar.</div></div>';
        }
    }

    function initAll() {
        document.querySelectorAll('[data-dm-form]').forEach(loadAndRender);
    }

    window.ILForm = { initAll, renderForm, loadAndRender };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
    else initAll();
})();
