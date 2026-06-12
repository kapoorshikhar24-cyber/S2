// ui.js — DOM interactions, visual feedback, navigation for UAT Dashboard

(function () {
  function showToast(message, color) {
    if (color === undefined) color = '#22c55e';

    var toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = [
      'position:fixed',
      'bottom:24px',
      'right:24px',
      'background:' + color,
      'color:#fff',
      'padding:12px 20px',
      'border-radius:8px',
      'font-size:14px',
      'font-weight:500',
      'box-shadow:0 4px 12px rgba(0,0,0,0.2)',
      'z-index:9999',
      'opacity:1',
      'transition:opacity 0.3s ease',
      'max-width:320px',
    ].join(';');

    document.body.appendChild(toast);

    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 3000);
  }

  function showNotifPopup() {
    var popup = document.createElement('div');
    popup.textContent = '✅ Submission sent!';
    popup.style.cssText = [
      'position:fixed',
      'top:24px',
      'right:24px',
      'background:#7c3aed',
      'color:#fff',
      'padding:14px 22px',
      'border-radius:8px',
      'font-size:14px',
      'font-weight:600',
      'box-shadow:0 4px 16px rgba(124,58,237,0.35)',
      'z-index:9999',
      'opacity:1',
      'transition:opacity 0.3s ease',
    ].join(';');

    document.body.appendChild(popup);

    setTimeout(function () {
      popup.style.opacity = '0';
      setTimeout(function () {
        if (popup.parentNode) popup.parentNode.removeChild(popup);
      }, 300);
    }, 4000);
  }

  // ── Loading overlay ────────────────────────────────────────────────────────

  var _loadingOverlay = null;

  function showLoading(message) {
    if (_loadingOverlay) return;
    message = message || 'Loading…';

    // Inject spin keyframes once
    if (!document.getElementById('_spinKeyframes')) {
      var s = document.createElement('style');
      s.id = '_spinKeyframes';
      s.textContent = '@keyframes _spin { to { transform: rotate(360deg); } }';
      document.head.appendChild(s);
    }

    _loadingOverlay = document.createElement('div');
    _loadingOverlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'background:rgba(0,0,0,0.45)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'z-index:10000',
      'flex-direction:column',
      'gap:12px',
    ].join(';');

    var spinner = document.createElement('div');
    spinner.style.cssText = [
      'width:36px',
      'height:36px',
      'border:3px solid rgba(255,255,255,0.2)',
      'border-top-color:#fff',
      'border-radius:50%',
      'animation:_spin 0.7s linear infinite',
    ].join(';');

    var label = document.createElement('div');
    label.textContent = message;
    label.style.cssText = 'color:#fff;font-size:14px;font-weight:500;';

    _loadingOverlay.appendChild(spinner);
    _loadingOverlay.appendChild(label);
    document.body.appendChild(_loadingOverlay);
  }

  function hideLoading() {
    if (_loadingOverlay) {
      if (_loadingOverlay.parentNode) _loadingOverlay.parentNode.removeChild(_loadingOverlay);
      _loadingOverlay = null;
    }
  }

  // ── Image modal ───────────────────────────────────────────────────────────

  function openImageModal(imgSrc) {
    var modal = document.getElementById('imageModal');
    if (!modal) return;
    var img = modal.querySelector('img');
    if (img) img.src = imgSrc;
    modal.style.display = 'flex';
  }

  function closeImageModal() {
    var modal = document.getElementById('imageModal');
    if (!modal) return;
    modal.style.display = 'none';
  }

  // ── Sidebar ───────────────────────────────────────────────────────────────

  function toggleSidebar() {
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('open');
  }

  function toggleDesktopSidebar() {
    var sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('collapsed');
  }

  // Auto-collapse on tablet load
  document.addEventListener('DOMContentLoaded', function() {
    var sidebar = document.getElementById('sidebar');
    if (sidebar && window.innerWidth <= 1024 && window.innerWidth > 768) {
      sidebar.classList.add('collapsed');
    }
  });

  // ── Section navigation ────────────────────────────────────────────────────

  var sectionMap = {
    dashboard:     { section: 'sectionDashboard',     nav: 'navDashboard'     },
    users:         { section: 'sectionUsers',         nav: 'navUsers'         },
    projectMgmt:   { section: 'sectionProjectMgmt',   nav: 'navProjectMgmt'   },
    picklists:     { section: 'sectionPicklists',     nav: 'navPicklists'     },
    notifications: { section: 'sectionNotifications', nav: 'navNotifications' },
    images:        { section: 'sectionImages',        nav: 'navImages'        },
    files:         { section: 'sectionFiles',         nav: 'navFiles'         },
    loginLogs:     { section: 'sectionLoginLogs',     nav: 'navLoginLogs'     },
  };

  function switchSection(section) {
    console.log('[UI] Switching to section:', section);

    // 1. Hide all
    document.querySelectorAll('.section').forEach(function (el) {
      el.classList.remove('active');
      el.style.display = 'none'; // Explicitly hide
    });
    document.querySelectorAll('.nav-btn').forEach(function (el) {
      el.classList.remove('active');
    });

    // 2. Map and Show
    var mapping = sectionMap[section];
    if (mapping) {
      var sectionEl = document.getElementById(mapping.section);
      var navEl     = document.getElementById(mapping.nav);
      
      if (sectionEl) {
        sectionEl.classList.add('active');
        sectionEl.style.display = 'block'; // Explicitly show
        console.log('[UI] Found and activated section:', mapping.section);
      } else {
        console.error('[UI] Could not find section element with ID:', mapping.section);
      }
      
      if (navEl) {
        navEl.classList.add('active');
      } else {
        console.error('[UI] Could not find nav element with ID:', mapping.nav);
      }
    } else {
      console.error('[UI] No mapping found for section key:', section);
    }

    if (window.innerWidth <= 768) {
      var sidebar = document.getElementById('sidebar');
      var overlay = document.getElementById('sidebarOverlay');
      if (sidebar) sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
    }


    try {
      if (section === 'notifications' && window.Notifications && typeof window.Notifications.renderTable === 'function') {
        window.Notifications.renderTable();
      }

      if (section === 'dashboard') {
        renderDashboard();
      }

      if (section === 'users') {
        if (window.Users && typeof window.Users.render === 'function') {
          window.Users.render();
        }
      }

      if (section === 'projectMgmt') {
        if (window.Projects && typeof window.Projects.render === 'function') {
          window.Projects.render();
        }
      }

      if (section === 'files') {
        if (window.Files && typeof window.Files.render === 'function') {
          window.Files.render();
        }
        if (window.State.currentUser && window.State.currentUser.role === 'admin' && 
            window.Files && typeof window.Files.populateProjectSelect === 'function') {
          window.Files.populateProjectSelect();
        }
      }

      if (section === 'loginLogs') {
        if (window.LoginLogs && typeof window.LoginLogs.load === 'function') {
          window.LoginLogs.load();
        }
      }
      
      if (section === 'picklists') {
         if (window.Picklists && typeof window.Picklists.load === 'function') {
           window.Picklists.load().then(function() {
             if (typeof window.Picklists.render === 'function') window.Picklists.render();
           });
         }
      }
    } catch (err) {
      console.error('switchSection render error:', err);
      showToast('Error rendering section: ' + (err.message || 'Unknown error'), '#ef4444');
    }
  }

  // Global error listener for toasts
  window.addEventListener('error', function(event) {
    showToast('JS Error: ' + event.message, '#ef4444');
  });

  // ── Dashboard summary ─────────────────────────────────────────────────────
  
  var _statusChart = null;

  function updateStatusChart(counts) {
    var ctx = document.getElementById('statusChart');
    if (!ctx) return;

    var labels = ['Solved', 'Closed', 'In Progress', 'Pending', 'Backlog'];
    var data = [
      counts.solved || 0,
      counts.closed || 0,
      counts['in progress'] || 0,
      counts.pending || 0,
      counts.backlog || 0
    ];

    // Premium colors
    var colors = [
      '#22c55e', // Solved - green
      '#16a34a', // Closed - dark green
      '#3b82f6', // In Progress - blue
      '#f59e0b', // Pending - amber
      '#7c3aed'  // Backlog - violet
    ];

    var total = data.reduce((a, b) => a + b, 0);
    var chartSection = document.getElementById('dashboardCharts');
    if (total === 0) {
      if (chartSection) chartSection.style.display = 'none';
      return;
    }
    if (chartSection) chartSection.style.display = 'block';

    if (_statusChart) {
      _statusChart.data.datasets[0].data = data;
      _statusChart.update();
    } else {
      if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded yet');
        return;
      }
      _statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: colors,
            borderWidth: 0,
            hoverOffset: 15
          }]
        },
        plugins: [{
          // Custom plugin: draw total in the center of the doughnut
          id: 'centerText',
          afterDraw: function(chart) {
            var width = chart.width, height = chart.height, cCtx = chart.ctx;
            cCtx.restore();
            var total = chart.data.datasets[0].data.reduce(function(a, b) { return a + b; }, 0);
            cCtx.font = '700 28px Inter, sans-serif';
            cCtx.fillStyle = '#fff';
            cCtx.textAlign = 'center';
            cCtx.textBaseline = 'middle';
            var centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
            var centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;
            cCtx.fillText(total, centerX, centerY - 10);
            cCtx.font = '500 11px Inter, sans-serif';
            cCtx.fillStyle = '#888';
            cCtx.fillText('Total Entries', centerX, centerY + 14);
            cCtx.save();
          }
        }],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '75%',
          plugins: {
            legend: {
              position: 'right',
              labels: {
                color: '#888',
                font: { family: 'Inter', size: 12, weight: '500' },
                padding: 20,
                usePointStyle: true,
                pointStyle: 'circle',
                generateLabels: function(chart) {
                  var dataset = chart.data.datasets[0];
                  var total = dataset.data.reduce(function(a, b) { return a + b; }, 0);
                  return chart.data.labels.map(function(label, i) {
                    var value = dataset.data[i];
                    var pct = total > 0 ? Math.round((value / total) * 100) : 0;
                    return {
                      text: label + '  —  ' + value + ' (' + pct + '%)',
                      fillStyle: dataset.backgroundColor[i],
                      strokeStyle: 'transparent',
                      lineWidth: 0,
                      hidden: false,
                      index: i,
                      pointStyle: 'circle'
                    };
                  });
                }
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0,0,0,0.8)',
              titleFont: { family: 'Inter', size: 13, weight: '700' },
              bodyFont: { family: 'Inter', size: 12 },
              padding: 12,
              cornerRadius: 8,
              displayColors: true,
              callbacks: {
                label: function(context) {
                  var dataset = context.dataset;
                  var total = dataset.data.reduce(function(a, b) { return a + b; }, 0);
                  var value = dataset.data[context.dataIndex];
                  var pct = total > 0 ? Math.round((value / total) * 100) : 0;
                  return ' ' + context.label + ': ' + value + ' (' + pct + '%)';
                }
              }
            }
          },
          animation: {
            animateScale: true,
            animateRotate: true,
            duration: 1000,
            easing: 'easeOutQuart'
          }
        }
      });
    }
  }

  function renderDashboard() {
    var container = document.getElementById('dashboardStats');
    if (!container) return;

    var user = window.State ? window.State.currentUser : null;
    var entries = window.State ? (window.State.entries || []) : [];
    var projects = window.State ? (window.State.projects || []) : [];
    var notifications = window.State ? (window.State.notifications || []) : [];

    // Role detection
    var isAdmin = user && user.role === 'admin';
    var isInternal = user && user.type === 'internal';
    var isExternal = !isAdmin && !isInternal;

    // Update Header
    var roleBadge = document.getElementById('dashboardRoleBadge');
    var subtext = document.getElementById('dashboardSubtext');
    if (roleBadge) {
      roleBadge.textContent = isAdmin ? 'Admin' : (isInternal ? 'Internal' : 'Client');
      roleBadge.className = 'role-badge ' + (isAdmin ? 'admin' : (isInternal ? 'manager' : 'user'));
    }
    if (subtext) {
      if (isAdmin) subtext.textContent = 'Global overview across all projects and entries.';
      else if (isInternal) subtext.textContent = 'Overview of projects and tasks assigned to you.';
      else subtext.textContent = 'UAT status and feedback for your project: ' + (user.project || 'Unassigned');
    }

    // Update Dashboard Branding / Hero
    var heroEl = document.getElementById('dashboardHero');
    var standardHeader = document.getElementById('dashboardStandardHeader');
    var heroLogoContainer = document.getElementById('heroLogoContainer');
    var heroTitle = document.getElementById('heroTitle');
    var heroSubtext = document.getElementById('heroSubtext');
    var logoContainer = document.getElementById('dashboardBrandLogo');

    if (heroEl && standardHeader) {
      if (isExternal) {
        heroEl.style.display = 'block';
        standardHeader.style.display = 'none';

        // Set Hero Details
        if (heroTitle) heroTitle.textContent = 'Welcome back, ' + (user.name || 'Member');
        if (heroSubtext) heroSubtext.textContent = 'Viewing UAT status for project: ' + (user.project || 'Unassigned');

        // Find Project Details
        var activeProject = projects.find(function (p) { return p.name === (user.project || ''); });
        if (activeProject && activeProject.brandImage && heroLogoContainer) {
          heroLogoContainer.innerHTML = '<img src="' + activeProject.brandImage + '" alt="Brand Logo" style="max-height:100px; max-width:200px; object-fit:contain; animation: zoomIn 0.5s ease-out;">';
        } else if (heroLogoContainer) {
          heroLogoContainer.innerHTML = '<div style="font-size:4rem; opacity:0.3;">📁</div>';
        }

        // Timeline Badge Calculation
        var timelineBadge = document.getElementById('heroTimelineBadge');
        if (activeProject && timelineBadge) {
          timelineBadge.style.display = 'block';
          
          if (activeProject.endDate) {
            var today = new Date(); today.setHours(0,0,0,0);
            var end = new Date(activeProject.endDate); end.setHours(0,0,0,0);
            var start = activeProject.startDate ? new Date(activeProject.startDate) : today;
            start.setHours(0,0,0,0);
            
            var diffTimeLeft = end - today;
            var diffDaysLeft = Math.ceil(diffTimeLeft / (1000 * 60 * 60 * 24));
            
            var diffTotalTime = end - start;
            var diffTotalDays = Math.ceil(diffTotalTime / (1000 * 60 * 60 * 24));
            
            var durationText = diffTotalDays > 0 ? " (of " + diffTotalDays + " total days)" : "";

            if (diffDaysLeft > 0) {
              timelineBadge.innerHTML = '📅 ' + diffDaysLeft + ' Days Left' + durationText;
              timelineBadge.style.color = diffDaysLeft < 7 ? '#f59e0b' : '#22c55e';
            } else if (diffDaysLeft === 0) {
              timelineBadge.innerHTML = '📅 Due Today';
              timelineBadge.style.color = '#f59e0b';
            } else {
              timelineBadge.innerHTML = '📅 Project Timeline Ended';
              timelineBadge.style.color = '#ef4444';
            }
          } else {
             timelineBadge.innerHTML = '📅 No Dates Configured';
             timelineBadge.style.color = '#888';
          }
        }
      } else {
        heroEl.style.display = 'none';
        standardHeader.style.display = 'block';
        
        if (logoContainer) {
          logoContainer.style.display = 'none';
        }

        // --- CUSTOM DASHBOARD PROJECT FILTER ---
        var filterWrapper = document.getElementById('dashboardProjectFilterWrapper');
        if (filterWrapper) {
          filterWrapper.style.display = 'flex';
          setupDashProjectFilter(projects);
        }
      }
    }

    function setupDashProjectFilter(projects) {
      var container = document.getElementById('dashProjectDropdown');
      var trigger   = document.getElementById('dashProjectTrigger');
      var listEl    = document.getElementById('dashProjectList');
      var hiddenInput = document.getElementById('dashboardProjectFilter');
      var chipsEl   = document.getElementById('dashProjectChips');
      var searchInput = document.getElementById('dashProjectSearch');

      if (!container || !trigger || !listEl) return;

      // Only populate if needed
      var savedValue = sessionStorage.getItem('dashboardProjectFilter') || '';
      
      var optionsHtml = '<div class="multiselect-item' + (savedValue === '' ? ' selected' : '') + '" onclick="window.UI.selectDashProject(\'\')">' +
                          '<div class="user-info"><span>All Projects</span></div>' +
                        '</div>';

      projects.forEach(function(p) {
        var isSelected = p.name === savedValue;
        var logo = p.brandImage ? '<img src="' + p.brandImage + '" style="width:18px;height:18px;border-radius:4px;object-fit:contain;">' : '📁';
        optionsHtml += '<div class="multiselect-item' + (isSelected ? ' selected' : '') + '" data-name="' + p.name.toLowerCase() + '" onclick="window.UI.selectDashProject(\'' + p.name + '\')">' +
                         '<div class="user-info" style="gap:8px;">' + logo + '<span>' + p.name + '</span></div>' +
                       '</div>';
      });

      listEl.innerHTML = optionsHtml;
      
      // Update trigger text
      if (savedValue) {
        chipsEl.innerHTML = '<div class="multiselect-chip" style="background:rgba(99,102,241,0.2);">' +
                             '<span>📁</span>' + savedValue + 
                             '<span class="multiselect-chip-remove" onclick="window.UI.selectDashProject(\'\'); event.stopPropagation();">×</span>' +
                            '</div>';
        hiddenInput.value = savedValue;
      } else {
        chipsEl.innerHTML = '<span class="placeholder-text">All Projects</span>';
        hiddenInput.value = '';
      }

      // Dropdown toggle
      trigger.onclick = function(e) {
        if (e.target.classList.contains('multiselect-chip-remove')) return;
        var isOpen = container.classList.contains('open');
        if (isOpen) {
          container.classList.remove('open');
        } else {
          container.classList.add('open');
          if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
            // Reset visibility
            document.querySelectorAll('#dashProjectList .multiselect-item').forEach(function(item) {
              item.style.display = 'flex';
            });
          }
        }
      };

      // Search functionality
      if (searchInput) {
        searchInput.oninput = function() {
          var query = this.value.toLowerCase().trim();
          document.querySelectorAll('#dashProjectList .multiselect-item').forEach(function(item) {
            var name = item.getAttribute('data-name') || '';
            if (!query || name.includes(query) || !item.hasAttribute('data-name')) {
              item.style.display = 'flex';
            } else {
              item.style.display = 'none';
            }
          });
        };
      }

      // Outside click
      document.addEventListener('click', function(e) {
        if (!container.contains(e.target)) {
          container.classList.remove('open');
        }
      }, { once: true });
    }



    var selectedProject = null;
    if (isExternal) {
      selectedProject = user.project;
    } else {
      var projectFilter = document.getElementById('dashboardProjectFilter');
      if (projectFilter) {
        selectedProject = projectFilter.value;
      }
    }

    var filteredEntries = entries;
    var filteredNotifications = notifications;
    if (selectedProject) {
      filteredEntries = entries.filter(function(e) { return e.project === selectedProject; });
      filteredNotifications = notifications.filter(function(n) { return n.project === selectedProject; });
    }

    // Calculations
    var total = filteredEntries.length;
    var counts = {
      backlog: 0,
      pending: 0,
      'in progress': 0,
      solved: 0,
      closed: 0
    };

    filteredEntries.forEach(function(e) {
      var s = (e.status || 'backlog').toLowerCase();
      if (counts.hasOwnProperty(s)) counts[s]++;
      else if (s === 'pending') counts.pending++; // already handled but being safe
    });

    var solvedCount = counts.solved + counts.closed;
    var solvedPct = total > 0 ? Math.round((solvedCount / total) * 100) : 0;
    var unreadCount = filteredNotifications.filter(function(n) { return !n.read; }).length;

    function getPct(count) {
      return total > 0 ? Math.round((count / total) * 100) : 0;
    }

    function statBox(icon, label, value, color, description) {
      return (
        '<div class="card dash-stat-card" style="flex:1; min-width:200px;">' +
          '<div class="dash-stat-icon-wrapper">' +
            '<span class="dash-stat-icon">' + icon + '</span>' +
          '</div>' +
          '<div class="dash-stat-content">' +
            '<div class="dash-stat-header">' +
              '<span class="dash-stat-label">' + label + '</span>' +
              '<span class="dash-stat-value" style="color:' + color + ';">' + value + '</span>' +
            '</div>' +
            (description ? '<div class="dash-stat-desc">' + description + '</div>' : '') +
          '</div>' +
        '</div>'
      );
    }

    // Progress Bar Helper
    function progressBar(label, count, color) {
      var pct = getPct(count);
      return (
        '<div style="margin-bottom: 1.25rem;">' +
          '<div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:0.5rem;">' +
            '<span style="font-weight:600;">' + label + '</span>' +
            '<span style="color:var(--text-muted);">' + count + ' issues (' + pct + '%)</span>' +
          '</div>' +
          '<div style="height:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); border-radius:10px; overflow:hidden;">' +
            '<div style="width:' + pct + '%; height:100%; background:' + color + '; border-radius:10px; box-shadow: 0 0 10px ' + color + '44;"></div>' +
          '</div>' +
        '</div>'
      );
    }

    var html = '<div style="display:flex; flex-direction:column; gap:2rem;">';

    // Row 1: Key Metrics
    html += '<div style="display:flex; flex-wrap:wrap; gap:1.25rem;">';
    var totalIssuesDesc = selectedProject ? 'Project: ' + selectedProject : (isAdmin ? 'Across ' + projects.length + ' projects' : 'In your scope');
    html += statBox('📊', 'Total Issues', total, 'var(--text)', totalIssuesDesc);
    html += statBox('✅', 'Completion', solvedPct + '%', '#22c55e', solvedCount + ' Solved / Closed');
    
    if (isExternal && selectedProject) {
      var activeProject = projects.find(function (p) { return p.name === selectedProject; });
      if (activeProject && activeProject.endDate) {
        var today = new Date(); today.setHours(0,0,0,0);
        var end = new Date(activeProject.endDate); end.setHours(0,0,0,0);
        var diffTime = end - today;
        var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        var timelineVal = diffDays > 0 ? diffDays + ' Days' : (diffDays === 0 ? 'Due' : 'Ended');
        var timelineColor = diffDays < 7 ? '#f59e0b' : '#22c55e';
        if (diffDays < 0) timelineColor = '#ef4444';
        html += statBox('📅', 'Timeline', timelineVal, timelineColor, diffDays < 0 ? 'Deadline passed' : 'Estimated completion');
      }
    } else {
      html += statBox('🔔', 'Recent Triggers', unreadCount, unreadCount > 0 ? '#ef4444' : 'var(--text-muted)', 'Unread notifications');
    }
    html += '</div>';

    // Row 2: Detailed Breakdown
    html += '<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:1.25rem;">';
    
    // Status Percentages Card
    html += '<div class="card" style="margin:0; padding:1.5rem;">' +
              '<div style="font-size:1rem; font-weight:700; margin-bottom:1.5rem; display:flex; align-items:center; gap:8px;">🎯 Status Distribution</div>' +
              progressBar('Solved & Closed', solvedCount, '#22c55e') +
              progressBar('In Progress / Pending', counts['in progress'] + counts.pending, '#f59e0b') +
              progressBar('Backlog', counts.backlog, '#7c3aed') +
            '</div>';

    // Activity Or Projects Card
    if ((isAdmin || isInternal) && !selectedProject) {
      html += '<div class="card" style="margin:0; padding:1.5rem;">' +
                '<div style="font-size:1rem; font-weight:700; margin-bottom:1.5rem;">📁 Project Reach</div>' +
                '<div style="display:flex; flex-direction:column; gap:0.75rem;">' +
                  (projects.length === 0 ? '<div style="color:var(--text-muted); font-size:0.85rem;">No projects found.</div>' : 
                    projects.slice(0, 5).map(function(p) {
                      return '<div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem; background:rgba(255,255,255,0.02); border-radius:6px; font-size:0.85rem;">' +
                               '<span>' + window.Utils.escapeHtml(p.name) + '</span>' +
                               '<span class="tag" style="background:rgba(255,255,255,0.05);">' + (p.users || []).length + ' Users</span>' +
                             '</div>';
                    }).join('')
                  ) +
                  (projects.length > 5 ? '<div style="text-align:center; font-size:0.75rem; color:var(--text-theme); cursor:pointer;" onclick="window.UI.switchSection(\'projectMgmt\')">View all projects...</div>' : '') +
                '</div>' +
              '</div>';
    } else {
      // Activity for selected project or external user
      var myRecent = filteredEntries.slice(0, 5);
      html += '<div class="card" style="margin:0; padding:1.5rem;">' +
                '<div style="font-size:1rem; font-weight:700; margin-bottom:1.5rem;">🕒 Latest Reports</div>' +
                '<div style="display:flex; flex-direction:column; gap:0.75rem;">' +
                  (myRecent.length === 0 ? '<div style="color:var(--text-muted); font-size:0.85rem;">No entries yet.</div>' : 
                    myRecent.map(function(e) {
                      var statusBadge = window.Utils.getBadgeClass(e.status || 'Backlog');
                      // Strip HTML tags from remark for plain text preview
                      var rawRemark = (e.remark || '').replace(/<[^>]*>/g, '').trim();
                      var remarkSnippet = rawRemark.length > 80 ? rawRemark.slice(0, 80) + '…' : rawRemark;
                      return '<div style="display:flex; flex-direction:column; gap:4px; padding:0.6rem 0.75rem; background:rgba(255,255,255,0.02); border-radius:8px; border-left: 3px solid rgba(99,102,241,0.3);">' +
                               '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">' +
                                 '<span style="font-size:0.85rem; font-weight:600; color:var(--text-main);">' + window.Utils.escapeHtml(e.pageModule || 'Entry') + '</span>' +
                                 '<span class="badge ' + statusBadge + '" style="font-size:10px; flex-shrink:0;">' + (e.status || 'Backlog') + '</span>' +
                               '</div>' +
                               (remarkSnippet ? '<div style="font-size:0.78rem; color:var(--text-muted); line-height:1.4; margin-top:1px;">' + window.Utils.escapeHtml(remarkSnippet) + '</div>' : '') +
                             '</div>';
                    }).join('')
                  ) +
                '</div>' +
              '</div>';
    }

    html += '</div>'; // End Grid
    html += '</div>'; // End Root Column
    container.innerHTML = html;

    // Update Chart
    updateStatusChart(counts);
  }

  // Exported for the onclick attribute in project filters
  function selectDashProject(val) {
    sessionStorage.setItem('dashboardProjectFilter', val);
    var hiddenInput = document.getElementById('dashboardProjectFilter');
    if (hiddenInput) {
      hiddenInput.value = val;
      // Re-render
      renderDashboard();
    }
  }

  // ── Theme ─────────────────────────────────────────────────────────────────

  function updateThemeIcon(theme) {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    btn.textContent = theme === 'dark' ? '🌙' : '🌞';
  }

  function initTheme() {
    var theme = localStorage.getItem('uat_theme') || 'light';
    document.body.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
  }

  function toggleTheme() {
    var current = document.body.getAttribute('data-theme') || 'light';
    var next = current === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', next);
    localStorage.setItem('uat_theme', next);
    updateThemeIcon(next);
  }

  function updateBranding() {
    var user = window.State.currentUser;
    var iconEl = document.getElementById('brandIcon');
    var textEl = document.getElementById('brandText');
    var brandEl = document.getElementById('sidebarBrand');

    if (!iconEl || !textEl) return;

    var defaultIcon = '⚡';
    var defaultText = 'UAT Dashboard';

    // 1. Determine Branding based on user type
    var logoUrl = null;
    var brandText = defaultText;
    
    // Safety check: ensure user object exists
    if (user) {
      var isExternal = user.type === 'external';
      var activeProjectName = null;

      if (isExternal) {
        activeProjectName = user.project;
      } else {
        // For Admin/Internal: check if they are filtering the dashboard by project or notifs
        var isDashboardActive = document.getElementById('sectionDashboard') && document.getElementById('sectionDashboard').classList.contains('active');
        var dashboardFilter = document.getElementById('dashboardProjectFilter');
        var notifFilter = document.getElementById('notifProjectFilter');
        
        if (isDashboardActive && dashboardFilter && dashboardFilter.value) {
          activeProjectName = dashboardFilter.value;
        } else if (notifFilter && notifFilter.value) {
          activeProjectName = notifFilter.value;
        }
      }

      if (activeProjectName) {
        // Find the project logo
        var project = (window.State.projects || []).find(function (p) {
          return p.name === activeProjectName;
        });
        if (project) {
          logoUrl = project.brandImage;
          brandText = project.name;
        }
      }

      // Fallback: If no project logo was found, use global dashboard logo
      if (!logoUrl && window.State.settings && window.State.settings.dashboardLogo) {
        logoUrl = window.State.settings.dashboardLogo;
      }
    }

    // 2. Apply branding
    if (logoUrl) {
      iconEl.innerHTML = '<img src="' + logoUrl + '" alt="Logo">';
    } else {
      iconEl.textContent = defaultIcon;
    }
    textEl.textContent = brandText;

    // 3. Admin: attach upload listener UI hint
    if (user && user.role === 'admin' && brandEl) {
      brandEl.style.cursor = 'pointer';
    } else if (brandEl) {
      brandEl.style.cursor = 'default';
      brandEl.title = '';
    }
  }

  window.UI = {
    showToast:       showToast,
    showNotifPopup:  showNotifPopup,
    showLoading:     showLoading,
    hideLoading:     hideLoading,
    openImageModal:  openImageModal,
    closeImageModal: closeImageModal,
    toggleSidebar:   toggleSidebar,
    switchSection:   switchSection,
    renderDashboard: renderDashboard,
    initTheme:       initTheme,
    toggleTheme:     toggleTheme,
    updateThemeIcon: updateThemeIcon,
    updateBranding:  updateBranding,
    toggleDesktopSidebar: toggleDesktopSidebar,
    selectDashProject: selectDashProject,

    /**
     * Renders a compact inline rich text editor for table cells.
     */
    renderInlineRichEditor: function(id, field, initialValue, onSave, onCancel) {
      initialValue = initialValue || '';
      return (
        '<div class="inline-editor-container" onmousedown="event.stopPropagation()" onclick="event.stopPropagation()">' +
          '<div class="inline-toolbar">' +
            '<button class="editor-btn" onclick="Entries.execCommand(\'bold\')" title="Bold"><b>B</b></button>' +
            '<button class="editor-btn" onclick="Entries.execCommand(\'insertUnorderedList\')" title="Bullet List">• List</button>' +
            '<div class="editor-divider"></div>' +
            '<button class="editor-btn" onclick="Entries.execCommand(\'justifyLeft\')" title="Align Left">⬅</button>' +
            '<button class="editor-btn" onclick="Entries.execCommand(\'justifyCenter\')" title="Center">↔</button>' +
            '<button class="editor-btn" onclick="Entries.execCommand(\'justifyRight\')" title="Align Right">➡</button>' +
          '</div>' +
          '<div id="inline-editor-' + id + '-' + field + '" ' +
               'class="inline-editable" ' +
               'contenteditable="true" ' +
               'data-placeholder="Start typing..." ' +
               'onkeydown="if(event.ctrlKey && event.key === \'Enter\') { event.preventDefault(); ' + onSave + ' } event.stopPropagation();">' +
            initialValue +
          '</div>' +
          '<div class="inline-editor-actions">' +
            '<button class="btn-ghost" onclick="' + onCancel + '" style="font-size:10px;">Cancel</button>' +
            '<button class="btn-primary" onclick="' + onSave + '">Submit Entry</button>' +
          '</div>' +
        '</div>'
      );
    },

    closeActiveEditor: function() {
      window.State.activeTableEditor = null;
      // Re-render appropriate table based on active section
      var activeSection = document.querySelector('.section.active');
      if (activeSection) {
        if (activeSection.id === 'sectionNotifications' && window.Notifications) window.Notifications.renderTable();
        if (activeSection.id === 'sectionDashboard' && window.Entries) window.Entries.render();
      }
    }
  };
})();
