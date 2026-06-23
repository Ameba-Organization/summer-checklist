# ✨ Legendární léto 2026 ✨

Webová aplikace pro sledování 44 letních dobrodružství vaší party kamarádů. Běží na GitHub Pages, data se ukládají v Google Sheets.

**Live:** https://ameba-organization.github.io/summer-checklist/

## Funkce

- 📋 **Checklist** — 44 úkolů v 6 kategoriích (dobrodružství, příroda, výzvy, noční, skupinové, vzpomínky)
- 🏆 **Achievements** — 7 ačivek (první krev, půlka, legenda, zálesák, noční tvor, parta, legendární)
- 📅 **Kalendář aktivity** — červen–srpen 2026, podsvícené dny
- 💬 **Chat s adminem** — zprávy se ukládají do Google Sheets, admin odpovídá v tabulce, odpovědi se zobrazí automaticky
- 📰 **Novinky & Hlasování** — feed z tabulky, hlasování jedním klikem
- 🔔 **Upozornění** — badge na ikoně + browser notifications
- 🌐 **Čeština / Ruština** — přepínání v nastavení
- 🔊 **Zvuk** — krátký ping při odškrtnutí
- 📊 **O webu** — odpočet dní, meter localStorage

## Struktura Google Sheets

### List `chat`
| timestamp | name | message | answer | id | userId | deleted |
|-----------|------|---------|--------|----|--------|---------|

### List `news`
| timestamp | type | title | content | options | votes | image | active |
|-----------|------|-------|---------|---------|-------|-------|--------|

- `type` = `news` nebo `poll`
- `options` = JSON pole variant (např. `["Ano","Ne"]`)
- `votes` = JSON objekt (např. `{"userId123":"Ano"}`)
- `image` = URL obrázku (volitelné)
- `active` = `true` / `false`

## Nasazení

### 1. Google Apps Script

1. Otevřete svou Google tabulku → **Rozšíření → Apps Script**
2. Smažte výchozí kód a vložte obsah souboru `apps-script/Code.gs`
3. V Apps Script → **Nastavení projektu → Vlastnosti skriptu** přidejte:
   - `BOT_TOKEN` — token vašeho Telegram bota (z @BotFather)
   - `CHAT_ID` — vaše chat ID v Telegramu
4. **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Zkopírujte URL (to je vaše `SHEETS_API_URL`)

### 2. index.html

V souboru `index.html` nahoře v sekci `CONFIG` nastavte:
```javascript
const SHEETS_API_URL = "váš_URL_z_kroku_5";
const SHEETS_EDIT_URL = "odkaz_na_tabulku";
```

### 3. GitHub Pages

1. Pushněte soubory do repozitáře
2. Settings → Pages → Branch: `main`, folder: `/ (root)` → Save
3. Stránka bude dostupná na `https://váš-username.github.io/název-repozitáře/`

## Jak přidávat novinky a hlasování

Vše se přidává přímo do listu `news` v Google Sheets:

**Novinka:**
```
timestamp: 2026-06-25T10:00:00Z
type: news
title: Piknik v sobotu!
content: Sejdeme se v parku v 14:00. Vezměte si pití.
options: (prázdné)
votes: (prázdné)
image: (volitelné URL)
active: true
```

**Hlasování:**
```
timestamp: 2026-06-25T10:00:00Z
type: poll
title: Kam jedeme v sobotu?
content: (volitelné)
options: ["Park","Les","Rybník"]
votes: {}
image: (prázdné)
active: true
```

## Technologie

- Vanilla HTML/CSS/JS (jeden soubor)
- Google Apps Script (backend)
- Google Sheets (databáze)
- GitHub Pages (hosting)
- canvas-confetti (efekt)
- Web Audio API (zvuk)
- Inter font (Google Fonts)
