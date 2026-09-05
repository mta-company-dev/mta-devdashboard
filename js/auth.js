/* ============================================================
   MTA DevDashboard - auth.js
   Client-side auth (localStorage / sessionStorage).
   NOT server-grade security - private single-machine use only.
   ============================================================ */
(function (global) {
  'use strict';
  var MTA = (global.MTA = global.MTA || {});
  var U = MTA.utils;
  var A = {};

  var SESSION_KEY = 'mta_session';

  function writeSession(sess, remember) {
    try {
      var json = JSON.stringify(sess);
      if (remember) {
        window.sessionStorage.removeItem(SESSION_KEY);
        window.localStorage.setItem(SESSION_KEY, json);
      } else {
        window.localStorage.removeItem(SESSION_KEY);
        window.sessionStorage.setItem(SESSION_KEY, json);
      }
      return true;
    } catch (e) { return false; }
  }

  function readSession() {
    try {
      var raw = window.sessionStorage.getItem(SESSION_KEY);
      if (raw == null) raw = window.localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function clearSession() {
    try {
      window.localStorage.removeItem(SESSION_KEY);
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch (e) { /* ignore */ }
  }

  function track(type, action, userId, extra) {
    if (MTA.activity && MTA.activity.track) {
      MTA.activity.track(type, action, extra, userId);
    } else if (MTA.store) {
      var act = MTA.store.activity();
      act.push({
        id: U.uid('act'), type: type, action: action,
        userId: userId || null, timestamp: new Date().toISOString()
      });
      MTA.store.saveActivity(act);
    }
  }

  /* ---------- User helpers ---------- */
  A.getUserById = function (id) {
    var list = MTA.store.users();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };

  A.findByUsername = function (username) {
    var n = String(username || '').trim().toLowerCase();
    if (!n) return null;
    var list = MTA.store.users();
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].username || '').toLowerCase() === n) return list[i];
    }
    return null;
  };

  A.usernameTaken = function (username, excludeId) {
    var u = A.findByUsername(username);
    return !!u && u.id !== excludeId;
  };

  /* ---------- Login / logout ---------- */
  A.login = function (username, password, remember) {
    var user = A.findByUsername(username);
    if (!user) return { ok: false, error: 'Unknown username.' };
    if (user.status !== 'active') return { ok: false, error: 'This admin account is deactivated.' };
    if (!user.password || U.hashPassword(String(password || '')) !== user.password) {
      return { ok: false, error: 'Incorrect password.' };
    }
    var now = new Date();
    user.lastLogin = now.toISOString();
    var users = MTA.store.users();
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === user.id) users[i].lastLogin = user.lastLogin;
    }
    MTA.store.saveUsers(users);

    var sess = { userId: user.id, token: U.randToken(), loginAt: now.toISOString(), remember: !!remember };
    writeSession(sess, remember);
    MTA.state.setUser(user);
    track('login', 'Signed in to the dashboard', user.id);
    return { ok: true, user: user };
  };

  A.logout = function () {
    var u = MTA.state.currentUser;
    var sess = readSession();
    var extra = null;
    if (sess && sess.loginAt && u) {
      extra = { durationMs: Math.max(0, Date.now() - new Date(sess.loginAt).getTime()) };
    }
    track('logout', 'Signed out of the dashboard', u ? u.id : null, extra);
    clearSession();
    MTA.state.setUser(null);
  };
  /* ---------- Session resume ---------- */
  A.resume = function () {
    var sess = readSession();
    if (!sess || !sess.userId) return null;
    var user = A.getUserById(sess.userId);
    if (!user || user.status !== 'active') {
      clearSession();
      return null;
    }
    MTA.state.setUser(user);
    return user;
  };

  A.currentSession = function () { return readSession(); };

  A.destroySession = function () { clearSession(); MTA.state.setUser(null); };

  /* ---------- Lock / unlock ---------- */
  A.lock = function () {
    MTA.state.locked = true;
    if (MTA.app && MTA.app.showAuth) MTA.app.showAuth('lock');
  };

  A.unlock = function (password) {
    var u = MTA.state.currentUser;
    if (!u) return { ok: false, error: 'No active session.' };
    if (U.hashPassword(String(password || '')) !== u.password) {
      return { ok: false, error: 'Incorrect password.' };
    }
    MTA.state.locked = false;
    if (MTA.app && MTA.app.hideAuth) MTA.app.hideAuth();
    return { ok: true };
  };

  A.isLocked = function () { return !!MTA.state.locked; };

  /* ---------- Passwords ---------- */
  A.changePassword = function (user, current, next) {
    if (!user || U.hashPassword(String(current || '')) !== user.password) {
      return { ok: false, error: 'Current password is incorrect.' };
    }
    if (String(next || '').length < 6) {
      return { ok: false, error: 'New password must be at least 6 characters.' };
    }
    return A.setPassword(user.id, next);
  };

  A.setPassword = function (id, newPw) {
    var users = MTA.store.users();
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === id) {
        users[i].password = U.hashPassword(String(newPw || ''));
        users[i].mustChange = false;
        MTA.store.saveUsers(users);
        return { ok: true };
      }
    }
    return { ok: false, error: 'Admin not found.' };
  };

  MTA.auth = A;
})(typeof window !== 'undefined' ? window : this);