/* ============================================================
   MTA DevDashboard -- QA smoke test
   Runs core logic (storage, auth, permissions, CRUD, analytics,
   import/export) in Node with a minimal DOM shim.
   Run:  node qa/smoke.js
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ---------------- Minimal DOM shim ---------------- */
function makeEl(tag) {
  const el = {
    tagName: tag.toUpperCase(),
    _cls: new Set(),
    style: { setProperty() {}, removeProperty() {}, getPropertyValue() { return ''; } },
    dataset: {},
    _attrs: {},
    innerHTML: '',
    textContent: '',
    value: '',
    checked: false,
    disabled: false,
    hidden: false,
    type: '',
    className: '',
    parentNode: null,
    children: [],
    classList: {
      add(c) { el._cls.add(c); },
      remove(c) { el._cls.delete(c); },
      toggle(c, force) { const has = force === undefined ? !el._cls.has(c) : force; if (has) el._cls.add(c); else el._cls.delete(c); return has; },
      contains(c) { return el._cls.has(c); },
      toString() { return Array.from(el._cls).join(' '); }
    },
    setAttribute(k, v) { el._attrs[k] = String(v); if (k === 'class') el.className = String(v); },
    getAttribute(k) { return k in el._attrs ? el._attrs[k] : null; },
    removeAttribute(k) { delete el._attrs[k]; },
    hasAttribute(k) { return k in el._attrs; },
    addEventListener() {},
    removeEventListener() {},
    appendChild(c) { if (c) { c.parentNode = el; el.children.push(c); } return c; },
    removeChild(c) { const i = el.children.indexOf(c); if (i >= 0) el.children.splice(i, 1); c.parentNode = null; return c; },
    remove() { if (el.parentNode) el.parentNode.removeChild(el); },
    querySelector(sel) { return sel.charAt(0) === '#' || sel.charAt(0) === '.' ? makeEl('div') : null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    contains() { return false; },
    focus() {},
    blur() {},
    select() {},
    click() {},
    scrollIntoView() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: 300, height: 200 }; },
    getContext() { return ctxStub; },
    matches() { return false; }
  };
  return el;
}

const ctxStub = new Proxy({}, {
  get(t, k) {
    if (k === 'canvas') return {};
    if (k === 'createLinearGradient') return () => ({ addColorStop() {} });
    return () => {};
  },
  set() { return true; }
});

const elements = {};
function getById(id) {
  if (!elements[id]) elements[id] = makeEl('div');
  return elements[id];
}

const memoryStore = {};
const memorySession = {};

function makeStorage(obj) {
  return {
    get length() { return Object.keys(obj).length; },
    key(i) { return Object.keys(obj)[i] || null; },
    getItem(k) { return k in obj ? obj[k] : null; },
    setItem(k, v) { obj[k] = String(v); },
    removeItem(k) { delete obj[k]; }
  };
}

const fakeDocument = {
  readyState: 'complete',
  documentElement: makeEl('html'),
  body: makeEl('body'),
  head: makeEl('head'),
  createElement: (tag) => makeEl(tag),
  createTextNode: (t) => ({ textContent: String(t) }),
  getElementById: getById,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  removeEventListener() {},
  execCommand() { return true; },
  queryCommandState() { return false; }
};

