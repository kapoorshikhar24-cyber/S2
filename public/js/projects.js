/**
 * projects.js — Projects module for the UAT Dashboard.
 *
 * Manages CRUD operations for projects, including brand image upload/preview,
 * user assignment, and both Compact (card) and Detailed (table) rendering.
 *
 * Depends on: window.API, window.State, window.UI, window.Utils
 * Usage: loaded via <script> tag — no ES modules.
 */

(function () {

  // Current active view: 'compact' | 'detailed'
  var _currentView = 'compact';

  // Project ID highlighted when switching to detailed via card click
  var _highlightId = null;

  // Track which row is in edit mode
  var _editingRowId = null;

  // ---------------------------------------------------------------------------
  // Data Loading
  // ---------------------------------------------------------------------------

  /**
   * Fetches all projects from the API and stores them in State.projects.
   * @returns {Promise<void>}
   */
  async function load() {
    try {
      const data = await API.get('/api/projects');
      if (data) State.projects = data;
    } catch (err) {
      UI.showToast('Failed to load projects: ' + err.message, '#ef4444');
    }
  }

  // ---------------------------------------------------------------------------
  // View Toggle
  // ---------------------------------------------------------------------------

  /**
   * Switches between 'compact' (card grid) and 'detailed' (table) views.
   * @param {string} mode  'compact' | 'detailed'
   * @param {string} [highlightProjectId]  Optional project ID to highlight in detailed view
   */
  function switchView(mode, highlightProjectId) {
    _currentView = mode;
    _highlightId = highlightProjectId || null;
    _editingRowId = null;

    var cardsGrid     = document.getElementById('projectCardsGrid');
    var detailedView  = document.getElementById('projectDetailedView');
    var btnCompact    = document.getElementById('btnCompactView');
    var btnDetailed   = document.getElementById('btnDetailedView');

    if (mode === 'detailed') {
      if (cardsGrid)    cardsGrid.style.display    = 'none';
      if (detailedView) detailedView.style.display = 'block';
      if (btnCompact)   btnCompact.classList.remove('active');
      if (btnDetailed)  btnDetailed.classList.add('active');
      renderDetailed();
    } else {
      if (cardsGrid)    cardsGrid.style.display    = 'grid';
      if (detailedView) detailedView.style.display = 'none';
      if (btnCompact)   btnCompact.classList.add('active');
      if (btnDetailed)  btnDetailed.classList.remove('active');
      render();
    }
  }

  // ---------------------------------------------------------------------------
  // Image Upload Helpers
  // ---------------------------------------------------------------------------

  /**
   * Handles the file-input change event for a project brand image.
   * Validates file type, compresses, stores result in State.currentProjectBase64,
   * and swaps the preview / placeholder UI.
   * @param {Event} event
   */
  async function previewImage(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      UI.showToast('Please select a valid image file.', '#ef4444');
      event.target.value = '';
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      UI.showToast('Image is too large. Max allowed size is 3MB.', '#ef4444');
      event.target.value = '';
      return;
    }

    try {
      const compressed = await Utils.compressImage(file, 800, 0.82);
      State.currentProjectBase64 = compressed;

      const preview     = document.getElementById('projectImagePreview');
      const placeholder = document.getElementById('projectUploadPlaceholder');

      if (preview) {
        preview.src = compressed;
        preview.style.display = 'block';
      }
      if (placeholder) placeholder.style.display = 'none';
    } catch (err) {
      UI.showToast('Image preview failed: ' + err.message, '#ef4444');
    }
  }

  /**
   * Resets the project image upload area to its empty state.
   */
  function clearImageUpload() {
    State.currentProjectBase64 = null;

    const input       = document.getElementById('projectImageInput');
    const preview     = document.getElementById('projectImagePreview');
    const placeholder = document.getElementById('projectUploadPlaceholder');

    if (input)       input.value = '';
    if (preview) {
      preview.src          = '';
      preview.style.display = 'none';
    }
    if (placeholder) placeholder.style.display = 'block';
  }

  // ---------------------------------------------------------------------------
  // CRUD — Add / Update / Delete / Edit
  // ---------------------------------------------------------------------------

  /**
   * Reads the new-project form, validates, and POSTs to /api/projects.
   * SLA and externalPower are no longer in the creation form — defaults applied server-side.
   * @returns {Promise<void>}
   */
  async function add() {
    const nameInput = document.getElementById('newProjectName');
    const name      = nameInput ? nameInput.value.trim() : '';
    const saveBtn   = document.getElementById('projectSaveBtn');

    if (!name) {
      UI.showToast('Project name is required.', '#ef4444');
      if (nameInput) nameInput.focus();
      return;
    }

    const checkedBoxes = document.querySelectorAll('.project-user-checkbox:checked');
    const users        = Array.from(checkedBoxes).map(function (cb) { return cb.value; });

    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
    UI.showLoading('Adding project...');
    try {
      const project = await API.post('/api/projects', {
        name,
        users,
        brandImage: State.currentProjectBase64,
        startDate: document.getElementById('newProjectStartDate') ? document.getElementById('newProjectStartDate').value : '',
        endDate: document.getElementById('newProjectEndDate') ? document.getElementById('newProjectEndDate').value : ''
        // slaHours & externalPower: server defaults (48h / true) apply
      });

      if (project) {
        State.projects.push(project);
        render();
        clearForm();
        clearImageUpload();
        UI.showToast('Project added successfully.');
      }
    } catch (err) {
      UI.showToast('Failed to add project: ' + err.message, '#ef4444');
    } finally {
      UI.hideLoading();
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '➕ Add Project'; }
    }
  }

  /**
   * Reads the edit-project form and PUTs updated data to /api/projects.
   * @returns {Promise<void>}
   */
  async function update() {
    const id = State.currentEditProjectId;
    if (!id) return;

    const nameInput = document.getElementById('newProjectName');
    const name      = nameInput ? nameInput.value.trim() : '';
    const updateBtn = document.getElementById('projectUpdateBtn');

    if (!name) {
      UI.showToast('Project name is required.', '#ef4444');
      if (nameInput) nameInput.focus();
      return;
    }

    const checkedBoxes = document.querySelectorAll('.project-user-checkbox:checked');
    const users        = Array.from(checkedBoxes).map(function (cb) { return cb.value; });

    if (updateBtn) { updateBtn.disabled = true; updateBtn.textContent = 'Updating...'; }
    UI.showLoading('Updating project...');
    try {
      await API.put('/api/projects', {
        _id: id,
        name,
        users,
        brandImage: State.currentProjectBase64,
        startDate: document.getElementById('newProjectStartDate') ? document.getElementById('newProjectStartDate').value : '',
        endDate: document.getElementById('newProjectEndDate') ? document.getElementById('newProjectEndDate').value : ''
        // slaHours & externalPower not updated here — managed via inline Detailed View
      });

      await load();
      // Re-render whichever view is active
      if (_currentView === 'detailed') {
        renderDetailed();
      } else {
        render();
      }
      cancelEdit();
      UI.showToast('Project updated successfully.');
    } catch (err) {
      UI.showToast('Failed to update project: ' + err.message, '#ef4444');
    } finally {
      UI.hideLoading();
      if (updateBtn) { updateBtn.disabled = false; updateBtn.textContent = '💾 Update Project'; }
    }
  }

  /**
   * Populates the project form with existing project data so the user can edit it.
   * @param {string} id  Project _id
   */
  function editProject(id) {
    const project = State.projects.find(function (p) { return p._id === id; });
    if (!project) return;

    State.currentEditProjectId = id;

    const nameInput  = document.getElementById('newProjectName');
    const startInput = document.getElementById('newProjectStartDate');
    const endInput   = document.getElementById('newProjectEndDate');

    if (nameInput)  nameInput.value  = project.name      || '';
    if (startInput) startInput.value = project.startDate || '';
    if (endInput)   endInput.value   = project.endDate   || '';

    // Set endInput min based on startInput
    if (startInput && startInput.value && endInput) {
      endInput.min = startInput.value;
    } else if (endInput) {
      endInput.min = '';
    }

    // Restore brand image
    if (project.brandImage) {
      State.currentProjectBase64 = project.brandImage;
      const preview     = document.getElementById('projectImagePreview');
      const placeholder = document.getElementById('projectUploadPlaceholder');
      if (preview) { preview.src = project.brandImage; preview.style.display = 'block'; }
      if (placeholder) placeholder.style.display = 'none';
    } else {
      clearImageUpload();
    }

    // Tick matching user checkboxes
    document.querySelectorAll('.project-user-checkbox').forEach(function (cb) {
      var isIncluded = Array.isArray(project.users) && project.users.includes(cb.value);
      cb.checked = isIncluded;
      var item = document.querySelector('.multiselect-item[data-id="' + cb.value + '"]');
      if (item) {
        if (isIncluded) item.classList.add('selected');
        else item.classList.remove('selected');
      }
    });

    if (window.Users && typeof window.Users.updateChips === 'function') {
      window.Users.updateChips();
    }

    // Swap buttons
    var saveBtn   = document.getElementById('projectSaveBtn');
    var updateBtn = document.getElementById('projectUpdateBtn');
    var cancelBtn = document.getElementById('projectCancelBtn');
    if (saveBtn)   saveBtn.style.display   = 'none';
    if (updateBtn) updateBtn.style.display = 'inline-block';
    if (cancelBtn) cancelBtn.style.display = 'inline-block';

    // Scroll form into view
    var card = document.getElementById('newProjectName');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /**
   * DELETEs a project.
   * @param {string} id  Project _id
   */
  async function deleteProject(id) {
    if (!confirm('Are you sure you want to delete this project?')) return;

    UI.showLoading('Deleting project...');
    try {
      await API.del('/api/projects', { _id: id });
      State.projects = State.projects.filter(function (p) { return p._id !== id; });
      // Refresh whichever view is active
      if (_currentView === 'detailed') {
        renderDetailed();
      } else {
        render();
      }
      UI.showToast('Project deleted.', '#f59e0b');
    } catch (err) {
      UI.showToast('Failed to delete project: ' + err.message, '#ef4444');
    } finally {
      UI.hideLoading();
    }
  }

  /**
   * Saves only the SLA hours for a project (inline edit — works in both views).
   * @param {string} id  Project _id
   */
  async function saveSla(id) {
    const input = document.getElementById('sla-input-' + id);
    if (!input) return;

    const hours = parseInt(input.value, 10);
    if (!hours || hours < 1) {
      UI.showToast('Please enter a valid number of hours (min 1).', '#ef4444');
      input.focus();
      return;
    }

    UI.showLoading('Saving SLA...');
    try {
      await API.put('/api/projects', { _id: id, slaHours: hours });
      const project = State.projects.find(function(p) { return p._id === id; });
      if (project) project.slaHours = hours;

      _editingRowId = null;
      if (_currentView === 'detailed') renderDetailed();
      else render();
      UI.showToast('SLA updated to ' + hours + ' hours.');
    } catch (err) {
      UI.showToast('Failed to set SLA: ' + err.message, '#ef4444');
    } finally {
      UI.hideLoading();
    }
  }

  /**
   * Opens the inline SLA editor (compact view cards).
   */
  function openSlaEditor(id, current, btn) {
    document.querySelectorAll('[id^="sla-editor-"]').forEach(function(el) {
      el.style.display = 'none';
    });
    var editor = document.getElementById('sla-editor-' + id);
    if (editor) {
      editor.style.display = 'block';
      var input = document.getElementById('sla-input-' + id);
      if (input) { input.value = current || ''; input.focus(); input.select(); }
    }
  }

  function closeSlaEditor(id) {
    var editor = document.getElementById('sla-editor-' + id);
    if (editor) editor.style.display = 'none';
  }

  /**
   * Saves External Access (externalPower) for a project inline from the table.
   * @param {string} id     Project _id
   * @param {boolean} value  New value
   */
  async function saveExternalAccess(id, value) {
    UI.showLoading('Updating access...');
    try {
      await API.put('/api/projects', { _id: id, externalPower: value });
      const project = State.projects.find(function(p) { return p._id === id; });
      if (project) project.externalPower = value;
      UI.showToast('External access ' + (value ? 'enabled' : 'disabled') + '.');
    } catch (err) {
      UI.showToast('Failed to update access: ' + err.message, '#ef4444');
    } finally {
      UI.hideLoading();
    }
  }

  /**
   * Opens the inline employee editor in the Detailed View table.
   * @param {string} id  Project _id
   */
  function openEmployeeEditor(id) {
    // Close any other open employee editors first
    document.querySelectorAll('.inline-emp-editor').forEach(function(el) {
      if (el.getAttribute('data-pid') !== id) el.style.display = 'none';
    });

    var editor = document.getElementById('emp-editor-' + id);
    if (!editor) return;

    var isVisible = editor.style.display === 'block';
    editor.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
      // Populate checkboxes based on current project assignment
      var project  = State.projects.find(function(p) { return p._id === id; });
      var assigned = project && Array.isArray(project.users) ? project.users : [];
      // Show ALL users (internal + external) so any user type can be assigned
      var allUsers = (State.users || []);

      // Separate internal and external for grouped display
      var internalUsers = allUsers.filter(function(u) { return u.type === 'internal'; });
      var externalUsers = allUsers.filter(function(u) { return u.type === 'external'; });

      var list = document.getElementById('emp-list-' + id);
      if (!list) return;

      if (allUsers.length === 0) {
        list.innerHTML = '<div style="padding:10px;font-size:12px;color:#888;">No users found.</div>';
      } else {
        var html = '';
        // Internal users group
        if (internalUsers.length > 0) {
          html += '<div style="padding:4px 10px 2px;font-size:9px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.08em;">Internal</div>';
          html += internalUsers.map(function(u) {
            var checked = assigned.includes(u._id) || assigned.includes(u.name);
            return (
              '<label style="display:flex;align-items:center;gap:8px;padding:6px 10px;cursor:pointer;border-radius:6px;' +
              'transition:background 0.15s;" onmouseover="this.style.background=\'rgba(99,102,241,0.1)\'" ' +
              'onmouseout="this.style.background=\'\';">' +
                '<input type="checkbox" class="emp-cb-' + id + '" value="' + Utils.escapeHtml(u._id || u.name) + '" ' +
                (checked ? 'checked' : '') + ' style="width:14px;height:14px;accent-color:#7c3aed;">' +
                '<span style="font-size:12px;color:var(--text-main);">' + Utils.escapeHtml(u.fullName || u.name) + '</span>' +
              '</label>'
            );
          }).join('');
        }
        // External users group
        if (externalUsers.length > 0) {
          html += '<div style="padding:6px 10px 2px;font-size:9px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:0.08em;border-top:1px solid rgba(255,255,255,0.06);margin-top:4px;">External</div>';
          html += externalUsers.map(function(u) {
            var checked = assigned.includes(u._id) || assigned.includes(u.name);
            return (
              '<label style="display:flex;align-items:center;gap:8px;padding:6px 10px;cursor:pointer;border-radius:6px;' +
              'transition:background 0.15s;" onmouseover="this.style.background=\'rgba(245,158,11,0.1)\'" ' +
              'onmouseout="this.style.background=\'\';">' +
                '<input type="checkbox" class="emp-cb-' + id + '" value="' + Utils.escapeHtml(u._id || u.name) + '" ' +
                (checked ? 'checked' : '') + ' style="width:14px;height:14px;accent-color:#f59e0b;">' +
                '<span style="font-size:12px;color:var(--text-main);">' + Utils.escapeHtml(u.fullName || u.name) + '</span>' +
              '</label>'
            );
          }).join('');
        }
        list.innerHTML = html;
      }
    }
  }

  /**
   * Reads the inline employee checkboxes and PUTs the updated user list.
   * @param {string} id  Project _id
   */
  async function saveEmployees(id) {
    var boxes = document.querySelectorAll('.emp-cb-' + id + ':checked');
    var users = Array.from(boxes).map(function(cb) { return cb.value; });

    UI.showLoading('Saving employees...');
    try {
      await API.put('/api/projects', { _id: id, users: users });
      var project = State.projects.find(function(p) { return p._id === id; });
      if (project) project.users = users;
      
      // Close editor and exit edit mode
      var editor = document.getElementById('emp-editor-' + id);
      if (editor) editor.style.display = 'none';
      _editingRowId = null; 

      renderDetailed();
      UI.showToast('Employees updated.');
    } catch (err) {
      UI.showToast('Failed to update employees: ' + err.message, '#ef4444');
    } finally {
      UI.hideLoading();
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering — Compact View (Card Grid)
  // ---------------------------------------------------------------------------

  /**
   * Renders the compact project card grid (#projectCardsGrid).
   */
  function render() {
    console.log('[Projects] Starting render…');
    try {
      const grid  = document.getElementById('projectCardsGrid');
      const empty = document.getElementById('emptyProjects');
      const badge = document.getElementById('projectCountBadge');

      if (!grid) {
        console.warn('[Projects] Project card grid element not found');
        return;
      }

      const projects = (window.State && window.State.projects) ? window.State.projects : [];
      console.log('[Projects] Rendering', projects.length, 'projects');
      if (badge) badge.textContent = projects.length + ' Project' + (projects.length !== 1 ? 's' : '');


      if (projects.length === 0) {
        grid.innerHTML = '';
        if (empty) empty.style.display = 'block';
      } else {
        if (empty) empty.style.display = 'none';

        const allUsers = State.users || [];
        function getUserName(idOrName) {
          var u = allUsers.find(function(u) { return u._id === idOrName || u.name === idOrName; });
          return u ? (u.fullName || u.name) : idOrName;
        }
        function getInitials(name) {
          if (!name) return '?';
          var parts = name.split(' ').filter(Boolean);
          return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.substring(0,2).toUpperCase();
        }

        grid.innerHTML = projects.map(function(project, idx) {
          try {
            const id      = Utils.escapeHtml(project._id);
            const name    = Utils.escapeHtml(project.name || '');
            const isAdmin = window.State.currentUser && window.State.currentUser.role === 'admin';
            const sla     = project.slaHours || null;

            // Timeline progress bar
            var timelineHtml = '';
            if (project.startDate && project.endDate) {
              var today = new Date(); today.setHours(0,0,0,0);
              var start = new Date(project.startDate); start.setHours(0,0,0,0);
              var end   = new Date(project.endDate);   end.setHours(0,0,0,0);
              var total = end - start;
              var elapsed = today - start;
              var pct   = total > 0 ? Math.min(100, Math.max(0, Math.round((elapsed/total)*100))) : 0;
              var daysLeft = Math.ceil((end - today) / (1000*60*60*24));
              var barColor   = daysLeft < 0 ? '#ef4444' : daysLeft <= 7 ? '#f59e0b' : '#22c55e';
              var statusLabel = daysLeft < 0 ? '❌ Ended' : daysLeft === 0 ? '⚡ Due Today' : '📅 ' + daysLeft + 'd left';
              var statusColor = daysLeft < 0 ? '#ef4444' : daysLeft <= 7 ? '#f59e0b' : '#22c55e';

              timelineHtml = (
                '<div style="margin-bottom:12px;">' +
                  '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
                    '<span style="font-size:11px;color:#888;">' + project.startDate + ' → ' + project.endDate + '</span>' +
                    '<span style="font-size:11px;font-weight:600;color:' + statusColor + ';">' + statusLabel + '</span>' +
                  '</div>' +
                  '<div style="height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;">' +
                    '<div style="width:' + pct + '%;height:100%;background:' + barColor + ';border-radius:3px;transition:width 0.6s ease;"></div>' +
                  '</div>' +
                '</div>'
              );
            } else if (project.endDate || project.startDate) {
              timelineHtml = '<div style="font-size:11px;color:#888;margin-bottom:12px;">📅 ' + (project.startDate || '—') + ' → ' + (project.endDate || '—') + '</div>';
            }

            // SLA cell — inline editable for admins
            var slaHtml;
            if (isAdmin) {
              var pillHtml = sla
                ? '<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(99,102,241,0.18);color:#a5b4fc;border:1px solid rgba(99,102,241,0.35);padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">⏱ ' + sla + 'h</span>'
                : '<span style="font-size:12px;color:#888;font-style:italic;">Not set</span>';

              slaHtml = (
                '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
                  pillHtml +
                  '<button onclick="Projects.openSlaEditor(\'' + id + '\',' + (sla||0) + ',this)" ' +
                    'style="padding:2px 8px;font-size:11px;background:rgba(99,102,241,0.1);color:#a5b4fc;border:1px solid rgba(99,102,241,0.3);border-radius:6px;cursor:pointer;" ' +
                    'title="Set SLA">✏️ Set</button>' +
                '</div>' +
                '<div id="sla-editor-' + id + '" style="display:none;margin-top:8px;">' +
                  '<div style="display:flex;align-items:center;gap:6px;">' +
                    '<input type="number" id="sla-input-' + id + '" min="1" value="' + (sla||'') + '" placeholder="e.g. 48" ' +
                      'style="width:70px;padding:5px 8px;border:1px solid rgba(99,102,241,0.5);border-radius:6px;background:rgba(0,0,0,0.4);color:#fff;font-size:12px;" ' +
                      'onkeydown="if(event.key===\'Enter\'){Projects.saveSla(\'' + id + '\');}if(event.key===\'Escape\'){Projects.closeSlaEditor(\'' + id + '\')}">' +
                    '<span style="font-size:12px;color:#888;">hrs</span>' +
                    '<button onclick="Projects.saveSla(\'' + id + '\')" style="padding:4px 12px;font-size:12px;background:#7c3aed;color:#fff;border:none;border-radius:6px;cursor:pointer;">Save</button>' +
                    '<button onclick="Projects.closeSlaEditor(\'' + id + '\')" style="padding:4px 8px;font-size:12px;background:rgba(255,255,255,0.05);color:#888;border:1px solid rgba(255,255,255,0.1);border-radius:6px;cursor:pointer;">✕</button>' +
                  '</div>' +
                '</div>'
              );
            } else {
              slaHtml = sla
                ? '<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(99,102,241,0.18);color:#a5b4fc;border:1px solid rgba(99,102,241,0.35);padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">⏱ ' + sla + 'h</span>'
                : '<span style="font-size:12px;color:#888;">—</span>';
            }

            // Employee avatars
            const users = Array.isArray(project.users) ? project.users : [];
            var avatarsHtml = '';
            if (users.length === 0) {
              avatarsHtml = '<span style="font-size:12px;color:#666;">No members assigned</span>';
            } else {
              var shown = users.slice(0, 5);
              avatarsHtml = '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;">';
              shown.forEach(function(u) {
                var displayName = getUserName(u);
                var initials = getInitials(displayName);
                avatarsHtml += (
                  '<div title="' + Utils.escapeHtml(displayName) + '" ' +
                    'style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);' +
                    'display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;' +
                    'border:2px solid rgba(255,255,255,0.1);cursor:default;flex-shrink:0;">' +
                    initials +
                  '</div>'
                );
              });
              if (users.length > 5) {
                avatarsHtml += '<div style="width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.08);' +
                  'display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:#888;' +
                  'border:2px solid rgba(255,255,255,0.1);">+' + (users.length-5) + '</div>';
              }
              avatarsHtml += '</div>';
            }

            // Access badge
            var accessBadge = project.externalPower !== false
              ? '<span style="font-size:10px;background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3);padding:2px 8px;border-radius:12px;">Full Access</span>'
              : '<span style="font-size:10px;background:rgba(156,163,175,0.1);color:#9ca3af;border:1px solid rgba(156,163,175,0.2);padding:2px 8px;border-radius:12px;">Basic</span>';

            // Logo
            var logoSection = project.brandImage
              ? '<img src="' + Utils.escapeHtml(project.brandImage) + '" alt="' + name + '" style="height:40px;width:auto;object-fit:contain;border-radius:6px;">'
              : '<img src="/images/project-icon.png" alt="Project" style="width:40px;height:40px;object-fit:contain;border-radius:6px;">';

            // Card click → switch to Detailed view with this project highlighted
            var cardClick = 'onclick="Projects.switchView(\'detailed\',\'' + id + '\')"';

            return (
              '<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:1.25rem;' +
              'transition:border-color 0.2s,box-shadow 0.2s;display:flex;flex-direction:column;gap:14px;cursor:pointer;" ' +
              'onmouseover="this.style.borderColor=\'rgba(124,58,237,0.4)\';this.style.boxShadow=\'0 4px 30px rgba(124,58,237,0.1)\'" ' +
              'onmouseout="this.style.borderColor=\'rgba(255,255,255,0.08)\';this.style.boxShadow=\'none\'" ' +
              cardClick + '>' +

                // Header: Logo + Name + Badges + Action btns (stop propagation on action buttons)
                '<div style="display:flex;align-items:center;gap:12px;">' +
                  logoSection +
                  '<div style="flex:1;min-width:0;">' +
                    '<div style="font-size:15px;font-weight:700;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + name + '</div>' +
                    '<div style="display:flex;align-items:center;gap:6px;margin-top:4px;">' +
                      accessBadge +
                      '<span style="font-size:10px;color:#888;">#' + (idx+1) + '</span>' +
                    '</div>' +
                  '</div>' +
                  (isAdmin
                    ? '<div style="display:flex;gap:6px;" onclick="event.stopPropagation();">' +
                        '<button onclick="Projects.editProject(\'' + id + '\')" title="Edit" ' +
                          'style="padding:5px 10px;font-size:12px;background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.3);border-radius:8px;cursor:pointer;">✏️</button>' +
                        '<button onclick="Projects.deleteProject(\'' + id + '\')" title="Delete" ' +
                          'style="padding:5px 10px;font-size:12px;background:rgba(239,68,68,0.1);color:#f87171;border:1px solid rgba(239,68,68,0.2);border-radius:8px;cursor:pointer;">🗑️</button>' +
                      '</div>'
                    : '') +
                '</div>' +

                // Timeline bar
                (timelineHtml || '') +

                // SLA + Members row (stop click propagation on SLA editor)
                '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding-top:10px;border-top:1px solid rgba(255,255,255,0.05);" onclick="event.stopPropagation();">' +
                  '<div>' +
                    '<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin-bottom:6px;">SLA Target</div>' +
                    slaHtml +
                  '</div>' +
                  '<div style="text-align:right;">' +
                    '<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#888;margin-bottom:6px;">Members (' + users.length + ')</div>' +
                    avatarsHtml +
                  '</div>' +
                '</div>' +

              '</div>'
            );
          } catch (err) {
            console.error("Error rendering project card:", err, project);
            return '<div style="border:1px solid #ef4444; color:#ef4444; padding:10px; border-radius:14px;">Error rendering project: ' + (project.name || 'Unnamed') + '</div>';
          }
        }).join('');
      }

      if (window.Users && typeof window.Users.populateForProjects === 'function') {
        window.Users.populateForProjects();
      }
    } catch (err) {
      console.error("Projects.render crashed:", err);
      var grid = document.getElementById('projectCardsGrid');
      if (grid) grid.innerHTML = '<div style="color:#ef4444; padding:20px;">Fatal error in Project renderer. Please check console.</div>';
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering — Detailed View (Table)
  // ---------------------------------------------------------------------------

  /**
   * Renders the detailed project table (#projectDetailTableBody).
   */
  function renderDetailed() {
    try {
      var tbody = document.getElementById('projectDetailTableBody');
      var empty = document.getElementById('emptyProjects');
      var badge = document.getElementById('projectCountBadge');
      if (!tbody) return;

      var projects = State.projects || [];
      if (badge) badge.textContent = projects.length + ' Project' + (projects.length !== 1 ? 's' : '');

      if (projects.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#888;padding:40px 0;">No projects found.</td></tr>';
        if (empty) empty.style.display = 'none'; // empty state shown inside table
        return;
      }
      if (empty) empty.style.display = 'none';

      var allUsers = State.users || [];
      function getUserName(idOrName) {
        try {
          var u = allUsers.find(function(u) { return u._id === idOrName || u.name === idOrName; });
          return u ? (u.fullName || u.name) : idOrName;
        } catch(e) { return idOrName || 'Unknown'; }
      }
      function getInitials(name) {
        if (!name) return '?';
        var parts = name.split(' ').filter(Boolean);
        return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.substring(0,2).toUpperCase();
      }

      var isAdmin = window.State.currentUser && window.State.currentUser.role === 'admin';

      tbody.innerHTML = projects.map(function(project, idx) {
        try {
          var id        = Utils.escapeHtml(project._id);
          var name      = Utils.escapeHtml(project.name || '');
          var sla       = project.slaHours || null;
          var extPower  = project.externalPower !== false;
          var isHighlit = _highlightId && _highlightId === project._id;
          var isEditing = _editingRowId === project._id;

          // --- Timeline cell ---
          var timelineCell = '';
          // Calculate today's date string for min attributes
          var _today = new Date();
          var _todayStr = _today.getFullYear() + '-' + String(_today.getMonth()+1).padStart(2,'0') + '-' + String(_today.getDate()).padStart(2,'0');
          var _startMin = _todayStr;
          var _endMin = (project.startDate && project.startDate >= _todayStr) ? project.startDate : _todayStr;

          if (isEditing) {
            timelineCell = (
              '<div style="display:flex;flex-direction:column;gap:6px;">' +
                '<div style="display:flex;align-items:center;gap:4px;">' +
                  '<span style="font-size:10px;color:#888;width:30px;">Start:</span>' +
                  '<input type="date" id="start-input-' + id + '" value="' + (project.startDate || '') + '" ' +
                    'min="' + _startMin + '" ' +
                    'class="table-date-input" ' +
                    'onchange="Projects.handleTableDateChange(\'' + id + '\', \'start\')">' +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:4px;">' +
                  '<span style="font-size:10px;color:#888;width:30px;">End:</span>' +
                  '<input type="date" id="end-input-' + id + '" value="' + (project.endDate || '') + '" ' +
                    'min="' + _endMin + '" ' +
                    'class="table-date-input" ' +
                    'onchange="Projects.handleTableDateChange(\'' + id + '\', \'end\')">' +
                '</div>' +
                '<button onclick="Projects.saveDates(\'' + id + '\')" ' +
                  'style="margin-top:2px;padding:3px 8px;font-size:10px;background:#7c3aed;color:#fff;border:none;border-radius:4px;cursor:pointer;align-self:flex-start;">' +
                  'Save Dates</button>' +
              '</div>'
            );
          } else {
            timelineCell = (project.startDate || project.endDate) 
              ? '<div style="font-size:12px;color:var(--text-main);">' + (project.startDate || '—') + ' to ' + (project.endDate || '—') + '</div>'
              : '<div style="font-size:12px;color:#888;font-style:italic;">Not set</div>';
          }

          // --- SLA cell (inline edit for admin) ---
          var slaCell;
          if (isEditing && isAdmin) {
            slaCell = (
              '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
                '<input type="number" id="sla-input-' + id + '" min="1" value="' + (sla || '') + '" ' +
                  'placeholder="e.g. 48" ' +
                  'style="width:70px;padding:5px 8px;border:1px solid rgba(99,102,241,0.4);border-radius:6px;' +
                  'background:rgba(0,0,0,0.3);color:#fff;font-size:12px;outline:none;" ' +
                  'onkeydown="if(event.key===\'Enter\'){Projects.saveSla(\'' + id + '\')}">' +
                '<button onclick="Projects.saveSla(\'' + id + '\')" title="Save SLA" ' +
                  'style="padding:4px 10px;font-size:11px;background:#7c3aed;color:#fff;border:none;border-radius:6px;cursor:pointer;white-space:nowrap;">Save</button>' +
              '</div>'
            );
          } else {
            slaCell = sla
              ? '<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(99,102,241,0.18);color:#a5b4fc;border:1px solid rgba(99,102,241,0.35);padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">⏱ ' + sla + 'h</span>'
              : '<span style="color:#888;font-size:12px;">—</span>';
          }

          // --- Logo cell ---
          var logoCell = project.brandImage
            ? '<img src="' + Utils.escapeHtml(project.brandImage) + '" alt="' + name + '" style="height:36px;width:auto;max-width:52px;object-fit:contain;border-radius:4px;display:block;margin:auto;">'
            : '<img src="/images/project-icon.png" alt="Project" style="width:32px;height:32px;object-fit:contain;display:block;margin:auto;opacity:0.6;">';

          // --- External Access toggle cell ---
          var accessCell;
          if (isAdmin) {
            var toggleId = 'ext-toggle-' + id;
            accessCell = (
              '<label class="access-toggle" title="Toggle External Access">' +
                '<input type="checkbox" id="' + toggleId + '" ' + (extPower ? 'checked' : '') + ' ' +
                  'onchange="Projects.saveExternalAccess(\'' + id + '\', this.checked)">' +
                '<span class="access-slider"></span>' +
              '</label>' +
              '<div style="font-size:10px;text-align:center;margin-top:4px;color:' + (extPower ? '#22c55e' : '#9ca3af') + ';">' +
                (extPower ? 'Full' : 'Basic') +
              '</div>'
            );
          } else {
            accessCell = extPower
              ? '<span style="font-size:11px;background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3);padding:2px 8px;border-radius:12px;">Full</span>'
              : '<span style="font-size:11px;background:rgba(156,163,175,0.1);color:#9ca3af;border:1px solid rgba(156,163,175,0.2);padding:2px 8px;border-radius:12px;">Basic</span>';
          }

          // --- Assigned Employees cell ---
          var users = Array.isArray(project.users) ? project.users : [];
          var avatarHtml = '';
          var shown = users.slice(0, 4);
          shown.forEach(function(u) {
            var dn = getUserName(u);
            var ini = getInitials(dn);
            avatarHtml += (
              '<div title="' + Utils.escapeHtml(dn) + '" ' +
                'style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);' +
                'display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;' +
                'border:2px solid rgba(255,255,255,0.08);flex-shrink:0;">' +
                ini +
              '</div>'
            );
          });
          if (users.length > 4) {
            avatarHtml += '<div style="width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,0.08);' +
              'display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:#888;' +
              'border:2px solid rgba(255,255,255,0.08);">+' + (users.length-4) + '</div>';
          }

          var empCell;
          if (isAdmin) {
            empCell = (
              '<div style="position:relative;">' +
                '<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-bottom:6px;">' +
                  (avatarHtml || '<span style="font-size:11px;color:#666;">None</span>') +
                '</div>' +
                (isEditing ? 
                  '<button onclick="Projects.openEmployeeEditor(\'' + id + '\')" ' +
                    'style="font-size:11px;padding:3px 10px;background:rgba(99,102,241,0.12);color:#a5b4fc;' +
                    'border:1px solid rgba(99,102,241,0.3);border-radius:6px;cursor:pointer;white-space:nowrap;">' +
                    '✏️ Assign</button>' 
                  : ''
                ) +
                // Inline employee editor dropdown
                '<div id="emp-editor-' + id + '" class="inline-emp-editor" data-pid="' + id + '" ' +
                  'style="display:none;position:absolute;top:100%;left:0;z-index:200;min-width:220px;' +
                  'background:rgba(18,18,36,0.97);border:1px solid rgba(99,102,241,0.3);border-radius:10px;' +
                  'box-shadow:0 8px 32px rgba(0,0,0,0.5);padding:6px 0;backdrop-filter:blur(10px);">' +
                  '<div style="padding:6px 10px 4px;font-size:10px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.08em;">Assign Employees</div>' +
                  '<div id="emp-list-' + id + '" style="max-height:180px;overflow-y:auto;"></div>' +
                  '<div style="padding:8px 10px;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:6px;">' +
                    '<button onclick="Projects.saveEmployees(\'' + id + '\')" ' +
                      'style="flex:1;padding:6px;font-size:12px;background:#7c3aed;color:#fff;border:none;border-radius:6px;cursor:pointer;">Save</button>' +
                    '<button onclick="document.getElementById(\'emp-editor-' + id + '\').style.display=\'none\'" ' +
                      'style="padding:6px 10px;font-size:12px;background:rgba(255,255,255,0.06);color:#888;border:1px solid rgba(255,255,255,0.08);border-radius:6px;cursor:pointer;">✕</button>' +
                  '</div>' +
                '</div>' +
              '</div>'
            );
          } else {
            empCell = '<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">' +
              (avatarHtml || '<span style="font-size:11px;color:#666;">—</span>') +
              '</div>';
          }

          // --- Actions cell ---
          var actionsCell = '';
          if (isAdmin) {
            if (isEditing) {
              actionsCell = (
                '<div style="display:flex;gap:6px;justify-content:center;">' +
                  '<button onclick="Projects.exitEditRow()" title="Cancel / Done" ' +
                    'style="padding:5px 9px;font-size:12px;background:rgba(34,197,94,0.15);color:#22c55e;' +
                    'border:1px solid rgba(34,197,94,0.3);border-radius:8px;cursor:pointer;">✅ Done</button>' +
                '</div>'
              );
            } else {
              actionsCell = (
                '<div style="display:flex;gap:6px;justify-content:center;">' +
                  '<button onclick="Projects.enterEditRow(\'' + id + '\')" title="Edit Row" ' +
                    'style="padding:5px 9px;font-size:12px;background:rgba(99,102,241,0.15);color:#a5b4fc;' +
                    'border:1px solid rgba(99,102,241,0.3);border-radius:8px;cursor:pointer;">✏️</button>' +
                  '<button onclick="Projects.deleteProject(\'' + id + '\')" title="Delete" ' +
                    'style="padding:5px 9px;font-size:12px;background:rgba(239,68,68,0.1);color:#f87171;' +
                    'border:1px solid rgba(239,68,68,0.2);border-radius:8px;cursor:pointer;">🗑️</button>' +
                '</div>'
              );
            }
          }

          // Row highlight if this project was clicked from compact view or being edited
          var rowStyle = (isHighlit || isEditing)
            ? 'background:rgba(99,102,241,0.12);border-left:3px solid #7c3aed;'
            : '';

          return (
            '<tr style="' + rowStyle + 'transition:background 0.15s;" ' +
              'id="proj-row-' + id + '" ' +
              'onmouseover="this.style.background=\'rgba(255,255,255,0.03)\'" ' +
              'onmouseout="this.style.background=\'' + (isHighlit ? 'rgba(99,102,241,0.12)' : '') + '\'">' +
              '<td style="text-align:center;color:#888;font-size:12px;">' + (idx+1) + '</td>' +
              '<td><div style="font-weight:600;color:var(--text-main);font-size:13px;">' + name + '</div></td>' +
              '<td>' + timelineCell + '</td>' +
              '<td>' + slaCell + '</td>' +
              '<td style="text-align:center;">' + logoCell + '</td>' +
              '<td style="text-align:center;">' + accessCell + '</td>' +
              '<td>' + empCell + '</td>' +
              '<td>' + actionsCell + '</td>' +
            '</tr>'
          );
        } catch (err) {
          console.error("Error rendering project row:", err, project);
          return '<tr><td colspan="8" style="color:#ef4444;">Error rendering project: ' + (project.name || 'Unnamed') + '</td></tr>';
        }
      }).join('');

      if (_highlightId) {
        var row = document.getElementById('proj-row-' + _highlightId);
        if (row) setTimeout(function() { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
      }
    } catch (err) {
      console.error("Projects.renderDetailed crashed:", err);
      var tbody = document.getElementById('projectDetailTableBody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="color:#ef4444; padding:20px;">Fatal error in Project renderer.</td></tr>';
    }
  }



  // ---------------------------------------------------------------------------
  // Edit / Cancel helpers
  // ---------------------------------------------------------------------------

  /**
   * Enters edit mode for a specific row.
   */
  function enterEditRow(id) {
    _editingRowId = id;
    renderDetailed();
  }

  /**
   * Internal exit edit row.
   */
  function exitEditRow() {
    _editingRowId = null;
    renderDetailed();
  }

  /**
   * Cancels edit mode.
   */
  function cancelEdit() {
    State.currentEditProjectId = null;
    clearForm();
    clearImageUpload();

    var saveBtn   = document.getElementById('projectSaveBtn');
    var updateBtn = document.getElementById('projectUpdateBtn');
    var cancelBtn = document.getElementById('projectCancelBtn');
    if (saveBtn)   saveBtn.style.display   = 'inline-block';
    if (updateBtn) updateBtn.style.display = 'none';
    if (cancelBtn) cancelBtn.style.display = 'none';
  }

  /** Clears all project-form inputs and unchecks user checkboxes. */
  function clearForm() {
    var nameInput  = document.getElementById('newProjectName');
    var startInput = document.getElementById('newProjectStartDate');
    var endInput   = document.getElementById('newProjectEndDate');

    if (nameInput)  nameInput.value  = '';
    if (startInput) startInput.value = '';
    if (endInput)   endInput.value   = '';

    document.querySelectorAll('.project-user-checkbox').forEach(function (cb) {
      cb.checked = false;
    });
    document.querySelectorAll('.multiselect-item').forEach(function(item) {
      item.classList.remove('selected');
    });
    if (window.Users && typeof window.Users.updateChips === 'function') {
      window.Users.updateChips();
    }
  }

  // ---------------------------------------------------------------------------
  // Drag-and-drop support for project image upload
  // ---------------------------------------------------------------------------

  function initDragDrop() {
    const area = document.getElementById('projectUploadArea');
    if (!area) return;

    area.addEventListener('dragover', function (e) {
      e.preventDefault();
      area.style.borderColor = 'var(--accent)';
    });
    area.addEventListener('dragleave', function () {
      area.style.borderColor = '';
    });
    area.addEventListener('drop', function (e) {
      e.preventDefault();
      area.style.borderColor = '';
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      previewImage({ target: { files: [file], value: '' } });
    });
    area.addEventListener('click', function (e) {
      if (e.target.tagName === 'INPUT') return;
      const input = document.getElementById('projectImageInput');
      if (input) input.click();
    });
  }

  /**
   * Saves Start and End dates for a project.
   */
  async function saveDates(id) {
    const startInput = document.getElementById('start-input-' + id);
    const endInput   = document.getElementById('end-input-' + id);
    if (!startInput || !endInput) return;

    const startDate = startInput.value;
    const endDate   = endInput.value;

    // Validate: prevent past dates
    var today = new Date(); today.setHours(0,0,0,0);
    if (startDate) {
      var startD = new Date(startDate); startD.setHours(0,0,0,0);
      if (startD < today) {
        UI.showToast('Start date cannot be in the past.', '#ef4444');
        startInput.focus();
        return;
      }
    }
    if (endDate) {
      var endD = new Date(endDate); endD.setHours(0,0,0,0);
      if (endD < today) {
        UI.showToast('End date cannot be in the past.', '#ef4444');
        endInput.focus();
        return;
      }
    }
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      UI.showToast('End date must be on or after the start date.', '#ef4444');
      endInput.focus();
      return;
    }

    UI.showLoading('Saving dates...');
    try {
      await API.put('/api/projects', { _id: id, startDate, endDate });
      const project = State.projects.find(function(p) { return p._id === id; });
      if (project) {
        project.startDate = startDate;
        project.endDate   = endDate;
      }
      _editingRowId = null;
      renderDetailed();
      UI.showToast('Project timeline updated.');
    } catch (err) {
      UI.showToast('Failed to save dates: ' + err.message, '#ef4444');
    } finally {
      UI.hideLoading();
    }
  }

  /**
   * Specific logic for table date inputs validation and defaults.
   */
  function handleTableDateChange(id, type) {
    var startInput = document.getElementById('start-input-' + id);
    var endInput   = document.getElementById('end-input-' + id);
    if (!startInput || !endInput) return;

    // Enforce today as minimum for start date
    var today = new Date();
    var todayStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
    if (!startInput.min) startInput.min = todayStr;

    if (type === 'start' && startInput.value) {
      // Reject past start date
      if (startInput.value < todayStr) {
        UI.showToast('Start date cannot be in the past.', '#ef4444');
        startInput.value = todayStr;
      }
      // Set default end date to start + 15 days
      var startD = new Date(startInput.value);
      startD.setDate(startD.getDate() + 15);
      var endStr = startD.getFullYear() + '-' + 
                   String(startD.getMonth() + 1).padStart(2, '0') + '-' + 
                   String(startD.getDate()).padStart(2, '0');
      endInput.value = endStr;
      endInput.min = startInput.value;
    }

    if (type === 'end' && endInput.value) {
      // Reject past end date
      if (endInput.value < todayStr) {
        UI.showToast('End date cannot be in the past.', '#ef4444');
        endInput.value = '';
      }
      // Reject end before start
      if (startInput.value && endInput.value < startInput.value) {
        UI.showToast('End date must be on or after the start date.', '#ef4444');
        endInput.value = startInput.value;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Date and Input Logic
  // ---------------------------------------------------------------------------

  function setupDateLogic() {
    var today = new Date();
    var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

    // Apply to Main Form
    var mainStart = document.getElementById('newProjectStartDate');
    var mainEnd   = document.getElementById('newProjectEndDate');

    if (mainStart && mainEnd) {
      mainStart.min = todayStr;
      mainEnd.min   = todayStr;
      mainStart.addEventListener('change', function() {
        if (this.value) {
          // Reject past date
          if (this.value < todayStr) {
            UI.showToast('Start date cannot be in the past.', '#ef4444');
            this.value = todayStr;
          }
          mainEnd.min = this.value;
          var startD = new Date(this.value);
          startD.setDate(startD.getDate() + 15);
          var endStr = startD.getFullYear() + '-' + 
                       String(startD.getMonth() + 1).padStart(2, '0') + '-' + 
                       String(startD.getDate()).padStart(2, '0');
          mainEnd.value = endStr;
        }
      });
      mainEnd.addEventListener('change', function() {
        if (this.value) {
          if (this.value < todayStr) {
            UI.showToast('End date cannot be in the past.', '#ef4444');
            this.value = '';
          }
          if (mainStart.value && this.value < mainStart.value) {
            UI.showToast('End date must be on or after the start date.', '#ef4444');
            this.value = mainStart.value;
          }
        }
      });
    }

    // Global listener for "type yyyy only" restriction
    // This blocks non-numeric input for project date fields to encourage yyyy typing
    document.addEventListener('keydown', function(e) {
      const isDateInput = e.target.type === 'date' && 
                         (e.target.id.includes('ProjectStartDate') || 
                          e.target.id.includes('ProjectEndDate') || 
                          e.target.id.includes('-input-'));
      
      if (isDateInput) {
        // Allow: Navigation (Arrows, Tab, Home, End), Delete, Backspace, Enter
        const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
        if (allowedKeys.includes(e.key)) return;
        
        // Block anything that isn't a digit
        if (!/^\d$/.test(e.key)) {
          e.preventDefault();
        }
      }
    });
  }

  function init() {
    initDragDrop();
    setupDateLogic();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ---------------------------------------------------------------------------
  // Quick Project Add (from User Management)
  // ---------------------------------------------------------------------------

  function openQuickModal() {
    const modal = document.getElementById('quickProjectModal');
    if (modal) modal.style.display = 'flex';
    const nameInput = document.getElementById('quickProjectName');
    if (nameInput) { nameInput.value = ''; nameInput.focus(); }
    clearQuickImage();
  }

  function closeQuickModal() {
    const modal = document.getElementById('quickProjectModal');
    if (modal) modal.style.display = 'none';
  }

  function clearQuickImage() {
    State.currentQuickProjectBase64 = null;
    const input       = document.getElementById('quickProjectImageInput');
    const preview     = document.getElementById('quickProjectImagePreview');
    const placeholder = document.getElementById('quickProjectUploadPlaceholder');
    if (input)       input.value = '';
    if (preview)     { preview.src = ''; preview.style.display = 'none'; }
    if (placeholder) placeholder.style.display = 'block';
  }

  async function previewQuickImage(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      const compressed = await Utils.compressImage(file, 800, 0.82);
      State.currentQuickProjectBase64 = compressed;
      const preview     = document.getElementById('quickProjectImagePreview');
      const placeholder = document.getElementById('quickProjectUploadPlaceholder');
      if (preview)     { preview.src = compressed; preview.style.display = 'block'; }
      if (placeholder) placeholder.style.display = 'none';
    } catch (err) {
      UI.showToast('Image preview failed: ' + err.message, '#ef4444');
    }
  }

  async function saveQuickProject() {
    const nameInput = document.getElementById('quickProjectName');
    const name      = nameInput ? nameInput.value.trim() : '';
    const saveBtn   = document.getElementById('saveQuickProjectBtn');
    if (!name) { UI.showToast('Project name is required.', '#ef4444'); return; }

    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
    UI.showLoading('Creating project...');
    try {
      const project = await API.post('/api/projects', {
        name,
        users: [],
        brandImage: State.currentQuickProjectBase64,
      });

      if (project) {
        State.projects.push(project);
        render();
        if (window.Users && typeof window.Users.populateForProjects === 'function') {
          window.Users.populateForProjects();
        }
        const userProjectInput = document.getElementById('userProject');
        if (userProjectInput) userProjectInput.value = project.name;
        closeQuickModal();
        UI.showToast('Project created and selected.');
      }
    } catch (err) {
      UI.showToast('Failed to add project: ' + err.message, '#ef4444');
    } finally {
      UI.hideLoading();
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Save Project'; }
    }
  }

  // ---------------------------------------------------------------------------
  // Row Edit Handlers
  // ---------------------------------------------------------------------------

  /**
   * Puts a specific project row into edit mode.
   * @param {string} id  Project ID
   */
  function enterEditRow(id) {
    _editingRowId = id;
    renderDetailed();
  }

  /**
   * Exits edit mode and refreshes the table.
   */
  function exitEditRow() {
    _editingRowId = null;
    renderDetailed();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  window.Projects = {
    load,
    switchView,
    previewImage,
    clearImageUpload,
    add,
    update,
    editProject,
    deleteProject,
    saveSla,
    openSlaEditor,
    closeSlaEditor,
    saveExternalAccess,
    openEmployeeEditor,
    saveEmployees,
    render,
    renderDetailed,
    saveDates,
    handleTableDateChange,
    openQuickModal,
    closeQuickModal,
    clearQuickImage,
    previewQuickImage,
    saveQuickProject,
    enterEditRow,
    exitEditRow,
    cancelEdit
  };

})();
