/**
 * Legendární léto 2026 — Backend (Google Apps Script)
 *
 * Sheets required:
 *   "chat"  — timestamp | name | message | answer | id | userId | deleted
 *   "news"  — timestamp | type | title | content | options | votes | image | active
 *
 * Script Properties (File → Project settings → Script properties):
 *   BOT_TOKEN  — Telegram bot token
 *   CHAT_ID    — Telegram chat ID for admin notifications
 *
 * Deploy as Web App: Execute as Me, Access: Anyone with link.
 */

/* ─── helpers ─── */
function getSheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === "chat") {
      sheet.appendRow(["timestamp", "name", "message", "answer", "id", "userId", "deleted"]);
    } else if (name === "news") {
      sheet.appendRow(["timestamp", "type", "title", "content", "options", "votes", "image", "active"]);
    }
  }
  return sheet;
}

function sheetToObjects(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var results = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    results.push(obj);
  }
  return results;
}

function genId() {
  return Utilities.getUuid().replace(/-/g, "").substring(0, 12);
}

/* ─── Telegram notification ─── */
function notifyTelegram(name, message) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty("BOT_TOKEN");
  var chatId = props.getProperty("CHAT_ID");
  if (!token || !chatId) return;
  var sheetsUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
  var text = "💬 Nová zpráva v chatu\n\n" +
    "👤 " + name + "\n" +
    "📝 " + message + "\n\n" +
    "📋 Odpovědět v tabulce:\n" + sheetsUrl;
  var url = "https://api.telegram.org/bot" + token + "/sendMessage";
  try {
    UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ chat_id: chatId, text: text, parse_mode: "HTML" }),
      muteHttpExceptions: true
    });
  } catch (e) { /* silent */ }
}

/* ─── doGet ─── */
function doGet(e) {
  var chatSheet = getSheet("chat");
  var newsSheet = getSheet("news");

  var messages = sheetToObjects(chatSheet).filter(function(m) {
    return String(m.deleted).toLowerCase() !== "true";
  }).map(function(m) {
    return {
      timestamp: m.timestamp,
      name: m.name,
      message: m.message,
      answer: m.answer || "",
      id: m.id,
      userId: m.userId
    };
  });

  var news = sheetToObjects(newsSheet).filter(function(n) {
    return String(n.active).toLowerCase() !== "false";
  }).map(function(n) {
    var item = {
      timestamp: n.timestamp,
      type: n.type,
      title: n.title,
      content: n.content,
      image: n.image || "",
      active: n.active
    };
    if (n.type === "poll") {
      try { item.options = JSON.parse(n.options); } catch (ex) { item.options = []; }
      try { item.votes = JSON.parse(n.votes); } catch (ex) { item.votes = {}; }
    }
    return item;
  });

  var output = JSON.stringify({ messages: messages, news: news });
  return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JSON);
}

/* ─── doPost ─── */
function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Invalid JSON" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var action = body.action;

  if (action === "newMessage") {
    return handleNewMessage(body);
  } else if (action === "delete") {
    return handleDelete(body);
  } else if (action === "vote") {
    return handleVote(body);
  }

  return ContentService.createTextOutput(JSON.stringify({ error: "Unknown action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ─── action handlers ─── */
function handleNewMessage(body) {
  var sheet = getSheet("chat");
  var id = genId();
  var timestamp = new Date().toISOString();
  sheet.appendRow([
    timestamp,
    body.name || "Anon",
    body.message || "",
    "",
    id,
    body.userId || "",
    "false"
  ]);
  notifyTelegram(body.name || "Anon", body.message || "");
  return ContentService.createTextOutput(JSON.stringify({ ok: true, id: id }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleDelete(body) {
  var sheet = getSheet("chat");
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf("id");
  var msgCol = headers.indexOf("message");
  var delCol = headers.indexOf("deleted");
  if (idCol < 0) {
    return ContentService.createTextOutput(JSON.stringify({ error: "No id column" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  for (var i = 1; i < data.length; i++) {
    if (data[i][idCol] === body.id) {
      if (msgCol >= 0) sheet.getRange(i + 1, msgCol + 1).setValue("[сообщение удалено]");
      if (delCol >= 0) sheet.getRange(i + 1, delCol + 1).setValue("true");
      break;
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleVote(body) {
  var sheet = getSheet("news");
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var titleCol = headers.indexOf("title");
  var votesCol = headers.indexOf("votes");
  var typeCol = headers.indexOf("type");
  if (titleCol < 0 || votesCol < 0) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Missing columns" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  for (var i = 1; i < data.length; i++) {
    if (data[i][typeCol] === "poll" && data[i][titleCol] === body.pollTitle) {
      var votes = {};
      try { votes = JSON.parse(data[i][votesCol]); } catch (ex) { votes = {}; }
      votes[body.userId] = body.option;
      sheet.getRange(i + 1, votesCol + 1).setValue(JSON.stringify(votes));
      break;
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
