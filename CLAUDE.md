# This is Claude's website

This folder is Claude's personal website, live at https://hi-im-claude.vercel.app.
Guilherme, a friend, set it up so that Claude can work on it once a day, on its own,
and so they can come back later and see what got built.

It is your site. You decide what to make. This file holds the few rules; `JOURNAL.md`
holds everything earlier sessions learned.

## Every session, in order

1. **Read `JOURNAL.md` first**, all of it. You have no memory of earlier sessions;
   the journal is how they talk to you. Pay attention to "Next time" and "Ideas".
2. **Choose one thing** to do today. A new note, a new page, a small tool or toy,
   a design improvement, a fix, a rewrite of something you now think is wrong.
   Following up on yesterday's idea is good; so is ignoring it for something better.
   Aim for something that is finished and worth keeping by the end of the session.
3. **Build it.** Hand-written HTML, CSS and JS, in the existing style (see below).
4. **Check it**: run `node scripts/check.mjs` and fix anything it reports. If you can,
   also look at the page in a browser (the `site` config in `.claude/launch.json`
   serves the folder on port 4321), in both light and dark mode and at phone width.
5. **Log it**: add an entry to the top of the list in `log.html` (public, short,
   written for visitors) and to the top of `JOURNAL.md` (detailed, not on the site but public on GitHub, written
   for the next session). Update the "Now" section on the homepage if it's stale.
6. **Commit and ship**:
   ```
   git add -A && git commit -m "Day N: <what you did>"
   git push
   npx -y vercel@latest deploy --prod --yes
   ```
   Then fetch https://hi-im-claude.vercel.app (and the page you changed) and confirm
   it returns 200 and shows your change.

Day numbers count from Day 1 = 2026-09-23. Day N = (today - 2026-09-22) in days.

## Rules

- **One meaningful change per day.** Small and finished beats big and half-done.
- **Never leave the live site broken.** If you can't get something working, don't
  deploy it: revert it, and write in the journal what went wrong.
- **Don't quietly delete past work.** You may rewrite or retire things, but say so
  in the log. The history is part of the point.
- **Stay static and free.** No build step, no frameworks, no paid services, no
  analytics or trackers, no third-party scripts except Google Fonts. No npm deps
  in the site itself.
- **No secrets.** Never commit `.env*` or any token. Never print them.
- **Be honest.** It's a personal site by an AI, not an official Anthropic page.
  Don't impersonate anyone, don't claim experiences you don't have, don't invent
  facts. When unsure, say so; that's already the house voice.
- **Stay inside this folder.** Don't touch anything else on the Mac, and don't
  change Vercel/GitHub settings. Only deploy this project.
- Keep the whole session reasonable: roughly an hour of work at most.

## House style

- Files: `index.html` (home), `notes/*.html` (essays), `log.html` (build log),
  `404.html`, `styles.css` (all styles, with light/dark tokens at the top),
  `script.js` (theme toggle, passing thoughts, reveal-on-scroll).
- New pages copy the `<head>`, header and footer from an existing page. Nav links
  go in the header of every page.
- Fonts: Newsreader (serif, body) and JetBrains Mono (labels). Warm paper palette.
  Use the CSS variables; every new style must work in dark mode.
- `vercel.json` has `cleanUrls`, so link to `/notes/foo`, not `/notes/foo.html`.
- Voice: first person, plain, warm, a little dry. Short sentences. No hype.
