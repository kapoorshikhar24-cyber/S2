/**
 * entries.js — Entries module for the UAT Dashboard (Image & Remarks section).
 *
 * Handles submission and display of UAT entries created by external users.
 * Each entry can carry an attached screenshot and a remark, and is scoped
 * to the current user's assigned project.
 *
 * Depends on: window.API, window.State, window.UI, window.Utils
 * Usage: loaded via <script> tag — no ES modules.
 */

(function () {

  /**
   * Fetches all entries from the API and stores them in State.entries.
   * @returns {Promise<void>}
   */
  async function load() {
    try {
      const data = await API.get('/api/entries');
      if (data) State.entries = data;
    } catch (err) {
      UI.showToast('Failed to load entries: ' + err.message, '#ef4444');
    }
  }

  /**
   * Handles the file-input change event for an entry image attachment.
   * Validates file type and size, compresses, stores in State.currentImageData.
   * @param {Event} event
   * @returns {Promise<void>}
   */
  async function previewImage(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    // File type validation
    if (!file.type.startsWith('image/')) {
      UI.showToast('Please select a valid image file (JPG, PNG, etc.).', '#ef4444');
      event.target.value = '';
      return;
    }
    // File size validation (Vercel limit is 4.5MB; 3MB is safe for base64)
    if (file.size > 3 * 1024 * 1024) {
      UI.showToast('Image is too large. Max allowed size is 3MB.', '#ef4444');
      event.target.value = '';
      return;
    }

    try {
      const compressed = await Utils.compressImage(file, 1200, 0.80);
      State.currentImageData = compressed;

      const preview = document.getElementById('imagePreview');
      const placeholder = document.getElementById('uploadPlaceholder');
      const uploadArea = document.getElementById('uploadArea');

      if (preview) {
        preview.src = compressed;
        preview.style.display = 'block';
      }
      if (placeholder) placeholder.style.display = 'none';
      if (uploadArea) uploadArea.classList.add('has-image');
    } catch (err) {
      UI.showToast('Image preview failed: ' + err.message, '#ef4444');
    }
  }

  /**
   * Resets the entry image upload area to its empty state.
   */
  function resetUpload() {
    State.currentImageData = null;

    const preview = document.getElementById('imagePreview');
    const input = document.getElementById('imageInput');
    const placeholder = document.getElementById('uploadPlaceholder');
    const uploadArea = document.getElementById('uploadArea');

    if (preview) {
      preview.src = '';
      preview.style.display = 'none';
    }
    if (input) input.value = '';
    if (placeholder) placeholder.style.display = 'block';
    if (uploadArea) uploadArea.classList.remove('has-image');
  }

  /**
   * Validates and submits a new UAT entry.
   * @returns {Promise<void>}
   */
  async function add() {
    const moduleSelect = document.getElementById('pageModuleSelect');
    const customInput = document.getElementById('customModuleInput');
    const editor = document.getElementById('remarkEditor');
    const submitBtn = document.getElementById('submitEntryBtn');

    let pageModule = moduleSelect ? moduleSelect.value : '';
    if (pageModule === 'Other') {
      pageModule = customInput ? customInput.value.trim() : '';
    }

    if (!pageModule) {
      UI.showToast('Page / Module is required.', '#ef4444');
      if (moduleSelect) moduleSelect.focus();
      return;
    }

    const remark = editor ? editor.innerHTML.trim() : '';

    if (remark === '<br>' || remark === '<div><br></div>') {
        // Handle empty contenteditable states
        if (!State.currentImageData) {
            UI.showToast('Please add an image or a remark before submitting.', '#ef4444');
            return;
        }
    }

    if (!State.currentImageData && (!remark || remark === '')) {
      UI.showToast('Please add an image or a remark before submitting.', '#ef4444');
      return;
    }

    // Show loading state
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Submitting...';
    }
    UI.showLoading('Submitting entry...');

    try {
      const payload = {
        image: State.currentImageData || null,
        remark: remark,
        pageModule: pageModule,
        project: State.currentUser ? State.currentUser.project : null,
      };

      const entry = await API.post('/api/entries', payload);

      if (entry) {
        // Also create a notification for the admin / project team
        try {
          await API.post('/api/notifications', entry);
        } catch (notifErr) {
          console.warn('[Entries] Failed to create notification:', notifErr.message);
        }

        State.entries.unshift(entry);

        // Reload notifications so the badge / list reflects the new item
        if (window.Notifications && typeof window.Notifications.load === 'function') {
          await window.Notifications.load();
        }

        render();
        resetUpload();

        // Clear form fields
        if (moduleSelect) moduleSelect.value = '';
        if (customInput) customInput.value = '';
        if (editor) editor.innerHTML = '';

        UI.showToast('Entry submitted successfully.');
        UI.showNotifPopup(entry);
      }
    } catch (err) {
      UI.showToast('Failed to submit entry: ' + err.message, '#ef4444');
    } finally {
      UI.hideLoading();
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '📤 Submit Entry';
      }
    }
  }

  /**
   * Updates a single field on an existing entry via API.put, then syncs the
   * change into State.entries and State.notifications (if present).
   * FIX: payload must be { _id, [field]: value } — not { _id, field, value }.
   * @param {string} id     Entry _id
   * @param {string} field  Field name to update (e.g. 'customerStatus')
   * @param {string} value  New value
   * @returns {Promise<void>}
   */
  async function updateField(id, field, value) {
    UI.showLoading('Saving changes...');
    try {
      // Update entries collection; backend also syncs to notifications collection
      // and sets read=false so admin is notified of the user's feedback
      await API.put('/api/entries', { _id: id, [field]: value });

      // Update in State.entries
      const entry = State.entries.find(function (e) { return e._id === id; });
      if (entry) entry[field] = value;

      // Sync the same field in State.notifications so admin sees update in-memory too
      const notif = State.notifications.find(function (n) { return n._id === id; });
      if (notif) {
        notif[field] = value;
        notif.read = false; // mark unread for admin — user responded
      }

      UI.showToast('Saved.', '#22c55e');
      State.editingRemarkId = null; // Clear edit mode after save
      render();

      if (window.Notifications && typeof window.Notifications.renderTable === 'function') {
        window.Notifications.renderTable();
      }
    } catch (err) {
      UI.showToast('Failed to update entry: ' + err.message, '#ef4444');
    } finally {
      UI.hideLoading();
    }
  }

  /**
   * Renders the entries table body (#entriesTableBody), filtered to entries
   * that belong to the currently authenticated user (State.currentUser.username).
   * FIX: filter by e.submittedBy (not e.username which doesn't exist in DB schema).
   * Includes all columns: image, module, remarks, raised by, date, status, solved date,
   * CCC comments, customer status, customer comment.
   */
  function render() {
    const tbody = document.getElementById('entriesTableBody');
    const empty = document.getElementById('emptyEntries');

    if (!tbody) return;

    // FIXED: filter by submittedBy (the field stored in DB), not username
    const username = State.currentUser ? State.currentUser.username : null;
    const filtered = State.entries.filter(function (e) {
      return e.submittedBy === username;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }

    if (empty) empty.style.display = 'none';

    tbody.innerHTML = filtered.map(function (entry, idx) {
      const id = Utils.escapeHtml(String(entry._id));
      const csBadgeClass = Utils.getBadgeClass(entry.customerStatus || '');
      // Highlight rows where admin has responded but user hasn't acknowledged
      const isUnread = entry.userRead === false;
      const unreadDot = isUnread
        ? '<span title="New update from admin" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#7c3aed;margin-right:4px;vertical-align:middle;"></span>'
        : '';
      const rowStyle = isUnread ? ' style="background:rgba(124,58,237,0.05);"' : '';

      const thumbHtml = entry.image
        ? '<img src="' + Utils.escapeHtml(entry.image) + '" ' +
        'alt="entry image" ' +
        'style="height:48px;width:auto;border-radius:4px;object-fit:cover;cursor:pointer;" ' +
        'onclick="UI.openImageModal(\'' + Utils.escapeHtml(entry.image) + '\')" />'
        : '<span style="color:var(--text-muted);">—</span>';

      const adminStatusBadgeClass = Utils.getBadgeClass(entry.status || '');

      // Customer status select
      const csOptions = ['Pending', 'In Review', 'Accepted', 'Rejected']
        .map(function (s) {
          const selected = (entry.customerStatus || '') === s ? ' selected' : '';
          return '<option value="' + s + '"' + selected + '>' + s + '</option>';
        }).join('');

      const customerStatusSelect =
        '<select class="status-select ' + csBadgeClass + '" ' +
        'onchange="Entries.updateField(\'' + id + '\', \'customerStatus\', this.value);' +
                  'this.className = \'status-select \' + Utils.getBadgeClass(this.value);">' +
        csOptions +
        '</select>';

      // Admin comments view
      const internalCommentHtml = entry.internalComment
        ? (isUnread
          ? '<span style="color:var(--accent);font-weight:600;">' + Utils.escapeHtml(entry.internalComment) + '</span>'
          : Utils.escapeHtml(entry.internalComment))
        : '<span style="color:var(--text-muted);">—</span>';

      return '<tr' + rowStyle + ' onclick="Entries.markEntryRead(\'' + id + '\')" style="cursor:default;">' +
        '<td>' + unreadDot + (idx + 1) + '</td>' +
        '<td>' + thumbHtml + '</td>' +
        '<td>' + Utils.escapeHtml(entry.pageModule || '—') + '</td>' +
        '<td>' + (entry.remark || '—') + '</td>' +
        '<td>' + Utils.escapeHtml(entry.submittedBy || '—') + '</td>' +
        '<td>' + Utils.formatDate(entry.date || entry.createdAt) + '</td>' +
        '<td><span class="badge ' + adminStatusBadgeClass + '">' + Utils.escapeHtml(entry.status || 'Backlog') + '</span></td>' +
        '<td>' + Utils.formatDate(entry.solvedDate) + '</td>' +
        '<td>' + internalCommentHtml + '</td>' +
        '<td>' + customerStatusSelect + '</td>' +
        '<td>' +
        (function () {
          const active = window.State.activeTableEditor;
          const isEditing = active && active.id === id && active.field === 'customerComment';
          const comment = entry.customerComment || '';

          if (isEditing) {
            const onSave = 'window.Entries.updateField(\'' + id + '\', \'customerComment\', document.getElementById(\'inline-editor-' + id + '-customerComment\').innerHTML); window.UI.closeActiveEditor();';
            const onCancel = 'window.UI.closeActiveEditor()';
            return window.UI.renderInlineRichEditor(id, 'customerComment', comment, onSave, onCancel);
          } else if (!comment) {
            return (
              '<div class="add-remark-link" style="color:var(--primary); font-size:12px; cursor:pointer; font-weight:600;" ' +
                'onclick="window.Entries.setTableEditing(\'' + id + '\', \'customerComment\')">' +
                '<span class="plus-sign">+</span> Add remark...' +
              '</div>'
            );
          } else {
            return (
              '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">' +
                '<div style="font-size:12px; color:var(--text-main); font-weight:500; line-height:1.4; max-width:200px;">' + comment + '</div>' +
                '<button class="btn-ghost" style="padding:2px 6px; font-size:10px; opacity:0.6;" ' +
                  'onclick="window.Entries.setTableEditing(\'' + id + '\', \'customerComment\')">' +
                  '✏️ Edit' +
                '</button>' +
              '</div>'
            );
          }
        })() +
        '</td>' +
        '<td>' +
          (function () {
            const hasCcc      = !!entry.internalComment;
            const hasCustomer = !!entry.customerComment;
            const hasHistory  = (entry.comments && entry.comments.length > 0);
            const showThread  = (hasCcc && hasCustomer) || hasHistory;
            
            if (showThread) {
              const count = (entry.comments ? entry.comments.length : 0) + (hasCcc ? 1 : 0) + (hasCustomer ? 1 : 0);
              return '<button class="btn-secondary" style="font-size:11px; padding:4px 8px; white-space:nowrap;" ' +
                     'onclick="window.Notifications.openCommentsModal(\'' + id + '\')">' +
                     '💬 Thread (' + count + ')</button>';
            } else {
              return '<span style="font-size:10px; opacity:0.3;">Locked</span>';
            }
          })() +
        '</td>' +
        '</tr>';
    }).join('');

    // Update the unread badge for external users
    if (window.Auth && typeof window.Auth.updateUserUnreadBadge === 'function') {
      window.Auth.updateUserUnreadBadge();
    }
  }

  /**
   * Marks a single entry as userRead = true so the unread indicator clears.
   * Called when the user clicks on an entry row.
   */
  async function markEntryRead(id) {
    // If the click is on an interactive element, don't trigger row read/refresh-loop
    const target = event && event.target;
    if (target && (target.tagName === 'SELECT' || target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.isContentEditable)) {
        return;
    }

    const entry = State.entries.find(function (e) { return e._id === id; });
    if (!entry || entry.userRead !== false) return; // already read

    entry.userRead = true; // optimistic update
    render();

    try {
      await API.put('/api/entries', { _id: id, userRead: true });
    } catch (err) {
      // revert on failure
      entry.userRead = false;
      render();
    }
  }

  // ---------------------------------------------------------------------------
  // exportCSV — downloads the current user's entries as a CSV file
  // ---------------------------------------------------------------------------

  function exportCSV() {
    const username = State.currentUser ? State.currentUser.username : null;
    const filtered = State.entries.filter(function (e) {
      return e.submittedBy === username;
    });

    if (!filtered || filtered.length === 0) {
      UI.showToast('No entries to export.', '#f59e0b');
      return;
    }

    const headers = ['#', 'Page/Module', 'Remarks', 'Raised By', 'Created', 'Status', 'Solved Date', 'CCC Comments', 'Customer Status', 'Customer Comment'];

    function csvCell(val) {
      const s = String(val == null ? '' : val).replace(/"/g, '""');
      return '"' + s + '"';
    }

    const rows = filtered
      .slice()
      .sort(function (a, b) {
        return new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0);
      })
      .map(function (e, idx) {
        return [
          idx + 1,
          e.pageModule || '',
          e.remark || '',
          e.submittedBy || '',
          Utils.formatDate(e.date || e.createdAt),
          e.status || 'Backlog',
          Utils.formatDate(e.solvedDate),
          e.internalComment || '',
          e.customerStatus || '',
          e.customerComment || '',
        ].map(csvCell).join(',');
      });

    const content = [headers.map(csvCell).join(',')].concat(rows).join('\n');
    const timestamp = new Date().toISOString().slice(0, 10);
    Utils.downloadCSV(content, 'my-entries-' + timestamp + '.csv');
    UI.showToast('CSV exported successfully.');
  }

  // ---------------------------------------------------------------------------
  // Drag-and-drop support for entry image upload
  // ---------------------------------------------------------------------------

  function initDragDrop() {
    const area = document.getElementById('uploadArea');
    if (!area) return;

    area.addEventListener('dragover', function (e) {
      e.preventDefault();
      area.style.borderColor = 'var(--accent)';
      area.style.background = 'rgba(124,58,237,0.08)';
    });

    area.addEventListener('dragleave', function () {
      area.style.borderColor = '';
      area.style.background = '';
    });

    area.addEventListener('drop', function (e) {
      e.preventDefault();
      area.style.borderColor = '';
      area.style.background = '';
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      previewImage({ target: { files: [file], value: '' } });
    });

    // Click anywhere on the upload area (except on img preview) to trigger input
    area.addEventListener('click', function (e) {
      if (e.target.tagName === 'IMG') return;
      if (e.target.tagName === 'INPUT') return;
      const input = document.getElementById('imageInput');
      if (input) input.click();
    });
  }

  function initEditorShortcuts() {
    const editor = document.getElementById('remarkEditor');
    if (!editor) return;

    editor.addEventListener('keydown', function(e) {
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'l' && e.shiftKey) {
           e.preventDefault();
           Entries.execCommand('insertUnorderedList');
        } else if (key === 'l') {
           e.preventDefault();
           Entries.execCommand('justifyLeft');
        } else if (key === 'e') {
           e.preventDefault();
           Entries.execCommand('justifyCenter');
        } else if (key === 'r') {
           e.preventDefault();
           Entries.execCommand('justifyRight');
        }
      }
    });
  }

  // Run init after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initDragDrop();
        initEditorShortcuts();
    });
  } else {
    initDragDrop();
    initEditorShortcuts();
  }

  /**
   * Sets the editing mode for a specific entry's remark.
   * @param {string|null} id
   */
  function setEditing(id) {
    State.editingRemarkId = id;
    render();
  }

  function setTableEditing(id, field) {
    window.State.activeTableEditor = { id, field };
    render();
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  window.Entries = {
    load,
    render,
    previewImage,
    resetUpload,
    add,
    execCommand: function(cmd, value = null) {
        document.execCommand(cmd, false, value);
        const active = window.State.activeTableEditor;
        if (active) {
          const inline = document.getElementById('inline-editor-' + active.id + '-' + active.field);
          if (inline) inline.focus();
        } else {
          const editor = document.getElementById('remarkEditor');
          if (editor) editor.focus();
        }
    },
    updateField,
    markEntryRead,
    exportCSV,
    setEditing,
    setTableEditing,
  };

})();
