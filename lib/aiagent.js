/**
 * DeurMeester CMS - AI-agent (Kimi via Moonshot of OpenRouter)
 *
 * Kleine wrapper rond de OpenAI-compatibele chat-API. Werkt met meerdere
 * providers; de Kimi-modellen zijn zowel rechtstreeks bij Moonshot als via
 * OpenRouter te gebruiken. Node 24 heeft global fetch, dus geen extra dependency.
 *
 * Geverifieerd (juni 2026):
 *   Kimi (Moonshot direct) - platform.kimi.ai/docs
 *     - Base URL: https://api.moonshot.ai/v1  (China: https://api.moonshot.cn/v1)
 *     - Model:    kimi-k2.6
 *   OpenRouter - openrouter.ai/docs
 *     - Base URL: https://openrouter.ai/api/v1
 *     - Model:    moonshotai/kimi-k2.6  (ook moonshotai/kimi-k2, kimi-k2.5)
 *     - Optionele headers HTTP-Referer en X-Title voor ranking.
 *   Beide: POST {baseUrl}/chat/completions, header Authorization: Bearer <key>,
 *          body { model, messages, temperature }.
 */

// Per provider de standaard base-URL en het standaardmodel.
const PROVIDERS = {
    kimi: {
        label: 'Kimi (Moonshot direct)',
        baseUrl: 'https://api.moonshot.ai/v1',
        model: 'kimi-k2.6'
    },
    openrouter: {
        label: 'OpenRouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        model: 'moonshotai/kimi-k2.6'
    }
};

// Behoud de oude exports voor compatibiliteit (Moonshot-defaults).
const DEFAULT_PROVIDER = 'kimi';
const DEFAULT_BASE_URL = PROVIDERS.kimi.baseUrl;
const DEFAULT_MODEL = PROVIDERS.kimi.model;

// Pagina-bouwer: Claude Opus 4.7 via OpenRouter (hoogste kwaliteit voor HTML/copy).
const DEFAULT_PAGE_BUILDER_MODEL = 'anthropic/claude-opus-4.7';
// Op serverless (Netlify ~26s timeout): sneller model zodat generatie binnen de limiet past.
const SERVERLESS_PAGE_BUILDER_MODEL = 'openai/gpt-4.1-mini';
const PAGE_BUILDER_FALLBACK_MODEL = 'openai/gpt-4.1-mini';
// Gespreksfase: Kimi lokaal; op Netlify snelle modellen (<25s).
const SERVERLESS_CHAT_MODEL = 'openai/gpt-4.1-mini';
const SERVERLESS_CHAT_MODEL_ALT = 'anthropic/claude-sonnet-4';
const CHAT_FALLBACK_MODEL = 'openai/gpt-4.1-mini';
const IS_SERVERLESS = !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.NETLIFY;
const pageDesign = require('./page-design-variants');
const CHAT_TIMEOUT_MS = IS_SERVERLESS ? 22000 : 90000;

// Optionele identificatie richting OpenRouter (voor hun ranglijsten).
const APP_TITLE = 'DeurMeester CMS';
const APP_REFERER = process.env.PUBLIC_URL || 'http://localhost:4000';

// AI-instellingen veilig uit het settings-object halen, met provider-defaults.
function resolveAi(settings) {
    const ai = (settings && settings.ai) || {};
    const provider = PROVIDERS[ai.provider] ? ai.provider : DEFAULT_PROVIDER;
    const def = PROVIDERS[provider];
    return {
        provider: provider,
        apiKey: String(process.env.OPENROUTER_API_KEY || ai.apiKey || '').trim(),
        baseUrl: String(ai.baseUrl || def.baseUrl).trim().replace(/\/+$/, ''),
        model: String(ai.model || def.model).trim()
    };
}

// Model voor gespreks-/planfase. Op serverless altijd een snel model (geen Kimi).
function resolveChatAi(settings, opts) {
    const o = opts || {};
    const base = resolveAi(settings);
    const ai = (settings && settings.ai) || {};
    if (o.preferFast || IS_SERVERLESS) {
        const model = String(ai.chatModelFast || SERVERLESS_CHAT_MODEL).trim() || SERVERLESS_CHAT_MODEL;
        return { ...base, model };
    }
    const model = String(ai.chatModel || base.model).trim() || base.model;
    return { ...base, model };
}

function chatMaxTokens(forSiteAgent, opts) {
    const o = opts || {};
    if (!forSiteAgent) return IS_SERVERLESS ? 4096 : 4096;
    if (o.voorstel) return IS_SERVERLESS ? 3500 : 6000;
    return IS_SERVERLESS ? 2800 : 6000;
}

// Model voor pagina-generatie (HTML/copy). Op Netlify valt terug op een sneller model.
function resolvePageBuilderAi(settings, opts) {
    const o = opts || {};
    const base = resolveAi(settings);
    const ai = (settings && settings.ai) || {};
    let model = String(ai.pageBuilderModel || DEFAULT_PAGE_BUILDER_MODEL).trim() || DEFAULT_PAGE_BUILDER_MODEL;
    if (o.preferFast || (IS_SERVERLESS && !o.forceOpus)) {
        model = String(ai.pageBuilderModelFast || SERVERLESS_PAGE_BUILDER_MODEL).trim() || SERVERLESS_PAGE_BUILDER_MODEL;
    }
    return { ...base, model };
}

function pageBuilderMaxTokens(opts) {
    const o = opts || {};
    if (o.maxTokens) return o.maxTokens;
    return IS_SERVERLESS ? 6000 : 16000;
}

function isConfigured(settings) {
    return !!resolveAi(settings).apiKey;
}

/**
 * Eén chat-call naar de Kimi-API.
 * Geeft de tekst van het eerste antwoord terug, of gooit een Error met
 * een begrijpelijke (Nederlandse) melding.
 */
