/**
 * auth.js — Authentication module for the UAT Dashboard.
 *
 * Handles login, logout, session restore, and dashboard initialization.
 *
 * Depends on: window.API, window.State, window.UI, window.Utils
 */

(function () {

  // ─── 1. togglePasswordVisibility ─────────────────────────────────────────

  /**
   * Toggles the #loginPassword input between "text" and "password" types
   * and updates the #togglePassword button emoji accordingly.
   */
  function togglePasswordVisibility() {
    var input  = document.getElementById('loginPassword');
    var toggle = document.getElementById('togglePassword');
    if (!input || !toggle) return;

    if (input.type === 'password') {
      input.type      = 'text';
      toggle.textContent = '🙈';
    } else {
      input.type      = 'password';
      toggle.textContent = '👁️';
    }
  }

  // ─── 2. handleLogin ──────────────────────────────────────────────────────

  /**
   * Reads credentials from the login form, validates them, calls the auth
   * API, and on success transitions into the dashboard.
   */
  async function handleLogin() {
    var usernameEl = document.getElementById('loginUsername');
    var passwordEl = document.getElementById('loginPassword');
    var errorEl    = document.getElementById('loginError');
    var btn        = document.getElementById('loginBtn');

    var username = usernameEl ? usernameEl.value.trim() : '';
    var password = passwordEl ? passwordEl.value.trim() : '';

    // Validation
    if (!username || !password) {
      if (errorEl) {
        errorEl.textContent = 'Username and password are required.';
        errorEl.style.display = 'block';
      }
      return;
    }

    if (errorEl) {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }

    // Show loading state
    var originalHTML = '';
    if (btn) {
      originalHTML    = btn.innerHTML;
      btn.disabled    = true;
      btn.innerHTML   = '<span class="spinner"></span> Signing in…';
    }

    try {
      // Use raw fetch for login so we can read the exact error message from the server
      // (the generic API client swallows 401s to handle expired sessions)
      var response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      var data = null;
      try { data = await response.json(); } catch (e) {}

      if (!response.ok || !data || !data.token) {
        var errMsg = (data && data.message) ? data.message : 'Login failed. Please try again.';
        if (errorEl) {
          errorEl.textContent = errMsg;
          errorEl.style.display = 'block';
        }
        var lp = document.getElementById('loginPage');
        var dp = document.getElementById('dashboardPage');
        if (lp) lp.style.display = 'block';
        if (dp) dp.style.display = 'none';
        shakeCard();
        return;
      }

      if (data.token) {
        sessionStorage.setItem('uat_token', data.token);
      }
      if (data.user) {
        sessionStorage.setItem('uat_session', JSON.stringify(data.user));
        window.State.currentUser = data.user;
      } else {
        sessionStorage.setItem('uat_session', JSON.stringify(data));
        window.State.currentUser = data;
      }

      await showDashboard();
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = (err && err.message) ? err.message : 'Login failed. Please try again.';
        errorEl.style.display = 'block';
      }
      var lp2 = document.getElementById('loginPage');
      var dp2 = document.getElementById('dashboardPage');
      if (lp2) lp2.style.display = 'block';
      if (dp2) dp2.style.display = 'none';
      shakeCard();
    } finally {
      if (btn) {
        btn.disabled  = false;
        btn.innerHTML = originalHTML;
      }
    }
  }

  // ─── 3. shakeCard ────────────────────────────────────────────────────────

  /**
   * Briefly animates the .login-card element with a horizontal shake to
   * signal a failed login attempt.
   */
  function shakeCard() {
    // Inject keyframes once
    if (!document.getElementById('shakeKeyframes')) {
      var style = document.createElement('style');
      style.id  = 'shakeKeyframes';
      style.textContent = [
        '@keyframes shake {',
        '  0%,100% { transform: translateX(0); }',
        '  15%      { transform: translateX(-8px); }',
        '  30%      { transform: translateX(8px); }',
        '  45%      { transform: translateX(-6px); }',
        '  60%      { transform: translateX(6px); }',
        '  75%      { transform: translateX(-4px); }',
        '  90%      { transform: translateX(4px); }',
        '}',
      ].join('\n');
      document.head.appendChild(style);
    }

    var card = document.querySelector('.login-card');
    if (!card) return;

    // Remove then re-add to restart the animation if triggered again
    card.style.animation = 'none';
    // Force reflow so removal takes effect before re-applying
    void card.offsetWidth; // eslint-disable-line no-void
    card.style.animation = 'shake 0.5s ease';

    card.addEventListener('animationend', function onEnd() {
      card.style.animation = '';
      card.removeEventListener('animationend', onEnd);
    });
  }

  // ─── 4. showDashboard ────────────────────────────────────────────────────

  /**
   * Transitions from the login page to the dashboard page, configures the
   * sidebar for the current user's role, loads all data, and starts
   * background polling when appropriate.
   */
  async function showDashboard() {
    var loginPage     = document.getElementById('loginPage');
    var dashboardPage = document.getElementById('dashboardPage');
    if (loginPage)     loginPage.style.display     = 'none';
    if (dashboardPage) dashboardPage.style.display = 'block';

    var user = window.State.currentUser;
    if (!user) return;

    var role        = (user.role        || '').toLowerCase();
    var type        = (user.type        || '').toLowerCase();
    var designation = user.designation  || '';
    var name        = user.name || user.username || '';

    var isAdmin   = role === 'admin';
    var isManager = type === 'internal';
    var isExternalManager = (type === 'external' && (!!user.canManageSubUsers || !!user.isOwner || !!user.isPOC));

    // ── Sidebar avatar ───────────────────────────────────────────────────
    var avatarEl = document.getElementById('sidebarAvatar');
    if (avatarEl) {
      avatarEl.className = 'user-avatar'; // Reset classes
      if (isAdmin) {
        avatarEl.classList.add('avatar-admin');
      } else if (isManager) {
        avatarEl.classList.add('avatar-manager');
      } else {
        avatarEl.classList.add('avatar-user');
      }

      if (user.profileImage) {
        avatarEl.innerHTML = '<img src="' + user.profileImage + '" style="width:100%; height:100%; border-radius:inherit; object-fit:cover;">';
      } else {
        avatarEl.textContent = (user.fullName || name).charAt(0).toUpperCase();
      }

      // Open Profile Modal on click
      avatarEl.onclick = function() {
        if (window.Profile && typeof window.Profile.open === 'function') {
          window.Profile.open();
        }
      };
      avatarEl.style.cursor = 'pointer';
    }

    var sidebarNameEl = document.getElementById('sidebarName');
    var sidebarRoleEl = document.getElementById('sidebarRole');
    if (sidebarNameEl) sidebarNameEl.textContent = name;
    if (sidebarRoleEl) sidebarRoleEl.textContent = designation || role;

    // ── Nav visibility ────────────────────────────────────────────────────
    function setVisible(id, visible) {
      var el = document.getElementById(id);
      if (el) el.style.display = visible ? '' : 'none';
    }

    // Dashboard and Files are visible to everyone
    setVisible('navDashboard', true);
    setVisible('navMom',       true);
    setVisible('navSalesforce',true);
    setVisible('navFiles',     true);
    setVisible('navLoginLogs', true);
    setVisible('topHeader',    true);

    if (isAdmin) {
      setVisible('navUsers',         true);
      setVisible('navProjectMgmt',   true);
      setVisible('navPicklists',     true);
      setVisible('navNotifications', true);
      setVisible('navImages',        false);
    } else if (isManager) {
      setVisible('navUsers',         false);
      setVisible('navProjectMgmt',   false);
      setVisible('navPicklists',     false);
      setVisible('navNotifications', true);
      setVisible('navImages',        false);
    } else if (isExternalManager) {
      // External Manager (Client Lead)
      setVisible('navUsers',         true);
      setVisible('navProjectMgmt',   false);
      setVisible('navPicklists',     false);
      setVisible('navNotifications', false);
      setVisible('navImages',        true);
    } else {
      // Normal External User
      setVisible('navUsers',         false);
      setVisible('navProjectMgmt',   false);
      setVisible('navPicklists',     false);
      setVisible('navNotifications', false);
      setVisible('navImages',        true);
    }

    // ── Files specific UI ────────────────────────────────────────────────
    setVisible('adminFileUploadCard', isAdmin);
    var filesBadge = document.getElementById('filesRoleBadge');
    if (filesBadge) {
      filesBadge.textContent = isAdmin ? 'Admin' : (isManager ? 'Internal' : 'User');
      filesBadge.className = 'role-badge ' + (isAdmin ? 'admin' : (isManager ? 'manager' : 'user'));
    }

    // ── Update Branding ──────────────────────────────────────────────────
    window.UI.updateBranding();

    // ── Load data ────────────────────────────────────────────────────────
    window.UI.showLoading('Loading dashboard…');
    try {
      await loadAllData();
      
      // Populate project filters for admins
      if (window.Notifications && typeof window.Notifications.populateProjectFilter === 'function') {
        window.Notifications.populateProjectFilter();
      }

      window.UI.renderDashboard();
      window.UI.hideLoading();
    } catch (err) {
      window.UI.hideLoading();
    }

    // ── Notification polling (admin / manager only) ──────────────────────
    if (window.State.notifPollInterval) {
      clearInterval(window.State.notifPollInterval);
      window.State.notifPollInterval = null;
    }

    if (isAdmin || isManager) {
      window.State.notifPollInterval = setInterval(function () {
        if (window.Notifications && typeof window.Notifications.load === 'function') {
          window.Notifications.load().then(function () {
            updateNotifBadge();
            populateBellDropdown();
            var section = document.getElementById('sectionNotifications');
            if (section && section.classList.contains('active') &&
                typeof window.Notifications.renderTable === 'function') {
              window.Notifications.renderTable();
            }
            var dashSection = document.getElementById('sectionDashboard');
            if (dashSection && dashSection.classList.contains('active') &&
                window.UI && typeof window.UI.renderDashboard === 'function') {
              window.UI.renderDashboard();
            }
          }).catch(function () { /* silently ignore poll errors */ });
        }
      }, 30000);
    }

    // ── Entry polling for external users (notify when admin responds) ────
    if (window.State.entryPollInterval) {
      clearInterval(window.State.entryPollInterval);
      window.State.entryPollInterval = null;
    }

    if (!isAdmin && !isManager) {
      window.State.entryPollInterval = setInterval(function () {
        if (window.Entries && typeof window.Entries.load === 'function') {
          window.Entries.load().then(function () {
            updateUserUnreadBadge();
            var section = document.getElementById('sectionImages');
            if (section && section.classList.contains('active') &&
                typeof window.Entries.render === 'function') {
              window.Entries.render();
            }
          }).catch(function () { /* silently ignore poll errors */ });
        }
      }, 30000);
    }

    // ── Default section ──────────────────────────────────────────────────
    var defaultSection = 'dashboard';
    window.UI.switchSection(defaultSection);
  }

  // ─── 5. loadAllData ──────────────────────────────────────────────────────

  /**
   * Loads all module data in parallel, then triggers each module's render
   * method and updates the notification UI.
   */
  async function loadAllData() {
    var loaders = [];

    if (window.Users         && typeof window.Users.load         === 'function') loaders.push(window.Users.load());
    if (window.Projects      && typeof window.Projects.load      === 'function') loaders.push(window.Projects.load());
    if (window.Entries       && typeof window.Entries.load       === 'function') loaders.push(window.Entries.load());
    if (window.Notifications && typeof window.Notifications.load === 'function') loaders.push(window.Notifications.load());
    if (window.Settings      && typeof window.Settings.load      === 'function') loaders.push(window.Settings.load());
    if (window.Files         && typeof window.Files.load         === 'function') loaders.push(window.Files.load());
    if (window.Picklists     && typeof window.Picklists.load     === 'function') loaders.push(window.Picklists.load());

    await Promise.all(loaders);

    // Render each module (use render() — renderTable() is alias used by some modules)
    if (window.Users         && typeof window.Users.render         === 'function') window.Users.render();
    if (window.Projects      && typeof window.Projects.render      === 'function') window.Projects.render();
    if (window.Entries       && typeof window.Entries.render       === 'function') window.Entries.render();
    if (window.Notifications && typeof window.Notifications.renderTable === 'function') window.Notifications.renderTable();
    if (window.Files         && typeof window.Files.render         === 'function') window.Files.render();
    
    // Populate project selection for admins in Shared Files module
    if (window.State.currentUser && window.State.currentUser.role === 'admin' &&
        window.Files && typeof window.Files.populateProjectSelect === 'function') {
      window.Files.populateProjectSelect();
    }

    // Update notification UI
    updateNotifBadge();
    populateBellDropdown();
  }

  /**
   * Updates the unread badge for external users based on entries where
   * userRead === false (admin has responded but user hasn't seen it yet).
   */
  function updateUserUnreadBadge() {
    var badge = document.getElementById('notifBadge');
    var bellBadge = document.getElementById('bellBadge');
    if (!badge && !bellBadge) return;

    var unread = (window.State.entries || []).filter(function (e) {
      return e.userRead === false;
    }).length;

    [badge, bellBadge].forEach(function (el) {
      if (!el) return;
      el.textContent   = unread > 0 ? String(unread) : '';
      el.style.display = unread > 0 ? 'inline-block' : 'none';
    });
  }

  /**
   * Refreshes the notification badge count in the header.
   * Delegates to window.Notifications.updateBadge when available.
   */
  function updateNotifBadge() {
    if (window.Notifications && typeof window.Notifications.updateBadge === 'function') {
      window.Notifications.updateBadge();
      return;
    }
    // Fallback: count unread notifications stored in State
    var badge = document.getElementById('notifBadge');
    if (!badge) return;
    var unread = (window.State.notifications || []).filter(function (n) { return !n.read; }).length;
    badge.textContent = unread > 0 ? String(unread) : '';
    badge.style.display = unread > 0 ? 'inline-block' : 'none';
  }

  /**
   * Populates the bell dropdown with recent notifications.
   * Delegates to window.Notifications.populateBellDropdown when available.
   */
  function populateBellDropdown() {
    if (window.Notifications && typeof window.Notifications.populateBellDropdown === 'function') {
      window.Notifications.populateBellDropdown();
    }
  }

  // ─── 6. handleLogout ─────────────────────────────────────────────────────

  /**
   * Clears all session data, stops background polling, and returns the user
   * to the login page.
   */
  function handleLogout() {
    // Stop notification polling
    if (window.State.notifPollInterval) {
      clearInterval(window.State.notifPollInterval);
      window.State.notifPollInterval = null;
    }

    // Stop external-user entry polling
    if (window.State.entryPollInterval) {
      clearInterval(window.State.entryPollInterval);
      window.State.entryPollInterval = null;
    }

    // Clear state and storage
    window.State.currentUser = null;
    sessionStorage.removeItem('uat_token');
    sessionStorage.removeItem('uat_session');

    // Show login page, hide dashboard
    var loginPage     = document.getElementById('loginPage');
    var dashboardPage = document.getElementById('dashboardPage');
    if (dashboardPage) dashboardPage.style.display = 'none';
    if (loginPage)     loginPage.style.display     = 'block';

    // Reset login form fields and any displayed errors
    var usernameEl = document.getElementById('loginUsername');
    var passwordEl = document.getElementById('loginPassword');
    var errorEl    = document.getElementById('loginError');
    if (usernameEl) usernameEl.value = '';
    if (passwordEl) passwordEl.value = '';
    if (errorEl) {
      errorEl.textContent  = '';
      errorEl.style.display = 'none';
    }
  }

  // ─── 7. restoreSession ───────────────────────────────────────────────────

  /**
   * Called on DOMContentLoaded. Checks for a persisted session and, if one
   * is found, restores the authenticated state and shows the dashboard
   * without requiring the user to log in again.
   */
  function restoreSession() {
    var raw = sessionStorage.getItem('uat_session');
    if (!raw) return;

    try {
      var user = JSON.parse(raw);
      if (user) {
        window.State.currentUser = user;
        showDashboard().catch(function (err) {
          console.error('restoreSession: showDashboard failed', err);
          handleLogout();
        });
      }
    } catch (e) {
      // Corrupted session data — start fresh
      sessionStorage.removeItem('uat_session');
      sessionStorage.removeItem('uat_token');
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  window.Auth = {
    togglePasswordVisibility:  togglePasswordVisibility,
    handleLogin:               handleLogin,
    handleLogout:              handleLogout,
    showDashboard:             showDashboard,
    loadAllData:               loadAllData,
    restoreSession:            restoreSession,
    updateUserUnreadBadge:     updateUserUnreadBadge,
  };

  // Kick off session restore as soon as the DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreSession);
  } else {
    restoreSession();
  }

})();
