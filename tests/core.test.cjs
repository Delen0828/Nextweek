const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../core.js');
const vm = require('node:vm');
const sampleContext = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'sample.js'), 'utf8'), sampleContext);
const sampleCSV = sampleContext.window.SAMPLE_SCHEDULE;
const resolve = text => { const raw = S.parseText(text); return S.resolveRows(raw, S.importDays(raw, 2026)); };
const sample = resolve(sampleCSV);
const simple = n => Array.from({ length: n }, (_, i) => ({ id: String(i), presenter: `Person ${i}`, date: '2026-09-28', start: 540 + i * 10, end: 550 + i * 10, dayIndex: 0, originalIndex: i }));
const group = (members, id = 'g') => ({ id, name: id, members, color: S.COLORS[0] });

test('embedded sample and DAY text parse with intended AM/PM', () => {
  const text = 'DAY 1 (Sep 28)\n4:00–4:10 Alice\n4:10–4:20 Bob\n\nDAY 2 (Sep 29)\n9:00–9:10 Carol';
  assert.deepEqual(resolve(text).map(({ presenter, start, end }) => ({ presenter, start, end })), [
    { presenter: 'Alice', start: 960, end: 970 },
    { presenter: 'Bob', start: 970, end: 980 },
    { presenter: 'Carol', start: 540, end: 550 }
  ]);
  assert.equal(sample.length, 26);
  assert.equal(sample[0].start, 960);
  assert.equal(sample[15].start, 540);
  assert.equal(S.inferDuration(sample), 10);
  assert.equal(sample[8].presenter, 'Jaeho Lee / Dr. Karam Kim');
});

test('rotate exactly six, retain daily counts, regenerate from unchanged source', () => {
  const before = JSON.stringify(sample);
  const days = S.generate(sample, [], 2);
  assert.deepEqual(days.map(day => day.length), [15, 11]);
  assert.deepEqual(days.flat(), sample.slice(-6).concat(sample.slice(0, -6)).map(row => row.id));
  assert.equal(sample.find(row => row.id === days[0][0]).presenter, 'Gyuwon Kim');
  assert.deepEqual(S.generate(sample, [], 2), days);
  assert.equal(JSON.stringify(sample), before);
});

test('zero through six slots retain order; changed day counts balance', () => {
  for (let n = 0; n <= 6; n++) assert.deepEqual(S.orderedBlocks(simple(n), []).flat(), simple(n).map(r => r.id));
  assert.deepEqual(S.generate(sample, [], 3).map(day => day.length), [9, 9, 8]);
  assert.deepEqual(S.generate(sample, [], 1).map(day => day.length), [26]);
});

test('group spanning cutoff gathers at latest member after rotation', () => {
  const rows = simple(10);
  // Rotated: 4,5,6,7,8,9,0,1,2,3. Group arrives at 3.
  const groups = [group(['3', '4'])];
  assert.deepEqual(S.orderedBlocks(rows, groups), [['5'], ['6'], ['7'], ['8'], ['9'], ['0'], ['1'], ['2'], ['4', '3']]);
});

test('interleaved groups preserve internal rotated order and ungrouped order', () => {
  const rows = simple(6), groups = [group(['0', '3']), group(['1', '4'], 'h')];
  assert.deepEqual(S.orderedBlocks(rows, groups), [['2'], ['0', '3'], ['1', '4'], ['5']]);
  assert.deepEqual(S.orderedBlocks(rows, groups.slice().reverse()), S.orderedBlocks(rows, groups));
  assert.throws(() => S.orderedBlocks(rows, [group(['0', '1']), group(['1', '2'], 'h')]), /only one group/);
});

test('partition keeps blocks whole and favors fuller earlier days on ties', () => {
  const blocks = [['a'], ['b', 'c', 'd'], ['e']];
  assert.deepEqual(S.partition(blocks, [2, 3]).map(day => day.length), [1, 4]);
  assert.deepEqual(S.partition([['a', 'b', 'c'], ['d']], [2, 2]).map(day => day.length), [3, 1]);
  assert.deepEqual(S.partition([['a', 'b', 'c']], [1, 1, 1]).map(day => day.length), [3, 0, 0]);
});

