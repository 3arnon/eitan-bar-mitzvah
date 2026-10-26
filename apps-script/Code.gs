/**
 * בר המצווה של איתן: קבלת אישורי הגעה מדף ההזמנה, תזכורת במייל לאורחים יום לפני,
 * וסיכום יומי במייל אליך על תשובות חדשות.
 *
 * הקוד הזה מודבק לתוך Google Sheets (תוספים > Apps Script) ורץ בחשבון Google שלך.
 * שום מידע על אורחים לא נשמר מחוץ לגיליון.
 *
 * ההקמה אוטומטית: בפנייה הראשונה לשירות נוצרות הלשוניות ומופעלות שתי הבדיקות היומיות.
 * אפשר גם להריץ ידנית את setup, ומהתפריט "בר מצווה" לשלוח לעצמך תזכורת לדוגמה או סיכום לדוגמה.
 */

var TZ = 'Asia/Jerusalem';
var SHEET_RSVP = 'אישורי הגעה';
var SHEET_SUMMARY = 'סיכום';
var SHEET_SETTINGS = 'הגדרות';

var HEADERS = ['התקבל', 'שם מלא', 'סטטוס', 'מספר אנשים', 'חלק', 'מייל', 'הערה', 'כפילות', 'תזכורת נשלחה'];
var COL = { received: 1, name: 2, status: 3, count: 4, part: 5, email: 6, note: 7, duplicate: 8, reminded: 9 };

var STATUS_YES = 'מגיעים';
var STATUS_NO = 'לא מגיעים';
var PARTS = { both: 'עלייה לתורה ואירוע', synagogue: 'עלייה לתורה בלבד', event: 'אירוע בלבד' };
var DUPLICATE_MARK = 'כפול, לבדוק';

var MAX_GUESTS = 20;
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
var EMAIL_QUOTA_WARNING = 90; // חשבון Gmail רגיל שולח עד כ-100 מיילים ביום

var SETTINGS = [
  ['תאריך האירוע (שנה-חודש-יום)', '2026-11-19'],
  ['שם החוגג', 'איתן'],
  ['עלייה לתורה', 'בשעה 10:30, בית הכנסת במושב ביצרון'],
  ['אירוע', 'בשעה 12:00, ג\'וייס, מושב ביצרון'],
  ['קישור לדף ההזמנה', 'https://3arnon.github.io/eitan-bar-mitzvah/'],
  ['חתימה', 'משפחת ונטורה']
];

/* ---------- הקמה ---------- */

function setup() {
  var ss = SpreadsheetApp.getActive();
  ensureSheets_(ss);
  ensureTrigger_();
  ss.toast('נוצרו הלשוניות. סיכום יומי אליך ב-8:00, תזכורות לאורחים ב-9:00.', 'ההקמה הושלמה', 10);
}

// מחזיר מה מוכן, כדי שאפשר יהיה לבדוק את השירות מבחוץ. לא נוגע במה שכבר קיים.
function ensureSetup_() {
  var ss = SpreadsheetApp.getActive();
  var state = { sheets: false, reminderTrigger: false, summaryTrigger: false };
  if (!ss.getSheetByName(SHEET_RSVP) || !ss.getSheetByName(SHEET_SETTINGS) || !ss.getSheetByName(SHEET_SUMMARY)) {
    ensureSheets_(ss);
  }
  state.sheets = true;
  try {
    ensureTrigger_();
    var handlers = triggerHandlers_();
    state.reminderTrigger = handlers.indexOf('sendReminders') >= 0;
    state.summaryTrigger = handlers.indexOf('sendDailySummary') >= 0;
  } catch (err) {
    state.triggerError = String(err && err.message || err);
  }
  return state;
}

function triggerHandlers_() {
  return ScriptApp.getProjectTriggers().map(function (trigger) { return trigger.getHandlerFunction(); });
}

function ensureTrigger_() {
  var handlers = triggerHandlers_();
  if (handlers.indexOf('sendReminders') < 0) {
    ScriptApp.newTrigger('sendReminders').timeBased().everyDays(1).atHour(9).inTimezone(TZ).create();
  }
  if (handlers.indexOf('sendDailySummary') < 0) {
    ScriptApp.newTrigger('sendDailySummary').timeBased().everyDays(1).atHour(8).inTimezone(TZ).create();
  }
}

