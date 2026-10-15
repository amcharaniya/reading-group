RG.ready.then(async ({ store, me, members }) => {
  const { $, esc, fmtDay, fmtLong, pill, articleImage, hostOf, suggestNextMeeting } = RG;
  const editId = new URLSearchParams(location.search).get("id");
  const DETAIL_FIELDS = ["title", "authors", "publisher", "published_on", "image_url", "description"];
  let all = await store.list();

  $("#selected_by").innerHTML = members.map((m) => `<option>${esc(m)}</option>`).join("");
  $("#selected_by").value = me;
  $("#meeting_date").value = suggestNextMeeting(all);

  // ---------- pull article details ----------
  // Microlink reads the page's title / author / publisher / date / preview image (free, no key, ~50 links a day).
  async function fetchMeta(url) {
    // Slow sites sometimes time out on the first try and succeed once Microlink has cached them, so retry once.
    let json;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 20000);
        const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`, { signal: ctrl.signal });
        json = await res.json();
        clearTimeout(timer);
      } catch (err) {
        json = { message: err.name === "AbortError" ? "the site took too long to respond" : err.message };
      }
      if (json.status === "success") break;
    }
    if (json.status !== "success") {
      const msg = /rate limit/i.test(json.message || "")
        ? "the free lookup service's daily limit is used up; it resets tomorrow"
        : json.message || "couldn't read that page";
      throw new Error(msg);
    }
    const d = json.data;
    return {
      title: d.title || "",
      authors: d.author || "",
      publisher: d.publisher || hostOf(url),
      published_on: d.date ? d.date.slice(0, 10) : "",
      image_url: d.image?.url || "",
      description: d.description || "",
    };
  }

  // Fields typed by hand since the last fetch. Re-fetching the same link never overwrites them;
  // fetching a different link starts fresh.
  const edited = new Set();
  for (const k of DETAIL_FIELDS) $(`#${k}`).addEventListener("input", () => {
    edited.add(k);
    $(`#${k}`).classList.toggle("missing", !$(`#${k}`).value.trim());
  });

  function markMissing() {
    for (const k of DETAIL_FIELDS) $(`#${k}`).classList.toggle("missing", !$(`#${k}`).value.trim());
  }

  function showDetails() {
    $("#details").hidden = false;
    $("#manual").hidden = true;
    markMissing();
    updatePreview();
  }

  let lastFetched = "";
  async function fillFromUrl(force) {
    const url = $("#url").value.trim();
    if (!url || !$("#url").checkValidity() || (url === lastFetched && !force)) return;
    if (url !== lastFetched) edited.clear();
    lastFetched = url;
    const status = $("#fetchStatus");
    status.className = "status";
    status.textContent = "Reading the article…";
    $("#fetch").disabled = true;
    try {
      const meta = await fetchMeta(url);
      const kept = [];
      for (const k of DETAIL_FIELDS) {
        if (edited.has(k)) { kept.push(k); continue; }
        $(`#${k}`).value = meta[k];
      }
      const missing = DETAIL_FIELDS.filter((k) => !$(`#${k}`).value.trim()).length;
      status.textContent = "Filled in below. Check everything before saving"
        + (missing ? ` (${missing} field${missing === 1 ? "" : "s"} not found)` : "")
        + (kept.length ? "; your own edits were kept." : ".");
    } catch (err) {
      if (!edited.has("publisher")) $("#publisher").value ||= hostOf(url);
      status.className = "status err";
      status.textContent = `Couldn't pull details automatically (${err.message}). Fill them in below.`;
    }
    $("#fetch").disabled = false;
    showDetails();
    $("#title").focus();
  }

  $("#manual").onclick = () => {
    const url = $("#url").value.trim();
    if (url && !$("#publisher").value) $("#publisher").value = hostOf(url);
    $("#fetchStatus").textContent = "";
    showDetails();
    $("#title").focus();
  };

  function updatePreview() {
    const r = Object.fromEntries(DETAIL_FIELDS.map((k) => [k, $(`#${k}`).value]));
    r.url = $("#url").value;
    $("#preview").innerHTML = `
      <div class="story">
        <div class="story-img">${articleImage(r)}</div>
        <div class="story-kicker">${esc(r.publisher || hostOf(r.url))}</div>
        <h3 class="story-title">${esc(r.title || "Untitled")}</h3>
        ${r.authors ? `<div class="story-byline">By ${esc(r.authors)}</div>` : ""}
      </div>`;
  }

  $("#fetch").onclick = () => fillFromUrl(true);
  $("#url").addEventListener("change", () => fillFromUrl(false));
  $("#url").addEventListener("paste", () => setTimeout(() => fillFromUrl(false), 0));
  for (const k of ["title", "authors", "publisher", "image_url"]) $(`#${k}`).addEventListener("input", updatePreview);

  // ---------- articles already on the chosen meeting ----------
  function renderSameDay() {
    const d = $("#meeting_date").value;
    const rows = all.filter((r) => r.meeting_date === d && String(r.id) !== editId);
    $("#sameDayTitle").textContent = d && rows.length ? `Already on ${fmtLong(d)}` : "";
    $("#sameDay").innerHTML = rows.map((r) => `
      <li><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.title)}</a>
        ${pill(r.selected_by)} <a class="small muted" href="add.html?id=${r.id}">edit</a></li>`).join("");
  }
  $("#meeting_date").addEventListener("change", renderSameDay);

  // ---------- edit mode ----------
  if (editId) {
    const r = await store.get(editId);
    if (!r) { $("#intro").textContent = "That article doesn't exist anymore."; $("#form").hidden = true; return; }
    document.querySelector(".page-title").textContent = "Edit article";
    $("#intro").textContent = `Entered by ${r.entered_by || "someone"}${r.updated_by ? `, last edited by ${r.updated_by}` : ""}.`;
    for (const k of ["url", "meeting_date", "selected_by", ...DETAIL_FIELDS]) $(`#${k}`).value = r[k] ?? "";
    lastFetched = r.url;
    showDetails();
    $("#save").textContent = "Save changes";
    $("#cancel").hidden = false;
    $("#delete").hidden = false;
    $("#delete").onclick = async () => {
      if (!confirm(`Delete “${r.title}”?`)) return;
      await store.remove(editId);
      location.href = "history.html";
    };
    updatePreview();
  }
  renderSameDay();

  // ---------- save ----------
  $("#form").onsubmit = async (e) => {
    e.preventDefault();
    const status = $("#saveStatus");
    // Always show the details for review before the first save.
    if ($("#details").hidden) {
      await fillFromUrl(true);
      if (!$("#details").hidden) { status.className = "status"; status.textContent = "Review the details below, then save."; }
      return;
    }
    if (!$("#title").value.trim()) { $("#title").focus(); status.className = "status err"; status.textContent = "Add a title first."; return; }
    const row = Object.fromEntries(
      ["url", "meeting_date", "selected_by", ...DETAIL_FIELDS].map((k) => [k, $(`#${k}`).value.trim()]));
    if (editId) row.id = editId;
    $("#save").disabled = true;
    status.className = "status";
    status.textContent = "Saving…";
    try {
      await store.save(row);
      if (editId) { location.href = "history.html"; return; }
      all = await store.list();
      status.textContent = `Saved “${row.title}” for ${fmtDay(row.meeting_date)}.`;
      // Keep the meeting date and picker so the second article is quick to add.
      for (const k of ["url", ...DETAIL_FIELDS]) $(`#${k}`).value = "";
      lastFetched = "";
      edited.clear();
      $("#details").hidden = true;
      $("#manual").hidden = false;
      $("#fetchStatus").textContent = "";
      renderSameDay();
      $("#url").focus();
    } catch (err) {
      status.className = "status err";
      status.textContent = `Couldn't save: ${err.message}`;
    }
    $("#save").disabled = false;
  };
});