test('partition matches a brute-force optimum including tie-breaking', () => {
  function brute(blocks, targets, day = 0, from = 0) {
    if (day === targets.length) return from === blocks.length ? { score: 0, counts: [] } : null;
    let best = null;
    for (let to = from; to <= blocks.length; to++) {
      const rest = brute(blocks, targets, day + 1, to); if (!rest) continue;
      const count = blocks.slice(from, to).flat().length;
      const candidate = { score: Math.abs(count - targets[day]) + rest.score, counts: [count, ...rest.counts] };
      if (!best || candidate.score <= best.score) best = candidate;
    }
    return best;
  }
  for (let seed = 1; seed <= 30; seed++) {
    const blocks = Array.from({ length: 1 + seed % 5 }, (_, i) => Array.from({ length: 1 + (seed * (i + 1)) % 4 }, (_, j) => `${i}-${j}`));
    const total = blocks.flat().length, count = 1 + seed % 4;
    const targets = Array.from({ length: count }, (_, i) => Math.floor(total / count) + (i < total % count ? 1 : 0));
    assert.deepEqual(S.partition(blocks, targets).map(day => day.length), brute(blocks, targets).counts);
  }
});

test('selection expands groups; moves preserve order and cannot split target group', () => {
  const groups = [group(['a', 'b']), group(['d', 'e'], 'h')];
  const days = [['a', 'b', 'c'], ['d', 'e', 'f']];
  assert.deepEqual([...S.expandSelection(['b'], groups)], ['b', 'a']);
  assert.deepEqual(S.moveSlots(days, ['b', 'c'], 1, 'e', groups), [[], ['a', 'b', 'c', 'd', 'e', 'f']]);
  assert.deepEqual(S.moveSlots(days, ['c'], 0, 'b', groups), [['c', 'a', 'b'], ['d', 'e', 'f']]);
  assert.deepEqual(S.moveSlots(days, ['a'], 0, 'b', groups), days);
  assert.deepEqual(days, [['a', 'b', 'c'], ['d', 'e', 'f']]);
});

test('materialize recalculates moved days, keeps identity, and flags meaningful changes', () => {
  const rows = simple(4), days = S.generate(rows, [], 2);
  const output = S.materialize(rows, days, '2026-10-05', [540, 600], 10);
  assert.deepEqual(output[0].map(r => r.changed), [false, false]);
  assert.equal(output[1][0].changed, false);
  const moved = S.moveSlots(days, ['0', '1'], 1, null, []);
  const result = S.materialize(rows, moved, '2026-10-05', [540, 600], 15);
  assert.equal(result[0].length, 0);
  assert.deepEqual(result[1].map(r => r.start), [600, 615, 630, 645]);
  assert.equal(result[1][0].date, '2026-10-06');
});

test('invalid settings, duplicate assignments, midnight overflow are rejected', () => {
  const rows = simple(2);
  for (const n of [0, -1, 1.5, 366, NaN]) assert.throws(() => S.generate(rows, [], n), /whole number/);
  for (const duration of [0, -1, 1.5, NaN]) assert.throws(() => S.materialize(rows, [['0', '1']], '2026-10-05', [540], duration), /duration/);
  assert.throws(() => S.materialize(rows, [['0', '1']], '2026-10-05', [1430], 10), /past midnight/);
  assert.throws(() => S.materialize(rows, [['0', '0']], '2026-10-05', [540], 10), /exactly once/);
  assert.equal(S.materialize(rows, [['0', '1']], '2026-10-05', [1420], 10)[0][1].end, 1440);
});

test('CSV quoting, TSV, blank repeated dates, and duplicate names', () => {
  const rows = resolve('day,start_time,end_time,presenter\nSep 28,9:00 AM,9:10 AM,"Doe, \"\"Jane\"\""\n,9:10 AM,9:20 AM,"Doe, \"\"Jane\"\""');
  assert.equal(rows[0].presenter, 'Doe, "Jane"');
  assert.equal(rows[0].presenter, rows[1].presenter);
  assert.notEqual(rows[0].id, rows[1].id);
  assert.equal(resolve('Day\tStart\tEnd\tPresenter\nSep 28\t16:00\t16:10\tA')[0].start, 960);
  assert.throws(() => S.parseText('day,start_time,end_time,presenter\nSep 28,9:00,9:10,"Jane'), /Unclosed quote/);
  assert.throws(() => S.parseText('Sep 28,9:00,9:10'), /Row 1/);
});

