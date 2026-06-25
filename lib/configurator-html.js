/**
 * Gedeelde HTML voor de deurconfigurator (hero, #boeken, CMS-element).
 */
'use strict';

function configuratorCardHtml() {
    return '' +
        '<div class="booking-card">' +
        '<div class="booking-progress">' +
        '<div class="booking-step active" data-step="1"><span class="step-num">1</span><span>Deurtype</span></div>' +
        '<div class="booking-step" data-step="2"><span class="step-num">2</span><span>Materiaal</span></div>' +
        '<div class="booking-step" data-step="3"><span class="step-num">3</span><span>Afmetingen</span></div>' +
        '<div class="booking-step" data-step="4"><span class="step-num">4</span><span>Afwerking</span></div>' +
        '<div class="booking-step" data-step="5"><span class="step-num">5</span><span>Montage</span></div>' +
        '<div class="booking-step" data-step="6"><span class="step-num">6</span><span>Contact</span></div>' +
        '</div>' +
        '<div class="config-live-summary"><strong>Jouw configuratie</strong><span class="config-summary-text">Stel je deur samen — je keuzes verschijnen hier live.</span></div>' +
        '<div class="booking-body">' +
        '<div class="booking-pane active" data-pane="1">' +
        '<h3>Welk <em>deurtype</em>?</h3><p>Kies het type dat past bij jouw doorgang en interieur.</p>' +
        '<div class="type-options">' +
        '<label class="type-option selected" data-type="Taatsdeur"><h4>Taatsdeur</h4><p>Elegant en ruimtelijk, ideaal voor brede doorgangen.</p></label>' +
        '<label class="type-option" data-type="Schuifdeur"><h4>Schuifdeur</h4><p>In of voor de wand — geen draairuimte nodig.</p></label>' +
        '<label class="type-option" data-type="Opdekdeur"><h4>Opdekdeur</h4><p>Klassiek en veelzijdig, de meest gekozen oplossing.</p></label>' +
        '<label class="type-option" data-type="Vouwwand"><h4>Vouwwand</h4><p>Flexibele scheiding tussen ruimtes.</p></label>' +
        '<label class="type-option" data-type="Stompdeur"><h4>Stompdeur</h4><p>Vlak in het kozijn, strak en modern.</p></label>' +
        '<label class="type-option" data-type="Glasdeur"><h4>Glasdeur</h4><p>Licht en transparant, met of zonder profiel.</p></label>' +
        '</div>' +
        '<div class="booking-actions"><button type="button" class="btn-prev" disabled>← Vorige</button><button type="button" class="btn-next">Volgende</button></div>' +
        '</div>' +
        '<div class="booking-pane" data-pane="2">' +
        '<h3>Welk <em>materiaal</em>?</h3><p>Materialen van topkwaliteit, afgestemd op gebruik en budget.</p>' +
        '<div class="form-row"><div class="form-field"><label>Materiaal</label><select class="bw-materiaal">' +
        '<option value="">Kies materiaal…</option><option>Massief hout</option><option>Fineer</option><option>Gelakt MDF</option><option>Glas</option><option>Combinatie hout/glas</option>' +
        '</select></div></div>' +
        '<div class="booking-actions"><button type="button" class="btn-prev">← Vorige</button><button type="button" class="btn-next">Volgende</button></div>' +
        '</div>' +
        '<div class="booking-pane" data-pane="3">' +
        '<h3>Welke <em>afmetingen</em>?</h3><p>Kies een standaardmaat of vul maatwerk in (breedte × hoogte in cm).</p>' +
        '<div class="form-row"><div class="form-field"><label>Standaardmaat</label><select class="bw-standaard">' +
        '<option value="">Kies standaardmaat…</option><option>631 × 2015 mm</option><option>780 × 2015 mm</option><option>830 × 2115 mm</option><option>930 × 2115 mm</option><option>Maatwerk (op maat)</option>' +
        '</select></div></div>' +
        '<div class="form-row"><div class="form-field"><label>Breedte (cm)</label><input type="number" class="bw-breedte" placeholder="bijv. 83" min="40" max="200"/></div>' +
        '<div class="form-field"><label>Hoogte (cm)</label><input type="number" class="bw-hoogte" placeholder="bijv. 211" min="180" max="280"/></div></div>' +
        '<div class="booking-actions"><button type="button" class="btn-prev">← Vorige</button><button type="button" class="btn-next">Volgende</button></div>' +
        '</div>' +
        '<div class="booking-pane" data-pane="4">' +
        '<h3>Afwerking &amp; <em>kleur</em></h3><p>Van naturel hout tot strak gelakt — of een eigen RAL-kleur.</p>' +
        '<div class="form-row"><div class="form-field"><label>Afwerking / kleur</label><select class="bw-afwerking">' +
        '<option value="">Kies afwerking…</option><option>Wit gelakt</option><option>Eiken</option><option>Walnoot</option><option>Zwart</option><option>Custom RAL</option>' +
        '</select></div>' +
        '<div class="form-field bw-ral-wrap" hidden><label>RAL-nummer</label><input type="text" class="bw-ral" placeholder="bijv. 9010"/></div></div>' +
        '<div class="booking-actions"><button type="button" class="btn-prev">← Vorige</button><button type="button" class="btn-next">Volgende</button></div>' +
        '</div>' +
        '<div class="booking-pane" data-pane="5">' +
        '<h3><em>Montage</em></h3><p>Alleen levering of volledig ontzorgd inclusief plaatsing door onze vakmannen.</p>' +
        '<div class="montage-options">' +
        '<label class="montage-option"><input type="radio" value="Alleen levering"/><strong>Alleen levering</strong><small>Je regelt zelf de montage</small></label>' +
        '<label class="montage-option"><input type="radio" value="Inclusief montage" checked/><strong>Inclusief montage</strong><small>Plaatsing en afstelling door DeurMeester</small></label>' +
        '</div>' +
        '<div class="booking-actions"><button type="button" class="btn-prev">← Vorige</button><button type="button" class="btn-next">Volgende</button></div>' +
        '</div>' +
        '<div class="booking-pane" data-pane="6">' +
        '<h3>Contact &amp; <em>samenvatting</em></h3><p>Controleer je configuratie en laat je gegevens achter voor een vrijblijvende offerte.</p>' +
        '<div class="summary"><h4>Jouw deur</h4>' +
        '<div class="summary-row"><span>Deurtype</span><span class="sum-deurtype">—</span></div>' +
        '<div class="summary-row"><span>Materiaal</span><span class="sum-materiaal">—</span></div>' +
        '<div class="summary-row"><span>Afmetingen</span><span class="sum-afmetingen">—</span></div>' +
        '<div class="summary-row"><span>Afwerking</span><span class="sum-afwerking">—</span></div>' +
        '<div class="summary-row"><span>Montage</span><span class="sum-montage">—</span></div></div>' +
        '<div class="form-row"><div class="form-field"><label>Naam</label><input type="text" class="bw-name" placeholder="Voor- en achternaam"/></div>' +
        '<div class="form-field"><label>Organisatie (optioneel)</label><input type="text" class="bw-org"/></div></div>' +
        '<div class="form-row"><div class="form-field"><label>E-mail</label><input type="email" class="bw-email"/></div>' +
        '<div class="form-field"><label>Telefoon</label><input type="tel" class="bw-phone"/></div></div>' +
        '<div class="form-field"><label>Toelichting (optioneel)</label><textarea class="bw-notes" rows="3" placeholder="Bijzonderheden, aantal deuren, gewenste planning…"></textarea></div>' +
        '<div class="booking-actions"><button type="button" class="btn-prev">← Vorige</button><button type="button" class="btn-next bw-submit">Offerte aanvragen</button></div>' +
        '</div>' +
        '<div class="booking-pane" data-pane="7"><div class="booking-success"><div class="check">✓</div><h3>Configuratie <em>verstuurd</em></h3><p>Bedankt! We sturen binnen 48 uur een offerte op maat.</p></div></div>' +
        '</div></div>';
}

module.exports = { configuratorCardHtml };
