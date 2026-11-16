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
  var SCROLL_AFTER_MS = 3500;
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
    var key = new URLSearchParams(location.search).get("g") || window.GUESTS_SAMPLE || "";
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
  var ART_H = 186;
  var CX = 100;   // מרכז משטח השולחן
  var CY = 50;
  var RX = 88;    // חצי רוחב המשטח
  var RY = 36;    // חצי גובה המשטח, כפי שהוא נראה באלכסון
  var DROP = 80;  // אורך המפה מהמשטח עד הרצפה
  var STRIPS = 64;
  var SEATS = 10;

  function mix(a, b, k) {
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  }

  // גוון הבד לפי כמות האור: מכחול כהה מאוד, דרך כחול ההזמנה, עד כחול בהיר
  var CLOTH_DARK = [7, 19, 46];
  var CLOTH_MID = [26, 56, 114];
  var CLOTH_LIGHT = [74, 122, 194];

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
      ctx.strokeStyle = color;
      ctx.stroke();
    }

    function drawSkirt(t, gust, sway) {
      var pts = [];
      var i;
      for (i = 0; i <= STRIPS; i++) {
        var th = Math.PI * i / STRIPS; // 0 בצד ימין, חצי פאי מול המסתכל, פאי בצד שמאל
        var c = Math.cos(th);
        var s = Math.sin(th);
        // שני גלים בקצב שונה, כדי שהקפלים לא ייראו כמו סרגל
        var a1 = th * 13 - t * 2.4 + seed;
        var a2 = th * 7 + t * 1.3 + seed * 2;
        var fold = (Math.sin(a1) + 0.5 * Math.sin(a2)) / 1.5;
        var slope = (Math.cos(a1) + 0.3 * Math.cos(a2)) / 1.3;
        var r = 1.05 + 0.075 * fold * gust;
        var tx = CX + RX * c;
        var ty = CY + RY * s;
        var hx = CX + RX * r * c + sway * (0.35 + 0.65 * s);
        var hy = CY + RY * r * s + DROP - 2 + 3.2 * slope * gust;
        // אור מלמעלה ומשמאל, ועוד אור וצל של הקפלים
        var lambert = Math.max(0, -0.45 * c + 0.89 * s);
        pts.push({
          tx: tx, ty: ty, hx: hx, hy: hy,
          // נקודת האמצע של הבד: הוא נופל ישר מהשולחן ורק אז נסחף ברוח
          mx: tx + (hx - tx) * 0.2, my: ty + DROP * 0.55,
          light: 0.2 + 0.52 * lambert + 0.34 * slope * (0.5 + 0.5 * gust)
        });
      }

      ctx.lineJoin = "round";
      for (i = 0; i < STRIPS; i++) {
        var p = pts[i];
        var q = pts[i + 1];
        var color = clothColor((p.light + q.light) / 2);
        ctx.beginPath();
        ctx.moveTo(p.tx, p.ty);
        ctx.quadraticCurveTo(p.mx, p.my, p.hx, p.hy);
        ctx.lineTo(q.hx, q.hy);
        ctx.quadraticCurveTo(q.mx, q.my, q.tx, q.ty);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.7;
        ctx.fill();
        ctx.stroke();
      }

      // הבד מתכהה לקראת הרצפה
      var first = pts[0];
      var last = pts[STRIPS];
      ctx.beginPath();
      ctx.moveTo(first.tx, first.ty);
      ctx.ellipse(CX, CY, RX, RY, 0, 0, Math.PI);
      ctx.quadraticCurveTo(last.mx, last.my, last.hx, last.hy);
      for (i = STRIPS - 1; i >= 0; i--) ctx.lineTo(pts[i].hx, pts[i].hy);
      ctx.quadraticCurveTo(first.mx, first.my, first.tx, first.ty);
      var fade = ctx.createLinearGradient(0, CY + RY * 0.4, 0, CY + RY + DROP);
      fade.addColorStop(0, "rgba(6, 16, 40, 0)");
      fade.addColorStop(1, "rgba(6, 16, 40, 0.34)");
      ctx.fillStyle = fade;
      ctx.fill();

      // פס זהב דק לאורך השוליים
      ctx.beginPath();
      for (i = 2; i <= STRIPS - 2; i++) {
        var h = pts[i];
        var gx = h.hx + (h.mx - h.hx) * 0.14;
        var gy = h.hy + (h.my - h.hy) * 0.14;
        if (i > 2) ctx.lineTo(gx, gy);
        else ctx.moveTo(gx, gy);
      }
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(222, 194, 132, 0.92)";
      ctx.stroke();
    }

    function drawTop() {
      var g = ctx.createRadialGradient(CX - 22, CY - 10, 4, CX, CY, RX * 1.05);
      g.addColorStop(0, "#4675bb");
      g.addColorStop(0.55, "#234a8c");
      g.addColorStop(1, "#15305f");
      oval(ctx, CX, CY, RX, RY);
      ctx.fillStyle = g;
      ctx.fill();
      // אור על שפת השולחן, במקום שבו המפה מתקפלת כלפי מטה
      ctx.beginPath();
      ctx.ellipse(CX, CY, RX - 0.4, RY - 0.4, 0, 0.12, Math.PI - 0.12);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(176, 204, 244, 0.6)";
      ctx.stroke();
    }

    // מקום ישיבה אחד: צלחת של 26 ס"מ, מזלג משמאל, סכין מימין, וכוס מעל הסכין
    function drawSetting(alpha) {
      var ca = Math.cos(alpha);
      var sa = Math.sin(alpha);
      var pu = 0.77 * ca;
      var pv = 0.77 * sa;
      // d מצביע אל מרכז השולחן, l הוא צד שמאל של מי שיושב
      var du = -ca, dv = -sa;
      var lu = -sa, lv = ca;
      var silver = "#e3e9f3";

      var fork = [pu + lu * 0.2, pv + lv * 0.2];
      line(onTop(fork[0] - du * 0.11, fork[1] - dv * 0.11), onTop(fork[0] + du * 0.11, fork[1] + dv * 0.11), 0.9, silver);
      line(onTop(fork[0] + du * 0.035, fork[1] + dv * 0.035), onTop(fork[0] + du * 0.11, fork[1] + dv * 0.11), 2, silver);

      var knife = [pu - lu * 0.2, pv - lv * 0.2];
      line(onTop(knife[0] - du * 0.12, knife[1] - dv * 0.12), onTop(knife[0] + du * 0.12, knife[1] + dv * 0.12), 0.9, silver);
      line(onTop(knife[0] - du * 0.005, knife[1] - dv * 0.005), onTop(knife[0] + du * 0.12, knife[1] + dv * 0.12), 1.7, silver);

      var glass = onTop(pu + du * 0.2 - lu * 0.15, pv + dv * 0.2 - lv * 0.15);
      oval(ctx, glass[0], glass[1], RX * 0.042, RY * 0.042);
      ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
      ctx.fill();
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.stroke();

      var plate = onTop(pu, pv);
      oval(ctx, plate[0] - 0.7, plate[1] + 1.3, RX * 0.165, RY * 0.165);
      ctx.fillStyle = "rgba(5, 14, 36, 0.38)";
      ctx.fill();
      oval(ctx, plate[0], plate[1], RX * 0.16, RY * 0.16);
      ctx.fillStyle = "#fdfcf8";
      ctx.fill();
      ctx.lineWidth = 0.55;
      ctx.strokeStyle = "rgba(190, 150, 70, 0.75)";
      ctx.stroke();
      oval(ctx, plate[0], plate[1] + 0.25, RX * 0.1, RY * 0.1);
      ctx.strokeStyle = "rgba(150, 162, 186, 0.7)";
      ctx.stroke();
    }

    function flower(x, y, r) {
      for (var k = 0; k < 5; k++) {
        var a = k * Math.PI * 2 / 5 + x;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r * 0.56, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.lineWidth = 0.35;
        ctx.strokeStyle = "rgba(170, 184, 206, 0.8)";
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = "#ecd28a";
      ctx.fill();
    }

    var LEAVES = [[-2.6, 12, "#3b6646"], [-2.0, 10, "#4f7d55"], [-1.15, 11, "#3b6646"], [-0.5, 12, "#4f7d55"], [-1.57, 14, "#467350"]];
    var FLOWERS = [[-9, -1.5, 2.9], [9.5, -2, 2.9], [-5.5, -10.5, 3.1], [5.5, -11, 3.1], [0, -13.5, 3.3],
      [-6.5, -5.5, 3.7], [6.5, -6, 3.7], [-2.5, -2.5, 3.5], [3.5, -2, 3.4], [0, -8.5, 4.3]];

    // זר לבן קטן באגרטל נמוך, שנע מעט ברוח
    function drawBouquet(t, gust) {
      oval(ctx, CX - 3, CY + 2, 13, 5);
      ctx.fillStyle = "rgba(5, 14, 36, 0.36)";
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(CX - 3.4, CY - 8);
      ctx.lineTo(CX + 3.4, CY - 8);
      ctx.lineTo(CX + 2.6, CY);
      ctx.quadraticCurveTo(CX, CY + 1.6, CX - 2.6, CY);
      ctx.closePath();
      ctx.fillStyle = "#eef2f8";
      ctx.fill();
      ctx.lineWidth = 0.4;
      ctx.strokeStyle = "rgba(150, 165, 190, 0.9)";
      ctx.stroke();

      ctx.save();
      ctx.translate(CX, CY - 8);
      ctx.rotate(-0.04 + Math.sin(t * 1.5 + seed) * 0.06 * gust);
      ctx.scale(1.2, 1.2);
      LEAVES.forEach(function (leaf) {
        ctx.save();
        ctx.rotate(leaf[0] + Math.PI / 2);
        ctx.beginPath();
        ctx.ellipse(0, -leaf[1] * 0.55, 2.6, leaf[1] * 0.55, 0, 0, Math.PI * 2);
        ctx.fillStyle = leaf[2];
        ctx.fill();
        ctx.restore();
      });
      FLOWERS.forEach(function (f) {
        flower(f[0], f[1], f[2]);
      });
      ctx.restore();
    }

    // מספר השולחן, רקום בזהב על המפה. הוא נוטה מעט יחד עם הבד
    function drawNumber(sway) {
      ctx.save();
      ctx.translate(CX + sway * 0.4, CY + RY + DROP * 0.5 + 2);
      ctx.transform(1, 0, sway / DROP * 0.55, 1, 0, 0);
      ctx.direction = "ltr";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "900 52px 'Frank Ruhl Libre', David, serif";
      ctx.fillStyle = "rgba(3, 10, 28, 0.6)";
      ctx.fillText(number, 0.9, 1.6);
      var gold = ctx.createLinearGradient(0, -24, 0, 24);
      gold.addColorStop(0, "#fbe9b4");
      gold.addColorStop(0.55, "#e2bf74");
      gold.addColorStop(1, "#c79a45");
      ctx.fillStyle = gold;
      ctx.fillText(number, 0, 0);
      ctx.restore();
    }

    art.draw = function (t) {
      // משבי רוח: העוצמה עולה ויורדת, והשוליים נסחפים שמאלה
      var gust = 0.62 + 0.38 * Math.sin(t * 0.7 + seed) * Math.sin(t * 0.23 + 1);
      var sway = -(3 + 3.5 * Math.sin(t * 0.9 + seed)) * gust;

      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, ART_W, ART_H);

      // צל על הרצפה
      var shadow = ctx.createRadialGradient(CX - 4, CY + DROP + 6, 30, CX - 4, CY + DROP + 6, 98);
      shadow.addColorStop(0, "rgba(8, 21, 48, 0.4)");
      shadow.addColorStop(1, "rgba(8, 21, 48, 0)");
      ctx.save();
      ctx.translate(0, (CY + DROP + 6) * (1 - 0.42));
      ctx.scale(1, 0.42);
      ctx.fillStyle = shadow;
      ctx.fillRect(0, 0, ART_W, ART_H * 2.4);
      ctx.restore();

      drawSkirt(t, gust, sway);
      drawTop();
      // מהרחוק אל הקרוב, כדי שהקרובים יכסו את הרחוקים
      var order = [];
      for (var j = 0; j < SEATS; j++) order.push(Math.PI * 2 * j / SEATS + Math.PI / SEATS);
      order.sort(function (a, b) { return Math.sin(a) - Math.sin(b); });
      order.forEach(drawSetting);
      drawBouquet(t, gust);
      drawNumber(sway);
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
   * הרבה אורחים לא גוללים למטה, ולכן אחרי 3.5 שניות הדף גולל לבד עד "השולחנות שלכם".
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
