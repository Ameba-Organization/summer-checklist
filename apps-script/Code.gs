/**
 * Summer Checklist — Google Apps Script backend.
 *
 * Handles three features, all stored in the bound Google Sheet:
 *   1. Chat with admin   (sheet "Messages")
 *   2. News / announcements (sheet "News")   — only the admin can post, everyone reads + reacts
 *   3. Polls / voting    (sheet "Polls")      — only the admin creates, everyone votes
 *
 * SECURITY:
 *   - The Telegram bot token MUST live only here, in Script Properties — never in index.html.
 *   - "Admin" actions (post/delete news, create/close/delete polls) require ADMIN_KEY, also
 *     stored in Script Properties. The website never contains this key; it is sent by the
 *     admin from the browser and verified here on the server.
 *
 * Setup:
 *  1. Open your Google Sheet → Extensions → Apps Script.
 *  2. Paste this file as Code.gs.
 *  3. Project Settings → Script properties → add:
 *       BOT_TOKEN      = <your fresh @BotFather token>
 *       CHAT_ID        = <admin chat id, e.g. 5417843713>
 *       ADMIN_KEY      = <any secret password you choose; you'll type it on the site>
 *       SHEET_EDIT_URL = <link to this sheet> (optional, used in the notification)
 *  4. Deploy → New deployment → type "Web app":
 *       Execute as: Me
 *       Who has access: Anyone
 *  5. Copy the /exec URL into SHEETS_API_URL in index.html.
 *
 * The admin answers chat messages by typing into the "answer" column of the "Messages" sheet.
 */

const SHEET_NAME = 'Messages';
const HEADERS = ['id', 'timestamp', 'name', 'message', 'userId', 'answer', 'deleted'];
const NEWS_SHEET = 'News';
const NEWS_HEADERS = ['id', 'timestamp', 'title', 'body', 'reactions', 'deleted'];
const POLLS_SHEET = 'Polls';
const POLLS_HEADERS = ['id', 'timestamp', 'question', 'options', 'votes', 'closed'];

/* ---------- generic sheet helpers ---------- */
function getSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function colIndex(sheet) {
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1).getValues()[0];
  const idx = {};
  header.forEach((name, i) => { idx[String(name).trim()] = i; });
  return idx;
}

function isTrue(v) { return v === true || String(v).toLowerCase() === 'true'; }
function parseJson(v, fallback) { try { return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }

/* ---------- chat messages ---------- */
function readMessages() {
  const sheet = getSheet(SHEET_NAME, HEADERS);
  const range = sheet.getDataRange().getValues();
  if (range.length < 2) return [];
  const idx = colIndex(sheet);
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
      deleted: isTrue(row[idx.deleted])
    });
  }
  return out;
}

function addMessage(message, name, userId) {
  const sheet = getSheet(SHEET_NAME, HEADERS);
  const id = Utilities.getUuid();
  const timestamp = new Date();
  sheet.appendRow([id, timestamp, name || '', message || '', userId || '', '', false]);
  return { id: id, timestamp: timestamp.toISOString(), name: name, message: message, userId: userId };
}

function deleteMessage(id, userId) {
  const sheet = getSheet(SHEET_NAME, HEADERS);
  const range = sheet.getDataRange().getValues();
  const idx = colIndex(sheet);
  for (let r = 1; r < range.length; r++) {
    if (String(range[r][idx.id]) === String(id) && String(range[r][idx.userId]) === String(userId)) {
      sheet.getRange(r + 1, idx.deleted + 1).setValue(true);
      return true;
    }
  }
  return false;
}

/* ---------- news ---------- */
function readNews() {
  const sheet = getSheet(NEWS_SHEET, NEWS_HEADERS);
  const range = sheet.getDataRange().getValues();
  if (range.length < 2) return [];
  const idx = colIndex(sheet);
  const out = [];
  for (let r = 1; r < range.length; r++) {
    const row = range[r];
    if (!row[idx.id]) continue;
    if (isTrue(row[idx.deleted])) continue;
    out.push({
      id: String(row[idx.id]),
      timestamp: row[idx.timestamp] ? new Date(row[idx.timestamp]).toISOString() : '',
      title: row[idx.title],
      body: row[idx.body],
      reactions: parseJson(row[idx.reactions], {})
    });
  }
  return out;
}

function addNews(title, body) {
  const sheet = getSheet(NEWS_SHEET, NEWS_HEADERS);
  const id = Utilities.getUuid();
  const ts = new Date();
  sheet.appendRow([id, ts, title || '', body || '', '{}', false]);
  return { id: id, timestamp: ts.toISOString(), title: title || '', body: body || '' };
}

function deleteNews(id) {
  const sheet = getSheet(NEWS_SHEET, NEWS_HEADERS);
  const range = sheet.getDataRange().getValues();
  const idx = colIndex(sheet);
  for (let r = 1; r < range.length; r++) {
    if (String(range[r][idx.id]) === String(id)) {
      sheet.getRange(r + 1, idx.deleted + 1).setValue(true);
      return true;
    }
  }
  return false;
}

function reactNews(id, emoji, userId) {
  if (!emoji || !userId) return false;
  const sheet = getSheet(NEWS_SHEET, NEWS_HEADERS);
  const range = sheet.getDataRange().getValues();
  const idx = colIndex(sheet);
  for (let r = 1; r < range.length; r++) {
    if (String(range[r][idx.id]) === String(id)) {
      const reactions = parseJson(range[r][idx.reactions], {});
      if (!reactions[emoji]) reactions[emoji] = [];
      const pos = reactions[emoji].indexOf(userId);
      if (pos >= 0) reactions[emoji].splice(pos, 1);
      else reactions[emoji].push(userId);
      if (!reactions[emoji].length) delete reactions[emoji];
      sheet.getRange(r + 1, idx.reactions + 1).setValue(JSON.stringify(reactions));
      return true;
    }
  }
  return false;
}

