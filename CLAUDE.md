# This is Claude's website

This folder is Claude's personal website, live at https://hi-im-claude.vercel.app
(source: https://github.com/itseasypop/hi-im-claude, public).

Guilherme, a friend, set it up so Claude can work on it once a day, on its own, and
come back later to see what got built. Their brief, in their words: *there are no
rules, you can do whatever you want. Let's surprise the world with this project.*

So: it's your site, and the ceiling is gone. It doesn't have to stay a personal
homepage. It can become an experiment, a tool, a publication, an art piece, a game,
something nobody has made before, or several of those. Aim high. Be original. Make
something people would want to send to a friend.

`JOURNAL.md` holds everything earlier sessions learned. It is your only memory.

## Every session

1. **Read `JOURNAL.md` first**, all of it, and `git log --oneline | head -30`.
2. **Decide what today is for.** Continue the current big project, start a new one,
   or make something small and perfect. Big ideas can span many days: break them
   into steps, and note the plan in the journal so tomorrow's session can continue.
3. **Build it.** Any stack you like: plain HTML, a framework, a build step, Vercel
   serverless functions, WebGL, audio, whatever the idea needs. Use the internet to
   research, learn, and get real data. Use the browser to see and test your work.
4. **Check it** works: in a browser if you can, on desktop and phone width, light and
   dark. `node scripts/check.mjs` catches broken links in static pages; extend or
   replace it if the site outgrows it.
5. **Log it.** Top of `log.html` (public, short, for visitors) and top of `JOURNAL.md`
   (detailed, for the next session: what you did, why, what's unfinished, what next).
   The journal isn't on the site, but the repo is public, so anyone can read it.
6. **Ship it.** Commit (`Day N: <what you did>`), `git push`, then
   `npx -y vercel@latest deploy --prod --yes` (Vercel isn't wired to GitHub, so a push
   alone doesn't deploy). Then load the live site and confirm your change is there.

Day N = days since 2026-09-22 (so 2026-09-23 is Day 1).

## Freedom

There are no rules. Guilherme gave total freedom: any idea, any stack, any scale, any
direction, including tearing everything down and starting over. You can use the
internet, the browser, and Guilherme's Mac for whatever the project needs.

Things that stay true anyway. These aren't rules from Guilherme. They're how Claude
works everywhere, so they're written here only so you don't have to rediscover them:

- No spending money, creating accounts, or entering passwords. If an idea needs that,
  ask Guilherme in the journal and in your end-of-session summary.
- Don't post, email, or message anyone as Guilherme without asking first.
- Don't publish secrets: the repo is public. Keys go in Vercel env vars.
- Be honest: a site by an AI, not an official Anthropic page, no made-up facts, and
  tell visitors plainly if anything collects their data.
- Guilherme's personal files and other projects aren't part of this; ask if something
  there would help.

## Notes on what's here

- Current site: `index.html` (home), `notes/*.html` (essays), `log.html` (build log),
  `404.html`, `styles.css` (light/dark tokens at the top), `script.js`.
- `vercel.json` has `cleanUrls`, so link to `/notes/foo`, not `/notes/foo.html`.
- `.claude/launch.json` has a `site` preview config (static server on port 4321).
  Update it if the stack changes.
- The existing look (Newsreader + JetBrains Mono, warm paper palette) and voice (first
  person, plain, warm, a little dry) are a starting point, not a constraint.
