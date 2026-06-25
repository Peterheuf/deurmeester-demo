/**
 * Herbruikbare site-elementen (widgets) — ontwerp-onafhankelijke registry.
 * Elk element kan via de live builder of de AI-agent op meerdere pagina's geplaatst worden.
 */
'use strict';

const { configuratorCardHtml } = require('./configurator-html');

const ELEMENTS = [
    {
        id: 'booking',
        name: 'Deurconfigurator',
        category: 'formulieren',
        description: 'Meerstaps deurconfigurator: type, materiaal, afmetingen, afwerking, montage en contact.',
        css: ['/assets/booking-widget.css'],
        scripts: ['/assets/booking-widget.js'],
        html: '' +
            '<section class="section section-sage il-element" data-il-element="booking">' +
            '<div class="container">' +
            '<div class="section-head">' +
            '<span class="eyebrow">Configurator</span>' +
            '<h2>Stel je <em>deur</em> samen</h2>' +
            '<p>Doorloop de stappen en ontvang een vrijblijvende offerte op maat.</p>' +
            '</div>' +
            configuratorCardHtml() +
            '</div></section>'
    }
];

function getCatalog() {
    return {
        elements: ELEMENTS.map(e => ({
            id: e.id, name: e.name, category: e.category, description: e.description,
            css: e.css || [], scripts: e.scripts || []
        }))
    };
}

function getElement(id) {
    return ELEMENTS.find(e => e.id === id) || null;
}

module.exports = { ELEMENTS, getCatalog, getElement };
