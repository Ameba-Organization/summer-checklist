# ☀️ Legendary Summer 2026 — Checklist & Chat

Jednostránková aplikace (`index.html`) pro letní výzvy: checklist 44 úkolů v 6
kategoriích, achievementy, kalendář aktivity, počítadla dní léta a chat s adminem.
Bez build kroku — stačí otevřít `index.html` nebo nasadit na GitHub Pages.

## Funkce

- 📋 **Checklist** — 44 úkolů, 6 kategorií, dvojjazyčně (🇨🇿 / 🇷🇺), poznámky u úkolů.
- 🔍 **Hledání a filtry** — fulltext + filtr Vše / Nesplněné / Splněné.
- 🏅 **Achievementy**, 📅 **kalendář aktivity**, 🏆 **progress bar** + konfety.
- 🌙 **Světlý / tmavý režim**, 🔊 zvuk, 🔔 notifikace odpovědí.
- 💬 **Chat s adminem** přes Google Sheets, s upozorněním do Telegramu.
- 💾 Vše se ukládá lokálně v prohlížeči (`localStorage`).

## Konfigurace

V `index.html` (sekce `CONFIG`) nastav:

| Konstanta         | Význam                                            |
|-------------------|---------------------------------------------------|
| `SHEETS_API_URL`  | `/exec` URL nasazeného Apps Scriptu (web app).    |
| `SHEETS_EDIT_URL` | Odkaz na Google tabulku (jen pro pohodlí admina). |

> ⚠️ **Bezpečnost:** token Telegram bota **nikdy** nedávej do `index.html` —
> stránka je veřejná a token by se dal odcizit. Token patří výhradně do
> Apps Scriptu (Script Properties). Pokud token unikl, ihned ho zruš přes
> [@BotFather](https://t.me/BotFather) (`/revoke`) a vytvoř nový.

## Backend (Google Apps Script)

Kód a postup jsou v [`apps-script/Code.gs`](apps-script/Code.gs). Stručně:

1. Google Sheet → **Extensions → Apps Script**, vlož `Code.gs`.
2. **Project Settings → Script properties**:
   - `BOT_TOKEN` = nový token z @BotFather
   - `CHAT_ID` = chat id admina
   - `SHEET_EDIT_URL` = odkaz na tabulku (volitelné)
3. **Deploy → New deployment → Web app** (Execute as: *Me*, Access: *Anyone*).
4. `/exec` URL vlož do `SHEETS_API_URL` v `index.html`.

Admin odpovídá tak, že vyplní sloupec `answer` v tabulce.

## Lokální spuštění

```bash
python3 -m http.server 8080
# otevři http://localhost:8080
```
