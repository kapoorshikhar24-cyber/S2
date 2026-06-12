(function () {
  const el = id => document.getElementById(id);
  
  let _rawLogs = [];
  let _currentPeriod = 'this-month';
  let _logChart = null;

  async function load() {
    console.log('[LoginLogs] Loading activity history...');
    try {
      const logs = await window.API.get('/api/login-history');
      _rawLogs = Array.isArray(logs) ? logs : [];
      initFilters();
      applyFilter('this-month');
    } catch (err) {
      console.error('[LoginLogs] Load failed:', err);
      window.UI.showToast('Failed to load login activity.', '#ef4444');
    }
  }

  function initFilters() {
    const filters = document.querySelectorAll('#loginLogFilters .filter-pill');
    filters.forEach(btn => {
      btn.onclick = () => {
        filters.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyFilter(btn.dataset.period);
      };
    });
  }

  function applyFilter(period) {
    _currentPeriod = period;
    const now = new Date();
    let startDate, endDate;
    let groupBy = 'day';

    if (period === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      groupBy = 'hour';
    } else if (period === 'this-month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      groupBy = 'day';
    } else if (period === 'last-month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      groupBy = 'day';
    }

    const filtered = _rawLogs.filter(log => {
      const ts = new Date(log.timestamp);
      return ts >= startDate && ts <= endDate;
    });

    renderTable(filtered);
    renderChart(filtered, startDate, endDate, groupBy);
  }

  function renderTable(logs) {
    const tableBody = el('loginLogsTableBody');
    if (!tableBody) return;

    if (!logs || logs.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px; color:#888;">No login activity for this period.</td></tr>';
      return;
    }

    tableBody.innerHTML = logs.map((log, idx) => {
      const date = new Date(log.timestamp);
      const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const badgeClass = log.type === 'internal' ? 'role-badge internal' : 'role-badge user';
      
      return `
        <tr>
          <td>${idx + 1}</td>
          <td style="font-weight:600;">${window.Utils.escapeHtml(log.fullName || log.username)}</td>
          <td><span class="${badgeClass}">${log.type}</span></td>
          <td>${window.Utils.escapeHtml(log.project || '—')}</td>
          <td style="color:#888;">${formattedDate}</td>
          <td><span style="color:#22c55e;">● Success</span></td>
        </tr>
      `;
    }).join('');
  }

  function renderChart(logs, startDate, endDate, groupBy) {
    const ctx = el('loginActivityChart');
    if (!ctx) return;

    const labels = [];
    const counts = [];
    const map = {};

    if (groupBy === 'hour') {
      // 24 hours
      for (let i = 0; i < 24; i++) {
        const label = String(i).padStart(2, '0') + ':00';
        labels.push(label);
        map[i] = 0;
      }
      logs.forEach(log => {
        const hr = new Date(log.timestamp).getHours();
        map[hr] = (map[hr] || 0) + 1;
      });
      for (let i = 0; i < 24; i++) counts.push(map[i]);
    } else {
      // Day by day
      const daysInPeriod = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      for (let i = 0; i <= daysInPeriod; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        if (d > endDate && i > 0) break;
        const label = d.getDate() + ' ' + d.toLocaleString('default', { month: 'short' });
        labels.push(label);
        const key = d.toDateString();
        map[key] = 0;
      }
      logs.forEach(log => {
        const key = new Date(log.timestamp).toDateString();
        if (map.hasOwnProperty(key)) map[key]++;
      });
      labels.forEach((_, i) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        counts.push(map[d.toDateString()] || 0);
      });
    }

    if (_logChart) _logChart.destroy();

    if (typeof Chart === 'undefined') {
      console.warn('Chart.js not loaded');
      return;
    }

    _logChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Logins',
          data: counts,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#6366f1',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            padding: 12,
            titleFont: { size: 13, weight: '700' },
            bodyFont: { size: 12 }
          }
        },
        scales: {
          x: { 
            grid: { display: false },
            ticks: { color: '#888', font: { size: 10 } }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { 
              precision: 0, 
              color: '#888',
              font: { size: 10 }
            }
          }
        }
      }
    });
  }

  window.LoginLogs = {
    load,
    applyFilter
  };
})();
