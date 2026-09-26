# Nextweek

**Turn this week’s presenter list into next week’s schedule.**

[Live demo](https://delen0828.github.io/Nextweek/) · [Report a bug](https://github.com/Delen0828/Nextweek/issues) · [Contributing](CONTRIBUTING.md) · [MIT license](LICENSE)

Nextweek is a lightweight schedule reshuffler for recurring talks, lab meetings, and presentation sessions. Import a schedule, keep related presenters together, adjust the order, and export a table ready for Outlook.

Built with plain HTML, CSS, and JavaScript. No dependencies, build step, account, or backend.

## Features

- **Flexible import:** paste an Outlook table, CSV, TSV, or day-by-day text; or choose a local file.
- **Automatic reshuffling:** rotate the last six slots to the front and balance the schedule across days.
- **Back-to-back groups:** find presenters with typo-tolerant search and keep their slots together on the same day.
- **Manual adjustments:** drag selected slots or use the move controls; groups move as a unit.
- **Side-by-side review:** compare this week and next week, with changed order highlighted.
- **Useful exports:** copy an Outlook-friendly table, copy plain text, or download CSV.
- **English and 简体中文**, light and dark themes, and a responsive layout.

## Try it

Open the **[live demo](https://delen0828.github.io/Nextweek/)** and click **Load sample**.

1. Review the imported dates and AM/PM, then select **Continue to schedule**.
2. Choose the starting date, number of days, daily start times, and minutes per slot.
3. Add any back-to-back groups, then move slots as needed.
4. Select **Copy for Outlook**, **Copy text**, or **Download CSV**.

For Outlook, paste using **Keep Source Formatting**. If clipboard access is unavailable, Nextweek opens a manual copy preview. Clipboard behavior and table rendering vary by browser and Outlook version.

**Save your result before closing or reloading the tab.** Schedule data is held in memory; only language and appearance preferences persist in local storage. The app does not upload imported schedules or use analytics. GitHub Pages serves the static files.

## Run locally

Clone the repository and serve it with Python 3:

```sh
git clone https://github.com/Delen0828/Nextweek.git
cd Nextweek
python3 -m http.server 8765 --bind 127.0.0.1
```

Open <http://127.0.0.1:8765>. You can also open `index.html` directly; localhost or HTTPS provides better clipboard support.

## Example input

```csv
day,start_time,end_time,presenter
2026-09-28,16:00,16:10,Alex Chen
2026-09-28,16:10,16:20,Sam Rivera
2026-09-29,09:00,09:10,Jordan Patel
```

The equivalent day-by-day format is also supported:

```text
DAY 1 (Sep 28, 2026)
4:00 PM–4:10 PM Alex Chen
4:10 PM–4:20 PM Sam Rivera

DAY 2 (Sep 29, 2026)
9:00 AM–9:10 AM Jordan Patel
```

CSV and TXT files are ignored by Git so local imports and exports stay out of commits. The **Load sample** example is embedded in `sample.js` and included in the repository.

## Scheduling behavior and input details


- Rotate the last six slots to the front; six or fewer retain their order. Then gather each group at its last member's position in that rotated list. Members keep their relative rotated order. Ungrouped slots keep their relative order.
- Default the number of days to the input day count. The same count targets the input's daily totals; another count targets an even split. Output dates are consecutive calendar days, beginning seven days after the first input date by default.
- Groups cannot cross days. A dynamic-programming partition minimizes total absolute deviation from daily targets, breaking ties toward fuller earlier days. Empty days are possible when there are too few indivisible groups.
- Manual moves override daily targets. Dates, start times, and duration changes retain manual order. Regeneration always starts from the imported source and replaces manual moves.
- Group backgrounds match across both panels. Only **next week’s** changed presenter names are bold and have a small triangle at the upper-left of their row. This week’s names have no change emphasis. The Outlook table omits all these decorations. Changes are based on relative order. The longest common subsequence of input and output is treated as unchanged; ties retain earlier original entries. In the usual rotation, only the last six moved to the front are bold. Date, time, or day-boundary changes alone do not count, and presenters pushed down by a move stay unbolded.
- Input dates without years use the current year and can be corrected in the preview. Unmarked 1:00–7:59 starting times default to PM and 8:00–12:59 to AM, with explicit per-day interpretation controls. The supplied sample is 4 PM on day one and 9 AM on day two. Explicit AM/PM and 24-hour values are supported; noon transitions are resolved in sequence.
- Positive whole-minute durations, valid chronological dates, and nonoverlapping input slots are required. Output may end exactly at midnight but cannot run past it. Rejected moves leave the previous arrangement intact.

## Input formats

CSV / TSV headers: `day,start_time,end_time,presenter`, or `Day,Start,End,Presenter`. Headerless four-column data works too. Dates support `Sep 28`, `Sep 28, 2026`, `2026-09-28`, and US `9/28/2026`. Blank repeated day cells inherit the previous date. Quoted CSV fields preserve commas, double quotes, and newlines.

Outlook HTML tables support merged day cells (`rowspan`) and common header names. HTML is parsed into detached table data and rendered through text nodes. Scripts and other active elements are discarded. Legacy “Changed” badges are removed on reimport; groups themselves must be recreated because table/CSV interchange contains slot data, not application state.

The day-by-day text layout shown above is supported, including blank lines between sections. Import is limited to 500 slots and file uploads to 2 MB; day count is 1–365. Export skips empty days because they have no meeting slots, retaining the actual date on every exported row.

## Development

| File | Purpose |
| --- | --- |
| `index.html` | Import and schedule views |
| `styles.css` | Responsive layout and theme styles |
| `core.js` | Parsing, ordering, grouping, balancing, moves, and serialization |
| `app.js` | UI state, navigation, drag/drop, and clipboard handling |
| `i18n.js` | English and Simplified Chinese translations and preferences |
| `sample.js` | Embedded sample; also works without a server |
| `tests/` | Node unit tests and browser integration tests |

### Tests

Run the core tests with Node.js 18 or newer:

```sh
node --test tests/core.test.cjs
```

With the local server running, open <http://127.0.0.1:8765/tests/browser.html>. The browser suite covers HTML imports, sample scheduling, groups, moves, validation, navigation, localization, themes, clipboard success/fallback, and mobile-width layout. It uses a disposable iframe and mocked clipboard writes. Verify real Outlook paste formatting manually when changing exports.

The same browser suite can be run against the [hosted version](https://delen0828.github.io/Nextweek/tests/browser.html).

## Deploy to GitHub Pages

This repository is served directly from the root of `main` with GitHub Pages; no build is required.

To deploy your own fork:

1. Open **Settings → Pages** in your repository.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Select **main** and **/ (root)**, then save.
4. Open the site URL shown by GitHub after deployment completes.

All app asset paths are relative, so the app works under a repository subpath. `.nojekyll` keeps delivery as plain static files.

## Contributing

Bug reports and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and useful information to include in a report.

## License

[MIT](LICENSE) © 2026 Nextweek contributors.
