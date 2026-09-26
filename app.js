/* All schedule data stays in memory in this browser tab. */
(() => {
  'use strict';
  const S = window.Scheduler;
  const $ = id => document.getElementById(id);
  const t = value => I18n.t(value);
  I18n.bindStatic();
  const uiDate = iso => new Intl.DateTimeFormat(I18n.language, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
  const uiTime = value => I18n.language === 'zh-CN' ? S.formatTime(value).replace(' AM', ' 上午').replace(' PM', ' 下午') : S.formatTime(value);
  function uiText(element, source) { element.dataset.uiSource = source; element.textContent = t(source); }
  const state = { raw: [], draftDays: [], rows: [], groups: [], days: [], starts: [], selected: new Set(), dirty: false, output: null, clipboardHTML: '', editing: null, groupSelection: new Set(), nextGroup: 1, copyHTML: '', copyPlain: '', dragging: false, importTimer: null, importPending: false };
  function node(tag, className, text, literal = false) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = literal ? text : t(text);
    return element;
  }
  function message(text) { uiText($('status'), text); }
  function error(id, text = '') { uiText($(id), text); $(id).hidden = !text; }
  const rowsById = () => new Map(state.rows.map(row => [row.id, row]));
  const sourceDays = () => [...new Set(state.rows.map(row => row.date))].map(date => state.rows.filter(row => row.date === date));
  const groupFor = id => state.groups.find(group => group.members.includes(id));
  const dayCount = () => Number($('day-count').value);

  function showPage(page, navigate = true) {
    const schedule = page === 'schedule' && state.rows.length > 0;
    $('import-page').hidden = schedule;
    $('workspace').hidden = !schedule;
    $('nav-import').toggleAttribute('aria-current', !schedule);
    $('nav-schedule').toggleAttribute('aria-current', schedule);
    (schedule ? $('nav-schedule') : $('nav-import')).setAttribute('aria-current', 'step');
    if (navigate && location.hash !== (schedule ? '#schedule' : '#import')) location.hash = schedule ? 'schedule' : 'import';
    (schedule ? $('setup-heading') : $('import-heading')).focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  $('nav-import').addEventListener('click', () => showPage('import'));
  $('back-input').addEventListener('click', () => showPage('import'));
  $('nav-schedule').addEventListener('click', acceptInput);
  window.addEventListener('hashchange', () => showPage(location.hash === '#schedule' ? 'schedule' : 'import', false));
  showPage('import', false);

  function queuePreview() {
    clearTimeout(state.importTimer);
    state.importPending = true;
    $('use-input').disabled = true;
    state.importTimer = setTimeout(previewInput, 250);
  }

  $('ui-language').addEventListener('change', () => {
    I18n.setLanguage($('ui-language').value);
    document.querySelectorAll('[data-ui-source]').forEach(el => { el.textContent = t(el.dataset.uiSource); });
    if (!$('import-review').hidden && !state.importPending) { renderImportDays(); refreshImportPreview(); }
    if (state.rows.length) {
      try { configureStarts(); } catch (_) { /* Keep invalid input editable. */ }
      renderGroups(); renderSchedules(); updateControls();
    }
    if ($('group-dialog').open) renderGroupResults();
  });
  $('ui-theme').addEventListener('change', () => I18n.setTheme($('ui-theme').value));

  $('paste-input').addEventListener('paste', event => {
    const html = event.clipboardData?.getData('text/html') || '';
    const text = event.clipboardData?.getData('text/plain') || '';
    if (html && /<table[\s>]/i.test(html)) {
      event.preventDefault();
      state.clipboardHTML = html;
      $('paste-input').value = text || 'Email table received.';
      error('import-error');
      previewInput();
    } else state.clipboardHTML = '';
  });
  $('paste-input').addEventListener('input', () => { state.clipboardHTML = ''; error('import-error'); queuePreview(); });
  $('file-input').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('Choose a file smaller than 2 MB.');
      $('paste-input').value = await file.text();
      state.clipboardHTML = '';
      uiText($('file-name'), file.name);
      previewInput();
    } catch (e) { error('import-error', e.message); }
    event.target.value = '';
  });
  $('load-sample').addEventListener('click', () => {
    $('paste-input').value = window.SAMPLE_SCHEDULE;
    state.clipboardHTML = '';
    uiText($('file-name'), 'Sample: 26 presenters, 2 days');
    previewInput();
    message('Sample loaded. Review the preview, then continue to scheduling.');
  });

  function previewInput() {
    clearTimeout(state.importTimer); state.importPending = false;
    try {
      error('import-error');
      const value = $('paste-input').value;
      const raw = state.clipboardHTML ? S.parseHTML(state.clipboardHTML) : /^\s*<table[\s>]/i.test(value) ? S.parseHTML(value) : S.parseText(value);
      const days = S.importDays(raw).map(day => ({ ...day, ...state.draftDays.find(previous => previous.label === day.label) }));
      state.raw = raw; state.draftDays = days;
      renderImportDays();
      $('import-review').hidden = false;
      refreshImportPreview();
    } catch (e) {
      $('import-review').hidden = true; $('use-input').disabled = true;
      uiText($('preview-count'), 'No valid slots');
      $('import-preview').replaceChildren(node('p', 'preview-placeholder', 'Enter a valid schedule to see the preview.'));
      error('import-error', e.message);
    }
  }

  function renderImportDays() {
    $('import-days').replaceChildren(...state.draftDays.map((day, index) => {
      const wrapper = node('div', 'input-day');
      wrapper.append(node('strong', '', `Day ${index + 1} · ${day.label}`));
      const label = node('label', '', 'Input date');
      const input = node('input'); input.type = 'date'; input.value = day.date;
      input.setAttribute('aria-label', t(`Input date for day ${index + 1}`));
      input.addEventListener('change', () => { day.date = input.value; refreshImportPreview(); });
      label.append(input); wrapper.append(label);
      if (day.ambiguous) {
        const periodLabel = node('label', '', 'Unmarked times begin in');
        const select = node('select'); select.setAttribute('aria-label', t(`Time interpretation for day ${index + 1}`));
        [['AM', 'AM · morning'], ['PM', 'PM · afternoon'], ['24', '24-hour clock']].forEach(([value, text]) => { const option = node('option', '', text); option.value = value; select.append(option); });
        select.value = day.period;
        select.addEventListener('change', () => { day.period = select.value; refreshImportPreview(); });
        periodLabel.append(select); wrapper.append(periodLabel);
      }
      return wrapper;
    }));
  }

  function refreshImportPreview() {
    try {
      const rows = S.resolveRows(state.raw, state.draftDays);
      error('import-error');
      $('use-input').disabled = false;
      uiText($('preview-count'), `${rows.length} slots`);
      const table = node('table');
      const head = node('thead'), heading = node('tr');
      ['Day', 'Start', 'End', 'Presenter'].forEach(text => heading.append(node('th', '', text))); head.append(heading); table.append(head);
      const body = node('tbody');
      rows.forEach(row => { const tr = node('tr'); [uiDate(row.date), uiTime(row.start), uiTime(row.end), row.presenter].forEach((text, index) => tr.append(node('td', '', text, index === 3))); body.append(tr); });
      table.append(body); $('import-preview').replaceChildren(table);
    } catch (e) {
      error('import-error', e.message); $('use-input').disabled = true;
      uiText($('preview-count'), 'Check input');
      $('import-preview').replaceChildren(node('p', 'helper', 'Correct the dates or time interpretation above to preview this schedule.'));
    }
  }

  $('use-input').addEventListener('click', acceptInput);
  function acceptInput() {
    try {
      if (state.importPending) previewInput();
      if ($('use-input').disabled) { showPage('import'); return; }
      const rows = S.resolveRows(state.raw, state.draftDays);
      if (JSON.stringify(rows) === JSON.stringify(state.rows)) { showPage('schedule'); return; }
      state.rows = rows; state.groups = []; state.nextGroup = 1; state.selected.clear(); state.days = []; state.starts = [];
      $('start-date').value = S.addDays(rows[0].date, 7);
      $('day-count').value = sourceDays().length;
      $('duration').value = S.inferDuration(rows);
      $('nav-schedule').disabled = false;
      uiText($('input-summary'), `${rows.length} slots · ${sourceDays().length} input days`);
      configureStarts(); renderGroups(); regenerate();
      message(`Imported ${rows.length} slots. Next week’s schedule is ready to adjust.`);
      showPage('schedule');
    } catch (e) { error('import-error', e.message); }
  }

  function configureStarts() {
    const count = dayCount(); S.targetsFor(state.rows, count);
    const original = sourceDays();
    for (let i = 0; i < count; i++) if (state.starts[i] === undefined) state.starts[i] = original[i]?.[0]?.start ?? original[0][0].start;
    $('daily-starts').replaceChildren(...Array.from({ length: count }, (_, index) => {
      const label = node('label', '', `Day ${index + 1} starts`);
      const input = node('input'); input.type = 'time'; input.value = S.timeInput(state.starts[index]); input.required = true;
      input.setAttribute('aria-label', t(`Start time for day ${index + 1}`));
      input.addEventListener('change', () => {
        try { state.starts[index] = S.parseTime(input.value, '24'); updateSchedule(); }
        catch (e) { state.starts[index] = NaN; invalidateOutput(e.message); }
      });
      label.append(input); return label;
    }));
  }

  $('day-count').addEventListener('input', () => {
    regenerate();
  });
  $('start-date').addEventListener('change', updateSchedule);
  $('duration').addEventListener('input', updateSchedule);
  $('reset-schedule').addEventListener('click', () => { if (regenerate()) message('Schedule reset to the automatic order. Settings and groups kept.'); });

  function regenerate() {
    state.dirty = true;
    try {
      configureStarts();
      const days = S.generate(state.rows, state.groups, dayCount());
      const output = S.materialize(state.rows, days, $('start-date').value, state.starts, Number($('duration').value));
      state.days = days; state.output = output; state.dirty = false; state.selected.clear();
      error('schedule-error');
      renderSchedules(); updateControls();
      message('Schedule updated automatically.');
      return true;
    } catch (e) { invalidateOutput(e.message); return false; }
  }

  function invalidateOutput(text) {
    state.output = null;
    error('schedule-error', text);
    renderSchedules(); updateControls();
  }

  function updateSchedule() {
    if (!state.rows.length) return;
    if (state.dirty) { regenerate(); return; }
    try {
      const output = S.materialize(state.rows, state.days, $('start-date').value, state.starts, Number($('duration').value));
      state.output = output;
      error('schedule-error'); renderSchedules(); updateControls();
    } catch (e) { invalidateOutput(e.message); }
  }

  function renderGroups() {
    $('group-list').replaceChildren(...(state.groups.length ? state.groups.map(group => {
      const button = node('button', 'group-chip', group.name, true); button.style.setProperty('--group-color', group.color);
      button.append(node('span', '', `${group.members.length} slots · Edit`));
      button.addEventListener('click', () => openGroup(group.id)); return button;
    }) : [node('span', 'helper', 'No groups yet — everyone follows the rotation.')]));
  }

  function openGroup(id = null) {
    state.editing = id;
    const group = state.groups.find(g => g.id === id);
    state.groupSelection = new Set(group?.members || []);
    $('group-name').value = group?.name || t(`Group ${state.nextGroup}`);
    $('group-search').value = '';
    uiText($('group-dialog-title'), group ? 'Edit your group' : 'Create a group');
    $('delete-group').hidden = !group; error('group-error');
    renderGroupResults(); $('group-dialog').showModal(); $('group-search').focus();
  }
  $('add-group').addEventListener('click', () => openGroup());
  $('close-group').addEventListener('click', () => $('group-dialog').close());
  $('group-search').addEventListener('input', renderGroupResults);

  function renderGroupResults() {
    const matches = state.rows.filter(row => S.fuzzyMatch($('group-search').value, row.presenter));
    const entries = matches.map(row => {
      const group = groupFor(row.id), unavailable = group && group.id !== state.editing;
      const label = node('label', `group-result${unavailable ? ' unavailable' : ''}`);
      const checkbox = node('input'); checkbox.type = 'checkbox'; checkbox.checked = state.groupSelection.has(row.id); checkbox.disabled = Boolean(unavailable);
      checkbox.setAttribute('aria-label', t(`${row.presenter}, day ${row.dayIndex + 1}, ${uiTime(row.start)}`));
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) state.groupSelection.add(row.id); else state.groupSelection.delete(row.id);
        uiText($('group-selected-count'), `${state.groupSelection.size} slots selected`);
      });
      const content = node('span', '', row.presenter, true);
      content.append(node('small', '', `${t(`Day ${row.dayIndex + 1}`)} · ${uiTime(row.start)}${unavailable ? ` · ${t(`In ${group.name}`)}` : ''}`));
      label.append(checkbox, content); return label;
    });
    $('group-results').replaceChildren(...(entries.length ? entries : [node('p', 'helper', 'No matching presenters. Try a shorter name.')]));
    uiText($('group-selected-count'), `${state.groupSelection.size} slots selected`);
  }

  $('group-form').addEventListener('submit', event => {
    event.preventDefault();
    if (state.groupSelection.size < 2) { error('group-error', 'Select at least two slots for a back-to-back group.'); return; }
    const name = $('group-name').value.trim();
    if (!name) { error('group-error', 'Give this group a name.'); return; }
    const existing = state.groups.find(group => group.id === state.editing);
    if (existing) { existing.name = name; existing.members = [...state.groupSelection]; }
    else {
      const index = state.nextGroup++ - 1;
      const color = S.COLORS[index] || `hsl(${Math.round(index * 137.508) % 360} 55% 89%)`;
      state.groups.push({ id: `group-${index + 1}`, name, color, members: [...state.groupSelection] });
    }
    $('group-dialog').close(); renderGroups(); regenerate();
  });
  $('delete-group').addEventListener('click', () => {
    state.groups = state.groups.filter(group => group.id !== state.editing);
    $('group-dialog').close(); renderGroups(); regenerate();
  });

  function renderSchedules() {
    if (!state.rows.length) return;
    const outputById = new Map((state.output || []).flat().map(row => [row.id, row]));
    const source = sourceDays();
    renderPanel('source-schedule', source, false, outputById);
    if (state.output) renderPanel('output-schedule', state.output, true, outputById);
    else $('output-schedule').replaceChildren(node('p', 'error', 'Fix the schedule settings above to preview and export the output.'));
    uiText($('source-count'), `${state.rows.length} slots`);
    uiText($('output-count'), state.output ? `${state.output.flat().filter(row => row.changed).length} changed` : 'Needs attention');
    const count = state.days.length;
    if (count) {
      const targets = S.targetsFor(state.rows, count), actual = state.days.map(day => day.length);
      uiText($('balance-note'), `Daily slots: ${actual.join(' / ')}${actual.some((n, i) => n !== targets[i]) ? ` · Original target: ${targets.join(' / ')}. Groups and manual moves take priority.` : ' · Matches the daily targets.'}`);
    }
  }

  function renderPanel(id, days, editable, outputById) {
    const fragment = document.createDocumentFragment();
    days.forEach((rows, index) => {
      const section = node('section', 'schedule-day');
      const date = rows[0]?.date || S.addDays($('start-date').value, index);
      const heading = node('div', 'day-heading');
      heading.append(node('strong', '', `DAY ${index + 1}  ·  ${uiDate(date)}`), node('span', '', `${rows.length} slots`)); section.append(heading);
      rows.forEach(row => {
        const group = groupFor(row.id), changed = editable && !state.dirty && outputById.get(row.id)?.changed;
        const slot = node('div', `slot ${editable ? 'output-slot' : 'source-slot'}${changed ? ' changed' : ''}${state.selected.has(row.id) && editable ? ' selected' : ''}`);
        slot.dataset.slotId = row.id;
        if (changed) { const marker = node('span', 'change-triangle'); marker.setAttribute('role', 'img'); marker.setAttribute('aria-label', t('Relative order changed')); slot.append(marker); }
        if (group) slot.style.setProperty('--group-color', group.color);
        if (editable) {
          slot.draggable = !state.dirty;
          const handle = node('span', 'drag-handle', '⠿'); handle.setAttribute('aria-hidden', 'true'); slot.append(handle);
          const checkbox = node('input'); checkbox.type = 'checkbox'; checkbox.checked = state.selected.has(row.id); checkbox.disabled = state.dirty;
          checkbox.setAttribute('aria-label', t(`Select ${row.presenter}, day ${index + 1}, ${uiTime(row.start)}`));
          checkbox.addEventListener('change', () => {
            const ids = S.expandSelection([row.id], state.groups);
            ids.forEach(id => checkbox.checked ? state.selected.add(id) : state.selected.delete(id));
            syncSelection(); updateControls();
          });
          slot.append(checkbox);
          slot.addEventListener('dragstart', event => {
            if (state.dirty) { event.preventDefault(); return; }
            if (!state.selected.has(row.id)) state.selected = S.expandSelection([row.id], state.groups);
            state.dragging = true;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', [...state.selected].join(','));
            syncSelection(); updateControls();
          });
          slot.addEventListener('dragend', () => { state.dragging = false; document.querySelectorAll('.drop-over').forEach(el => el.classList.remove('drop-over')); });
          attachDrop(slot, index, row.id);
        }
        const time = node('span', 'slot-time', `${uiTime(row.start)}–${uiTime(row.end)}`);
        const presenter = node(changed ? 'strong' : 'span', 'slot-name', row.presenter, true);
        if (changed) presenter.title = t('Relative order changed');
        if (group) presenter.append(node('small', '', group.name, true));
        slot.append(time, presenter);
        section.append(slot);
      });
      if (editable) {
        const drop = node('div', `day-drop${rows.length ? '' : ' empty'}`, rows.length ? 'Drop here to append to this day' : 'No slots yet · drop a slot or use Move selected');
        attachDrop(drop, index, null); section.append(drop);
      }
      fragment.append(section);
    });
    $(id).replaceChildren(fragment);
  }

  function syncSelection() {
    document.querySelectorAll('.output-slot').forEach(slot => {
      const selected = state.selected.has(slot.dataset.slotId);
      slot.classList.toggle('selected', selected); slot.querySelector('input').checked = selected;
    });
  }

  function attachDrop(element, index, before) {
    element.addEventListener('dragover', event => {
      if (state.dirty || !state.dragging) return;
      event.preventDefault(); event.dataTransfer.dropEffect = 'move'; element.classList.add('drop-over');
    });
    element.addEventListener('dragleave', () => element.classList.remove('drop-over'));
    element.addEventListener('drop', event => {
      event.preventDefault(); element.classList.remove('drop-over');
      if (!state.dirty && state.dragging) performMove(index, before);
      state.dragging = false;
    });
  }

  function performMove(index, before) {
    try {
      const days = S.moveSlots(state.days, state.selected, index, before, state.groups);
      const output = S.materialize(state.rows, days, $('start-date').value, state.starts, Number($('duration').value));
      const count = state.selected.size;
      state.days = days; state.output = output; state.selected.clear();
      error('schedule-error'); renderSchedules(); updateControls();
      message(`Moved ${count} slots to day ${index + 1}. Times have been recalculated.`);
    } catch (e) { error('schedule-error', e.message); message('Move was not applied. Your previous schedule is unchanged.'); }
  }

  function updateControls() {
    const enabled = state.output && !state.dirty;
    ['copy-table', 'copy-text', 'download-csv'].forEach(id => $(id).disabled = !enabled);
    uiText($('selection-count'), `${state.selected.size} slots selected`);
    $('move-selected').disabled = !enabled || !state.selected.size;
    $('clear-selection').disabled = !state.selected.size;
    const previous = $('move-day').value;
    $('move-day').replaceChildren(...state.days.map((_, index) => { const option = node('option', '', `Day ${index + 1}`); option.value = index; return option; }));
    if ([...$('move-day').options].some(option => option.value === previous)) $('move-day').value = previous;
    updatePositions();
  }

  function updatePositions() {
    const day = state.days[Number($('move-day').value)] || [], byId = rowsById(), seen = new Set();
    const before = $('move-position').value;
    const options = [];
    day.forEach(id => {
      const group = groupFor(id);
      if (group && seen.has(group.id)) return;
      if (group) seen.add(group.id);
      if (state.selected.has(id)) return;
      const option = node('option', '', `Before ${group?.name || byId.get(id).presenter}`); option.value = id; options.push(option);
    });
    const last = node('option', '', 'End of day'); last.value = ''; options.push(last);
    $('move-position').replaceChildren(...options);
    $('move-position').value = options.some(option => option.value === before) ? before : '';
  }
  $('move-day').addEventListener('change', updatePositions);
  $('move-selected').addEventListener('click', () => performMove(Number($('move-day').value), $('move-position').value || null));
  $('clear-selection').addEventListener('click', () => { state.selected.clear(); syncSelection(); updateControls(); });

  function showCopyFallback(html, plain) {
    state.copyHTML = html; state.copyPlain = plain;
    // Only our escaped serializer's output is inserted, never imported HTML.
    if (html) $('copy-preview').innerHTML = html;
    else $('copy-preview').replaceChildren(node('pre', '', plain));
    uiText($('copy-instructions'), html ? 'Select the table below, press ⌘C or Ctrl+C, then paste into Outlook using “Keep Source Formatting”.' : 'Select the text below, press ⌘C or Ctrl+C, then paste into your email.');
    uiText($('select-copy'), html ? 'Select table' : 'Select text');
    $('copy-dialog').showModal(); selectCopy();
  }

  async function copySchedule(html, plain) {
    try {
      if (html) {
        if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Rich clipboard unavailable');
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([plain], { type: 'text/plain' }) })]);
      } else {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(plain);
      }
      message(html ? 'Table copied. Paste into Outlook using “Keep Source Formatting”.' : 'Day-by-day text copied.');
    } catch (_) { showCopyFallback(html, plain); message('Use the selected preview to copy your schedule manually.'); }
  }

  $('copy-table').addEventListener('click', () => { if (state.output && !state.dirty) copySchedule(S.exportHTML(state.output, state.groups), S.exportTSV(state.output)); });
  $('copy-text').addEventListener('click', () => { if (state.output && !state.dirty) copySchedule('', S.exportText(state.output)); });
  $('download-csv').addEventListener('click', () => {
    if (!state.output || state.dirty) return;
    const url = URL.createObjectURL(new Blob(['\uFEFF', S.exportCSV(state.output)], { type: 'text/csv;charset=utf-8' }));
    const anchor = node('a'); anchor.href = url; anchor.download = `schedule-${$('start-date').value}.csv`;
    document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    message('CSV downloaded.');
  });
  function selectCopy() {
    const range = document.createRange(); range.selectNodeContents($('copy-preview'));
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
  }
  $('select-copy').addEventListener('click', selectCopy);
  $('close-copy').addEventListener('click', () => $('copy-dialog').close());
  document.addEventListener('copy', event => {
    if (!$('copy-dialog').open || !window.getSelection()?.anchorNode || !$('copy-preview').contains(window.getSelection().anchorNode)) return;
    if (!event.clipboardData) return;
    event.preventDefault();
    event.clipboardData.setData('text/plain', state.copyPlain);
    if (state.copyHTML) event.clipboardData.setData('text/html', state.copyHTML);
    message('Schedule copied from the preview.');
  });
})();
