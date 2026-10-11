(async () => {
  'use strict';
  const preferencesBefore = Object.fromEntries(['nextweek-language', 'nextweek-theme', 'nextweek-time-format'].map(key => [key, localStorage.getItem(key)]));
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
  await test('Participant HTML ignores date/time syntax and preserves merged-table order', () => {
    const html = '<table><tr><th>Day</th><th>Start</th><th>End</th><th>Participant</th></tr><tr><td rowspan="2">bad date</td><td>bad start</td><td></td><td>Alice<script>window.__badParticipants = true</script></td></tr><tr><td>25:90</td><td>earlier</td><td>Bob</td></tr></table>';
    equal(S.parseParticipantHTML(html), ['Alice', 'Bob']);
    assert(!window.__badParticipants, 'Imported script executed');
    equal(S.parseParticipantHTML('<table><tr><th>Name</th></tr><tr><td>Alice</td></tr><tr><td>Bob</td></tr></table>'), ['Alice', 'Bob']);
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

  input('ui-language', 'en', 'change'); input('ui-theme', 'light', 'change'); input('ui-time-format', '24', 'change');

  await test('The flow starts with days and times, then moves to last week', () => {
    assert(!$('setup-page').hidden && $('import-page').hidden && $('workspace').hidden, 'Expected setup as the first step');
    equal($('nav-setup').getAttribute('aria-current'), 'step');
    assert($('nav-schedule').disabled, 'Fine-tuning must wait for an import');
    click('continue-import');
    assert($('setup-page').hidden && !$('import-page').hidden && $('workspace').hidden, 'Expected import as the second step');
    equal($('nav-import').getAttribute('aria-current'), 'step');
  });
  const setupDefaults = {
    date: $('start-date').value,
    dates: [...d.querySelectorAll('#meeting-dates input')].map(el => el.value),
    starts: [...d.querySelectorAll('#daily-starts input')].map(el => el.value),
    duration: $('duration').value,
    count: $('day-count').value
  };
  await test('Import extracts order despite invalid old dates and times and leaves setup alone', async () => {
    input('paste-input', 'day,start_time,end_time,presenter\nnot a date,bad time,also bad,Alice\nSept 99,25:90,earlier,Bob');
    await new Promise(resolve => setTimeout(resolve, 300));
    equal([...d.querySelectorAll('#import-preview tbody tr')].map(row => row.lastElementChild.textContent), ['Alice', 'Bob']);
    equal($('start-date').value, setupDefaults.date);
    equal([...d.querySelectorAll('#meeting-dates input')].map(el => el.value), setupDefaults.dates);
    equal([...d.querySelectorAll('#daily-starts input')].map(el => el.value), setupDefaults.starts);
    equal($('duration').value, setupDefaults.duration); equal($('day-count').value, setupDefaults.count);
    assert($('import-error').hidden && !$('use-input').disabled, 'Old date/time syntax blocked a valid participant order');
    assert($('workspace').hidden, 'Pasting generated output before the Generate action');
  });
  await test('Sample import previews participant order and generates 26 slots', () => {
    click('load-sample');
    equal(d.querySelectorAll('#import-preview tbody tr').length, 26);
    click('use-input'); equal($('day-count').value, '2'); equal($('duration').value, '10');
    equal($('start-date').value, setupDefaults.date);
    equal([...d.querySelectorAll('#daily-starts input')].map(el => el.value), setupDefaults.starts);
    equal(idsForDay(0).length, 13); equal(idsForDay(1).length, 13);
    equal(outputIds().slice(0, 6), ['slot-21', 'slot-22', 'slot-23', 'slot-24', 'slot-25', 'slot-26']);
    equal(d.querySelectorAll('#output-schedule strong.slot-name').length, 6);
    equal(d.querySelectorAll('#output-schedule .change-triangle').length, 6);
    equal(d.querySelectorAll('#source-schedule .changed, #source-schedule strong.slot-name, #source-schedule .change-triangle').length, 0);
    assert($('setup-page').hidden && $('import-page').hidden && !$('workspace').hidden, 'Expected fine-tuning page only');
    equal($('source-heading').textContent, 'Last week');
    equal($('output-heading').textContent.trim(), 'This week ↗');
    assert(!$('copy-table').disabled, 'Export should be enabled');
  });
  await test('Add group immediately groups schedule selections and opens a name-only editor', () => {
    assert($('add-group').disabled, 'Add group should wait for at least two selections');
    select('slot-8'); assert($('add-group').disabled, 'One slot can create a group');
    select('slot-9'); assert(!$('add-group').disabled, 'Two selected slots cannot be grouped');
    click('add-group');
    equal(d.querySelectorAll('.group-chip').length, 1);
    assert($('group-dialog').open, 'Group name editor did not open');
    equal([...d.querySelectorAll('#group-preview li')].map(el => el.firstChild.textContent), ['Dr. Karam Kim', 'Jaeho Lee / Dr. Karam Kim']);
    equal(d.querySelectorAll('#group-dialog input').length, 1);
    equal(d.querySelectorAll('#group-dialog input[type="checkbox"]').length, 0);
    click('close-group'); equal(d.querySelectorAll('.group-chip').length, 1);
    d.querySelector('.group-chip').click();
    input('group-name', 'Karam team'); $('group-form').requestSubmit();
    assert(!$('copy-table').disabled, 'Group changes should generate valid output automatically');
    equal(idsForDay(1).slice(0, 2), ['slot-8', 'slot-9']);
  });
  await test('Moving a group expands selection and updates day counts', () => {
    select('slot-8'); equal($('selection-count').textContent, '2 slots selected');
    input('move-day', '0', 'change'); input('move-position', '', 'change'); click('move-selected');
    equal(idsForDay(0).length, 15); equal(idsForDay(1).length, 11);
    equal(idsForDay(0).slice(-2), ['slot-8', 'slot-9']);
  });
  await test('Renaming a group preserves manual moves and day counts', () => {
    const before = outputIds(); d.querySelector('.group-chip').click();
    input('group-name', 'Renamed team'); $('group-form').requestSubmit();
    equal(outputIds(), before); equal(idsForDay(0).length, 15); equal(idsForDay(1).length, 11);
    assert(d.querySelector('.group-chip').textContent.includes('Renamed team'), 'Group name was not updated');
  });
  await test('Changing date and duration preserves manual order; regenerate resets from source', () => {
    click('edit-settings'); assert(!$('setup-page').hidden, 'Editing did not return to step one');
    const before = outputIds(); input('start-date', '2026-11-02', 'change'); input('duration', '12');
    equal(outputIds(), before); equal(idsForDay(0).length, 15);
    input('duration', '10'); click('nav-schedule'); click('reset-schedule');
    equal(idsForDay(0).length, 13); equal(idsForDay(1).slice(0, 2), ['slot-8', 'slot-9']);
  });
  await test('Native drag events move an entire group without splitting it', () => {
    const source = d.querySelector('.output-slot[data-slot-id="slot-8"]');
    const target = d.querySelectorAll('#output-schedule .day-drop')[0];
    const transfer = new w.DataTransfer();
    source.dispatchEvent(new w.DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
    target.dispatchEvent(new w.DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    target.dispatchEvent(new w.DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    equal(idsForDay(0).slice(-2), ['slot-8', 'slot-9']); equal(idsForDay(0).length, 15);
  });
  await test('Multi-selection preserves order when moved before another slot', () => {
    select('slot-21'); select('slot-23'); input('move-day', '1', 'change'); input('move-position', 'slot-10', 'change'); click('move-selected');
    equal(idsForDay(1).slice(0, 3), ['slot-21', 'slot-23', 'slot-10']);
  });
  await test('Invalid settings disable export; correction restores the same arrangement', () => {
    click('edit-settings');
    const before = outputIds(); input('duration', '0');
    click('continue-import'); assert(!$('setup-page').hidden && !$('setup-error').hidden, 'Invalid time settings advanced to import');
    assert(!$('schedule-error').hidden, 'Expected validation error'); assert($('copy-table').disabled, 'Invalid output is exportable');
    input('duration', '10'); equal(outputIds(), before); click('nav-schedule');
  });
  await test('Generation errors remain visible when resuming from setup', () => {
    const before = outputIds(); click('edit-settings');
    const time = d.querySelector('#daily-starts input'); time.value = '23:55'; time.dispatchEvent(new w.Event('change', { bubbles: true }));
    click('nav-schedule');
    assert(!$('import-page').hidden && !$('import-error').hidden, 'Generation failure was hidden on another page');
    assert($('import-error').textContent.includes('past midnight'), 'Missing generation error');
    click('edit-import-settings'); time.value = '09:00'; time.dispatchEvent(new w.Event('change', { bubbles: true }));
    click('nav-schedule'); equal(outputIds(), before);
    assert($('import-error').hidden && !$('workspace').hidden, 'Correction did not resume fine-tuning');
  });
  await test('A move extending past midnight is rejected atomically', () => {
    click('reset-schedule');
    const time = d.querySelector('#daily-starts input'); time.value = '21:40'; time.dispatchEvent(new w.Event('change', { bubbles: true }));
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
    equal($('workspace-heading').textContent, '微调本周日程'); equal($('copy-table').textContent.trim(), '复制到 Outlook ↗');
    equal($('source-heading').textContent, '上周'); equal($('output-heading').textContent.trim(), '本周 ↗');
    assert($('selection-count').textContent.includes('已选'), 'Selection status was not translated');
    assert($('output-schedule').textContent.includes('Gyuwon Kim'), 'Presenter names changed');
    equal(outputIds(), before); assert(d.querySelector('.output-slot.selected'), 'Selection was cleared');
    input('duration', '0'); assert($('schedule-error').textContent.includes('正整数'), 'Validation was not translated');
    input('duration', '10'); equal(outputIds(), before);
    equal(localStorage.getItem('nextweek-language'), 'zh-CN'); equal(localStorage.getItem('nextweek-theme'), 'dark');
    input('ui-language', 'en', 'change'); input('ui-theme', 'light', 'change'); click('clear-selection');
    equal($('workspace-heading').textContent, 'Fine-tune this week’s schedule');
  });
  await test('Switching clocks updates editors, summaries, rows, and group previews without changing the schedule', () => {
    const before = outputIds(), counts = [0, 1, 2].map(i => idsForDay(i).length); select('slot-22');
    input('ui-time-format', '12', 'change');
    equal(d.querySelector('#daily-starts input').value, '4:00 PM');
    assert(d.querySelector('#output-schedule .slot-time').textContent.startsWith('4:00 PM'), 'Rows still use 24-hour time');
    assert($('workspace-settings-summary').textContent.includes('4:00 PM'), 'Summary did not change clock format');
    equal(outputIds(), before); equal([0, 1, 2].map(i => idsForDay(i).length), counts);
    assert(d.querySelector('.output-slot.selected'), 'Clock change cleared selection');
    d.querySelector('.group-chip').click();
    assert(/[AP]M/.test($('group-preview').textContent), 'Group preview did not use 12-hour time');
    input('ui-time-format', '24', 'change');
    assert(!/[AP]M/.test($('group-preview').textContent), 'Group preview did not use 24-hour time');
    click('close-group');
    equal(d.querySelector('#daily-starts input').value, '16:00');
    assert(d.querySelector('#output-schedule .slot-time').textContent.startsWith('16:00'), 'Rows did not return to 24-hour time');
    equal(outputIds(), before); equal(d.querySelectorAll('.group-chip').length, 1); click('clear-selection');
  });
  await test('12-hour editing preserves afternoon times and switching clocks keeps invalid input invalid', () => {
    const before = outputIds(); click('edit-settings'); input('ui-time-format', '12', 'change');
    let time = d.querySelector('#daily-starts input'); time.value = '5:30 PM'; time.dispatchEvent(new w.Event('change', { bubbles: true }));
    input('ui-time-format', '24', 'change'); equal(d.querySelector('#daily-starts input').value, '17:30'); equal(outputIds(), before);
    input('ui-time-format', '12', 'change'); time = d.querySelector('#daily-starts input');
    time.value = '5:30'; time.dispatchEvent(new w.Event('change', { bubbles: true }));
    assert(!$('setup-error').hidden && $('copy-text').disabled, '12-hour time without AM/PM was accepted');
    input('ui-time-format', '24', 'change');
    equal(d.querySelector('#daily-starts input').value, ''); assert($('copy-text').disabled, 'Switching clocks bypassed invalid time validation');
    time = d.querySelector('#daily-starts input'); time.value = '16:00'; time.dispatchEvent(new w.Event('change', { bubbles: true }));
    click('nav-schedule'); equal(outputIds(), before);
  });
  let written;
  await test('The main copy action writes plain text for pasting', async () => {
    Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { write: async () => { throw new Error('Unexpected HTML copy'); }, writeText: async text => { written = text; } } });
    for (const format of ['24', '12']) {
      input('ui-time-format', format, 'change'); click('copy-text'); await turn();
      assert(typeof written === 'string' && written.startsWith('DAY 1'), 'Plain text was not copied');
      assert(written.includes(format === '24' ? '16:00' : '4:00 PM'), 'Copied text used the wrong clock format');
      equal(S.parseText(written).length, 26);
      assert(!$('copy-dialog').open, 'Plain-text copy unexpectedly needed a fallback');
    }
    input('ui-time-format', '24', 'change');
  });
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
  await test('Plain text copy falls back to selected text without adding HTML', async () => {
    Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Denied'); } } });
    click('copy-text'); await turn();
    assert($('copy-dialog').open && $('copy-preview').querySelector('pre'), 'Text fallback preview was not opened');
    equal($('select-copy').textContent, 'Select text');
    input('ui-time-format', '12', 'change'); assert($('copy-preview').textContent.includes('4:00 PM'), 'Open copy preview did not switch to 12-hour time');
    input('ui-time-format', '24', 'change'); assert($('copy-preview').textContent.includes('16:00'), 'Open copy preview did not switch to 24-hour time');
    const data = new w.DataTransfer(); d.dispatchEvent(new w.ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData: data }));
    equal(S.parseText(data.getData('text/plain')).length, 26);
    equal(data.getData('text/html'), ''); click('close-copy');
  });
  await test('Pasting prefers plain text when the clipboard also contains an Outlook table', () => {
    const data = new w.DataTransfer();
    data.setData('text/html', '<table><tr><th>Day</th><th>Start</th><th>End</th><th>Presenter</th></tr><tr><td rowspan="2">Sep 28</td><td>9:00 AM</td><td>9:10 AM</td><td>Alice</td></tr><tr><td>9:10 AM</td><td>9:20 AM</td><td>Bob</td></tr></table>');
    data.setData('text/plain', 'Carol\nDan');
    $('paste-input').select();
    $('paste-input').dispatchEvent(new w.ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
    equal($('paste-input').value, 'Carol\nDan');
    equal([...d.querySelectorAll('#import-preview tbody tr')].map(row => row.lastElementChild.textContent), ['Carol', 'Dan']);
    assert(!$('use-input').disabled, 'Text preview failed');
    $('paste-input').setSelectionRange(6, 9);
    const replace = new w.DataTransfer(); replace.setData('text/plain', 'Eve');
    $('paste-input').dispatchEvent(new w.ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: replace }));
    equal($('paste-input').value, 'Carol\nEve');
  });
  await test('HTML-only clipboards still supply participant order', () => {
    const data = new w.DataTransfer(); data.setData('text/html', '<table><tr><th>Name</th></tr><tr><td>Alice</td></tr><tr><td>Bob</td></tr></table>');
    $('paste-input').dispatchEvent(new w.ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
    equal([...d.querySelectorAll('#import-preview tbody tr')].map(row => row.lastElementChild.textContent), ['Alice', 'Bob']);
    assert(!$('use-input').disabled, 'HTML-only preview failed');
  });
  await test('Narrow layout stacks panels and has no horizontal page overflow', async () => {
    frame.style.width = '390px'; await turn();
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
  await test('Days and times remain usable without overflow on narrow screens', async () => {
    click('back-setup'); await turn();
    assert(!$('setup-page').hidden && $('import-page').hidden, 'Back did not show setup');
    assert(d.documentElement.scrollWidth <= w.innerWidth + 1, 'Setup page overflows');
    click('continue-import');
  });
  await test('Typing new input refreshes the preview automatically and prevents stale submission', async () => {
    input('paste-input', '王小明');
    assert($('use-input').disabled, 'Continue should wait for the fresh preview');
    await new Promise(resolve => setTimeout(resolve, 300));
    equal(d.querySelectorAll('#import-preview tbody tr').length, 1);
    assert($('import-preview').textContent.includes('王小明'), 'New input was not previewed');
    assert(!$('use-input').disabled, 'Valid input should enable Continue');
    click('use-input'); equal(outputIds().length, 1);
    equal(d.querySelectorAll('.group-chip').length, 0);
  });
  await test('Chosen dates, times, day count, and duration survive a new import', async () => {
    click('edit-settings'); input('day-count', '2'); input('start-date', '2026-11-09', 'change'); input('duration', '15');
    const date = d.querySelector('#meeting-dates input'); date.value = '2026-11-12'; date.dispatchEvent(new w.Event('change', { bubbles: true }));
    [...d.querySelectorAll('#daily-starts input')].forEach((el, i) => { el.value = i ? '11:00' : '10:00'; el.dispatchEvent(new w.Event('change', { bubbles: true })); });
    click('continue-import'); click('load-sample');
    equal($('day-count').value, '2'); equal($('duration').value, '15'); equal($('start-date').value, '2026-11-09');
    equal(d.querySelector('#meeting-dates input').value, '2026-11-12');
    equal([...d.querySelectorAll('#daily-starts input')].map(el => el.value), ['10:00', '11:00']);
    click('use-input'); equal(outputIds().length, 26);
    assert(d.querySelectorAll('#output-schedule .day-heading')[1].textContent.includes('Nov 12, 2026'), 'Selected date was lost');
    click('edit-settings');
    const secondDate = d.querySelector('#meeting-dates input'); secondDate.value = '2026-11-09'; secondDate.dispatchEvent(new w.Event('change', { bubbles: true }));
    click('continue-import'); assert(!$('setup-error').hidden && !$('setup-page').hidden, 'Duplicate meeting dates were accepted');
    secondDate.value = '2026-11-12'; secondDate.dispatchEvent(new w.Event('change', { bubbles: true }));
    click('nav-schedule'); equal(outputIds().length, 26);
    select('slot-21'); input('move-day', '1', 'change'); input('move-position', '', 'change'); click('move-selected');
    const before = outputIds(); click('edit-settings'); click('continue-import'); click('use-input'); equal(outputIds(), before);
  });
  await test('Pink and blue themes preserve the schedule, groups, and selected presenters', () => {
    const before = outputIds(), groups = d.querySelectorAll('.group-chip').length; select('slot-22');
    for (const theme of ['pink', 'blue']) {
      input('ui-theme', theme, 'change'); equal(d.documentElement.dataset.theme, theme);
      equal(localStorage.getItem('nextweek-theme'), theme); equal(outputIds(), before);
      equal(d.querySelectorAll('.group-chip').length, groups);
      assert(d.querySelector('.output-slot.selected'), 'Theme change cleared selection');
      assert(d.documentElement.scrollWidth <= w.innerWidth + 1, 'New theme overflows on mobile');
    }
    input('ui-language', 'zh-CN', 'change');
    equal([...$('ui-theme').options].slice(-2).map(option => option.textContent), ['粉色', '浅蓝']);
    input('ui-language', 'en', 'change'); input('ui-theme', 'light', 'change'); click('clear-selection');
  });
  await test('Group creation gathers selections across days and merges existing groups', () => {
    click('clear-selection');
    const before = outputIds(), first = idsForDay(0)[0], last = idsForDay(1).at(-1);
    select(first); select(last); click('add-group');
    equal(idsForDay(0).slice(0, 2), [first, last]); equal(d.querySelectorAll('.group-chip').length, 1);
    equal(outputIds().filter(id => id !== first && id !== last), before.filter(id => id !== first && id !== last));
    click('close-group'); select(first); const other = idsForDay(0)[2]; select(other);
    equal($('selection-count').textContent, '3 slots selected'); click('add-group');
    equal(d.querySelectorAll('.group-chip').length, 1); equal(d.querySelectorAll('#group-preview li').length, 3);
    equal(idsForDay(0).slice(0, 3), [first, last, other]);
    const arranged = outputIds(); input('group-name', 'Merged team'); $('group-form').requestSubmit(); equal(outputIds(), arranged);
    d.querySelector('.group-chip').click(); click('delete-group'); equal(outputIds(), arranged); equal(d.querySelectorAll('.group-chip').length, 0);
  });
  await test('A group that would overflow its destination day is rejected atomically', () => {
    click('edit-settings'); const time = d.querySelector('#daily-starts input');
    time.value = S.timeInput(1440 - idsForDay(0).length * Number($('duration').value));
    time.dispatchEvent(new w.Event('change', { bubbles: true })); click('nav-schedule');
    assert(!$('copy-text').disabled, 'Boundary schedule should end exactly at midnight');
    const before = outputIds(); select(idsForDay(0)[0]); select(idsForDay(1)[0]); click('add-group');
    equal(outputIds(), before); equal(d.querySelectorAll('.group-chip').length, 0);
    assert(!$('group-dialog').open && $('schedule-error').textContent.includes('past midnight'), 'Invalid group was created');
    click('edit-settings'); time.value = '10:00'; time.dispatchEvent(new w.Event('change', { bubbles: true })); click('nav-schedule'); click('clear-selection');
  });
  await test('Language, themes, and both clock preferences survive a reload', async () => {
    input('ui-language', 'zh-CN', 'change');
    equal([...$('ui-time-format').options].map(option => option.textContent), ['24 小时', '12 小时']);
    for (const theme of ['dark', 'pink', 'blue']) {
      const select = frame.contentDocument.getElementById('ui-theme'); select.value = theme;
      select.dispatchEvent(new frame.contentWindow.Event('change', { bubbles: true }));
      const format = theme === 'blue' ? '24' : '12', clock = frame.contentDocument.getElementById('ui-time-format');
      clock.value = format; clock.dispatchEvent(new frame.contentWindow.Event('change', { bubbles: true }));
      await new Promise(resolve => { frame.addEventListener('load', resolve, { once: true }); frame.contentWindow.location.reload(); });
      equal(frame.contentDocument.documentElement.lang, 'zh-CN');
      equal(frame.contentDocument.documentElement.dataset.theme, theme);
      equal(frame.contentDocument.getElementById('ui-language').value, 'zh-CN');
      equal(frame.contentDocument.getElementById('ui-theme').value, theme);
      equal(frame.contentDocument.getElementById('ui-time-format').value, format);
      equal(frame.contentDocument.querySelector('#daily-starts input').value, format === '24' ? '09:00' : '9:00 AM');
    }
  });
  await test('A fresh clock preference defaults to 24-hour time', async () => {
    localStorage.removeItem('nextweek-time-format');
    await new Promise(resolve => { frame.addEventListener('load', resolve, { once: true }); frame.contentWindow.location.reload(); });
    equal(frame.contentDocument.getElementById('ui-time-format').value, '24');
    equal(frame.contentDocument.querySelector('#daily-starts input').value, '09:00');
  });
  for (const [key, value] of Object.entries(preferencesBefore)) { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); }
  document.getElementById('summary').textContent = `${passed} passed · ${failed} failed`;
  document.title = `Scheduler browser tests: ${passed} passed, ${failed} failed`;
})();
