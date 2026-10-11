/* All schedule data stays in memory in this browser tab. */
(() => {
  'use strict';
  const S = window.Scheduler;
  const $ = id => document.getElementById(id);
  const t = value => I18n.t(value);
  I18n.bindStatic();
  const uiDate = iso => new Intl.DateTimeFormat(I18n.language, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
  const uiTime = value => I18n.language === 'zh-CN' ? S.formatTime(value, I18n.timeFormat).replace(' AM', ' 上午').replace(' PM', ' 下午') : S.formatTime(value, I18n.timeFormat);
  function uiText(element, source) { element.dataset.uiSource = source; element.textContent = t(source); }
  const state = { previewRows: [], rows: [], groups: [], days: [], dates: [], starts: [], datesEdited: new Set(), selected: new Set(), dirty: false, output: null, clipboardHTML: '', editing: null, nextGroup: 1, copyHTML: '', copyPlain: '', dragging: false, importTimer: null, importPending: false };
  function node(tag, className, text, literal = false) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = literal ? text : t(text);
    return element;
  }
  function message(text) { uiText($('status'), text); }
  function error(id, text = '') { uiText($(id), text); $(id).hidden = !text; }
  const rowsById = () => new Map(state.rows.map(row => [row.id, row]));
  const groupFor = id => state.groups.find(group => group.members.includes(id));
  const dayCount = () => Number($('day-count').value);

  function showPage(page, navigate = true) {
    if (!['setup', 'import', 'schedule'].includes(page)) page = 'setup';
    if (page === 'schedule' && (!state.rows.length || $('use-input').disabled)) page = 'import';
    for (const [step, id] of [['setup', 'setup-page'], ['import', 'import-page'], ['schedule', 'workspace']]) {
      $(id).hidden = step !== page;
      $(`nav-${step}`).removeAttribute('aria-current');
    }
    $(`nav-${page}`).setAttribute('aria-current', 'step');
    if (navigate && location.hash !== `#${page}`) location.hash = page;
    $({ setup: 'setup-heading', import: 'import-heading', schedule: 'workspace-heading' }[page]).focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  $('nav-setup').addEventListener('click', () => showPage('setup'));
  ['back-setup', 'edit-settings', 'edit-import-settings'].forEach(id => $(id).addEventListener('click', () => showPage('setup')));
  function continueImport() { if (validateSetup()) showPage('import'); }
  $('continue-import').addEventListener('click', continueImport);
  $('nav-import').addEventListener('click', continueImport);
  $('back-input').addEventListener('click', () => showPage('import'));
  $('nav-schedule').addEventListener('click', acceptInput);
  window.addEventListener('hashchange', () => {
    const page = location.hash.slice(1);
    if (page === 'schedule') acceptInput();
    else showPage(page, false);
  });
  const today = new Date();
  $('start-date').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  configureDates(); configureStarts(); renderSettingsSummary();
  showPage('setup', false);

  function queuePreview() {
    clearTimeout(state.importTimer);
    state.importPending = true;
    $('use-input').disabled = true;
    $('nav-schedule').disabled = true;
    state.importTimer = setTimeout(previewInput, 250);
  }

  $('ui-language').addEventListener('change', () => {
    I18n.setLanguage($('ui-language').value);
    document.querySelectorAll('[data-ui-source]').forEach(el => { el.textContent = t(el.dataset.uiSource); });
    if (state.previewRows.length && !state.importPending) renderImportPreview();
    try { configureDates(); configureStarts(); } catch (_) { /* Keep invalid input editable. */ }
    renderSettingsSummary();
    if (state.rows.length) {
      renderGroups(); renderSchedules(); updateControls();
    }
    if ($('group-dialog').open) renderGroupPreview();
  });
  $('ui-theme').addEventListener('change', () => I18n.setTheme($('ui-theme').value));
  $('ui-time-format').addEventListener('change', () => {
    I18n.setTimeFormat($('ui-time-format').value);
    try { configureStarts(); } catch (_) { /* Keep invalid settings editable. */ }
    renderSettingsSummary();
    if (state.rows.length) { renderSchedules(); updateControls(); }
    if ($('group-dialog').open) renderGroupPreview();
    if ($('copy-dialog').open && state.output) showCopyFallback(state.copyHTML ? S.exportHTML(state.output, I18n.timeFormat) : '', state.copyHTML ? S.exportTSV(state.output, I18n.timeFormat) : S.exportText(state.output, I18n.timeFormat));
  });

  $('paste-input').addEventListener('paste', event => {
    const text = event.clipboardData?.getData('text/plain') || '';
    const html = event.clipboardData?.getData('text/html') || '';
    if (text) {
      event.preventDefault();
      state.clipboardHTML = '';
      const input = $('paste-input');
      input.setRangeText(text, input.selectionStart, input.selectionEnd, 'end');
      error('import-error');
      previewInput();
    } else if (html && /<table[\s>]/i.test(html)) {
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
    message('Sample loaded. Review the participant order, then generate this week.');
  });

  function previewInput() {
    clearTimeout(state.importTimer); state.importPending = false;
    try {
      error('import-error');
      const value = $('paste-input').value;
      const names = state.clipboardHTML ? S.parseParticipantHTML(state.clipboardHTML) : /^\s*<table[\s>]/i.test(value) ? S.parseParticipantHTML(value) : S.parseParticipantText(value);
      state.previewRows = names.map((presenter, originalIndex) => ({ id: `slot-${originalIndex + 1}`, presenter, originalIndex, dayIndex: 0 }));
      $('use-input').disabled = false;
      $('nav-schedule').disabled = !state.rows.length;
      renderImportPreview();
    } catch (e) {
      state.previewRows = [];
      $('use-input').disabled = true; $('nav-schedule').disabled = true;
      uiText($('preview-count'), 'No valid slots');
      $('import-preview').replaceChildren(node('p', 'preview-placeholder', 'Enter a valid schedule to see the preview.'));
      error('import-error', e.message);
    }
  }

  function renderImportPreview() {
    uiText($('preview-count'), `${state.previewRows.length} slots`);
    const table = node('table'), head = node('thead'), heading = node('tr');
    ['Order', 'Participant'].forEach(text => heading.append(node('th', '', text))); head.append(heading); table.append(head);
    const body = node('tbody');
    state.previewRows.forEach((row, index) => { const tr = node('tr'); tr.append(node('td', '', String(index + 1)), node('td', '', row.presenter, true)); body.append(tr); });
    table.append(body); $('import-preview').replaceChildren(table);
  }

  $('use-input').addEventListener('click', acceptInput);
  function acceptInput() {
    try {
      if (state.importPending) previewInput();
      if ($('use-input').disabled) { showPage('import'); return; }
      if (!validateSetup()) { showPage('setup'); return; }
      error('import-error');
      const rows = state.previewRows;
      if (JSON.stringify(rows) === JSON.stringify(state.rows)) {
        updateSchedule();
        if (!state.output) { error('import-error', $('schedule-error').dataset.uiSource); showPage('import'); return; }
        showPage('schedule'); return;
      }
      state.rows = rows; state.groups = []; state.nextGroup = 1; state.selected.clear(); state.days = [];
      $('nav-schedule').disabled = false;
      uiText($('input-summary'), `${rows.length} participants in last week’s order`);
      renderGroups();
      if (!regenerate()) { error('import-error', $('schedule-error').dataset.uiSource); showPage('import'); return; }
      message(`Imported ${rows.length} slots. This week’s schedule is ready to adjust.`);
      showPage('schedule');
    } catch (e) { error('import-error', e.message); }
  }

  function configureDates() {
    const count = dayCount(); S.targetsFor([], count);
    state.dates[0] = $('start-date').value;
    for (let i = 1; i < count; i++) if (state.dates[i] === undefined) state.dates[i] = S.addDays(state.dates[i - 1], 1);
    $('meeting-dates').replaceChildren(...Array.from({ length: count - 1 }, (_, offset) => {
      const index = offset + 1, label = node('label', '', `Day ${index + 1} date`);
      const input = node('input'); input.type = 'date'; input.value = state.dates[index]; input.required = true;
      input.setAttribute('aria-label', t(`Meeting date for day ${index + 1}`));
      input.addEventListener('change', () => { state.dates[index] = input.value; state.datesEdited.add(index); settingsChanged(); });
      label.append(input); return label;
    }));
  }

  function configureStarts() {
    const count = dayCount(); S.targetsFor([], count);
    for (let i = 0; i < count; i++) if (state.starts[i] === undefined) state.starts[i] = 540;
    $('daily-starts').replaceChildren(...Array.from({ length: count }, (_, index) => {
      const label = node('label', '', `Day ${index + 1} starts`);
      const input = node('input'); input.type = 'text'; input.value = Number.isInteger(state.starts[index]) ? S.formatTime(state.starts[index], I18n.timeFormat) : ''; input.required = true;
      input.placeholder = I18n.timeFormat === '12' ? 'h:mm AM/PM' : 'HH:MM'; input.autocomplete = 'off'; input.spellcheck = false;
      input.setAttribute('aria-label', t(`Start time for day ${index + 1}`));
      input.addEventListener('change', () => {
        try {
          if (I18n.timeFormat === '12' && !/[AP]M$/i.test(input.value.trim())) throw new Error('Include AM or PM.');
          state.starts[index] = S.parseTime(input.value, '24');
          input.value = S.formatTime(state.starts[index], I18n.timeFormat);
        }
        catch (_) { state.starts[index] = NaN; }
        settingsChanged();
      });
      label.append(input); return label;
    }));
  }

  $('day-count').addEventListener('input', () => {
    try { configureDates(); configureStarts(); } catch (_) { /* Validation keeps the number editable. */ }
    settingsChanged(true);
  });
  $('start-date').addEventListener('change', () => {
    state.dates[0] = $('start-date').value;
    try {
      for (let i = 1; i < dayCount(); i++) if (!state.datesEdited.has(i)) state.dates[i] = S.addDays(state.dates[i - 1], 1);
      configureDates();
    } catch (_) { /* Validation keeps the date editable. */ }
    settingsChanged();
  });
  $('duration').addEventListener('input', () => settingsChanged());
  $('reset-schedule').addEventListener('click', () => { if (regenerate()) message('Schedule reset to the automatic order. Settings and groups kept.'); });

  function validateSetup() {
    try {
      const count = dayCount(); S.targetsFor([], count);
      S.meetingDates(state.dates.slice(0, count));
      const duration = Number($('duration').value);
      if (!Number.isInteger(duration) || duration <= 0) throw new Error('Slot duration must be a positive whole number of minutes.');
      for (let i = 0; i < count; i++) if (!Number.isInteger(state.starts[i]) || state.starts[i] < 0 || state.starts[i] >= 1440) throw new Error(`Day ${i + 1}: choose a valid start time.`);
      error('setup-error'); return true;
    } catch (e) { error('setup-error', e.message); return false; }
  }

  function renderSettingsSummary() {
    let text = 'Check days and times in step 1.';
    try {
      const count = dayCount(); S.targetsFor([], count);
      const dates = S.meetingDates(state.dates.slice(0, count));
      text = `${dates.map((date, i) => `${uiDate(date)} · ${uiTime(state.starts[i])}`).join(' / ')} · ${t(`${$('duration').value} minutes per slot`)}`;
    } catch (_) { /* Use the editable-settings hint. */ }
    ['import-settings-summary', 'workspace-settings-summary'].forEach(id => uiText($(id), text));
  }

  function settingsChanged(rebalance = false) {
    renderSettingsSummary();
    if (!validateSetup()) {
      if (rebalance) state.dirty = true;
      if (state.rows.length) invalidateOutput($('setup-error').dataset.uiSource);
      return;
    }
    if (state.rows.length) { if (rebalance) regenerate(); else updateSchedule(); }
  }

  const materialize = days => S.materialize(state.rows, days, $('start-date').value, state.starts, Number($('duration').value), state.dates.slice(0, dayCount()));

  function regenerate() {
    state.dirty = true;
    try {
      configureStarts();
      const days = S.generate(state.rows, state.groups, dayCount());
      const output = materialize(days);
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
      const output = materialize(state.days);
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

  function openGroup(id) {
    state.editing = id;
    const group = state.groups.find(g => g.id === id);
    if (!group) return;
    $('group-name').value = group.name;
    error('group-error');
    renderGroupPreview(); $('group-dialog').showModal(); $('group-name').focus(); $('group-name').select();
  }
  $('add-group').addEventListener('click', () => {
    if (!state.output || state.dirty || state.selected.size < 2) return;
    try {
      const selected = S.expandSelection(state.selected, state.groups);
      const members = state.days.flat().filter(id => selected.has(id));
      const existing = state.groups.filter(group => group.members.some(id => selected.has(id)));
      if (existing.length === 1 && existing[0].members.length === members.length) { openGroup(existing[0].id); return; }
      const index = state.nextGroup - 1;
      const color = S.COLORS[index] || `hsl(${Math.round(index * 137.508) % 360} 55% 89%)`;
      const group = { id: `group-${state.nextGroup}`, name: t(`Group ${state.nextGroup}`), color, members };
      const groups = state.groups.filter(group => !existing.includes(group)).concat(group);
      const targetDay = state.days.findIndex(day => day.includes(members[0]));
      const first = state.days[targetDay].indexOf(members[0]);
      const before = state.days[targetDay].slice(first).find(id => !selected.has(id)) || null;
      const days = S.moveSlots(state.days, selected, targetDay, before, groups);
      const output = materialize(days);
      state.groups = groups; state.nextGroup++; state.days = days; state.output = output; state.selected.clear();
      error('schedule-error'); renderGroups(); renderSchedules(); updateControls();
      message('Group created. You can edit its name.');
      openGroup(group.id);
    } catch (e) { error('schedule-error', e.message); message('Group was not created. Your previous schedule is unchanged.'); }
  });
  $('close-group').addEventListener('click', () => $('group-dialog').close());

  function renderGroupPreview() {
    const group = state.groups.find(group => group.id === state.editing);
    const members = (state.output || []).flat().filter(row => group?.members.includes(row.id));
    $('group-preview').replaceChildren(...members.map(row => {
      const item = node('li', 'group-member', row.presenter, true);
      item.append(node('small', '', `${t(`Day ${row.dayIndex + 1}`)} · ${uiTime(row.start)}`));
      return item;
    }));
    uiText($('group-member-count'), `${members.length} slots`);
  }

  $('group-form').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('group-name').value.trim();
    if (!name) { error('group-error', 'Give this group a name.'); return; }
    const existing = state.groups.find(group => group.id === state.editing);
    if (!existing) return;
    existing.name = name;
    $('group-dialog').close(); renderGroups(); renderSchedules(); updateControls();
    message('Group name updated.');
  });
  $('delete-group').addEventListener('click', () => {
    state.groups = state.groups.filter(group => group.id !== state.editing);
    $('group-dialog').close(); renderGroups(); renderSchedules(); updateControls();
  });

  function renderSourceOrder() {
    $('source-schedule').replaceChildren(...state.rows.map((row, index) => {
      const slot = node('div', 'slot source-slot'); slot.dataset.slotId = row.id;
      const group = groupFor(row.id);
      if (group) slot.style.setProperty('--group-color', group.color);
      const name = node('span', 'slot-name', row.presenter, true);
      if (group) name.append(node('small', '', group.name, true));
      slot.append(node('span', 'slot-order', String(index + 1)), name);
      return slot;
    }));
  }

  function renderSchedules() {
    if (!state.rows.length) return;
    const outputById = new Map((state.output || []).flat().map(row => [row.id, row]));
    renderSourceOrder();
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
      const date = rows[0]?.date || state.dates[index];
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
      const output = materialize(days);
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
    $('add-group').disabled = !enabled || state.selected.size < 2;
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
    if (!$('copy-dialog').open) $('copy-dialog').showModal(); selectCopy();
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

  $('copy-table').addEventListener('click', () => { if (state.output && !state.dirty) copySchedule(S.exportHTML(state.output, I18n.timeFormat), S.exportTSV(state.output, I18n.timeFormat)); });
  $('copy-text').addEventListener('click', () => { if (state.output && !state.dirty) copySchedule('', S.exportText(state.output, I18n.timeFormat)); });
  $('download-csv').addEventListener('click', () => {
    if (!state.output || state.dirty) return;
    const url = URL.createObjectURL(new Blob(['\uFEFF', S.exportCSV(state.output, I18n.timeFormat)], { type: 'text/csv;charset=utf-8' }));
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
