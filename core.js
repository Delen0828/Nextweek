(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Scheduler = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const COLORS = ['#e4defa', '#d7eee5', '#fce5d2', '#dceafa', '#f7deea', '#f3edcc', '#dcf0f1', '#e8e5dd'];
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const fail = message => { throw new Error(message); };
  const pad = value => String(value).padStart(2, '0');

  function parseDate(value, year = new Date().getFullYear()) {
    const s = String(value).trim();
    let y, m, d, match;
    if ((match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) [, y, m, d] = match.map(Number);
    else if ((match = /^([A-Za-z]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?$/.exec(s))) {
      m = MONTHS.indexOf(match[1].slice(0, 3).toLowerCase()) + 1;
      d = Number(match[2]); y = Number(match[3] || year);
    } else if ((match = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(s))) {
      m = Number(match[1]); d = Number(match[2]); y = Number(match[3] || year);
    } else fail(`Invalid date “${s}”. Use Sep 28, 2026 or YYYY-MM-DD.`);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (y < 1000 || y > 9999 || date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) fail(`Invalid date “${s}”.`);
    return `${y}-${pad(m)}-${pad(d)}`;
  }

  function addDays(iso, count) {
    const date = new Date(`${parseDate(iso)}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + count);
    return parseDate(date.toISOString().slice(0, 10));
  }

  function formatDate(iso, year = true) {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
  }

  function clockParts(value) {
    const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(String(value).trim());
    if (!match) fail(`Invalid time “${value}”. Use 4:00 PM or 16:00.`);
    const h = Number(match[1]), m = Number(match[2]), period = match[3]?.toUpperCase();
    if (m > 59 || h > 23 || (period && (h < 1 || h > 12))) fail(`Invalid time “${value}”.`);
    return { h, m, period, ambiguous: !period && h >= 1 && h <= 12 };
  }

  function parseTime(value, period = '24') {
    const p = clockParts(value);
    const meridiem = p.period || (p.ambiguous && period !== '24' ? period : null);
    return (meridiem ? p.h % 12 + (meridiem === 'PM' ? 12 : 0) : p.h) * 60 + p.m;
  }

  function formatTime(minutes) {
    if (minutes === 1440) return '12:00 AM';
    const h = Math.floor(minutes / 60);
    return `${h % 12 || 12}:${pad(minutes % 60)} ${h >= 12 ? 'PM' : 'AM'}`;
  }

  const timeInput = minutes => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

  function parseDelimited(text, delimiter) {
    const rows = []; let row = [], value = '', quoted = false, closed = false;
    text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    function field() { row.push(value.trim()); value = ''; closed = false; }
    function line() { field(); if (row.some(Boolean)) rows.push(row); row = []; }
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { value += '"'; i++; }
        else if (c === '"') { quoted = false; closed = true; }
        else value += c;
      } else if (c === delimiter) field();
      else if (c === '\n') line();
      else if (c === '"' && !value.trim() && !closed) { quoted = true; value = ''; }
      else if (closed && c.trim()) fail('Unexpected text after a quoted CSV field.');
      else value += c;
    }
    if (quoted) fail('Unclosed quote in CSV. Put a closing double quote around the field.');
    if (value || row.length) line();
    return rows;
  }

  function tableRecords(matrix) {
    if (!matrix.length) fail('The table is empty.');
    const normalize = s => s.toLowerCase().replace(/[\s_-]/g, '');
    const names = matrix[0].map(normalize);
    const aliases = [['day', 'date'], ['start', 'starttime'], ['end', 'endtime'], ['presenter', 'name']];
    let indices = aliases.map(list => names.findIndex(name => list.includes(name)));
    const header = indices.every(index => index >= 0);
    if (!header) indices = [0, 1, 2, 3];
    let lastDay = '';
    return matrix.slice(header ? 1 : 0).filter(row => row.some(s => s.trim())).map((row, index) => {
      const line = index + (header ? 2 : 1);
      if (!header && row.length !== 4) fail(`Row ${line}: expected Day, Start, End, Presenter columns.`);
      const [day, start, end, presenter] = indices.map(i => row[i]?.trim() || '');
      lastDay = day || lastDay;
      if (!lastDay || !start || !end || !presenter) fail(`Row ${line}: day, start, end, and presenter are required.`);
      return { day: lastDay, start, end, presenter, line };
    });
  }

  function parseHTML(html, Parser = typeof DOMParser !== 'undefined' ? DOMParser : null) {
    if (!Parser) fail('HTML table parsing requires a browser.');
    // Detached document: never insert clipboard nodes into the live page.
    const doc = new Parser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style,iframe,object,img,svg,link,[data-scheduler-marker]').forEach(node => node.remove());
    // Outlook may remove data attributes while preserving the marker's span.
    doc.querySelectorAll('span').forEach(node => { if (!node.children.length && node.textContent.trim() === '• Changed') node.remove(); });
    const tables = [...doc.querySelectorAll('table')].filter(table => !table.querySelector('table'));
    if (!tables.length) fail('No HTML table found. Paste a table or use plain text.');
    const all = [];
    for (const table of tables) {
      const matrix = [];
      const trs = [...table.rows];
      if (trs.length > 501) fail('Import up to 500 slots at a time.');
      trs.forEach((tr, r) => {
        matrix[r] ||= []; let c = 0;
        for (const cell of tr.cells) {
          while (matrix[r][c] !== undefined) c++;
          const spanR = Math.min(cell.rowSpan || trs.length - r, trs.length - r);
          const spanC = Math.min(cell.colSpan || 1, 20);
          const text = cell.textContent.replace(/\u00a0/g, ' ').trim();
          for (let dr = 0; dr < spanR; dr++) {
            matrix[r + dr] ||= [];
            for (let dc = 0; dc < spanC; dc++) matrix[r + dr][c + dc] = text;
          }
          c += spanC;
        }
      });
      all.push(...tableRecords(matrix.map(row => Array.from(row, v => v || ''))));
    }
    return all;
  }

  function parseText(text) {
    text = text.trim();
    if (!text) fail('Paste a schedule or choose a CSV file first.');
    if (/^DAY\s+\d+\s*\(/i.test(text)) {
      const rows = []; let day = '';
      text.split(/\r?\n/).forEach((line, i) => {
        if (!line.trim()) return;
        const heading = /^DAY\s+\d+\s*\((.+)\)\s*$/i.exec(line.trim());
        if (heading) { day = heading[1]; return; }
        const slot = /^(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*[–—-]\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s+(.+)$/i.exec(line.trim());
        if (!slot || !day) fail(`Line ${i + 1}: expected a DAY heading or “4:00–4:10 Presenter”.`);
        rows.push({ day, start: slot[1].trim(), end: slot[2].trim(), presenter: slot[3].trim(), line: i + 1 });
      });
      return rows;
    }
    return tableRecords(parseDelimited(text, text.split(/\r?\n/)[0].includes('\t') ? '\t' : ','));
  }

  function importDays(raw, year = new Date().getFullYear()) {
    if (!raw.length) fail('No schedule slots found.');
    if (raw.length > 500) fail('Import up to 500 slots at a time.');
    return [...new Set(raw.map(r => r.day))].map(day => {
      const entries = raw.filter(r => r.day === day);
      const first = clockParts(entries[0].start);
      return { label: day, date: parseDate(day, year), ambiguous: entries.some(r => clockParts(r.start).ambiguous || clockParts(r.end).ambiguous), period: first.period || (first.h >= 1 && first.h < 8 ? 'PM' : 'AM') };
    });
  }

  function resolveRows(raw, days) {
    const rows = []; let previousDay = -1, previousEnd = -1;
    const dates = days.map(day => parseDate(day.date));
    if (new Set(dates).size !== dates.length) fail('Each input day must have a different date.');
    if (dates.some((date, i) => i && date <= dates[i - 1])) fail('Input day dates must be in chronological order.');
    raw.forEach((entry, index) => {
      try {
        const dayIndex = days.findIndex(day => day.label === entry.day);
        if (dayIndex < previousDay) fail('Keep each input day together, in chronological order.');
        if (dayIndex !== previousDay) previousEnd = -1;
        const config = days[dayIndex];
        const first = previousEnd < 0;
        const startParts = clockParts(entry.start), endParts = clockParts(entry.end);
        let start = parseTime(entry.start, first ? config.period : '24');
        if (!first && startParts.ambiguous && config.period !== '24') {
          start = parseTime(entry.start, 'AM');
          while (start < previousEnd) start += 720;
        }
        let end = parseTime(entry.end, '24');
        if (endParts.ambiguous && config.period !== '24') {
          end = parseTime(entry.end, 'AM');
          while (end < start) end += 720;
        }
        if (end === 0 && start > 0 && (!endParts.ambiguous || endParts.period)) end = 1440;
        if (end <= start) fail('End time must be later than start time.');
        if (start < previousEnd) fail('Slots overlap or are out of time order.');
        if (start >= 1440 || end > 1440) fail('Schedule extends past midnight. Check the AM/PM interpretation.');
        rows.push({ id: `slot-${index + 1}`, presenter: entry.presenter, date: config.date, start, end, dayIndex, originalIndex: index });
        previousDay = dayIndex; previousEnd = end;
      } catch (error) { fail(`Row ${entry.line || index + 1}: ${error.message}`); }
    });
    return rows;
  }

  function inferDuration(rows) {
    const counts = new Map();
    rows.forEach(r => counts.set(r.end - r.start, (counts.get(r.end - r.start) || 0) + 1));
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || 10;
  }

  function groupMap(groups, ids) {
    const map = new Map();
    groups.forEach(group => {
      if (group.members.length < 2) fail('A back-to-back group needs at least two slots.');
      group.members.forEach(id => {
        if (ids && !ids.has(id)) fail('A group contains a slot that is not in the input.');
        if (map.has(id)) fail('Each slot can belong to only one group.');
        map.set(id, group);
      });
    });
    return map;
  }

  function orderedBlocks(rows, groups) {
    const ids = rows.map(r => r.id);
    const rotated = ids.length > 6 ? ids.slice(-6).concat(ids.slice(0, -6)) : ids.slice();
    const map = groupMap(groups, new Set(ids));
    const members = new Map();
    rotated.forEach(id => { const g = map.get(id); if (g) { if (!members.has(g)) members.set(g, []); members.get(g).push(id); } });
    const blocks = [];
    rotated.forEach(id => {
      const g = map.get(id);
      if (!g) blocks.push([id]);
      else if (members.get(g).at(-1) === id) blocks.push(members.get(g));
    });
    return blocks;
  }

  function targetsFor(rows, count) {
    if (!Number.isInteger(count) || count < 1 || count > 365) fail('Choose a whole number of days from 1 to 365.');
    const original = [];
    rows.forEach(row => original[row.dayIndex] = (original[row.dayIndex] || 0) + 1);
    return count === original.length ? original : Array.from({ length: count }, (_, i) => Math.floor(rows.length / count) + (i < rows.length % count ? 1 : 0));
  }

  function partition(blocks, targets) {
    const n = blocks.length, d = targets.length;
    const prefix = [0]; blocks.forEach(block => prefix.push(prefix.at(-1) + block.length));
    const cost = Array.from({ length: d + 1 }, () => Array(n + 1).fill(Infinity));
    const choice = Array.from({ length: d }, () => Array(n + 1).fill(0));
    cost[d][n] = 0;
    for (let day = d - 1; day >= 0; day--) {
      for (let from = n; from >= 0; from--) {
        for (let to = from; to <= n; to++) {
          const score = Math.abs(prefix[to] - prefix[from] - targets[day]) + cost[day + 1][to];
          if (score <= cost[day][from]) { cost[day][from] = score; choice[day][from] = to; }
        }
      }
    }
    const days = []; let from = 0;
    for (let day = 0; day < d; day++) { const to = choice[day][from]; days.push(blocks.slice(from, to).flat()); from = to; }
    return days;
  }

  const generate = (rows, groups, count) => partition(orderedBlocks(rows, groups), targetsFor(rows, count));

  function expandSelection(selected, groups) {
    const result = new Set(selected);
    groups.forEach(group => { if (group.members.some(id => result.has(id))) group.members.forEach(id => result.add(id)); });
    return result;
  }

  function moveSlots(days, selected, targetDay, beforeId, groups) {
    if (!Number.isInteger(targetDay) || targetDay < 0 || targetDay >= days.length) fail('Choose a destination day.');
    const expanded = expandSelection(selected, groups);
    const map = groupMap(groups);
    if (beforeId != null && !days[targetDay].includes(beforeId)) fail('The destination slot is not on that day.');
    if (beforeId && map.has(beforeId)) beforeId = days[targetDay].find(id => map.get(id) === map.get(beforeId));
    if (beforeId && expanded.has(beforeId)) return days.map(day => day.slice());
    const moving = days.flat().filter(id => expanded.has(id));
    if (!moving.length) fail('Select at least one output slot to move.');
    const next = days.map(day => day.filter(id => !expanded.has(id)));
    const at = beforeId ? next[targetDay].indexOf(beforeId) : next[targetDay].length;
    next[targetDay].splice(at, 0, ...moving);
    return next;
  }

  function changedOrderIds(original, reordered) {
    // Keep the largest subsequence whose relative order is unchanged. On ties,
    // retain earlier original entries (so a half-list rotation marks its tail).
    const n = original.length, m = reordered.length;
    const lengths = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) lengths[i][j] = original[i] === reordered[j] ? 1 + lengths[i + 1][j + 1] : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
    const unchanged = new Set(); let i = 0, j = 0;
    while (i < n && j < m) {
      if (original[i] === reordered[j]) { unchanged.add(original[i]); i++; j++; }
      else if (lengths[i + 1][j] > lengths[i][j + 1]) i++;
      else j++;
    }
    return new Set(reordered.filter(id => !unchanged.has(id)));
  }

  function materialize(rows, days, startDate, starts, duration) {
    parseDate(startDate);
    if (!Number.isInteger(duration) || duration <= 0) fail('Slot duration must be a positive whole number of minutes.');
    const byId = new Map(rows.map(row => [row.id, row]));
    const all = days.flat();
    if (all.length !== rows.length || new Set(all).size !== all.length || all.some(id => !byId.has(id))) fail('Every input slot must appear exactly once in the output.');
    const changed = changedOrderIds(rows.map(row => row.id), all);
    return days.map((ids, dayIndex) => {
      const start = starts[dayIndex];
      if (!Number.isInteger(start) || start < 0 || start >= 1440) fail(`Day ${dayIndex + 1}: choose a valid start time.`);
      if (start + ids.length * duration > 1440) fail(`Day ${dayIndex + 1} extends past midnight. Start earlier, shorten slots, or move slots to another day.`);
      return ids.map((id, slotIndex) => {
        const source = byId.get(id), time = start + slotIndex * duration;
        return { ...source, date: addDays(startDate, dayIndex), start: time, end: time + duration, dayIndex, changed: changed.has(id) };
      });
    });
  }

  const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const csvCell = value => /[",\n\r\t]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  function exportCSV(days) {
    return ['day,start_time,end_time,presenter', ...days.flat().map(row => [row.date, formatTime(row.start), formatTime(row.end), row.presenter].map(csvCell).join(','))].join('\r\n');
  }
  function exportTSV(days) {
    return ['Day\tStart\tEnd\tPresenter', ...days.flat().map(row => [row.date, formatTime(row.start), formatTime(row.end), row.presenter].map(csvCell).join('\t'))].join('\n');
  }
  function exportText(days) {
    return days.map((rows, i) => rows.length ? `DAY ${i + 1} (${formatDate(rows[0].date)})\n${rows.map(r => `${formatTime(r.start)}–${formatTime(r.end)} ${r.presenter}`).join('\n')}` : '').filter(Boolean).join('\n\n');
  }
  function exportHTML(days) {
    const style = 'border:1px solid #d5d9df;padding:10px 12px;text-align:left;background:#ffffff;font-weight:400;';
    return `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:16px;color:#202b36;background:#ffffff;"><thead><tr>${['Day', 'Start', 'End', 'Presenter'].map(label => `<th style="${style}">${label}</th>`).join('')}</tr></thead><tbody>${days.flat().map(row => `<tr>${[formatDate(row.date), formatTime(row.start), formatTime(row.end), row.presenter].map(value => `<td style="${style}">${escapeHTML(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function fuzzyMatch(query, text) {
    const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ');
    const haystack = normalize(text), words = haystack.split(/\s+/);
    return normalize(query).trim().split(/\s+/).every(token => {
      if (haystack.includes(token)) return true;
      const limit = token.length < 4 ? 0 : token.length < 8 ? 1 : 2;
      return words.some(word => {
        let previous = Array.from({ length: word.length + 1 }, (_, i) => i);
        for (let i = 0; i < token.length; i++) {
          const next = [i + 1];
          for (let j = 0; j < word.length; j++) next.push(Math.min(next[j] + 1, previous[j + 1] + 1, previous[j] + (token[i] !== word[j])));
          previous = next;
        }
        return previous[word.length] <= limit;
      });
    });
  }

  return { COLORS, parseDate, addDays, formatDate, parseTime, formatTime, timeInput, parseDelimited, tableRecords, parseHTML, parseText, importDays, resolveRows, inferDuration, orderedBlocks, targetsFor, partition, generate, groupMap, expandSelection, moveSlots, materialize, changedOrderIds, escapeHTML, exportCSV, exportTSV, exportText, exportHTML, fuzzyMatch };
});
