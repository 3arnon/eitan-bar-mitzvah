/*
 * דף התזכורת האישית: מכתב עם שם האורח, השולחנות שלו (שולחן עגול מצויר עם המספר על המפה) ודרכי ההגעה.
 * פרטי האירוע מגיעים מ-config.js, והאורחים מ-tizkoret-guests.js. האורח נבחר לפי ?g= שבסוף הקישור.
 */
(function () {
  "use strict";

  var E = window.EVENT;
  var GUESTS = window.GUESTS || {};
  var SVG_NS = "http://www.w3.org/2000/svg";
  var CALM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // כמה זמן המכתב מוצג לפני שהדף גולל לבד אל השולחנות, וכמה זמן הגלילה עצמה נמשכת
  var SCROLL_AFTER_MS = 2000;
  var SCROLL_MS = 1300;

  function $(id) {
    return document.getElementById(id);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function svgUse(symbol, className) {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", className);
    svg.setAttribute("aria-hidden", "true");
    var use = document.createElementNS(SVG_NS, "use");
    use.setAttribute("href", "#" + symbol);
    svg.appendChild(use);
    return svg;
  }

  function longDate(dateStr) {
    var date = new Date(dateStr + "T12:00:00Z");
    return new Intl.DateTimeFormat("he-IL", {
      weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC"
    }).format(date);
  }

  function findGuest() {
    // בדף האישי של משפחה (t/שם/) האורח קבוע בדף עצמו. בדף הכללי הוא נבחר לפי ?g= שבסוף הקישור
    var key = window.GUEST_KEY || new URLSearchParams(location.search).get("g") || window.GUESTS_SAMPLE || "";
    return Object.prototype.hasOwnProperty.call(GUESTS, key) ? GUESTS[key] : null;
  }

  /* ---------- המכתב ---------- */

  function fillLetter(node, guest) {
    var inner = el("div", "letter__in");
    inner.appendChild(el("span", "letter__frame"));
    inner.appendChild(el("p", "letter__kicker", "תזכורת"));
    inner.appendChild(el("p", "letter__to", guest.name));
    inner.appendChild(el("p", "letter__line", "מחכים לכם בבר המצווה של"));
    inner.appendChild(el("p", "letter__child", E.childName));
    inner.appendChild(svgUse("divider", "divider"));
    inner.appendChild(el("p", "letter__date", longDate(E.date)));
    inner.appendChild(el("p", "letter__hdate", E.hebrewDate));
    node.appendChild(inner);
  }

  /*
   * ---------- שולחן עגול מצויר ----------
   * מבט מלמעלה באלכסון על שולחן עגול של 1.6 מטר עם עשרה מקומות: מפה כחולה עד הרצפה, צלחות, מזלג משמאל וסכין מימין,
   * כוס, וזר לבן קטן באמצע. מספר השולחן רקום בזהב על המפה. המפה מתנופפת ברוח: הקפלים נעים לאורך השוליים.
   * הציור הוא בשטח של 200 על 186 יחידות, ומוגדל לפי גודל המסך.
   */

  var ART_W = 200;
  var ART_H = 172;
  var CX = 106;     // מרכז משטח השולחן. הוא מוזז ימינה, כי הרוח מעיפה את המפה שמאלה
  var CY = 54;
  var RX = 74;      // חצי רוחב המשטח
  var RY = 28.5;    // חצי גובה המשטח, כפי שהוא נראה באלכסון
  var DROP = 65;    // אורך המפה מהמשטח עד הרצפה
  var FLARE = 1.15; // המפה מתרחבת כלפי מטה, כמו בד שנופל מעל שולחן
  var STRIPS = 96;
  var SEATS = 10;

  function mix(a, b, k) {
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  }

  // גוון הבד לפי כמות האור: מפה לבנה, עם צל רך בגוון כחלחל בתוך הקפלים
  var CLOTH_DARK = [158, 172, 198];
  var CLOTH_MID = [226, 231, 240];
  var CLOTH_LIGHT = [255, 255, 255];

  function clothColor(light) {
    var k = Math.max(0, Math.min(1, light));
    var c = k < 0.5 ? mix(CLOTH_DARK, CLOTH_MID, k * 2) : mix(CLOTH_MID, CLOTH_LIGHT, (k - 0.5) * 2);
    return "rgb(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + ")";
  }

  function oval(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  }

  function tableArt(canvas, number, seed) {
    var ctx = canvas.getContext("2d");
    var scale = 1;
    var art = { canvas: canvas, visible: true };

    art.resize = function () {
      var cssWidth = canvas.clientWidth || 101;
      var dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssWidth * dpr * ART_H / ART_W);
      scale = canvas.width / ART_W;
    };

    // נקודה על המשטח: u ו-v ביחידות של רדיוס השולחן, v חיובי הוא לכיוון המסתכל
    function onTop(u, v) {
      return [CX + RX * u, CY + RY * v];
    }

    function line(a, b, width, color) {
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.strokeStyle = color;
      ctx.stroke();
    }

    /*
     * המפה: חלקה ליד שפת השולחן, ומתחתיה קפלים רכים שמעמיקים ומתרחבים עד השוליים.
     * כל רצועה צרה נצבעת במעבר צבע מלמעלה למטה, כך שהקפלים "נולדים" בהדרגה ולא נראים כמו פסים.
     */
    function drawSkirt(t, gust, sway) {
      var pts = [];
      var i;
      for (i = 0; i <= STRIPS; i++) {
        var th = Math.PI * i / STRIPS; // 0 בצד ימין, חצי פאי מול המסתכל, פאי בצד שמאל
        var c = Math.cos(th);
        var s = Math.sin(th);
        // הקפלים עצמם קבועים במקומם, כמו בבד אמיתי, ורק הרוח מזיזה אותם.
        // הרוח באה מימין: היא דוחפת את השוליים שמאלה, מצמידה את הבד לשולחן בצד ימין,
        // מנפחת ומרימה אותו מעט בצד שמאל, ושולחת עליו אדוות קטנות שרצות מימין לשמאל.
        var a1 = th * 10 + seed;
        var a2 = th * 17 + seed * 2;
        // בקצוות הצדדיים הקפלים נרגעים, כדי שהצללית של המפה תישאר רכה
        var calm = Math.pow(s, 0.6);
        var lee = 0.5 - 0.5 * c; // 0 בצד שפונה אל הרוח, 1 בצד המוגן ממנה
        var ripple = 9 * c + t * 4.6 + seed;
        var open = 1 - 0.35 * gust * (1 - lee);
        var fold = calm * (open * (Math.sin(a1) + 0.25 * Math.sin(a2)) / 1.25 + 0.38 * gust * Math.sin(ripple));
        var slope = calm * (open * (Math.cos(a1) + 0.4 * Math.cos(a2)) / 1.4 - 0.38 * gust * s * Math.cos(ripple));
        var r = FLARE + 0.085 * fold + 0.07 * gust * lee;
        var tx = CX + RX * c;
        var ty = CY + RY * s;
        var hx = CX + RX * r * c + sway * (0.6 - 0.3 * c + 0.2 * s);
        var hy = CY + RY * r * s + DROP + 3.4 * fold - 3 * gust * lee * calm;
        // אור מלמעלה ומשמאל על גליל חלק, ומעליו האור והצל של הקפלים
        var base = 0.5 + 0.4 * Math.max(0, -0.42 * c + 0.9 * s);
        pts.push({
          tx: tx, ty: ty, hx: hx, hy: hy,
          mx: tx + (hx - tx) * 0.32, my: ty + (hy - ty) * 0.5,
          base: base,
          deep: base + 0.42 * slope + 0.14 * fold
        });
      }

      ctx.lineJoin = "round";
      for (i = 0; i < STRIPS; i++) {
        var p = pts[i];
        var q = pts[i + 1];
        var base2 = (p.base + q.base) / 2;
        var deep2 = (p.deep + q.deep) / 2;
        var paint = ctx.createLinearGradient(p.tx, p.ty, p.hx, p.hy);
        paint.addColorStop(0, clothColor(base2 - 0.16));
        paint.addColorStop(0.16, clothColor(base2 + (deep2 - base2) * 0.15));
        paint.addColorStop(0.6, clothColor(base2 + (deep2 - base2) * 0.75));
        paint.addColorStop(1, clothColor(deep2));
        ctx.beginPath();
        ctx.moveTo(p.tx, p.ty);
        ctx.quadraticCurveTo(p.mx, p.my, p.hx, p.hy);
        ctx.lineTo(q.hx, q.hy);
        ctx.quadraticCurveTo(q.mx, q.my, q.tx, q.ty);
        ctx.closePath();
        ctx.fillStyle = paint;
        ctx.strokeStyle = paint;
        ctx.lineWidth = 0.6;
        ctx.fill();
        ctx.stroke();
      }

      // הבד מתכהה מעט לקראת הרצפה
      var first = pts[0];
      var last = pts[STRIPS];
      ctx.beginPath();
      ctx.moveTo(first.tx, first.ty);
      ctx.ellipse(CX, CY, RX, RY, 0, 0, Math.PI);
      ctx.quadraticCurveTo(last.mx, last.my, last.hx, last.hy);
      for (i = STRIPS - 1; i >= 0; i--) ctx.lineTo(pts[i].hx, pts[i].hy);
      ctx.quadraticCurveTo(first.mx, first.my, first.tx, first.ty);
      var fade = ctx.createLinearGradient(0, CY + RY, 0, CY + RY + DROP);
      fade.addColorStop(0, "rgba(70, 92, 136, 0)");
      fade.addColorStop(1, "rgba(70, 92, 136, 0.2)");
      ctx.fillStyle = fade;
      ctx.fill();

      // פס זהב דק לאורך השוליים
      [[0.08, 1.5, 1]].forEach(function (band) {
        ctx.beginPath();
        for (i = 0; i <= STRIPS; i++) {
          var h = pts[i];
          var gx = h.hx + (h.mx - h.hx) * band[0] * 2;
          var gy = h.hy + (h.my - h.hy) * band[0] * 2;
          if (i) ctx.lineTo(gx, gy);
          else ctx.moveTo(gx, gy);
        }
        ctx.lineWidth = band[1];
        ctx.strokeStyle = "rgba(201, 164, 90, " + band[2] + ")";
        ctx.stroke();
      });
    }

    function drawTop() {
      var g = ctx.createRadialGradient(CX - 20, CY - 9, 3, CX, CY, RX * 1.05);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.6, "#f3f5f9");
      g.addColorStop(1, "#dde3ee");
      oval(ctx, CX, CY, RX, RY);
      ctx.fillStyle = g;
      ctx.fill();
      // אור על שפת השולחן, במקום שבו המפה מתקפלת כלפי מטה
      ctx.beginPath();
      ctx.ellipse(CX, CY, RX - 0.3, RY - 0.3, 0, 0.06, Math.PI - 0.06);
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      ctx.stroke();
    }

    // מקום ישיבה אחד: צלחת לבנה עם שפת זהב, מזלג משמאל וסכין מימין, בזהב
    function drawSetting(alpha) {
      var ca = Math.cos(alpha);
      var sa = Math.sin(alpha);
      var pu = 0.75 * ca;
      var pv = 0.75 * sa;
      // d מצביע אל מרכז השולחן, l הוא צד שמאל של מי שיושב
      var du = -ca, dv = -sa;
      var lu = -sa, lv = ca;
      var silver = "#bf9a4e";

      var fork = [pu + lu * 0.215, pv + lv * 0.215];
      line(onTop(fork[0] - du * 0.1, fork[1] - dv * 0.1), onTop(fork[0] + du * 0.1, fork[1] + dv * 0.1), 0.7, silver);
      line(onTop(fork[0] + du * 0.04, fork[1] + dv * 0.04), onTop(fork[0] + du * 0.1, fork[1] + dv * 0.1), 1.6, silver);

      var knife = [pu - lu * 0.215, pv - lv * 0.215];
      line(onTop(knife[0] - du * 0.1, knife[1] - dv * 0.1), onTop(knife[0] + du * 0.1, knife[1] + dv * 0.1), 0.7, silver);
      line(onTop(knife[0], knife[1]), onTop(knife[0] + du * 0.1, knife[1] + dv * 0.1), 1.3, silver);

      var plate = onTop(pu, pv);
      oval(ctx, plate[0] - 0.6, plate[1] + 1.4, RX * 0.172, RY * 0.172);
      ctx.fillStyle = "rgba(52, 72, 116, 0.3)";
      ctx.fill();
      oval(ctx, plate[0], plate[1], RX * 0.165, RY * 0.165);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = "#c9a45a";
      ctx.stroke();
      oval(ctx, plate[0], plate[1] + 0.2, RX * 0.095, RY * 0.095);
      ctx.lineWidth = 0.45;
      ctx.strokeStyle = "rgba(120, 138, 172, 0.55)";
      ctx.stroke();
    }

    // פרחי הזר, מהרחוק אל הקרוב: מיקום ביחס למרכז הזר, ורדיוס
    var BLOOMS = [
      [0, -14.5, 4.6], [-6.5, -11, 4.8], [6.5, -11.5, 4.8],
      [-11, -4, 4.6], [11, -4.5, 4.6], [0, -6.5, 5.6],
      [-12, 3.5, 4.2], [12, 3, 4.2], [-6, 1.5, 5.2], [6, 1, 5.2], [0, 6, 5]
    ];
    // עלים שמציצים מהצדדים ומלמטה: זווית ואורך
    var LEAVES = [[0.15, 19], [Math.PI - 0.15, 19], [-0.5, 17], [Math.PI + 0.5, 17], [0.75, 15], [Math.PI - 0.75, 15]];

    function bloom(x, y, r, withHeart) {
      var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.7, "#f6f8fb");
      g.addColorStop(1, "#cdd7e8");
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 0.35;
      ctx.strokeStyle = "rgba(84, 108, 150, 0.5)";
      ctx.stroke();
      if (withHeart) {
        ctx.beginPath();
        ctx.arc(x, y, r * 0.24, 0, Math.PI * 2);
        ctx.fillStyle = "#e7c56f";
        ctx.fill();
      }
    }

    // זר לבן עגול עם עלים ירוקים, באגרטל זהב נמוך. הוא נע מעט ברוח
    function drawBouquet(t, gust) {
      oval(ctx, CX - 4, CY + 2.5, 16, 5.5);
      ctx.fillStyle = "rgba(52, 72, 116, 0.26)";
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(CX - 4.2, CY - 9);
      ctx.lineTo(CX + 4.2, CY - 9);
      ctx.lineTo(CX + 3, CY + 0.4);
      ctx.quadraticCurveTo(CX, CY + 2, CX - 3, CY + 0.4);
      ctx.closePath();
      var glaze = ctx.createLinearGradient(CX - 4, 0, CX + 4, 0);
      glaze.addColorStop(0, "#ecd69a");
      glaze.addColorStop(1, "#b98f3f");
      ctx.fillStyle = glaze;
      ctx.fill();
      
      ctx.save();
      ctx.translate(CX, CY - 9);
      ctx.rotate(-0.02 - 0.08 * gust + Math.sin(t * 2.3 + seed) * 0.015);
      ctx.scale(1.3, 1.3);
      ctx.translate(0, -9);
      LEAVES.forEach(function (leaf, n) {
        ctx.save();
        ctx.rotate(leaf[0]);
        ctx.beginPath();
        ctx.ellipse(leaf[1] * 0.6, 0, leaf[1] * 0.42, 2.9, 0, 0, Math.PI * 2);
        ctx.fillStyle = n % 2 ? "#8fae93" : "#5f8a6a";
        ctx.fill();
        ctx.restore();
      });
      BLOOMS.forEach(function (b, n) {
        bloom(b[0], b[1], b[2], n % 2 === 1 || n === BLOOMS.length - 1);
      });
      ctx.restore();
    }

    // מספר השולחן, בכחול ההזמנה על המפה הלבנה. הוא נוטה מעט יחד עם הבד
    function drawNumber(sway) {
      ctx.save();
      ctx.translate(CX + sway * 0.4, CY + RY + DROP * 0.5 + 4);
      ctx.transform(1, 0, sway / DROP * 0.55, 1, 0, 0);
      ctx.direction = "ltr";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 46px 'Frank Ruhl Libre', David, serif";
      ctx.fillStyle = "#0f2147";
      ctx.fillText(number, 0, 0);
      ctx.restore();
    }

    art.draw = function (t) {
      // משבי רוח מימין: העוצמה עולה ויורדת בקצב לא קבוע, בין 0 (שקט) ל-1 (משב חזק).
      // ככל שהמשב חזק יותר, השוליים נסחפים יותר שמאלה
      var wave = 0.55 * Math.sin(t * 0.85 + seed) + 0.3 * Math.sin(t * 1.9 + seed * 1.3 + 1.7) + 0.15 * Math.sin(t * 4.3 + seed);
      var gust = Math.pow(0.5 + 0.5 * wave, 1.4);
      var sway = -(1.5 + 6.5 * gust);

      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, ART_W, ART_H);

      // צל רך על הרצפה
      var floorY = CY + DROP + RY * 0.55;
      var shadow = ctx.createRadialGradient(CX - 3, floorY, 40, CX - 3, floorY, 100);
      shadow.addColorStop(0, "rgba(2, 8, 24, 0.55)");
      shadow.addColorStop(1, "rgba(2, 8, 24, 0)");
      ctx.save();
      ctx.translate(0, floorY * (1 - 0.4));
      ctx.scale(1, 0.4);
      ctx.fillStyle = shadow;
      ctx.fillRect(0, 0, ART_W, ART_H * 2.5);
      ctx.restore();

      drawSkirt(t, gust, sway);
      drawTop();
      // מהרחוק אל הקרוב, כדי שהקרובים יכסו את הרחוקים
      var order = [];
      for (var j = 0; j < SEATS; j++) order.push(Math.PI * 2 * j / SEATS + Math.PI / SEATS);
      order.sort(function (a, b) { return Math.sin(a) - Math.sin(b); });
      order.forEach(drawSetting);
      drawBouquet(t, gust);
      drawNumber(sway * 0.85);
    };

    art.resize();
    return art;
  }

  // כל השולחנות מצוירים באותה לולאה, ורק אלה שנראים על המסך
  function animateTables(arts) {
    if (!arts.length) return;
    var STILL_T = 1.2;

    function drawAll(t) {
      arts.forEach(function (art) {
        if (art.visible) art.draw(t);
      });
    }

    drawAll(STILL_T);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { drawAll(STILL_T); });
    }
    window.addEventListener("resize", function () {
      arts.forEach(function (art) { art.resize(); });
      drawAll(STILL_T);
    });
    // מי שביקש בטלפון פחות תנועה מקבל שולחן שלא זז
    if (CALM) return;

    if ("IntersectionObserver" in window) {
      var watcher = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          arts.forEach(function (art) {
            if (art.canvas === entry.target) art.visible = entry.isIntersecting;
          });
        });
      });
      arts.forEach(function (art) { watcher.observe(art.canvas); });
    }

    var start = performance.now();
    function frame(now) {
      drawAll(STILL_T + (now - start) / 1000);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- השולחנות ---------- */

  function renderTables(guest) {
    var many = guest.tables.length > 1;
    $("tables-title").textContent = many ? "השולחנות שלכם" : "השולחן שלכם";
    $("tables-lead").textContent = many ? "שמרנו לכם מקומות:" : "שמרנו לכם מקום:";

    var list = $("seats");
    var arts = [];
    guest.tables.forEach(function (group, i) {
      var li = el("li", "seat");
      li.style.setProperty("--i", i);
      var canvas = el("canvas", "seat__art");
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", "שולחן " + group.table);
      li.appendChild(canvas);
      var who = el("div", "seat__who");
      who.appendChild(el("p", "seat__kicker", "שולחן " + group.table));
      who.appendChild(el("p", "seat__names", group.names));
      li.appendChild(who);
      list.appendChild(li);
      arts.push(tableArt(canvas, String(group.table), i * 1.7));
    });
    arts.forEach(function (art) { art.resize(); });
    animateTables(arts);

    // השולחנות נכנסים למסך רק כשמגיעים אליהם, כדי שלא יפספסו את הכניסה
    if (!CALM && "IntersectionObserver" in window) {
      list.classList.add("will-reveal");
      var reveal = new IntersectionObserver(function (entries) {
        if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
        list.classList.add("is-in");
        reveal.disconnect();
      }, { rootMargin: "0px 0px -22% 0px" });
      reveal.observe(list);
    }
  }

  /* ---------- דרכי הגעה ---------- */

  function renderStops() {
    var list = $("stops");
    E.stops.forEach(function (stop) {
      var li = el("li", "stop");
      li.appendChild(svgUse("icon-" + stop.icon, "stop__icon"));
      li.appendChild(el("h3", "stop__title", stop.title));
      li.appendChild(el("p", "stop__when", "בשעה " + stop.start));
      li.appendChild(el("p", "stop__place", stop.place));
      if (stop.address) li.appendChild(el("p", "stop__address", stop.address));

      var query = encodeURIComponent(stop.navQuery);
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
      list.appendChild(li);
    });
  }

  /*
   * ---------- גלילה אוטומטית אל השולחנות ----------
   * הרבה אורחים לא גוללים למטה, ולכן אחרי 2 שניות הדף גולל לבד עד "השולחנות שלכם".
   * מי שכבר גלל בעצמו נשאר איפה שהוא, ומי שנוגע במסך באמצע הגלילה עוצר אותה.
   */
  function scrollToTablesSoon() {
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    // הספירה מתחילה רק כשהדף באמת מוצג על המסך, כדי שהמכתב לא יידלג בקישור שנפתח ברקע
    requestAnimationFrame(function () {
      setTimeout(scrollToTables, SCROLL_AFTER_MS);
    });

    function scrollToTables() {
      if (window.scrollY > 40) return;
      var root = document.documentElement;
      var ribbon = $("sample-ribbon");
      var offset = (ribbon.hidden ? 0 : ribbon.offsetHeight) + 14;
      var from = window.scrollY;
      var to = $("tables").getBoundingClientRect().top + from - offset;
      to = Math.max(0, Math.min(to, root.scrollHeight - window.innerHeight));

      // הגלילה החלקה של הדפדפן מבוטלת לרגע, כי כאן הקצב נקבע צעד אחרי צעד
      root.style.scrollBehavior = "auto";
      var stopped = false;
      function stop() { stopped = true; }
      function done() {
        root.style.scrollBehavior = "";
        ["wheel", "touchstart", "keydown"].forEach(function (name) { window.removeEventListener(name, stop); });
      }
      ["wheel", "touchstart", "keydown"].forEach(function (name) { window.addEventListener(name, stop, { passive: true }); });

      if (CALM) {
        window.scrollTo(0, to);
        done();
        return;
      }
      var start = performance.now();
      function step(now) {
        if (stopped) {
          done();
          return;
        }
        var p = Math.min(1, (now - start) / SCROLL_MS);
        var eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        window.scrollTo(0, from + (to - from) * eased);
        if (p < 1) requestAnimationFrame(step);
        else done();
      }
      requestAnimationFrame(step);
    }
  }

  /* ---------- הפעלה ---------- */

  var guest = E ? findGuest() : null;

  if (!guest) {
    // קישור בלי אורח מזוהה: בלי מכתב, רק הפניה להזמנה
    $("letter").hidden = true;
    $("reminder").hidden = true;
    $("unknown").hidden = false;
    return;
  }

  document.title = guest.name + " · בר המצווה של " + E.childName;
  $("page-title").textContent = "תזכורת לבר המצווה של " + E.childName + ": " + guest.name;
  $("sample-ribbon").hidden = !window.GUESTS_SAMPLE;
  $("signature").textContent = E.signature;
  fillLetter($("letter"), guest);
  renderTables(guest);
  renderStops();
  scrollToTablesSoon();
})();