global.window = global;
global.document = fakeDocument;
global.localStorage = makeStorage(memoryStore);
global.sessionStorage = makeStorage(memorySession);
Object.defineProperty(global, 'navigator', { value: { onLine: true, userAgent: 'node-smoke' }, configurable: true });
global.location = { hash: '' };
global.getComputedStyle = () => ({ getPropertyValue: (name) => ({ '--text-1': '#000', '--text-2': '#555', '--chart-grid': '#ddd' }[name] || '#888') });
global.requestAnimationFrame = (fn) => setTimeout(fn, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.ResizeObserver = class { observe() {} disconnect() {} };
global.matchMedia = () => ({ matches: false, addEventListener() {} });
global.URL.createObjectURL = () => 'blob:fake';
global.URL.revokeObjectURL = () => {};
global.Blob = class { constructor(parts, opts) { this.parts = parts; this.opts = opts; } };
global.FileReader = class {
  readAsText() { this.result = ''; if (this.onload) this.onload(); }
  readAsDataURL() { this.result = 'data:image/png;base64,xx'; if (this.onload) this.onload(); }
};

/* ---------------- Load app scripts (same order as index.html) ---------------- */
const base = path.join(__dirname, '..');
const files = [
  'js/utils.js', 'js/storage.js', 'js/state.js', 'js/permissions.js', 'js/auth.js',
  'js/components/toasts.js', 'js/components/modals.js', 'js/components/charts.js',
  'js/components/editor.js', 'js/modules/activity.js', 'js/modules/dashboard.js',
  'js/modules/projects.js', 'js/modules/devnote.js', 'js/modules/tasks.js',
  'js/modules/calendar.js', 'js/modules/admins.js', 'js/modules/settings.js',
  'js/router.js', 'js/app.js'
];

for (const f of files) {
  const code = fs.readFileSync(path.join(base, f), 'utf8');
  vm.runInThisContext(code, { filename: f });
}

const MTA = global.MTA;

/* ---------------- Assert helpers ---------------- */
let passCount = 0, failCount = 0;
function assert(name, cond, extra) {
  if (cond) { passCount++; console.log('  ok  ' + name); }
  else { failCount++; console.error('  FAIL ' + name + (extra ? ' :: ' + extra : '')); }
}

/* ============================================================
   TEST SUITE
   ============================================================ */
console.log('\n[MTA DevDashboard smoke test]');

/* --- App boot --- */
assert('APP.init ran', typeof MTA.app === 'object');
assert('auth screen shown on boot (no session)', document.getElementById('auth-view').hidden === false);

/* --- Storage seed (initial setup, no default account / demo data) --- */
assert('no users on first boot', MTA.store.users().length === 0);
assert('no demo projects', MTA.store.projects().length === 0);
assert('no demo notes', MTA.store.notes().length === 0);
assert('no demo tasks', MTA.store.tasks().length === 0);
assert('no demo events', MTA.store.events().length === 0);
assert('no demo activity', MTA.store.activity().length === 0);

/* --- Timestamp regression: U.toDate must preserve time-of-day ---
   Stored activity timestamps are ISO 8601 UTC strings. U.toDate must
   keep the exact instant (so displays show the real creation time) and
   must NOT collapse them to midnight. This bug made every Activity
   timestamp appear as 00:00 / "1d ago" regardless of creation time. */
(function () {
  const iso = '2026-09-06T20:10:32.000Z';
  const d = MTA.utils.toDate(iso);
  assert('toDate preserves ISO time-of-day', !!d && d.getUTCFullYear() === 2026 && d.getUTCMonth() === 8 && d.getUTCDate() === 6 && d.getUTCHours() === 20 && d.getUTCMinutes() === 10 && d.getUTCSeconds() === 32);

  const isoMidnight = MTA.utils.toDate('2026-09-06T00:00:00.000Z');
  assert('toDate handles ISO midnight', !!isoMidnight && isoMidnight.getUTCHours() === 0);

  const dateOnly = MTA.utils.toDate('2026-09-06');
  assert('toDate keeps date-only as local midnight', !!dateOnly && dateOnly.getFullYear() === 2026 && dateOnly.getMonth() === 8 && dateOnly.getDate() === 6 && dateOnly.getHours() === 0);

  let threw = null;
  try {
    const f = MTA.utils.fmtDateTime('2026-09-06T20:10:32.000Z');
    /* fmtDateTime formats the stored instant in the LOCAL timezone. We just
       verify it reflects the real time (not collapsed to 00:00): the minutes
       should be 10 (for UTC+14..-9 the local minute stays :10; extreme offsets
       can carry, but it must never be 00:00 as the old bug produced). */
    assert('fmtDateTime uses the stored clock time (not midnight)', typeof f === 'string' && !/T00:00| 00:00/.test(f));
  } catch (e) { threw = e; assert('fmtDateTime does not throw', false, e.message); }
  assert('fmtDateTime does not throw', threw === null);
})();

/* --- Corrupted data handling --- */
localStorage.setItem('mta_projects', '{not valid json');
assert('corruption recovered with fallback', Array.isArray(MTA.store.projects()));

/* --- Auth: initial setup + login --- */
let r = MTA.auth.createFirstAccount({});
assert('setup requires details', r.ok === false && !!r.error);

r = MTA.auth.createFirstAccount({ displayName: 'Super Admin', username: 'admin', password: 'admin123', confirmPassword: 'admin123' });
assert('setup creates first account', r.ok === true);
const seededAdmin = MTA.store.users().find(u => u.username === 'admin');
assert('first account is Super Admin', !!seededAdmin && seededAdmin.role === 'super_admin');
assert('first account gets full permissions', Array.isArray(seededAdmin.permissions) && seededAdmin.permissions.length === 8);
assert('password is hashed (no plain text)', typeof seededAdmin.password === 'string' && seededAdmin.password !== 'admin123');

r = MTA.auth.createFirstAccount({ displayName: 'Second User', username: 'user2', password: 'secret123', confirmPassword: 'secret123' });
assert('setup blocked after first account', r.ok === false);

r = MTA.auth.login('admin', 'admin123', false);
assert('login with created account succeeds', r.ok === true);
assert('currentUser set', MTA.state.currentUser && MTA.state.currentUser.username === 'admin');
assert('lastLogin updated', !!MTA.store.users().find(u => u.username === 'admin').lastLogin);

r = MTA.auth.login('admin', 'wrong-password', false);
assert('wrong password fails', r.ok === false);
r = MTA.auth.login('no-user', 'x', false);
assert('unknown user fails', r.ok === false);

/* --- Permissions --- */
assert('super admin can access admins page', MTA.permissions.canAccess(MTA.state.currentUser, 'admins'));
assert('super admin default has 8 pages', MTA.permissions.allowedIds(MTA.state.currentUser).length === 8);
const limited = { role: 'admin', status: 'active', permissions: ['dashboard', 'projects'] };
assert('limited admin sees projects', MTA.permissions.canAccess(limited, 'projects'));
assert('limited admin denied admins', MTA.permissions.canAccess(limited, 'admins') === false);
assert('deactivated denied', MTA.permissions.canAccess({ role: 'admin', status: 'deactivated', permissions: ['dashboard'] }, 'dashboard') === false);

/* --- Admin CRUD --- */
const newAdmin = MTA.admins.create({ username: 'jane', displayName: 'Jane Dev', password: 'secret123', role: 'admin', permissions: ['projects', 'tasks'] });
assert('admin created', !!newAdmin && MTA.admins.get(newAdmin.id).username === 'jane');
assert('username taken detected', MTA.auth.usernameTaken('jane') === true);
assert('username self excluded', MTA.auth.usernameTaken('jane', newAdmin.id) === false);
assert('password is hashed', MTA.admins.get(newAdmin.id).password !== 'secret123');
const updAdmin = MTA.admins.update(newAdmin.id, { displayName: 'Jane Reborn' });
assert('admin updated', updAdmin.displayName === 'Jane Reborn');
MTA.admins.update(seededAdmin.id, { role: 'admin', status: 'deactivated' });
assert('last super admin protected', MTA.admins.get(seededAdmin.id).role === 'super_admin' && MTA.admins.get(seededAdmin.id).status === 'active');
const delAdmin = MTA.admins.remove(newAdmin.id);
assert('admin deleted', delAdmin.ok === true && !MTA.admins.get(newAdmin.id));
assert('cannot delete self', MTA.admins.remove(seededAdmin.id).ok === false);

/* --- Projects CRUD --- */
const beforeP = MTA.store.projects().length;
const prj = MTA.projects.create({ name: 'Smoke Project', status: 'Development', progress: 30 });
assert('project created', MTA.projects.get(prj.id).name === 'Smoke Project');
assert('project list grew', MTA.projects.list().length === beforeP + 1);
MTA.projects.update(prj.id, { progress: 55, favorite: true });
assert('project updated', MTA.projects.get(prj.id).progress === 55 && MTA.projects.get(prj.id).favorite === true);
MTA.projects.toggleFavorite(prj.id);
assert('favorite toggled', MTA.projects.get(prj.id).favorite === false);
MTA.projects.remove(prj.id);
assert('project removed', !MTA.projects.get(prj.id) && MTA.projects.list().length === beforeP);

/* --- Tasks CRUD --- */
const t1 = MTA.tasks.create({ title: 'Smoke Task', priority: 'High', status: 'Todo', dueDate: MTA.utils.todayStr() });
assert('task created', MTA.tasks.get(t1.id).title === 'Smoke Task');
MTA.tasks.toggleDone(t1.id);
assert('task completed', MTA.tasks.get(t1.id).status === 'Done' && !!MTA.tasks.get(t1.id).completedAt);
MTA.tasks.update(t1.id, { status: 'In Progress' });
assert('reopen clears completedAt', MTA.tasks.get(t1.id).completedAt === null);
MTA.tasks.remove(t1.id);
assert('task removed', !MTA.tasks.get(t1.id));

/* --- DevNote CRUD --- */
const n1 = MTA.devnote.create({ title: 'Smoke Note', content: '<p>Hello</p>' });
assert('note created', MTA.devnote.get(n1.id).title === 'Smoke Note');
MTA.devnote.update(n1.id, { pinned: true, category: 'Research' });
assert('note pinned + categorised', MTA.devnote.get(n1.id).pinned === true && MTA.devnote.get(n1.id).category === 'Research');
MTA.devnote.togglePin(n1.id);
assert('note unpinned via toggle', MTA.devnote.get(n1.id).pinned === false);
MTA.devnote.toggleFav(n1.id);
assert('note favorited via toggle', MTA.devnote.get(n1.id).favorite === true);
MTA.devnote.toggleFav(n1.id);
assert('note unfavorited via toggle', MTA.devnote.get(n1.id).favorite === false);
const dup = MTA.devnote.duplicate(n1.id);
assert('note duplicated', !!dup && dup.title.indexOf('(copy)') >= 0 && dup.id !== n1.id);
assert('duplicate is a copy with pin cleared', dup.title.indexOf(n1.title) === 0 && dup.pinned === false);
MTA.devnote.remove(n1.id); MTA.devnote.remove(dup.id);
assert('notes deleted', !MTA.devnote.get(n1.id) && !MTA.devnote.get(dup.id));

/* --- Calendar --- */
const day = MTA.utils.todayStr();
const ev1 = MTA.calendar.create({ title: 'Smoke Event', start: day, end: day, allDay: true, color: 3 });
assert('event created', MTA.calendar.get(ev1.id).title === 'Smoke Event');
const onDay = MTA.calendar.eventsOn(MTA.utils.parseDay(day));
assert('event on its day', onDay.some(x => x.id === ev1.id));
MTA.calendar.update(ev1.id, { color: 5 });
assert('event colour updated', MTA.calendar.get(ev1.id).color === 5);
MTA.calendar.remove(ev1.id);
assert('event removed', !MTA.calendar.get(ev1.id));

/* --- Activity --- */
const actBefore = MTA.store.activity().length;
MTA.activity.track('qa', 'Synthetic test event', { qa: true });
assert('activity tracked', MTA.store.activity().length === actBefore + 1);
assert('7d filter returns array', Array.isArray(MTA.activity.filter('7d')));
assert('today filter returns array', Array.isArray(MTA.activity.filter('today')));

/* --- Settings & theme --- */
MTA.state.saveSettings(MTA.state.settings);
assert('settings persisted', !!MTA.store.settings().appearance);
MTA.state.setTheme('charcoal', { persist: true });
assert('theme persisted to charcoal', MTA.store.theme() === 'charcoal' && MTA.state.theme === 'charcoal');
MTA.state.setTheme('ivory', { persist: true });
assert('theme back to ivory', MTA.state.theme === 'ivory');

/* --- Export / Import --- */
const exported = MTA.store.exportAll();
assert('export shape correct', exported.app === 'mta-devdashboard' &&
  Array.isArray(exported.users) && Array.isArray(exported.projects) && Array.isArray(exported.notes) &&
  Array.isArray(exported.tasks) && Array.isArray(exported.events) && Array.isArray(exported.activity) &&
  !!exported.settings && !!exported.theme);

let v = MTA.store.validateImport({ app: 'mta-devdashboard' });
assert('import missing arrays rejected', v.ok === false);
v = MTA.store.validateImport(exported);
assert('valid backup passes', v.ok === true);

MTA.store.saveProjects([]);
MTA.store.saveNotes([]);
const imp = MTA.store.importAll(exported);
assert('import restores data', imp.ok === true && MTA.store.projects().length === exported.projects.length);
assert('import clears session', MTA.store.session() === null);

/* --- Clear selected --- */
MTA.store.clearSelected(['tasks', 'events']);
assert('clear selected empties collections', MTA.store.tasks().length === 0 && MTA.store.events().length === 0);

/* --- Reset --- */
MTA.store.resetApplication();
assert('reset clears users', MTA.store.users().length === 0);
assert('reset clears demo data', MTA.store.projects().length === 0 && MTA.store.notes().length === 0 &&
  MTA.store.tasks().length === 0 && MTA.store.events().length === 0 && MTA.store.activity().length === 0);
assert('reset does not recreate default admin', MTA.store.users().find(u => u.username === 'admin') === undefined);
r = MTA.auth.createFirstAccount({ displayName: 'Super Admin', username: 'admin', password: 'admin123', confirmPassword: 'admin123' });
assert('setup works after reset', r.ok === true);

/* --- Password change --- */
let pw = MTA.auth.changePassword(MTA.store.users()[0], 'admin123', 'newpass6');
assert('change password ok', pw.ok === true);
let lw = MTA.auth.login('admin', 'newpass6', false);
assert('login with new password', lw.ok === true);
MTA.auth.changePassword(lw.user, 'newpass6', 'admin123');
assert('password restore works', MTA.auth.login('admin', 'admin123', false).ok === true);
MTA.auth.logout();
assert('logout clears session', MTA.auth.resume() === null);

/* --- Session persistence --- */
MTA.auth.login('admin', 'admin123', true);
assert('remembered session in localStorage', MTA.store.session() !== null);

/* --- Charts & dashboard compute (no throw) --- */
try {
  const m = document.getElementById('app-main');
  MTA.dashboard.render(m);
  assert('dashboard renders without throwing', m.innerHTML.indexOf('data-page="dashboard"') >= 0);
} catch (e) {
  assert('dashboard renders without throwing', false, e.message);
}

/* --- Every module renders without throwing (with app context) --- */
MTA.auth.login('admin', 'admin123', false);
MTA.state.currentUser = MTA.store.users().find(u => u.username === 'admin');
const pageChecks = [
  ['projects', MTA.projects],
  ['devnote', MTA.devnote],
  ['tasks', MTA.tasks],
  ['activity', MTA.activity],
  ['calendar', MTA.calendar],
  ['admins', MTA.admins]
];
for (const [name, mod] of pageChecks) {
  try {
    const m = document.getElementById('app-main');
    mod.render(m);
    assert('module renders: ' + name, m.innerHTML.indexOf('data-page="' + name + '"') >= 0);
  } catch (e) {
    assert('module renders: ' + name, false, e.stack || e.message);
  }
}

/* settings render (several sub-sections) */
try {
  const m = document.getElementById('app-main');
  MTA.settings.render(m);
  assert('settings renders', m.innerHTML.indexOf('data-page="settings"') >= 0);
} catch (e) {
  assert('settings renders', false, e.stack || e.message);
}

/* --- Modals regression ---
   Admin/Projects/Tasks New/Edit/Delete all route through
   MO.open / MO.confirm. They used to throw a ReferenceError
   (undeclared `footEl`) rendering the buttons dead. */
(function () {
  const body = MTA.utils.el('div', { class: 'modal-body-content' });

  let api = null;
  let threw = null;
  try {
    api = MTA.modal.open({
      title: 'Regression form',
      body: body,
      actions: [
        { label: 'Cancel', cls: 'btn-ghost', click: () => true },
        { label: 'Save', cls: 'btn-primary', click: () => true }
      ]
    });
  } catch (e) {
    threw = e;
  }
  assert('MO.open with actions does not throw', threw === null, threw && threw.message);
  assert('MO.open returns modal API', !!(api && api.element && typeof api.close === 'function'));
  if (api) {
    try { api.close(); assert('closing modal does not throw', true); }
    catch (e) { assert('closing modal does not throw', false, e.message); }
  }

  threw = null;
  try {
    MTA.modal.confirm({ title: 'Confirm?', message: 'Delete item?', danger: true }).then(() => {});
    assert('MO.confirm does not throw', true);
  } catch (e) {
    assert('MO.confirm does not throw', false, e.message);
  }

  threw = null;
  try {
    MTA.modal.prompt({ title: 'Prompt', label: 'Value' }).then(() => {});
    assert('MO.prompt does not throw', true);
  } catch (e) {
    assert('MO.prompt does not throw', false, e.message);
  }

  /* Drawer still works (uses its own footEl declaration) */
  threw = null;
  try {
    const d = MTA.modal.drawer({ title: 'Details', body: MTA.utils.el('div', {}), footer: '<button>Edit</button>' });
    assert('MO.drawer returns drawer API', !!(d && typeof d.close === 'function'));
    d.close();
  } catch (e) {
    assert('MO.drawer does not throw', false, e.message);
  }
  /* Drawer footer handled too. Footer buttons live in the drawer FOOT,
     not the body — onMount must be able to reach them, otherwise
     Edit/Delete buttons were rendered dead (calendar & projects bug). */
  threw = null;
  try {
    const d = MTA.modal.drawer({
      title: 'Footer regression',
      body: MTA.utils.el('div', {}),
      footer: '<button id="drw-edit">Edit</button><button id="drw-del">Delete</button>',
      onMount(a) {
        if (!a || !a.footer) throw new Error('drawer api missing footer element');
        if (!a.element || !a.body || typeof a.close !== 'function') throw new Error('drawer api incomplete');
        MTA.utils.$('#drw-edit', a.footer).addEventListener('click', () => {});
        MTA.utils.$('#drw-del', a.footer).addEventListener('click', () => {});
      }
    });
    if (!(d && d.footer)) throw new Error('drawer api missing footer element');
    d.close();
  } catch (e) {
    threw = e;
  }
  assert('MO.drawer footer wiring does not throw', threw === null, threw && threw.message);
})();

/* --- Summary --- */
console.log('\n' + (failCount === 0 ? 'ALL PASSED' : failCount + ' FAILED') + '  (' + passCount + ' passed, ' + failCount + ' failed)\n');
process.exit(failCount === 0 ? 0 : 1);