function ensureSheets_(ss) {
  var rsvp = ensureSheet_(ss, SHEET_RSVP);
  if (rsvp.getLastRow() === 0) rsvp.appendRow(HEADERS);
  rsvp.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#0f2147').setFontColor('#ffffff');
  rsvp.setFrozenRows(1);
  rsvp.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm');

  var settings = ensureSheet_(ss, SHEET_SETTINGS);
  if (settings.getLastRow() === 0) {
    settings.getRange(1, 1, SETTINGS.length, 2).setNumberFormat('@').setValues(SETTINGS);
    settings.getRange(1, 1, SETTINGS.length, 1).setFontWeight('bold');
    settings.setColumnWidth(1, 240);
    settings.setColumnWidth(2, 380);
  }

  ensureSheet_(ss, SHEET_SUMMARY);
  refresh_();
}

function ensureSheet_(ss, name) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  sheet.setRightToLeft(true);
  return sheet;
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('בר מצווה')
    .addItem('רענון סיכום וכפילויות', 'refreshSummary')
    .addItem('שליחת תזכורת לדוגמה אליי', 'testReminder')
    .addItem('שליחת סיכום יומי לדוגמה אליי', 'testDailySummary')
    .addToUi();
}

function refreshSummary() {
  refresh_();
}

// עריכה ידנית בגיליון (למשל מחיקת שורה כפולה) מעדכנת את הסיכום מיד
function onEdit(e) {
  if (e && e.range && e.range.getSheet().getName() === SHEET_RSVP) refresh_();
}

/* ---------- קבלת אישור הגעה מהדף ---------- */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var data = JSON.parse(e.postData.contents);

    // שדה מלכודת: אדם לא רואה אותו, בוט ממלא אותו. לא שומרים ולא מגלים לבוט שנחסם.
    if (data.website) return json_({ ok: true });

    var row = buildRow_(data);
    ensureSetup_();
    SpreadsheetApp.getActive().getSheetByName(SHEET_RSVP).appendRow(row);
    refresh_();
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

// בדיקת תקינות: פתיחת כתובת השירות מקימה את מה שחסר ומדווחת מה מוכן. לא חושפת שום נתון.
function doGet() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var state = ensureSetup_();
    return json_({
      ok: true,
      service: 'rsvp',
      sheets: state.sheets,
      reminderTrigger: state.reminderTrigger,
      summaryTrigger: state.summaryTrigger,
      triggerError: state.triggerError || '',
      pageLink: !!settings_().pageUrl
    });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function buildRow_(data) {
  var name = clean_(data.name, 80);
  if (name.length < 2) throw new Error('חסר שם מלא');
  if (data.attending !== 'yes' && data.attending !== 'no') throw new Error('חסר סימון הגעה');

  var attending = data.attending === 'yes';
  var count = '';
  var part = '';
  var email = '';
  if (attending) {
    count = Number(data.count);
    if (!(count >= 1 && count <= MAX_GUESTS) || Math.floor(count) !== count) throw new Error('מספר אנשים לא תקין');
    part = PARTS[data.part];
    if (!part) throw new Error('חסר סימון חלק');
    email = clean_(data.email, 120);
    if (email && !EMAIL_RE.test(email)) throw new Error('מייל לא תקין');
  }
  return [new Date(), name, attending ? STATUS_YES : STATUS_NO, count, part, email, clean_(data.note, 300), '', ''];
}

// מקצר, מנקה רווחים, ומונע מטקסט שמתחיל ב-= + - @ להתפרש כנוסחה בגיליון
function clean_(value, maxLength) {
  var text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

/* ---------- סיכום ובדיקות תקינות ---------- */

function readRows_() {
  var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_RSVP);
  var last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
}