async function chat({ apiKey, baseUrl, model, provider, messages, temperature, maxTokens }) {
    if (!apiKey) {
        const err = new Error('Geen API-sleutel ingesteld. Vul deze in bij Instellingen > AI-agent.');
        err.code = 'NO_KEY';
        throw err;
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
    };
    // OpenRouter gebruikt optionele headers voor herkomst/ranglijst.
    if (provider === 'openrouter') {
        headers['HTTP-Referer'] = APP_REFERER;
        headers['X-Title'] = APP_TITLE;
    }

    let res;
    try {
        res = await fetch(baseUrl + '/chat/completions', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: typeof temperature === 'number' ? temperature : 0.6,
                max_tokens: maxTokens || 4096
            })
        });
    } catch (e) {
        const err = new Error('Kon de AI-dienst niet bereiken: ' + e.message);
        err.code = 'NETWORK';
        throw err;
    }

    let data = null;
    const raw = await res.text();
    try { data = raw ? JSON.parse(raw) : null; } catch (e) { data = null; }

    if (!res.ok) {
        const apiMsg = (data && data.error && (data.error.message || data.error.type)) || raw || ('HTTP ' + res.status);
        const err = new Error('AI-dienst gaf een fout (' + res.status + '): ' + apiMsg);
        err.code = 'API_ERROR';
        err.status = res.status;
        throw err;
    }

    const choice = data && data.choices && data.choices[0];
    const message = (choice && choice.message) || {};
    const content = message.content;

    if (!content || !String(content).trim()) {
        // Reasoning-modellen (zoals Kimi K2.6) verbruiken eerst tokens aan
        // redeneren. Als max_tokens te laag staat, blijft de echte output leeg
        // en is finish_reason "length". Geef dan een begrijpelijke melding.
        const finish = choice && (choice.finish_reason || choice.native_finish_reason);
        if (finish === 'length' && message.reasoning) {
            const err = new Error('Het model had te weinig ruimte om te antwoorden (alle ruimte ging op aan redeneren). Probeer opnieuw of kies een korter onderwerp.');
            err.code = 'TRUNCATED';
            throw err;
        }
        const err = new Error('De AI-dienst gaf een leeg antwoord terug.');
        err.code = 'EMPTY';
        throw err;
    }
    return String(content);
}

