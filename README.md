# DeurMeester — website + CMS

Website met volledig beheer: live builder, boekingen, e-mailflows,
media en instellingen.

## Lokaal starten

```bash
cd app
npm install        # eenmalig
npm start          # http://localhost:4000 (of PORT=1234 npm start)
```

- **Website:** http://localhost:4000/
- **Beheer:** http://localhost:4000/admin
- **Wachtwoord:** `democms`

## Beheeromgeving

Na inloggen verdwijnt het loginscherm. De zijbalk biedt:

| Sectie | Functie |
|--------|---------|
| **Dashboard** | Statistieken + recente boekingen |
| **Boekingen** | Overzicht, filters, zoeken, CSV-export, status wijzigen |
| **Website** | Start live builder (`/?edit=1`) |
| **Media** | Afbeeldingen uploaden en beheren |
| **E-mails** | Postvak + bewerkbare sjablonen (bevestiging + melding) |
| **Pagina's** | Extra pagina's aanmaken en publiceren op `/p/:slug` |
| **AI-agent** | Nieuwe pagina's laten genereren via Kimi (Moonshot) |
| **Huisstijl** | Stijlgids (kleuren, fonts, tone of voice) voor de agent |
| **Instellingen** | Bedrijfsgegevens, SMTP en Kimi API-sleutel |

## E-mailflows

Bij elke boeking via de website worden automatisch twee e-mails aangemaakt:

1. **Bevestiging** naar de gast
2. **Melding** naar de meldingsontvanger (instelbaar onder Instellingen)

Zonder SMTP-configuratie worden berichten alleen in het **postvak** bewaard
(status: "niet-verzonden"). Vul onder Instellingen → SMTP host, poort,
gebruikersnaam en wachtwoord in om echt te versturen. Gebruik "Test-e-mail
versturen" om dit te controleren.

Sjablonen bewerken onder **E-mails → Sjablonen**. Beschikbare variabelen:
`{{name}}`, `{{email}}`, `{{type}}`, `{{period}}`, `{{size}}`, `{{space}}`,
`{{extras}}`, `{{notes}}`, `{{id}}`, `{{siteName}}`.

## AI-agent (Kimi)

De agent kan op twee manieren met Kimi koppelen. Kies onder **Instellingen →
AI-agent** bij "Koppeling":

- **OpenRouter** (aanbevolen, flexibel): sleutel via [openrouter.ai/keys](https://openrouter.ai/keys).
  Base URL `https://openrouter.ai/api/v1`, model `moonshotai/kimi-k2.6` (of bv. `moonshotai/kimi-k2.5`).
- **Kimi (Moonshot direct)**: sleutel via [platform.moonshot.ai](https://platform.moonshot.ai).
  Base URL `https://api.moonshot.ai/v1`, model `kimi-k2.6`.

Het **Model** kies je via een dropdown met de gangbare modellen per koppeling
(voor OpenRouter o.a. `moonshotai/kimi-k2.6`, `moonshotai/kimi-k2.5` en
`moonshotai/kimi-k2`). Wil je een ander model gebruiken, kies dan **Aangepast
model…** en vul de modelnaam zelf in.

Bij het wisselen van koppeling worden base URL en model automatisch ingevuld.
Klik op **Verbinding testen** om te controleren.

Daarna:
1. Gebruik **AI-agent** in het menu: beschrijf de gewenste pagina → preview → opslaan.
2. Publiceer onder **Pagina's**; de pagina staat live op `/p/jouw-slug`.

De stijlgids onder **Huisstijl** (en `site-base.css`) zorgt dat gegenereerde pagina's in de huisstijl blijven. Gebruik **Sync uit website** na designwijzigingen aan de homepage.

## Structuur

```
app/
├── server.js              Express-server + API
├── lib/mailer.js          E-mailverzending (nodemailer + postvak)
├── lib/aiagent.js         Kimi-paginageneratie
├── data/                  JSON-opslag (boekingen, content, settings, outbox)
├── public/                Website + live builder
└── admin/                 Beheeromgeving (SPA)
```

## Productie (later)

- Zet `ADMIN_PASSWORD` en `SESSION_SECRET` als omgevingsvariabelen.
- Draai achter HTTPS.
- Host met Node.js-ondersteuning (VPS, Render, Railway, etc.).
