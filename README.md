# Pursuit of Ilm

Amaan and Mae's reading group: two articles every two weeks. Static site on GitHub Pages; articles stored in Supabase.

| Page | What it does |
| --- | --- |
| `index.html` | Next meeting date and a tile for each article |
| `history.html` | Every article: title, author(s), published date, publisher, date we read, who picked it, link. Searchable and sortable |
| `add.html` | Paste a link and pick a meeting date. Title, author, publisher, date and image are filled in automatically (via [Microlink](https://microlink.io)) and can be edited. `add.html?id=N` edits or deletes an article |
| `about.html` | About us (placeholders for now) |

## Privacy

The pages themselves are public files, but they show nothing except a sign-in box. Articles live in Supabase behind
row-level security: only emails in the `members` table can read or write them, and each article records who entered it
(`entered_by`) and who last edited it (`updated_by`). Sign-in uses an emailed magic link.

## Setup

1. **Supabase project**: create one at supabase.com (free tier).
2. **Database**: open SQL Editor and run `supabase/schema.sql`. Then put Mae's email in `supabase/setup.local.sql`
   (git-ignored) and run that too.
3. **Auth**: under Authentication → URL Configuration, set the Site URL to the GitHub Pages address
   (e.g. `https://amcharaniya.github.io/reading-group/`) and add it to Redirect URLs.
4. **Config**: copy the Project URL and publishable/anon key from Project Settings → API into `js/config.js`.
   Until then, the site runs in demo mode with sample data stored in your browser.
5. **Publish**: push to GitHub and turn on Pages (Settings → Pages → deploy from `main`, root).

## Customizing

- **Header photo**: `assets/header.webp` (Monsiau, *Socrates and Aspasia*). Caption lives in `js/app.js`.
- **About us**: edit `about.html`. Photos go in `assets/`.
- **Meeting cadence**: `meetingEveryDays` in `js/config.js` sets the suggested next date.

## Local preview

```bash
python3 -m http.server 8765
```
