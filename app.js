'use strict';

const paths = {
  tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-5.8 5.8a2.1 2.1 0 0 0 3 3l5.8-5.8a4 4 0 0 0 5.4-5.4l-2.4 2.4-3-3z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18m-13 5h2m4 0h2"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2m2-15a3 3 0 0 1 0 6m1 3a4 4 0 0 1 3 4v2"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
document.querySelectorAll('[data-icon]').forEach(element => element.innerHTML = icon(element.dataset.icon));
const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);
const pad = number => String(number).padStart(2, '0');
const dateKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const localDate = key => new Date(`${key}T12:00:00`);
function offsetDate(key, days) {
  const date = localDate(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}
const today = () => dateKey(new Date());
const time = minutes => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
const minutes = value => {
  const [hours, mins] = value.split(':').map(Number);
  return hours * 60 + mins;
};
const interval = (start, end) => `${time(start)}–${time(end)}`;
const formatDate = new Intl.DateTimeFormat('ru-RU', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
const initials = name => name.trim().split(/\s+/).slice(0, 2).map(word => Array.from(word)[0]).join('').toUpperCase();
const storageKey = 'avtopost-v1';

function demoData() {
  const mechanics = [{id:'m1', name:'Илья Соколов'}, {id:'m2', name:'Максим Орлов'}];
  const shifts = {};
  const day = today();
  for (let index = 0; index < 7; index++) {
    shifts[offsetDate(day, index)] = {
      m1: {start:540, end:1080},
      m2: index === 1 ? {off:true} : {start:600, end:1140}
    };
  }
  const visits = [
    ['m1',540,60,'Анна Волкова','00000000001','Kia Rio','А123АА 00','Замена масла'],
    ['m1',660,60,'Денис Лебедев','00000000002','Hyundai Solaris','В234ВВ 00','Диагностика подвески'],
    ['m1',780,120,'Олег Миронов','00000000003','Škoda Octavia','Е345ЕЕ 00','Замена тормозных колодок'],
    ['m2',600,120,'Мария Белова','00000000004','Renault Duster','К456КК 00','Плановое ТО'],
    ['',720,60,'Павел Смирнов','00000000005','Volkswagen Polo','','Осмотр перед ремонтом']
  ].map(([mechanic,start,duration,client,phone,car,plate,reason], index) =>
    ({id:`demo-${index}`, date:day, mechanic, start, duration, client, phone, car, plate, reason}));
  return {mechanics, shifts, visits};
}

let data;
let storageError = '';
try {
  const saved = localStorage.getItem(storageKey);
  data = saved ? JSON.parse(saved) : demoData();
  if (!saved) localStorage.setItem(storageKey, JSON.stringify(data));
} catch {
  data ??= demoData();
  storageError = 'Хранилище браузера недоступно. Изменения могут пропасть после обновления.';
}
let selectedDate = today();
const editor = $('#editor');
const dialog = $('#dialog');
let toastTimer;
function notify(message) {
  $('#toast').textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').textContent = '', 4500);
}
function save(message) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
    storageError = '';
  } catch {
    storageError = 'Хранилище браузера недоступно. Изменения могут пропасть после обновления.';
  }
  dialog.close();
  render();
  notify(storageError || message);
}

const shiftFor = (date, mechanic) => data.shifts[date]?.[mechanic];
const overlaps = (start, end, visit) => start < visit.start + visit.duration && end > visit.start;
function shiftProblem(visit) {
  if (!visit.mechanic) return '';
  const shift = shiftFor(visit.date, visit.mechanic);
  if (!shift) return 'Смена не задана';
  if (shift.off) return 'У механика выходной';
  if (visit.start < shift.start || visit.start + visit.duration > shift.end) return 'Запись выходит за границы смены';
  return '';
}
function shiftText(shift) {
  if (!shift) return 'Смена не задана';
  return shift.off ? 'Выходной' : interval(shift.start, shift.end);
}
function dayBounds(visits) {
  const shifts = Object.values(data.shifts[selectedDate] || {}).filter(shift => !shift.off);
  const start = Math.min(540, ...shifts.map(shift => shift.start), ...visits.map(visit => visit.start));
  const end = Math.max(1140, ...shifts.map(shift => shift.end), ...visits.map(visit => visit.start + visit.duration));
  return [Math.floor(start / 60) * 60, Math.ceil(end / 60) * 60];
}