function refresh_() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(SHEET_RSVP);
  var result = tally_(readRows_());
  var marks = result.marks;
  var t = result.totals;
  var warnings = result.warnings;
  if (marks.length) sheet.getRange(2, COL.duplicate, marks.length, 1).setValues(marks);

  var out = [
    ['סיכום אישורי הגעה', ''],
    ['סה"כ תשובות', t.replies],
    ['סה"כ אנשים שמגיעים', t.people],
    ['מגיעים לעלייה לתורה', t.synagogue],
    ['מגיעים לאירוע', t.event],
    ['תשובות "לא מגיעים"', t.declined],
    ['יקבלו תזכורת במייל', t.emails],
    ['עודכן', Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm')],
    ['', ''],
    ['התראות', warnings.length ? '' : 'אין']
  ];
  warnings.forEach(function (w) { out.push(['', w]); });

  var summary = ss.getSheetByName(SHEET_SUMMARY);
  summary.clearContents();
  summary.getRange(1, 1, out.length, 2).setValues(out);
  summary.getRange(1, 1, out.length, 1).setFontWeight('bold');
  summary.getRange(1, 2, out.length, 1).setFontColor('#000000').setHorizontalAlignment('right');
  if (warnings.length) summary.getRange(11, 2, warnings.length, 1).setFontColor('#9f2f25');
  summary.setColumnWidth(1, 220);
  summary.setColumnWidth(2, 520);
}

// סופר את התשובות ומוצא כפילויות וחוסרים. אותו חישוב משמש את לשונית הסיכום ואת המייל היומי.
function tally_(rows) {
  // כפילויות: אותו שם יותר מפעם אחת. מסמנים ולא מוחקים, ההחלטה שלך.
  var seen = {};
  rows.forEach(function (r) {
    var key = String(r[COL.name - 1]).replace(/\s+/g, ' ').trim().toLowerCase();
    if (key) seen[key] = (seen[key] || 0) + 1;
  });
  var marks = rows.map(function (r) {
    var key = String(r[COL.name - 1]).replace(/\s+/g, ' ').trim().toLowerCase();
    return [key && seen[key] > 1 ? DUPLICATE_MARK : ''];
  });

  var t = { replies: 0, people: 0, synagogue: 0, event: 0, declined: 0, emails: 0, duplicates: 0, incomplete: 0 };
  rows.forEach(function (r, i) {
    var status = r[COL.status - 1];
    var count = Number(r[COL.count - 1]) || 0;
    var part = r[COL.part - 1];
    if (!r[COL.name - 1] && !status) return;
    t.replies++;
    if (marks[i][0]) t.duplicates++;
    if (status === STATUS_YES) {
      if (!count || !part) t.incomplete++;
      t.people += count;
      if (part !== PARTS.event) t.synagogue += count;
      if (part !== PARTS.synagogue) t.event += count;
      if (r[COL.email - 1]) t.emails++;
    } else if (status === STATUS_NO) {
      t.declined++;
    } else {
      t.incomplete++;
    }
  });

  var warnings = [];
  if (t.duplicates) warnings.push(t.duplicates + ' שורות עם שם שמופיע יותר מפעם אחת. הסכומים כוללים אותן, כדאי לבדוק ולמחוק את המיותרות.');
  if (t.incomplete) warnings.push(t.incomplete + ' שורות עם נתון חסר (סטטוס, מספר אנשים או חלק).');
  if (t.emails > EMAIL_QUOTA_WARNING) warnings.push(t.emails + ' נמענים לתזכורת. חשבון Gmail רגיל שולח עד כ-100 מיילים ביום, ייתכן שחלק לא יקבלו.');

  return { marks: marks, totals: t, warnings: warnings };
}

/* ---------- סיכום יומי במייל אליך ---------- */

// רץ כל בוקר ב-8:00. שולח רק אם הגיעו תשובות חדשות ב-24 השעות האחרונות, ורק עד יום האירוע.
function sendDailySummary() {
  var mail = buildDailySummary_(readRows_(), new Date(), settings_(), SpreadsheetApp.getActive().getUrl(), false);
  if (mail) sendToOwner_(mail);
}

// שולח את הסיכום אליך עכשיו, גם אם אין תשובות חדשות. לא משנה דבר בגיליון.
function testDailySummary() {
  sendToOwner_(buildDailySummary_(readRows_(), new Date(), settings_(), SpreadsheetApp.getActive().getUrl(), true));
}

function sendToOwner_(mail) {
  MailApp.sendEmail({ to: Session.getEffectiveUser().getEmail(), subject: mail.subject, body: mail.text, htmlBody: mail.html });
}

