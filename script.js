(function () {
  "use strict";

  var E = window.EVENT;
  var TZ = "Asia/Jerusalem";
  var SVG_NS = "http://www.w3.org/2000/svg";
  var MAX_GUESTS = 20;
  var SEND_TIMEOUT_MS = 20000;

  function $(id) {
    return document.getElementById(id);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function icon(name, className) {
    var svg = document.createElementNS(SVG_NS, "svg");
    var use = document.createElementNS(SVG_NS, "use");
    svg.setAttribute("class", className);
    svg.setAttribute("aria-hidden", "true");
    use.setAttribute("href", "#icon-" + name);
    svg.appendChild(use);
    return svg;
  }

  /* ---------- זמנים (תמיד לפי שעון ישראל, בלי תלות במכשיר של האורח) ---------- */

  function israelTime(dateStr, timeStr) {
    var d = dateStr.split("-").map(Number);
    var t = timeStr.split(":").map(Number);
    var guess = Date.UTC(d[0], d[1] - 1, d[2], t[0], t[1]);
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).formatToParts(new Date(guess));
    var p = {};
    parts.forEach(function (x) {
      p[x.type] = Number(x.value);
    });
    var wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    return new Date(guess - (wall - guess));
  }

  function formatDate(dateStr, options) {
    options.timeZone = TZ;
    return new Intl.DateTimeFormat("he-IL", options).format(israelTime(dateStr, "12:00"));
  }

  function longDate(dateStr) {
    return formatDate(dateStr, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  // "2026-11-19" -> "יום חמישי, 19/11"
  function shortDate(dateStr) {
    var d = dateStr.split("-").map(Number);
    return formatDate(dateStr, { weekday: "long" }) + ", " + d[2] + "/" + d[1];
  }

  // "09:30" -> "9:30", כמו בהזמנה
  function shortTime(timeStr) {
    return timeStr.replace(/^0/, "");
  }

  function utcStamp(date) {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }

  /* ---------- בדיקת תקינות של פרטי האירוע ---------- */

  function configProblems() {
    var problems = [];
    function check(label, value) {
      if (!value || /\[.*\]/.test(value)) problems.push(label);
    }
    check("תאריך עברי", E.hebrewDate);
    check("חתימה", E.signature);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(E.date || "")) problems.push("תאריך לועזי");
    E.stops.forEach(function (s) {
      check("מקום: " + s.title, s.place);
      check("יעד ניווט: " + s.title, s.navQuery);
      if (!/^\d{2}:\d{2}$/.test(s.start) || !/^\d{2}:\d{2}$/.test(s.end) || s.end <= s.start) {
        problems.push("שעות: " + s.title);
      }
    });
    if (!E.rsvpUrl) problems.push("חיבור אישורי ההגעה");
    return problems;
  }

  /* ---------- פתיחה, ברכה, חתימה ---------- */

  function invitationAlt() {
    var lines = ["הזמנה: " + E.childName + " חוגג בר מצווה."];
    E.stops.forEach(function (s) {
      lines.push(s.title + ": " + shortDate(E.date) + " בשעה " + shortTime(s.start) + ", " +
        s.place + (s.address ? ", " + s.address : "") + ".");
    });
    lines.push(E.closing + ", " + E.signature + ".");
    return lines.join(" ");
  }

  function renderHero() {
    var invitation = $("invitation");
    if (invitation.getAttribute("src") !== E.invitationImage) invitation.src = E.invitationImage;
    invitation.alt = invitationAlt();

    if (E.photo) {
      var photo = $("photo");
      photo.alt = E.childName;
      photo.addEventListener("load", function () {
        $("portrait").hidden = false;
      });
      photo.src = E.photo;
    }
  }

  function renderText() {
    var box = $("blessing-text");
    E.blessing.forEach(function (line) {
      box.appendChild(el("p", null, line));
    });
    $("greg-date").textContent = longDate(E.date);
    $("hebrew-date").textContent = E.hebrewDate;
    $("closing").textContent = E.closing;
    $("signature").textContent = E.signature;
  }

  /* ---------- ספירה לאחור ---------- */

  function startCountdown() {
    var target = israelTime(E.date, E.stops[0].start).getTime();
    var timer;

    function tick() {
      var diff = target - Date.now();
      if (diff <= 0) {
        $("countdown-grid").hidden = true;
        $("countdown-title").hidden = true;
        $("countdown-done").hidden = false;
        clearInterval(timer);
        return;
      }
      var s = Math.floor(diff / 1000);
      $("cd-days").textContent = Math.floor(s / 86400);
      $("cd-hours").textContent = Math.floor((s % 86400) / 3600);
      $("cd-minutes").textContent = Math.floor((s % 3600) / 60);
      $("cd-seconds").textContent = s % 60;
    }

    timer = setInterval(tick, 1000);
    tick();
  }

  /* ---------- יומן ---------- */

  function eventTitle(stop) {
    return "בר המצווה של " + E.childName + " · " + stop.title;
  }

  function eventLocation(stop) {
    return stop.place + (stop.address ? ", " + stop.address : "");
  }

  function pageUrl() {
    return location.href.split("#")[0];
  }

  function googleCalendarUrl(stop) {
    var start = israelTime(E.date, stop.start);
    var end = israelTime(E.date, stop.end);
    return "https://calendar.google.com/calendar/render?action=TEMPLATE" +
      "&text=" + encodeURIComponent(eventTitle(stop)) +
      "&dates=" + utcStamp(start) + "/" + utcStamp(end) +
      "&location=" + encodeURIComponent(eventLocation(stop)) +
      "&details=" + encodeURIComponent(pageUrl()) +
      "&ctz=" + encodeURIComponent(TZ);
  }

  function icsEscape(text) {
    return String(text).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  }

  // שורות ארוכות מ-75 בתים חייבות להישבר לפי תקן iCalendar
  function icsFold(line) {
    var encoder = new TextEncoder();
    var out = "";
    var bytes = 0;
    Array.from(line).forEach(function (ch) {
      var size = encoder.encode(ch).length;
      if (bytes + size > 73) {
        out += "\r\n ";
        bytes = 1;
      }
      out += ch;
      bytes += size;
    });
    return out;
  }

  function icsText(stop) {
    var start = israelTime(E.date, stop.start);
    var end = israelTime(E.date, stop.end);
    var lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Bar Mitzvah Invitation//HE",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:" + stop.id + "-" + E.date + "@bar-mitzvah-invitation",
      "DTSTAMP:" + utcStamp(new Date()),
      "DTSTART:" + utcStamp(start),
      "DTEND:" + utcStamp(end),
      "SUMMARY:" + icsEscape(eventTitle(stop)),
      "LOCATION:" + icsEscape(eventLocation(stop)),
      "DESCRIPTION:" + icsEscape(pageUrl()),
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:" + icsEscape("מחר: " + eventTitle(stop)),
      "TRIGGER:-P1D",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR"
    ];
    return lines.map(icsFold).join("\r\n") + "\r\n";
  }

  function icsLink(stop) {
    var a = el("a", null, "אייפון / Outlook");
    var text = icsText(stop);
    // באייפון קישור data נפתח ישירות בחלון "הוספה ליומן"; בשאר המכשירים מורידים קובץ
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      a.href = "data:text/calendar;charset=utf-8," + encodeURIComponent(text);
    } else {
      a.href = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
      a.download = "bar-mitzvah-" + stop.id + ".ics";
    }
    return a;
  }

  /* ---------- סדר היום ---------- */

  function renderStops() {
    var list = $("stops");
    E.stops.forEach(function (stop) {
      var query = encodeURIComponent(stop.navQuery);
      var li = el("li", "stop");
      li.appendChild(icon(stop.icon, "stop__icon"));
      li.appendChild(el("h3", "stop__title", stop.title));
      li.appendChild(el("p", "stop__when", shortDate(E.date) + " · בשעה " + shortTime(stop.start)));
      li.appendChild(el("p", "stop__place", stop.place));
      if (stop.address) li.appendChild(el("p", "stop__address", stop.address));

      var actions = el("div", "stop__actions");
      var waze = el("a", "btn btn--outline", "ניווט ב-Waze");
      waze.href = "https://waze.com/ul?q=" + query + "&navigate=yes";
      var maps = el("a", "btn btn--outline", "Google Maps");
      maps.href = "https://www.google.com/maps/search/?api=1&query=" + query;
      [waze, maps].forEach(function (a) {
        a.target = "_blank";
        a.rel = "noopener";
        actions.appendChild(a);
      });
      li.appendChild(actions);

      var cal = el("p", "stop__calendar", "הוספה ליומן: ");
      var google = el("a", null, "Google");
      google.href = googleCalendarUrl(stop);
      google.target = "_blank";
      google.rel = "noopener";
      cal.appendChild(google);
      cal.appendChild(document.createTextNode(" · "));
      cal.appendChild(icsLink(stop));
      li.appendChild(cal);

      list.appendChild(li);
    });
  }

  /* ---------- אישור הגעה ---------- */

  function setupRsvp() {
    var form = $("rsvp-form");
    var details = $("attending-details");
    var count = $("f-count");
    var status = $("rsvp-status");
    var submit = $("rsvp-submit");
    var thanks = $("rsvp-thanks");
    var sending = false;

    if (E.rsvpDeadline) {
      $("rsvp-deadline").textContent = "נשמח לקבל את תשובתכם עד " + longDate(E.rsvpDeadline);
      $("rsvp-deadline").hidden = false;
    }

    function attendingValue() {
      var checked = form.querySelector('input[name="attending"]:checked');
      return checked ? checked.value : "";
    }

    form.querySelectorAll('input[name="attending"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        details.hidden = attendingValue() !== "yes";
        setError("attending", "");
      });
    });

    function stepCount(delta) {
      var n = parseInt(count.value, 10);
      if (isNaN(n)) n = 1;
      count.value = Math.min(MAX_GUESTS, Math.max(1, n + delta));
    }
    $("count-minus").addEventListener("click", function () { stepCount(-1); });
    $("count-plus").addEventListener("click", function () { stepCount(1); });

    function setError(name, message) {
      var box = $("err-" + name);
      var input = form.elements[name];
      box.textContent = message;
      box.hidden = !message;
      if (input && input.setAttribute) {
        if (message) input.setAttribute("aria-invalid", "true");
        else input.removeAttribute("aria-invalid");
      }
    }

    function setStatus(message, isError) {
      status.textContent = message;
      status.className = "form__status" + (isError ? " form__status--error" : "");
    }

    function collect() {
      var attending = attendingValue();
      var data = {
        name: form.elements.name.value.replace(/\s+/g, " ").trim(),
        attending: attending,
        count: "",
        part: "",
        email: "",
        note: form.elements.note.value.trim(),
        website: form.elements.website.value
      };
      if (attending === "yes") {
        data.count = Number(count.value);
        data.part = form.querySelector('input[name="part"]:checked').value;
        data.email = form.elements.email.value.trim();
      }
      return data;
    }

    function validate(data) {
      var ok = true;
      ["name", "attending", "count", "email"].forEach(function (n) { setError(n, ""); });

      if (data.name.length < 2) {
        setError("name", "נא למלא שם מלא");
        ok = false;
      }
      if (!data.attending) {
        setError("attending", "נא לסמן אם תגיעו");
        ok = false;
      }
      if (data.attending === "yes") {
        if (!(data.count >= 1 && data.count <= MAX_GUESTS) || Math.floor(data.count) !== data.count) {
          setError("count", "נא למלא מספר בין 1 ל-" + MAX_GUESTS);
          ok = false;
        }
        if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) {
          setError("email", "כתובת המייל אינה תקינה");
          ok = false;
        }
      }
      return ok;
    }

    function send(data) {
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, SEND_TIMEOUT_MS);
      // text/plain מונע בקשת preflight ש-Apps Script לא יודע לענות עליה
      return fetch(E.rsvpUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(data),
        signal: controller.signal
      }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      }).then(function (reply) {
        if (!reply || reply.ok !== true) throw new Error((reply && reply.error) || "התשובה לא נשמרה");
        return reply;
      }).finally(function () {
        clearTimeout(timeout);
      });
    }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (sending) return;

      var data = collect();
      if (!validate(data)) {
        setStatus("יש שדות שדורשים תיקון.", true);
        var firstBad = form.querySelector('[aria-invalid="true"]');
        if (firstBad) firstBad.focus();
        return;
      }
      if (!E.rsvpUrl) {
        setStatus("אישורי ההגעה עדיין לא מחוברים. התשובה לא נשלחה.", true);
        return;
      }

      sending = true;
      submit.disabled = true;
      submit.textContent = "שולח...";
      setStatus("", false);

      send(data).then(function () {
        $("thanks-title").textContent = data.attending === "yes" ? "תודה, נתראה!" : "תודה שעדכנתם";
        $("thanks-text").textContent = data.attending === "yes"
          ? "רשמנו את הגעתכם. כדאי להוסיף את האירוע ליומן מהקישורים שלמעלה."
          : "חבל שלא תוכלו להגיע. נשמח לחגוג איתכם בהזדמנות אחרת.";
        form.hidden = true;
        thanks.hidden = false;
        thanks.focus();
      }).catch(function () {
        setStatus("לא הצלחנו לשמור את התשובה. בדקו את החיבור לאינטרנט ונסו שוב.", true);
      }).finally(function () {
        sending = false;
        submit.disabled = false;
        submit.textContent = "שליחת אישור";
      });
    });

    $("rsvp-again").addEventListener("click", function () {
      form.reset();
      details.hidden = true;
      thanks.hidden = true;
      form.hidden = false;
      form.elements.name.focus();
    });
  }

  /* ---------- הפעלה ---------- */

  var problems = configProblems();
  if (problems.length) {
    $("draft-ribbon").textContent = "טיוטה · עדיין חסר: " + problems.join(", ");
    $("draft-ribbon").hidden = false;
  }

  renderHero();
  renderText();
  renderStops();
  startCountdown();
  setupRsvp();
})();
