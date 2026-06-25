/**
 * DeurMeester - site-chrome
 *
 * Draait op ELKE publieke pagina die via het serverskelet wordt gerenderd
 * (de losse /p/<slug>-pagina's), behalve in bewerkmodus. Zorgt dat de site-brede
 * overrides uit content.json overal zichtbaar zijn:
 *   - topstrip / nav / footer teksten en links (gedeelde sleutels met de homepage)
 *   - dynamische menu-link-teksten (menu.<slug>)
 *   - globaal logo en globale kleuren
 *
 * Zo blijven nav en footer op losse pagina's gesynchroniseerd met wat op de
 * homepage of in de pagina-builder is bewerkt. De homepage gebruikt hiervoor
 * content-loader.js (met dezelfde ILApply-logica).
 */
(function () {
    'use strict';

    function run() {
        const Scan = window.ILScan;
        const Apply = window.ILApply;
        if (!Scan || !Apply || !Scan.scanRoot) { setTimeout(run, 30); return; }

        // Alleen de chrome-regio's scannen (geen <main>: die HTML komt al
        // kant-en-klaar van de server met zijn eigen opgeslagen wijzigingen).
        const out = { editables: [], editablesByKey: {}, sections: [] };
        (Scan.CHROME_SECTIONS || []).forEach(s => {
            Scan.scanRoot(document.querySelector(s.selector), s.id, s.id, s.name, out, { region: 'chrome' });
        });

        fetch('/api/content')
            .then(r => (r.ok ? r.json() : null))
            .then(content => {
                if (!content) return;
                Apply.applyEdits(content.edits || {}, out.editablesByKey);
                // Op losse pagina's is er geen hero; logo via de globale logoSrc.
                Apply.applyGlobal(content.global || {}, {
                    logoSelectors: '.nav-logo img, .footer-logo',
                    heroBgSelector: ''
                });
            })
            .catch(() => { /* zonder server: gewoon de serverversie tonen */ });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
})();
