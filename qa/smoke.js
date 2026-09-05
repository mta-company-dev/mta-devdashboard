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

/* --- Storage seed --- */
assert('users seeded', MTA.store.users().length >= 1);
const seededAdmin = MTA.store.users().find(u => u.username === 'admin');
assert('initial admin exists', !!seededAdmin);
assert('initial admin is Super Admin', seededAdmin.role === 'super_admin');
assert('sample projects seeded', MTA.store.projects().length >= 4);
assert('sample notes seeded', MTA.store.notes().length >= 3);
assert('sample tasks seeded', MTA.store.tasks().length >= 5);
assert('sample events seeded', MTA.store.events().length >= 4);
assert('activity seeded', MTA.store.activity().length > 0);

/* --- Corrupted data handling --- */
localStorage.setItem('mta_projects', '{not valid json');
assert('corruption recovered with fallback', Array.isArray(MTA.store.projects()));

/* --- Auth: login --- */
let r = MTA.auth.login('admin', 'admin123', false);
assert('login with admin/admin123 succeeds', r.ok === true);
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
const dup = MTA.devnote.duplicate(n1.id);
assert('note duplicated', !!dup && dup.title.indexOf('(copy)') >= 0 && dup.id !== n1.id);
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
assert('reset reseeds data', MTA.store.users().length === 1 && MTA.store.projects().length >= 4);

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
  assert('MO.drawer does not throw', threw === null);
})();

/* --- Summary --- */
console.log('\n' + (failCount === 0 ? 'ALL PASSED' : failCount + ' FAILED') + '  (' + passCount + ' passed, ' + failCount + ' failed)\n');
process.exit(failCount === 0 ? 0 : 1);