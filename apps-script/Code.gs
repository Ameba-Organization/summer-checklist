/**
 * Summer Checklist — Google Apps Script backend.
 *
 * Stores chat messages in the bound Google Sheet and (optionally) sends a
 * Telegram notification to the admin whenever a new message arrives.
 *
 * IMPORTANT: the Telegram bot token MUST live only here, in Script Properties —
 * never in index.html, because the website is public.
 *
 * Setup:
 *  1. Open your Google Sheet → Extensions → Apps Script.
 *  2. Paste this file as Code.gs.
 *  3. Project Settings → Script properties → add:
 *       BOT_TOKEN      = <your fresh @BotFather token>
 *       CHAT_ID        = <admin chat id, e.g. 5417843713>
 *       SHEET_EDIT_URL = <link to this sheet> (optional, used in the notification)
 *  4. Deploy → New deployment → type "Web app":
 *       Execute as: Me
 *       Who has access: Anyone
 *  5. Copy the /exec URL into SHEETS_API_URL in index.html.
 *
 * The admin answers messages by typing into the "answer" column of the sheet.
 */

const SHEET_NAME = 'Messages';
const HEADERS = ['id', 'timestamp', 'name', 'message', 'userId', 'answer', 'deleted'];

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function colIndex() {
  const sheet = getSheet();
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn() || HEADERS.length).getValues()[0];
  const idx = {};
  header.forEach((name, i) => { idx[String(name).trim()] = i; });
  return idx;
}

function readMessages() {
  const sheet = getSheet();
  const range = sheet.getDataRange().getValues();
  if (range.length < 2) return [];
  const idx = colIndex();
  const out = [];
  for (let r = 1; r < range.length; r++) {
    const row = range[r];
    if (!row[idx.id] && !row[idx.message]) continue;
    out.push({
      id: String(row[idx.id]),
      timestamp: row[idx.timestamp] ? new Date(row[idx.timestamp]).toISOString() : '',
      name: row[idx.name],
      message: row[idx.message],
      userId: String(row[idx.userId]),
      answer: row[idx.answer] || '',
      deleted: row[idx.deleted] === true || String(row[idx.deleted]).toLowerCase() === 'true'
    });
  }
  return out;
}

function addMessage(message, name, userId) {
  const sheet = getSheet();
  const id = Utilities.getUuid();
  const timestamp = new Date();
  sheet.appendRow([id, timestamp, name || '', message || '', userId || '', '', false]);
  return { id: id, timestamp: timestamp.toISOString(), name: name, message: message, userId: userId };
}

function deleteMessage(id, userId) {
  const sheet = getSheet();
  const range = sheet.getDataRange().getValues();
  const idx = colIndex();
  for (let r = 1; r < range.length; r++) {
    if (String(range[r][idx.id]) === String(id) && String(range[r][idx.userId]) === String(userId)) {
      sheet.getRange(r + 1, idx.deleted + 1).setValue(true);
      return true;
    }
  }
  return false;
}

function notifyTelegram(msg) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('BOT_TOKEN');
  const chatId = props.getProperty('CHAT_ID');
  if (!token || !chatId) return;
  const editUrl = props.getProperty('SHEET_EDIT_URL') || '';
  let text = '\uD83D\uDCAC <b>Nov\u00E1 zpr\u00E1va z chatu webu</b>'
    + '\n\uD83D\uDC64 ' + escapeHtml(msg.name)
    + '\n\uD83D\uDCDD ' + escapeHtml(msg.message);
  if (editUrl) text += '\n\n\u270F\uFE0F Odpov\u011Bz zde: ' + editUrl;
  UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' }),
    muteHttpExceptions: true
  });
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return json(readMessages());
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'delete') {
      deleteMessage(data.id, data.userId);
      return json({ ok: true });
    }
    const saved = addMessage(data.message, data.name, data.userId);
    notifyTelegram(saved);
    return json({ ok: true, id: saved.id });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}
