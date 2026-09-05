/* ============================================================
   MTA DevDashboard — permissions.js
   Page registry + access rules + sidebar/nav helpers.
   ============================================================ */
(function (global) {
  'use strict';
  var MTA = (global.MTA = global.MTA || {});
  var P = {};

  /* id: route key.  section: 'main' | 'system'.
     superOnly: only Super Admins may access. */
  var PAGES = [
    { id: 'dashboard', label: 'Dashboard', icon: 'ic-dashboard', section: 'main', color: 'accent' },
    { id: 'projects', label: 'Projects', icon: 'ic-folder', section: 'main', color: 'info' },
    { id: 'devnote', label: 'DevNote', icon: 'ic-note', section: 'main', color: 'warn' },
    { id: 'tasks', label: 'Tasks', icon: 'ic-tasks', section: 'main', color: 'success' },
    { id: 'activity', label: 'Activity', icon: 'ic-activity', section: 'main', color: 'danger' },
    { id: 'calendar', label: 'Calendar', icon: 'ic-calendar', section: 'main', color: 'info' },
    { id: 'admins', label: 'Admins', icon: 'ic-admins', section: 'system', superOnly: true },
    { id: 'settings', label: 'Settings', icon: 'ic-settings', section: 'system' }
  ];

  P.PAGES = PAGES;

  P.getPage = function (id) {
    for (var i = 0; i < PAGES.length; i++) if (PAGES[i].id === id) return PAGES[i];
    return null;
  };

  /* Access rules. */
  P.canAccess = function (user, pageId) {
    if (!user) return false;
    if (user.role === 'super_admin') return true;
    if (user.status !== 'active') return false;
    var page = P.getPage(pageId);
    if (!page) return false;
    if (page.superOnly) return false;
    var perms = user.permissions || [];
    return perms.indexOf(pageId) >= 0;
  };

  P.isSuper = function (user) {
    return !!user && user.role === 'super_admin';
  };

  /* Pages visible in the sidebar for a user. */
  P.allowedPages = function (user) {
    return PAGES.filter(function (pg) { return P.canAccess(user, pg.id); });
  };

  P.allowedIds = function (user) {
    return P.allowedPages(user).map(function (p) { return p.id; });
  };

  P.hasAdminAccess = function (user) {
    return P.isSuper(user);
  };

  /* Shortcut action -> page id (used by settings shortcuts). */
  P.SHORTCUT_NAV = {
    dashboard: 'dashboard',
    projects: 'projects',
    devnote: 'devnote',
    tasks: 'tasks',
    activity: 'activity',
    calendar: 'calendar',
    settings: 'settings'
  };

  MTA.permissions = P;
})(typeof window !== 'undefined' ? window : this);