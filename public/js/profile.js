/**
 * profile.js — Profile management module for the UAT Dashboard.
 *
 * Handles the Profile Modal, avatar uploads, and updating user account data.
 * Depends on: window.API, window.State, window.UI, window.Utils
 */

(function () {

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  function el(id) {
    return document.getElementById(id);
  }

  function val(id) {
    var elem = el(id);
    return elem ? elem.value.trim() : '';
  }

  // ---------------------------------------------------------------------------
  // 1. open()
  // ---------------------------------------------------------------------------

  /**
   * Opens the profile modal and populates it with the current user's data.
   */
  function open() {
    var user = window.State.currentUser;
    if (!user) return;

    var modal = el('profileModal');
    if (!modal) return;

    // Populate metadata
    var nameHeader = el('profileModalName');
    var roleHeader = el('profileModalRole');
    if (nameHeader) nameHeader.textContent = user.fullName || user.username || 'User';
    if (roleHeader) roleHeader.textContent = (user.designation || user.role || 'Member').toUpperCase();

    // Populate form
    var fullNameEl = el('profileFullName');
    var emailEl = el('profileEmail');
    var passwordEl = el('profilePassword');

    if (fullNameEl) fullNameEl.value = user.fullName || '';
    if (emailEl) emailEl.value = user.username || user.name || '';
    if (passwordEl) passwordEl.value = '';

    // Populate Avatar
    var preview = el('profileAvatarPreview');
    var placeholder = el('profileAvatarPlaceholder');

    if (user.profileImage) {
      if (preview) { preview.src = user.profileImage; preview.style.display = 'block'; }
      if (placeholder) placeholder.style.display = 'none';
    } else {
      if (preview) { preview.src = ''; preview.style.display = 'none'; }
      if (placeholder) {
        placeholder.style.display = 'flex';
        var initial = (user.fullName || user.username || 'U').charAt(0).toUpperCase();
        placeholder.querySelector('div:first-child').textContent = initial;
      }
    }

    modal.style.display = 'flex';
  }

  // ---------------------------------------------------------------------------
  // 2. close()
  // ---------------------------------------------------------------------------

  function close() {
    var modal = el('profileModal');
    if (modal) modal.style.display = 'none';
  }

  // ---------------------------------------------------------------------------
  // 3. save()
  // ---------------------------------------------------------------------------

  /**
   * Validates and saves profile changes.
   */
  async function save() {
    var user = window.State.currentUser;
    if (!user) return;

    var fullName = val('profileFullName');
    var password = val('profilePassword');
    
    // Extract profile image from preview if it's a new data URL
    var preview = el('profileAvatarPreview');
    var profileImage = (preview && preview.src.startsWith('data:image')) ? preview.src : user.profileImage;

    if (!fullName) {
      window.UI.showToast('Full Name is required.', '#ef4444');
      return;
    }

    if (password && password.length < 8) {
      window.UI.showToast('Password must be at least 8 characters.', '#ef4444');
      return;
    }

    var payload = {
      _id: user._id || user.userId, // use _id or userId depending on what's in state
      fullName: fullName,
      profileImage: profileImage
    };

    if (password) payload.password = password;

    window.UI.showLoading('Saving profile...');
    try {
      var response = await window.API.put('/api/users', payload);
      
      // Update local state and session
      user.fullName = fullName;
      user.profileImage = profileImage;
      window.State.currentUser = user;
      sessionStorage.setItem('uat_session', JSON.stringify(user));

      // Re-initialize dashboard elements (sidebar avatar, etc.)
      if (window.Auth && typeof window.Auth.showDashboard === 'function') {
        // We use showDashboard to refresh UI, but we don't want to reload ALL data
        // Just enough to update the sidebar.
        updateSidebarUI();
      }

      window.UI.showToast('Profile updated successfully.');
      close();
    } catch (err) {
      console.error('[Profile] Save error:', err);
      window.UI.showToast('Failed to update profile: ' + err.message, '#ef4444');
    } finally {
      window.UI.hideLoading();
    }
  }

  function updateSidebarUI() {
    var user = window.State.currentUser;
    var nameEl = el('sidebarName');
    var avatarEl = el('sidebarAvatar');

    if (nameEl) nameEl.textContent = user.username || user.name;
    // Note: sidebarName usually shows username, but if it expects fullName we should use that
    // Based on auth.js, sidebarName uses 'name' which is the username from session.
    
    if (avatarEl) {
      if (user.profileImage) {
        avatarEl.innerHTML = '<img src="' + user.profileImage + '" style="width:100%; height:100%; border-radius:inherit; object-fit:cover;">';
      } else {
        avatarEl.textContent = (user.fullName || user.username || 'U').charAt(0).toUpperCase();
      }
    }
    
    // Update dashboard branding too
    window.UI.updateBranding();
  }

  // ---------------------------------------------------------------------------
  // 4. setupEvents()
  // ---------------------------------------------------------------------------

  function setupEvents() {
    var area = el('profileAvatarArea');
    var input = el('profileAvatarInput');
    var preview = el('profileAvatarPreview');
    var placeholder = el('profileAvatarPlaceholder');

    if (area && input) {
      area.onclick = () => input.click();
      input.onchange = (e) => {
        var file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
          window.UI.showToast('Image too large. Max 2MB.', '#ef4444');
          return;
        }
        var reader = new FileReader();
        reader.onload = (ev) => {
          if (preview) { preview.src = ev.target.result; preview.style.display = 'block'; }
          if (placeholder) placeholder.style.display = 'none';
        };
        reader.readAsDataURL(file);
      };
    }

    var saveBtn = el('saveProfileBtn');
    if (saveBtn) saveBtn.onclick = save;

    var cancelBtn = el('cancelProfileBtn');
    if (cancelBtn) cancelBtn.onclick = close;

    var closeBtn = el('closeProfileModal');
    if (closeBtn) closeBtn.onclick = close;

    // Close on outside click
    window.addEventListener('click', (e) => {
      var modal = el('profileModal');
      if (e.target === modal) close();
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  window.Profile = {
    open,
    close,
    save,
    init: setupEvents
  };

})();