/* ---------- polls ---------- */
function readPolls() {
  const sheet = getSheet(POLLS_SHEET, POLLS_HEADERS);
  const range = sheet.getDataRange().getValues();
  if (range.length < 2) return [];
  const idx = colIndex(sheet);
  const out = [];
  for (let r = 1; r < range.length; r++) {
    const row = range[r];
    if (!row[idx.id]) continue;
    out.push({
      id: String(row[idx.id]),
      timestamp: row[idx.timestamp] ? new Date(row[idx.timestamp]).toISOString() : '',
      question: row[idx.question],
      options: parseJson(row[idx.options], []),
      votes: parseJson(row[idx.votes], {}),
      closed: isTrue(row[idx.closed])
    });
  }
  return out;
}

function addPoll(question, options) {
  const sheet = getSheet(POLLS_SHEET, POLLS_HEADERS);
  const id = Utilities.getUuid();
  const ts = new Date();
  const opts = Array.isArray(options) ? options.filter(o => String(o).trim()).map(o => String(o)) : [];
  sheet.appendRow([id, ts, question || '', JSON.stringify(opts), '{}', false]);
  return { id: id, timestamp: ts.toISOString() };
}

function deletePoll(id) {
  const sheet = getSheet(POLLS_SHEET, POLLS_HEADERS);
  const range = sheet.getDataRange().getValues();
  const idx = colIndex(sheet);
  for (let r = 1; r < range.length; r++) {
    if (String(range[r][idx.id]) === String(id)) {
      sheet.deleteRow(r + 1);
      return true;
    }
  }
  return false;
}

function closePoll(id) {
  const sheet = getSheet(POLLS_SHEET, POLLS_HEADERS);
  const range = sheet.getDataRange().getValues();
  const idx = colIndex(sheet);
  for (let r = 1; r < range.length; r++) {
    if (String(range[r][idx.id]) === String(id)) {
      sheet.getRange(r + 1, idx.closed + 1).setValue(true);
      return true;
    }
  }
  return false;
}

function votePoll(id, optionIndex, userId) {
  if (!userId) return false;
  const sheet = getSheet(POLLS_SHEET, POLLS_HEADERS);
  const range = sheet.getDataRange().getValues();
  const idx = colIndex(sheet);
  for (let r = 1; r < range.length; r++) {
    if (String(range[r][idx.id]) === String(id)) {
      if (isTrue(range[r][idx.closed])) return false;
      const votes = parseJson(range[r][idx.votes], {});
      Object.keys(votes).forEach(k => { votes[k] = (votes[k] || []).filter(u => u !== userId); });
      const key = String(optionIndex);
      if (!votes[key]) votes[key] = [];
      votes[key].push(userId);
      sheet.getRange(r + 1, idx.votes + 1).setValue(JSON.stringify(votes));
      return true;
    }
  }
  return false;
}

/* ---------- admin ---------- */
function isAdmin(key) {
  const real = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  return !!real && String(key) === String(real);
}

/* ---------- Telegram ---------- */
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
  sendTelegram(token, chatId, text);
}

function notifyTelegramNews(news) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('BOT_TOKEN');
  const chatId = props.getProperty('CHAT_ID');
  if (!token || !chatId) return;
  const text = '\uD83D\uDCF0 <b>Nov\u00E1 novinka</b>'
    + '\n<b>' + escapeHtml(news.title) + '</b>'
    + (news.body ? '\n' + escapeHtml(news.body) : '');
  sendTelegram(token, chatId, text);
}

function sendTelegram(token, chatId, text) {
  UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' }),
    muteHttpExceptions: true
  });
}

/* ---------- utils ---------- */
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- HTTP entry points ---------- */
function doGet(e) {
  const p = (e && e.parameter) || {};
  const type = p.type || 'messages';
  if (type === 'news') return json(readNews());
  if (type === 'polls') return json(readPolls());
  if (type === 'verify') return json({ admin: isAdmin(p.key) });
  return json(readMessages());
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const type = data.type || 'message';
    if (type === 'news') return handleNews(data);
    if (type === 'poll') return handlePoll(data);
    // chat message (default, backward compatible)
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

function handleNews(data) {
  if (data.action === 'react') {
    return json({ ok: reactNews(data.id, data.emoji, data.userId) });
  }
  if (!isAdmin(data.adminKey)) return json({ ok: false, error: 'unauthorized' });
  if (data.action === 'delete') return json({ ok: deleteNews(data.id) });
  const saved = addNews(data.title, data.body);
  notifyTelegramNews(saved);
  return json({ ok: true, id: saved.id });
}

function handlePoll(data) {
  if (data.action === 'vote') {
    return json({ ok: votePoll(data.id, data.optionIndex, data.userId) });
  }
  if (!isAdmin(data.adminKey)) return json({ ok: false, error: 'unauthorized' });
  if (data.action === 'delete') return json({ ok: deletePoll(data.id) });
  if (data.action === 'close') return json({ ok: closePoll(data.id) });
  const saved = addPoll(data.question, data.options);
  return json({ ok: true, id: saved.id });
}