function renderCalendar() {
  const visits = data.visits.filter(visit => visit.date === selectedDate);
  const [start, end] = dayBounds(visits);
  const lanes = [...data.mechanics];
  if (lanes.length !== 1 || visits.some(visit => !visit.mechanic)) lanes.push({id:'', name:'Без назначения'});
  const headings = lanes.map(({id, name}, index) => {
    const shift = shiftFor(selectedDate, id);
    const tone = id ? (index % 2 ? 'blue' : '') : 'gray';
    const detail = id ? shiftText(shift) : 'Механик не выбран';
    return `<div class="column-head"><span class="avatar ${tone}">${id ? escapeHtml(initials(name)) : icon('clock')}</span><div><strong>${escapeHtml(name)}</strong><small class="${shift?.off ? 'day-off' : ''}">${detail}</small></div></div>`;
  }).join('');
  const ticks = Array.from({length:(end - start) / 60}, (_, index) => `<span class="tick">${time(start + index * 60)}</span>`).join('');
  const total = end - start;
  const position = (from, to) => `top:${(from - start) / total * 100}%;height:${(to - from) / total * 100}%`;
  const columns = lanes.map(({id, name}, index) => {
    const shift = shiftFor(selectedDate, id);
    const active = !id || (shift && !shift.off);
    const from = !id ? start : shift?.start;
    const to = !id ? end : shift?.end;
    const laneVisits = visits.filter(visit => visit.mechanic === id).sort((a,b) => a.start - b.start);
    const unavailable = (a,b) => a < b ? `<div class="unavailable" style="${position(a,b)}"></div>` : '';
    let slots = '';
    if (active) {
      for (let at = from; at < to; at += 30) {
        const until = Math.min(at + 30, to);
        if (id && laneVisits.some(visit => overlaps(at, until, visit))) continue;
        if (until - at < 15) continue;
        const duration = [60,120].filter(length => at + length <= to &&
          (!id || !laneVisits.some(visit => overlaps(at, at + length, visit))));
        const description = `${name}, ${time(at)}${duration.length ? `, свободно на ${duration.includes(120) ? '1 или 2 часа' : '1 час'}` : ''}`;
        slots += `<button type="button" class="slot ${id && duration.length ? (duration.includes(120) ? 'roomy' : 'one-hour') : ''}" style="${position(at,until)}" data-slot="${at}" data-mechanic="${id}" title="${escapeHtml(description)}" aria-label="${escapeHtml(description)}">${icon('plus')}</button>`;
      }
    }
    // Assign adjacent columns to simultaneous unassigned visits.
    const groups = [];
    for (const visit of laneVisits) {
      const group = groups.at(-1);
      if (!group || visit.start >= group.end) {
        groups.push({visits:[visit], end:visit.start + visit.duration});
      } else {
        group.visits.push(visit);
        group.end = Math.max(group.end, visit.start + visit.duration);
      }
    }
    const cards = groups.map(group => {
      const ends = [];
      const placed = group.visits.map(visit => {
        let column = ends.findIndex(value => value <= visit.start);
        if (column === -1) column = ends.length;
        ends[column] = visit.start + visit.duration;
        return {visit,column};
      });
      return placed.map(({visit,column}) => {
        const problem = shiftProblem(visit);
        const tone = problem ? 'warning' : !id ? 'pending' : index % 2 ? 'green' : '';
        const title = visit.car || visit.client || 'Запись клиента';
        const detail = problem ? `⚠ ${problem}` : visit.reason || visit.client;
        const width = 100 / ends.length;
        const period = interval(visit.start, visit.start + visit.duration);
        return `<button class="visit ${tone} ${visit.duration < 45 ? 'short' : ''}" type="button" data-visit="${visit.id}" style="${position(visit.start,visit.start + visit.duration)};left:calc(${column * width}% + 4px);width:calc(${width}% - 8px);height:calc(${visit.duration / total * 100}% - 3px);transform:translateY(1px)" title="${escapeHtml([period,title,detail].join(' · '))}"><span class="visit-time">${problem ? '⚠ ' : ''}${period}</span><strong>${escapeHtml(title)}</strong><span class="visit-detail">${escapeHtml(detail)}</span></button>`;
      }).join('');
    }).join('');
    return `<div class="lane">${active ? unavailable(start,from) + unavailable(to,end) : unavailable(start,end)}${slots}${cards}</div>`;
  }).join('');
  $('#content').innerHTML = `<div class="calendar-scroll" tabindex="0" aria-label="Расписание по времени"><div class="calendar-grid" style="--columns:${lanes.length};--hours:${total / 60}"><div class="column-head time-head">Время</div>${headings}<div class="times">${ticks}</div>${columns}</div></div>`;
}