// בונה את המייל, או מחזיר null כשאין מה לשלוח. לא נוגע בגיליון, כדי שאפשר יהיה לבדוק אותו בנפרד.
function buildDailySummary_(rows, now, s, sheetUrl, force) {
  var today = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
  var validDate = /^\d{4}-\d{2}-\d{2}$/.test(s.date);
  if (!force && validDate && today > s.date) return null;

  var since = now.getTime() - 24 * 60 * 60 * 1000;
  var fresh = rows.filter(function (r) {
    var received = r[COL.received - 1];
    return Object.prototype.toString.call(received) === '[object Date]' && received.getTime() > since;
  });
  if (!fresh.length && !force) return null;

  var result = tally_(rows);
  var t = result.totals;
  var lines = fresh.map(function (r) {
    var bits = [r[COL.name - 1], r[COL.status - 1]];
    if (r[COL.status - 1] === STATUS_YES) bits.push(r[COL.count - 1] + ' אנשים', r[COL.part - 1]);
    if (r[COL.note - 1]) bits.push('הערה: ' + r[COL.note - 1]);
    return bits.join(' · ');
  });
  var totals = [
    'תשובות: ' + t.replies,
    'מגיעים: ' + t.people + ' אנשים (עלייה לתורה ' + t.synagogue + ', אירוע ' + t.event + ')',
    'לא מגיעים: ' + t.declined
  ];

  var countdown = '';
  if (validDate) {
    var days = Math.round((Date.parse(s.date) - Date.parse(today)) / 86400000);
    countdown = days === 0 ? 'היום האירוע!' : days === 1 ? 'מחר האירוע.' : days > 1 ? 'עוד ' + days + ' ימים לאירוע.' : '';
  }

  var freshTitle = !fresh.length ? 'אין תשובות חדשות' : fresh.length === 1 ? 'תשובה חדשה אחת' : fresh.length + ' תשובות חדשות';
  var subject = 'בר מצווה: ' + (fresh.length ? freshTitle : 'סיכום') + ' · ' + t.people + ' מגיעים';

  var text = [freshTitle + ' מ-24 השעות האחרונות' + (lines.length ? ':' : '.')]
    .concat(lines.map(function (l) { return '• ' + l; }))
    .concat(['', 'סה"כ עד עכשיו:'], totals)
    .concat(result.warnings.length ? ['', 'לבדיקה:'].concat(result.warnings) : [])
    .concat(countdown ? ['', countdown] : [])
    .concat(['', 'הגיליון: ' + sheetUrl])
    .join('\n');

  function list(items) {
    return '<ul style="margin:4px 0 16px;padding-right:20px">' + items.map(function (i) { return '<li>' + esc_(i) + '</li>'; }).join('') + '</ul>';
  }
  var html = '<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f2147">' +
    '<p style="margin:0"><b>' + esc_(freshTitle) + ' מ-24 השעות האחרונות</b></p>' +
    (lines.length ? list(lines) : '<p style="margin:0 0 16px"></p>') +
    '<p style="margin:0"><b>סה"כ עד עכשיו</b></p>' + list(totals) +
    (result.warnings.length ? '<p style="margin:0;color:#9f2f25"><b>לבדיקה</b></p>' + list(result.warnings) : '') +
    (countdown ? '<p>' + esc_(countdown) + '</p>' : '') +
    '<p><a href="' + esc_(sheetUrl) + '">פתיחת הגיליון</a></p></div>';

  return { subject: subject, text: text, html: html };
}

/* ---------- תזכורת במייל ---------- */

