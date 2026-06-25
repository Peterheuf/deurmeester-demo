# CMS-engine architectuur & nieuwe site opzetten

Dit document beschrijft hoe de **ontwerp-onafhankelijke CMS-engine** werkt en hoe je
dezelfde engine op een andere site inzet. DeurMeester is de huidige site.

## Laagscheiding

```text
Engine (herbruikbaar)          Theme (per site)              Data
─────────────────────          ────────────────              ────
il-scan.js                     theme/site.config.json        content.json
il-apply.js                    site-base.css                 pages.json
builder.js                     index.html / markup           bookings.json
elements.js (registry)         images/
wireframes.js (structuur)
agent-actions.js
```

**Kern:** engine-bestanden blijven ongewijzigd. Per nieuwe site verschilt alleen de
theme-laag (tokens, CSS, markup, `site.config.json`).

## Theme-manifest (`app/theme/site.config.json`)

Bevat sitespecifieke instellingen die vroeger hardcoded in de engine zaten:

| Veld | Doel |
| --- | --- |
| `logoSelectors` | CSS-selectors voor het site-logo |
| `heroBgSelector` | Hero-achtergrondafbeelding |
| `skipClasses` / `skipSubtrees` | Decoratieve elementen uitsluiten van bewerking |
| `chromeSections` | Topstrip, nav, footer (site-breed) |
| `homepageSections` | Secties op de homepage |
| `colorTokens` | Kleur-swatches in de builder |

Publiek beschikbaar via `GET /api/site-config` en geladen als
`/assets/site-config.js` (`window.ILSiteConfig`).

## Live builder

| Bestand | Rol |
| --- | --- |
| `il-scan.js` | Scant bewerkbare elementen; leest selectors uit `ILSiteConfig` |
| `il-apply.js` | Past tekst, links, afbeeldingen én per-element `style` toe |
| `builder.js` | Visuele editor: Element / Pagina / Stijl tabs |
| `content-loader.js` | Homepage: laadt overrides uit `content.json` |

### Per-element styling

In `content.json` kan per sleutel een `style`-object staan:

```json
{
  "edits": {
    "sec2.1": {
      "text": "Plan je bezoek",
      "style": {
        "color": "#1a1714",
        "fontSize": "1.25rem",
        "paddingTop": "8px"
      }
    }
  }
}
```

Op losse `/p/`-pagina's worden stijlen als **inline `style`-attributen** in de
opgeslagen HTML bewaard (volledig portable). Chrome (nav/footer) blijft in
`content.json`.

## Herbruikbare elementen (widgets)

| Bestand | Rol |
| --- | --- |
| `lib/elements.js` | Registry: `{ id, name, category, html, css, scripts }` |
| `GET /api/elements` | Catalogus (metadata) |
| `GET /api/elements/:id` | Volledige HTML voor plaatsing |
| `elements-init.js` | Activeert widgets op elke pagina |
| `booking-widget.js` | Boekingsmodule (meerstaps formulier) |

In de live builder (paginamodus): **+ Element toevoegen** binnen `<main>`.

## Wireframe-composer

Low-fi structuurblokken (`lib/wireframes.js`) → opslaan als conceptpagina →
verder bewerken in de live builder of via de AI-assistent.

| Endpoint | Rol |
| --- | --- |
| `GET /api/wireframes` | Wireframe-catalogus |

## AI-assistent

De oude pagina-generator (`/api/ai/plan`, `/api/ai/generate-page`) is verwijderd.
De nieuwe assistent werkt met een **actie-/commandoschema**:

| Endpoint | Rol |
| --- | --- |
| `POST /api/agent/run` | Vertaalt opdracht → acties → voert uit |
| `POST /api/ai/test` | Test API-verbinding (Instellingen) |

Acties (via `lib/agent-actions.js`):

- `list_pages`, `list_elements`
- `create_page`, `append_wireframe_page`
- `place_element` (bv. `booking` op een pagina)

Admin: **AI-assistent** (`#view-agent`) — chat-interface met actieresultaten en
links naar de builder.

## Nieuwe site opzetten

1. **Theme-laag aanmaken**
   - Kopieer `theme/site.config.json` en pas selectors/secties/tokens aan.
   - Genereer `/assets/site-config.js`: `window.ILSiteConfig = { ... };`
   - Eigen `site-base.css`, markup (`index.html`), images.

2. **Engine ongewijzigd laden**
   ```html
   <script src="/assets/site-config.js"></script>
   <script src="/assets/il-scan.js"></script>
   <script src="/assets/il-apply.js"></script>
   <script src="/assets/content-loader.js"></script>
   <script src="/assets/elements-init.js"></script>
   ```

3. **Optioneel: eigen elementen**
   - Voeg definities toe in `lib/elements.js` (of een site-specifieke extend-laag).

4. **Wireframes**
   - De generieke catalogus in `wireframes.js` werkt site-agnostisch.
   - Stijl komt uit `site-base.css` + styleguide.

5. **Opslag**
   - `stripBuilderArtifacts()` verwijdert builder-attributen maar **behoudt inline styles**.

## Legacy

- `blocks.js` / `blocks.css` — oude gestylede blokken; blijven als bouwsteen.
- `aiagent.js` — bevat nog `generatePage`/`planConversation` voor intern hergebruik;
  niet meer exposed in de admin-UI.
