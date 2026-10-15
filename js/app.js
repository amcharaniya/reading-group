// Shared by every page: layout chrome, sign-in gate, data store and small helpers.
// Pages put their markup in <div id="content" hidden> and run code in RG.ready.then(...).
(() => {
  const cfg = window.RG_CONFIG || {};
  // Demo mode (sample data in this browser) until Supabase is configured, and always for local previews.
  const DEMO = !cfg.supabaseUrl || cfg.supabaseUrl.startsWith("YOUR_") || location.hostname === "localhost";
  const EVERY = cfg.meetingEveryDays || 14;

  const SITE = "Pursuit of Ilm";
  const NAV = [
    ["index.html", "home", "This Issue"],
    ["history.html", "history", "The Archive"],
    ["add.html", "add", "Submit"],
    ["about.html", "about", "About Us"],
  ];

  // ---------- helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Dates are 'YYYY-MM-DD' strings, treated as local calendar days.
  const parseDay = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const toDay = (dt) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const today = () => toDay(new Date());
  const addDays = (s, n) => { const d = parseDay(s); d.setDate(d.getDate() + n); return toDay(d); };
  const daysUntil = (s) => Math.round((parseDay(s) - parseDay(today())) / 86400000);
  const fmtDay = (s, opts = { month: "short", day: "numeric", year: "numeric" }) =>
    s ? parseDay(s).toLocaleDateString(undefined, opts) : "";
  const fmtLong = (s) => fmtDay(s, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  // Next meeting date to suggest: one cadence after the latest meeting, rolled forward past today.
  function suggestNextMeeting(readings) {
    const t = today();
    const future = readings.map((r) => r.meeting_date).filter((d) => d >= t).sort();
    if (future.length) return future[0];
    const last = readings.map((r) => r.meeting_date).sort().pop();
    if (!last) return addDays(t, EVERY);
    let next = addDays(last, EVERY);
    while (next < t) next = addDays(next, EVERY);
    return next;
  }

  // A member's name as a small-caps byline, each in their own ink color.
  const pill = (name) => name
    ? `<span class="pill pill-${esc(String(name).toLowerCase())}">${esc(name)}</span>` : "";

  // Article image, falling back to a lettered placeholder if missing or blocked from hotlinking.
  function articleImage(r) {
    const label = esc((r.publisher || hostOf(r.url) || "?").trim());
    const ph = `<div class="img-ph"><span>${label}</span></div>`;
    if (!r.image_url) return ph;
    return `${ph}<img src="${esc(r.image_url)}" alt="" loading="lazy" referrerpolicy="no-referrer"
      onerror="this.remove()">`;
  }
  const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; } };

  // ---------- data stores ----------
  const FIELDS = ["url", "title", "authors", "publisher", "published_on", "image_url",
    "description", "meeting_date", "selected_by"];
  const pick = (r) => Object.fromEntries(FIELDS.map((k) => [k, r[k] === "" ? null : r[k] ?? null]));

  function supabaseStore(sb) {
    const must = ({ data, error }) => { if (error) throw error; return data; };
    return {
      list: async () => must(await sb.from("readings").select("*")
        .order("meeting_date", { ascending: false }).order("id")),
      get: async (id) => must(await sb.from("readings").select("*").eq("id", id).single()),
      save: async (r) => r.id
        ? must(await sb.from("readings").update(pick(r)).eq("id", r.id).select().single())
        : must(await sb.from("readings").insert(pick(r)).select().single()),
      remove: async (id) => must(await sb.from("readings").delete().eq("id", id)),
    };
  }

  // Demo mode: sample data kept in this browser only, so the site can be tried before Supabase is set up.
  function demoStore(me) {
    const KEY = "rg-demo-readings";
    const seed = () => {
      const next = suggestNextMeeting([{ meeting_date: addDays(today(), -5) }]);
      const prev = addDays(next, -EVERY), prev2 = addDays(prev, -EVERY);
      return [
        { id: 1, meeting_date: next, selected_by: "Mae", entered_by: "Mae",
          url: "https://en.wikipedia.org/wiki/Reading", title: "Sample article one: replace me with a real link",
          authors: "Jane Writer", publisher: "Wikipedia", published_on: addDays(today(), -20), image_url: null },
        { id: 2, meeting_date: next, selected_by: "Mae", entered_by: "Mae",
          url: "https://en.wikipedia.org/wiki/Book_discussion_club", title: "Sample article two: what makes a good book club",
          authors: "John Essayist, Ann Editor", publisher: "Wikipedia", published_on: addDays(today(), -30), image_url: null },
        { id: 3, meeting_date: prev, selected_by: "Amaan", entered_by: "Amaan",
          url: "https://en.wikipedia.org/wiki/Essay", title: "A past reading on the history of the essay",
          authors: "Pat Historian", publisher: "Wikipedia", published_on: addDays(today(), -60), image_url: null },
        { id: 4, meeting_date: prev, selected_by: "Amaan", entered_by: "Amaan",
          url: "https://en.wikipedia.org/wiki/Longform_journalism", title: "Another past reading on longform journalism",
          authors: "Sam Reporter", publisher: "Wikipedia", published_on: addDays(today(), -70), image_url: null },
        { id: 5, meeting_date: prev2, selected_by: "Mae", entered_by: "Mae",
          url: "https://en.wikipedia.org/wiki/Magazine", title: "Older reading about magazines",
          authors: "Lee Critic", publisher: "Wikipedia", published_on: addDays(today(), -90), image_url: null },
      ];
    };
    const load = () => {
      try { const v = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(v)) return v; } catch {}
      const s = seed(); write(s); return s;
    };
    const write = (rows) => { try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch {} };
    let rows = load();
    return {
      list: async () => [...rows].sort((a, b) => b.meeting_date.localeCompare(a.meeting_date) || a.id - b.id),
      get: async (id) => rows.find((r) => r.id === Number(id)),
      save: async (r) => {
        if (r.id) {
          const i = rows.findIndex((x) => x.id === Number(r.id));
          rows[i] = { ...rows[i], ...pick(r), updated_by: me };
          write(rows); return rows[i];
        }
        const row = { ...pick(r), id: Math.max(0, ...rows.map((x) => x.id)) + 1, entered_by: me };
        rows.push(row); write(rows); return row;
      },
      remove: async (id) => { rows = rows.filter((x) => x.id !== Number(id)); write(rows); },
    };
  }

  // ---------- layout ----------
  function renderChrome() {
    const page = document.body.dataset.page;
    const nav = NAV.map(([href, key, label]) =>
      `<a href="${href}" class="${key === page ? "active" : ""}">${label}</a>`).join("");
    const dateline = new Date().toLocaleDateString(undefined,
      { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    document.body.insertAdjacentHTML("afterbegin", `
      <header class="wrap">
        <div class="utility"><span class="date">${dateline}</span><div class="who" id="who"></div></div>
        <div class="masthead">
          <a href="index.html"><h1 class="nameplate">${SITE}</h1></a>
          <p class="tagline">Two readers, two articles, every other week</p>
        </div>
        <div class="rule-double"></div>
        <nav class="nav" id="nav" hidden>${nav}</nav>
        <figure class="hero">
          <div class="hero-img"><img src="assets/header.webp" alt="Painting of Socrates and Aspasia in conversation across a table"></div>
          <figcaption>Nicolas-André Monsiau, <i>Socrates and Aspasia</i>, c. 1800</figcaption>
        </figure>
      </header>`);
    document.body.insertAdjacentHTML("beforeend", `<footer class="footer wrap">${SITE}</footer>`);
    const content = $("#content");
    const { kicker, title, dek } = document.body.dataset;
    content.insertAdjacentHTML("beforebegin", `
      ${title ? `<div class="page-head">
        ${kicker ? `<p class="kicker">${esc(kicker)}</p>` : ""}
        <h2 class="page-title">${esc(title)}</h2>
        ${dek ? `<p class="dek">${esc(dek)}</p>` : ""}
      </div>` : ""}
      <div id="gate"></div>`);
  }

  function showGate(html) { $("#gate").innerHTML = html; }

  function showSite(me, signOut) {
    $("#gate").innerHTML = DEMO
      ? `<div class="note note-warn"><b>Demo mode.</b> These are sample articles saved only in this browser,
         not the real reading list.</div>`
      : "";
    $("#nav").hidden = false;
    $("#who").innerHTML = `<span>Signed in as ${pill(me)}</span>${signOut ? `<button class="link-btn" id="signOut">Sign out</button>` : ""}`;
    if (signOut) $("#signOut").onclick = signOut;
    $("#content").hidden = false;
  }

  function loginForm(sb) {
    showGate(`
      <div class="note">For Amaan and Mae only. Sign in with your email and we'll send you a link.</div>
      <form class="login" id="login">
        <input type="email" id="email" required placeholder="you@example.com" autocomplete="email">
        <button class="btn btn-primary" type="submit">Email me a sign-in link</button>
      </form>
      <p class="muted" id="loginMsg"></p>`);
    $("#login").onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector("button");
      btn.disabled = true;
      const { error } = await sb.auth.signInWithOtp({
        email: $("#email").value.trim(),
        options: { emailRedirectTo: location.href.split(/[?#]/)[0] },
      });
      btn.disabled = false;
      $("#loginMsg").textContent = error
        ? `Couldn't send the link: ${error.message}`
        : "Check your email for the sign-in link. You can close this tab.";
    };
  }

  async function boot() {
    renderChrome();
    if (DEMO) {
      const me = "Amaan";
      showSite(me, null);
      return { store: demoStore(me), me, members: ["Amaan", "Mae"], demo: true };
    }
    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    const { data: { session } } = await sb.auth.getSession();
    sb.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") location.reload(); });
    if (!session) { loginForm(sb); return new Promise(() => {}); }

    const signOut = () => sb.auth.signOut();
    const { data: me } = await sb.rpc("my_name");
    if (!me) {
      showGate(`<div class="note"><b>${esc(session.user.email)}</b> isn't on the member list.
        <button class="link-btn" id="signOut2">Sign out</button></div>`);
      $("#signOut2").onclick = signOut;
      return new Promise(() => {});
    }
    const { data: memberRows } = await sb.from("members").select("name").order("name");
    showSite(me, signOut);
    return { store: supabaseStore(sb), me, members: (memberRows || []).map((m) => m.name), demo: false };
  }

  window.RG = {
    $, esc, today, addDays, daysUntil, fmtDay, fmtLong, hostOf, pill, articleImage, suggestNextMeeting,
    ready: new Promise((resolve) => {
      const go = () => boot().then(resolve).catch((err) => {
        showGate(`<div class="note">Something went wrong: ${esc(err.message)}</div>`);
      });
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
    }),
  };
})();
