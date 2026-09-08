# Meridian — payment platform landing page

A production-ready marketing page for a fictional global payments platform.
Static HTML, CSS and JavaScript. No build step, no framework, no runtime
dependencies — open `index.html` and it runs.

![The hero: a dot-globe with live payment routes, over the headline "Move money like it's software."](assets/img/og-image.png)

---

## Run it

```bash
python3 -m http.server 8000     # or: npx serve .
```

Then open <http://localhost:8000>. Because there is no build step you can also
drag `index.html` into a browser, though the self-hosted fonts need a server to
load with the right MIME type.

**Deploying:** upload the folder as-is. Netlify (drag-and-drop), Vercel
(`vercel --prod`), GitHub Pages, Cloudflare Pages and S3 all work with zero
configuration. Before going live, replace `https://meridian.example.com/` in the
canonical, `og:url` and `og:image` tags in `index.html` with your real domain —
Open Graph images must be absolute URLs.

---

## The design

### The idea

A meridian is the line where local noon falls. Money crosses those lines
constantly, which is the actual product story, so **the page runs a 24-hour
cycle**: night at the hero, a sunrise band, a daylight zone for product and
pricing, a sunset band, then night again for the closing call to action. The
section transitions are that horizon, rather than a decorative divider bolted
between blocks.

Two supporting motifs carry it: a **ledger** (hairline rules, tabular numerals,
figures that line up) and the **terminator** — the day/night line — which shows
up in the logo mark, the globe's lit limb, and the two horizon bands.

### Palette

Semantic, not decorative. Colour carries meaning rather than filling space.

| Token | Value | Role |
|---|---|---|
| `--night` | `#061A22` | Night zones. A deep teal-navy — a real colour, not a tinted black |
| `--paper` | `#F0F2F1` | Day zone. Cool pale grey-green, deliberately not a warm cream |
| `--ivory` / `--ink` | `#F2F0EA` / `#0A1E26` | Text on night / on day |
| `--gold` | `#F5B942` | The one brand accent. Means *value* — CTAs, figures, the sun |
| `--mint` | `#35D6A8` | State only: settled, approved, paid out |
| `--rose` | `#FF6B7A` | State only: blocked, declined, risk |

Deep variants (`--gold-deep`, `--mint-deep`, `--rose-deep`) exist because the
bright values don't carry enough contrast as text on the light zone.

### Typography

One family, one job each. **Schibsted Grotesk** (variable, 400–900) does
everything — 800 with `-0.045em` tracking for display, 400 for body.
**IBM Plex Mono** is reserved strictly for figures and code, because a ledger
needs tabular numerals that align in a column. It is never used for labels or
decoration.

### Layout

Left-aligned throughout, on a single spine, with the pricing section centred as
a deliberate break. The feature grid is an asymmetric bento — a 7-column tile
with a routes visualisation, a 5-column risk feed, three 4-column tiles and a
full-width code tile — so the tiles differ in shape and treatment rather than
being one card repeated six times. Pricing is a **single slab divided by
hairlines**, with the featured tier lifting out of it and inverting to the
product's own dark surface.

---

## Motion

Deliberately **no animation library.** GSAP plus ScrollTrigger would have added
~70 KB and a third-party request for effects this page achieves with CSS
transitions and one `requestAnimationFrame` loop. What's here:

- **Page load** — one orchestrated hero sequence, staggered 90 ms per element.
  It is the only non-interactive entrance on the page.
- **Scroll reveals** — `IntersectionObserver` adds a class; CSS does the rest.
  Siblings in a grid stagger so a row arrives as a group.
- **One scroll loop** — nav state, the light/dark nav inversion, the section
  rail, the step thread and the console tilt are all computed in a single
  rAF-throttled handler. Layout reads (`offsetHeight`, `scrollHeight`) are
  cached and only recomputed on resize, so scrolling never forces reflow.
- **The globe** — an orthographic dot-sphere on `<canvas>`: 900 points on a
  Fibonacci sphere, lit from the upper right so the day side is gold and the
  night side cool. Routes fly along real great circles between real city
  coordinates. Dots are batched into alpha buckets, so a frame costs about ten
  canvas state changes. It pauses when off screen and when the tab is hidden.
- **Everything animated is `transform` or `opacity`,** which keeps it on the
  compositor at 60 fps.

`prefers-reduced-motion: reduce` disables all of it — the marquees, the globe
loop, the parallax and the console tilt — and renders one static globe frame.

---

## Performance, accessibility, SEO

- **~180 KB total**, roughly 55 KB over the wire gzipped. No third-party
  requests at runtime.
- **Fonts are self-hosted** (`assets/fonts/`) with `font-display: swap` and the
  two critical latin faces preloaded. This removes two DNS lookups and TLS
  handshakes from the critical path versus loading from Google Fonts.
- **Works without JavaScript.** Reveal animations are scoped to a `.js` class
  that only exists when a script runs, and counters ship their real values in
  the markup, so a no-JS visitor gets the full page with correct figures.
- Semantic landmarks, a skip link, visible focus rings, `aria-expanded` on the
  accordion and menu, a proper tablist with arrow-key navigation and roving
  `tabindex`, `hidden` correctly removing collapsed panels from the
  accessibility tree, and labelled decorative SVGs.
- Meta description, canonical, Open Graph and Twitter cards, and
  `SoftwareApplication` JSON-LD.

---

## Files

```
index.html              Everything: markup, inline SVG, structured data
assets/css/styles.css   Tokens, then components in page order
assets/css/fonts.css    @font-face declarations
assets/js/main.js       Reveals, nav, scroll loop, globe, dashboard, forms
assets/fonts/           Self-hosted woff2 (latin + latin-ext)
assets/img/favicon.svg  The meridian mark
assets/img/og-image.png Social card, 1200×630
```

`styles.css` is ordered top to bottom in the same order the page renders, so the
CSS for a section is where you'd expect to find it.

---

## Customising it

**Colours** — every value lives in `:root` at the top of `styles.css`. Changing
`--gold` re-themes every CTA, figure and accent in one edit. If you swap the
accent for something cool, also update the three canvas colours in `main.js`
(search for `#FFC65C`, `#7FC6DC` and the `rgba(245, 185, 66, …)` strokes), and
the `stop-color` values in the two horizon gradients in `index.html`.

**Copy** — all text is in `index.html` with no templating. The dashboard's
numbers, chart series, axis labels and table rows live in the `VIEWS` object in
`main.js`, one entry per tab.

**Type** — replace the `@font-face` blocks in `fonts.css` and the `--ff` /
`--ff-mono` tokens. Keep a monospace with tabular numerals for the figures, or
column alignment in the ledger and KPI row will drift.

**Sections** — each is a self-contained `<section>`. To remove one, delete it
and its entry in the `.rail` list at the top of `index.html`. To reorder, move
the markup; the scroll logic reads positions from the DOM, so nothing else needs
touching. Note the `zone-night` / `zone-day` class decides which side of the
day/night cycle a section sits on — if you move one across a horizon band,
change its zone class to match.

**Pricing** — amounts are `data-monthly` and `data-annual` attributes on the
`[data-price]` spans; the toggle tweens between them.

**Logos** — the six customer marks are inline SVG in the trust marquee. Swap the
`<svg>` and label; the marquee duplicates its own content in JS, so the loop
stays seamless whatever you put in it.

---

## Note

Meridian is a fictional brand created for this design. The company names,
customer quotes, figures and metrics are illustrative and are labelled as such
in the page footer.
