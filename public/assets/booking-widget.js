/**
 * Deurconfigurator — herbruikbaar op homepage (hero) en losse pagina's.
 * Initialiseert elke [data-il-element="booking"] container.
 */
(function () {
    'use strict';

    const TOTAL = 6;

    function val(root, sel) {
        const el = root.querySelector(sel);
        return el ? String(el.value || '').trim() : '';
    }

    function selectedType(root) {
        const opt = root.querySelector('.type-option.selected');
        return opt ? (opt.dataset.type || '').trim() : '';
    }

    function selectedMontage(root) {
        const r = root.querySelector('.montage-options input[type="radio"]:checked');
        return r ? r.value : '';
    }

    function formatAfmetingen(root) {
        const std = val(root, '.bw-standaard');
        if (std && std !== 'Maatwerk (op maat)') return std;
        const w = val(root, '.bw-breedte');
        const h = val(root, '.bw-hoogte');
        if (w || h) return (w || '?') + ' × ' + (h || '?') + ' cm';
        return '';
    }

    function formatAfwerking(root) {
        const finish = val(root, '.bw-afwerking');
        const ral = val(root, '.bw-ral');
        if (finish === 'Custom RAL' && ral) return 'RAL ' + ral;
        return finish;
    }

    function buildLiveSummary(root) {
        const parts = [];
        const door = selectedType(root);
        if (door) parts.push(door);
        const mat = val(root, '.bw-materiaal');
        if (mat) parts.push(mat);
        const dim = formatAfmetingen(root);
        if (dim) parts.push(dim);
        const finish = formatAfwerking(root);
        if (finish) parts.push(finish);
        const montage = selectedMontage(root);
        if (montage) parts.push(montage);
        return parts.length
            ? parts.join(' · ')
            : 'Stel je deur samen — je keuzes verschijnen hier live.';
    }

    function updateLiveSummary(root) {
        const el = root.querySelector('.config-summary-text');
        if (el) el.textContent = buildLiveSummary(root);
    }

    function updateFinalSummary(root) {
        const set = (sel, text) => {
            const el = root.querySelector(sel);
            if (el) el.textContent = text || 'nog niet gekozen';
        };
        set('.sum-deurtype', selectedType(root));
        set('.sum-materiaal', val(root, '.bw-materiaal'));
        set('.sum-afmetingen', formatAfmetingen(root) || 'nog niet ingevuld');
        set('.sum-afwerking', formatAfwerking(root));
        set('.sum-montage', selectedMontage(root));
    }

    function toggleRalField(root) {
        const wrap = root.querySelector('.bw-ral-wrap');
        if (!wrap) return;
        wrap.hidden = val(root, '.bw-afwerking') !== 'Custom RAL';
    }

    function bindUpdates(root) {
        root.querySelectorAll('select, input[type="text"], input[type="number"], input[type="email"], input[type="tel"], textarea').forEach(el => {
            el.addEventListener('change', () => {
                if (el.classList.contains('bw-afwerking')) toggleRalField(root);
                updateLiveSummary(root);
            });
            el.addEventListener('input', () => updateLiveSummary(root));
        });
        root.querySelectorAll('.montage-options input[type="radio"]').forEach(el => {
            el.addEventListener('change', () => updateLiveSummary(root));
        });
    }

    function initWidget(root) {
        if (!root || root.dataset.bwInit) return;
        root.dataset.bwInit = '1';
        let step = 1;

        function setStep(n) {
            step = n;
            root.querySelectorAll('.booking-pane').forEach(p => p.classList.remove('active'));
            const pane = root.querySelector('.booking-pane[data-pane="' + n + '"]');
            if (pane) pane.classList.add('active');
            root.querySelectorAll('.booking-step').forEach(s => {
                const sn = parseInt(s.dataset.step, 10);
                s.classList.remove('active', 'completed');
                if (sn === n) s.classList.add('active');
                else if (sn < n) s.classList.add('completed');
            });
            root.querySelectorAll('.btn-prev').forEach(b => { b.disabled = n <= 1; });
            if (n === TOTAL) {
                updateFinalSummary(root);
                updateLiveSummary(root);
            }
        }

        root.querySelectorAll('.type-option').forEach(opt => {
            opt.addEventListener('click', e => {
                e.preventDefault();
                root.querySelectorAll('.type-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                updateLiveSummary(root);
            });
        });

        root.querySelectorAll('.booking-step').forEach(s => {
            s.addEventListener('click', () => {
                const t = parseInt(s.dataset.step, 10);
                if (t <= step || s.classList.contains('completed')) setStep(t);
            });
        });

        root.querySelectorAll('.btn-next').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (btn.classList.contains('bw-submit')) {
                    const name = val(root, '.bw-name');
                    const email = val(root, '.bw-email');
                    if (!name || !email) {
                        alert('Vul naam en e-mail in.');
                        return;
                    }
                    btn.disabled = true;
                    const payload = {
                        deurType: selectedType(root),
                        materiaal: val(root, '.bw-materiaal'),
                        breedte: val(root, '.bw-breedte'),
                        hoogte: val(root, '.bw-hoogte'),
                        standaardMaat: val(root, '.bw-standaard'),
                        afwerking: val(root, '.bw-afwerking'),
                        ralKleur: val(root, '.bw-ral'),
                        montage: selectedMontage(root),
                        name: name,
                        org: val(root, '.bw-org'),
                        email: email,
                        phone: val(root, '.bw-phone'),
                        notes: val(root, '.bw-notes')
                    };
                    try {
                        const res = await fetch('/api/bookings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        if (!res.ok) throw new Error('fail');
                        setStep(TOTAL + 1);
                    } catch (e) {
                        alert('Verzenden mislukt. Probeer het opnieuw.');
                        btn.disabled = false;
                    }
                    return;
                }
                if (step < TOTAL) {
                    setStep(step + 1);
                    updateLiveSummary(root);
                }
            });
        });

        root.querySelectorAll('.btn-prev').forEach(btn => {
            btn.addEventListener('click', () => { if (step > 1) setStep(step - 1); });
        });

        toggleRalField(root);
        bindUpdates(root);
        updateLiveSummary(root);
        setStep(1);
    }

    function initAll(scope) {
        (scope || document).querySelectorAll('[data-il-element="booking"]').forEach(initWidget);
    }

    window.ILBooking = { init: initWidget, initAll: initAll };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initAll());
    else initAll();
})();