test('date/time validation, leap days, noon, midnight, and year inference', () => {
  assert.equal(S.parseDate('Sep 28', 2026), '2026-09-28');
  assert.equal(S.parseDate('February 29, 2024'), '2024-02-29');
  assert.throws(() => S.parseDate('Feb 29, 2026'), /Invalid date/);
  assert.throws(() => S.parseDate('2026-02-31'), /Invalid date/);
  assert.equal(S.addDays('2026-12-28', 7), '2027-01-04');
  assert.equal(S.parseTime('12:00 PM'), 720);
  assert.equal(S.parseTime('12:00 AM'), 0);
  assert.throws(() => S.parseTime('25:00'), /Invalid time/);
  assert.throws(() => S.parseTime('9:60'), /Invalid time/);
  assert.deepEqual(resolve('Sep 28,11:50 AM,12:00 PM,A\nSep 28,12:00 PM,12:10 PM,B').map(r => r.start), [710, 720]);
  assert.equal(resolve('Sep 28,11:50 PM,12:00 AM,A')[0].end, 1440);
  assert.throws(() => resolve('Sep 28,9:10 AM,9:00 AM,A'), /later/);
});

test('CSV, TSV and text export roundtrip slot data', () => {
  const output = S.materialize(sample, S.generate(sample, [], 2), '2026-10-05', [960, 540], 10);
  const fields = rows => rows.map(({ presenter, date, start, end }) => ({ presenter, date, start, end }));
  for (const encode of [S.exportCSV, S.exportTSV, S.exportText]) assert.deepEqual(fields(resolve(encode(output))), fields(output.flat()));
  const midnight = S.materialize(simple(2), [['0', '1']], '2026-10-05', [1420], 10);
  assert.deepEqual(fields(resolve(S.exportCSV(midnight))), fields(midnight.flat()));
});

test('HTML export escapes names and omits group colors and changed styling', () => {
  const rows = simple(1); rows[0].presenter = '<img src=x onerror=alert(1)> & Jane';
  const html = S.exportHTML([[{ ...rows[0], changed: true }]], []);
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<strong'));
  assert.ok(!html.includes('font-weight:700'));
  const grouped = S.exportHTML([[{ ...rows[0], changed: true }]], [group(['0', 'other'])]);
  assert.equal(grouped, html);
  assert.ok(!html.includes(S.COLORS[0]));
  assert.ok(!html.includes('Changed'));
});

test('relative-order highlighting marks only the moved six, not shifted followers', () => {
  const output = S.materialize(sample, S.generate(sample, [], 2), '2026-10-05', [960, 540], 10).flat();
  assert.deepEqual(output.filter(r => r.changed).map(r => r.id), sample.slice(-6).map(r => r.id));
  assert.deepEqual([...S.changedOrderIds(['a', 'b', 'c', 'd'], ['c', 'd', 'a', 'b'])], ['c', 'd']);
  assert.deepEqual([...S.changedOrderIds(['a', 'b', 'c', 'd'], ['a', 'd', 'b', 'c'])], ['d']);
});

test('dates, time edits, and day-boundary changes alone never mark names changed', () => {
  const rows = simple(6);
  const output = S.materialize(rows, [['0'], ['1', '2', '3', '4', '5']], '2027-01-01', [960, 720], 25);
  assert.ok(output.flat().every(row => !row.changed));
});

test('name search supports partial names, spelling mistakes, case, and joint names', () => {
  assert.ok(S.fuzzyMatch('karam', sample[8].presenter));
  assert.ok(S.fuzzyMatch('JIMN', 'Dr. Jimin Lee'));
  assert.ok(S.fuzzyMatch('lee jimin', 'Dr. Jimin Lee'));
  assert.ok(S.fuzzyMatch('taewog', 'Dr. Taewoog Kang'));
  assert.ok(!S.fuzzyMatch('nobody', 'Dr. Jimin Lee'));
  assert.ok(S.fuzzyMatch('小明', '王小明'));
  assert.ok(!S.fuzzyMatch('小红', '王小明'));
});
