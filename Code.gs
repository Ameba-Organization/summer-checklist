/**
 * Legendary Summer 2026 — Google Apps Script backend
 *
 * Spreadsheet must contain two sheets:
 *
 *   Sheet "chat"  headers (row 1):
 *     timestamp | name | message | answer | id | userId | deleted
 *
 *   Sheet "news"  headers (row 1):
 *     timestamp | type | title | content | options | votes | image | active
 *
 * Deploy: Deploy > New deployment > Web app
 *   - Execute as: Me
 *   - Who has access: Anyone
 * Copy the /exec URL into SHEETS_API_URL in index.html.
 */

var CHAT_SHEET = "chat";
var NEWS_SHEET = "news";

// ---------- GET: return all messages + news ----------
function doGet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var payload = {
    messages: readSheet(ss, CHAT_SHEET),
    news: readSheet(ss, NEWS_SHEET)
  };
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- POST: handle actions ----------
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return jsonOut({ ok: false, error: "busy" });
  }

  try {
    var params = {};
    if (e && e.postData && e.postData.contents) {
      try { params = JSON.parse(e.postData.contents); }
      catch (err) { params = (e.parameter || {}); }
    } else {
      params = (e && e.parameter) || {};
    }

    var action = params.action || "newMessage";

    if (action === "newMessage") {
      handleNewMessage(params);
    } else if (action === "delete") {
      handleDelete(params);
    } else if (action === "vote") {
      handleVote(params);
    }
    return jsonOut({ ok: true });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// ---------- Helpers ----------
function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function readSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0].map(function (h) { return String(h).trim(); });
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    var empty = true;
    for (var j = 0; j < headers.length; j++) {
      if (!headers[j]) continue;
      var val = data[i][j];
      if (val instanceof Date) val = val.toISOString();
      obj[headers[j]] = val;
      if (val !== "" && val !== null) empty = false;
    }
    if (!empty) rows.push(obj);
  }
  return rows;
}

function headerMap(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    map[String(headers[i]).trim()] = i; // 0-based
  }
  return map;
}

// ---------- Actions ----------
function handleNewMessage(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CHAT_SHEET);
  if (!sheet) throw new Error("chat sheet not found");
  var map = headerMap(sheet);

  var row = new Array(sheet.getLastColumn()).fill("");
  if (map.timestamp !== undefined) row[map.timestamp] = new Date().toISOString();
  if (map.name !== undefined) row[map.name] = params.name || "";
  if (map.message !== undefined) row[map.message] = params.message || "";
  if (map.answer !== undefined) row[map.answer] = "";
  if (map.id !== undefined) row[map.id] = params.id || Utilities.getUuid();
  if (map.userId !== undefined) row[map.userId] = params.userId || "";
  if (map.deleted !== undefined) row[map.deleted] = false;

  sheet.appendRow(row);
}

function handleDelete(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CHAT_SHEET);
  if (!sheet) return;
  var map = headerMap(sheet);
  if (map.id === undefined) return;

  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    var rowId = String(values[i][map.id]);
    var rowUser = map.userId !== undefined ? String(values[i][map.userId]) : "";
    if (rowId === String(params.id) && rowUser === String(params.userId)) {
      if (map.message !== undefined) sheet.getRange(i + 1, map.message + 1).setValue("[deleted]");
      if (map.deleted !== undefined) sheet.getRange(i + 1, map.deleted + 1).setValue(true);
      return;
    }
  }
}

function handleVote(params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(NEWS_SHEET);
  if (!sheet) return;
  var map = headerMap(sheet);
  if (map.title === undefined || map.votes === undefined) return;

  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    var title = String(values[i][map.title]);
    if (title === String(params.title)) {
      var votes = {};
      var raw = values[i][map.votes];
      if (raw) { try { votes = JSON.parse(raw); } catch (e) { votes = {}; } }
      votes[params.userId] = params.option;
      sheet.getRange(i + 1, map.votes + 1).setValue(JSON.stringify(votes));
      return;
    }
  }
}