function renderShifts() {
  const rows = data.mechanics.map((mechanic, index) => {
    const shift = shiftFor(selectedDate, mechanic.id);
    return `<div class="shift-row"><span class="avatar ${index % 2 ? 'blue' : ''}">${escapeHtml(initials(mechanic.name))}</span><div><strong>${escapeHtml(mechanic.name)}</strong><small>${shiftText(shift)}</small></div><button type="button" class="button" data-shift="${mechanic.id}">${shift ? 'Изменить' : 'Задать смену'}</button></div>`;
  }).join('');
  $('#content').innerHTML = `<div class="shift-list">${rows || '<p class="empty">Добавьте первого механика.</p>'}</div>`;
}
function render() {
  const inShifts = location.hash === '#shifts';
  const scroller = $('.calendar-scroll');
  const previousPosition = scroller ? [scroller.scrollLeft, scroller.scrollTop] : [0, 0];
  document.querySelectorAll('[data-nav]').forEach(link => {
    if ((link.dataset.nav === 'shifts') === inShifts) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
  $('#title').textContent = inShifts ? 'Табель механиков' : 'Календарь записи';
  if (inShifts) {
    $('#subtitle').textContent = 'Смены и выходные на выбранную дату';
  } else {
    const working = data.mechanics.filter(({id}) => {
      const shift = shiftFor(selectedDate, id);
      return shift && !shift.off;
    }).length;
    const count = data.visits.filter(visit => visit.date === selectedDate).length;
    $('#subtitle').textContent = `На смене ${working} из ${data.mechanics.length} · Записей на день ${count}`;
  }
  $('#primary').innerHTML = icon('plus') + (inShifts ? 'Добавить механика' : 'Новая запись');
  $('#legend').hidden = inShifts;
  $('#date').value = selectedDate;
  $('#date-label').textContent = formatDate.format(localDate(selectedDate));
  $('#hint').innerHTML = icon('info') + (storageError || (inShifts
    ? 'Изменения смен сразу появляются в календаре.'
    : 'Нажмите на свободное время для записи или на карточку для переноса.'));
  if (inShifts) renderShifts();
  else {
    renderCalendar();
    $('.calendar-scroll').scrollTo(...previousPosition);
  }
}

const button = (label, className = '', type = 'button') => `<button type="${type}" class="button ${className}">${label}</button>`;
function openEditor(title, fields, submitLabel, onSubmit) {
  editor.innerHTML = `<div class="dialog-head"><h2 id="dialog-title">${title}</h2><button type="button" class="button cancel" aria-label="Закрыть">${icon('close')}</button></div>${fields}<div class="error" role="alert"></div><div class="dialog-actions">${button('Отмена','cancel')}${button(submitLabel,'primary','submit')}</div>`;
  editor.querySelectorAll('.cancel').forEach(control => control.onclick = () => dialog.close());
  editor.onsubmit = event => {
    event.preventDefault();
    editor.querySelector('.error').textContent = onSubmit(new FormData(editor)) || '';
  };
  dialog.setAttribute('aria-labelledby','dialog-title');
  dialog.showModal();
}
const field = (label, markup, wide = false) => `<label class="field ${wide ? 'wide' : ''}"><span>${label}</span>${markup}</label>`;
const input = (name, value, attributes = '') => `<input name="${name}" value="${escapeHtml(value)}" ${attributes}>`;

function editVisit(existing, slot, mechanic = '') {
  const visit = existing || {date:selectedDate, mechanic, start:slot ?? 540, duration:60};
  const problem = existing && shiftProblem(existing);
  const options = [`<option value="">Без назначения</option>`, ...data.mechanics.map(({id,name}) =>
    `<option value="${id}" ${id === visit.mechanic ? 'selected' : ''}>${escapeHtml(name)}</option>`)].join('');
  const durations = [[30,'30 минут'],[60,'1 час'],[90,'1 час 30 минут'],[120,'2 часа']];
  openEditor(existing ? 'Редактировать запись' : 'Новая запись', `
    ${problem ? `<p class="notice">⚠ ${problem}. Выберите подходящее время или другого механика.</p>` : ''}
    <div class="lookup">${field('Поиск машины',input('lookup','','placeholder="Телефон или госномер" maxlength="35"'))}${button('Найти','search')}</div>
    <div class="lookup-results" aria-live="polite"></div>
    <div class="form-grid">
      ${field('Дата',input('date',visit.date,'type="date" required'))}
      ${field('Время',input('start',time(visit.start),'type="time" required'))}
      ${field('Механик',`<select name="mechanic">${options}</select>`)}
      ${field('Длительность',`<select name="duration">${durations.map(([value,label]) => `<option value="${value}" ${value === visit.duration ? 'selected' : ''}>${label}</option>`).join('')}</select>`)}
      ${field('Клиент',input('client',visit.client,'maxlength="70" placeholder="Имя клиента"'))}
      ${field('Телефон',input('phone',visit.phone,'type="tel" maxlength="30" placeholder="Номер телефона"'))}
      ${field('Автомобиль',input('car',visit.car,'maxlength="70" placeholder="Марка и модель"'))}
      ${field('Госномер (если известен)',input('plate',visit.plate,'maxlength="20" placeholder="Например, А123АА 00"'))}
      ${field('Причина визита',input('reason',visit.reason,'maxlength="120" placeholder="Например, замена масла"'),true)}
    </div>`, 'Сохранить запись', values => {
    if (!values.get('date') || !values.get('start')) return 'Укажите дату и время визита.';
    const updated = Object.fromEntries(['date','mechanic','client','phone','car','plate','reason'].map(key => [key,values.get(key).trim()]));
    updated.start = minutes(values.get('start'));
    updated.duration = Number(values.get('duration'));
    updated.id = existing?.id || crypto.randomUUID?.() || 'v-' + Date.now();
    const end = updated.start + updated.duration;
    if (!updated.client && !updated.phone && !updated.car && !updated.plate) return 'Укажите клиента, телефон, автомобиль или госномер.';
    if (end > 1440) return 'Запись должна закончиться до полуночи или ровно в 00:00.';
    const issue = shiftProblem(updated);
    if (issue) return `${issue}. Выберите другое время, другого механика или «Без назначения».`;
    const conflict = updated.mechanic && data.visits.find(other => other.id !== updated.id &&
      other.date === updated.date && other.mechanic === updated.mechanic && overlaps(updated.start,end,other));
    if (conflict) return `Конфликт. Механик уже занят с ${time(conflict.start)} до ${time(conflict.start + conflict.duration)}.`;
    data.visits = existing ? data.visits.map(other => other.id === updated.id ? updated : other) : [...data.visits,updated];
    selectedDate = updated.date;
    save(existing ? 'Изменения записи сохранены' : 'Запись добавлена');
  });
  const lookup = editor.elements.lookup;
  const search = () => {
    const digits = value => value.replace(/\D/g,'').replace(/^[78](?=\d{10}$)/,'');
    const plate = value => value.toUpperCase().replace(/[\s-]/g,'').replace(/[ABEKMHOPCTYX]/g, char =>
      'АВЕКМНОРСТУХ'['ABEKMHOPCTYX'.indexOf(char)]);
    const query = lookup.value.trim();
    const phoneQuery = /^[+\d\s()-]+$/.test(query) ? digits(query) : '';
    const plateQuery = plate(query);
    const results = editor.querySelector('.lookup-results');
    results.replaceChildren();
    if (!query) {
      results.textContent = 'Введите телефон или госномер.';
      return;
    }
    const seen = new Set();
    for (const candidate of [...data.visits].reverse()) {
      const match = (phoneQuery && digits(candidate.phone).includes(phoneQuery)) ||
        (plateQuery && candidate.plate && plate(candidate.plate).includes(plateQuery));
      const key = candidate.plate ? plate(candidate.plate) : [candidate.phone,candidate.car,candidate.client].join('|');
      if (!match || seen.has(key)) continue;
      seen.add(key);
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'button';
      item.textContent = [candidate.car,candidate.plate,candidate.client,candidate.phone].filter(Boolean).join(' · ');
      item.onclick = () => {
        for (const name of ['client','phone','car','plate']) editor.elements[name].value = candidate[name];
        results.replaceChildren();
        lookup.value = '';
      };
      results.append(item);
    }
    if (!seen.size) results.textContent = 'Машина не найдена. Данные можно ввести вручную.';
  };
  editor.querySelector('.search').onclick = search;
  lookup.onkeydown = event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      search();
    }
  };
}

