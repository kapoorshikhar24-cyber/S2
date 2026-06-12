document.addEventListener('DOMContentLoaded', () => {
  // 1. Init theme
  window.UI.initTheme();

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) loginBtn.addEventListener('click', window.Auth.handleLogin);

  const loginPassword = document.getElementById('loginPassword');
  if (loginPassword) {
    loginPassword.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') window.Auth.handleLogin();
    });
  }

  const loginUsername = document.getElementById('loginUsername');
  if (loginUsername) {
    loginUsername.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('loginPassword')?.focus();
    });
  }

  const togglePassword = document.getElementById('togglePassword');
  if (togglePassword) togglePassword.addEventListener('click', window.Auth.togglePasswordVisibility);

  // ── DASHBOARD - LAYOUT ────────────────────────────────────────────────────
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', window.Auth.handleLogout);

  const mobileToggle = document.getElementById('mobileToggle');
  if (mobileToggle) mobileToggle.addEventListener('click', window.UI.toggleSidebar);

  const sidebarOverlay = document.getElementById('sidebarOverlay');
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', window.UI.toggleSidebar);

  const sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');
  if (sidebarCollapseBtn) sidebarCollapseBtn.addEventListener('click', window.UI.toggleDesktopSidebar);

  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.addEventListener('click', window.UI.toggleTheme);

  // ── DASHBOARD - BRANDING ──────────────────────────────────────────────────
  const sidebarBrand = document.getElementById('sidebarBrand');
  if (sidebarBrand) {
    sidebarBrand.addEventListener('click', () => {
      const user = window.State.currentUser;
      if (user && user.role === 'admin') {
        document.getElementById('adminLogoInput')?.click();
      }
    });
  }

  const adminLogoInput = document.getElementById('adminLogoInput');
  if (adminLogoInput) adminLogoInput.addEventListener('change', window.Settings.updateLogo);

  // ── DASHBOARD - NAV ───────────────────────────────────────────────────────
  const navDashboard = document.getElementById('navDashboard');
  if (navDashboard) navDashboard.addEventListener('click', () => window.UI.switchSection('dashboard'));

  const navUsers = document.getElementById('navUsers');
  if (navUsers) {
    navUsers.addEventListener('click', () => {
      window.UI.switchSection('users');
      if (window.Users && typeof window.Users.initCustomizeUI === 'function') {
        window.Users.initCustomizeUI();
      }
    });
  }

  const navProjectMgmt = document.getElementById('navProjectMgmt');
  if (navProjectMgmt) navProjectMgmt.addEventListener('click', () => window.UI.switchSection('projectMgmt'));

  const navPicklists = document.getElementById('navPicklists');
  if (navPicklists) navPicklists.addEventListener('click', () => window.UI.switchSection('picklists'));

  const navNotifications = document.getElementById('navNotifications');
  if (navNotifications) navNotifications.addEventListener('click', () => window.UI.switchSection('notifications'));

  const navImages = document.getElementById('navImages');
  if (navImages) navImages.addEventListener('click', () => window.UI.switchSection('images'));

  const navFiles = document.getElementById('navFiles');
  if (navFiles) navFiles.addEventListener('click', () => window.UI.switchSection('files'));

  const navLoginLogs = document.getElementById('navLoginLogs');
  if (navLoginLogs) navLoginLogs.addEventListener('click', () => window.UI.switchSection('loginLogs'));

  // ── DASHBOARD - BELL ──────────────────────────────────────────────────────
  const bellBtn = document.getElementById('bellBtn');
  if (bellBtn) bellBtn.addEventListener('click', window.Notifications.toggleBellDropdown);

  const bellMarkAllBtn = document.getElementById('bellMarkAllBtn');
  if (bellMarkAllBtn) bellMarkAllBtn.addEventListener('click', window.Notifications.markAllRead);

  const markAllReadBtn = document.getElementById('markAllReadBtn');
  if (markAllReadBtn) markAllReadBtn.addEventListener('click', window.Notifications.markAllRead);

  window.addEventListener('click', (e) => {
    if (!e.target.closest('.bell-wrapper')) {
      if (window.Notifications && typeof window.Notifications.closeBellDropdown === 'function') {
        window.Notifications.closeBellDropdown();
      }
    }
  });

  // ── DASHBOARD - USER MANAGEMENT ───────────────────────────────────────────
  const userType = document.getElementById('userType');
  if (userType) userType.addEventListener('change', window.Users.onTypeChange);

  const userSaveBtn = document.getElementById('userSaveBtn');
  if (userSaveBtn) userSaveBtn.addEventListener('click', window.Users.add);

  const userUpdateBtn = document.getElementById('userUpdateBtn');
  if (userUpdateBtn) userUpdateBtn.addEventListener('click', window.Users.update);

  const userCancelBtn = document.getElementById('userCancelBtn');
  if (userCancelBtn) userCancelBtn.addEventListener('click', window.Users.cancelEdit);

  // Debounced user search
  let userSearchTimer;
  const userSearchInput = document.getElementById('userSearchInput');
  if (userSearchInput) {
    userSearchInput.addEventListener('input', () => {
      clearTimeout(userSearchTimer);
      userSearchTimer = setTimeout(() => window.Users.render(), 200);
    });
  }

  const csvImportBtn = document.getElementById('csvImportBtn');
  if (csvImportBtn) {
    csvImportBtn.addEventListener('click', () => document.getElementById('csvUserInput')?.click());
  }

  const csvUserInput = document.getElementById('csvUserInput');
  if (csvUserInput) csvUserInput.addEventListener('change', window.Users.importFromCSV);

  const csvTemplateBtn = document.getElementById('csvTemplateBtn');
  if (csvTemplateBtn) csvTemplateBtn.addEventListener('click', window.Users.downloadCSVTemplate);

  // ── DASHBOARD - PROJECT MANAGEMENT ────────────────────────────────────────
  const projectImageInput = document.getElementById('projectImageInput');
  if (projectImageInput) projectImageInput.addEventListener('change', window.Projects.previewImage);

  const projectSaveBtn = document.getElementById('projectSaveBtn');
  if (projectSaveBtn) projectSaveBtn.addEventListener('click', window.Projects.add);

  const projectUpdateBtn = document.getElementById('projectUpdateBtn');
  if (projectUpdateBtn) projectUpdateBtn.addEventListener('click', window.Projects.update);

  const projectCancelBtn = document.getElementById('projectCancelBtn');
  if (projectCancelBtn) projectCancelBtn.addEventListener('click', window.Projects.cancelEdit);

  // Quick Project creation (from User Management)
  const openQuickProjectBtn = document.getElementById('openQuickProjectBtn');
  if (openQuickProjectBtn) openQuickProjectBtn.addEventListener('click', window.Projects.openQuickModal);

  const quickProjectImageInput = document.getElementById('quickProjectImageInput');
  if (quickProjectImageInput) quickProjectImageInput.addEventListener('change', window.Projects.previewQuickImage);

  const saveQuickProjectBtn = document.getElementById('saveQuickProjectBtn');
  if (saveQuickProjectBtn) saveQuickProjectBtn.addEventListener('click', window.Projects.saveQuickProject);

  const cancelQuickProjectBtn = document.getElementById('cancelQuickProjectBtn');
  if (cancelQuickProjectBtn) cancelQuickProjectBtn.addEventListener('click', window.Projects.closeQuickModal);

  const closeQuickProjectModal = document.getElementById('closeQuickProjectModal');
  if (closeQuickProjectModal) closeQuickProjectModal.addEventListener('click', window.Projects.closeQuickModal);

  const quickProjectUploadArea = document.getElementById('quickProjectUploadArea');
  if (quickProjectUploadArea) {
    quickProjectUploadArea.addEventListener('click', () => {
      document.getElementById('quickProjectImageInput')?.click();
    });
  }

  // ── DASHBOARD - ENTRIES ───────────────────────────────────────────────────
  const pageModuleSelect = document.getElementById('pageModuleSelect');
  if (pageModuleSelect) {
    pageModuleSelect.addEventListener('change', () => {
      const customModuleGroup = document.getElementById('customModuleGroup');
      if (customModuleGroup) {
        customModuleGroup.style.display =
          pageModuleSelect.value === 'Other' ? '' : 'none';
      }
    });
  }

  const imageInput = document.getElementById('imageInput');
  if (imageInput) imageInput.addEventListener('change', window.Entries.previewImage);

  const submitEntryBtn = document.getElementById('submitEntryBtn');
  if (submitEntryBtn) submitEntryBtn.addEventListener('click', window.Entries.add);

  // ── DASHBOARD - NOTIFICATIONS SEARCH + FILTER ─────────────────────────────
  let notifSearchTimer;
  function debouncedRenderNotifs() {
    clearTimeout(notifSearchTimer);
    notifSearchTimer = setTimeout(() => window.Notifications.renderTable(), 200);
  }

  const notifDateSearch = document.getElementById('notifDateSearch');
  if (notifDateSearch) notifDateSearch.addEventListener('input', debouncedRenderNotifs);

  const notifGeneralSearch = document.getElementById('notifGeneralSearch');
  if (notifGeneralSearch) notifGeneralSearch.addEventListener('input', debouncedRenderNotifs);

  const notifStatusFilter = document.getElementById('notifStatusFilter');
  if (notifStatusFilter) notifStatusFilter.addEventListener('change', () => window.Notifications.renderTable());

  const notifProjectFilter = document.getElementById('notifProjectFilter');
  if (notifProjectFilter) {
    notifProjectFilter.addEventListener('change', () => {
      window.Notifications.renderTable();
      window.UI.updateBranding();
    });
  }

  const dashboardProjectFilter = document.getElementById('dashboardProjectFilter');
  if (dashboardProjectFilter) {
    dashboardProjectFilter.addEventListener('change', (e) => {
      sessionStorage.setItem('dashboardProjectFilter', e.target.value);
      window.UI.renderDashboard();
      window.UI.updateBranding();
    });
  }

  const exportCsvBtn = document.getElementById('exportCsvBtn');
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', window.Notifications.exportCSV);

  // ── IMAGE MODAL ───────────────────────────────────────────────────────────
  const imageModalClose = document.getElementById('imageModalClose');
  if (imageModalClose) imageModalClose.addEventListener('click', window.UI.closeImageModal);

  const imageModal = document.getElementById('imageModal');
  if (imageModal) {
    imageModal.addEventListener('click', (e) => {
      if (e.target === imageModal) window.UI.closeImageModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.UI.closeImageModal();
  });

  if (window.Picklists && typeof window.Picklists.initUI === 'function') {
    window.Picklists.initUI();
  }

  if (window.Notifications && typeof window.Notifications.initChatModal === 'function') {
    window.Notifications.initChatModal();
  }

  if (window.Profile && typeof window.Profile.init === 'function') {
    window.Profile.init();
  }

  // 3. Restore session
  window.Auth.restoreSession();
});
