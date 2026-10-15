RG.ready.then(async ({ store, members }) => {
  const { $, esc, fmtDay, pill, hostOf } = RG;
  const all = await store.list();
  let sortKey = "meeting_date", asc = false;

  $("#selector").insertAdjacentHTML("beforeend",
    members.map((m) => `<option value="${esc(m)}">Selected by: ${esc(m)}</option>`).join(""));

  function render() {
    const q = $("#q").value.trim().toLowerCase();
    const who = $("#selector").value;
    const rows = all
      .filter((r) => !who || r.selected_by === who)
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
          class="edit" href="add.html?id=${r.id}" title="Edit">✎</a></td>
        <td>${esc(r.authors || "")}</td>
        <td class="nowrap">${fmtDay(r.published_on)}</td>
        <td>${esc(r.publisher || "")}</td>
        <td class="nowrap">${fmtDay(r.meeting_date)}</td>
        <td>${pill(r.selected_by)}</td>
        <td class="nowrap"><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(hostOf(r.url))}</a></td>
      </tr>`).join("")
      : `<tr><td colspan="7" class="muted">No articles${q || who ? " match" : " yet"}.</td></tr>`;

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
  render();
});