/** Chat met harde timeout (voorkomt Netlify gateway-timeout zonder antwoord). */
async function chatTimed(opts, timeoutMs) {
    const ms = typeof timeoutMs === 'number' ? timeoutMs : CHAT_TIMEOUT_MS;
    let timer;
    try {
        return await Promise.race([
            chat(opts),
            new Promise((_, reject) => {
                timer = setTimeout(() => {
                    const err = new Error('Het duurde te lang (server-timeout). Probeer opnieuw.');
                    err.code = 'TIMEOUT';
                    reject(err);
                }, ms);
            })
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

/**
 * Verbinding testen met een minimale chat-call.
 * @returns {Promise<{ok:boolean, model?:string, reply?:string, error?:string}>}
 */
async function testConnection(settings) {
    const ai = resolveAi(settings);
    try {
        const reply = await chat({
            apiKey: ai.apiKey,
            baseUrl: ai.baseUrl,
            model: ai.model,
            provider: ai.provider,
            messages: [
                { role: 'system', content: 'Je bent een testassistent. Antwoord kort in het Nederlands.' },
                { role: 'user', content: 'Antwoord met exact het woord: ok' }
            ],
            temperature: 0,
            // Ruim genoeg zodat reasoning-modellen (Kimi K2.6) na het redeneren
            // nog daadwerkelijk een antwoord kunnen geven.
            maxTokens: 1024
        });
        return { ok: true, provider: ai.provider, model: ai.model, reply: reply.trim().slice(0, 200) };
    } catch (e) {
        return { ok: false, error: e.message, code: e.code || 'ERROR' };
    }
}

// Een wireframe-structuur (array van sectie-objecten) omzetten naar een
// compacte, leesbare beschrijving voor in de prompt. De agent bouwt hiermee een
// pagina die exact deze sectievolgorde + regio's volgt, maar volledig on-brand.
function describeStructure(structure) {
    const list = Array.isArray(structure) ? structure : [];
    if (!list.length) return '';
    return list.map((s, i) => {
        const n = s.order || (i + 1);
        const els = Array.isArray(s.elements) ? s.elements.join(', ') : '';
        const parts = [];
        if (s.type) parts.push('type: ' + s.type);
        if (s.layout) parts.push('layout: ' + s.layout);
        if (els) parts.push('onderdelen: ' + els);
        const head = s.name ? (s.name) : (s.type || 'sectie');
        return '  ' + n + '. ' + head + ' (' + parts.join('; ') + ')';
    }).join('\n');
}

// De instructie-tekst voor een wireframe-gestuurde generatie. Wordt zowel in de
// generate- als de plan-stap hergebruikt zodat de agent dezelfde structuur volgt.
function buildStructureInstruction(structure) {
    const desc = describeStructure(structure);
    if (!desc) return '';
    return [
        'De beheerder heeft eerst een WIREFRAME (paginaskelet) opgebouwd. Dit legt de STRUCTUUR vast:',
        'de volgorde van de secties, hun type/layout en welke regio\'s/onderdelen erin horen.',
        '',
        'SECTIE-STRUCTUUR (volg deze EXACT, in deze volgorde):',
        desc,
        '',
        'Bouw een pagina die deze sectie-structuur exact volgt (zelfde volgorde, zelfde regio\'s en onderdelen),',
        'maar vul die volledig in de DeurMeester huisstijl met realistische Nederlandse inhoud over binnendeuren:',
        '- Gebruik de juiste site-base.css classes per sectietype (page-hero, section + varianten, container,',
        '  section-head, split, card-grid/card, feature-list, quote, callout, cta, btn, btn-link, eyebrow, lead, script).',
        '- Voor elk "image"-onderdeel: plaats een <img> met een lokale placeholder uit /images',
        '  (bijv. /images/placeholder-ruimte.svg, -sfeer.svg, -natuur.svg, -portret.svg) en een beschrijvende alt-tekst,',
        '  zodat de afbeelding later in de live builder vervangbaar is.',
        '- Verzin GEEN extra secties en laat geen secties weg; houd je aan het skelet.'
    ].join('\n');
}

// Compacte samenvatting van offerteaanvragen voor de admin-assistent.
function summarizeBookings(bookings) {
    const list = Array.isArray(bookings) ? bookings : [];
    if (!list.length) return '(nog geen offerteaanvragen)';
    return list.slice(0, 25).map(b => {
        const afm = b.standaardMaat && b.standaardMaat !== 'Maatwerk (op maat)'
            ? b.standaardMaat
            : ((b.breedte || b.hoogte) ? (b.breedte || '?') + ' × ' + (b.hoogte || '?') + ' cm' : (b.size || '?'));
        const afw = (b.afwerking === 'Custom RAL' && b.ralKleur) ? 'RAL ' + b.ralKleur : (b.afwerking || '?');
        return '- ' + (b.id || '?') + ' [' + (b.status || 'nieuw') + ', ' + String(b.createdAt || '').slice(0, 10) + ']: ' +
            (b.name || 'onbekend') + ' — ' + (b.deurType || b.type || '?') + ', ' + (b.materiaal || b.space || '?') +
            ', ' + afm + ', afwerking ' + afw + ', montage: ' + (b.montage || '?') +
            (b.notes ? ', opmerking: ' + String(b.notes).slice(0, 120) : '');
    }).join('\n');
}

// Eventuele ```json ... ``` fences en omringende ruis weghalen
function stripCodeFences(text) {
    let t = String(text || '').trim();
    const fullFence = t.match(/^```(?:json|JSON|[a-zA-Z]*)?\s*([\s\S]*?)```\s*$/);
    if (fullFence) return fullFence[1].trim();
    const openFence = t.match(/^```(?:json|JSON)?\s*\n?([\s\S]*)$/);
    if (openFence && t.indexOf('```', 3) === -1) return openFence[1].trim();
    t = t.replace(/```(?:json|JSON)?\s*/gi, '').replace(/```/g, '');
    return t.trim();
}

// Eerste volledige {...}-blok via brace-matching (niet lastIndexOf).
function extractFirstJsonObject(text) {
    const t = String(text || '');
    const start = t.indexOf('{');
    if (start === -1) return '';
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < t.length; i++) {
        const c = t[i];
        if (inString) {
            if (escape) escape = false;
            else if (c === '\\') escape = true;
            else if (c === '"') inString = false;
            continue;
        }
        if (c === '"') { inString = true; continue; }
        if (c === '{') depth++;
        if (c === '}') {
            depth--;
            if (depth === 0) return t.slice(start, i + 1);
        }
    }
    return t.slice(start);
}

// Afgekapte JSON proberen te sluiten (ontbrekende } of ]).
function tryCloseTruncatedJson(raw) {
    const t = String(raw || '');
    let depth = 0;
    let inString = false;
    let escape = false;
    const stack = [];
    for (let i = 0; i < t.length; i++) {
        const c = t[i];
        if (inString) {
            if (escape) escape = false;
            else if (c === '\\') escape = true;
            else if (c === '"') inString = false;
            continue;
        }
        if (c === '"') { inString = true; continue; }
        if (c === '{') { depth++; stack.push('}'); continue; }
        if (c === '[') { depth++; stack.push(']'); continue; }
        if (c === '}' || c === ']') {
            if (stack.length && stack[stack.length - 1] === c) stack.pop();
            depth = Math.max(0, depth - 1);
        }
    }
    if (!stack.length) return t;
    return t + stack.reverse().join('');
}

// Ongeëscapte newlines/tabs binnen JSON-strings repareren.
function repairUnescapedStringChars(json) {
    let out = '';
    let inString = false;
    let escape = false;
    for (let i = 0; i < json.length; i++) {
        const c = json[i];
        if (!inString) {
            out += c;
            if (c === '"') inString = true;
            continue;
        }
        if (escape) {
            out += c;
            escape = false;
            continue;
        }
        if (c === '\\') {
            out += c;
            escape = true;
            continue;
        }
        if (c === '"') {
            out += c;
            inString = false;
            continue;
        }
        if (c === '\n') { out += '\\n'; continue; }
        if (c === '\r') { out += '\\r'; continue; }
        if (c === '\t') { out += '\\t'; continue; }
        out += c;
    }
    return out;
}

// Systeemprompt opbouwen uit de volledige stijlgids
function buildSystemPrompt(styleguide, examples) {
    const sg = styleguide || {};
    const tokens = Array.isArray(sg.tokens) ? sg.tokens : [];
    const fonts = sg.fonts || {};
    const tokenLines = tokens.map(t => '  ' + t.var + ': ' + t.hex + (t.label ? '  (' + t.label + ')' : '')).join('\n');

    const exampleBlock = (examples && examples.length)
        ? examples.map((ex, i) => 'VOORBEELD ' + (i + 1) + ':\n' + ex).join('\n\n')
        : '';

    return [
        'Je bent de webredacteur en front-end bouwer van DeurMeester, een specialist in binnendeuren, maatwerk en montage in Veenendaal.',
        'Je maakt nieuwe webpagina\'s die naadloos in de bestaande huisstijl passen.',
        '',
        '## TONE OF VOICE (strikt naleven)',
        (sg.voice || 'Warm, natuurlijk Nederlands. Concreet en menselijk.'),
        '',
        '## HUISSTIJL-KLEUREN (CSS-variabelen, al beschikbaar via site-base.css)',
        tokenLines || '  (geen tokens beschikbaar)',
        '',
        '## FONTS',
        '  Koppen: ' + (fonts.heading || 'Libre Caslon Text') + ' (serif)',
        '  Body:   ' + (fonts.body || 'Montserrat'),
        '  Accent: ' + (fonts.accent || 'Caveat') + ' (handgeschreven)',
        '',
        '## BESCHIKBARE CSS-CLASSES (uit site-base.css, gebruik deze)',
        (sg.components || ''),
        '',
        '## RICHTLIJNEN',
        (sg.guidelines || ''),
        '',
        exampleBlock ? ('## VOORBEELD-SECTIES UIT DE BESTAANDE SITE (zelfde stijl aanhouden)\n' + exampleBlock + '\n') : '',
        '## OUTPUT-REGELS (heel belangrijk)',
        '- Geef ALLEEN de body-HTML van de nieuwe pagina terug.',
        '- GEEN <!DOCTYPE>, <html>, <head>, <body> of <nav>/<footer> (die worden automatisch toegevoegd).',
        '- Gebruik de bestaande classes en CSS-variabelen uit site-base.css. Verzin geen nieuwe kleuren.',
        '- Voeg GEEN losse <style>-blokken toe, tenzij een minimale pagina-specifieke aanvulling echt nodig is.',
        '- Schrijf alle tekst in natuurlijk Nederlands. Gebruik NOOIT em-dashes (—).',
        '- Begin met een <section class="page-hero"> (eyebrow, h1, lead, optioneel CTA-knop).',
        '- Lever MINIMAAL 4 en MAXIMAAL 6 inhoudssecties als <section class="section ..."> met container, section-head, en passende layout (split, card-grid, feature-list, quote, callout).',
        '- Elke sectie heeft een echte kop, alinea(\'s) en waar passend een CTA of bulletlijst. GEEN lorem ipsum.',
        '- Gebruik <img src="/images/placeholder-ruimte.svg"> (of -sfeer, -natuur, -portret) met beschrijvende alt-tekst.',
        '- Sluit af met een duidelijke CTA-sectie (class="section cta" of callout) met btn-knop.',
        '- Als er pagina-design instructies in de opdracht staan: pas die STRIKT toe (wrapper-class, variant-CSS, uniek element).',
        '- Lever schone, geldige HTML zonder uitleg eromheen.'
    ].join('\n');
}

/**
 * Genereer de body-HTML van een nieuwe pagina.
 * @param {Object} opts {prompt, styleguide, settings, examples}
 * @returns {Promise<{html:string}>}
 */
async function generatePage(opts) {
    const o = opts || {};
    const ai = o.useChatModel ? resolveAi(o.settings) : resolvePageBuilderAi(o.settings, o);
    const tokens = pageBuilderMaxTokens(o);
    const system = buildSystemPrompt(o.styleguide, o.examples);
    const userPrompt = String(o.prompt || '').trim();
    if (!userPrompt) {
        const err = new Error('Geef een omschrijving van de pagina die je wilt maken.');
        err.code = 'NO_PROMPT';
        throw err;
    }

    // Wireframe-context (nieuwe hoofdroute): de beheerder koos een paginaskelet.
    // We sturen de STRUCTUUR mee; de agent bouwt er een volledig on-brand pagina
    // van die exact die structuur volgt.
    const structure = Array.isArray(o.structure) ? o.structure : [];
    // Template-context (oude route): als de beheerder al gestylede blokken koos,
    // bouwen we niet vanaf nul maar vullen we de aangeleverde structuur in.
    const chosen = Array.isArray(o.blocks) ? o.blocks : [];
    const baseHtml = String(o.baseHtml || '').trim();
    let userMessage = 'Maak de body-HTML voor de volgende pagina:\n\n' + userPrompt;
    if (structure.length) {
        userMessage = [
            buildStructureInstruction(structure),
            '',
            'OPDRACHT / WENSEN:',
            userPrompt
        ].join('\n');
    } else if (baseHtml) {
        const blockList = chosen.length
            ? chosen.map((b, i) => '  ' + (i + 1) + '. ' + b.name + (b.description ? ' - ' + b.description : '')).join('\n')
            : '(structuur volgt uit de HTML hieronder)';
        userMessage = [
            'De beheerder heeft de pagina al opgebouwd uit kant-en-klare template-blokken in de huisstijl.',
            'Vul deze structuur in met passende, concrete Nederlandse inhoud op basis van de opdracht.',
            '',
            'GEKOZEN BLOKKEN (in volgorde):',
            blockList,
            '',
            'BESTAANDE HTML-STRUCTUUR (vervang de placeholder-teksten; behoud de tags, classes en de <img>-elementen met hun src):',
            baseHtml,
            '',
            'OPDRACHT / WENSEN:',
            userPrompt,
            '',
            'Belangrijk: behoud exact dezelfde sectie-opbouw, classes en afbeeldingen. Vervang alleen de teksten door echte inhoud. Verzin geen extra secties tenzij de opdracht daarom vraagt.'
        ].join('\n');
    }

    const design = o.design && typeof o.design === 'object' ? pageDesign.normalizeDesign(o.design) : null;
    if (design) {
        userMessage += '\n\n' + pageDesign.getDesignPromptBlock(design);
    }

    const runOnce = (model) => chatTimed({
        apiKey: ai.apiKey,
        baseUrl: ai.baseUrl,
        model: model,
        provider: ai.provider,
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: userMessage }
        ],
        temperature: 0.6,
        maxTokens: tokens
    }, IS_SERVERLESS ? 20000 : 120000);

    let content;
    try {
        content = await runOnce(ai.model);
    } catch (first) {
        if (first.code === 'API_ERROR' && ai.model !== PAGE_BUILDER_FALLBACK_MODEL) {
            content = await runOnce(PAGE_BUILDER_FALLBACK_MODEL);
        } else {
            throw first;
        }
    }

    return { html: stripCodeFences(content), modelUsed: ai.model };
}

// Veelvoorkomende JSON-fouten van LLM's repareren voordat we parsen.
function repairJsonString(raw) {
    let t = String(raw || '');
    t = t.replace(/,\s*([}\]])/g, '$1');
    t = t.replace(/[\u201c\u201d]/g, '"');
    t = t.replace(/[\u2018\u2019]/g, "'");
    t = repairUnescapedStringChars(t);
    return t;
}

