(async () => {
  'use strict';
  const preferencesBefore = Object.fromEntries(['nextweek-language', 'nextweek-theme'].map(key => [key, localStorage.getItem(key)]));
  const S = window.Scheduler, results = document.getElementById('results');
  let passed = 0, failed = 0;
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const equal = (actual, expected) => assert(JSON.stringify(actual) === JSON.stringify(expected), `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  async function test(name, fn) {
    const li = document.createElement('li');
    try { await fn(); passed++; li.className = 'pass'; li.textContent = `PASS · ${name}`; }
    catch (e) { failed++; li.className = 'fail'; li.textContent = `FAIL · ${name}: ${e.message}`; console.error(name, e); }
    results.append(li);
  }
  function decode(raw) { return S.resolveRows(raw, S.importDays(raw, 2026)); }
  const fields = rows => rows.map(({ date, start, end, presenter }) => ({ date, start, end, presenter }));

  await test('Outlook table with merged day cells imports each slot', () => {
    const html = '<table><tr><th>Day</th><th>Start</th><th>End</th><th>Presenter</th></tr><tr><td rowspan="2">Sep 28, 2026</td><td>4:00 PM</td><td>4:10 PM</td><td><p>Alice</p></td></tr><tr><td>4:10 PM</td><td>4:20 PM</td><td>Bob</td></tr></table>';
    const rows = decode(S.parseHTML(html));
    equal(rows.map(r => r.presenter), ['Alice', 'Bob']);
    equal(rows.map(r => r.date), ['2026-09-28', '2026-09-28']);
  });
  await test('Plain HTML export roundtrips without highlighting and strips legacy markers', () => {
    const rows = decode(S.parseText(window.SAMPLE_SCHEDULE));
    const output = S.materialize(rows, S.generate(rows, [], 2), '2026-10-05', [960, 540], 10);
    const html = S.exportHTML(output, []);
    assert(!html.includes('<strong') && !html.includes('font-weight:700'), 'Export must not bold presenters');
    for (const version of [html, html.replace('Gyuwon Kim', 'Gyuwon Kim<span data-scheduler-marker="true"> • Changed</span>'), html.replace('Gyuwon Kim', 'Gyuwon Kim<span> • Changed</span>')]) equal(fields(decode(S.parseHTML(version))), fields(output.flat()));
  });
  await test('Clipboard scripts and markup are inert; names remain literal data', () => {
    const rows = decode(S.parseHTML('<table><tr><td>Sep 28</td><td>9:00 AM</td><td>9:10 AM</td><td>&lt;img src=x onerror=alert(1)&gt;<script>window.__badImport = true</script></td></tr></table>'));
    assert(!window.__badImport, 'Pasted script executed');
    equal(rows[0].presenter, '<img src=x onerror=alert(1)>');
    assert(!S.exportHTML([rows], []).includes('<img'), 'Export failed to escape HTML');
  });

  const frame = document.getElementById('app');
  await new Promise((resolve, reject) => {
    const began = Date.now();
    const ready = () => {
      if (frame.contentDocument.getElementById('use-input') && frame.contentWindow.Scheduler && frame.contentDocument.readyState === 'complete') resolve();
      else if (Date.now() - began > 10000) reject(new Error('Test app did not finish loading'));
      else setTimeout(ready, 20);
    };
    ready();
  });
  const w = frame.contentWindow, d = frame.contentDocument, $ = id => d.getElementById(id);
  const click = id => $(id).click();
  const input = (id, value, type = 'input') => { $(id).value = value; $(id).dispatchEvent(new w.Event(type, { bubbles: true })); };
  const turn = () => new Promise(resolve => setTimeout(resolve, 0));
  const outputIds = () => [...d.querySelectorAll('.output-slot')].map(row => row.dataset.slotId);
  const idsForDay = index => [...d.querySelectorAll('#output-schedule .schedule-day')[index].querySelectorAll('.slot')].map(row => row.dataset.slotId);
  const select = id => d.querySelector(`.output-slot[data-slot-id="${id}"] input`).click();

  input('ui-language', 'en', 'change'); input('ui-theme', 'light', 'change');

  await test('Sample import previews, infers defaults, and generates 26 slots', () => {
    click('load-sample'); assert(!$('import-review').hidden, 'Import preview is hidden');
    equal(d.querySelectorAll('#import-preview tbody tr').length, 26);
    click('use-input'); equal($('day-count').value, '2'); equal($('duration').value, '10');
    equal(idsForDay(0).length, 15); equal(idsForDay(1).length, 11);
    equal(outputIds().slice(0, 6), ['slot-21', 'slot-22', 'slot-23', 'slot-24', 'slot-25', 'slot-26']);
    equal(d.querySelectorAll('#output-schedule strong.slot-name').length, 6);
    equal(d.querySelectorAll('#output-schedule .change-triangle').length, 6);
    equal(d.querySelectorAll('#source-schedule .changed, #source-schedule strong.slot-name, #source-schedule .change-triangle').length, 0);
    assert($('import-page').hidden && !$('workspace').hidden, 'Expected schedule page only');
    assert(!$('copy-table').disabled, 'Export should be enabled');
  });
  await test('Fuzzy search saves groups and regenerates automatically', () => {
    click('add-group'); input('group-search', 'karan');
    const matching = [...d.querySelectorAll('#group-results input')].filter(checkbox => checkbox.getAttribute('aria-label').includes('Karam Kim'));
    equal(matching.length, 2);
    matching.forEach(checkbox => checkbox.click());
    input('group-name', 'Karam team'); $('group-form').requestSubmit();
    assert(!$('copy-table').disabled, 'Group changes should generate valid output automatically');
    equal(idsForDay(0).slice(-2), ['slot-8', 'slot-9']);
  });
  await test('Moving a group expands selection and updates day counts', () => {
    select('slot-8'); equal($('selection-count').textContent, '2 slots selected');
    input('move-day', '1', 'change'); input('move-position', '', 'change'); click('move-selected');
    equal(idsForDay(0).length, 13); equal(idsForDay(1).length, 13);
    equal(idsForDay(1).slice(-2), ['slot-8', 'slot-9']);
  });
  await test('Changing date and duration preserves manual order; regenerate resets from source', () => {
    const before = outputIds(); input('start-date', '2026-11-02', 'change'); input('duration', '12');
    equal(outputIds(), before); equal(idsForDay(0).length, 13);
    input('duration', '10'); click('reset-schedule');
    equal(idsForDay(0).length, 15); equal(idsForDay(0).slice(-2), ['slot-8', 'slot-9']);
  });
  await test('Native drag events move an entire group without splitting it', () => {
    const source = d.querySelector('.output-slot[data-slot-id="slot-8"]');
    const target = d.querySelectorAll('#output-schedule .day-drop')[1];
    const transfer = new w.DataTransfer();
    source.dispatchEvent(new w.DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
    target.dispatchEvent(new w.DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    target.dispatchEvent(new w.DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    equal(idsForDay(1).slice(-2), ['slot-8', 'slot-9']); equal(idsForDay(0).length, 13);
  });
  await test('Multi-selection preserves order when moved before another slot', () => {
    select('slot-21'); select('slot-23'); input('move-day', '1', 'change'); input('move-position', 'slot-10', 'change'); click('move-selected');
    equal(idsForDay(1).slice(0, 3), ['slot-21', 'slot-23', 'slot-10']);
  });
  await test('Invalid settings disable export; correction restores the same arrangement', () => {
    const before = outputIds(); input('duration', '0');
    assert(!$('schedule-error').hidden, 'Expected validation error'); assert($('copy-table').disabled, 'Invalid output is exportable');
    input('duration', '10'); equal(outputIds(), before);
  });
  await test('A move extending past midnight is rejected atomically', () => {
    click('reset-schedule');
    const time = d.querySelector('#daily-starts input'); time.value = '21:30'; time.dispatchEvent(new w.Event('change', { bubbles: true }));
    const before = outputIds(); select('slot-10'); select('slot-11');
    input('move-day', '0', 'change'); input('move-position', '', 'change'); click('move-selected');
    equal(outputIds(), before); assert($('schedule-error').textContent.includes('past midnight'), 'Missing overflow warning');
    time.value = '16:00'; time.dispatchEvent(new w.Event('change', { bubbles: true })); click('clear-selection');
  });
  await test('Changing X balances three days and keeps the group on one day', () => {
    input('day-count', '3'); assert(!$('copy-table').disabled, 'Changed day count should update automatically');
    equal([...d.querySelectorAll('#output-schedule .schedule-day')].map(day => day.querySelectorAll('.slot').length), [9, 9, 8]);
    assert([0, 1, 2].some(i => idsForDay(i).includes('slot-8') && idsForDay(i).includes('slot-9')), 'Group crossed days');
  });
  await test('Back and forward navigation preserves settings, groups, and manual moves', async () => {
    select('slot-21'); input('move-day', '1', 'change'); input('move-position', '', 'change'); click('move-selected');
    const before = outputIds(), counts = [0, 1, 2].map(i => idsForDay(i).length);
    click('back-input'); await turn();
    assert(!$('import-page').hidden && $('workspace').hidden, 'Back did not show only input');
    click('use-input'); await turn();
    equal(outputIds(), before); equal([0, 1, 2].map(i => idsForDay(i).length), counts);
    equal($('day-count').value, '3'); equal(d.querySelectorAll('.group-chip').length, 1);
  });
  await test('Chinese language and dark theme preserve schedule and selection', () => {
    const before = outputIds(); select('slot-22');
    input('ui-language', 'zh-CN', 'change'); input('ui-theme', 'dark', 'change');
    equal(d.documentElement.lang, 'zh-CN'); equal(d.documentElement.dataset.theme, 'dark');
    equal($('setup-heading').textContent, '排期与导出'); equal($('copy-table').textContent.trim(), '复制到 Outlook ↗');
    assert($('selection-count').textContent.includes('已选'), 'Selection status was not translated');
    assert($('output-schedule').textContent.includes('Gyuwon Kim'), 'Presenter names changed');
    equal(outputIds(), before); assert(d.querySelector('.output-slot.selected'), 'Selection was cleared');
    input('duration', '0'); assert($('schedule-error').textContent.includes('正整数'), 'Validation was not translated');
    input('duration', '10'); equal(outputIds(), before);
    equal(localStorage.getItem('nextweek-language'), 'zh-CN'); equal(localStorage.getItem('nextweek-theme'), 'dark');
    input('ui-language', 'en', 'change'); input('ui-theme', 'light', 'change'); click('clear-selection');
    equal($('setup-heading').textContent, 'Schedule & export');
  });
  let written;
  await test('Copy writes HTML and plain text; exported HTML reimports without markers', async () => {
    Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { write: async items => { written = items; }, writeText: async text => { written = text; } } });
    click('copy-table'); await turn();
    assert(Array.isArray(written), 'Rich clipboard was not called');
    const html = await (await written[0].getType('text/html')).text();
    const plain = await (await written[0].getType('text/plain')).text();
    equal(S.parseHTML(html).length, 26);
    assert(!html.includes('<strong') && !html.includes('font-weight:700') && !html.includes(S.COLORS[0]), 'Export contains UI highlighting');
    assert(!S.parseHTML(html).some(row => row.presenter.includes('• Changed')), 'Markers leaked into names');
    equal(S.parseText(plain).length, 26);
  });
  await test('Clipboard denial exposes a selected table with keyboard copy fallback', async () => {
    Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { write: async () => { throw new Error('Denied'); } } });
    click('copy-table'); await turn();
    assert($('copy-dialog').open, 'Copy dialog was not opened');
    assert(w.getSelection().toString().includes('Presenter'), 'Table was not selected');
    const data = new w.DataTransfer(); d.dispatchEvent(new w.ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData: data }));
    assert(data.getData('text/html').includes('<table'), 'Fallback failed to set HTML');
    assert(data.getData('text/plain').includes('Presenter'), 'Fallback failed to set plain text'); click('close-copy');
  });
  await test('Rich paste receives Outlook HTML and previews rows without executing markup', () => {
    const data = new w.DataTransfer();
    data.setData('text/html', '<table><tr><th>Day</th><th>Start</th><th>End</th><th>Presenter</th></tr><tr><td rowspan="2">Sep 28</td><td>9:00 AM</td><td>9:10 AM</td><td>Alice</td></tr><tr><td>9:10 AM</td><td>9:20 AM</td><td>Bob</td></tr></table>');
    data.setData('text/plain', 'Outlook table');
    $('paste-input').dispatchEvent(new w.ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
    equal(d.querySelectorAll('#import-preview tbody tr').length, 2);
    assert(!$('use-input').disabled, 'HTML preview failed');
  });
  await test('Narrow layout stacks panels and has no horizontal page overflow', async () => {
    frame.style.width = '390px'; await new Promise(resolve => w.requestAnimationFrame(() => w.requestAnimationFrame(resolve)));
    const panels = [...d.querySelectorAll('.schedule-panel')].map(el => el.getBoundingClientRect());
    assert(panels[1].top > panels[0].bottom, 'Panels did not stack');
    assert(d.documentElement.scrollWidth <= w.innerWidth + 1, `Page overflows: ${d.documentElement.scrollWidth} > ${w.innerWidth}`);
  });
  await test('Input page stacks and stays readable on narrow screens', async () => {
    click('back-input'); await turn();
    const panes = [...d.querySelectorAll('.import-layout>.setup-card')].map(el => el.getBoundingClientRect());
    assert(panes[1].top > panes[0].bottom, 'Input and preview did not stack');
    assert(d.documentElement.scrollWidth <= w.innerWidth + 1, 'Input page overflows');
    assert(parseFloat(w.getComputedStyle($('paste-input')).fontSize) >= 15, 'Input text is too small');
  });
  await test('Typing new input refreshes the preview automatically and prevents stale submission', async () => {
    input('paste-input', 'day,start_time,end_time,presenter\nSep 28,9:00 AM,9:10 AM,王小明');
    assert($('use-input').disabled, 'Continue should wait for the fresh preview');
    await new Promise(resolve => setTimeout(resolve, 300));
    equal(d.querySelectorAll('#import-preview tbody tr').length, 1);
    assert($('import-preview').textContent.includes('王小明'), 'New input was not previewed');
    assert(!$('use-input').disabled, 'Valid input should enable Continue');
    click('use-input'); equal(outputIds().length, 1);
    equal(d.querySelectorAll('.group-chip').length, 0);
  });
  await test('Language and theme preferences survive a reload', async () => {
    input('ui-language', 'zh-CN', 'change'); input('ui-theme', 'dark', 'change');
    await new Promise(resolve => { frame.addEventListener('load', resolve, { once: true }); frame.contentWindow.location.reload(); });
    equal(frame.contentDocument.documentElement.lang, 'zh-CN');
    equal(frame.contentDocument.documentElement.dataset.theme, 'dark');
    equal(frame.contentDocument.getElementById('ui-language').value, 'zh-CN');
    equal(frame.contentDocument.getElementById('ui-theme').value, 'dark');
  });
  for (const [key, value] of Object.entries(preferencesBefore)) { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); }
  document.getElementById('summary').textContent = `${passed} passed · ${failed} failed`;
  document.title = `Scheduler browser tests: ${passed} passed, ${failed} failed`;
})();
