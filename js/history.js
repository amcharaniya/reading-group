RG.ready.then(async ({ store, members }) => {
  const { $, esc, fmtDay, pill, hostOf } = RG;
  const all = await store.list();
  let sortKey = "meeting_date", asc = false;

  $("#selector").insertAdjacentHTML("beforeend",
    members.map((m) => `<option value="${esc(m)}">Selected by ${esc(m)}</option>`).join(""));

  // Publisher filter: every publisher we've read, A–Z, with how many articles each.
  const pubCounts = {};
  for (const r of all) if (r.publisher) pubCounts[r.publisher] = (pubCounts[r.publisher] || 0) + 1;
  $("#publisher").insertAdjacentHTML("beforeend", Object.keys(pubCounts)
    .sort((a, b) => a.replace(/^The /, "").localeCompare(b.replace(/^The /, "")))
    .map((p) => `<option value="${esc(p)}">${esc(p)} (${pubCounts[p]})</option>`).join(""));

  function render() {
    const q = $("#q").value.trim().toLowerCase();
    const who = $("#selector").value;
    const pub = $("#publisher").value;
    const rows = all
      .filter((r) => !who || r.selected_by === who)
      .filter((r) => !pub || r.publisher === pub)
      .filter((r) => !q || [r.title, r.authors, r.publisher].some((v) => (v || "").toLowerCase().includes(q)))
      .sort((a, b) => {
        const x = a[sortKey] ?? "", y = b[sortKey] ?? "";
        return (asc ? 1 : -1) * String(x).localeCompare(String(y), undefined, { sensitivity: "base" })
          || b.meeting_date.localeCompare(a.meeting_date);
      });

    $("#count").textContent = `${rows.length} article${rows.length === 1 ? "" : "s"}`;
    $("#rows").innerHTML = rows.length ? rows.map((r) => `
      <tr>
        <td class="title"><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.title)}</a><a
          class="edit" href="add.html?id=${r.id}" >Edit</a></td>
        <td>${esc(r.authors || "")}</td>
        <td class="nowrap">${fmtDay(r.published_on)}</td>
        <td>${esc(r.publisher || "")}</td>
        <td class="nowrap">${fmtDay(r.meeting_date)}</td>
        <td>${pill(r.selected_by)}</td>
        <td class="nowrap"><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(hostOf(r.url))}</a></td>
      </tr>`).join("")
      : `<tr><td colspan="7" class="muted">No articles${q || who || pub ? " match" : " yet"}.</td></tr>`;

    document.querySelectorAll("th").forEach((th) => {
      th.classList.toggle("sorted", th.dataset.key === sortKey);
      th.classList.toggle("asc", th.dataset.key === sortKey && asc);
    });
  }

  document.querySelectorAll("th").forEach((th) => th.addEventListener("click", () => {
    if (sortKey === th.dataset.key) asc = !asc;
    else { sortKey = th.dataset.key; asc = !["meeting_date", "published_on"].includes(sortKey); }
    render();
  }));
  $("#q").addEventListener("input", render);
  $("#selector").addEventListener("change", render);
  $("#publisher").addEventListener("change", render);
  render();
});
