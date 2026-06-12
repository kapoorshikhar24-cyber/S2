/**
 * users.js — Users module for the UAT Dashboard.
 *
 * Manages user CRUD operations, form handling, table rendering, and CSV
 * import/export. Depends on: window.API, window.State, window.UI, window.Utils
 */

(function () {

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** Returns an element by ID, or null if not found. */
  function el(id) {
    return document.getElementById(id);
  }

  /** Shows an element (removes display:none). */
  function show(id) {
    var elem = el(id);
    if (elem) elem.style.display = '';
  }

  /** Hides an element (sets display:none). */
  function hide(id) {
    var elem = el(id);
    if (elem) elem.style.display = 'none';
  }

  /** Returns the trimmed value of an input/select element by ID. */
  function val(id) {
    var elem = el(id);
    return elem ? elem.value.trim() : '';
  }

  /**
   * Disables or enables User Management form fields based on whether 
   * a user type has been selected.
   */
  function toggleFormFields() {
    var type = val('userType');
    var isSelected = !!type;

    var fields = [
      'userFullName', 'userName', 'userPassword',
      'userDesignationSelect', 'userAssignedEmployee',
      'userStatus', 'userIsOwner', 'userIsPOC', 'canManageSubUsers'
    ];

    fields.forEach(function (id) {
      var elem = el(id);
      if (elem) elem.disabled = !isSelected;
    });

    // Handle custom multiselect component
    var projectTrigger = el('userProjectDropdownTrigger');
    if (projectTrigger) {
      if (!isSelected) {
        projectTrigger.style.pointerEvents = 'none';
        projectTrigger.style.opacity = '0.5';
      } else {
        projectTrigger.style.pointerEvents = 'auto';
        projectTrigger.style.opacity = '1';
      }
    }

    // Handle buttons
    var saveBtn = el('userSaveBtn');
    if (saveBtn) saveBtn.disabled = !isSelected;

    // If updating, the type is usually already selected, 
    // but the update/cancel buttons should follow same logic just in case.
    var updateBtn = el('userUpdateBtn');
    if (updateBtn) updateBtn.disabled = !isSelected;
  }

  // ---------------------------------------------------------------------------
  // 1. load()
  // ---------------------------------------------------------------------------

  /**
   * Fetches all users from the API and stores them in State.users.
   * @returns {Promise<object[]>}
   */
  async function load() {
    try {
      var users = await window.API.get('/api/users');
      window.State.users = Array.isArray(users) ? users : [];
      return window.State.users;
    } catch (err) {
      console.error('[Users] load error:', err);
      window.State.users = [];
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // 2. onTypeChange()
  // ---------------------------------------------------------------------------

  /**
   * Reads the #userType select value and shows/hides designation + project
   * group fields accordingly.
   */
  function onTypeChange() {
    var type = val('userType');
    var currentUser = window.State.currentUser || {};

    // Core Layout Elements
    var dynRow = el('dynamicFieldsRow');
    var desg = el('userDesignationGroup');

    // Employee Specific
    var employeeGroup = el('assignedEmployeeGroup');

    // Client Specific
    var projectGroup = el('projectGroup');
    var rolesGroup = el('userRolesGroup');

    // Reset visibility
    if (dynRow) dynRow.style.display = 'none';
    if (desg) desg.style.display = 'none';
    if (employeeGroup) employeeGroup.style.display = 'none';
    if (projectGroup) projectGroup.style.display = 'none';
    if (rolesGroup) rolesGroup.style.display = 'none';

    if (type === 'internal') {
      if (dynRow) dynRow.style.display = 'flex';
      if (desg) desg.style.display = 'flex';
      show('userAvatarContainer');
      hide('allowProfileGroup');
    } else if (type === 'external') {
      if (dynRow) dynRow.style.display = 'flex';
      if (desg) desg.style.display = 'flex';
      if (employeeGroup) employeeGroup.style.display = 'flex';
      if (projectGroup) projectGroup.style.display = 'flex';
      if (rolesGroup) rolesGroup.style.display = 'flex';

      show('allowProfileGroup');
      var allowImage = el('allowProfileImage') && el('allowProfileImage').checked;
      if (allowImage) show('userAvatarContainer');
      else hide('userAvatarContainer');
    }

    toggleFormFields();
  }

  /**
   * Customizes the user management form based on the current user's role.
   * If they are an External Manager, they can only create 'Staff' (external) users.
   */
  function initCustomizeUI() {
    var currentUser = window.State.currentUser || {};
    var isExternalManager = currentUser.type === 'external' && currentUser.canManageSubUsers;

    if (isExternalManager) {
      var typeSelect = el('userType');
      if (typeSelect) {
        typeSelect.innerHTML = '<option value="external">Staff</option>';
        typeSelect.value = 'external';
        typeSelect.disabled = true; // Force it to Staff
      }
      
      // External Managers also shouldn't see 'Internal' projects or grant Lead permissions
      hide('canManageGroup');
      hide('userIsOwnerLabel');
      hide('userIsPOCLabel');
      
      // They don't need to select a project because it's forced to their own project
      var projectGroup = el('projectGroup');
      if (projectGroup) {
        projectGroup.style.display = 'none';
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. getFormValues()
  // ---------------------------------------------------------------------------

  /**
   * Reads all user form fields and returns a plain object.
   * Picks the designation from the active field based on user type.
   * @returns {{ type: string, name: string, password: string, designation: string, project: string }}
   */
  function getFormValues() {
  var currentUser = window.State.currentUser || {};
  var isExternalManager = currentUser.type === 'external' && currentUser.canManageSubUsers;

  var type = isExternalManager ? 'external' : val('userType');
  var designation = val('userDesignationSelect');

  return {
    type: type,
    fullName: val('userFullName'),
    name: val('userName'),
    password: val('userPassword'),
    designation: designation,
    project: isExternalManager ? currentUser.project : val('userProject'),
    status: val('userStatus') || 'active',
    canManageSubUsers: (isExternalManager ? false : (el('canManageSubUsers') ? el('canManageSubUsers').checked : false)),
    isOwner: (isExternalManager ? false : (el('userIsOwner') ? el('userIsOwner').checked : false)),
    isPOC: (isExternalManager ? false : (el('userIsPOC') ? el('userIsPOC').checked : false)),
    assignedEmployee: val('userAssignedEmployee'),
    allowProfileImage: el('allowProfileImage') ? el('allowProfileImage').checked : false,
    profileImage: (function () {
      var previewSrc = el('userAvatarPreview') ? el('userAvatarPreview').src : '';
      return (previewSrc && previewSrc.startsWith('data:image')) ? previewSrc : null;
    })()
  };
}

/**
 * Validates user fields for both add and update operations.
 * @param {object} fields - The fields from getFormValues()
 * @param {boolean} isUpdate - True if we are updating an existing user
 * @returns {boolean} - True if valid, false otherwise
 */
function validateFields(fields, isUpdate) {
  if (!fields.type) {
    window.UI.showToast('Please select a user type.', '#ef4444');
    return false;
  }
  if (!fields.fullName) {
    window.UI.showToast('Full Name is required.', '#ef4444');
    return false;
  }
  if (!fields.name) {
    window.UI.showToast('Username (email) is required.', '#ef4444');
    return false;
  }

  // Email format validation
  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(fields.name)) {
    var hint = el('userNameHint');
    if (hint) hint.style.display = 'block';
    window.UI.showToast('Username must be a valid email address.', '#ef4444');
    return false;
  } else {
    var hint2 = el('userNameHint');
    if (hint2) hint2.style.display = 'none';
  }

  if (!fields.designation) {
    window.UI.showToast('Designation is required.', '#ef4444');
    return false;
  }

  // Password validation (only strict on add, or if provided on update)
  if (!isUpdate && !fields.password) {
    window.UI.showToast('Password is required.', '#ef4444');
    return false;
  }
  if (fields.password && fields.password.length < 8) {
    var pwHint = el('userPasswordHint');
    if (pwHint) pwHint.style.display = 'block';
    window.UI.showToast('Password must be at least 8 characters.', '#ef4444');
    return false;
  } else {
    var pwHint2 = el('userPasswordHint');
    if (pwHint2) pwHint2.style.display = 'none';
  }

  // Project validation for external users
  var currentUser = window.State.currentUser || {};
  var isExternalManager = currentUser.type === 'external' && currentUser.canManageSubUsers;

  if (fields.type === 'external' && !isExternalManager) {
    if (!fields.project) {
      window.UI.showToast('Project is required for external users.', '#ef4444');
      return false;
    }
    var projects = window.State.projects || [];
    var projectExists = projects.some(function (p) {
      return p.name === fields.project || p._id === fields.project;
    });
    if (!projectExists) {
      window.UI.showToast('Selected project does not exist.', '#ef4444');
      return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// 4. add()
// ---------------------------------------------------------------------------

/**
 * Validates the user form and POSTs a new user to the API.
 * On success, updates State.users, re-renders the table, clears the form,
 * and shows a success toast.
 */
async function add() {
  var fields = getFormValues();

  if (!validateFields(fields, false)) return;

  var payload = {
    type: fields.type,
    fullName: fields.fullName,
    name: fields.name,
    password: fields.password,
    designation: fields.designation,
    project: fields.project || null,
    status: fields.status || 'active',
    canManageSubUsers: fields.canManageSubUsers,
    isOwner: fields.isOwner,
    isPOC: fields.isPOC,
    assignedEmployee: fields.assignedEmployee,
    allowProfileImage: fields.allowProfileImage,
    profileImage: fields.profileImage || null
  };

  window.UI.showLoading('Adding user...');
  try {
    var created = await window.API.post('/api/users', payload);
    if (!created) {
      window.UI.hideLoading();
      return;
    }

    window.State.users.push(created);
    render();
    clearFields();
    window.UI.showToast('User added successfully.');
  } catch (err) {
    console.error('[Users] add error:', err);
    window.UI.showToast('Failed to add user: ' + err.message, '#ef4444');
  } finally {
    window.UI.hideLoading();
  }
}

// ---------------------------------------------------------------------------
// 5. update()
// ---------------------------------------------------------------------------

/**
 * Validates the user form and PUTs updated user data to the API.
 * Reloads the user list, re-renders, cancels edit mode, and shows a toast.
 */
async function update() {
  var id = window.State.currentEditUserId;
  if (!id) return;

  var fields = getFormValues();

  if (!validateFields(fields, true)) return;

  var payload = {
    _id: id,
    type: fields.type,
    fullName: fields.fullName,
    name: fields.name,
    designation: fields.designation,
    project: fields.project || null,
    status: fields.status,
    canManageSubUsers: fields.canManageSubUsers,
    isOwner: fields.isOwner,
    isPOC: fields.isPOC,
    assignedEmployee: fields.assignedEmployee,
    allowProfileImage: fields.allowProfileImage,
    profileImage: fields.profileImage && fields.profileImage.startsWith('data:image') ? fields.profileImage : null
  };
  // Only include password in payload if the user typed a new one
  if (fields.password) payload.password = fields.password;

  window.UI.showLoading('Updating user...');
  try {
    var updated = await window.API.put('/api/users', payload);
    if (!updated) {
      window.UI.hideLoading();
      return;
    }

    await load();
    render();
    cancelEdit();
    window.UI.showToast('User updated successfully.');
  } catch (err) {
    console.error('[Users] update error:', err);
    window.UI.showToast('Failed to update user: ' + err.message, '#ef4444');
  } finally {
    window.UI.hideLoading();
  }
}

// ---------------------------------------------------------------------------
// 6. editUser(id)
// ---------------------------------------------------------------------------

/**
 * Populates the user form with an existing user's data and enters edit mode.
 * @param {string} id — The _id of the user to edit.
 */
function editUser(id) {
  var user = window.State.users.find(function (u) { return u._id === id; });
  if (!user) return;

  // Populate form fields
  var typeEl = el('userType');
  if (typeEl) typeEl.value = user.type || '';

  var fullNameEl = el('userFullName');
  if (fullNameEl) fullNameEl.value = user.fullName || '';

  var nameEl = el('userName');
  if (nameEl) nameEl.value = user.name || '';

  var passwordEl = el('userPassword');
  if (passwordEl) passwordEl.value = '';  // do not pre-fill password

  // Set project chip selection
  selectUserProject(user.project || null);

  if (el('userAssignedEmployee')) el('userAssignedEmployee').value = user.assignedEmployee || '';

  // Set designation
  var desigSelect = el('userDesignationSelect');
  if (desigSelect) desigSelect.value = user.designation || '';

  // Set Owner/POC roles
  var ownerEl = el('userIsOwner');
  if (ownerEl) ownerEl.checked = !!user.isOwner;

  var pocEl = el('userIsPOC');
  if (pocEl) pocEl.checked = !!user.isPOC;

  // Status and management
  var statusEl = el('userStatus');
  if (statusEl) statusEl.value = user.status || 'active';

  var manageEl = el('canManageSubUsers');
  if (manageEl) manageEl.checked = !!user.canManageSubUsers;

  var allowImgEl = el('allowProfileImage');
  if (allowImgEl) allowImgEl.checked = !!user.allowProfileImage;

  // Set Avatar
  var preview = el('userAvatarPreview');
  var placeholder = el('userAvatarPlaceholder');
  if (user.profileImage) {
    if (preview) { preview.src = user.profileImage; preview.style.display = 'block'; }
    if (placeholder) placeholder.style.display = 'none';
  } else {
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    if (placeholder) placeholder.style.display = 'flex';
  }

  // Sync visibility of designation / project fields
  onTypeChange();

  // Track which user is being edited
  window.State.currentEditUserId = id;

  // Swap buttons and update card title
  hide('userSaveBtn');
  show('userUpdateBtn');
  show('userCancelBtn');

  var cardTitle = el('userCardTitle');
  if (cardTitle) cardTitle.textContent = '✏️ Edit User';
}

// ---------------------------------------------------------------------------
// 7. deleteUser(id)
// ---------------------------------------------------------------------------

/**
 * Prompts the user for confirmation, then deletes the user via the API.
 * Removes the entry from State.users, re-renders, and shows a toast.
 * @param {string} id — The _id of the user to delete.
 */
async function deleteUser(id) {
  if (!confirm('Are you sure you want to delete this user?')) return;

  window.UI.showLoading('Deleting user...');
  try {
    await window.API.del('/api/users', { _id: id });

    window.State.users = window.State.users.filter(function (u) { return u._id !== id; });
    render();
    window.UI.showToast('User deleted.');
  } catch (err) {
    console.error('[Users] delete error:', err);
    window.UI.showToast('Failed to delete user.', '#ef4444');
  } finally {
    window.UI.hideLoading();
  }
}

// ---------------------------------------------------------------------------
// 8. render()
// ---------------------------------------------------------------------------

/**
 * Renders the #userTableBody from State.users, filtered by #userSearchInput.
 * Shows/hides the #emptyUsers placeholder. Also calls populateForProjects().
 */
function render() {
  try {
    var tbody = el('userTableBody');
    if (!tbody) return;

    var users = window.State.users || [];
    var search = val('userSearchInput').toLowerCase();

    var filtered = users.filter(function (u) {
      if (!search) return true;
      try {
        return (
          (u.name || '').toLowerCase().includes(search) ||
          (u.type || '').toLowerCase().includes(search) ||
          (u.designation || '').toLowerCase().includes(search) ||
          (u.project || '').toLowerCase().includes(search)
        );
      } catch(e) { return false; }
    });

    var emptyEl = el('emptyUsers');
    if (emptyEl) emptyEl.style.display = filtered.length === 0 ? '' : 'none';

    tbody.innerHTML = filtered.map(function (u, idx) {
      try {
        var fullName = window.Utils.escapeHtml(u.fullName || '—');
        var name = window.Utils.escapeHtml(u.name || '—');
        var rawType = (u.type || '');
        var type = window.Utils.escapeHtml(rawType);
        
        // UI Rename: 'external' -> 'Staff' if it's not a lead/manager, or always for External Managers viewing the list
        var currentUser = window.State.currentUser || {};
        var isExternalManager = currentUser.type === 'external' && currentUser.canManageSubUsers;
        if (rawType === 'external') {
          if (isExternalManager || (!u.canManageSubUsers && !u.isOwner && !u.isPOC)) {
            type = 'Staff';
          } else {
            type = 'Client Lead'; // Or keep as Client/External
          }
        } else if (rawType === 'internal') {
          type = 'Employee';
        }
        var designation = window.Utils.escapeHtml(u.designation || '—');

        // Append roles to designation if applicable
        if (u.isOwner) designation += ' <span class="role-badge" title="Owner" style="font-size:10px; padding:2px 4px; border:1px solid currentColor;">Owner</span>';
        if (u.isPOC) designation += ' <span class="role-badge" title="POC" style="font-size:10px; padding:2px 4px; border:1px solid currentColor;">POC</span>';

        var project = window.Utils.escapeHtml(u.project || '—');

        // Avatar logic
        var initials = getInitials(u.fullName || u.name);
        var avatarContent = '';
        if (u.profileImage) {
          avatarContent = '<img src="' + u.profileImage + '" class="user-table-avatar">';
        } else {
          avatarContent = '<div class="user-table-avatar-placeholder">' + initials + '</div>';
        }

        // Assigned Employee display
        var assignedTo = window.Utils.escapeHtml(u.assignedEmployee || '');
        if (assignedTo && type === 'external') {
          project += ' <div style="font-size:10px; color:#888; margin-top:2px;">Mgr: ' + assignedTo + '</div>';
        }

        var status = u.status || 'active';
        var id = window.Utils.escapeHtml(u._id);

        var statusClass = status === 'active' ? 'status-active' : 'status-inactive';
        var statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

        var isAdmin = window.State.currentUser && window.State.currentUser.role === 'admin';

        var cursorStyle = isAdmin ? 'cursor:pointer;' : '';
        var onclickAttr = isAdmin ? 'onclick="window.Users.toggleStatus(\'' + id + '\', \'' + status + '\')"' : '';

        return (
          '<tr>' +
          '<td>' + (idx + 1) + '</td>' +
          '<td><div style="display:flex; align-items:center;">' + avatarContent + '<span>' + fullName + '</span></div></td>' +
          '<td>' + name + '</td>' +
          '<td>' + type + '</td>' +
          '<td>' + designation + '</td>' +
          '<td>' + project + '</td>' +
          '<td><span class="badge ' + statusClass + '" style="' + cursorStyle + '" ' + onclickAttr + ' title="' + (isAdmin ? 'Click to toggle status' : '') + '">' + statusLabel + '</span></td>' +
          '<td>' +
          '<button onclick="window.Users.editUser(\'' + id + '\')" class="btn-icon" title="Edit">✏️</button>' +
          (isAdmin ? '<button onclick="window.Users.deleteUser(\'' + id + '\')" class="btn-icon btn-icon--danger" title="Delete">🗑️</button>' : '') +
          '</td>' +
          '</tr>'
        );
      } catch (err) {
        console.error("Error rendering user row:", err, u);
        return '<tr><td colspan="8" style="color:#ef4444;">Error rendering user: ' + (u.name || 'Unnamed') + '</td></tr>';
      }
    }).join('');

    populateForProjects();
  } catch (err) {
    console.error("Users.render crashed:", err);
    var tbody = el('userTableBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="color:#ef4444; padding:20px;">Fatal error in User renderer.</td></tr>';
  }
}

// ---------------------------------------------------------------------------
// 9. clearFields()
// ---------------------------------------------------------------------------

/**
 * Resets all user form fields to their default values and syncs visibility.
 */
function clearFields() {
  el('userType').value = '';
  el('userFullName').value = '';
  el('userName').value = '';
  el('userPassword').value = '';
  el('userDesignationSelect').value = '';
  selectUserProject(null);  // clear chip dropdown
  el('userStatus').value = 'active';
  el('userAssignedEmployee').value = '';
  el('userIsOwner').checked = false;
  el('userIsPOC').checked = false;
  el('canManageSubUsers').checked = false;
  if (el('allowProfileImage')) el('allowProfileImage').checked = false;

  // Reset Avatar
  var preview = el('userAvatarPreview');
  var placeholder = el('userAvatarPlaceholder');
  if (preview) { preview.src = ''; preview.style.display = 'none'; }
  if (placeholder) placeholder.style.display = 'flex';

  // Hide any validation hints
  var h1 = el('userNameHint'); if (h1) h1.style.display = 'none';
  var h2 = el('userPasswordHint'); if (h2) h2.style.display = 'none';

  var manageEl = el('canManageSubUsers');
  if (manageEl) manageEl.checked = false;

  var ownerEl = el('userIsOwner');
  if (ownerEl) ownerEl.checked = false;

  var pocEl = el('userIsPOC');
  if (pocEl) pocEl.checked = false;

  toggleFormFields();
}

// ---------------------------------------------------------------------------
// 10. cancelEdit()
// ---------------------------------------------------------------------------

/**
 * Exits edit mode: clears State.currentEditUserId, resets the form, swaps
 * buttons back to add mode, and restores the card title.
 */
function cancelEdit() {
  window.State.currentEditUserId = null;
  clearFields();

  show('userSaveBtn');
  hide('userUpdateBtn');
  hide('userCancelBtn');

  var cardTitle = el('userCardTitle');
  if (cardTitle) cardTitle.textContent = 'Add New User';
}

/**
 * Toggles a user's status between active and inactive.
 * @param {string} id - User _id
 * @param {string} currentStatus - 'active' or 'inactive'
 */
async function toggleStatus(id, currentStatus) {
  var newStatus = currentStatus === 'active' ? 'inactive' : 'active';
  var msg = 'Are you sure you want to mark this user as ' + newStatus.toUpperCase() + '?';

  if (!confirm(msg)) return;

  window.UI.showLoading('Updating status...');
  try {
    await window.API.put('/api/users', {
      _id: id,
      status: newStatus
    });

    // Update local state
    var user = window.State.users.find(function (u) { return u._id === id; });
    if (user) user.status = newStatus;

    render();
    window.UI.showToast('User marked as ' + newStatus);
  } catch (err) {
    window.UI.showToast('Failed to toggle status: ' + err.message, '#ef4444');
  } finally {
    window.UI.hideLoading();
  }
}

// ---------------------------------------------------------------------------
// 11. populateForProjects()
// ---------------------------------------------------------------------------

// Helper to extract initials
function getInitials(name) {
  if (!name) return 'U';
  var parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// Update multiselect chips UI based on checkboxes
function updateChips() {
  var chipsContainer = el('projectSelectedUsersChips');
  if (!chipsContainer) return;

  var checkedBoxes = document.querySelectorAll('.project-user-checkbox:checked');
  if (checkedBoxes.length === 0) {
    chipsContainer.innerHTML = '<span class="placeholder-text" id="projectUserPlaceholder">Search / Select Employees...</span>';
    return;
  }

  var chipsHtml = Array.from(checkedBoxes).map(function (cb) {
    var id = cb.value;
    var name = cb.dataset.name;
    var initials = cb.dataset.initials;

    return '<div class="multiselect-chip" data-id="' + id + '">' +
      '<div class="multiselect-avatar">' + initials + '</div>' +
      name +
      '<span class="multiselect-chip-remove" title="Remove" onclick="window.Users.removeChip(event, \'' + id + '\')">×</span>' +
      '</div>';
  }).join('');

  chipsContainer.innerHTML = chipsHtml;
}

/**
 * Populates the #newProjectUsers checkbox list with internal users.
 * Populates the #projectList datalist with names from State.projects.
 */
function populateForProjects() {

  // --- Employee multi-select dropdown ---
  var container = el('newProjectUsers');
  if (container) {
    var allUsers = window.State.users || [];
    var internalUsers = allUsers.filter(function (u) { return u.type !== 'external'; });

    container.innerHTML = internalUsers.map(function (u) {
      var id = window.Utils.escapeHtml(u._id);
      var name = window.Utils.escapeHtml(u.fullName || u.name || u._id);
      var initials = getInitials(u.fullName || u.name);

      return '<div class="multiselect-item" data-id="' + id + '" data-name="' + name.toLowerCase() + '" onclick="window.Users.toggleMultiselectItem(\'' + id + '\')">' +
        '<input type="checkbox" class="project-user-checkbox" id="chk_' + id + '" value="' + id + '" data-name="' + name + '" data-initials="' + initials + '">' +
        '<div class="user-info">' +
        '<div class="multiselect-avatar">' + initials + '</div>' +
        '<span>' + name + ' <small style="color:#888; margin-left:4px;">(' + (u.type || '') + ')</small></span>' +
        '</div>' +
        '</div>';
    }).join('');
  }

  // --- Project chip-dropdown list ---
  populateUserProjectDropdown();

  // --- Employee assignment select ---
  var employeeSelect = el('userAssignedEmployee');
  if (employeeSelect) {
    var internalUsers = (window.State.users || []).filter(function (u) { return u.type === 'internal'; });
    var options = '<option value="">-- None --</option>' + internalUsers.map(function (u) {
      var name = u.fullName || u.name;
      return '<option value="' + window.Utils.escapeHtml(name) + '">' + window.Utils.escapeHtml(name) + '</option>';
    }).join('');

    var currentVal = employeeSelect.value;
    employeeSelect.innerHTML = options;
    if (currentVal) employeeSelect.value = currentVal;
  }

  updateChips();
}

// ---------------------------------------------------------------------------
// 11b. Multiselect Interactive Helpers
// ---------------------------------------------------------------------------

function toggleMultiselectItem(id) {
  var item = document.querySelector('.multiselect-item[data-id="' + id + '"]');
  var chk = document.getElementById('chk_' + id);
  if (!item || !chk) return;

  chk.checked = !chk.checked;
  if (chk.checked) {
    item.classList.add('selected');
  } else {
    item.classList.remove('selected');
  }

  updateChips();
}

function removeChip(event, id) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  var chk = document.getElementById('chk_' + id);
  var item = document.querySelector('.multiselect-item[data-id="' + id + '"]');

  if (chk) chk.checked = false;
  if (item) item.classList.remove('selected');

  updateChips();
}

function setupMultiselectEvents() {
  var container = el('projectUserMultiselect');
  var trigger = el('projectUserDropdownTrigger');
  var search = el('projectUserSearch');

  if (!container || !trigger || !search) return;

  // Toggle dropdown
  trigger.onclick = function (e) {
    if (e.target.classList.contains('multiselect-chip-remove')) return;
    var isOpen = container.classList.contains('open');
    if (isOpen) {
      container.classList.remove('open');
      trigger.classList.remove('active');
    } else {
      container.classList.add('open');
      trigger.classList.add('active');
      setTimeout(function () { search.focus(); }, 10);
    }
  };

  // Filter list items
  search.oninput = function (e) {
    var query = e.target.value.toLowerCase().trim();
    var items = document.querySelectorAll('.multiselect-item');
    items.forEach(function (item) {
      var name = item.getAttribute('data-name') || '';
      if (name.indexOf(query) > -1) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  };

  // Close dropdown strictly when clicking outside the multiselect component
  document.addEventListener('click', function (e) {
    if (!container.contains(e.target)) {
      container.classList.remove('open');
      trigger.classList.remove('active');
    }
  });
}

// Run DOM injections for custom component events once ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    setupMultiselectEvents();
    setupUserProjectDropdown();
    toggleFormFields();
  });
} else {
  setupMultiselectEvents();
  setupUserProjectDropdown();
  toggleFormFields();
  setupAvatarUpload();
}

// ---------------------------------------------------------------------------
// Profile Image Handling
// ---------------------------------------------------------------------------

function setupAvatarUpload() {
  var area = el('userAvatarArea');
  var input = el('userAvatarInput');
  var preview = el('userAvatarPreview');
  var placeholder = el('userAvatarPlaceholder');
  var toggle = el('allowProfileImage');

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

  if (toggle) {
    toggle.onchange = () => onTypeChange();
  }
}

// ---------------------------------------------------------------------------
// Project single-select chip-dropdown (User Management)
// ---------------------------------------------------------------------------

function populateUserProjectDropdown() {
  var listEl = el('userProjectList');
  if (!listEl) return;

  var projects = window.State.projects || [];
  var hiddenInput = el('userProject');
  var currentVal = hiddenInput ? hiddenInput.value : '';

  listEl.innerHTML = projects.map(function (p) {
    var esc = window.Utils.escapeHtml(p.name);
    var imgSrc = p.brandImage ? window.Utils.escapeHtml(p.brandImage) : '';
    var isSelected = p.name === currentVal ? ' selected' : '';
    return '<div class="multiselect-item' + isSelected + '" ' +
      'data-id="' + esc + '" data-name="' + esc.toLowerCase() + '" ' +
      'onclick="window.Users.selectUserProject(\'' + esc + '\')">' +
      '<div class="user-info" style="gap:10px;">' +
      (imgSrc ? '<img src="' + imgSrc + '" style="width:22px;height:22px;border-radius:4px;object-fit:contain;">' : '<span style="font-size:16px;">📁</span>') +
      '<span>' + esc + '</span>' +
      '</div>' +
      '</div>';
  }).join('');

  if (projects.length === 0) {
    listEl.innerHTML = '<div style="padding:12px; color:var(--text-muted); font-size:13px;">No projects found. Create one first.</div>';
  }
}

function selectUserProject(name) {
  var hiddenInput = el('userProject');
  var chipsEl = el('userProjectChips');
  var container = el('userProjectMultiselect');

  if (hiddenInput) hiddenInput.value = name || '';

  // Update chips display
  if (chipsEl) {
    if (name) {
      chipsEl.innerHTML = '<div class="multiselect-chip" style="background:rgba(99,102,241,0.2);">' +
        '<span style="font-size:14px;">📁</span>' +
        window.Utils.escapeHtml(name) +
        '<span class="multiselect-chip-remove" title="Remove" onclick="window.Users.selectUserProject(null); event.stopPropagation();">×</span>' +
        '</div>';
    } else {
      chipsEl.innerHTML = '<span class="placeholder-text" id="userProjectPlaceholder">Search / Select project...</span>';
    }
  }

  // Highlight the selected item in the list
  document.querySelectorAll('#userProjectList .multiselect-item').forEach(function (item) {
    if (item.getAttribute('data-id') === name) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });

  // Close the dropdown
  if (container) {
    container.classList.remove('open');
    var trigger = el('userProjectDropdownTrigger');
    if (trigger) trigger.classList.remove('active');
  }
}

function setupUserProjectDropdown() {
  var container = el('userProjectMultiselect');
  var trigger = el('userProjectDropdownTrigger');
  var search = el('userProjectSearch');

  if (!container || !trigger || !search) return;

  // Toggle dropdown open/close
  trigger.addEventListener('click', function (e) {
    if (e.target.classList.contains('multiselect-chip-remove')) return;
    var isOpen = container.classList.contains('open');
    if (isOpen) {
      container.classList.remove('open');
      trigger.classList.remove('active');
    } else {
      container.classList.add('open');
      trigger.classList.add('active');
      populateUserProjectDropdown();
      setTimeout(function () { search.value = ''; search.focus(); }, 10);
      // Reset item visibility
      document.querySelectorAll('#userProjectList .multiselect-item').forEach(function (i) {
        i.style.display = 'flex';
      });
    }
  });

  // Search filter
  search.addEventListener('input', function () {
    var query = this.value.toLowerCase().trim();
    document.querySelectorAll('#userProjectList .multiselect-item').forEach(function (item) {
      var name = item.getAttribute('data-name') || '';
      item.style.display = name.indexOf(query) > -1 ? 'flex' : 'none';
    });
  });

  // Close on outside click
  document.addEventListener('click', function (e) {
    if (!container.contains(e.target)) {
      container.classList.remove('open');
      trigger.classList.remove('active');
    }
  });
}

// ---------------------------------------------------------------------------
// 12. downloadCSVTemplate()
// ---------------------------------------------------------------------------

/**
 * Triggers a download of a CSV template file for bulk user import.
 */
function downloadCSVTemplate() {
  var header = 'type,name,password,designation,project';
  var example = 'internal,Jane Doe,secret123,QA Engineer,';
  var content = header + '\n' + example + '\n';
  window.Utils.downloadCSV(content, 'users_template.csv');
}

// ---------------------------------------------------------------------------
// 13. importFromCSV(event)
// ---------------------------------------------------------------------------

/**
 * Reads a CSV file from an <input type="file"> change event, parses each
 * row, POSTs valid rows to the API, and shows a summary toast.
 * Expected columns: type, name, password, designation, project
 * @param {Event} event
 */
function importFromCSV(event) {
  var file = event.target && event.target.files && event.target.files[0];
  if (!file) return;

  window.UI.showLoading('Importing users from CSV...');
  var reader = new FileReader();
  reader.onload = async function (e) {
    var text = e.target.result;
    var rows = window.Utils.parseCSVRows(text);

    var successCount = 0;
    var failCount = 0;

    for (var i = 1; i < rows.length; i++) { // Skip header
      var row = rows[i];

      // Skip empty / malformed rows
      if (!row || row.length < 4) continue;

      var type = (row[0] || '').trim().toLowerCase();
      var name = (row[1] || '').trim();
      var password = (row[2] || '').trim();
      var designation = (row[3] || '').trim();
      var project = (row[4] || '').trim();

      // Basic validation
      if (!type || !name || !password || !designation) {
        failCount++;
        continue;
      }

      try {
        var created = await window.API.post('/api/users', {
          type: type,
          name: name,
          password: password,
          designation: designation,
          project: project || null,
        });

        if (created) {
          window.State.users.push(created);
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        failCount++;
      }
    }

    render();

    var msg = successCount + ' user(s) imported successfully.';
    if (failCount > 0) msg += ' ' + failCount + ' row(s) skipped.';
    window.UI.showToast(msg, failCount > 0 ? '#f59e0b' : '#22c55e');

    window.UI.hideLoading();
    // Reset the file input so the same file can be re-selected if needed
    if (event.target) event.target.value = '';
  };
  reader.onerror = function () {
    window.UI.hideLoading();
    window.UI.showToast('Failed to read CSV file.', '#ef4444');
  };

  reader.readAsText(file);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

window.Users = {
  load: load,
  render: render,
  onTypeChange: onTypeChange,
  add: add,
  update: update,
  editUser: editUser,
  deleteUser: deleteUser,
  clearFields: clearFields,
  cancelEdit: cancelEdit,
  toggleStatus: toggleStatus,
  initCustomizeUI: initCustomizeUI,
  toggleMultiselectItem: toggleMultiselectItem,
  removeChip: removeChip,
  selectUserProject: selectUserProject,
  setupAvatarUpload: setupAvatarUpload
};

}) ();
