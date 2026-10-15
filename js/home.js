RG.ready.then(async ({ store, members }) => {
  const { $, esc, fmtLong, fmtDay, daysUntil, pill, articleImage, today, suggestNextMeeting, hostOf } = RG;
  const all = await store.list();
  const t = today();

  const byDate = {};
  for (const r of all) (byDate[r.meeting_date] ||= []).push(r);
  const dates = Object.keys(byDate).sort();
  const next = dates.find((d) => d >= t);
  const past = dates.filter((d) => d < t).reverse();

  const when = (d) => {
    const n = daysUntil(d);
    return n === 0 ? "Today" : n === 1 ? "Tomorrow" : `In ${n} days`;
  };
  const pickers = (rows) => [...new Set(rows.map((r) => r.selected_by))].map(pill).join(" & ");

  const story = (r) => `
    <a class="story" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">
      <div class="story-img">${articleImage(r)}</div>
      <div class="story-kicker">${esc(r.publisher || hostOf(r.url))}</div>
      <h3 class="story-title">${esc(r.title)}</h3>
      ${r.description ? `<p class="story-dek">${esc(r.description)}</p>` : ""}
      ${r.authors ? `<div class="story-byline">By ${esc(r.authors)}</div>` : ""}
    </a>`;

  if (next) {
    const rows = byDate[next];
    $("#upcoming").innerHTML = `
      <div class="page-head"><p class="kicker">Next Meeting · ${when(next)}</p></div>
      <div class="meeting">
        <span class="meeting-date">${fmtLong(next)}</span>
        <span class="meeting-meta"><span>Selected by ${pickers(rows)}</span>
          ${rows.length < 2 ? `<a class="more" href="add.html">Add another article</a>` : ""}</span>
      </div>
      <div class="stories">${rows.map(story).join("")}</div>`;
  } else {
    // Nothing scheduled: suggest the next date and whose turn it is to pick.
    const suggested = suggestNextMeeting(all);
    const lastPicker = past.length && byDate[past[0]][0].selected_by;
    const turn = lastPicker ? members.find((m) => m !== lastPicker) : null;
    $("#upcoming").innerHTML = `
      <div class="page-head"><p class="kicker">Next Meeting</p></div>
      <div class="meeting"><span class="meeting-date">${fmtLong(suggested)}</span></div>
      <div class="empty">
        Nothing has been picked yet.${turn ? ` It’s ${pill(turn)}’s turn to choose.` : ""}<br><br>
        <a class="btn btn-primary" href="add.html">Add the articles</a>
      </div>`;
  }

  // The last few meetings, newest first.
  const recent = past.slice(0, 3);
  if (recent.length) {
    $("#previous").innerHTML = `
      <div class="section-label">Recently Read</div>
      <ul class="archive">${recent.flatMap((d) => byDate[d].map((r) => `
        <li>
          <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.title)}</a>
          <span class="meta">${[r.authors, r.publisher].filter(Boolean).map(esc).join(" · ")} — read ${fmtDay(d)}</span>
        </li>`)).join("")}
      </ul>
      <p><a class="more" href="history.html">The full archive</a></p>`;
  }
});