function editShift(mechanic) {
  const shift = shiftFor(selectedDate, mechanic.id);
  const working = !shift?.off;
  openEditor(`Смена · ${escapeHtml(mechanic.name)}`, `<p class="notice">${formatDate.format(localDate(selectedDate))}</p>
    <div class="form-grid">
      ${field('Статус',`<select name="status"><option value="work">Рабочий день</option><option value="off" ${working ? '' : 'selected'}>Выходной</option></select>`,true)}
      ${field('Начало смены',input('from',time(shift?.start ?? 540),'type="time" required'))}
      ${field('Конец смены',input('to',time(shift?.end ?? 1080),'type="time" required'))}
    </div>`, 'Сохранить смену', values => {
    const off = values.get('status') === 'off';
    const start = minutes(values.get('from') || '');
    const end = minutes(values.get('to') || '');
    if (!off && !(start < end)) return 'Конец смены должен быть позже начала.';
    data.shifts[selectedDate] ??= {};
    data.shifts[selectedDate][mechanic.id] = off ? {off:true} : {start,end};
    save('Смена сохранена');
  });
  const toggle = () => {
    for (const name of ['from','to']) {
      const control = editor.elements[name];
      control.disabled = editor.elements.status.value === 'off';
      control.closest('label').hidden = control.disabled;
    }
  };
  editor.elements.status.onchange = toggle;
  toggle();
}
function addMechanic() {
  openEditor('Добавить механика',field('Имя и фамилия',input('name','','required maxlength="60"')), 'Добавить', values => {
    const name = values.get('name').trim();
    if (!name) return 'Укажите имя механика.';
    const id = crypto.randomUUID?.() || 'm-' + Date.now();
    data.mechanics.push({id,name});
    save('Механик добавлен');
    editShift({id,name});
  });
}

$('#content').onclick = event => {
  const control = event.target.closest('button');
  if (!control) return;
  if (control.dataset.visit) editVisit(data.visits.find(visit => visit.id === control.dataset.visit));
  if (control.dataset.slot !== undefined) editVisit(null, Number(control.dataset.slot), control.dataset.mechanic);
  if (control.dataset.shift) editShift(data.mechanics.find(mechanic => mechanic.id === control.dataset.shift));
};
$('#primary').onclick = () => location.hash === '#shifts' ? addMechanic() : editVisit();
$('#previous').onclick = () => {selectedDate = offsetDate(selectedDate,-1); render();};
$('#next').onclick = () => {selectedDate = offsetDate(selectedDate,1); render();};
$('#today').onclick = () => {selectedDate = today(); render();};
$('#date').onchange = event => {
  if (event.target.value) selectedDate = event.target.value;
  render();
};
window.addEventListener('hashchange',render);
render();
