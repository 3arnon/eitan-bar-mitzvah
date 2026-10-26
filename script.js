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

  // גלילה לפרטי האירוע בלי לשנות את הכתובת, כדי שקישור שמועתק מהדפדפן עדיין יפתח עם המעטפה
  function setupScrollCue() {
    $("scroll-cue").addEventListener("click", function (ev) {
      ev.preventDefault();
      $("details").scrollIntoView();
    });
  }

  /* ---------- כרטיס כניסה אחרי אישור הגעה ---------- */

  function renderPass(data) {
    $("pass-event").textContent = "בר המצווה של " + E.childName;
    $("pass-date").textContent = shortDate(E.date) + " · " + E.hebrewDate;
    $("pass-guest").textContent = data.name;
    $("pass-count").textContent = "מספר אורחים: " + data.count;

    var list = $("pass-stops");
    list.textContent = "";
    E.stops.forEach(function (stop) {
      if (data.part !== "both" && data.part !== stop.id) return;
      var li = el("li", "pass__stop");
      li.appendChild(el("span", "pass__time", shortTime(stop.start)));
      var what = el("span", "pass__what");
      what.appendChild(el("strong", null, stop.title));
      what.appendChild(el("span", null, stop.place));
      li.appendChild(what);
      list.appendChild(li);
    });
  }

  /* ---------- "אתם מוכנים?" וסוכריות שנזרקות אל המסך, אחרי אישור הגעה ---------- */

  var SHOWER_TITLE_MS = 1100;  // כמה זמן "אתם מוכנים?" לבד על המסך לפני שזורקים
  var SHOWER_REVEAL_MS = 2200; // המסך מלא בסוכריות: מתחת מחליפים את הטופס בכרטיס
  var SHOWER_FADE_MS = 2300;   // השכבה מתחילה להיעלם, והכרטיס מתגלה
  var CANDY_COUNT = 46;
  var CANDY_COLORS = ["#e63946", "#ff6fae", "#ffbe0b", "#fb5607", "#06d6a0", "#3a86ff", "#8338ec"];
  var CANDY_LONGEST_MS = 1800; // ההשהיה הארוכה ביותר + הזריקה הארוכה ביותר

  function calmMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches || !document.body.animate;
  }

  // כל סוכריה מתחילה קטנה ורחוקה ליד המרכז, ומאיצה אל המסתכל: גדלה, מסתובבת ויוצאת מהמסך
  function throwCandies(layer, delay) {
    var w = window.innerWidth;
    var h = window.innerHeight;
    for (var i = 0; i < CANDY_COUNT; i++) {
      var candy = icon("candy", "shower__candy");
      candy.style.color = CANDY_COLORS[i % CANDY_COLORS.length];
      layer.appendChild(candy);

      var x0 = (Math.random() - 0.5) * w * 0.3;
      var y0 = (Math.random() - 0.5) * h * 0.25;
      var x1 = x0 * 3 + (Math.random() - 0.5) * w;
      var y1 = y0 * 3 + (Math.random() - 0.5) * h;
      var start = "translate(" + x0 + "px, " + y0 + "px) rotate(0deg) scale(0.1)";
      var end = "translate(" + x1 + "px, " + y1 + "px) rotate(" + (Math.random() - 0.5) * 720 + "deg) scale(" + (4 + Math.random() * 4) + ")";
      candy.animate([
        { transform: start, opacity: 0 },
        { opacity: 1, offset: 0.2 },
        { transform: end, opacity: 1, offset: 0.85 },
        { transform: end, opacity: 0 }
      ], {
        duration: 800 + Math.random() * 400,
        delay: delay + Math.random() * 600,
        easing: "cubic-bezier(0.55, 0, 0.9, 0.5)",
        fill: "both"
      });
    }
  }

  // הכפתור "לעוד סוכריות": זורק עוד סבב ישר מעל הדף, בלי לעמעם אותו
  function moreCandies() {
    var layer = el("div", "shower shower--clear");
    layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);
    throwCandies(layer, 0);
    setTimeout(function () {
      layer.remove();
    }, CANDY_LONGEST_MS);
  }

  // reveal נקרא כשהמסך מכוסה בסוכריות, כך שהכרטיס מופיע בדיוק כשהשכבה נעלמת
  function candyShower(reveal) {
    if (calmMotion()) {
      reveal();
      return;
    }

    var layer = el("div", "shower");
    layer.setAttribute("aria-hidden", "true");
    var title = el("p", "shower__title");
    title.appendChild(el("span", null, "אתם"));
    title.appendChild(el("span", null, "מוכנים?"));
    layer.appendChild(title);
    document.body.appendChild(layer);

    // אחרי ההכרזה הכותרת מתקרבת ונעלמת, ומתחילים לזרוק
    title.animate([{ transform: "none", opacity: 1 }, { transform: "scale(1.5)", opacity: 0 }],
      { duration: 400, delay: SHOWER_TITLE_MS, easing: "ease-in", fill: "forwards" });

    throwCandies(layer, SHOWER_TITLE_MS);

    setTimeout(reveal, SHOWER_REVEAL_MS);
    layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, delay: SHOWER_FADE_MS, fill: "forwards" }).onfinish = function () {
      layer.remove();
    };
  }

  /* ---------- מעטפת פתיחה ---------- */

  // כל המעבר: 2.6 + 1.15 + 0.75 = 4.5 שניות
  var INTRO_HOLD_MS = 2600; // כמה זמן המעטפה סגורה לפני שהחותמת נשברת
  var CARD_OUT_MS = 1150;   // שבירה, דש והזמנה יוצאת (לפי ההשהיות ב-styles.css)
  var FLY_MS = 750;         // ההזמנה באה קדימה, למקום שלה בראש הדף
  var CARD_TUCK_PX = 10;    // כשההזמנה בחוץ, התחתית שלה עדיין נוגעת בשפת המעטפה
  var CALM_FADE_MS = 700;   // בגרסה השקטה (בטלפון שביקש פחות תנועה), המעטפה מתעמעמת לתוך ההזמנה

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  // אבקת זהב שמתפזרת מהחותמת כשהיא נשברת
  function goldDust(origin) {
    var canvas = el("canvas", "gold-dust");
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth;
    var h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    var colors = ["#f6dc95", "#d6bd8b", "#b17d27", "#fff4cf"];
    var box = origin.getBoundingClientRect();
    var cx = box.left + box.width / 2;
    var cy = box.top + box.height / 2;
    var specks = [];
    for (var i = 0; i < 90; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 1.5 + Math.random() * 6;
      specks.push({
        x: cx + Math.cos(angle) * box.width * 0.2,
        y: cy + Math.sin(angle) * box.width * 0.2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        r: 0.7 + Math.random() * 1.9,
        life: 800 + Math.random() * 700,
        phase: Math.random() * 6,
        color: colors[i % colors.length]
      });
    }

    var start = performance.now();
    function frame(now) {
      var t = now - start;
      var alive = false;
      ctx.clearRect(0, 0, w, h);
      specks.forEach(function (p) {
        if (t > p.life) return;
        alive = true;
        p.vx *= 0.95;
        p.vy = p.vy * 0.95 + 0.07;
        p.x += p.vx;
        p.y += p.vy;
        // נצנוץ: כל גרגר מהבהב בקצב משלו ודועך לקראת הסוף
        ctx.globalAlpha = (1 - t / p.life) * (0.55 + 0.45 * Math.sin(t / 45 + p.phase));
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      if (alive) requestAnimationFrame(frame);
      else canvas.remove();
    }
    requestAnimationFrame(frame);
  }

  function playIntro() {
    var root = document.documentElement;
    var intro = $("intro");
    if (!root.classList.contains("intro-on")) {
      intro.remove();
      return;
    }

    var card = $("intro-card");
    var sheet = document.querySelector(".sheet");
    var calm = root.classList.contains("intro-calm");
    var opened = false;
    sheet.inert = true;
    window.scrollTo(0, 0);
    $("envelope-text").textContent = E.envelopeText || "";
    if (card.getAttribute("src") !== E.invitationImage) card.src = E.invitationImage;

    // לא פותחים לפני שתמונת ההזמנה נטענה, אבל גם לא מחכים לה לנצח
    var cardReady = Promise.race([
      card.decode ? card.decode().catch(function () {}) : Promise.resolve(),
      wait(3000)
    ]);

    function finish() {
      root.classList.remove("intro-on");
      sheet.inert = false;
      intro.remove();
    }

    var envelope = card.parentNode;
    var envDown = 0;

    // כמה ההזמנה עולה וכמה המעטפה יורדת, כך ששתיהן נכנסות במסך (ובמסך נמוך, המעטפה גולשת למטה)
    function setPull() {
      var cardTop = envelope.offsetTop + card.offsetTop;
      var total = card.offsetHeight + envelope.offsetHeight - CARD_TUCK_PX;
      var top = Math.max(16, (window.innerHeight - total) / 2);
      envDown = top + card.offsetHeight - CARD_TUCK_PX - envelope.offsetTop;
      envelope.style.setProperty("--env-down", envDown + "px");
      card.style.setProperty("--card-up", (top - cardTop - envDown) + "px");
    }

    // ההזמנה באה קדימה וגדלה עד שהיא יושבת בדיוק על התמונה שבראש הדף
    function fly() {
      var hero = $("invitation").getBoundingClientRect();
      var from = card.getBoundingClientRect();
      var env = envelope.getBoundingClientRect();
      var shadow = getComputedStyle(card).boxShadow;

      // ההזמנה עוברת לשכבה משלה מעל המעטפה, באותו מקום בדיוק
      intro.appendChild(card);
      card.style.cssText = "top:" + from.top + "px; left:" + from.left + "px; width:" + from.width + "px;" +
        "transform:none; transition:none; z-index:10";

      // המעטפה מתכווצת אל מרכז המקום שבו ההזמנה תנחת, כך שהיא נעלמת מאחוריה
      var dy = (hero.top + hero.height / 2) - (env.top + env.height / 2);
      envelope.style.setProperty("--env-leave", envDown + dy + "px");
      intro.classList.add("is-leaving");

      if (!card.animate) {
        finish();
        return;
      }
      // הצל מתעבה באמצע הדרך, כאילו ההזמנה מתקרבת אל המסתכל
      card.animate([
        { transform: "none", boxShadow: shadow },
        { boxShadow: "0 30px 50px -18px rgba(8, 21, 48, 0.55)", offset: 0.5 },
        {
          transform: "translate(" + (hero.left - from.left) + "px, " + (hero.top - from.top) + "px) scale(" + hero.width / from.width + ")",
          boxShadow: "0 0 0 0 rgba(8, 21, 48, 0)",
          borderRadius: "0"
        }
      ], { duration: FLY_MS, easing: "cubic-bezier(0.45, 0, 0.2, 1)", fill: "forwards" }).onfinish = finish;
    }

    // הגרסה השקטה: בלי תנועה, המעטפה רק מתעמעמת והחוצה מתגלה ההזמנה
    function fadeOut() {
      if (!intro.animate) {
        finish();
        return;
      }
      intro.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CALM_FADE_MS, easing: "ease", fill: "forwards" }).onfinish = finish;
    }

    function open() {
      if (opened) return;
      opened = true;
      if (calm) {
        fadeOut();
        return;
      }
      setPull();
      intro.classList.add("is-open");
      goldDust($("seal"));
      setTimeout(fly, CARD_OUT_MS);
    }

    Promise.all([cardReady, wait(INTRO_HOLD_MS)]).then(open);
    intro.addEventListener("click", function () {
      cardReady.then(open);
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

    // כרטיס לכל חלק ביום, עם האייקון והשעה מההזמנה
    E.stops.forEach(function (stop) {
      var label = el("label", "part");
      var input = el("input");
      input.type = "checkbox";
      input.name = "part";
      input.value = stop.id;
      input.addEventListener("change", function () { setError("part", ""); });
      var card = el("span", "part__card");
      card.appendChild(icon(stop.icon, "part__icon"));
      card.appendChild(el("span", "part__title", stop.title));
      card.appendChild(el("span", "part__time", "בשעה " + shortTime(stop.start)));
      var check = el("span", "part__check");
      check.setAttribute("aria-hidden", "true");
      card.appendChild(check);
      label.appendChild(input);
      label.appendChild(card);
      $("parts").appendChild(label);
    });

    function setError(name, message) {
      var box = $("err-" + name);
      var field = form.elements[name];
      // קבוצת כפתורים (הגעה, חלק) מסומנת כולה, כדי שהמסגרת האדומה והקפיצה לשגיאה יעבדו גם בה
      var inputs = field && !field.setAttribute ? Array.from(field) : [field];
      box.textContent = message;
      box.hidden = !message;
      inputs.forEach(function (input) {
        if (!input) return;
        if (message) input.setAttribute("aria-invalid", "true");
        else input.removeAttribute("aria-invalid");
      });
      // כשהשגיאה האחרונה תוקנה, גם "יש שדות שדורשים תיקון" שלמטה נעלם
      if (!message && !form.querySelector(".field__error:not([hidden])")) setStatus("", false);
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
        // שני הכרטיסים מסומנים = "both", כמו שהגיליון מצפה; אחד = המזהה שלו; אף אחד = ריק (שגיאה)
        var picked = Array.from(form.querySelectorAll('input[name="part"]:checked')).map(function (i) { return i.value; });
        data.part = picked.length === E.stops.length ? "both" : (picked[0] || "");
        data.email = form.elements.email.value.trim();
      }
      return data;
    }

    function validate(data) {
      var ok = true;
      ["name", "attending", "count", "part", "email"].forEach(function (n) { setError(n, ""); });

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
        if (!data.part) {
          setError("part", "נא לסמן לאיזה חלק תגיעו");
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
        var coming = data.attending === "yes";
        $("thanks-title").textContent = coming ? "נרשמתם בהצלחה!" : "תודה שעדכנתם";
        $("thanks-text").textContent = coming
          ? "מחכים לראותכם. כדאי להוסיף את האירוע ליומן מהקישורים שלמעלה."
          : "חבל שלא תוכלו להגיע. נשמח לחגוג איתכם בהזדמנות אחרת.";
        // ל-svg אין מאפיין hidden כמו לאלמנט HTML, לכן משנים את התכונה עצמה
        $("thanks-check").toggleAttribute("hidden", !coming);
        $("pass").hidden = !coming;
        $("thanks-hint").hidden = !coming;
        $("more-candy").hidden = !coming || calmMotion();
        if (coming) renderPass(data);

        function reveal() {
          form.hidden = true;
          thanks.hidden = false;
          thanks.focus({ preventScroll: true });
          // מתחת לסוכריות קופצים ישר לכרטיס, בלי גלילה שנראית דרך השכבה
          thanks.scrollIntoView({ block: "start", behavior: coming ? "instant" : "auto" });
        }
        // מי שמגיע מקבל "אתם מוכנים?" וגשם סוכריות, ורק אחריו את הכרטיס
        if (coming) candyShower(reveal);
        else reveal();
      }).catch(function () {
        setStatus("לא הצלחנו לשמור את התשובה. בדקו את החיבור לאינטרנט ונסו שוב.", true);
      }).finally(function () {
        sending = false;
        submit.disabled = false;
        submit.textContent = "שליחת אישור";
      });
    });

    $("more-candy").addEventListener("click", moreCandies);

    $("rsvp-again").addEventListener("click", function () {
      form.reset();
      details.hidden = true;
      thanks.hidden = true;
      form.hidden = false;
      form.elements.name.focus();
    });
  }

  /* ---------- הפעלה ---------- */

  // המעטפה ראשונה, ואם משהו בה נכשל מדלגים עליה ישר להזמנה
  try {
    playIntro();
  } catch (e) {
    document.documentElement.classList.remove("intro-on");
    document.querySelector(".sheet").inert = false;
  }

  var problems = configProblems();
  if (problems.length) {
    $("draft-ribbon").textContent = "טיוטה · עדיין חסר: " + problems.join(", ");
    $("draft-ribbon").hidden = false;
  }

  renderHero();
  renderText();
  renderStops();
  setupScrollCue();
  startCountdown();
  setupRsvp();
})();
