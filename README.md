# Nextweek

**Turn last week’s presenter list into this week’s schedule.**

[Live demo](https://delen0828.github.io/Nextweek/) · [Report a bug](https://github.com/Delen0828/Nextweek/issues) · [Contributing](CONTRIBUTING.md) · [MIT license](LICENSE)

Nextweek is a lightweight schedule reshuffler for recurring talks, lab meetings, and presentation sessions. Import a schedule, keep related presenters together, adjust the order, and export a table ready for Outlook.

Built with plain HTML, CSS, and JavaScript. No dependencies, build step, account, or backend.

## Features

- **Flexible import:** paste plain text, a participant list, CSV, TSV, or day-by-day text; or choose a local file. Clipboard text takes priority over HTML formatting.
- **Automatic reshuffling:** rotate the last six slots to the front and balance the schedule across days.
- **Back-to-back groups:** select presenters in this week’s schedule and add a group to keep their slots together on the same day. The popup edits the name and previews members.
- **Manual adjustments:** drag selected slots or use the move controls; groups move as a unit.
- **Three-step workflow:** choose days and times, paste last week, then generate and fine-tune this week.
- **Participant-only import:** use last week’s participant order, ignoring its dates and times; a plain list of names works too.
- **Flexible meeting dates:** choose consecutive or nonconsecutive days.
- **Side-by-side review:** compare last week and this week, with changed order highlighted.
- **Useful exports:** copy plain text with the primary action, or choose an Outlook-friendly table or CSV.
- **Time format:** 24-hour time by default; switch to 12-hour AM/PM in the header. Editing, schedule previews, and all exports use your choice.
- **English and 简体中文**, light, dark, pastel pink, and light blue themes, and a responsive layout.

## Try it

Open the **[live demo](https://delen0828.github.io/Nextweek/)**.

1. Choose this week’s meeting days, then daily start times and minutes per slot. Select **Continue to last week**.
2. Paste last week’s schedule or participant names, choose a file, or click **Load sample**. Review the extracted participant order. Select **Generate this week** to process the shift.
3. Fine-tune this week’s schedule with groups or manual moves. To group presenters, select their slots in **This week**, then click **Add group**; the group is created immediately, and the popup lets you rename it and review its members. Use **Edit days & times** to return to setup, then select **This week** to resume. Use **Copy text** for plain-text pasting, or choose **Copy for Outlook** or **Download CSV**.

For Outlook, paste using **Keep Source Formatting**. If clipboard access is unavailable, Nextweek opens a manual copy preview. Clipboard behavior and table rendering vary by browser and Outlook version.

**Save your result before closing or reloading the tab.** Schedule data is held in memory; only language, appearance, and time-format preferences persist in local storage. The app does not upload imported schedules or use analytics. GitHub Pages serves the static files.

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
- Start with day selection, followed by times, before importing last week’s participant order. Import never changes this week’s dates, times, slot length, or day count. No previous schedule is stored across reloads.
- Distribute slots evenly across the selected days, allowing groups and manual moves to take priority. Output uses your selected meeting dates, which must be distinct and in chronological order. Added days initially follow the last selected day.
- Groups cannot cross days. A dynamic-programming partition minimizes total absolute deviation from daily targets, breaking ties toward fuller earlier days. Empty days are possible when there are too few indivisible groups.
- Manual moves override daily targets. Dates, start times, and duration changes retain manual order. Regeneration always starts from the imported source and replaces manual moves.
- Adding a group gathers the selected slots at the first selected slot’s position on that day, preserving their current relative order and all other slots’ order. Selecting existing groups includes their whole membership; combining them with other selected slots creates one group. Closing the name popup keeps the created group. Renaming or deleting a group preserves the current arrangement.
- Group backgrounds match across both panels. Only **this week’s** changed presenter names are bold and have a small triangle at the upper-left of their row. Last week’s names have no change emphasis. The Outlook table omits all these decorations. Changes are based on relative order. The longest common subsequence of input and output is treated as unchanged; ties retain earlier original entries. In the usual rotation, only the last six moved to the front are bold. Date, time, or day-boundary changes alone do not count, and presenters pushed down by a move stay unbolded.
- Last week’s dates and times are ignored. Missing, invalid, overlapping, or out-of-order old dates and times do not block participant extraction. Check the participant preview to confirm the extracted names and order.
- This week’s selected dates, start times, and positive whole-minute durations must be valid. Output may end exactly at midnight but cannot run past it. Rejected moves leave the previous arrangement intact.

## Input formats

Paste participant names one per line, optionally numbered or bulleted. CSV / TSV tables can use a `Presenter`, `Participant`, `Speaker`, or `Name` column; headerless four-column schedules use the fourth column. One-column name tables and day-by-day text also work. Dates and times are ignored. Quoted CSV fields preserve commas, double quotes, and newlines; malformed CSV uses a best-effort row extraction.

Clipboard pastes use plain text when available, even when an Outlook HTML table is also on the clipboard. If only an HTML table is provided, the app can still extract its participant order. HTML tables support merged day cells (`rowspan`) and common header names. HTML is parsed into detached table data and rendered through text nodes. Scripts and other active elements are discarded. Legacy “Changed” badges are removed on reimport; groups themselves must be recreated because table/CSV interchange contains slot data, not application state.

The day-by-day text layout shown above is supported, including blank lines between sections. Import is limited to 500 slots and file uploads to 2 MB; day count is 1–365. Export skips empty days because they have no meeting slots, retaining the actual date on every exported row.

## Development

| File | Purpose |
| --- | --- |
| `index.html` | Days and times, import, and fine-tuning views |
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

With the local server running, open <http://127.0.0.1:8765/tests/browser.html>. The browser suite covers the three-step flow, participant-only imports, preserved settings, nonconsecutive dates, HTML imports, sample scheduling, groups, moves, validation, navigation, localization, themes, clipboard success/fallback, and mobile-width layout. It uses a disposable iframe and mocked clipboard writes. Verify real Outlook paste formatting manually when changing exports.

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
