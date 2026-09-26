# Contributing to Nextweek

Thanks for helping improve Nextweek!

## Report an issue

Include the browser and operating system, steps to reproduce, expected behavior, and actual behavior. Use a small example with fictional presenter names. Do not include private schedules or other sensitive information.

## Make a change

1. Fork the repository and create a branch for your change.
2. Serve the root with `python3 -m http.server 8765 --bind 127.0.0.1`.
3. Keep changes focused and preserve the dependency-free static app.
4. Run `node --test tests/core.test.cjs` and open `http://127.0.0.1:8765/tests/browser.html`.
5. Check both languages and themes when changing the UI. For clipboard changes, also test pasting into Outlook.
6. Open a pull request explaining the problem, the resulting behavior, and how you tested it.

Add regression coverage for behavioral fixes. Keep matching translations in `i18n.js`, and update the README when user-facing behavior changes. Local CSV and TXT files are intentionally ignored; tests should use committed JavaScript fixtures or inline examples.