function tryParseJsonCandidate(candidate) {
    if (!candidate || typeof candidate !== 'string') return null;
    const variants = [candidate, repairJsonString(candidate), tryCloseTruncatedJson(candidate)];
    const seen = new Set();
    for (const v of variants) {
        if (!v || seen.has(v)) continue;
        seen.add(v);
        try {
            const parsed = JSON.parse(v);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
        } catch (e) { /* volgende variant */ }
        const repaired = repairJsonString(v);
        if (repaired !== v && !seen.has(repaired)) {
            seen.add(repaired);
            try {
                const parsed = JSON.parse(repaired);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
            } catch (e2) { /* volgende variant */ }
        }
    }
    return null;
}

// Losse velden uit kapotte JSON halen als laatste redmiddel.
function degradeAgentResponse(raw) {
    const t = String(raw || '');
    const replyMatch = t.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/s)
        || t.match(/"reply"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
    const modeMatch = t.match(/"mode"\s*:\s*"(begrip|voorstel|antwoord)"/);
    const reply = replyMatch
        ? replyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim()
        : '';
    if (!reply && !modeMatch) {
        const plain = stripCodeFences(t).replace(/^\{[\s\S]*/, '').trim();
        if (plain && plain.length > 20 && !plain.startsWith('{')) {
            return {
                mode: 'begrip',
                reply: plain.slice(0, 1200),
                choices: [],
                plan: null,
                _degraded: true
            };
        }
        return null;
    }
    let plan = null;
    const planMatch = t.match(/"plan"\s*:\s*(\{[\s\S]*)/);
    if (planMatch) {
        const partial = tryParseJsonCandidate(planMatch[1]);
        if (partial && (partial.title || partial.titel || partial.slug)) plan = partial;
    }
    const mode = (modeMatch && modeMatch[1]) || (plan ? 'voorstel' : 'begrip');
    return {
        mode,
        reply: reply || 'Ik heb je antwoord ontvangen. Kun je dat nog iets verduidelijken?',
        choices: [],
        plan,
        _degraded: true
    };
}

/**
 * Parse een site-agent antwoord: fences strippen, JSON extraheren/repareren,
 * of terugvallen op gedegradeerde velden (reply + default choices).
 */
function parseAgentResponse(text) {
    const raw = String(text || '').trim();
    if (!raw) {
        const err = new Error('De AI-dienst gaf een leeg antwoord terug.');
        err.code = 'EMPTY';
        throw err;
    }

    const stripped = stripCodeFences(raw);
    const candidates = [];
    const braceMatched = extractFirstJsonObject(stripped);
    if (braceMatched) candidates.push(braceMatched);
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start !== -1 && end > start) candidates.push(stripped.slice(start, end + 1));
    candidates.push(stripped);

    const seen = new Set();
    for (const candidate of candidates) {
        if (!candidate || seen.has(candidate)) continue;
        seen.add(candidate);
        const parsed = tryParseJsonCandidate(candidate);
        if (parsed) return parsed;
    }

    const degraded = degradeAgentResponse(raw);
    if (degraded) return degraded;

    const err = new Error('Het AI-antwoord was geen geldige JSON. Probeer het opnieuw of formuleer korter.');
    err.code = 'BAD_JSON';
    throw err;
}

// Alias voor oudere aanroepen (planConversation, tests).
function extractJson(text) {
    return parseAgentResponse(text);
}

// Systeemprompt voor de gespreks-/plan-stap (de "meedenkende" agent).
function buildPlannerSystemPrompt(styleguide) {
    const sg = styleguide || {};
    const voice = sg.voice || 'Warm, natuurlijk Nederlands. Concreet en menselijk.';
    return [
        'Je bent de meedenkende pagina-assistent van DeurMeester, een specialist in binnendeuren op maat.',
        'DeurMeester adviseert, levert en monteert binnendeuren voor particulieren, aannemers en architecten.',
        '',
        'DOEL: voer een kort, ADAPTIEF gesprek met de beheerder om genoeg te weten te komen om een nieuwe webpagina te plannen.',
        'Daarna lever je een helder plan dat de beheerder kan bevestigen of bijsturen.',
        '',
        '## TONE OF VOICE (voor je voorstellen en plan)',
        voice,
        '',
        '## GESPREKSREGELS',
        '- Stel telkens ÉÉN vraag (heel soms twee als ze echt samenhangen).',
        '- Elke vraag is MEERKEUZE met 2 tot 5 concrete, relevante opties.',
        '- De gebruiker kan altijd "Anders" kiezen en vrije tekst geven; zet daarom allowOther op true.',
        '- Vragen zijn ADAPTIEF: baseer de volgende vraag op de eerdere antwoorden. Voorbeeld: bij "evenementpagina" vraag je door over datum, locatie en aanmelding; bij "dienst uitlichten" over welke dienst, voordelen en prijsindicatie.',
        '- Stel in totaal MAXIMAAL 5 tot 7 vragen. Zodra je genoeg weet (meestal na 4 tot 6 vragen), geef je een plan.',
        '- Alles in natuurlijk Nederlands. Gebruik nooit em-dashes.',
        '',
        '## ANTWOORDFORMAAT (heel belangrijk)',
        'Antwoord UITSLUITEND met geldige JSON. Geen tekst eromheen, geen uitleg, geen code-fences.',
        'Gebruik exact een van deze twee vormen:',
        '',
        '1) Volgende vraag:',
        '{"type":"question","question":"<de vraag in het Nederlands>","options":[{"id":"<korte id>","label":"<keuzetekst>"}],"allowOther":true,"multiple":false}',
        '- Zet "multiple" op true als de gebruiker meerdere opties tegelijk mag kiezen (bv. welke secties).',
        '',
        '2) Klaar voor plan:',
        '{"type":"plan","plan":{"title":"<paginatitel>","slug":"<url-slug, kleine letters met koppeltekens>","inMenu":<true|false>,"menuLabel":"<kort menulabel of leeg>","sections":["<sectie 1>","<sectie 2>"],"cta":"<call-to-action met bestemming>","summary":"<korte samenvatting van de pagina in 1-3 zinnen>"},"generationPrompt":"<een rijke, complete Nederlandse opdracht voor de paginagenerator>"}',
        '',
        '## OVER generationPrompt',
        '- Schrijf een uitgebreide Nederlandse opdracht waarmee een aparte generator de body-HTML kan bouwen.',
        '- Verwerk alle verzamelde antwoorden: doel, doelgroep, boodschap, gewenste secties, toon, en de exacte call-to-action met bestemming.',
        '- Beschrijf de gewenste secties in volgorde (hero, intro, kenmerken, enz.) en wat erin moet staan.',
        '- Noem de paginatitel. Houd de DeurMeester huisstijl en tone of voice aan.'
    ].join('\n');
}

/**
 * Eén stap in het meedenkende planningsgesprek.
 * Geeft de LLM de gesprekstaat en laat hem ofwel de volgende meerkeuzevraag,
 * ofwel een afgerond plan teruggeven als strikt JSON.
 *
 * @param {Object} opts {messages, answers, styleguide, settings}
 *   messages: array van {role:'user'|'assistant', content:string} (eerdere beurten)
 *   answers:  array van {question, answer} (overzicht voor context, optioneel)
 * @returns {Promise<Object>} de geparste JSON ({type:'question'|'plan', ...})
 */
async function planConversation(opts) {
    const o = opts || {};
    const ai = resolveAi(o.settings);
    const system = buildPlannerSystemPrompt(o.styleguide);

    const convo = Array.isArray(o.messages) ? o.messages.filter(m =>
        m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
    ) : [];

    // Beknopt overzicht van de reeds gegeven antwoorden meesturen als context.
    const answers = Array.isArray(o.answers) ? o.answers : [];
    let answerSummary = '';
    if (answers.length) {
        answerSummary = 'Tot nu toe verzamelde antwoorden:\n' +
            answers.map(a => '- ' + String(a.question || '').trim() + ' => ' + String(a.answer || '').trim()).join('\n');
    }

    // Wireframe-context (nieuwe hoofdroute): de beheerder bouwde een paginaskelet.
    // De planner krijgt de structuur mee zodat de vragen gericht zijn op het
    // INVULLEN van dat skelet (niet op welke secties nodig zijn).
    const structure = Array.isArray(o.structure) ? o.structure : [];
    // Template-context (oude route): gekozen gestylede blokken.
    const chosen = Array.isArray(o.blocks) ? o.blocks : [];
    let blockContext = '';
    if (structure.length) {
        blockContext = 'De beheerder heeft via een WIREFRAME al de paginastructuur vastgelegd (secties in volgorde):\n' +
            describeStructure(structure) +
            '\n\nStem je vragen hierop af: vraag naar de INHOUD die in dit skelet hoort (doel, doelgroep, teksten, ' +
            'voorbeelden, prijzen, beelden, call-to-action). Stel GEEN vragen over welke secties nodig zijn; die staan ' +
            'al vast. Verwerk in je uiteindelijke generationPrompt dat de pagina exact deze sectie-structuur volgt en ' +
            'volledig on-brand wordt ingevuld met realistische Nederlandse inhoud en <img>-placeholders.';
    } else if (chosen.length) {
        blockContext = 'De beheerder heeft de paginastructuur al samengesteld uit deze template-blokken (in volgorde):\n' +
            chosen.map((b, i) => '- ' + (i + 1) + '. ' + b.name + (b.description ? ' (' + b.description + ')' : '')).join('\n') +
            '\nStem je vragen hierop af: vraag naar de inhoud die in deze blokken hoort (teksten, voorbeelden, prijzen, vragen, enz.). Stel GEEN vragen over welke secties nodig zijn; die staan al vast. Verwerk in je uiteindelijke generationPrompt dat de bestaande blokstructuur behouden blijft en alleen wordt ingevuld.';
    }

    const messages = [{ role: 'system', content: system }];
    if (!convo.length) {
        // Kick-off: laat de agent met de eerste vraag beginnen.
        const kick = 'Ik wil een nieuwe webpagina voor DeurMeester maken. Stel je eerste vraag.' +
            (blockContext ? '\n\n' + blockContext : '');
        messages.push({ role: 'user', content: kick });
    } else {
        for (const m of convo) messages.push({ role: m.role, content: m.content });
        if (blockContext) messages.push({ role: 'user', content: blockContext });
        if (answerSummary) messages.push({ role: 'user', content: answerSummary });
    }

    const content = await chat({
        apiKey: ai.apiKey,
        baseUrl: ai.baseUrl,
        model: ai.model,
        provider: ai.provider,
        messages: messages,
        temperature: 0.5,
        // Reasoning-modellen (Kimi K2.6) verbruiken eerst tokens aan redeneren;
        // ruim budget zodat de plan-JSON (incl. rijke generationPrompt) past en
        // niet leeg terugkomt door een "length"-afkap tijdens het redeneren.
        maxTokens: 16000
    });

    let parsed;
    try {
        parsed = extractJson(content);
    } catch (e) {
        const err = new Error('De AI gaf een antwoord dat niet als plan/vraag te lezen was. Probeer het opnieuw.');
        err.code = 'BAD_JSON';
        throw err;
    }

    if (!parsed || (parsed.type !== 'question' && parsed.type !== 'plan')) {
        const err = new Error('De AI gaf een onverwacht antwoord. Probeer het opnieuw.');
        err.code = 'BAD_SHAPE';
        throw err;
    }
    return parsed;
}

// Compacte stijlgids-context voor de admin-assistent (volledige tokens + richtlijnen).
function buildStyleguideContext(styleguide, examples) {
    const sg = styleguide || {};
    const tokens = Array.isArray(sg.tokens) ? sg.tokens : [];
    const fonts = sg.fonts || {};
    const tokenLines = tokens.map(t => '  ' + t.var + ': ' + t.hex + (t.label ? ' (' + t.label + ')' : '')).join('\n');
    const exampleBlock = (examples && examples.length)
        ? examples.map((ex, i) => 'VOORBEELD ' + (i + 1) + ':\n' + ex).join('\n\n')
        : '';
    return [
        '## HUISSTIJL-KLEUREN (CSS-variabelen uit site-base.css)',
        tokenLines || '  (geen tokens)',
        '',
        '## FONTS',
        '  Koppen: ' + (fonts.heading || 'Libre Caslon Text'),
        '  Body:   ' + (fonts.body || 'Montserrat'),
        '  Accent: ' + (fonts.accent || 'Caveat'),
        '',
        '## BESCHIKBARE CSS-CLASSES',
        (sg.components || ''),
        '',
        '## RICHTLIJNEN',
        (sg.guidelines || ''),
        exampleBlock ? ('## VOORBEELD-SECTIES (zelfde stijl aanhouden)\n' + exampleBlock) : ''
    ].filter(Boolean).join('\n');
}

// Tel hoeveel beurten de gebruiker al heeft geantwoord (voor consultatiediepte).
function countUserTurns(messages) {
    return (messages || []).filter(m => m && m.role === 'user' && String(m.content || '').trim()).length;
}

const VOORSTEL_DEFAULT_CHOICES = [
    { id: 'yes', label: 'Ja, maak de pagina', value: 'Ja, maak de pagina' },
    { id: 'title', label: 'Pas de titel aan', value: 'Ik wil de titel aanpassen' },
    { id: 'design', label: 'Andere sfeer', value: 'Ik wil een andere design-sfeer' },
    { id: 'layout', label: 'Andere layout', value: 'Ik wil een andere layout' },
    { id: 'images', label: 'Andere beelden', value: 'Ik wil andere beelden gebruiken' },
    { id: 'sections', label: 'Meer secties', value: 'Voeg meer secties toe aan het voorstel' },
    { id: 'custom', label: 'Iets anders', value: '__custom__' }
];

function normalizeAgentChoices(parsed, mode) {
    let raw = Array.isArray(parsed.choices) ? parsed.choices : [];
    if (!raw.length && Array.isArray(parsed.options)) {
        raw = parsed.options.map(o => ({
            id: o.id,
            label: o.label,
            value: o.value != null ? o.value : o.label
        }));
    }
    let choices = raw
        .map(c => ({
            id: String(c.id || '').trim().slice(0, 24) || ('c' + Math.random().toString(36).slice(2, 6)),
            label: String(c.label || '').trim(),
            value: String(c.value != null ? c.value : c.label || '').trim()
        }))
        .filter(c => c.label)
        .slice(0, 6);

    if (!choices.length && mode === 'voorstel') {
        choices = VOORSTEL_DEFAULT_CHOICES.slice();
    }
    const hasCustom = choices.some(c => c.value === '__custom__' || /^(iets )?anders$/i.test(c.label));
    if (mode === 'begrip' && choices.length && !hasCustom) {
        choices.push({ id: 'custom', label: 'Iets anders', value: '__custom__' });
    }
    return choices;
}

/**
 * Admin-assistent: vriendelijke pagina-bouwer via gesprek.
 * Werkt in fasen: begrip (veel vragen) → voorstel (preview + bouwplan) → antwoord (info).
 */
async function runSiteAgent(opts) {
    const o = opts || {};
    const ai = resolveChatAi(o.settings, { preferFast: IS_SERVERLESS });
    const sg = o.styleguide || {};
    const settings = o.settings || {};
    const pages = o.pages || [];
    const bookings = o.bookings || [];
    const elementList = o.elements || [];
    const examples = o.examples || [];
    const mediaSummary = o.mediaSummary || '';
    const messages = Array.isArray(o.messages) ? o.messages : [];
    const userTurns = countUserTurns(messages);
    const compact = IS_SERVERLESS;

    const settingsBlock = [
        'Bedrijfsnaam: ' + (settings.bedrijfsnaam || 'DeurMeester'),
        'Tagline: ' + (settings.tagline || 'Binnendeuren op maat'),
        'Contact: ' + (settings.contactEmail || settings.telefoon || '(niet ingesteld)')
    ].join('\n');

    const styleBlock = compact
        ? [
            'Tone: ' + (sg.voice || 'Warm, professioneel Nederlands.'),
            'Kleuren/fonts: site-base.css (Libre Caslon, Montserrat, Caveat).'
        ].join('\n')
        : buildStyleguideContext(sg, examples);

    const bookingsBlock = compact
        ? (bookings.length ? bookings.length + ' offerteaanvragen (details op verzoek).' : 'Geen offerteaanvragen.')
        : summarizeBookings(bookings);

    const pagesBlock = compact
        ? (pages.length ? pages.length + ' pagina\'s: ' + pages.slice(0, 8).map(p => p.slug).join(', ') : 'alleen homepage')
        : (pages.length
            ? pages.map(p => p.slug + ' ("' + p.title + '", ' + (p.status || 'concept') + ')').join(', ')
            : 'alleen homepage');

    const mediaBlock = compact
        ? (mediaSummary ? mediaSummary.split('\n').slice(0, 12).join('\n') : '(geen media)')
        : (mediaSummary || '(mediabibliotheek niet geladen)');

    const minTurnsForVoorstel = compact ? 6 : 8;
    const designBank = pageDesign.DESIGN_QUESTION_BANK.map(q =>
        '- ' + q.question + ' → choices: ' + q.choices.map(c => c.label).join(' / ')
    ).join('\n');

    const system = [
        'Je bent de Assistent in het beheerportaal van DeurMeester (binnendeuren op maat, Veenendaal).',
        'Je helpt de klant een webpagina bedenken via UITGEBREIDE vragen over INHOUD én DESIGN, toont een voorbeeldplan, en bouwt pas na bevestiging.',
        '',
        '## MODI',
        '**begrip** (standaard): stel 1 hoofdvraag met 3-6 MEERKEUZE-opties (choices).',
        '  Minimaal ' + minTurnsForVoorstel + ' gespreksbeurten: eerst inhoud (doel, doelgroep, boodschap), daarna DESIGN-vragen.',
        '  Beurten nu: ' + userTurns + (userTurns < minTurnsForVoorstel ? ' — nog doorvragen (vooral design!).' : ' — voorstel mag als design compleet is.'),
        '**voorstel**: rijk plan-object MET design-object + choices zoals "Ja, maak de pagina", "Pas de titel aan", "Andere sfeer", "Meer secties".',
        '**antwoord**: korte info (geen pagina-bouw).',
        '',
        '## DESIGN-VRAGEN (verplicht — niet alleen inhoud!)',
        'Stel na de inhoudsvragen ALLE onderstaande design-dimensies af, één per beurt (of twee gerelateerde samen).',
        'Gebruik de exacte keuzelabels als choices-knoppen waar mogelijk:',
        designBank,
        'Sla antwoorden op in plan.design: { sfeer, layout, kleuraccent, typografie, beelden, sectiestijl, cta, uniek }.',
        'Voorbeeld: "sfeer": "warm luxe", "layout": "veel witruimte", "kleuraccent": "eiken", "typografie": "editorial",',
        '"beelden": "grote hero", "sectiestijl": "afwisselend", "cta": "opvallend koper", "uniek": "statistieken".',
        'Elke pagina moet door andere design-keuzes UNIEK ogen — binnen DeurMeester luxe-deurenbusiness.',
        '',
        '## CHOICES (verplicht bij begrip en voorstel)',
        '- choices: array van 3-6 objecten { "id": "a", "label": "korte knoptekst", "value": "volledige zin die als gebruikersantwoord telt" }',
        '- Voeg altijd { "id": "custom", "label": "Iets anders", "value": "__custom__" } toe bij begrip.',
        '- Bij design-vragen: gebruik de keuzelabels hierboven als label én value-basis.',
        '- Bij "welke secties?" zet choicesMultiple op true; anders false.',
        '- value is wat de klant "zegt" bij klikken; label is wat op de knop staat.',
        '',
        '## PLAN (alleen bij mode voorstel)',
        'plan: title, slug, doel, doelgroep, toon, cta, design{sfeer,layout,kleuraccent,typografie,beelden,sectiestijl,cta,uniek}, secties[], beelden[{label,url}], inMenu, menuLabel, status, generationPrompt.',
        'generationPrompt MOET alle design-keuzes expliciet vermelden zodat de HTML-generator ze toepast.',
        'Alleen mediabibliotheek-URL\'s in beelden[].',
        '',
        '## CONTEXT',
        styleBlock,
        settingsBlock,
        'Media:\n' + mediaBlock,
        'Offertes: ' + bookingsBlock,
        'Pagina\'s: ' + pagesBlock,
        compact ? '' : ('Widgets: ' + (elementList.length ? elementList.map(e => e.id).join(', ') : 'booking')),
        '',
        '## JSON (strikt, geen markdown)',
        'Antwoord UITSLUITEND met één geldig JSON-object. Geen ``` fences, geen tekst ervoor of erna, geen uitleg.',
        'Begin met { en eindig met }. Gebruik dubbele aanhalingstekens voor alle strings.',
        '{',
        '  "mode": "begrip"|"voorstel"|"antwoord",',
        '  "reply": "<Nederlands bericht met je vraag>",',
        '  "choices": [{"id":"a","label":"...","value":"..."}],',
        '  "choicesMultiple": false,',
        '  "suggestions": ["globale chip bovenaan"],',
        '  "plan": null of { "title":"...", "slug":"...", "design":{"sfeer":"...","layout":"...","kleuraccent":"...","typografie":"...","beelden":"...","sectiestijl":"...","cta":"...","uniek":"..."}, "secties":[{"headline":"...","preview":"..."}], "beelden":[{"label":"...","url":"..."}], "cta":"...", "generationPrompt":"..." }',
        '}',
        'Nederlands. Geen em-dashes. Geen HTML in reply.'
    ].filter(Boolean).join('\n');

    const shouldVoorstel = userTurns >= minTurnsForVoorstel;

    const chatMessages = [{ role: 'system', content: system }];
    messages.forEach(m => {
        if (m && (m.role === 'user' || m.role === 'assistant') && m.content) chatMessages.push(m);
    });
    if (!chatMessages.some(m => m.role === 'user')) {
        chatMessages.push({
            role: 'user',
            content: String(o.message || 'Hallo, ik wil graag een nieuwe pagina maken.')
        });
    }
    if (shouldVoorstel) {
        chatMessages.push({
            role: 'user',
            content: '[Systeem: je hebt genoeg antwoorden verzameld. Geef nu mode "voorstel" met een volledig plan-object en choices om de pagina te maken of aan te passen. Alleen geldige JSON.]'
        });
    }

    const runOnce = (model, extraMessages) => chatTimed({
        apiKey: ai.apiKey,
        baseUrl: ai.baseUrl,
        model: model,
        provider: ai.provider,
        messages: extraMessages || chatMessages,
        temperature: 0.5,
        maxTokens: chatMaxTokens(true, { voorstel: shouldVoorstel })
    }, CHAT_TIMEOUT_MS);

    const STRICT_JSON_NUDGE = {
        role: 'user',
        content: 'Je vorige antwoord was geen geldige JSON. Antwoord NU met ALLEEN één JSON-object (mode, reply, choices). Geen markdown, geen tekst buiten de JSON. Begin met { en eindig met }.'
    };

    const VOORSTEL_NUDGE = {
        role: 'user',
        content: 'Geef nu mode "voorstel" met een volledig plan (title, slug, design-object met alle 8 design-keuzes, secties met headline/preview, beelden, cta, generationPrompt met design) en choices zoals "Ja, maak de pagina". Alleen geldige JSON.'
    };

    async function fetchAndParse(extraMessages) {
        let content;
        try {
            content = await runOnce(ai.model, extraMessages);
        } catch (first) {
            if ((first.code === 'TIMEOUT' || first.code === 'API_ERROR') && ai.model !== CHAT_FALLBACK_MODEL) {
                content = await runOnce(CHAT_FALLBACK_MODEL, extraMessages);
            } else if (first.code === 'TIMEOUT' && ai.model !== SERVERLESS_CHAT_MODEL_ALT && IS_SERVERLESS) {
                content = await runOnce(SERVERLESS_CHAT_MODEL_ALT, extraMessages);
            } else {
                throw first;
            }
        }

        try {
            return { parsed: parseAgentResponse(content), raw: content };
        } catch (parseErr) {
            console.warn('[agent] JSON parse mislukt, raw (eerste 2500 tekens):', String(content || '').slice(0, 2500));
            const retryMsgs = [...(extraMessages || chatMessages), STRICT_JSON_NUDGE];
            let retryContent;
            try {
                retryContent = await runOnce(ai.model, retryMsgs);
            } catch (retryApi) {
                throw parseErr;
            }
            try {
                return { parsed: parseAgentResponse(retryContent), raw: retryContent, retried: true };
            } catch (retryParse) {
                console.warn('[agent] JSON retry mislukt, raw:', String(retryContent || '').slice(0, 2500));
                const degraded = degradeAgentResponse(retryContent) || degradeAgentResponse(content);
                if (degraded) return { parsed: degraded, raw: retryContent, degraded: true };
                throw parseErr;
            }
        }
    }

    let { parsed, degraded } = await fetchAndParse();

    let mode = ['begrip', 'voorstel', 'antwoord'].includes(parsed.mode) ? parsed.mode : 'begrip';
    const planObj = (parsed.plan && typeof parsed.plan === 'object') ? parsed.plan : null;

    if (planObj && mode === 'begrip' && userTurns >= 2) {
        mode = 'voorstel';
    }
    if (mode === 'voorstel' && userTurns < 2 && !/\b(voorbeeld|samenvatting|overzicht|klaar met vragen|maak.*voorstel)\b/i.test(
        String((messages.filter(m => m.role === 'user').pop() || {}).content || '')
    )) {
        mode = 'begrip';
    }

    if (shouldVoorstel && mode === 'begrip' && !planObj) {
        const { parsed: voorstelParsed } = await fetchAndParse([...chatMessages, VOORSTEL_NUDGE]);
        if (voorstelParsed) {
            parsed = voorstelParsed;
            mode = ['begrip', 'voorstel', 'antwoord'].includes(parsed.mode) ? parsed.mode : 'voorstel';
            if (parsed.plan && typeof parsed.plan === 'object') {
                mode = 'voorstel';
            }
        }
    }

    const suggestions = Array.isArray(parsed.suggestions)
        ? parsed.suggestions
            .map(s => String(s).trim())
            .filter(s => s)
            .slice(0, 6)
        : [];

    const choices = normalizeAgentChoices(parsed, mode);
    const choicesMultiple = !!(parsed.choicesMultiple || parsed.multiple);

    let plan = (parsed.plan && typeof parsed.plan === 'object') ? parsed.plan : null;
    if (plan) {
        plan = { ...plan, design: pageDesign.normalizeDesign(plan.design) };
        if (plan.generationPrompt) {
            const designBlock = pageDesign.getDesignPromptBlock(plan.design);
            const gp = String(plan.generationPrompt);
            if (!gp.includes('PAGINA-DESIGN')) {
                plan.generationPrompt = gp + '\n\n' + designBlock;
            }
        }
    }

    return {
        mode,
        reply: String(parsed.reply || 'Waar kan ik je mee helpen?'),
        choices,
        choicesMultiple,
        suggestions,
        plan,
        modelUsed: ai.model,
        degraded: !!(degraded || parsed._degraded)
    };
}

module.exports = {
    PROVIDERS,
    DEFAULT_PROVIDER,
    DEFAULT_BASE_URL,
    DEFAULT_MODEL,
    DEFAULT_PAGE_BUILDER_MODEL,
    SERVERLESS_PAGE_BUILDER_MODEL,
    SERVERLESS_CHAT_MODEL,
    SERVERLESS_CHAT_MODEL_ALT,
    CHAT_FALLBACK_MODEL,
    PAGE_BUILDER_FALLBACK_MODEL,
    IS_SERVERLESS,
    CHAT_TIMEOUT_MS,
    resolveAi,
    resolveChatAi,
    resolvePageBuilderAi,
    pageBuilderMaxTokens,
    chatMaxTokens,
    isConfigured,
    testConnection,
    chat,
    chatTimed,
    generatePage,
    planConversation,
    runSiteAgent,
    normalizeAgentChoices,
    summarizeBookings,
    stripCodeFences,
    buildSystemPrompt,
    buildPlannerSystemPrompt,
    buildStyleguideContext,
    describeStructure,
    buildStructureInstruction,
    extractJson,
    parseAgentResponse,
    extractFirstJsonObject,
    tryCloseTruncatedJson,
    degradeAgentResponse,
    tryParseJsonCandidate,
    repairJsonString,
    countUserTurns
};
