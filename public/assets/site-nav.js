/**
 * DeurMeester - mobiel navigatiemenu (hamburger)
 */
(function () {
    'use strict';

    function init() {
        const toggle = document.getElementById('mobile-toggle');
        const panel = document.getElementById('mobile-nav');
        const nav = document.getElementById('global-nav');
        if (!toggle || !panel) return;

        function setOpen(open) {
            document.body.classList.toggle('nav-open', open);
            panel.classList.toggle('open', open);
            if (nav) nav.classList.toggle('nav-open', open);
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            panel.setAttribute('aria-hidden', open ? 'false' : 'true');
            document.body.style.overflow = open ? 'hidden' : '';
        }

        toggle.addEventListener('click', () => setOpen(!panel.classList.contains('open')));

        panel.addEventListener('click', (e) => {
            if (e.target === panel) setOpen(false);
        });

        panel.querySelectorAll('a').forEach((a) => {
            a.addEventListener('click', () => setOpen(false));
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') setOpen(false);
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 640) setOpen(false);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
