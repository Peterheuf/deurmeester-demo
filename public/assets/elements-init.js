/** Activeert herbruikbare elementen (widgets) op elke pagina. */
(function () {
    'use strict';
    function boot() {
        if (window.ILBooking && window.ILBooking.initAll) window.ILBooking.initAll();
        if (window.ILForm && window.ILForm.initAll) window.ILForm.initAll();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
