/**
 * notifications.js — Notifications module for the UAT Dashboard.
 *
 * Manages loading, rendering, badge counts, bell-dropdown, status updates,
 * CSV export, and status filter for user notifications.
 *
 * Depends on: window.API, window.State, window.UI, window.Utils
 */

(function () {

  // ---------------------------------------------------------------------------
  // 1. load
  // ---------------------------------------------------------------------------

  async function load() {
    try {
      const data = await window.API.get('/api/notifications');
      window.State.notifications = Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('[Notifications] load error:', err);
      window.State.notifications = [];
    }
  }

  // ---------------------------------------------------------------------------
  // 2. updateBadge
  // ---------------------------------------------------------------------------

  function updateBadge() {
    const user = window.State.currentUser;
    const isInternal = user && (user.role === 'admin' || user.type === 'internal');

    const unread = window.State.notifications.filter(function (n) {
      // Admin/Internal check the 'read' flag (notifications for them)
      // External users check the 'userRead' flag (notifications for updates)
      return isInternal ? !n.read : !n.userRead;
    }).length;

    ['notifBadge', 'bellBadge'].forEach(function (id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent  = unread;
      el.style.display = unread > 0 ? '' : 'none';
    });

    ['markAllReadBtn', 'bellMarkAllBtn'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.style.display = unread > 0 ? '' : 'none';
    });
  }

  // ---------------------------------------------------------------------------
  // 3. markAsRead
  // ---------------------------------------------------------------------------

  async function markAsRead(id) {
    try {
      await window.API.put('/api/notifications', { _id: id });

      const notif = window.State.notifications.find(function (n) { return n._id === id; });
      if (notif) notif.read = true;

      updateBadge();
      renderTable();
      populateBellDropdown();
    } catch (err) {
      console.error('[Notifications] markAsRead error:', err);
    }
  }

  // ---------------------------------------------------------------------------
  // 4. markAllRead
  // ---------------------------------------------------------------------------

  async function markAllRead() {
    window.UI.showLoading('Marking all as read...');
    try {
      await window.API.put('/api/notifications', { markAllRead: true });
      window.State.notifications.forEach(function (n) { n.read = true; });
      updateBadge();
      renderTable();
      populateBellDropdown();
      window.UI.showToast('All notifications marked as read.');
    } catch (err) {
      console.error('[Notifications] markAllRead error:', err);
      window.UI.showToast('Failed to mark all as read.', '#ef4444');
    } finally {
      window.UI.hideLoading();
    }
  }

  // ---------------------------------------------------------------------------
  // 5. toggleBellDropdown
  // ---------------------------------------------------------------------------

  function toggleBellDropdown() {
    const dropdown = document.getElementById('bellDropdown');
    if (!dropdown) return;
    const isOpen = dropdown.classList.toggle('open');
    if (isOpen) populateBellDropdown();
  }

  function closeBellDropdown() {
    const dropdown = document.getElementById('bellDropdown');
    if (dropdown) dropdown.classList.remove('open');
  }

  // ---------------------------------------------------------------------------
  // 6. populateBellDropdown
  // ---------------------------------------------------------------------------

  function populateBellDropdown() {
    const body = document.getElementById('bellDropdownBody');
    if (!body) return;

    const notifications = window.State.notifications;

    const recent = notifications
      .slice()
      .sort(function (a, b) {
        return new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0);
      })
      .slice(0, 8);

    if (recent.length === 0) {
      body.innerHTML = '<div class="bell-empty">No notifications yet</div>';
      return;
    }

    body.innerHTML = recent.map(function (n) {
      const user = window.State.currentUser;
      const isInternal = user && (user.role === 'admin' || user.type === 'internal');
      const isUnread = isInternal ? !n.read : !n.userRead;
      
      const unreadClass = isUnread ? ' unread' : '';
      const submittedBy = window.Utils.escapeHtml(n.submittedBy || '—');
      const pageModule  = window.Utils.escapeHtml(n.pageModule  || '—');
      const project     = window.Utils.escapeHtml(n.project     || '');
      const dateStr     = window.Utils.formatDate(n.date || n.createdAt);
      const id          = window.Utils.escapeHtml(n._id);

      return (
        '<div class="bell-item' + unreadClass + '" ' +
          'onclick="window.Notifications.handleBellItemClick(\'' + id + '\')" ' +
          'role="button" tabindex="0">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<span class="bell-item-user">' + submittedBy + '</span>' +
            (project ? '<span style="font-size:10px;color:rgba(165,180,252,0.8);background:rgba(99,102,241,0.1);padding:2px 8px;border-radius:10px;border:1px solid rgba(99,102,241,0.2);">' + project + '</span>' : '') +
          '</div>' +
          '<span class="bell-item-module">' + pageModule + '</span>' +
          '<span class="bell-item-date">' + dateStr + '</span>' +
        '</div>'
      );
    }).join('');
  }

  // ---------------------------------------------------------------------------
  // 6.5 handleBellItemClick
  // ---------------------------------------------------------------------------

  async function handleBellItemClick(id) {
    // Fire the mark as read action immediately in background
    markAsRead(id).catch(err => console.error(err));

    // Determine target location data
    const notif = window.State.notifications.find(function(n) { return n._id === id; });
    const user = window.State.currentUser;
    const isInternal = user && (user.role === 'admin' || user.role === 'internal');

    // Jump user to the correct dashboard section based on role
    if (isInternal) {
      window.UI.switchSection('notifications');
      closeBellDropdown();

      // Contextualize the search filter precisely if we found the notification record
      if (notif) {
        const searchEl = document.getElementById('notifGeneralSearch');
        if (searchEl) {
            // Pre-populate search bar with the context of the notification and forcefully render
            searchEl.value = notif.project || '';
            renderTable();
        }
      }
    } else {
      // External users go to Image & Remarks
      window.UI.switchSection('images');
      closeBellDropdown();
    }
  }

  // ---------------------------------------------------------------------------
  // 7. updateStatus — with save feedback
  // ---------------------------------------------------------------------------

  async function updateStatus(id, field, value) {
    try {
      const updatePayload = { _id: id, [field]: value };

      if (field === 'status' && value === 'Solved') {
        updatePayload.solvedDate = new Date().toISOString();
      }

      window.UI.showLoading('Updating status...');
      // Use /api/notifications so the backend syncs BOTH collections and sets userRead=false
      await window.API.put('/api/notifications', updatePayload);

      // Reflect changes in local State.notifications
      const notif = window.State.notifications.find(function (n) { return n._id === id; });
      if (notif) {
        notif[field] = value;
        notif.read   = true;
        if (updatePayload.solvedDate) notif.solvedDate = updatePayload.solvedDate;
        if (field === 'internalComment' || field === 'status') notif.userRead = false;
      }

      // Sync matching entry in State.entries
      const entry = window.State.entries.find(function (e) { return e._id === id; });
      if (entry) {
        entry[field] = value;
        if (updatePayload.solvedDate) entry.solvedDate = updatePayload.solvedDate;
        if (field === 'internalComment' || field === 'status') entry.userRead = false;
      }

      window.UI.showToast('Saved.', '#22c55e');
      window.State.editingId = null; // Clear edit mode after save
      renderTable();
    } catch (err) {
      console.error('[Notifications] updateStatus error:', err);
      window.UI.showToast('Failed to update.', '#ef4444');
    } finally {
      window.UI.hideLoading();
    }
  }

  // ---------------------------------------------------------------------------
  // 8. exportCSV
  // ---------------------------------------------------------------------------

  function exportCSV() {
    const notifications = window.State.notifications;
    if (!notifications || notifications.length === 0) {
      window.UI.showToast('No data to export.', '#f59e0b');
      return;
    }

    const headers = ['#', 'Project', 'Page/Module', 'Remarks', 'Raised By', 'Created', 'Status', 'Solved Date', 'CCC Comments', 'Customer Status', 'Customer Comment'];

    function csvCell(val) {
      const s = String(val == null ? '' : val).replace(/"/g, '""');
      return '"' + s + '"';
    }

    const rows = notifications
      .slice()
      .sort(function (a, b) {
        return new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0);
      })
      .map(function (n, idx) {
        return [
          idx + 1,
          n.project      || '',
          n.pageModule   || '',
          n.remark       || '',
          n.submittedBy  || '',
          window.Utils.formatDate(n.date || n.createdAt),
          n.status       || 'Backlog',
          window.Utils.formatDate(n.solvedDate),
          n.internalComment  || '',
          n.customerStatus   || '',
          n.customerComment  || '',
        ].map(csvCell).join(',');
      });

    const content = [headers.map(csvCell).join(',')].concat(rows).join('\n');
    const timestamp = new Date().toISOString().slice(0, 10);
    window.Utils.downloadCSV(content, 'uat-report-' + timestamp + '.csv');
    window.UI.showToast('CSV exported successfully.');
  }

  // ---------------------------------------------------------------------------
  // 9. getSlaHtml — compute SLA badge for a single entry
  // ---------------------------------------------------------------------------

  function getSlaHtml(n) {
    // If the ticket is already solved/closed, show whether SLA was met or missed
    var resolvedStatuses = ['Solved', 'Closed'];
    var isClosed = resolvedStatuses.indexOf(n.status || 'Backlog') !== -1;

    if (!n.slaDeadline) {
      return '<span style="color:rgba(165,180,252,0.3); font-size:11px;">—</span>';
    }

    var deadline = new Date(n.slaDeadline);
    var compareDate = isClosed && n.solvedDate ? new Date(n.solvedDate) : new Date();
    var diffMs = deadline - compareDate;
    var diffHours = diffMs / (1000 * 60 * 60);

    if (isClosed) {
      if (diffMs >= 0) {
        // Solved before deadline — SLA Met
        return '<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3);padding:3px 8px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap;">✅ SLA Met</span>';
      } else {
        // Solved after deadline — SLA Breached
        var overHours = Math.abs(Math.ceil(diffHours));
        return '<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);padding:3px 8px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap;">❌ Breached (+' + overHours + 'h)</span>';
      }
    }

    // Open ticket — show live countdown
    if (diffMs < 0) {
      // Already breached
      var overH = Math.abs(Math.ceil(diffHours));
      return (
        '<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);padding:3px 8px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap;animation:sla-pulse 1.5s ease-in-out infinite;">🚨 Breached (' + overH + 'h ago)</span>'
      );
    } else if (diffHours <= 4) {
      // At risk — under 4 hours left
      var leftMin = Math.floor(diffMs / (1000 * 60));
      var leftDisp = leftMin >= 60 ? Math.ceil(diffHours) + 'h left' : leftMin + 'm left';
      return (
        '<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);padding:3px 8px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap;">⚠️ ' + leftDisp + '</span>'
      );
    } else {
      // Safe
      var hoursLeft = Math.ceil(diffHours);
      return (
        '<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(34,197,94,0.10);color:#22c55e;border:1px solid rgba(34,197,94,0.2);padding:3px 8px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap;">⏱ ' + hoursLeft + 'h left</span>'
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 10. renderTable — with status filter
  // ---------------------------------------------------------------------------

  function renderTable() {
    const tbody = document.getElementById('notifTableBody');
    if (!tbody) return;

    const dateSearchEl    = document.getElementById('notifDateSearch');
    const generalSearchEl = document.getElementById('notifGeneralSearch');
    const projectFilterEl = document.getElementById('notifProjectFilter');
    const statusFilterEl  = document.getElementById('notifStatusFilter');

    const dateFilter    = dateSearchEl    ? dateSearchEl.value.trim().toLowerCase()    : '';
    const generalFilter = generalSearchEl ? generalSearchEl.value.trim().toLowerCase() : '';
    const projectFilter = projectFilterEl ? projectFilterEl.value.trim().toLowerCase() : '';
    const statusFilter  = statusFilterEl  ? statusFilterEl.value.trim().toLowerCase()  : '';

    let notifications = window.State.notifications.slice().sort(function (a, b) {
      // Sort: Breached first, then by slaDeadline ASC (most urgent first), then by date DESC
      var now = new Date();
      var aBreached = a.slaDeadline && new Date(a.slaDeadline) < now && a.status !== 'Solved' && a.status !== 'Closed';
      var bBreached = b.slaDeadline && new Date(b.slaDeadline) < now && b.status !== 'Solved' && b.status !== 'Closed';
      if (aBreached && !bBreached) return -1;
      if (!aBreached && bBreached) return 1;
      return new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0);
    });

    if (dateFilter) {
      notifications = notifications.filter(function (n) {
        return window.Utils.formatDate(n.date || n.createdAt).toLowerCase().includes(dateFilter);
      });
    }

    if (generalFilter) {
      notifications = notifications.filter(function (n) {
        const haystack = [n.submittedBy || '', n.pageModule || '', n.remark || '', n.project || '', n.status || ''].join(' ').toLowerCase();
        return haystack.includes(generalFilter);
      });
    }

    if (statusFilter) {
      notifications = notifications.filter(function (n) {
        return (n.status || 'Backlog').toLowerCase() === statusFilter;
      });
    }

    if (projectFilter) {
      notifications = notifications.filter(function (n) {
        return (n.project || '').toLowerCase() === projectFilter;
      });
    }

    const emptyNotifs = document.getElementById('emptyNotifs');

    if (notifications.length === 0) {
      tbody.innerHTML = '';
      if (emptyNotifs) emptyNotifs.style.display = '';
      updateBadge();
      return;
    }

    if (emptyNotifs) emptyNotifs.style.display = 'none';

    tbody.innerHTML = notifications.map(function (n, idx) {
      const id            = window.Utils.escapeHtml(n._id || '');
      const project       = window.Utils.escapeHtml(n.project     || '—');
      const pageModule    = window.Utils.escapeHtml(n.pageModule  || '—');
      const remark        = n.remark              || '—';
      const submittedBy   = window.Utils.escapeHtml(n.submittedBy || '—');
      const dateStr       = window.Utils.formatDate(n.date || n.createdAt);
      const solvedDateStr = window.Utils.formatDate(n.solvedDate);
      const status        = n.status || 'Backlog';
      const customerStatus  = n.customerStatus  || '';
      const internalComment = window.Utils.escapeHtml(n.internalComment || '');
      const customerComment = window.Utils.escapeHtml(n.customerComment || '');
      const imgSrc        = n.image || n.imageData || '';
      const badgeClass    = window.Utils.getBadgeClass(status);
      const csBadgeClass  = window.Utils.getBadgeClass(customerStatus);
      const unreadDot     = !n.read ? '<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#7c3aed;margin-right:4px;vertical-align:middle;"></span>' : '';

      // SLA indicator
      const slaHtml = getSlaHtml(n);

      // Highlight entire row red if breached and still open
      var now = new Date();
      var isBreached = n.slaDeadline && new Date(n.slaDeadline) < now && status !== 'Solved' && status !== 'Closed';
      var rowStyle = isBreached
        ? 'background:rgba(239,68,68,0.05); border-left: 3px solid rgba(239,68,68,0.4);'
        : (!n.read ? 'background:rgba(124,58,237,0.05);' : '');

      // Conditional Thread Visibility: Only show if both parties have commented
      const hasCcc = !!n.internalComment;
      const hasCustomer = !!n.customerComment;
      const hasHistory = (n.comments && n.comments.length > 0);
      const showThread = (hasCcc && hasCustomer) || hasHistory;

      const threadComments = n.comments || [];
      const legacyCount = (hasCcc ? 1 : 0) + (hasCustomer ? 1 : 0);
      const totalCount = threadComments.length + legacyCount;
      const threadLabel = totalCount > 0 ? '💬 Thread (' + totalCount + ')' : '💬 Start Thread';

      const thumbnail = imgSrc
        ? '<img src="' + imgSrc + '" alt="attachment" ' +
          'style="width:48px;height:48px;object-fit:cover;border-radius:4px;cursor:pointer;" ' +
          'onclick="window.UI.openImageModal(\'' + imgSrc + '\')" />'
        : '<span style="color:rgba(165,180,252,0.5);">—</span>';

      const statusOptions = ['Backlog', 'Pending', 'In Progress', 'Solved', 'Closed'].map(function (opt) {
        const selected = status === opt ? ' selected' : '';
        return '<option value="' + opt + '"' + selected + '>' + opt + '</option>';
      }).join('');

      return (
        '<tr style="' + rowStyle + '">' +
          '<td>' + unreadDot + (idx + 1) + '</td>' +
          '<td>' + thumbnail + '</td>' +
          '<td>' + project + '</td>' +
          '<td><span class="tag">' + pageModule + '</span></td>' +
          '<td>' + remark + '</td>' +
          '<td>' + submittedBy + '</td>' +
          '<td>' + dateStr + '</td>' +
          '<td>' +
            '<select class="status-select ' + badgeClass + '" ' +
              'onchange="window.Notifications.updateStatus(\'' + id + '\', \'status\', this.value); ' +
                        'this.className = \'status-select \' + Utils.getBadgeClass(this.value);">' +
              statusOptions +
            '</select>' +
          '</td>' +
          '<td>' + solvedDateStr + '</td>' +
          '<td>' + slaHtml + '</td>' +
          '<td>' +
            (function() {
              const active = window.State.activeTableEditor;
              const isEditing = active && active.id === id && active.field === 'internalComment';
              
              if (isEditing) {
                const onSave = 'window.Notifications.updateStatus(\'' + id + '\', \'internalComment\', document.getElementById(\'inline-editor-' + id + '-internalComment\').innerHTML); window.UI.closeActiveEditor();';
                const onCancel = 'window.UI.closeActiveEditor()';
                return window.UI.renderInlineRichEditor(id, 'internalComment', n.internalComment, onSave, onCancel);
              } else if (!n.internalComment) {
                return (
                  '<div class="add-remark-link" style="color:var(--primary); font-size:12px; cursor:pointer; font-weight:600;" ' +
                    'onclick="window.Notifications.setTableEditing(\'' + id + '\', \'internalComment\')">' +
                    '<span class="plus-sign">+</span> Add remark...' +
                  '</div>'
                );
              } else {
                return (
                  '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">' +
                    '<div style="font-size:12px; color:var(--text-main); font-weight:500; line-height:1.4;">' + n.internalComment + '</div>' +
                    '<button class="btn-ghost" style="padding:2px 6px; font-size:10px; opacity:0.6;" ' +
                      'onclick="window.Notifications.setTableEditing(\'' + id + '\', \'internalComment\')">' +
                      '✏️ Edit' +
                    '</button>' +
                  '</div>'
                );
              }
            })() +
          '</td>' +
          '<td>' +
            (customerStatus
              ? '<span class="badge ' + csBadgeClass + '">' + window.Utils.escapeHtml(customerStatus) + '</span>'
              : '<span style="color:rgba(165,180,252,0.5);">—</span>') +
          '</td>' +
          '<td>' +
            (function() {
              const active = window.State.activeTableEditor;
              const isEditing = active && active.id === id && active.field === 'customerComment';
              const userRole = (window.State.currentUser ? window.State.currentUser.role : 'user');
              const isAdmin = userRole === 'admin';

              if (isEditing && !isAdmin) {
                const onSave = 'window.Notifications.updateStatus(\'' + id + '\', \'customerComment\', document.getElementById(\'inline-editor-' + id + '-customerComment\').innerHTML); window.UI.closeActiveEditor();';
                const onCancel = 'window.UI.closeActiveEditor()';
                return window.UI.renderInlineRichEditor(id, 'customerComment', n.customerComment, onSave, onCancel);
              } else if (!n.customerComment) {
                if (isAdmin) {
                  return '<span style="color:rgba(165,180,252,0.5);">—</span>';
                }
                return (
                  '<div class="add-remark-link" style="color:var(--primary); font-size:12px; cursor:pointer; font-weight:600;" ' +
                    'onclick="window.Notifications.setTableEditing(\'' + id + '\', \'customerComment\')">' +
                    '<span class="plus-sign">+</span> Add remark...' +
                  '</div>'
                );
              } else {
                return (
                  '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">' +
                    '<div style="font-size:12px; color:var(--text-main); font-weight:500; line-height:1.4; max-width:200px;">' + n.customerComment + '</div>' +
                    (isAdmin ? '' : 
                      '<button class="btn-ghost" style="padding:2px 6px; font-size:10px; opacity:0.6;" ' +
                        'onclick="window.Notifications.setTableEditing(\'' + id + '\', \'customerComment\')">' +
                        '✏️ Edit' +
                      '</button>'
                    ) +
                  '</div>'
                );
              }
            })() +
          '</td>' +
          '<td>' +
            (showThread ? 
              '<button class="btn-secondary" style="font-size:12px; padding:5px 10px; white-space:nowrap;" ' +
                'onclick="window.Notifications.openCommentsModal(\'' + id + '\')">' +
                threadLabel +
              '</button>' : 
              '<span style="font-size:10px; opacity:0.3;">Locked</span>'
            ) +
          '</td>' +
        '</tr>'
      );
    }).join('');

    updateBadge();
  }

  // ---------------------------------------------------------------------------
  // 10. Chat Modal Controller
  // ---------------------------------------------------------------------------

  // Tracks which entry is currently open in the modal
  var _activeChatId = null;
  var _activeChatFilter = 'All';

  function openCommentsModal(id) {
    _activeChatId = id;
    _activeChatFilter = 'All';

    // Reset tab active state
    document.querySelectorAll('.chat-tab').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.filter === 'All');
    });

    // Reset type toggle
    document.querySelectorAll('.chat-type-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.type === 'CCC');
    });

    // Hide context toggle for external users
    const userRole = (window.State.currentUser ? window.State.currentUser.role : 'user');
    const isInternal = userRole === 'admin' || userRole === 'internal';
    const toggle = document.getElementById('chatTypeToggleContainer');
    if (toggle) toggle.style.display = isInternal ? 'flex' : 'none';

    // Clear input
    const input = document.getElementById('chatInputText');
    if (input) { input.value = ''; input.style.height = 'auto'; }

    renderChatBubbles();

    const modal = document.getElementById('commentsModal');
    if (modal) modal.style.display = 'flex';
  }

  function closeCommentsModal() {
    const modal = document.getElementById('commentsModal');
    if (modal) modal.style.display = 'none';
    _activeChatId = null;
  }

  function renderChatBubbles() {
    if (!_activeChatId) return;
    const notif = window.State.notifications.find(function(n) { return n._id === _activeChatId; });
    const container = document.getElementById('chatBodyContainer');
    const countEl = document.getElementById('chatTotalCount');
    if (!container || !notif) return;

    // Build the full comment thread: legacy flat fields first, then array
    var allComments = [];
    if (notif.internalComment) {
      allComments.push({ type: 'CCC', text: notif.internalComment, author: 'CCC Team', timestamp: notif.date || notif.createdAt, legacy: true });
    }
    if (notif.customerComment) {
      allComments.push({ type: 'Customer', text: notif.customerComment, author: notif.submittedBy || 'Customer', timestamp: notif.date || notif.createdAt, legacy: true });
    }
    allComments = allComments.concat(notif.comments || []);

    // Sort by timestamp ascending
    allComments.sort(function(a, b) { return new Date(a.timestamp || 0) - new Date(b.timestamp || 0); });

    // Apply filter
    var filtered = allComments;
    if (_activeChatFilter !== 'All') {
      filtered = allComments.filter(function(c) { return c.type === _activeChatFilter; });
    }

    if (countEl) countEl.textContent = allComments.length;

    if (filtered.length === 0) {
      container.innerHTML = '<div style="text-align:center; color:rgba(165,180,252,0.5); padding:40px 20px; font-size:14px;">No comments yet. Start the conversation!</div>';
      return;
    }

    container.innerHTML = filtered.map(function(c) {
      const typeClass = c.type === 'CCC' ? 'ccc' : 'customer';
      const author = window.Utils.escapeHtml(c.author || (c.type === 'CCC' ? 'CCC Team' : 'Customer'));
      const text = window.Utils.escapeHtml(c.text || '');
      const timeStr = c.timestamp ? window.Utils.formatDate(c.timestamp) : '';
      const typeBadge = c.type === 'CCC'
        ? '<span style="font-size:10px; background:rgba(34,197,94,0.2); color:#22c55e; border:1px solid rgba(34,197,94,0.3); padding:2px 6px; border-radius:4px;">CCC</span>'
        : '<span style="font-size:10px; background:rgba(99,102,241,0.2); color:#a5b4fc; border:1px solid rgba(99,102,241,0.3); padding:2px 6px; border-radius:4px;">Client</span>';

      return (
        '<div class="chat-wrapper ' + typeClass + '">' +
          '<div class="chat-bubble">' +
            '<div class="chat-bubble-header">' +
              '<span class="chat-bubble-name">' + author + '</span>' +
              typeBadge +
              '<span style="font-size:11px; color:rgba(165,180,252,0.5);">' + timeStr + '</span>' +
            '</div>' +
            '<div class="chat-bubble-text">' + text + '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  async function submitComment() {
    if (!_activeChatId) return;
    const input = document.getElementById('chatInputText');
    const text = input ? input.value.trim() : '';
    if (!text) return;

    // Determine selected type
    const activeTypeBtn = document.querySelector('.chat-type-btn.active');
    const type = activeTypeBtn ? activeTypeBtn.dataset.type : 'CCC';

    const user = window.State.currentUser;
    const newComment = {
      type: type,
      text: text,
      // Metadata (author, timestamp) now enforced by backend for security
    };

    try {
      window.UI.showLoading('Posting comment...');
      const response = await window.API.put('/api/notifications', { _id: _activeChatId, newComment: newComment });

      // Update local state with the actual data (including author/timestamp from server)
      const notif = window.State.notifications.find(function(n) { return n._id === _activeChatId; });
      if (notif) {
        if (!Array.isArray(notif.comments)) notif.comments = [];
        
        // Use a placeholder locally until next refresh, 
        // but the backend will have processed the real identity correctly.
        // For a more immediate UI feel, we can construct what the backend does:
        const verifiedComment = {
            ...newComment,
            author: user ? (user.name || user.username) : 'System',
            timestamp: new Date().toISOString()
        };
        notif.comments.push(verifiedComment);
      }

      if (input) { input.value = ''; input.style.height = 'auto'; }
      renderChatBubbles();
      renderTable(); // Refresh thread count in table
      window.UI.showToast('Comment posted.', '#22c55e');
    } catch (err) {
      console.error('[Chat] submitComment error:', err);
      window.UI.showToast('Failed to post comment.', '#ef4444');
    } finally {
      window.UI.hideLoading();
    }
  }

  function initChatModal() {
    // Close button
    const closeBtn = document.getElementById('closeCommentsModal');
    if (closeBtn) closeBtn.addEventListener('click', closeCommentsModal);

    // Backdrop click to close
    const modal = document.getElementById('commentsModal');
    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) closeCommentsModal();
      });
    }

    // Filter tabs
    document.querySelectorAll('.chat-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.chat-tab').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        _activeChatFilter = btn.dataset.filter;
        renderChatBubbles();
      });
    });

    // Type toggle
    document.querySelectorAll('.chat-type-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.chat-type-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
      });
    });

    // Send button
    const sendBtn = document.getElementById('chatSendBtn');
    if (sendBtn) sendBtn.addEventListener('click', submitComment);

    // Textarea auto-expand + Ctrl+Enter to send
    const textarea = document.getElementById('chatInputText');
    if (textarea) {
      textarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
      });
      textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          submitComment();
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  function setEditing(id) {
    window.State.editingId = id;
    renderTable();
  }

  function setTableEditing(id, field) {
    // Only one at a time
    window.State.activeTableEditor = { id, field };
    renderTable();
  }

  function populateProjectFilter() {
    const filter = document.getElementById('notifProjectFilter');
    if (!filter) return;
    const current = filter.value;
    const projects = window.State.projects || [];
    
    filter.innerHTML = '<option value="">All Projects</option>' + 
      projects.map(function(p) {
        const selected = p.name === current ? ' selected' : '';
        return '<option value="' + window.Utils.escapeHtml(p.name) + '"' + selected + '>' + window.Utils.escapeHtml(p.name) + '</option>';
      }).join('');
  }

  window.Notifications = {
  load: load,
  updateBadge: updateBadge,
  markAsRead: markAsRead,
  markAllRead: markAllRead,
  toggleBellDropdown: toggleBellDropdown,
  closeBellDropdown: closeBellDropdown,
  populateBellDropdown: populateBellDropdown,
  handleBellItemClick: handleBellItemClick,
  updateStatus: updateStatus,
  exportCSV: exportCSV,
  renderTable: renderTable,
  populateProjectFilter: populateProjectFilter,
  setEditing: setEditing,
  setTableEditing: setTableEditing,
  openCommentsModal: openCommentsModal,
  closeCommentsModal: closeCommentsModal,
  renderChatBubbles: renderChatBubbles,
  submitComment: submitComment,
  initChatModal: initChatModal
};

})();
