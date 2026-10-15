RG.ready.then(async ({ store, members }) => {
  const { $, esc, fmtLong, fmtDay, daysUntil, pill, articleImage, today, suggestNextMeeting } = RG;
  const all = await store.list();
  const t = today();

  const byDate = {};
  for (const r of all) (byDate[r.meeting_date] ||= []).push(r);
  const dates = Object.keys(byDate).sort();
  const next = dates.find((d) => d >= t);
  const prev = dates.filter((d) => d < t).pop();

  const when = (d) => {
    const n = daysUntil(d);
    return n === 0 ? "today" : n === 1 ? "tomorrow" : n > 0 ? `in ${n} days` : `${-n} days ago`;
  };
  const pickers = (rows) => [...new Set(rows.map((r) => r.selected_by))].map(pill).join(" ");

  const tile = (r) => `
    <a class="tile" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">
      <div class="tile-img">${articleImage(r)}</div>
      <div class="tile-body">
        <div class="tile-title">${esc(r.title)}</div>
        <div class="tile-meta">${[r.authors, r.publisher].filter(Boolean).map(esc).join(" · ")}</div>
        ${r.description ? `<div class="tile-desc">${esc(r.description)}</div>` : ""}
      </div>
    </a>`;

  if (next) {
    const rows = byDate[next];
    $("#upcoming").innerHTML = `
      <div class="meeting">
        <span class="meeting-date">${fmtLong(next)}</span>
        <span class="muted">${when(next)}</span>
      </div>
      <dl class="props">
        <dt>Selected by</dt><dd>${pickers(rows)}</dd>
        <dt>Articles</dt><dd>${rows.length}${rows.length < 2 ? ` · <a href="add.html">add another</a>` : ""}</dd>
      </dl>
      <div class="gallery">${rows.map(tile).join("")}</div>`;
  } else {
    // Nothing scheduled: suggest the next date and whose turn it is to pick.
    const suggested = suggestNextMeeting(all);
    const lastPicker = prev && byDate[prev][0].selected_by;
    const turn = lastPicker ? members.find((m) => m !== lastPicker) : null;
    $("#upcoming").innerHTML = `
      <div class="meeting"><span class="meeting-date">Next meeting</span></div>
      <div class="empty">
        Nothing picked yet. Two weeks from last time is <b>${fmtLong(suggested)}</b>.<br>
        ${turn ? `It's ${pill(turn)}'s turn to pick. ` : ""}<a href="add.html">Add the articles →</a>
      </div>`;
  }

  if (prev) {
    $("#previous").innerHTML = `
      <h3>Last time · <span class="muted">${fmtDay(prev)}</span></h3>
      <ul class="list">${byDate[prev].map((r) => `
        <li><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.title)}</a>
          <span class="muted small">${esc(r.publisher || "")}</span></li>`).join("")}
      </ul>
      <p class="small"><a href="history.html">See everything we've read →</a></p>`;
  }
});