function settings_() {
  var values = SpreadsheetApp.getActive().getSheetByName(SHEET_SETTINGS).getRange(1, 2, SETTINGS.length, 1).getValues();
  var date = values[0][0];
  if (Object.prototype.toString.call(date) === '[object Date]') {
    date = Utilities.formatDate(date, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  }
  return {
    date: String(date).trim(),
    child: String(values[1][0]).trim(),
    synagogue: String(values[2][0]).trim(),
    event: String(values[3][0]).trim(),
    pageUrl: String(values[4][0]).trim(),
    signature: String(values[5][0]).trim()
  };
}

function tomorrow_() {
  var now = new Date();
  return Utilities.formatDate(new Date(now.getTime() + 24 * 60 * 60 * 1000), TZ, 'yyyy-MM-dd');
}

function buildEmail_(s, name, part) {
  var lines = [];
  if (part !== PARTS.event) lines.push('עלייה לתורה: ' + s.synagogue);
  if (part !== PARTS.synagogue) lines.push('אירוע: ' + s.event);
  var subject = 'תזכורת: מחר בר המצווה של ' + s.child;
  var text = ['שלום ' + name + ',', '', 'מזכירים שמחר חוגגים את בר המצווה של ' + s.child + '.', '']
    .concat(lines)
    .concat(s.pageUrl ? ['', 'כל הפרטים והניווט: ' + s.pageUrl] : [])
    .concat(['', 'נשמח לראותכם,', s.signature])
    .join('\n');
  var html = '<div dir="rtl" style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#0f2147">' +
    '<p>שלום ' + esc_(name) + ',</p>' +
    '<p>מזכירים שמחר חוגגים את בר המצווה של <b>' + esc_(s.child) + '</b>.</p>' +
    '<p>' + lines.map(esc_).join('<br>') + '</p>' +
    (s.pageUrl ? '<p><a href="' + esc_(s.pageUrl) + '">כל הפרטים והניווט</a></p>' : '') +
    '<p>נשמח לראותכם,<br><b>' + esc_(s.signature) + '</b></p></div>';
  return { subject: subject, text: text, html: html };
}

function esc_(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// רץ כל יום ב-9:00. שולח רק ביום שלפני האירוע, ורק למי שעוד לא קיבל.
function sendReminders() {
  var s = settings_();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) {
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'בר מצווה: תאריך האירוע בלשונית "הגדרות" לא תקין',
      'הערך הנוכחי: "' + s.date + '". הפורמט הנדרש: שנה-חודש-יום, למשל 2026-11-19. עד התיקון לא יישלחו תזכורות.');
    return;
  }
  if (tomorrow_() !== s.date) return;

  var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_RSVP);
  var rows = readRows_();
  var owner = Session.getEffectiveUser().getEmail();
  var quota = MailApp.getRemainingDailyQuota() - 1; // שומרים מייל אחד לדוח
  var sentTo = {};
  var sent = 0;
  var failed = [];
  var skipped = [];

  rows.forEach(function (r, i) {
    var email = String(r[COL.email - 1]).trim().toLowerCase();
    if (r[COL.status - 1] !== STATUS_YES || !email || r[COL.reminded - 1]) return;
    var name = String(r[COL.name - 1]);
    var stamp = sheet.getRange(i + 2, COL.reminded);
    if (sentTo[email]) {
      stamp.setValue('כפול, נשלח פעם אחת');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      failed.push(name + ' (מייל לא תקין: ' + email + ')');
      return;
    }
    if (sent >= quota) {
      skipped.push(name + ' (' + email + ')');
      return;
    }
    try {
      var mail = buildEmail_(s, name, r[COL.part - 1]);
      MailApp.sendEmail({ to: email, subject: mail.subject, body: mail.text, htmlBody: mail.html });
      stamp.setValue(Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm'));
      sentTo[email] = true;
      sent++;
    } catch (err) {
      failed.push(name + ' (' + email + '): ' + err.message);
    }
  });

  var report = ['נשלחו ' + sent + ' תזכורות.'];
  if (failed.length) report.push('', 'נכשלו ' + failed.length + ':', failed.join('\n'));
  if (skipped.length) report.push('', 'לא נשלחו בגלל מגבלת המיילים היומית של Gmail (' + skipped.length + '):', skipped.join('\n'));
  if (!failed.length && !skipped.length) report.push('אין כשלים.');
  MailApp.sendEmail(owner, 'בר מצווה: דוח שליחת תזכורות', report.join('\n'));
}

// שולח תזכורת לדוגמה רק אליך, בלי קשר לתאריך ובלי לסמן דבר בגיליון.
function testReminder() {
  var owner = Session.getEffectiveUser().getEmail();
  var mail = buildEmail_(settings_(), 'אורח לדוגמה', PARTS.both);
  MailApp.sendEmail({ to: owner, subject: '[בדיקה] ' + mail.subject, body: mail.text, htmlBody: mail.html });
}
