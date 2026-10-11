/* UI preferences only; no schedule data is persisted. */
(() => {
  const zh = {
    'Language': '语言', 'Appearance': '外观', 'Light': '浅色', 'Dark': '深色', 'Pink': '粉色', 'Light blue': '浅蓝',
    'Time format': '时间格式', '24-hour': '24 小时', '12-hour': '12 小时',
    'Nextweek home': 'Nextweek 首页', 'Schedule steps': '排期步骤',
    'Days & times': '日期与时间', 'Last week': '上周',
    'Choose this week’s days & times': '选择本周的日期与时间',
    'Choose your meeting days first, then set the times.': '先选择会议日期，再设置时间。',
    'Choose days': '选择日期', 'First meeting date': '首个会议日期', 'Number of meeting days': '会议天数',
    'Meeting days can be nonconsecutive. Keep dates in chronological order.': '会议日期可以不连续，请按时间先后排列。',
    'Set times': '设置时间', 'Continue to last week': '继续导入上周日程',
    'Paste last week’s schedule': '粘贴上周日程', 'Last week’s schedule': '上周日程', 'Participant order': '参与者顺序',
    'Only participant order is used. Last week’s dates and times are ignored.': '仅使用参与者顺序，忽略上周的日期和时间。',
    'Paste a schedule or participant names, one per line': '粘贴日程，或每行输入一位参与者姓名',
    'Order': '顺序', 'Participant': '参与者',
    'Paste participant names or a schedule with a participant column.': '请粘贴参与者姓名，或包含参与者列的日程。',
    'This week’s days & times': '本周日期与时间', 'Edit days & times': '编辑日期与时间',
    'Generate shifts the last six presenters to the front and distributes slots across your selected days.': '生成时会将最后六个报告时段移到开头，并分配到您选择的日期。',
    '← Back to days & times': '← 返回日期与时间', 'Generate this week': '生成本周日程',
    'Fine-tune this week’s schedule': '微调本周日程', '← Back to last week': '← 返回上周日程',
    '= order changed this week': '= 本周相对顺序有变',
    'Sample loaded. Review the participant order, then generate this week.': '示例已加载。请核对参与者顺序，然后生成本周日程。',
    'Check days and times in step 1.': '请在第 1 步核对日期与时间。',
    'Choose at least one meeting date.': '请至少选择一个会议日期。',
    'Meeting dates must be different and in chronological order.': '会议日期必须不同，并按时间先后排列。',
    'Choose a meeting date for every day.': '请为每一天选择会议日期。',
    'Import schedule': '导入日程', 'Schedule & export': '排期与导出', 'Load sample': '加载示例',
    'Schedule input': '日程输入', 'Paste your schedule': '粘贴日程',
    'Paste an Outlook table, CSV, or day-by-day text': '粘贴 Outlook 表格、CSV 或按天排列的文本',
    'Choose file': '选择文件', 'CSV or text · up to 2 MB': 'CSV 或文本文件 · 最大 2 MB',
    'The preview updates as you type or paste.': '输入或粘贴后，预览会自动更新。',
    'Pastes use plain text; formatting is ignored.': '粘贴时使用纯文本，忽略原格式。',
    'Check dates & times': '核对日期与时间', 'Missing years use the current year. Review unmarked AM/PM below.': '未注明年份时使用当前年份。请在下方确认上午或下午。',
    'Input preview': '输入预览', 'No slots': '暂无时段', 'No valid slots': '暂无有效时段', 'Check input': '请检查输入',
    'Paste a schedule or load the sample to preview it here.': '粘贴日程或加载示例，即可在此预览。',
    'Enter a valid schedule to see the preview.': '输入有效的日程后即可预览。',
    'Continue to schedule': '继续排期', '← Back to input': '← 返回输入', 'Updates automatically': '自动更新',
    'Meeting starting date': '会议开始日期', 'Split into days': '分为几天', 'Minutes per slot': '每个时段（分钟）',
    'Reset schedule': '重置日程', 'Restore automatic order and daily counts. Keep your settings and groups.': '恢复自动排列与每天的时段数量，保留当前设置和分组。',
    'Reset restores the automatic order, keeping your settings and groups.': '重置会恢复自动排列，同时保留设置和分组。',
    'Back-to-back groups': '连续时段分组', 'Link presenters who need adjacent slots.': '将需要相邻时段的报告人设为一组。',
    'Select at least two presenters in this week’s schedule, then add a group.': '在本周日程中选择至少两个报告时段，然后添加分组。',
    'Select slots to move or group them. Groups travel together.': '选中时段即可移动或分组；同组成员会一起移动。',
    'Group members': '分组成员', 'Save name': '保存名称',
    'Group created. You can edit its name.': '分组已创建，可以编辑名称。',
    'Group name updated.': '分组名称已更新。',
    'Group was not created. Your previous schedule is unchanged.': '未创建分组，原日程保持不变。',
    'No groups yet': '暂无分组', 'No groups yet — everyone follows the rotation.': '暂无分组，将按轮换顺序排列。', '＋ Add group': '＋ 添加分组',
    'Back-to-back group': '连续时段分组', 'Bold name': '粗体姓名', '= order changed next week': '= 下周相对顺序有变',
    'Select slots to move them. Groups travel together.': '选中时段即可移动；同组成员会一起移动。',
    'This week': '本周', 'Next week': '下周', 'Move selected slots': '移动选中的时段', 'Clear': '清除选择',
    'Move to': '移动至', 'Destination day': '目标日期', 'Position': '位置', 'Destination position': '目标位置',
    'Move selected →': '移动所选 →', 'Export schedule': '导出日程', 'Copy text': '复制文本', 'Download CSV': '下载 CSV',
    'Copy for Outlook': '复制到 Outlook', 'Schedules stay in this browser tab.': '日程数据仅保留在当前浏览器标签页中。',
    'Create a group': '创建分组', 'Edit your group': '编辑分组', 'Close group editor': '关闭分组编辑',
    'Group name': '分组名称', 'e.g. Research team': '例如：研究小组', 'Find presenters': '查找报告人',
    'Search a name — a typo is okay': '输入姓名，支持模糊搜索', 'Select at least two slots. Joint entries stay as one slot.': '至少选择两个时段。联名条目仍视为一个时段。',
    'Delete group': '删除分组', 'Save group': '保存分组', 'Copy your schedule': '复制日程', 'Close copy preview': '关闭复制预览',
    'Select the table, press ⌘C or Ctrl+C, then paste into Outlook using “Keep Source Formatting”.': '选中表格，按 ⌘C 或 Ctrl+C，再粘贴到 Outlook，并选择“保留源格式”。',
    'Select the table below, press ⌘C or Ctrl+C, then paste into Outlook using “Keep Source Formatting”.': '选中下方表格，按 ⌘C 或 Ctrl+C，再粘贴到 Outlook，并选择“保留源格式”。',
    'Select the text below, press ⌘C or Ctrl+C, then paste into your email.': '选中下方文本，按 ⌘C 或 Ctrl+C，再粘贴到邮件中。',
    'Select table': '选中表格', 'Select text': '选中文本', 'Input date': '输入日期', 'Unmarked times begin in': '未标注时间的起始时段',
    'AM · morning': 'AM · 上午', 'PM · afternoon': 'PM · 下午', '24-hour clock': '24 小时制',
    'Day': '日期', 'Start': '开始', 'End': '结束', 'Presenter': '报告人', 'Needs attention': '需要检查',
    'Correct the dates or time interpretation above to preview this schedule.': '请修正日期或上午/下午设置后查看预览。',
    'Choose a file smaller than 2 MB.': '请选择小于 2 MB 的文件。', 'Sample: 26 presenters, 2 days': '示例：26 个报告时段，2 天',
    'Sample loaded. Review the preview, then continue to scheduling.': '示例已加载。请核对预览，然后继续排期。',
    'Schedule reset to the automatic order. Settings and groups kept.': '日程已恢复自动排列，设置和分组保持不变。',
    'Schedule updated automatically.': '日程已自动更新。', 'Email table received.': '已收到邮件表格。',
    'No matching presenters. Try a shorter name.': '未找到匹配的报告人，请尝试更短的姓名。',
    'Select at least two slots for a back-to-back group.': '连续时段分组至少需要两个时段。', 'Give this group a name.': '请填写分组名称。',
    'Fix the schedule settings above to preview and export the output.': '请修正上方设置，即可预览和导出日程。',
    'Relative order changed': '相对顺序有变', 'Drop here to append to this day': '拖到此处，添加到当天末尾',
    'No slots yet · drop a slot or use Move selected': '暂无时段 · 拖入时段或使用“移动所选”', 'End of day': '当天末尾',
    'Move was not applied. Your previous schedule is unchanged.': '未执行移动，原日程保持不变。',
    'Table copied. Paste into Outlook using “Keep Source Formatting”.': '表格已复制。粘贴到 Outlook 时请选择“保留源格式”。',
    'Day-by-day text copied.': '按天排列的文本已复制。', 'Use the selected preview to copy your schedule manually.': '请手动复制已选中的日程预览。',
    'CSV downloaded.': 'CSV 已下载。', 'Schedule copied from the preview.': '已从预览复制日程。',
    'Paste a schedule or choose a CSV file first.': '请先粘贴日程或选择 CSV 文件。', 'No schedule slots found.': '未找到会议时段。',
    'Import up to 500 slots at a time.': '一次最多导入 500 个时段。', 'The table is empty.': '表格为空。',
    'No HTML table found. Paste a table or use plain text.': '未找到 HTML 表格，请粘贴表格或纯文本。',
    'Each input day must have a different date.': '每个输入日必须使用不同日期。', 'Input day dates must be in chronological order.': '输入日期必须按时间先后排列。',
    'Keep each input day together, in chronological order.': '请将同一天的时段放在一起，并按日期先后排列。',
    'End time must be later than start time.': '结束时间必须晚于开始时间。', 'Slots overlap or are out of time order.': '时段重叠或未按时间顺序排列。',
    'Schedule extends past midnight. Check the AM/PM interpretation.': '日程超过午夜，请检查上午/下午设置。',
    'Choose a whole number of days from 1 to 365.': '天数必须是 1 至 365 的整数。',
    'Slot duration must be a positive whole number of minutes.': '时段长度必须是正整数分钟。',
    'Every input slot must appear exactly once in the output.': '每个输入时段必须在输出中出现且仅出现一次。',
    'Select at least one output slot to move.': '请至少选择一个输出时段。', 'Choose a destination day.': '请选择目标日期。',
    'A back-to-back group needs at least two slots.': '连续时段分组至少需要两个时段。', 'Each slot can belong to only one group.': '每个时段只能属于一个分组。',
    'Unclosed quote in CSV. Put a closing double quote around the field.': 'CSV 中的引号未闭合，请补充字段末尾的双引号。',
    'Unexpected text after a quoted CSV field.': 'CSV 引号字段之后有多余文本。',
    'A group contains a slot that is not in the input.': '分组包含输入中不存在的时段。',
    'The destination slot is not on that day.': '目标时段不在所选日期。',
  };
  const themes = ['light', 'dark', 'pink', 'blue'];
  let language = 'en', theme = 'light', timeFormat = '24';
  try { language = localStorage.getItem('nextweek-language') === 'zh-CN' ? 'zh-CN' : 'en'; theme = localStorage.getItem('nextweek-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); timeFormat = localStorage.getItem('nextweek-time-format') === '12' ? '12' : '24'; } catch (_) {}
  if (!themes.includes(theme)) theme = 'light';
  const patterns = [
    [/^(\d+) participants in last week’s order$/, (_, n) => `${n} 位参与者，按上周顺序排列`],
    [/^Position (\d+)$/, (_, n) => `第 ${n} 位`],
    [/^Day (\d+) date$/, (_, n) => `第 ${n} 天日期`],
    [/^Meeting date for day (\d+)$/, (_, n) => `第 ${n} 天会议日期`],
    [/^(\d+) minutes per slot$/, (_, n) => `每个时段 ${n} 分钟`],
    [/^Day (\d+) · (.*)$/, (_, n, label) => `第 ${n} 天 · ${label}`],
    [/^Day (\d+) starts$/, (_, n) => `第 ${n} 天开始时间`],
    [/^Day (\d+)$/, (_, n) => `第 ${n} 天`],
    [/^DAY (\d+)  ·  (.*)$/, (_, n, date) => `第 ${n} 天 · ${date}`],
    [/^(\d+) slots selected$/, (_, n) => `已选 ${n} 个时段`],
    [/^(\d+) slots · (\d+) input days$/, (_, n, d) => `${n} 个时段 · ${d} 个输入日`],
    [/^(\d+) slots$/, (_, n) => `${n} 个时段`],
    [/^(\d+) changed$/, (_, n) => `${n} 人顺序有变`],
    [/^(\d+) slots · Edit$/, (_, n) => `${n} 个时段 · 编辑`],
    [/^Group (\d+)$/, (_, n) => `分组 ${n}`],
    [/^Before (.+)$/, (_, name) => `在 ${name} 之前`],
    [/^In (.+)$/, (_, name) => `属于 ${name}`],
    [/^Input date for day (\d+)$/, (_, n) => `第 ${n} 天的输入日期`],
    [/^Time interpretation for day (\d+)$/, (_, n) => `第 ${n} 天的时间格式`],
    [/^Start time for day (\d+)$/, (_, n) => `第 ${n} 天开始时间`],
    [/^Select (.+), day (\d+), (.+)$/, (_, name, n, time) => `选择 ${name}，第 ${n} 天，${time}`],
    [/^(.+), day (\d+), (.+)$/, (_, name, n, time) => `${name}，第 ${n} 天，${time}`],
    [/^Imported (\d+) slots\. This week’s schedule is ready to adjust\.$/, (_, n) => `已导入 ${n} 个时段，可以调整本周日程。`],
    [/^Moved (\d+) slots to day (\d+)\. Times have been recalculated\.$/, (_, n, d) => `已将 ${n} 个时段移至第 ${d} 天，时间已重新计算。`],
    [/^Daily slots: (.+) · Matches the daily targets\.$/, (_, counts) => `每天时段数：${counts} · 符合目标数量。`],
    [/^Daily slots: (.+) · Original target: (.+)\. Groups and manual moves take priority\.$/, (_, counts, targets) => `每天时段数：${counts} · 原目标：${targets}。优先保留分组和手动调整。`],
    [/^Day (\d+): choose a valid start time\.$/, (_, n) => `第 ${n} 天：请选择有效的开始时间。`],
    [/^Day (\d+) extends past midnight\. Start earlier, shorten slots, or move slots to another day\.$/, (_, n) => `第 ${n} 天超过午夜。请提前开始、缩短时段或将时段移至其他日期。`],
    [/^Row (\d+): (.+)$/, (_, n, text) => `第 ${n} 行：${t(text)}`],
    [/^Invalid date “(.*)”\.(.*)$/, (_, value) => `无效日期“${value}”，请使用 Sep 28, 2026 或 YYYY-MM-DD。`],
    [/^Invalid time “(.*)”\.(.*)$/, (_, value) => `无效时间“${value}”，请使用 4:00 PM 或 16:00。`],
    [/^Line (\d+): expected a DAY heading or “4:00–4:10 Presenter”\.$/, (_, n) => `第 ${n} 行：应为 DAY 标题或“4:00–4:10 报告人”。`],
  ];
  Object.assign(zh, { 'expected Day, Start, End, Presenter columns.': '应包含日期、开始、结束、报告人四列。', 'day, start, end, and presenter are required.': '日期、开始、结束和报告人不能为空。' });
  function t(value) {
    const source = String(value);
    if (language === 'en') return source;
    if (zh[source]) return zh[source];
    for (const [pattern, render] of patterns) { const match = pattern.exec(source); if (match) return render(...match); }
    return source;
  }
  const staticText = [], staticAttributes = [];
  function bindStatic() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.textContent.trim() && !['SCRIPT', 'STYLE', 'TEXTAREA'].includes(node.parentElement.tagName)) staticText.push({ node, source: node.textContent });
    }
    document.querySelectorAll('[aria-label],[placeholder],[title]').forEach(element => {
      for (const attr of ['aria-label', 'placeholder', 'title']) if (element.hasAttribute(attr)) staticAttributes.push({ element, attr, source: element.getAttribute(attr) });
    });
    apply();
  }
  function apply() {
    document.documentElement.lang = language;
    document.documentElement.dataset.theme = theme;
    document.title = language === 'zh-CN' ? 'Nextweek — 日程排期工具' : 'Nextweek — Schedule reshuffler';
    for (const item of staticText) if (item.node.isConnected) item.node.textContent = item.source.replace(/\S[\s\S]*\S|\S/, text => t(text));
    for (const { element, attr, source } of staticAttributes) element.setAttribute(attr, t(source));
    document.getElementById('ui-language').value = language;
    document.getElementById('ui-theme').value = theme;
    document.getElementById('ui-time-format').value = timeFormat;
  }
  window.I18n = { t, bindStatic, get language() { return language; }, get theme() { return theme; }, get timeFormat() { return timeFormat; },
    setLanguage(value) { language = value === 'zh-CN' ? 'zh-CN' : 'en'; try { localStorage.setItem('nextweek-language', language); } catch (_) {} apply(); },
    setTheme(value) { theme = themes.includes(value) ? value : 'light'; try { localStorage.setItem('nextweek-theme', theme); } catch (_) {} apply(); },
    setTimeFormat(value) { timeFormat = value === '12' ? '12' : '24'; try { localStorage.setItem('nextweek-time-format', timeFormat); } catch (_) {} apply(); },
  };
})();
