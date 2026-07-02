  function toggleTheme() {
    const isLight = document.documentElement.classList.toggle('light-mode');
    localStorage.setItem('sf_theme', isLight ? 'light' : 'dark');
    const icon = document.getElementById('theme-icon');
    if (icon) {
      icon.innerHTML = isLight 
        ? '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"></path>' 
        : '<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>';
    }
  }

  if (localStorage.getItem('sf_theme') === 'light') {
    document.documentElement.classList.add('light-mode');
    window.addEventListener('DOMContentLoaded', () => {
      const icon = document.getElementById('theme-icon');
      if (icon) icon.innerHTML = '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"></path>';
    });
  }
  // ── REDESIGNED DASHBOARD CONTROLS ─────────────────
  function switchSidebarTab(mode, event) {
    document.querySelectorAll('.left-sidebar .menu-item').forEach(btn => btn.classList.remove('active'));
    let targetBtn = event ? event.currentTarget : null;
    if (!targetBtn) {
      targetBtn = document.querySelector(`.left-sidebar .menu-item[onclick*="'${mode}'"]`);
    }
    if (targetBtn) targetBtn.classList.add('active');
    
    switchTab(mode, null);
    
    if (window.innerWidth <= 1024) {
      document.getElementById('leftSidebar').classList.remove('active-mobile');
    }
  }

  function toggleSidebarCollapse() {
    const sidebar = document.getElementById('leftSidebar');
    sidebar.classList.toggle('collapsed');
    if (window.innerWidth <= 1024) {
      sidebar.classList.toggle('active-mobile');
    }
  }

  function toggleRightSidebar() {
    const rightSidebar = document.getElementById('rightSidebar');
    rightSidebar.classList.toggle('collapsed');
    if (window.innerWidth <= 1024) {
      rightSidebar.classList.toggle('active-mobile');
    }
  }

  function handleEnvSelectChange(el) {
    setMode(el.value, true);
  }

  function handleRunModeSelectChange(el) {
    setRunMode(el.value);
  }

  function updateStatsUI() {
    // Env
    const envVal = document.getElementById('statEnv');
    const envSub = document.getElementById('statEnvSub');
    if (envVal && envSub) {
      envVal.textContent = currentEnvMode.charAt(0).toUpperCase() + currentEnvMode.slice(1);
      if (currentEnvMode === 'production') {
        envSub.innerHTML = '<span style="color:#ef4444; font-weight:bold;">⚠️ Live Changes</span>';
      } else if (currentEnvMode === 'development') {
        envSub.innerHTML = '<span style="color:#10b981;">🟢 Scratch / Dev</span>';
      } else {
        envSub.innerHTML = '<span style="color:#3b82f6;">🔵 Safe Testing</span>';
      }
    }

    // Run Mode
    const modeVal = document.getElementById('statRunMode');
    const modeSub = document.getElementById('statRunModeSub');
    if (modeVal && modeSub) {
      modeVal.textContent = currentRunMode === 'local' ? 'Local Agent' : 'Cloud API';
      modeSub.textContent = currentRunMode === 'local' ? 'Playwright Driver' : 'Vercel Gateway';
    }

    // Project
    const projVal = document.getElementById('statProject');
    const projSub = document.getElementById('statProjectSub');
    const projSelector = document.getElementById('projectSelector');
    if (projVal && projSub && projSelector) {
      const activeProj = projSelector.value;
      projVal.textContent = activeProj === '_new_' ? 'New Project' : activeProj;
      
      const modeCredsList = userCredentials[currentEnvMode] || [];
      const proj = modeCredsList.find(p => p.project_name === activeProj);
      if (proj) {
        projSub.textContent = proj.sf_username || 'No Username';
      } else {
        projSub.textContent = 'No Credentials';
      }
    }

    // Last Run
    const lastVal = document.getElementById('statLastRun');
    const lastSub = document.getElementById('statLastRunSub');
    if (lastVal && lastSub) {
      const lastStatus = localStorage.getItem('sf_last_run_status') || 'No Runs';
      const lastTime = localStorage.getItem('sf_last_run_time') || '-';
      lastVal.textContent = lastStatus;
      lastSub.textContent = lastTime;
      
      if (lastStatus === 'Success') {
        lastVal.className = 'stat-value success';
      } else if (lastStatus === 'Failed') {
        lastVal.className = 'stat-value failed';
      } else {
        lastVal.className = 'stat-value';
      }
    }
  }

  // ── SETTINGS PANEL ──────────────────────────────
  let settingsOpen = false;
  let currentEnvMode = localStorage.getItem('sf_env_mode') || 'sandbox';
  let userCredentials = {};
  let systemProjects = [];

  const VERCEL_API = 'https://shriyanshmitra.vercel.app';
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const API_BASE = isLocalhost ? VERCEL_API : '';
  let currentRunMode = localStorage.getItem('sf_run_mode') || 'local';

  const customFetch = async (url, options = {}) => {
    options.headers = options.headers || {};
    
    const token = sessionStorage.getItem('uat_token');
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    if (currentRunMode === 'local' && url.startsWith('/api/')) {
      const localBase = 'http://localhost:8000';
      options.credentials = 'include';
      
      let targetUrl = url;
      if (url.startsWith('/api/sf-run')) targetUrl = '/api/run';
      else if (url.startsWith('/api/sf-history')) targetUrl = '/api/history';
      else if (url.startsWith('/api/sf-fields')) targetUrl = '/api/fields';
      else if (url.startsWith('/api/sf-objects') || url.startsWith('/api/sf-auth')) {
        return fetch(url.startsWith('http') ? url : API_BASE + url, options);
      }
      
      if (!window.__localAuthAttempted) {
        window.__localAuthAttempted = true;
        try {
          const session = JSON.parse(sessionStorage.getItem('uat_session') || '{}');
          if (session.username) {
            await fetch(`${localBase}/api/auth/auto_login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                username: session.username,
                full_name: session.fullName || session.username,
                profile_pic: session.profileImage || '',
                token: token
              }),
              credentials: 'include'
            });
            const credsList = userCredentials[currentEnvMode] || [];
            const activeProj = document.getElementById('projectSelector') ? document.getElementById('projectSelector').value : 'Default';
            const proj = credsList.find(p => p.project_name === activeProj);
            if (proj) {
              await fetch(`${localBase}/api/auth/creds`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  env_mode: currentEnvMode,
                  project_name: activeProj,
                  sf_url: proj.sf_url,
                  sf_username: proj.sf_username,
                  sf_password: proj.sf_password
                }),
                credentials: 'include'
              });
            }
          }
        } catch(e) {
          console.error("Local agent auto-login failed:", e);
        }
      }
      
      return fetch(localBase + targetUrl, options);
    }
    
    // Token already appended above
    return fetch(url.startsWith('http') ? url : API_BASE + url, options);
  };

  function toggleSettings() {
    settingsOpen = !settingsOpen;
    document.getElementById('settingsPanel').classList.toggle('open', settingsOpen);
    document.getElementById('settingsBtn').classList.toggle('open', settingsOpen);
  }

  async function saveSettings() {
    let projName = document.getElementById('projectSelector').value;
    if (projName === '_new_') {
      projName = document.getElementById('projectName').value.trim();
      if (!projName) {
        showToast('Please enter a project name.');
        return;
      }
    }
    
    const url = document.getElementById('url').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
      const res = await customFetch('/api/sf-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ env_mode: currentEnvMode, project_name: projName, sf_url: url, sf_username: username, sf_password: password })
      });
      if (res.ok) {
        if (!userCredentials[currentEnvMode]) userCredentials[currentEnvMode] = [];
        const list = userCredentials[currentEnvMode];
        const existing = list.find(p => p.project_name === projName);
        if (existing) {
          existing.sf_url = url; existing.sf_username = username; existing.sf_password = password;
        } else {
          list.push({ project_name: projName, sf_url: url, sf_username: username, sf_password: password });
        }
        
        updateProjectDropdown();
        document.getElementById('projectSelector').value = projName;
        document.getElementById('newProjectNameWrap').style.display = 'none';
        
        toggleSettings();
        document.getElementById('statusText').textContent = 'credentials saved securely';
      } else {
        document.getElementById('statusText').textContent = 'error saving credentials';
      }
    } catch(e) {
      document.getElementById('statusText').textContent = 'network error';
    }
  }

  function loadProjectCredentials() {
    const sel = document.getElementById('projectSelector').value;
    if (sel === '_new_') {
      document.getElementById('newProjectNameWrap').style.display = 'block';
      document.getElementById('projectName').value = '';
      document.getElementById('url').value = currentEnvMode === 'sandbox' ? 'https://test.salesforce.com/' : 'https://login.salesforce.com/';
      document.getElementById('username').value = '';
      document.getElementById('password').value = '';
    } else {
      document.getElementById('newProjectNameWrap').style.display = 'none';
      document.getElementById('projectName').value = '';
      
      const modeCredsList = userCredentials[currentEnvMode] || [];
      const proj = modeCredsList.find(p => p.project_name === sel);
      if (proj) {
         document.getElementById('url').value = proj.sf_url || '';
         document.getElementById('username').value = proj.sf_username || '';
         document.getElementById('password').value = proj.sf_password || '';
      } else {
         // Clear fields if credentials do not exist for the selected project
         document.getElementById('url').value = currentEnvMode === 'sandbox' ? 'https://test.salesforce.com/' : 'https://login.salesforce.com/';
         document.getElementById('username').value = '';
         document.getElementById('password').value = '';
      }
    }
    
    // Remember the active project selection
    if (sel !== '_new_') {
      localStorage.setItem('sf_active_project', sel);
    }
    
    // Update stats UI to reflect credentials matching current selection
    if (typeof updateStatsUI === 'function') {
      updateStatsUI();
    }
  }

  function updateProjectDropdown() {
    const sel = document.getElementById('projectSelector');
    if (!sel) return;
    
    // Save current selection to restore if possible
    let currentVal = sel.value || localStorage.getItem('sf_active_project') || 'Default';
    sel.innerHTML = '';
    
    // 1. Add Default
    const defaultOpt = document.createElement('option');
    defaultOpt.value = 'Default';
    defaultOpt.textContent = 'Default';
    sel.appendChild(defaultOpt);
    
    // 2. Add System Projects from /api/projects
    const systemProjNames = new Set();
    if (Array.isArray(systemProjects)) {
      systemProjects.forEach(p => {
        if (p.name && p.name !== 'Default') {
          systemProjNames.add(p.name);
          const opt = document.createElement('option');
          opt.value = p.name;
          opt.textContent = p.name;
          sel.appendChild(opt);
        }
      });
    }
    
    // 3. Add any other projects user has credentials for that aren't in system projects
    const modeCredsList = userCredentials[currentEnvMode] || [];
    modeCredsList.forEach(p => {
      if (p.project_name && p.project_name !== 'Default' && !systemProjNames.has(p.project_name)) {
        const opt = document.createElement('option');
        opt.value = p.project_name;
        opt.textContent = p.project_name;
        sel.appendChild(opt);
      }
    });
    
    // 4. Add Create New option
    const newOpt = document.createElement('option');
    newOpt.value = '_new_';
    newOpt.textContent = '+ Create New Project';
    sel.appendChild(newOpt);
    
    // Restore selection or select first
    const options = Array.from(sel.options).map(o => o.value);
    if (options.includes(currentVal)) {
      sel.value = currentVal;
    } else if (options.length > 0) {
      sel.value = options[0];
    }
    
    loadProjectCredentials();
  }

  // ── AUTHENTICATION ──────────────────────────────
  let currentAuthTab = 'login';
  
  function switchAuthTab(tab) {
    currentAuthTab = tab;
    document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
    document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
    document.getElementById('authBtn').textContent = tab === 'login' ? 'Log In' : 'Register';
    document.getElementById('authError').textContent = '';
    
    // Show/hide extra fields for registration
    document.querySelectorAll('.auth-extra').forEach(el => {
      el.style.display = tab === 'register' ? 'block' : 'none';
    });
  }

  function togglePassword(inputId, iconEl) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
      input.type = 'text';
      iconEl.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
    } else {
      input.type = 'password';
      iconEl.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    }
  }

  let base64Avatar = '';
  function previewAvatar(input) {
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = function(e) {
        base64Avatar = e.target.result;
        const preview = document.getElementById('authAvatarPreview');
        preview.src = base64Avatar;
        preview.style.display = 'block';
      }
      reader.readAsDataURL(input.files[0]);
    }
  }


  async function submitAuth() {
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value;
    if (!username || !password) {
      document.getElementById('authError').textContent = 'Please enter username and password.';
      return;
    }
    
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        const role = data.role || (data.user && data.user.role);
        const type = data.type || (data.user && data.user.type);
        const isEmployee = role === 'admin' || type === 'internal' || type === 'employee';
        if (!isEmployee) {
          document.getElementById('authError').textContent = 'Access Denied: Only employees or internal users can access Salesforce Automator.';
          return;
        }
        sessionStorage.setItem('uat_token', data.token);
        if (data.user) sessionStorage.setItem('uat_session', JSON.stringify(data.user));
        else sessionStorage.setItem('uat_session', JSON.stringify(data));
        document.getElementById('authOverlay').style.opacity = '0';
        setTimeout(() => document.getElementById('authOverlay').style.display = 'none', 300);
        checkSession(); // load user data
      } else {
        document.getElementById('authError').textContent = data.message || data.error || 'Authentication failed.';
      }
    } catch(e) {
      document.getElementById('authError').textContent = 'Network error.';
    }
  }

  async function logout() {
    sessionStorage.removeItem('uat_token');
    sessionStorage.removeItem('uat_session');
    window.location.reload();
  }

  async function checkSession() {
    try {
      const res = await customFetch('/api/sf-auth');
      if (res.ok) {
        const data = await res.json();
        const isEmployee = data.role === 'admin' || data.type === 'internal' || data.type === 'employee';
        if (!isEmployee) {
          sessionStorage.removeItem('uat_token');
          sessionStorage.removeItem('uat_session');
          document.getElementById('authOverlay').style.display = 'flex';
          document.getElementById('authOverlay').style.opacity = '1';
          document.getElementById('authError').textContent = 'Access Denied: Only employees or internal users can access Salesforce Automator.';
          return;
        }
        document.getElementById('authOverlay').style.display = 'none';
        
        userCredentials = data.credentials || {};
        
        document.getElementById('loggedInUser').textContent = data.full_name || data.username;
        const topAvatar = document.getElementById('topAvatar');
        const initials = document.getElementById('topAvatarInitials');
        if (data.profile_pic) {
          topAvatar.src = data.profile_pic;
          topAvatar.style.display = 'block';
          if (initials) initials.style.display = 'none';
        } else {
          topAvatar.style.display = 'none';
          if (initials) {
            initials.style.display = 'flex';
            const name = data.full_name || data.username || 'U';
            initials.textContent = name.charAt(0).toUpperCase();
          }
        }

        // Fetch system projects
        try {
          const projRes = await customFetch('/api/projects');
          if (projRes.ok) {
            systemProjects = await projRes.json();
          }
        } catch(e) {
          console.error("Failed to fetch system projects:", e);
        }

        updateProjectDropdown();
        if (typeof loadHistory === 'function') loadHistory();
        if (typeof updateStatsUI === 'function') updateStatsUI();
      } else {
        const uatSessionStr = sessionStorage.getItem('uat_session');
        if (uatSessionStr && !window.__autoLoginAttempted) {
          window.__autoLoginAttempted = true;
          // No auto_login needed for Vercel API since we pass Bearer token directly
        }
        document.getElementById('authOverlay').style.display = 'flex';
        document.getElementById('authOverlay').style.opacity = '1';
      }
    } catch(e) {
      document.getElementById('authError').textContent = 'Cannot connect to server.';
    }
  }
  
  function setMode(mode, isManualClick = false) {
    currentEnvMode = mode;
    localStorage.setItem('sf_env_mode', mode);

    if (typeof updateUserUsername === 'function') {
      updateUserUsername();
      const pwdCheckbox = document.getElementById('userGenPassword');
      if (pwdCheckbox) {
        if (mode === 'sandbox' || mode === 'development') {
          pwdCheckbox.checked = false;
          pwdCheckbox.disabled = true;
          document.getElementById('userGenPasswordNote').textContent = 'Disabled in Sandbox/Dev mode.';
        } else {
          pwdCheckbox.disabled = false;
          pwdCheckbox.checked = true;
          document.getElementById('userGenPasswordNote').textContent = 'Enabled in Production mode.';
        }
      }
    }

    const body = document.getElementById('appBody');
    if (body) body.className = mode;

    // Update badge
    const badgeText = document.getElementById('badgeText');
    if (badgeText) badgeText.textContent = mode === 'production' ? 'PRODUCTION' : (mode === 'development' ? 'DEVELOPMENT' : 'SANDBOX');

    // Update note
    const note = document.getElementById('settingsNote');
    if (note) {
      if (mode === 'production') {
        note.textContent = '🔴 Production mode active — UI is red. Real data will be modified!';
      } else if (mode === 'development') {
        note.textContent = '🟢 Development mode active — UI is green. For Dev/Scratch orgs.';
      } else {
        note.textContent = '🔵 Sandbox mode active — UI is blue. Safe to test.';
      }
    }

    // Update status
    const statusText = document.getElementById('statusText');
    if (statusText) {
      statusText.textContent =
        mode === 'production' ? 'production mode — live environment' : (mode === 'development' ? 'development mode — ready' : 'sandbox mode — ready');
    }

    // Update card selections
    const sandboxCard = document.getElementById('card-sandbox');
    const productionCard = document.getElementById('card-production');
    const developmentCard = document.getElementById('card-development');
    if (sandboxCard) sandboxCard.classList.toggle('selected', mode === 'sandbox');
    if (productionCard) productionCard.classList.toggle('selected', mode === 'production');
    if (developmentCard) developmentCard.classList.toggle('selected', mode === 'development');

    // Update topbar select
    const topbarEnv = document.getElementById('topbarEnvSelect');
    if (topbarEnv) topbarEnv.value = mode;

    if (isManualClick) {
      updateProjectDropdown();
      const urlInput = document.getElementById('url');
      if (urlInput) localStorage.setItem('sf_url', urlInput.value);
    }

    if (typeof updateStatsUI === 'function') {
      updateStatsUI();
    }
  }

  // Call immediately when DOM is ready
  window.addEventListener('DOMContentLoaded', () => {
    checkSession();
    // Apply saved mode on load
    setMode(currentEnvMode);
  });

  // ── TAB SWITCHING ────────────────────────────────
    function toggleUserAction() {
    const action = document.getElementById('userActionSelect').value;
    if (action === 'create') {
      document.getElementById('userCreateFields').style.display = 'block';
      document.getElementById('userUpdateFields').style.display = 'none';
      document.querySelectorAll('#userCreateFields .single-user-req').forEach(el => el.setAttribute('required', 'true'));
      document.getElementById('updateUserUsername').removeAttribute('required');
      document.getElementById('btn-label').textContent = 'Run User Automation';
    } else {
      document.getElementById('userCreateFields').style.display = 'none';
      document.getElementById('userUpdateFields').style.display = 'block';
      document.querySelectorAll('#userCreateFields .single-user-req').forEach(el => el.removeAttribute('required'));
      document.getElementById('updateUserUsername').setAttribute('required', 'true');
      document.getElementById('btn-label').textContent = 'Run Status Automation';
    }
  }

  function updateUserUsername() {
    const email = document.getElementById('userEmail').value.trim();
    const username = document.getElementById('userUsername');
    if (!username) return;
    if (!email) {
      username.value = '';
      return;
    }
    if (currentEnvMode === 'sandbox' || currentEnvMode === 'development') {
      username.value = email + '.uat';
    } else {
      username.value = email;
    }
  }
  
  let currentMode = 'single';
  let currentTaskType = 'field';
  function switchTab(mode, event) {
    currentMode = mode;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if (event) event.target.classList.add('active');
    else {
      const btn = document.querySelector(`.tab-btn[onclick*="'${mode}'"]`);
      if (btn) btn.classList.add('active');
    }
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(`${mode}-tab`).classList.add('active');

    if (mode === 'history') {
      loadHistory();
      document.querySelector('.submit-wrap').style.display = 'none';
    } else if (mode === 'schema') {
      loadSchemaObjects();
      document.querySelector('.submit-wrap').style.display = 'none';
    } else if (mode === 'flow') {
      document.querySelector('.submit-wrap').style.display = 'block';
      document.getElementById('btn-label').textContent = 'Create Flow in Salesforce';
    } else {
      document.querySelector('.submit-wrap').style.display = 'block';
      if (mode === 'single') {
        document.getElementById('btn-label').textContent = 'Run Field Automation';
      } else if (mode === 'validation') {
        document.getElementById('btn-label').textContent = 'Run Validation Automation';
      } else if (mode === 'user') {
        document.getElementById('btn-label').textContent = 'Run User Automation';
      } else if (mode === 'change') {
        document.getElementById('btn-label').textContent = 'Run Change Type Automation';
      } else {
        document.getElementById('btn-label').textContent = 'Run Bulk Automation';
      }
    }

    if (mode === 'single') {
      currentTaskType = 'field';
      document.querySelectorAll('.single-req').forEach(el => el.setAttribute('required','true'));
      document.querySelectorAll('.single-val-req').forEach(el => el.removeAttribute('required'));
      document.querySelectorAll('.single-user-req').forEach(el => el.removeAttribute('required'));
      document.querySelectorAll('.bulk-req').forEach(el => el.removeAttribute('required'));
      document.querySelectorAll('.change-req').forEach(el => el.removeAttribute('required'));
    } else if (mode === 'validation') {
      currentTaskType = 'validation_rule';
      document.querySelectorAll('.single-req').forEach(el => el.removeAttribute('required'));
      document.querySelectorAll('.single-val-req').forEach(el => el.setAttribute('required','true'));
      document.querySelectorAll('.single-user-req').forEach(el => el.removeAttribute('required'));
      document.querySelectorAll('.bulk-req').forEach(el => el.removeAttribute('required'));
      document.querySelectorAll('.change-req').forEach(el => el.removeAttribute('required'));
      // Auto-load fields from history for the current object name
      loadObjectFields();
    } else if (mode === 'user') {
      currentTaskType = 'user';
      document.querySelectorAll('.single-req').forEach(el => el.removeAttribute('required'));
      document.querySelectorAll('.single-val-req').forEach(el => el.removeAttribute('required'));
      document.querySelectorAll('.single-user-req').forEach(el => el.setAttribute('required','true'));
      document.querySelectorAll('.bulk-req').forEach(el => el.removeAttribute('required'));
      document.querySelectorAll('.change-req').forEach(el => el.removeAttribute('required'));
    } else if (mode === 'bulk') {
      document.querySelectorAll('.single-req, .single-val-req, .single-user-req, .change-req').forEach(el => el.removeAttribute('required'));
      document.querySelectorAll('.bulk-req').forEach(el => el.setAttribute('required','true'));
      document.querySelectorAll('.flow-req').forEach(el => el.removeAttribute('required'));
    } else if (mode === 'flow') {
      currentTaskType = 'flow';
      document.querySelectorAll('.single-req, .single-val-req, .single-user-req, .bulk-req, .change-req').forEach(el => el.removeAttribute('required'));
      document.querySelectorAll('.flow-req').forEach(el => el.setAttribute('required','true'));
    } else if (mode === 'change') {
      currentTaskType = 'change_field_type';
      document.querySelectorAll('.single-req, .single-val-req, .single-user-req, .bulk-req, .flow-req').forEach(el => el.removeAttribute('required'));
      document.querySelectorAll('.change-req').forEach(el => el.setAttribute('required','true'));
    } else {
      document.querySelectorAll('.single-req, .single-val-req, .single-user-req, .bulk-req, .flow-req, .change-req').forEach(el => el.removeAttribute('required'));
    }
  }
  
  // ── FLOW BUILDER ─────────────────────────────────
  let flowElements = [];
  let flowVariables = [];
  let flowEditingIdx = -1;

  const FLOW_ELEMENT_ICONS = {
    Assignment:   '📝',
    Decision:     '🔀',
    RecordCreate: '➕',
    RecordUpdate: '✏️',
    Screen:       '🖥️',
    Loop:         '🔁',
  };

  const FLOW_ELEMENT_COLORS = {
    Assignment:   'rgba(59,130,246,0.12)',
    Decision:     'rgba(245,158,11,0.12)',
    RecordCreate: 'rgba(16,185,129,0.12)',
    RecordUpdate: 'rgba(139,92,246,0.12)',
    Screen:       'rgba(99,102,241,0.12)',
    Loop:         'rgba(249,115,22,0.12)',
  };

  function autoFlowApiName() {
    const lbl = document.getElementById('flowLabel').value;
    document.getElementById('flowApiName').value = lbl.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  }

  function onFlowTypeChange() {
    const type = document.getElementById('flowType').value;
    const isRecordTriggered = type === 'RecordBeforeSave' || type === 'RecordAfterSave';
    document.getElementById('flowTriggerConfig').style.display = isRecordTriggered ? '' : 'none';
  }

  function renderFlowElements() {
    const list = document.getElementById('flowElementList');
    const empty = document.getElementById('flowEmptyState');
    if (flowElements.length === 0) {
      list.innerHTML = '';
      list.appendChild(empty);
      empty.style.display = '';
      return;
    }
    list.innerHTML = '';
    flowElements.forEach((el, idx) => {
      const card = document.createElement('div');
      card.style.cssText = `display:flex;align-items:center;gap:10px;padding:0.65rem 0.85rem;border-radius:9px;background:${FLOW_ELEMENT_COLORS[el.type]||'var(--surface2)'};border:1px solid var(--border-md);cursor:pointer;transition:filter 0.15s;`;
      card.innerHTML = `
        <span style="font-size:1.1rem;flex-shrink:0;">${FLOW_ELEMENT_ICONS[el.type] || '📦'}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.82rem;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${el.name || el.type}</div>
          <div style="font-size:0.72rem;color:var(--muted);">${el.type}${el.object ? ' · ' + el.object : ''}${el.label ? ' · "' + el.label + '"' : ''}</div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0;">
          <button type="button" title="Edit" style="background:transparent;border:none;color:var(--mode-accent);cursor:pointer;font-size:0.8rem;padding:2px 6px;border-radius:4px;" onclick="editFlowElement(${idx})">Edit</button>
          <button type="button" title="Move Up" style="background:transparent;border:none;color:var(--muted);cursor:pointer;padding:2px 4px;" onclick="moveFlowElement(${idx},-1)">↑</button>
          <button type="button" title="Move Down" style="background:transparent;border:none;color:var(--muted);cursor:pointer;padding:2px 4px;" onclick="moveFlowElement(${idx},1)">↓</button>
          <button type="button" title="Delete" style="background:transparent;border:none;color:#ef4444;cursor:pointer;padding:2px 4px;" onclick="deleteFlowElement(${idx})">✕</button>
        </div>`;
      list.appendChild(card);
    });
  }

  function addFlowElement(type) {
    const names = { Assignment: 'My_Assignment', Decision: 'My_Decision', RecordCreate: 'My_Record_Create', RecordUpdate: 'My_Record_Update', Screen: 'My_Screen', Loop: 'My_Loop' };
    flowElements.push({ type, name: names[type] || type, object: '', field: '', value: '', label: '', condition: '', variable: '' });
    renderFlowElements();
    editFlowElement(flowElements.length - 1);
  }

  function deleteFlowElement(idx) {
    flowElements.splice(idx, 1);
    if (flowEditingIdx === idx) closeFlowEditor();
    else if (flowEditingIdx > idx) flowEditingIdx--;
    renderFlowElements();
  }

  function moveFlowElement(idx, dir) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= flowElements.length) return;
    [flowElements[idx], flowElements[newIdx]] = [flowElements[newIdx], flowElements[idx]];
    if (flowEditingIdx === idx) flowEditingIdx = newIdx;
    else if (flowEditingIdx === newIdx) flowEditingIdx = idx;
    renderFlowElements();
  }

  function editFlowElement(idx) {
    flowEditingIdx = idx;
    const el = flowElements[idx];
    document.getElementById('flowEditorTitle').textContent = `${FLOW_ELEMENT_ICONS[el.type] || ''} ${el.type} Element`;
    const body = document.getElementById('flowEditorBody');
    let html = `<div class="row"><div class="field"><label>Element Name (API)</label><input type="text" id="feApiName" value="${el.name || ''}" placeholder="e.g. Update_Account" style="font-family:var(--font-mono);font-size:0.83rem;"></div>`;
    if (el.type === 'Assignment') {
      html += `<div class="field"><label>Variable to Assign</label><input type="text" id="feVar" value="${el.variable || ''}" placeholder="e.g. varAccountName"></div></div>
        <div class="row"><div class="field"><label>Assign Value</label><input type="text" id="feValue" value="${el.value || ''}" placeholder="Literal or {!varName}"></div></div>`;
    } else if (el.type === 'Decision') {
      html += `<div class="field"><label>Default Outcome Label</label><input type="text" id="feLabel" value="${el.label || 'Default'}" placeholder="Default"></div></div>
        <div class="row"><div class="field"><label>Condition (rule)</label><input type="text" id="feCondition" value="${el.condition || ''}" placeholder="e.g. {!varStatus} == Active"></div></div>`;
    } else if (el.type === 'RecordCreate' || el.type === 'RecordUpdate') {
      html += `<div class="field"><label>Object API Name</label><input type="text" id="feObject" value="${el.object || ''}" placeholder="e.g. Account"></div></div>
        <div class="row"><div class="field"><label>Field API Name</label><input type="text" id="feField" value="${el.field || ''}" placeholder="e.g. Name"></div>
        <div class="field"><label>Value / Variable</label><input type="text" id="feValue" value="${el.value || ''}" placeholder="e.g. {!flowInput} or literal"></div></div>`;
    } else if (el.type === 'Screen') {
      html += `<div class="field"><label>Screen Label</label><input type="text" id="feLabel" value="${el.label || ''}" placeholder="e.g. Enter Account Info"></div></div>`;
    } else if (el.type === 'Loop') {
      html += `<div class="field"><label>Collection Variable</label><input type="text" id="feVar" value="${el.variable || ''}" placeholder="e.g. varAccountList"></div></div>`;
    } else {
      html += `</div>`;
    }
    html += `<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:0.75rem;">
      <button type="button" class="save-btn" style="padding:0.35rem 0.9rem;font-size:0.78rem;" onclick="saveFlowElement()">Save Element</button></div>`;
    body.innerHTML = html;
    document.getElementById('flowElementEditor').style.display = '';
  }

  function saveFlowElement() {
    if (flowEditingIdx < 0) return;
    const el = flowElements[flowEditingIdx];
    el.name = (document.getElementById('feApiName')?.value || el.name).replace(/\s+/g,'_');
    const feVar = document.getElementById('feVar');
    const feValue = document.getElementById('feValue');
    const feLabel = document.getElementById('feLabel');
    const feObject = document.getElementById('feObject');
    const feField = document.getElementById('feField');
    const feCondition = document.getElementById('feCondition');
    if (feVar) el.variable = feVar.value;
    if (feValue) el.value = feValue.value;
    if (feLabel) el.label = feLabel.value;
    if (feObject) el.object = feObject.value;
    if (feField) el.field = feField.value;
    if (feCondition) el.condition = feCondition.value;
    closeFlowEditor();
    renderFlowElements();
  }

  function closeFlowEditor() {
    flowEditingIdx = -1;
    document.getElementById('flowElementEditor').style.display = 'none';
    document.getElementById('flowEditorBody').innerHTML = '';
  }

  function addFlowVariable() {
    const row = document.createElement('div');
    const idx = flowVariables.length;
    row.id = `flowVar_${idx}`;
    row.style.cssText = 'display:flex;gap:8px;align-items:center;';
    row.innerHTML = `
      <input type="text" placeholder="Variable Name" style="flex:1;padding:0.4rem;border-radius:6px;background:var(--surface2);border:1px solid var(--border-md);color:var(--text);font-family:var(--font-mono);font-size:0.8rem;" id="fvName_${idx}">
      <select style="padding:0.4rem;border-radius:6px;background:var(--surface2);border:1px solid var(--border-md);color:var(--text);" id="fvType_${idx}">
        <option>String</option><option>Boolean</option><option>Number</option><option>Date</option><option>SObject</option><option>SObject Collection</option>
      </select>
      <input type="text" placeholder="Default Value" style="flex:1;padding:0.4rem;border-radius:6px;background:var(--surface2);border:1px solid var(--border-md);color:var(--text);" id="fvDefault_${idx}">
      <button type="button" style="background:transparent;border:none;color:#ef4444;cursor:pointer;font-size:1rem;" onclick="removeFlowVariable(${idx})">✕</button>`;
    flowVariables.push({ name: '', type: 'String', defaultValue: '' });
    const list = document.getElementById('flowVariableList');
    document.getElementById('flowVarEmpty').style.display = 'none';
    list.appendChild(row);
    row.querySelector(`#fvName_${idx}`).addEventListener('input', e => { flowVariables[idx].name = e.target.value; });
    row.querySelector(`#fvType_${idx}`).addEventListener('change', e => { flowVariables[idx].type = e.target.value; });
    row.querySelector(`#fvDefault_${idx}`).addEventListener('input', e => { flowVariables[idx].defaultValue = e.target.value; });
  }

  function removeFlowVariable(idx) {
    flowVariables[idx] = null;
    const row = document.getElementById(`flowVar_${idx}`);
    if (row) row.remove();
    if (flowVariables.filter(Boolean).length === 0) document.getElementById('flowVarEmpty').style.display = '';
  }

  function buildFlowPayload() {
    return {
      label: document.getElementById('flowLabel').value,
      apiName: document.getElementById('flowApiName').value,
      type: document.getElementById('flowType').value,
      description: document.getElementById('flowDescription').value,
      triggerObject: document.getElementById('flowTriggerObject')?.value || '',
      triggerEvent: document.getElementById('flowTriggerEvent')?.value || '',
      elements: flowElements,
      variables: flowVariables.filter(Boolean).filter(v => v.name)
    };
  }

  // ── HISTORY ─────────────────────────────────────
  let allHistoryData = [];
  let filteredHistoryData = [];
  let historyCurrentPage = 1;
  const historyPerPage = 10;

  async function loadHistory() {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--muted);">Loading history...</td></tr>';
    try {
      const res = await customFetch('/api/sf-history');
      if (res.ok) {
        const data = await res.json();
        allHistoryData = data.reverse();
        filteredHistoryData = [...allHistoryData];
        renderHistoryTable();
      } else {
        throw new Error('Failed to fetch');
      }
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:red;">Failed to load history.</td></tr>';
    }
  }

  function renderHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    if (filteredHistoryData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--muted);">No history found.</td></tr>';
      document.getElementById('historyPageInfo').textContent = 'Page 1 of 1';
      return;
    }
    tbody.innerHTML = '';
    
    const totalPages = Math.ceil(filteredHistoryData.length / historyPerPage);
    if (historyCurrentPage > totalPages) historyCurrentPage = totalPages;
    if (historyCurrentPage < 1) historyCurrentPage = 1;
    
    document.getElementById('historyPageInfo').textContent = `Page ${historyCurrentPage} of ${totalPages}`;
    
    const startIdx = (historyCurrentPage - 1) * historyPerPage;
    const pageData = filteredHistoryData.slice(startIdx, startIdx + historyPerPage);
    
    pageData.forEach(row => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border)';
      const d = new Date(row.timestamp);
      
      let actionHtml = '';
      if (row.dataType !== 'Validation Rule' && row.dataType !== 'User Creation') {
        actionHtml = `<button type="button" class="save-btn" style="padding:4px 8px; font-size:0.75rem; border-radius:6px;" onclick="createValidationForHistoryField('${row.objectName.replace(/'/g, "\\'")}', '${row.fieldName.replace(/'/g, "\\'")}')">Create Val Rule</button>`;
      } else {
        actionHtml = `<span style="color:var(--muted); font-size:0.75rem;">—</span>`;
      }

      tr.innerHTML = `
        <td style="padding:0.75rem 0.5rem; color:var(--subtle);">${d.toLocaleString()}</td>
        <td style="padding:0.75rem 0.5rem;">${row.projectName}</td>
        <td style="padding:0.75rem 0.5rem;">${row.objectName}</td>
        <td style="padding:0.75rem 0.5rem;">${row.dataType}</td>
        <td style="padding:0.75rem 0.5rem;">${row.fieldLabel}</td>
        <td style="padding:0.75rem 0.5rem; font-family:var(--font-mono); font-size:0.75rem; color:var(--mode-accent);">${row.fieldName}</td>
        <td style="padding:0.75rem 0.5rem;">${actionHtml}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function prevHistoryPage() {
    if (historyCurrentPage > 1) {
      historyCurrentPage--;
      renderHistoryTable();
    }
  }
  function nextHistoryPage() {
    const totalPages = Math.ceil(filteredHistoryData.length / historyPerPage);
    if (historyCurrentPage < totalPages) {
      historyCurrentPage++;
      renderHistoryTable();
    }
  }

  function filterHistory() {
    const query = document.getElementById('historySearch').value.toLowerCase();
    if (!query) {
      filteredHistoryData = [...allHistoryData];
    } else {
      filteredHistoryData = allHistoryData.filter(row => {
        return (
          (row.projectName && row.projectName.toLowerCase().includes(query)) ||
          (row.objectName && row.objectName.toLowerCase().includes(query)) ||
          (row.dataType && row.dataType.toLowerCase().includes(query)) ||
          (row.fieldLabel && row.fieldLabel.toLowerCase().includes(query)) ||
          (row.fieldName && row.fieldName.toLowerCase().includes(query))
        );
      });
    }
    historyCurrentPage = 1;
    renderHistoryTable();
  }

  function exportHistory() {
    if (filteredHistoryData.length === 0) {
      showToast('No history to export.');
      return;
    }
    
    const csvRows = ['Timestamp,Project,Object,DataType,FieldLabel,FieldName'];
    filteredHistoryData.forEach(row => {
      csvRows.push(`"${row.timestamp}","${row.projectName}","${row.objectName}","${row.dataType}","${row.fieldLabel}","${row.fieldName}"`);
    });
    const csv = csvRows.join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `salesforce_history_${new Date().getTime()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  function createValidationForHistoryField(objectName, fieldName) {
    // 1. Switch tab to 'validation'
    switchTab('validation', null);
    
    // 2. Pre-fill Object Name and Error Location Field
    const valObjectName = document.getElementById('valObjectName');
    if (valObjectName) {
      valObjectName.value = objectName;
    }
    
    const valErrorField = document.getElementById('valErrorField');
    if (valErrorField) {
      valErrorField.value = fieldName;
    }

    // Pre-fill a template formula and rule name
    const valRuleName = document.getElementById('valRuleName');
    if (valRuleName) {
      const cleanFieldName = fieldName.replace(/__c$/, '');
      valRuleName.value = `Verify_${cleanFieldName}`;
    }

    const valFormula = document.getElementById('valFormula');
    if (valFormula) {
      valFormula.value = `ISBLANK(${fieldName})`;
      valFormula.focus();
    }

    const valErrorMsg = document.getElementById('valErrorMsg');
    if (valErrorMsg) {
      const cleanFieldName = fieldName.replace(/__c$/, '').replace(/_/g, ' ');
      valErrorMsg.value = `${cleanFieldName} is required.`;
    }
    
    document.getElementById('statusText').textContent = `pre-filled validation rule for ${fieldName}`;
  }
  // ── OBJECT FIELD LOADER ───────────────────────────
  let _valFieldData = [];          // cache of fields for current object
  let _fieldLoadTimer = null;

  function scheduleFieldLoad() {
    clearTimeout(_fieldLoadTimer);
    _fieldLoadTimer = setTimeout(loadObjectFields, 600);
  }

  async function loadObjectFields() {
    const objectName = document.getElementById('valObjectName').value.trim();
    const statusEl = document.getElementById('valFieldsStatus');
    const optionsElTarget = document.getElementById('valTargetFieldOptions');
    const optionsElError = document.getElementById('valErrorFieldOptions');

    if (!objectName) {
      _valFieldData = [];
      if (optionsElTarget) { optionsElTarget.innerHTML = ''; optionsElTarget.classList.remove('open'); }
      if (optionsElError) { optionsElError.innerHTML = ''; optionsElError.classList.remove('open'); }
      if (statusEl) statusEl.textContent = '';
      return;
    }

    if (statusEl) statusEl.textContent = 'loading…';
    try {
      const res = await customFetch(`/api/sf-fields?object=${encodeURIComponent(objectName)}`);
      if (!res.ok) throw new Error('API error');
      _valFieldData = await res.json();

      if (statusEl) {
        statusEl.textContent = _valFieldData.length > 0
          ? `${_valFieldData.length} field${_valFieldData.length > 1 ? 's' : ''} found`
          : 'no fields in history';
      }
      renderValFieldOptions(_valFieldData, 'valTargetField');
      renderValFieldOptions(_valFieldData, 'valErrorField');
    } catch (e) {
      if (statusEl) statusEl.textContent = 'could not load fields';
      _valFieldData = [];
    }
  }

  function renderValFieldOptions(fields, targetId) {
    const optionsEl = document.getElementById(targetId + 'Options');
    if (!optionsEl) return;
    optionsEl.innerHTML = '';
    if (fields.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'option';
      emptyEl.style.color = 'var(--muted)';
      emptyEl.textContent = 'No fields found for this object';
      optionsEl.appendChild(emptyEl);
    } else {
      // Add a "Top of Page" / blank option first
      const blankOpt = document.createElement('div');
      blankOpt.className = 'option';
      blankOpt.style.color = 'var(--muted)';
      blankOpt.textContent = '— Clear selection (leave blank) —';
      blankOpt.addEventListener('click', () => {
        document.getElementById(targetId).value = '';
        optionsEl.classList.remove('open');
      });
      optionsEl.appendChild(blankOpt);

      fields.forEach(f => {
        const div = document.createElement('div');
        div.className = 'option';
        div.innerHTML = `<span style="font-family:var(--font-mono);font-size:0.8rem;color:var(--mode-accent);">${f.fieldName}</span>
          <span style="font-size:0.72rem;color:var(--muted);margin-left:6px;">${f.fieldLabel} · ${f.dataType}</span>`;
        div.addEventListener('click', () => {
          document.getElementById(targetId).value = f.fieldName;
          optionsEl.classList.remove('open');
        });
        optionsEl.appendChild(div);
      });
    }
  }

  function filterValFields(targetId) {
    const query = document.getElementById(targetId).value.toLowerCase();
    const optionsEl = document.getElementById(targetId + 'Options');

    // Show dropdown if it has items
    if (_valFieldData.length > 0 || query) {
      const filtered = query
        ? _valFieldData.filter(f =>
            f.fieldName.toLowerCase().includes(query) ||
            f.fieldLabel.toLowerCase().includes(query))
        : _valFieldData;
      renderValFieldOptions(filtered, targetId);
      optionsEl.classList.add('open');
    }
  }

  function openValFieldDropdown(targetId) {
    if (_valFieldData.length === 0) {
      loadObjectFields();
    } else {
      const el = document.getElementById(targetId + 'Options');
      if (el) el.classList.add('open');
    }
  }

  // Close the val field dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#valErrorFieldWrap')) {
      const optElError = document.getElementById('valErrorFieldOptions');
      if (optElError) optElError.classList.remove('open');
    }
    if (!e.target.closest('#valTargetFieldWrap')) {
      const optElTarget = document.getElementById('valTargetFieldOptions');
      if (optElTarget) optElTarget.classList.remove('open');
    }
  });

  function applyValPreset() {
    const valTemplate = document.getElementById('valTemplate').value;
    const formulaTextarea = document.getElementById('valFormula');
    const msgTextarea = document.getElementById('valErrorMsg');
    const ruleInput = document.getElementById('valRuleName');

    if (!valTemplate) return;

    let formula = '';
    let message = '';
    let ruleName = '';
    let errorField = document.getElementById('valTargetField').value || document.getElementById('valErrorField').value || 'FieldName__c';
    const cleanFieldName = errorField.replace(/__c$/, '');
    const humanName = cleanFieldName.replace(/_/g, ' ');

    switch(valTemplate) {
      // ── Field Checks ──
      case 'required':
        formula = `ISBLANK(${errorField})`;
        message = `${humanName} is required.`;
        ruleName = `${cleanFieldName}_Is_Required`;
        break;
      case 'null_check':
        formula = `ISNULL(${errorField})`;
        message = `${humanName} cannot be null.`;
        ruleName = `${cleanFieldName}_Not_Null`;
        break;
      case 'number_check':
        formula = `NOT(ISNUMBER(TEXT(${errorField})))`;
        message = `${humanName} must be a valid number.`;
        ruleName = `${cleanFieldName}_Must_Be_Number`;
        break;
      case 'field_changed':
        formula = `ISCHANGED(${errorField})`;
        message = `${humanName} cannot be modified after creation.`;
        ruleName = `${cleanFieldName}_No_Change`;
        break;

      // ── Text Validations ──
      case 'email':
        formula = `NOT(REGEX(${errorField}, "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\\\.[A-Za-z]{2,}$"))`;
        message = `Enter a valid email address.`;
        ruleName = `Validate_Email_${cleanFieldName}`;
        break;
      case 'phone':
        formula = `NOT(REGEX(${errorField}, "^\\\\+?[0-9]{10,15}$"))`;
        message = `Enter a valid phone number (10-15 digits).`;
        ruleName = `Validate_Phone_${cleanFieldName}`;
        break;
      case 'pan':
        formula = `NOT(REGEX(${errorField}, "[A-Z]{5}[0-9]{4}[A-Z]"))`;
        message = `Enter a valid PAN number (e.g. ABCDE1234F).`;
        ruleName = `Validate_PAN_${cleanFieldName}`;
        break;
      case 'min_length':
        formula = `LEN(${errorField}) < 5`;
        message = `${humanName} must be at least 5 characters.`;
        ruleName = `${cleanFieldName}_Min_Length`;
        break;
      case 'max_length':
        formula = `LEN(${errorField}) > 100`;
        message = `${humanName} cannot exceed 100 characters.`;
        ruleName = `${cleanFieldName}_Max_Length`;
        break;
      case 'no_special':
        formula = `NOT(REGEX(${errorField}, "^[a-zA-Z0-9 ]*$"))`;
        message = `${humanName} must not contain special characters.`;
        ruleName = `${cleanFieldName}_No_Special_Chars`;
        break;
      case 'url_format':
        formula = `NOT(REGEX(${errorField}, "^https?://[a-zA-Z0-9.-]+\\\\.[a-zA-Z]{2,}(/.*)?$"))`;
        message = `Enter a valid URL starting with http:// or https://.`;
        ruleName = `Validate_URL_${cleanFieldName}`;
        break;
      case 'begins_with':
        formula = `NOT(BEGINS(${errorField}, "PREFIX"))`;
        message = `${humanName} must begin with PREFIX.`;
        ruleName = `${cleanFieldName}_Must_Begin_With`;
        break;
      case 'contains_check':
        formula = `NOT(CONTAINS(${errorField}, "VALUE"))`;
        message = `${humanName} must contain VALUE.`;
        ruleName = `${cleanFieldName}_Must_Contain`;
        break;

      // ── Date Validations ──
      case 'past_date':
        formula = `${errorField} < TODAY()`;
        message = `Date cannot be in the past.`;
        ruleName = `Prevent_Past_${cleanFieldName}`;
        break;
      case 'future_date':
        formula = `${errorField} > TODAY()`;
        message = `Future dates are not allowed.`;
        ruleName = `Prevent_Future_${cleanFieldName}`;
        break;
      case 'end_date':
        formula = `${errorField} < Start_Date__c`;
        message = `End Date must be after Start Date.`;
        ruleName = `${cleanFieldName}_After_Start`;
        break;
      case 'weekday_only':
        formula = `CASE(MOD(DATEVALUE(${errorField}) - DATE(1900,1,7), 7), 0, TRUE, 6, TRUE, FALSE)`;
        message = `${humanName} must be a weekday (Mon–Fri).`;
        ruleName = `${cleanFieldName}_Weekday_Only`;
        break;
      case 'age_check':
        formula = `(TODAY() - DATEVALUE(${errorField})) / 365.25 < 18`;
        message = `Person must be at least 18 years old.`;
        ruleName = `${cleanFieldName}_Min_Age_18`;
        break;

      // ── Number Validations ──
      case 'negative':
        formula = `${errorField} < 0`;
        message = `${humanName} cannot be negative.`;
        ruleName = `${cleanFieldName}_No_Negative`;
        break;
      case 'range':
        formula = `OR(${errorField} < 1, ${errorField} > 100)`;
        message = `${humanName} must be between 1 and 100.`;
        ruleName = `${cleanFieldName}_Range_Check`;
        break;
      case 'multiple_of':
        formula = `MOD(${errorField}, 10) <> 0`;
        message = `${humanName} must be a multiple of 10.`;
        ruleName = `${cleanFieldName}_Multiple_Of_10`;
        break;
      case 'max_value':
        formula = `${errorField} > 999999`;
        message = `${humanName} cannot exceed 999,999.`;
        ruleName = `${cleanFieldName}_Max_Value`;
        break;

      // ── Picklist Validations ──
      case 'picklist_required':
        formula = `ISPICKVAL(${errorField}, "")`;
        message = `Please select a value for ${humanName}.`;
        ruleName = `${cleanFieldName}_Picklist_Required`;
        break;
      case 'picklist_block':
        formula = `ISPICKVAL(${errorField}, "Blocked Value")`;
        message = `The value "Blocked Value" is not allowed for ${humanName}.`;
        ruleName = `${cleanFieldName}_Block_Value`;
        break;

      // ── Cross-Field / Advanced ──
      case 'conditional_required':
        formula = `AND(ISPICKVAL(Status__c, "Active"), ISBLANK(${errorField}))`;
        message = `${humanName} is required when Status is Active.`;
        ruleName = `${cleanFieldName}_Conditional_Req`;
        break;
      case 'both_or_none':
        formula = `OR(AND(ISBLANK(${errorField}), NOT(ISBLANK(Related_Field__c))), AND(NOT(ISBLANK(${errorField})), ISBLANK(Related_Field__c)))`;
        message = `Both ${humanName} and Related Field must be filled, or both must be blank.`;
        ruleName = `${cleanFieldName}_Both_Or_None`;
        break;
      case 'admin_bypass':
        formula = `AND(${errorField} < 0, $Profile.Name <> "System Administrator")`;
        message = `Only System Administrators can set negative values for ${humanName}.`;
        ruleName = `${cleanFieldName}_Admin_Bypass`;
        break;
    }

    formulaTextarea.value = formula;
    msgTextarea.value = message;
    ruleInput.value = ruleName;

    // Trigger input events to update counters
    msgTextarea.dispatchEvent(new Event('input'));
    formulaTextarea.focus();
  }

  // ── FORMULA FUNCTION REFERENCE DATA ──────────────
  const FX_DATA = [
    // Logical
    {cat:'Logical', fn:'AND()', insert:'AND(, )', hint:'All conditions true'},
    {cat:'Logical', fn:'OR()', insert:'OR(, )', hint:'Any condition true'},
    {cat:'Logical', fn:'NOT()', insert:'NOT()', hint:'Reverse TRUE/FALSE'},
    {cat:'Logical', fn:'IF()', insert:'IF(condition, true_val, false_val)', hint:'Conditional logic'},
    {cat:'Logical', fn:'CASE()', insert:'CASE(field, val1, result1, val2, result2, default)', hint:'Multi-condition'},

    // Text
    {cat:'Text', fn:'LEN()', insert:'LEN(field)', hint:'Text length'},
    {cat:'Text', fn:'LEFT()', insert:'LEFT(field, num)', hint:'Left characters'},
    {cat:'Text', fn:'RIGHT()', insert:'RIGHT(field, num)', hint:'Right characters'},
    {cat:'Text', fn:'MID()', insert:'MID(field, start, length)', hint:'Middle characters'},
    {cat:'Text', fn:'FIND()', insert:'FIND(search, field)', hint:'Find position'},
    {cat:'Text', fn:'SUBSTITUTE()', insert:'SUBSTITUTE(field, old, new)', hint:'Replace text'},
    {cat:'Text', fn:'TEXT()', insert:'TEXT(field)', hint:'Convert to text'},
    {cat:'Text', fn:'TRIM()', insert:'TRIM(field)', hint:'Remove spaces'},
    {cat:'Text', fn:'LOWER()', insert:'LOWER(field)', hint:'To lowercase'},
    {cat:'Text', fn:'UPPER()', insert:'UPPER(field)', hint:'To uppercase'},
    {cat:'Text', fn:'CONTAINS()', insert:'CONTAINS(field, "value")', hint:'Contains value'},
    {cat:'Text', fn:'BEGINS()', insert:'BEGINS(field, "value")', hint:'Starts with'},
    {cat:'Text', fn:'LPAD()', insert:'LPAD(field, length, "pad")', hint:'Pad left'},
    {cat:'Text', fn:'RPAD()', insert:'RPAD(field, length, "pad")', hint:'Pad right'},
    {cat:'Text', fn:'BR()', insert:'BR()', hint:'Line break'},

    // Date & Time
    {cat:'Date/Time', fn:'TODAY()', insert:'TODAY()', hint:'Current date'},
    {cat:'Date/Time', fn:'NOW()', insert:'NOW()', hint:'Current date+time'},
    {cat:'Date/Time', fn:'DATE()', insert:'DATE(year, month, day)', hint:'Create date'},
    {cat:'Date/Time', fn:'DATEVALUE()', insert:'DATEVALUE(field)', hint:'To date'},
    {cat:'Date/Time', fn:'DATETIMEVALUE()', insert:'DATETIMEVALUE(field)', hint:'To datetime'},
    {cat:'Date/Time', fn:'YEAR()', insert:'YEAR(field)', hint:'Get year'},
    {cat:'Date/Time', fn:'MONTH()', insert:'MONTH(field)', hint:'Get month'},
    {cat:'Date/Time', fn:'DAY()', insert:'DAY(field)', hint:'Get day'},
    {cat:'Date/Time', fn:'HOUR()', insert:'HOUR(field)', hint:'Get hour'},
    {cat:'Date/Time', fn:'MINUTE()', insert:'MINUTE(field)', hint:'Get minute'},
    {cat:'Date/Time', fn:'SECOND()', insert:'SECOND(field)', hint:'Get second'},
    {cat:'Date/Time', fn:'WEEKDAY()', insert:'WEEKDAY(field)', hint:'Weekday number'},
    {cat:'Date/Time', fn:'ADDMONTHS()', insert:'ADDMONTHS(field, num)', hint:'Add months'},

    // Math
    {cat:'Math', fn:'ABS()', insert:'ABS(field)', hint:'Absolute value'},
    {cat:'Math', fn:'CEILING()', insert:'CEILING(field)', hint:'Round up'},
    {cat:'Math', fn:'FLOOR()', insert:'FLOOR(field)', hint:'Round down'},
    {cat:'Math', fn:'ROUND()', insert:'ROUND(field, decimals)', hint:'Round number'},
    {cat:'Math', fn:'SQRT()', insert:'SQRT(field)', hint:'Square root'},
    {cat:'Math', fn:'MOD()', insert:'MOD(field, divisor)', hint:'Remainder'},
    {cat:'Math', fn:'MIN()', insert:'MIN(a, b)', hint:'Minimum'},
    {cat:'Math', fn:'MAX()', insert:'MAX(a, b)', hint:'Maximum'},
    {cat:'Math', fn:'EXP()', insert:'EXP(field)', hint:'Exponential'},
    {cat:'Math', fn:'LOG()', insert:'LOG(field)', hint:'Logarithm'},
    {cat:'Math', fn:'VALUE()', insert:'VALUE(field)', hint:'Text to number'},

    // Picklist
    {cat:'Picklist', fn:'ISPICKVAL()', insert:'ISPICKVAL(field, "value")', hint:'Check picklist'},
    {cat:'Picklist', fn:'TEXT(picklist)', insert:'TEXT(picklist_field)', hint:'Picklist to text'},

    // Validation
    {cat:'Validation', fn:'ISBLANK()', insert:'ISBLANK(field)', hint:'Check empty'},
    {cat:'Validation', fn:'ISNULL()', insert:'ISNULL(field)', hint:'Check null'},
    {cat:'Validation', fn:'ISNUMBER()', insert:'ISNUMBER(field)', hint:'Check numeric'},
    {cat:'Validation', fn:'ISCHANGED()', insert:'ISCHANGED(field)', hint:'Field changed'},
    {cat:'Validation', fn:'PRIORVALUE()', insert:'PRIORVALUE(field)', hint:'Previous value'},
    {cat:'Validation', fn:'REGEX()', insert:'REGEX(field, "pattern")', hint:'Pattern match'},
    {cat:'Validation', fn:'VLOOKUP()', insert:'VLOOKUP($ObjectType.Obj.Fields.Field, $ObjectType.Obj.Fields.Key, key_value)', hint:'Lookup validation'},

    // User & Profile
    {cat:'User/Profile', fn:'$User.Id', insert:'$User.Id', hint:'Current user ID'},
    {cat:'User/Profile', fn:'$User.Username', insert:'$User.Username', hint:'Current username'},
    {cat:'User/Profile', fn:'$Profile.Name', insert:'$Profile.Name', hint:'Profile name'},
    {cat:'User/Profile', fn:'$UserRole.Name', insert:'$UserRole.Name', hint:'Role name'},
    {cat:'User/Profile', fn:'$Permission', insert:'$Permission.Custom_Permission', hint:'Custom permission'},
    {cat:'User/Profile', fn:'$Organization.Id', insert:'$Organization.Id', hint:'Org ID'},

    // Advanced
    {cat:'Advanced', fn:'CASESAFEID()', insert:'CASESAFEID(field)', hint:'18-digit ID'},
    {cat:'Advanced', fn:'HTMLENCODE()', insert:'HTMLENCODE(field)', hint:'Encode HTML'},
    {cat:'Advanced', fn:'URLENCODE()', insert:'URLENCODE(field)', hint:'URL encode'},
    {cat:'Advanced', fn:'JSENCODE()', insert:'JSENCODE(field)', hint:'JS encode'},
    {cat:'Advanced', fn:'HYPERLINK()', insert:'HYPERLINK(url, label)', hint:'Create link'},
    {cat:'Advanced', fn:'IMAGE()', insert:'IMAGE(url, alt)', hint:'Display image'},
    {cat:'Advanced', fn:'DISTANCE()', insert:'DISTANCE(loc1, loc2, "mi")', hint:'Geo distance'},
    {cat:'Advanced', fn:'GEOLOCATION()', insert:'GEOLOCATION(lat, lon)', hint:'Create coords'},
  ];

  let _fxActiveCat = 'All';

  function buildFxPanel() {
    const cats = ['All', ...new Set(FX_DATA.map(f => f.cat))];
    const catsEl = document.getElementById('fxCats');
    catsEl.innerHTML = '';
    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fx-cat-btn' + (cat === 'All' ? ' active' : '');
      btn.textContent = cat;
      btn.addEventListener('click', () => {
        _fxActiveCat = cat;
        catsEl.querySelectorAll('.fx-cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('fxSearch').value = '';
        renderFxGrid(FX_DATA.filter(f => cat === 'All' || f.cat === cat));
      });
      catsEl.appendChild(btn);
    });
    renderFxGrid(FX_DATA);
  }

  function renderFxGrid(data) {
    const grid = document.getElementById('fxGrid');
    grid.innerHTML = '';
    if (data.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--muted);padding:1rem;font-size:0.8rem;">No matching functions</div>';
      return;
    }
    data.forEach(f => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fx-fn';
      btn.innerHTML = `${f.fn}<span class="fx-hint">${f.hint}</span>`;
      btn.title = `Insert: ${f.insert}`;
      btn.addEventListener('click', () => insertFxFunction(f.insert));
      grid.appendChild(btn);
    });
  }

  function filterFxFunctions() {
    const q = document.getElementById('fxSearch').value.toLowerCase();
    let filtered = FX_DATA;
    if (_fxActiveCat !== 'All') filtered = filtered.filter(f => f.cat === _fxActiveCat);
    if (q) filtered = filtered.filter(f => f.fn.toLowerCase().includes(q) || f.hint.toLowerCase().includes(q) || f.cat.toLowerCase().includes(q));
    renderFxGrid(filtered);
  }

  function insertFxFunction(text) {
    const textarea = document.getElementById('valFormula');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);
    textarea.value = before + text + after;
    textarea.focus();
    // Place cursor inside the parentheses
    const parenPos = text.indexOf('(');
    if (parenPos > -1 && text.indexOf(')') > parenPos) {
      textarea.selectionStart = textarea.selectionEnd = start + parenPos + 1;
    } else {
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    buildFxPanel();

    const valErrorMsg = document.getElementById('valErrorMsg');
    const valErrorMsgCounter = document.getElementById('valErrorMsgCounter');
    if (valErrorMsg && valErrorMsgCounter) {
      const updateCounter = () => {
        valErrorMsgCounter.textContent = `${valErrorMsg.value.length} / 255`;
      };
      valErrorMsg.addEventListener('input', updateCounter);
      updateCounter();
    }

    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      input.addEventListener('blur', () => {
        input.classList.add('touched');
      });
      input.addEventListener('input', () => {
        if (input.checkValidity()) {
          input.classList.remove('touched');
        }
      });
    });

    switchTab('single', null);

    // ── MOM Pre-fill: load action item from sessionStorage ───
    loadMOMPrefill();
  });

  // Stored prefill payload from MOM Action Tracker
  let _momPrefillPayload = null;

  function loadMOMPrefill() {
    try {
      const raw = sessionStorage.getItem('sf_prefill_action');
      if (!raw) return;
      const payload = JSON.parse(raw);
      if (!payload || !payload.description) return;
      _momPrefillPayload = payload;
      // Show banner
      const banner = document.getElementById('prefillBanner');
      const desc   = document.getElementById('prefillDesc');
      if (banner && desc) {
        desc.textContent = `"${payload.description}" — Project: ${payload.projectName || '—'} | MOM: ${payload.meetingTitle || '—'}`;
        banner.style.display = 'block';
      }
    } catch(e) {
      console.warn('MOM prefill load failed:', e);
    }
  }

  function clearPrefill() {
    sessionStorage.removeItem('sf_prefill_action');
    _momPrefillPayload = null;
    const banner = document.getElementById('prefillBanner');
    if (banner) banner.style.display = 'none';
  }

  function triggerAIAssist() {
    if (!_momPrefillPayload) { showToast('No prefill data available.'); return; }
    const desc = _momPrefillPayload.description || '';
    const descLower = desc.toLowerCase();

    // ── Heuristic field auto-fill from description ────────────────
    // 1. Detect Salesforce Object
    const objectPatterns = [
      { re: /\bcontact\b/i, obj: 'Contact' },
      { re: /\bopportunity\b/i, obj: 'Opportunity' },
      { re: /\blead\b/i, obj: 'Lead' },
      { re: /\bcase\b/i, obj: 'Case' },
      { re: /\bproject\b/i, obj: 'Account' },
      { re: /\baccount\b/i, obj: 'Account' },
    ];
    let detectedObject = 'Account';
    for (const p of objectPatterns) {
      if (p.re.test(desc)) { detectedObject = p.obj; break; }
    }

    // 2. Detect Data Type from description
    let detectedType = 'Text';
    if (/\bpicklist\b|\bstatus\b|\bstage\b|\bpickval\b/i.test(desc)) detectedType = 'Picklist';
    else if (/\bdate\b|\bdue\b|\bdeadline\b|\bstart\b|\bend\b/i.test(desc)) detectedType = 'Date';
    else if (/\bnumber\b|\bcount\b|\bquantity\b|\bdays?\b|\beff?ort\b/i.test(desc)) detectedType = 'Number';
    else if (/\bcurren?cy\b|\bamount\b|\bprice\b|\bcost\b|\bpayment\b/i.test(desc)) detectedType = 'Currency';
    else if (/\bphone\b|\bmobile\b/i.test(desc)) detectedType = 'Phone';

    // 3. Extract a clean field label from the description
    const fieldLabel = desc.replace(/^(add|update|create|include|configure|set|implement|fix|modify|remove|enable)\s+/i, '')
                           .replace(/\s+fields?\s+(in|on|to|for)\s+.*/i, '')
                           .replace(/\s+module.*/i, '')
                           .trim()
                           .substring(0, 60)
                           || 'Action Item Field';

    // 4. Derive API name
    const fieldApiName = fieldLabel.replace(/[^a-zA-Z0-9\s]/g, '')
                                    .trim()
                                    .replace(/\s+/g, '_')
                                    .replace(/^_+|_+$/g, '')
                                    .substring(0, 40) + '__c';

    // 5. Fill form fields
    switchSidebarTab('single', null);
    setTimeout(() => {
      const objEl   = document.getElementById('objectName');
      const dtHid   = document.getElementById('dataType');
      const dtSearch = document.getElementById('dataTypeSearch');

      if (objEl) objEl.value = detectedObject;

      if (dtHid && dtSearch) {
        dtHid.value    = detectedType;
        dtSearch.value = detectedType;
        dtHid.dispatchEvent(new Event('change'));
      }

      // Fill dynamic fields for detected type
      const fieldLabelEl = document.querySelector(`#fields-${detectedType} input[name="${detectedType}-FieldLabel"]`);
      if (fieldLabelEl) fieldLabelEl.value = fieldLabel;

      const fieldNameEl = document.querySelector(`#fields-${detectedType} input[name="${detectedType}-FieldName"]`);
      if (fieldNameEl) fieldNameEl.value = fieldApiName;

      // For picklist: try to extract values from description
      if (detectedType === 'Picklist') {
        const valuesPat = /(?:values?|options?|stages?|statuses?)[\s:]+([^.]+)/i;
        const match = desc.match(valuesPat);
        const pickEl = document.querySelector(`#fields-Picklist textarea[name="Picklist-Values"]`);
        if (pickEl) {
          if (match && match[1]) {
            // Split by commas, slashes, or "and"
            pickEl.value = match[1].split(/,|\/|\s+and\s+/i)
                                    .map(v => v.trim())
                                    .filter(v => v.length > 0)
                                    .join('\n');
          } else {
            pickEl.value = 'Active\nInactive\nPending';
          }
        }
      }

      showToast(`✨ AI Assist filled fields: Object=${detectedObject}, Type=${detectedType}`, 'success');
    }, 150);
  }

  // ── DYNAMIC FIELDS & SEARCHABLE SELECT ─────────
  const dataTypeSearch = document.getElementById('dataTypeSearch');
  const selectOptions = document.getElementById('selectOptions');
  const dataTypeHidden = document.getElementById('dataType');

  if (dataTypeSearch) {
    dataTypeSearch.addEventListener('focus', () => {
      selectOptions.classList.add('open');
    });

    dataTypeSearch.addEventListener('input', (e) => {
      selectOptions.classList.add('open');
      const filter = e.target.value.toLowerCase();
      document.querySelectorAll('#selectOptions .option').forEach(opt => {
        const text = opt.textContent.toLowerCase();
        if (text.includes(filter)) {
          opt.classList.remove('hidden');
        } else {
          opt.classList.add('hidden');
        }
      });
    });

    document.querySelectorAll('#selectOptions .option').forEach(opt => {
      opt.addEventListener('click', () => {
        const val = opt.getAttribute('data-value');
        dataTypeSearch.value = val;
        dataTypeHidden.value = val;
        selectOptions.classList.remove('open');
        dataTypeHidden.dispatchEvent(new Event('change'));
      });
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#customSelect')) {
        selectOptions.classList.remove('open');
        if (dataTypeSearch.value !== dataTypeHidden.value) {
          dataTypeSearch.value = dataTypeHidden.value;
        }
      }
    });
  }

  dataTypeHidden.addEventListener('change', (e) => {
    document.querySelectorAll('.dynamic-fields').forEach(f => {
      f.classList.remove('active');
      f.querySelectorAll('input,textarea').forEach(i => i.removeAttribute('required'));
    });
    const target = document.getElementById(`fields-${e.target.value}`);
    if (target) {
      target.classList.add('active');
      target.querySelectorAll('input,textarea').forEach(i => i.setAttribute('required','true'));
    }
  });

  // ── CHANGE FIELD TYPE DYNAMIC FIELDS & SELECT ───
  const changeDataTypeSearch = document.getElementById('changeDataTypeSearch');
  const changeSelectOptions = document.getElementById('changeSelectOptions');
  const changeDataTypeHidden = document.getElementById('changeDataType');

  if (changeDataTypeSearch) {
    changeDataTypeSearch.addEventListener('focus', () => {
      changeSelectOptions.classList.add('open');
    });

    changeDataTypeSearch.addEventListener('input', (e) => {
      changeSelectOptions.classList.add('open');
      const filter = e.target.value.toLowerCase();
      document.querySelectorAll('#changeSelectOptions .option').forEach(opt => {
        const text = opt.textContent.toLowerCase();
        if (text.includes(filter)) {
          opt.classList.remove('hidden');
        } else {
          opt.classList.add('hidden');
        }
      });
    });

    document.querySelectorAll('#changeSelectOptions .option').forEach(opt => {
      opt.addEventListener('click', () => {
        const val = opt.getAttribute('data-value');
        changeDataTypeSearch.value = val;
        changeDataTypeHidden.value = val;
        changeSelectOptions.classList.remove('open');
        changeDataTypeHidden.dispatchEvent(new Event('change'));
      });
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#changeCustomSelect')) {
        changeSelectOptions.classList.remove('open');
        if (changeDataTypeSearch.value !== changeDataTypeHidden.value) {
          changeDataTypeSearch.value = changeDataTypeHidden.value;
        }
      }
    });
  }

  if (changeDataTypeHidden) {
    changeDataTypeHidden.addEventListener('change', (e) => {
      document.querySelectorAll('#section-change .dynamic-fields').forEach(f => {
        f.classList.remove('active');
        f.querySelectorAll('input,textarea').forEach(i => i.removeAttribute('required'));
      });
      const target = document.getElementById(`changeFields-${e.target.value}`);
      if (target) {
        target.classList.add('active');
        target.querySelectorAll('input,textarea').forEach(i => i.setAttribute('required','true'));
      }
    });
  }

  // Auto API Name
  document.querySelectorAll('input[name$="-FieldLabel"]').forEach(input => {
    input.addEventListener('input', (e) => {
      const prefix = e.target.name.split('-')[0];
      const apiInput = document.querySelector(`input[name="${prefix}-FieldName"]`);
      if (apiInput) apiInput.value = e.target.value.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
    });
  });

  // ── LOAD SAVED CREDS ─────────────────────────────
  // (Credentials are now loaded securely via checkSession)

  // ── CSV PARSER ───────────────────────────────────
  async function parseCSV(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rows = e.target.result.split('\n').filter(r => r.trim());
        if (!rows.length) return resolve([]);
        const headers = rows[0].split(',').map(h => h.trim());
        const data = [];
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i].split(',');
          const row = {};
          headers.forEach((h, idx) => row[h] = cols[idx] ? cols[idx].trim() : '');
          data.push(row);
        }
        resolve(data);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  function downloadTemplate(type) {
    let csvRows;
    if (type === 'field') {
      csvRows = [
        'ObjectName,DataType,FieldLabel,FieldName,Length,DecimalPlaces,PicklistValues',
        'Account,Text,External ID,External_ID__c,255,,',
        'Contact,Number,Age,Age__c,3,0,',
        'Opportunity,Picklist,Stage,Stage__c,,,Active;Inactive;Pending'
      ];
    } else if (type === 'validation') {
      csvRows = [
        'ObjectName,RuleName,Formula,ErrorMessage,ErrorField',
        'Account,Prevent_Invalid_Age,Age__c < 18,Age must be 18 or older.,Age__c',
        'Opportunity,Prevent_Stage_Change,ISPICKVAL(StageName, "Closed Won") && Amount < 100,Closed Won opportunities must have an amount >= 100.,'
      ];
    } else if (type === 'user') {
      csvRows = [
        'FirstName,LastName,Email,Username,GeneratePassword,Role,License,Profile',
        'John,Doe,john@example.com,john@example.com,true,CEO,Salesforce,System Administrator',
        'Jane,Smith,jane@example.com,jane@example.com.uat,false,,,Standard User'
      ];
    } else if (type === 'user_update') {
      csvRows = [
        'Username,IsActive',
        'john@example.com,true',
        'jane@example.com.uat,false'
      ];
    }
    const csv = csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = type === 'field' ? 'field_import_template.csv' : (type === 'validation' ? 'validation_import_template.csv' : (type === 'user_update' ? 'user_status_update_template.csv' : 'user_import_template.csv'));
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  // ── FORM SUBMIT ──────────────────────────────────
  document.getElementById('salesforceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const form = document.getElementById('salesforceForm');
    if (!form.checkValidity()) {
      form.querySelectorAll('input, textarea, select').forEach(i => i.classList.add('touched'));
      document.getElementById('statusText').textContent = 'please correct errors before running automation';
      return;
    }

    // We no longer save to localStorage, settings are saved via API in saveSettings()

    const submitBtn = document.querySelector('.submit-btn');
    const origBtnHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner" style="margin-right: 8px;"></span> Running Automation...`;

    let selectedProj = document.getElementById('projectSelector') ? document.getElementById('projectSelector').value : 'Default';
    if (selectedProj === '_new_') {
      selectedProj = (document.getElementById('projectName').value || '').trim() || 'Default';
    }

    const payload = {
      taskType: currentMode === 'single' ? 'field' : (currentMode === 'validation' ? 'validation_rule' : (currentMode === 'user' ? (document.getElementById('userActionSelect').value === 'update' ? 'update_user_status' : 'user') : (currentMode === 'flow' ? 'flow' : (currentMode === 'object' ? 'custom_object' : (currentMode === 'permissionset' ? 'permission_set' : (currentMode === 'change' ? 'change_field_type' : 'field')))))),
      mode: currentMode,
      envMode: currentEnvMode,
      project_name: selectedProj,
      credentials: {
        url:      document.getElementById('url').value,
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
      },
      data: null
    };

    if (currentMode === 'single') {
      const dt = document.getElementById('dataType').value;
      const singleData = { objectName: document.getElementById('objectName').value, dataType: dt, fieldDetails: {} };
      const activeSection = document.getElementById(`fields-${dt}`);
      if (activeSection) {
        activeSection.querySelectorAll('input,textarea').forEach(i => {
          singleData.fieldDetails[i.name.split('-')[1]] = i.value;
        });
      }
      payload.data = [singleData];
    } else if (currentMode === 'change') {
      const dt = document.getElementById('changeDataType').value;
      const changeData = {
        objectName: document.getElementById('changeObjectName').value,
        fieldName: document.getElementById('changeFieldName').value,
        dataType: dt,
        fieldDetails: {}
      };
      const activeSection = document.getElementById(`changeFields-${dt}`);
      if (activeSection) {
        activeSection.querySelectorAll('input,textarea').forEach(i => {
          changeData.fieldDetails[i.name.split('-')[1]] = i.value;
        });
      }
      payload.data = [changeData];
    } else if (currentMode === 'validation') {
      const singleData = {
        objectName: document.getElementById('valObjectName').value,
        ruleName: document.getElementById('valRuleName').value,
        formula: document.getElementById('valFormula').value,
        errorMessage: document.getElementById('valErrorMsg').value,
        errorField: document.getElementById('valErrorField').value
      };
      payload.data = [singleData];
    } else if (currentMode === 'user') {
      const userAction = document.getElementById('userActionSelect').value;
      if (userAction === 'create') {
          payload.taskType = 'user';
          payload.data = [{
            FirstName: document.getElementById('userFirstName').value,
            LastName: document.getElementById('userLastName').value,
            Email: document.getElementById('userEmail').value,
            Username: document.getElementById('userUsername').value,
            GeneratePassword: document.getElementById('userGenPassword').checked,
            Role: document.getElementById('userRole').value,
            License: document.getElementById('userLicense').value,
            Profile: document.getElementById('userProfile').value
          }];
      } else {
          payload.taskType = 'update_user_status';
          payload.data = [{
            Username: document.getElementById('updateUserUsername').value,
            IsActive: document.getElementById('updateUserActive').checked
          }];
      }
    } else if (currentMode === 'flow') {
      payload.taskType = 'flow';
      const flowPayload = buildFlowPayload();
      if (!flowPayload.label || !flowPayload.apiName) {
        document.getElementById('statusText').textContent = 'please enter a flow label and api name';
        submitBtn.disabled = false;
        submitBtn.innerHTML = origBtnHtml;
        return;
      }
      payload.data = [flowPayload];
    } else if (currentMode === 'object') {
      payload.taskType = 'custom_object';
      payload.data = [{
        Label: document.getElementById('newObjectLabel').value,
        PluralLabel: document.getElementById('newObjectPlural').value,
        ObjectName: document.getElementById('newObjectName').value,
        RecordName: document.getElementById('newObjectRecordName').value,
        DataType: document.getElementById('newObjectDataType').value
      }];
    } else if (currentMode === 'permissionset') {
      payload.taskType = 'permission_set';
      payload.data = [{
        PermissionSetName: document.getElementById('permSetName').value,
        Users: document.getElementById('permSetUsers').value
      }];
    } else {
      const fileInput = document.getElementById('csvFile');
      if (!fileInput.files.length) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origBtnHtml;
        return;
      }
      try {
        const parsedData = await parseCSV(fileInput.files[0]);
        payload.data = parsedData;
        if (parsedData.length > 0) {
          const firstRow = parsedData[0];
          if ('RuleName' in firstRow || 'ruleName' in firstRow || 'Formula' in firstRow || 'formula' in firstRow) {
            payload.taskType = 'validation_rule';
          } else if ('LastName' in firstRow || 'lastName' in firstRow || 'Email' in firstRow || 'email' in firstRow || 'Username' in firstRow) {
            if ('IsActive' in firstRow || 'isActive' in firstRow) {
                payload.taskType = 'update_user_status';
            } else {
                payload.taskType = 'user';
            }
          } else {
            payload.taskType = 'field';
          }
        }
      } catch(err) {
        document.getElementById('statusText').textContent = 'csv parse error';
        submitBtn.disabled = false;
        submitBtn.innerHTML = origBtnHtml;
        return;
      }
    }

    // Validation
    if (payload.data && payload.data.length > 0 && payload.taskType === 'field') {
      const seenFields = new Set();
      const validTypes = ['Text', 'Number', 'Currency', 'Date', 'Date/Time', 'Phone', 'Picklist', 'Lookup'];

      for (let i = 0; i < payload.data.length; i++) {
        const item = payload.data[i];
        const objectName = item.objectName || item.ObjectName;
        const dataType = item.dataType || item.DataType;
        const details = item.fieldDetails || item;
        
        if (!objectName) { showToast(`Validation Error (Row ${i+1}): Object Name is required.`); submitBtn.disabled = false; submitBtn.innerHTML = origBtnHtml; return; }
        if (!dataType) { showToast(`Validation Error (Row ${i+1}): Data Type is required.`); submitBtn.disabled = false; submitBtn.innerHTML = origBtnHtml; return; }
        if (!validTypes.includes(dataType)) { showToast(`Validation Error (Row ${i+1}): Invalid Data Type '${dataType}'. Allowed values: ${validTypes.join(', ')}.`); submitBtn.disabled = false; submitBtn.innerHTML = origBtnHtml; return; }
        if (!details.FieldLabel) { showToast(`Validation Error (Row ${i+1}): Field Label is required.`); submitBtn.disabled = false; submitBtn.innerHTML = origBtnHtml; return; }
        
        // Check API Name format if provided
        const fieldName = details.FieldName;
        if (fieldName) {
          if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(fieldName)) {
            showToast(`Validation Error (Row ${i+1}): API Name '${fieldName}' is invalid. Must start with a letter and contain only alphanumeric characters and underscores.`);
            submitBtn.disabled = false;
            submitBtn.innerHTML = origBtnHtml;
            return;
          }
        }
        
        // Prevent duplicates in the same run
        const uniqueKey = `${objectName.toLowerCase()}.${details.FieldLabel.toLowerCase()}`;
        if (seenFields.has(uniqueKey)) {
          showToast(`Validation Error (Row ${i+1}): Duplicate field label '${details.FieldLabel}' on object '${objectName}' detected in your payload.`);
          submitBtn.disabled = false;
          submitBtn.innerHTML = origBtnHtml;
          return;
        }
        seenFields.add(uniqueKey);
        
        if (dataType === 'Number' || dataType === 'Currency') {
          const len = parseInt(details.Length) || 18;
          const dec = parseInt(details.DecimalPlaces) || 0;
          if (len + dec > 18) {
            showToast(`Validation Error (Row ${i+1}): Length + Decimal Places cannot exceed 18 for Number/Currency fields. (Currently ${len} + ${dec} = ${len + dec})`);
            submitBtn.disabled = false;
            submitBtn.innerHTML = origBtnHtml;
            return;
          }
        }
        
        if (dataType === 'Text') {
          const len = parseInt(details.Length) || 255;
          if (len > 255) {
            showToast(`Validation Error (Row ${i+1}): Length cannot exceed 255 for Text fields.`);
            submitBtn.disabled = false;
            submitBtn.innerHTML = origBtnHtml;
            return;
          }
        }
        
        if (dataType === 'Picklist') {
          const values = details.PicklistValues || details.Values;
          if (!values || !values.trim()) {
            showToast(`Validation Error (Row ${i+1}): Picklist fields must have Picklist Values specified.`);
            submitBtn.disabled = false;
            submitBtn.innerHTML = origBtnHtml;
            return;
          }
        }
      }
    }

    // Start client-side queue-based run console
    consoleQueue = payload.data.map(item => {
      let itemPayloadData = item;
      
      if (payload.taskType === 'field' && currentMode === 'bulk') {
        itemPayloadData = {
          objectName: item.ObjectName || item.objectName,
          dataType: item.DataType || item.dataType,
          fieldDetails: {
            FieldLabel: item.FieldLabel || item.fieldLabel,
            FieldName: item.FieldName || item.fieldName || (item.FieldLabel || item.fieldLabel).replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_]/g,''),
            Length: item.Length || item.length,
            DecimalPlaces: item.DecimalPlaces || item.decimalPlaces,
            Values: item.PicklistValues || item.picklistValues || item.Values || item.values
          }
        };
      } else if (payload.taskType === 'validation_rule' && currentMode === 'bulk') {
        itemPayloadData = {
          objectName: item.ObjectName || item.objectName,
          ruleName: item.RuleName || item.ruleName,
          formula: item.Formula || item.formula,
          errorMessage: item.ErrorMessage || item.errorMessage,
          errorField: item.ErrorField || item.errorField
        };
      } else if (payload.taskType === 'update_user_status' && currentMode === 'bulk') {
        itemPayloadData = {
          Username: item.Username || item.username,
          IsActive: String(item.IsActive || item.isActive).toLowerCase() === 'true'
        };
      } else if (payload.taskType === 'user' && currentMode === 'bulk') {
        itemPayloadData = {
          FirstName: item.FirstName || item.firstName,
          LastName: item.LastName || item.lastName,
          Email: item.Email || item.email,
          Username: item.Username || item.username,
          GeneratePassword: String(item.GeneratePassword || item.generatePassword).toLowerCase() === 'true',
          Role: item.Role || item.role,
          License: item.License || item.license,
          Profile: item.Profile || item.profile
        };
      }
      
      return {
        name: getQueueItemName(itemPayloadData, payload.taskType),
        payload: {
          taskType: payload.taskType,
          project_name: payload.project_name,
          credentials: payload.credentials,
          data: [itemPayloadData]
        },
        status: 'pending',
        error: null
      };
    });

    consoleQueueIndex = 0;
    consoleQueuePaused = false;
    consoleQueueCancelled = false;
    consoleLogs = [];
    consoleStartTime = new Date();
    _sessionTokenSuffix = null; // Reset token cache for each new run
    window.__localAuthAttempted = false; // Reset so credentials are pushed fresh each run
    
    // Reveal right sidebar panel to show execution logs
    const rightSidebar = document.getElementById('rightSidebar');
    if (rightSidebar) {
      rightSidebar.classList.remove('collapsed');
      if (window.innerWidth <= 1024) {
        rightSidebar.classList.add('active-mobile');
      }
    }
    
    document.getElementById('consoleSpinner').style.display = 'inline-block';
    document.getElementById('consoleTitle').textContent = 'Automation Running...';
    document.getElementById('consolePauseBtn').style.display = 'inline-block';
    document.getElementById('consolePauseBtn').textContent = 'Pause';
    document.getElementById('consoleCancelBtn').style.display = 'inline-block';
    document.getElementById('consoleCloseBtn').style.display = 'none';
    document.getElementById('consoleDownloadLogBtn').style.display = 'none';
    
    const terminal = document.getElementById('consoleTerminal');
    terminal.innerHTML = `<div class="terminal-line system">[System] Starting queue with ${consoleQueue.length} items...</div>`;
    
    updateConsoleProgressBar();
    processNextConsoleQueueItem();

    // Reset button states
    submitBtn.disabled = false;
    submitBtn.innerHTML = origBtnHtml;
  });

  // ── CLIENT-SIDE QUEUE AUTOMATION RUNNER ───────────
  let consoleQueue = [];
  let consoleQueueIndex = 0;
  let consoleQueuePaused = false;
  let consoleQueueCancelled = false;
  let consoleLogs = [];
  let consoleStartTime = null;

  function getQueueItemName(item, taskType) {
    if (taskType === 'field') {
      const obj = item.objectName || (item.fieldDetails && item.objectName) || 'Unknown';
      const name = item.FieldName || (item.fieldDetails && (item.fieldDetails.FieldName || item.fieldDetails.Name)) || 'Field';
      return `Create Field ${obj}.${name}`;
    } else if (taskType === 'validation_rule') {
      const obj = item.objectName || 'Unknown';
      const name = item.ruleName || 'Rule';
      return `Create Val Rule ${obj}.${name}`;
    } else if (taskType === 'user') {
      const user = item.Username || 'User';
      return `Create User ${user}`;
    } else if (taskType === 'update_user_status') {
      const user = item.Username || 'User';
      const status = item.IsActive ? 'Activate' : 'Deactivate';
      return `${status} User ${user}`;
    } else if (taskType === 'custom_object') {
      const obj = item.ObjectName || 'Unknown';
      return `Create Object ${obj}`;
    } else if (taskType === 'permission_set') {
      const ps = item.PermissionSetName || 'Unknown';
      return `Assign Perm Set ${ps}`;
    } else if (taskType === 'change_field_type') {
      const obj = item.objectName || 'Unknown';
      const name = item.fieldName || 'Field';
      return `Change Field Type ${obj}.${name}`;
    }
    return 'Automation Item';
  }

  // Session-level token cache so we only prompt once per run session
  let _sessionTokenSuffix = null;

  // Returns a promise that resolves with the entered token string, or null if cancelled
  function showTokenModal() {
    return new Promise((resolve) => {
      const overlay = document.getElementById('tokenModalOverlay');
      const input   = document.getElementById('tokenModalInput');
      const submitBtn = document.getElementById('tokenModalSubmit');
      const cancelBtn = document.getElementById('tokenModalCancel');

      input.value = '';
      overlay.classList.add('open');
      setTimeout(() => input.focus(), 150);

      function cleanup() {
        overlay.classList.remove('open');
        submitBtn.removeEventListener('click', onSubmit);
        cancelBtn.removeEventListener('click', onCancel);
        input.removeEventListener('keydown', onKey);
      }
      function onSubmit() {
        const t = input.value.trim();
        cleanup();
        resolve(t || null);
      }
      function onCancel() {
        cleanup();
        resolve(null);
      }
      function onKey(e) {
        if (e.key === 'Enter') onSubmit();
        if (e.key === 'Escape') onCancel();
      }
      submitBtn.addEventListener('click', onSubmit);
      cancelBtn.addEventListener('click', onCancel);
      input.addEventListener('keydown', onKey);
    });
  }

  function isTokenError(msg) {
    return msg && (msg.includes('LOGIN_MUST_USE_SECURITY_TOKEN') ||
                   msg.includes('security token') ||
                   msg.includes('Security Token') ||
                   msg.includes('SECURITY_TOKEN'));
  }

  // Patch a security token into all pending queue payloads' credentials
  function applyTokenToQueueCredentials(token) {
    for (let i = consoleQueueIndex - 1; i < consoleQueue.length; i++) {
      const p = consoleQueue[i].payload;
      if (p && p.credentials && p.credentials.password) {
        // Only append if not already appended
        if (!p.credentials.password.endsWith(token)) {
          p.credentials.password += token;
        }
      }
    }
  }

  async function startTaskPolling(item) {
    let polling = true;
    let lastMsg = '';
    while(polling) {
      try {
        await new Promise(r => setTimeout(r, 2000));
        const res = await customFetch('/api/task_status');
        if (res.ok) {
          const data = await res.json();
          if (data.message && data.message !== lastMsg) {
            lastMsg = data.message;
            appendTerminalLine(`[Agent] ${data.message}`, data.status === 'error' ? 'error' : 'system');
          }
          if (data.status === 'success' || data.status === 'error') {
            polling = false;
            if (data.status === 'error') showToast(data.message, 'error');
            else showToast(data.message, 'success');
          }
        }
      } catch(e) {
        polling = false;
        appendTerminalLine(`[System] Lost connection to local agent.`, 'error');
      }
    }
  }

  async function processNextConsoleQueueItem() {
    if (consoleQueueCancelled) {
      appendTerminalLine('[System] Queue was cancelled by the user.', 'error');
      finalizeConsoleQueue();
      return;
    }
    
    if (consoleQueuePaused) {
      appendTerminalLine('[System] Queue is paused. Waiting to resume...', 'system');
      return;
    }
    
    if (consoleQueueIndex >= consoleQueue.length) {
      const totalTime = ((new Date() - consoleStartTime) / 1000).toFixed(1);
      appendTerminalLine(`[System] Execution finished in ${totalTime}s. Queue completed successfully!`, 'success');
      finalizeConsoleQueue();
      return;
    }
    
    const item = consoleQueue[consoleQueueIndex];
    item.status = 'processing';
    appendTerminalLine(`[Processing] (${consoleQueueIndex + 1}/${consoleQueue.length}) ${item.name}...`, 'processing');
    
    const itemStartTime = new Date();
    
    try {
      const res = await customFetch('/api/sf-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload)
      });
      
      const resData = await res.json();
      const elapsed = ((new Date() - itemStartTime) / 1000).toFixed(1);
      
      if (res.ok) {
        item.status = 'success';
        if (currentRunMode === 'local') {
          appendTerminalLine(`[Queued] ${item.name} — Playwright browser is executing...`, 'success');
          appendTerminalLine('[System] Watch the Playwright browser window for progress.', 'system');
        } else {
          appendTerminalLine(`[Success] Completed ${item.name} in ${elapsed}s`, 'success');
        }
      } else {
        const errMsg = resData.message || resData.error || 'Server returned error';

        // ── Auto Security Token handling ──────────────────────────
        if (isTokenError(errMsg)) {
          appendTerminalLine('[System] 🔑 Security Token required. Pausing queue...', 'system');

          // If we already have a cached token from this session, retry immediately
          if (_sessionTokenSuffix) {
            appendTerminalLine('[System] Retrying with cached session token...', 'system');
            applyTokenToQueueCredentials(_sessionTokenSuffix);
            // Re-process the same item (don't increment index)
            setTimeout(processNextConsoleQueueItem, 400);
            return;
          }

          // Prompt the user for their security token
          const token = await showTokenModal();

          if (!token) {
            // User cancelled → mark failed and continue
            appendTerminalLine('[System] Token entry cancelled. Marking item as failed.', 'error');
            item.status = 'failed';
            item.error = 'Security Token required but not provided.';
            appendTerminalLine(`[Failed] ${item.name}: ${item.error}`, 'error');
          } else {
            _sessionTokenSuffix = token;
            applyTokenToQueueCredentials(token);
            appendTerminalLine('[System] ✅ Token accepted — retrying with appended token...', 'success');
            // Re-process the same item (don't increment index)
            setTimeout(processNextConsoleQueueItem, 400);
            return;
          }
        } else {
          item.status = 'failed';
          item.error = errMsg;
          appendTerminalLine(`[Failed] ${item.name}: ${item.error}`, 'error');
        }
      }
    } catch (err) {
      item.status = 'failed';
      item.error = err.message || 'Network unreachable';
      appendTerminalLine(`[Failed] ${item.name}: ${item.error}`, 'error');
    }
    
    consoleQueueIndex++;
    updateConsoleProgressBar();
    
    setTimeout(processNextConsoleQueueItem, 600);
  }

  function appendTerminalLine(text, type = '') {
    const terminal = document.getElementById('consoleTerminal');
    const div = document.createElement('div');
    div.className = `terminal-line ${type}`;
    div.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
    terminal.appendChild(div);
    terminal.scrollTop = terminal.scrollHeight;
    
    consoleLogs.push({ time: new Date().toISOString(), log: text, type });
  }

  function updateConsoleProgressBar() {
    const pct = consoleQueue.length > 0 ? (consoleQueueIndex / consoleQueue.length) * 100 : 0;
    document.getElementById('consoleProgressBar').style.width = `${pct}%`;
    document.getElementById('consoleProgressText').textContent = `${consoleQueueIndex} / ${consoleQueue.length} completed`;
  }

  function toggleConsolePause() {
    consoleQueuePaused = !consoleQueuePaused;
    const btn = document.getElementById('consolePauseBtn');
    if (consoleQueuePaused) {
      btn.textContent = 'Resume';
      appendTerminalLine('[System] Queue paused.', 'system');
    } else {
      btn.textContent = 'Pause';
      appendTerminalLine('[System] Queue resumed.', 'system');
      processNextConsoleQueueItem();
    }
  }

  function cancelConsoleQueue() {
    consoleQueueCancelled = true;
    appendTerminalLine('[System] Cancellation requested...', 'error');
    if (consoleQueuePaused) {
      finalizeConsoleQueue();
    }
  }

  function finalizeConsoleQueue() {
    const spinner = document.getElementById('consoleSpinner');
    if (spinner) spinner.style.display = 'none';
    const pauseBtn = document.getElementById('consolePauseBtn');
    if (pauseBtn) pauseBtn.style.display = 'none';
    const cancelBtn = document.getElementById('consoleCancelBtn');
    if (cancelBtn) cancelBtn.style.display = 'none';
    const closeBtn = document.getElementById('consoleCloseBtn');
    if (closeBtn) closeBtn.style.display = 'inline-block';
    const logBtn = document.getElementById('consoleDownloadLogBtn');
    if (logBtn) logBtn.style.display = 'inline-block';
    
    const failedCount = consoleQueue.filter(i => i.status === 'failed').length;
    document.getElementById('consoleTitle').textContent = failedCount > 0 ? 'Queue Finished (With Errors)' : 'Queue Completed!';
    
    if (failedCount > 0) {
      const hasTokenError = consoleQueue.some(i => i.error && (i.error.includes('SECURITY_TOKEN') || i.error.includes('security token') || i.error.includes('Security Token')));
      if (hasTokenError) {
        appendTerminalLine('\n', '');
        appendTerminalLine('[System] 🔑 Salesforce Login Failed due to Security Token restrictions.', 'system');
        appendTerminalLine('👉 Solution A: Append your Salesforce Security Token directly to the end of your password (e.g., MyPasswordXYZToken) in Settings.', 'system');
        appendTerminalLine('👉 Solution B: Switch "Execution Mode" to "Local Agent" in Settings. The Local Agent runs Playwright to log in via browser which does not require API security tokens.', 'system');
      }
    }
    
    // Save execution status to local storage for Stats summary cards
    const statusStr = failedCount > 0 ? 'Failed' : 'Success';
    localStorage.setItem('sf_last_run_status', statusStr);
    localStorage.setItem('sf_last_run_time', new Date().toLocaleTimeString());
    
    clearBulkLoadedCopilot();
    if (typeof loadHistory === 'function') loadHistory();
    if (typeof updateStatsUI === 'function') updateStatsUI();
  }

  function closeConsoleOverlay() {
    const overlay = document.getElementById('rightSidebar');
    if (overlay) {
      if (window.innerWidth <= 1024) {
        overlay.classList.remove('active-mobile');
      } else {
        overlay.classList.add('collapsed');
      }
    }
  }

  function exportConsoleQueueLog() {
    if (consoleLogs.length === 0) return;
    const rows = ['Timestamp,LogMessage,Type'];
    consoleLogs.forEach(l => {
      rows.push(`"${l.time}","${l.log.replace(/"/g, '""')}","${l.type}"`);
    });
    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `automation_run_log_${new Date().getTime()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  // ── AI COPILOT MODULE ──────────────────────────────
  let copilotOpen = false;
  let stagedCopilotItems = [];
  let bulkLoadedData = null;

  function clearBulkLoadedCopilot() {
    bulkLoadedData = null;
    document.getElementById('bulkLoadedAlert').style.display = 'none';
    const csvFileInput = document.getElementById('csvFile');
    if (csvFileInput) csvFileInput.value = '';
  }

  function toggleCopilot() {
    copilotOpen = !copilotOpen;
    const rightSidebar = document.getElementById('rightSidebar');
    if (rightSidebar) {
      if (window.innerWidth <= 1024) {
        rightSidebar.classList.toggle('active-mobile', copilotOpen);
      } else {
        rightSidebar.classList.toggle('collapsed', !copilotOpen);
      }
    }
  }

  async function runCopilotAI() {
    let apiKey = localStorage.getItem('GEMINI_API_KEY') || '';
    const prompt = document.getElementById('copilotPrompt').value.trim();
    const statusEl = document.getElementById('copilotStatus');
    const genBtn = document.getElementById('copilotGenBtn');
    
    if (!prompt) {
      showToast('Please enter a description for the metadata you want to create.');
      return;
    }
    
    if (!apiKey) {
      const userKey = prompt('Please enter your Google Gemini API Key to run the AI assistant (this is saved in your local browser storage):');
      if (userKey) {
        localStorage.setItem('GEMINI_API_KEY', userKey.trim());
        apiKey = userKey.trim();
      } else {
        return;
      }
    }
    
    genBtn.disabled = true;
    genBtn.textContent = 'Generating...';
    statusEl.style.color = 'var(--muted)';
    statusEl.textContent = 'Asking Gemini AI Copilot...';
    
    const systemPrompt = `You are a Salesforce metadata automated assistant.
Translate the user's plain-English description of Salesforce customization requests into a structured JSON array representing the fields, validation rules, or updates to perform.
Output ONLY a JSON array, with absolutely no markdown wrapping (do not use \`\`\`json) or extra text explanations. If you cannot parse or if no operations are requested, return an empty array [].

Supported schema formats:
1. Custom Field:
{
  "type": "field",
  "objectName": "Account" (or the appropriate standard/custom object name),
  "dataType": "Text" | "Number" | "Currency" | "Date" | "Date/Time" | "Phone" | "Picklist",
  "FieldLabel": "Friendly Name",
  "FieldName": "API_Name__c" (must start with letter, only alphanumeric and underscores, end in __c),
  "Length": 255 (for Text, length up to 18 for Number/Currency),
  "DecimalPlaces": 0 (for Number/Currency scales),
  "PicklistValues": "Comma,separated,values" (required for Picklist type)
}

2. Validation Rule:
{
  "type": "validation_rule",
  "objectName": "Opportunity",
  "ruleName": "Rule_API_Name_No_Spaces",
  "formula": "Salesforce Boolean error formula",
  "errorMessage": "User facing error message",
  "errorField": "API_Name__c of field to display error on (Optional)"
}

Example user request: "Create a text field called 'Member ID' with length 20 on Contact. And create validation rule on Case called 'Block_Low_Priority_Closes' where priority is Low and status is Closed."
Example JSON output:
[
  {
    "type": "field",
    "objectName": "Contact",
    "dataType": "Text",
    "FieldLabel": "Member ID",
    "FieldName": "Member_ID__c",
    "Length": 20
  },
  {
    "type": "validation_rule",
    "objectName": "Case",
    "ruleName": "Block_Low_Priority_Closes",
    "formula": "ISPICKVAL(Priority, 'Low') && ISPICKVAL(Status, 'Closed')",
    "errorMessage": "Low priority cases cannot be closed immediately."
  }
]`;

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: systemPrompt },
                { text: `User request: ${prompt}` }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });
      
      if (!res.ok) throw new Error(`API returned HTTP ${res.status}`);
      const resData = await res.json();
      
      const text = resData.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      stagedCopilotItems = JSON.parse(text.trim());
      
      if (!Array.isArray(stagedCopilotItems)) stagedCopilotItems = [];
      
      renderCopilotStaging();
      
      if (stagedCopilotItems.length > 0) {
        statusEl.style.color = '#10b981';
        statusEl.textContent = `Generated ${stagedCopilotItems.length} operations.`;
      } else {
        statusEl.style.color = 'var(--muted)';
        statusEl.textContent = 'No operations found in prompt.';
      }
    } catch(err) {
      statusEl.style.color = '#ef4444';
      statusEl.textContent = `AI Error: ${err.message}`;
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = 'Generate Operations';
    }
  }

  function renderCopilotStaging() {
    const stagingArea = document.getElementById('copilotStagingArea');
    const stagingItems = document.getElementById('copilotStagingItems');
    
    if (stagedCopilotItems.length === 0) {
      stagingArea.style.display = 'none';
      return;
    }
    
    stagingArea.style.display = 'flex';
    stagingItems.innerHTML = '';
    
    stagedCopilotItems.forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'copilot-stage-item';
      
      let title = '';
      let desc = '';
      if (item.type === 'field') {
        title = `${item.FieldLabel} (${item.FieldName})`;
        desc = `Create ${item.dataType} field on ${item.objectName}. Length: ${item.Length || 255}${item.PicklistValues ? ' · Values: ' + item.PicklistValues : ''}`;
      } else if (item.type === 'validation_rule') {
        title = `Validation: ${item.ruleName}`;
        desc = `Formula: "${item.formula}" on ${item.objectName}. Message: "${item.errorMessage}"`;
      }
      
      div.innerHTML = `
        <div class="item-type">${item.type}</div>
        <div class="item-title">${title}</div>
        <div class="item-desc">${desc}</div>
        <input type="checkbox" class="item-select-checkbox" checked data-index="${idx}">
      `;
      stagingItems.appendChild(div);
    });
  }

  function addStagedItemsToAutomator() {
    const checkedBoxes = document.querySelectorAll('#copilotStagingItems .item-select-checkbox:checked');
    if (checkedBoxes.length === 0) {
      showToast('Please check at least one item to load.');
      return;
    }
    
    const selectedItems = [];
    checkedBoxes.forEach(cb => {
      const idx = parseInt(cb.getAttribute('data-index'));
      selectedItems.push(stagedCopilotItems[idx]);
    });
    
    if (selectedItems.length === 0) return;
    
    if (selectedItems.length === 1) {
      const item = selectedItems[0];
      if (item.type === 'field') {
        switchTab('single', null);
        document.getElementById('objectName').value = item.objectName;
        
        const dataTypeSearch = document.getElementById('dataTypeSearch');
        const dataTypeHidden = document.getElementById('dataType');
        dataTypeSearch.value = item.dataType;
        dataTypeHidden.value = item.dataType;
        dataTypeHidden.dispatchEvent(new Event('change'));
        
        setTimeout(() => {
          const activeFields = document.getElementById(`fields-${item.dataType}`);
          if (activeFields) {
            const labelInput = activeFields.querySelector(`input[name="${item.dataType}-FieldLabel"]`);
            if (labelInput) labelInput.value = item.FieldLabel;
            
            const nameInput = activeFields.querySelector(`input[name="${item.dataType}-FieldName"]`);
            if (nameInput) nameInput.value = item.FieldName;
            
            const lengthInput = activeFields.querySelector(`input[name="${item.dataType}-Length"]`);
            if (lengthInput) lengthInput.value = item.Length || 255;
            
            const scaleInput = activeFields.querySelector(`input[name="${item.dataType}-DecimalPlaces"]`);
            if (scaleInput) scaleInput.value = item.DecimalPlaces || 0;
            
            const valuesTextarea = activeFields.querySelector(`textarea[name="${item.dataType}-Values"]`);
            if (valuesTextarea) valuesTextarea.value = (item.PicklistValues || '').split(',').join('\n');
          }
        }, 150);
        
      } else if (item.type === 'validation_rule') {
        switchTab('validation', null);
        document.getElementById('valObjectName').value = item.objectName;
        document.getElementById('valRuleName').value = item.ruleName;
        document.getElementById('valFormula').value = item.formula;
        document.getElementById('valErrorMsg').value = item.errorMessage;
        document.getElementById('valErrorField').value = item.errorField || '';
        
        const counter = document.getElementById('valErrorMsgCounter');
        if (counter) counter.textContent = `${item.errorMessage.length} / 255`;
      }
      
      toggleCopilot();
      document.getElementById('statusText').textContent = 'AI operation loaded into form.';
    } else {
      bulkLoadedData = selectedItems;
      document.getElementById('bulkLoadedAlertText').textContent = `${selectedItems.length} AI Copilot items loaded for execution.`;
      document.getElementById('bulkLoadedAlert').style.display = 'block';
      
      switchTab('bulk', null);
      toggleCopilot();
      document.getElementById('statusText').textContent = `Loaded ${selectedItems.length} operations into Bulk queue.`;
    }
  }

  // ── SCHEMA EXPLORER MODULE ──────────────────────────
  let _schemaObjectsData = [];
  let _schemaFieldsData = [];

  async function loadSchemaObjects() {
    const statusEl = document.getElementById('schemaFieldsStatus');
    if (_schemaObjectsData.length > 0) return;
    
    statusEl.textContent = 'loading objects from Salesforce...';
    try {
      const projName = document.getElementById('projectSelector') ? document.getElementById('projectSelector').value : 'Default';
      const res = await customFetch(`/api/sf-objects?project_name=${encodeURIComponent(projName)}&env_mode=${encodeURIComponent(currentEnvMode)}`);
      if (!res.ok) throw new Error('API error');
      _schemaObjectsData = await res.json();
      statusEl.textContent = `loaded ${_schemaObjectsData.length} objects. Type to search.`;
      renderSchemaObjectsOptions(_schemaObjectsData);
    } catch (e) {
      statusEl.textContent = 'could not load Salesforce objects. Check credentials in settings.';
    }
  }

  function renderSchemaObjectsOptions(objects) {
    const optionsEl = document.getElementById('schemaObjectOptions');
    if (!optionsEl) return;
    optionsEl.innerHTML = '';
    
    objects.slice(0, 100).forEach(o => {
      const div = document.createElement('div');
      div.className = 'option';
      div.innerHTML = `<span style="font-weight:600;color:var(--text);">${o.name}</span>
        <span style="font-size:0.72rem;color:var(--muted);margin-left:6px;">${o.label} ${o.custom ? '· Custom' : ''}</span>`;
      div.addEventListener('click', () => {
        document.getElementById('schemaObjectSearch').value = o.name;
        optionsEl.classList.remove('open');
      });
      optionsEl.appendChild(div);
    });
  }

  function filterSchemaObjects() {
    const query = document.getElementById('schemaObjectSearch').value.toLowerCase();
    const optionsEl = document.getElementById('schemaObjectOptions');
    optionsEl.classList.add('open');
    
    const filtered = _schemaObjectsData.filter(o => 
      o.name.toLowerCase().includes(query) || 
      o.label.toLowerCase().includes(query)
    );
    renderSchemaObjectsOptions(filtered);
  }

  function openSchemaObjectsDropdown() {
    const optionsEl = document.getElementById('schemaObjectOptions');
    if (optionsEl) optionsEl.classList.add('open');
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#schemaObjectSelectWrap')) {
      const optionsEl = document.getElementById('schemaObjectOptions');
      if (optionsEl) optionsEl.classList.remove('open');
    }
  });

  async function loadSchemaFields() {
    const objectName = document.getElementById('schemaObjectSearch').value.trim();
    const statusEl = document.getElementById('schemaFieldsStatus');
    const tbody = document.getElementById('schemaTableBody');
    
    if (!objectName) {
      showToast('Please enter or select an object name.');
      return;
    }
    
    statusEl.textContent = `Retrieving fields for ${objectName}...`;
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--muted);">Loading fields from Salesforce...</td></tr>';
    
    try {
      const projName = document.getElementById('projectSelector') ? document.getElementById('projectSelector').value : 'Default';
      const res = await customFetch(`/api/sf-fields?object=${encodeURIComponent(objectName)}&project_name=${encodeURIComponent(projName)}&env_mode=${encodeURIComponent(currentEnvMode)}`);
      if (!res.ok) throw new Error('API error');
      
      _schemaFieldsData = await res.json();
      statusEl.textContent = `Found ${_schemaFieldsData.length} fields on ${objectName}`;
      
      tbody.innerHTML = '';
      if (_schemaFieldsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--muted);">No fields found.</td></tr>';
        return;
      }
      
      _schemaFieldsData.forEach(f => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';
        
        tr.innerHTML = `
          <td style="padding:0.75rem 0.5rem; font-family:var(--font-mono); font-size:0.8rem; color:var(--mode-accent);">${f.fieldName}</td>
          <td style="padding:0.75rem 0.5rem;">${f.fieldLabel}</td>
          <td style="padding:0.75rem 0.5rem; text-transform: capitalize; color:var(--muted);">${f.dataType}</td>
          <td style="padding:0.75rem 0.5rem; text-align:right; display:flex; gap:6px; justify-content:flex-end;">
            <button type="button" class="save-btn" style="padding:3px 6px; font-size:0.7rem; border-radius:4px; background:transparent; border:1px solid var(--border-md);" onclick="schemaCopyText('${f.fieldName.replace(/'/g, "\\'")}')">Copy</button>
            <button type="button" class="save-btn" style="padding:3px 6px; font-size:0.7rem; border-radius:4px;" onclick="schemaCreateValRule('${objectName.replace(/'/g, "\\'")}', '${f.fieldName.replace(/'/g, "\\'")}')">Val Rule</button>
            <button type="button" class="save-btn" style="padding:3px 6px; font-size:0.7rem; border-radius:4px; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); color:#6ee7b7;" onclick="schemaEditField('${objectName.replace(/'/g, "\\'")}', '${f.fieldName.replace(/'/g, "\\'")}', '${f.fieldLabel.replace(/'/g, "\\'")}', '${f.dataType}')">Edit</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    } catch (e) {
      statusEl.textContent = `Failed to load fields for ${objectName}. Check credentials or SObject name.`;
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:red;">Could not retrieve object details.</td></tr>';
    }
  }

  function schemaCopyText(text) {
    navigator.clipboard.writeText(text);
    document.getElementById('schemaFieldsStatus').textContent = `Copied "${text}" to clipboard`;
  }
  
  function schemaCreateValRule(objectName, fieldName) {
    createValidationForHistoryField(objectName, fieldName);
  }
  
  function schemaEditField(objectName, fieldName, label, dataType) {
    switchTab('change', null);
    
    const objInput = document.getElementById('changeObjectName');
    if (objInput) objInput.value = objectName;
    
    const nameInput = document.getElementById('changeFieldName');
    if (nameInput) nameInput.value = fieldName;
    
    let mappedType = 'Text';
    const lType = dataType.toLowerCase();
    if (lType.includes('double') || lType.includes('percent') || lType.includes('integer') || lType.includes('number')) mappedType = 'Number';
    else if (lType.includes('currency')) mappedType = 'Currency';
    else if (lType.includes('datetime')) mappedType = 'Date/Time';
    else if (lType.includes('date')) mappedType = 'Date';
    else if (lType.includes('phone')) mappedType = 'Phone';
    else if (lType.includes('picklist')) mappedType = 'Picklist';
    
    const searchInput = document.getElementById('changeDataTypeSearch');
    const hiddenInput = document.getElementById('changeDataType');
    if (searchInput && hiddenInput) {
      searchInput.value = mappedType;
      hiddenInput.value = mappedType;
      hiddenInput.dispatchEvent(new Event('change'));
    }
    
    document.getElementById('statusText').textContent = `Loaded field ${fieldName} for type modification.`;
  }

  // ── OFFLINE FORMULA LINTER MODULE ───────────────────
  function lintValidationFormula() {
    const formulaText = document.getElementById('valFormula').value;
    const linterBox = document.getElementById('formulaLinterBox');
    const linterMsg = document.getElementById('formulaLinterMessage');
    
    if (!formulaText) {
      linterBox.style.display = 'none';
      return;
    }
    
    if (_valFieldData.length === 0) {
      linterBox.style.display = 'block';
      linterBox.style.background = 'rgba(59,130,246,0.06)';
      linterBox.style.borderColor = 'rgba(59,130,246,0.2)';
      linterMsg.innerHTML = '<span style="color:var(--subtle);">⚠️ Fields metadata is not loaded. Blur the "Object Name" field to load fields and enable error checking.</span>';
      return;
    }
    
    const keywords = new Set([
      'AND', 'OR', 'NOT', 'IF', 'CASE', 'LEN', 'LEFT', 'RIGHT', 'MID', 'FIND', 'SUBSTITUTE', 'TEXT', 
      'TRIM', 'LOWER', 'UPPER', 'CONTAINS', 'BEGINS', 'LPAD', 'RPAD', 'BR', 'TODAY', 'NOW', 'DATE', 
      'DATEVALUE', 'DATETIMEVALUE', 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND', 'WEEKDAY', 
      'ADDMONTHS', 'ABS', 'CEILING', 'FLOOR', 'ROUND', 'SQRT', 'MOD', 'MIN', 'MAX', 'EXP', 'LOG', 
      'VALUE', 'ISPICKVAL', 'ISBLANK', 'ISNULL', 'ISNUMBER', 'ISCHANGED', 'PRIORVALUE', 'REGEX', 
      'VLOOKUP', 'CASESAFEID', 'HTMLENCODE', 'URLENCODE', 'JSENCODE', 'HYPERLINK', 'IMAGE', 
      'DISTANCE', 'GEOLOCATION', 'TRUE', 'FALSE', 'NULL', 'TODAY', 'NOW'
    ]);
    
    const tokens = formulaText.match(/\b[a-zA-Z][a-zA-Z0-9_]*\b/g) || [];
    const unknownFields = [];
    
    const validFieldNames = new Set(_valFieldData.map(f => f.fieldName.toLowerCase()));
    
    validFieldNames.add('id');
    validFieldNames.add('name');
    validFieldNames.add('createddate');
    validFieldNames.add('lastmodifieddate');
    validFieldNames.add('ownerid');
    
    tokens.forEach(tok => {
      if (!keywords.has(tok.toUpperCase()) && !tok.startsWith('$') && isNaN(Number(tok))) {
        if (!validFieldNames.has(tok.toLowerCase())) {
          unknownFields.push(tok);
        }
      }
    });
    
    if (unknownFields.length > 0) {
      linterBox.style.display = 'block';
      linterBox.style.background = 'rgba(239,68,68,0.06)';
      linterBox.style.borderColor = 'rgba(239,68,68,0.2)';
      
      const uniqueUnknown = [...new Set(unknownFields)];
      linterMsg.innerHTML = `<span style="color:#ef4444; font-weight:600;">Warning:</span> Referenced field${uniqueUnknown.length > 1 ? 's' : ''} <span style="font-family:var(--font-mono); font-size:0.75rem; color:#fca5a5;">${uniqueUnknown.join(', ')}</span> do${uniqueUnknown.length > 1 ? '' : 'es'} not exist on this SObject. Double check spelling or make sure you created the field.`;
    } else {
      linterBox.style.display = 'block';
      linterBox.style.background = 'rgba(16,185,129,0.06)';
      linterBox.style.borderColor = 'rgba(16,185,129,0.2)';
      linterMsg.innerHTML = '<span style="color:#10b981; font-weight:600;">Formula looks valid!</span> All referenced fields match this SObject\'s schema.';
    }
  }

  // ── LOCAL SETUP AGENT HELPER FUNCTIONS ───────────
  function setRunMode(mode) {
    currentRunMode = mode;
    localStorage.setItem('sf_run_mode', mode);
    
    const setupPanel = document.getElementById('localSetupPanel');
    if (setupPanel) {
      setupPanel.style.display = mode === 'local' ? 'block' : 'none';
    }
    
    // Update topbar select
    const topbarRun = document.getElementById('topbarRunModeSelect');
    if (topbarRun) topbarRun.value = mode;

    if (mode === 'local') {
      checkLocalAgentStatus();
    }

    if (typeof updateStatsUI === 'function') {
      updateStatsUI();
    }
  }

  async function checkLocalAgentStatus() {
    const statusText = document.getElementById('agentStatusText');
    const statusDot = document.getElementById('agentStatusDot');
    if (!statusText || !statusDot) return;
    
    statusText.textContent = 'Checking...';
    statusText.style.color = 'var(--muted)';
    statusDot.style.background = 'var(--muted)';
    
    try {
      const res = await fetch('http://localhost:8000/api/auth/me', { credentials: 'include' });
      if (res.status === 200 || res.status === 401) {
        statusText.textContent = 'Online';
        statusText.style.color = '#10b981';
        statusDot.style.background = '#10b981';
      } else {
        throw new Error('Offline');
      }
    } catch(e) {
      statusText.textContent = 'Offline';
      statusText.style.color = '#ef4444';
      statusDot.style.background = '#ef4444';
    }
  }

  function downloadLocalInstaller(type) {
    let filename = '';
    let content = '';
    const currentOrigin = window.location.origin;
    
    if (type === 'win') {
      filename = 'start_agent.bat';
      content = `@echo off
cd /d "%~dp0"
echo ===================================================
echo   Salesforce Automator - Local Agent Setup
echo ===================================================
echo.

set PYTHON_CMD=python
python --version >nul 2>&1
if %errorlevel% equ 0 goto PYTHON_DETECTED

py --version >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON_CMD=py
    echo [+] Python detected via py launcher.
    goto PYTHON_DETECTED
)

echo [.] Python is not in system PATH. Checking standard local paths...
for /d %%d in ("%LocalAppData%\\Programs\\Python\\Python*") do (
    if exist "%%d\\python.exe" (
        set PYTHON_CMD="%%d\\python.exe"
        echo [+] Found Python locally at: %%d\\python.exe
        goto PYTHON_DETECTED
    )
)

for /d %%d in ("%ProgramFiles%\\Python*") do (
    if exist "%%d\\python.exe" (
        set PYTHON_CMD="%%d\\python.exe"
        echo [+] Found Python in Program Files at: %%d\\python.exe
        goto PYTHON_DETECTED
    )
)

echo [!] Python is not installed or not found.
echo [.] Attempting to install Python via winget...
winget install --id Python.Python.3.11 --exact --silent --accept-package-agreements --accept-source-agreements
if %errorlevel% neq 0 (
    echo [x] Auto-install failed. Please download Python manually: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [+] Python installed successfully.
echo [.] Checking local paths again...
for /d %%d in ("%LocalAppData%\\Programs\\Python\\Python*") do (
    if exist "%%d\\python.exe" (
        set PYTHON_CMD="%%d\\python.exe"
        goto PYTHON_DETECTED
    )
)

echo [!] Please restart this script to reload the system PATH environment variable.
pause
exit /b 0

:PYTHON_DETECTED
echo [+] Using Python command: %PYTHON_CMD%
%PYTHON_CMD% --version
echo.

echo [.] Installing Python Playwright package...
%PYTHON_CMD% -m pip install --upgrade pip
%PYTHON_CMD% -m pip install playwright
if %errorlevel% neq 0 (
    echo [x] Failed to install Playwright python package.
    pause
    exit /b 1
)
echo [+] Playwright package installed.
echo.

echo [.] Installing Playwright Chromium browser...
%PYTHON_CMD% -m playwright install chromium
if %errorlevel% neq 0 (
    echo [x] Failed to install Playwright browser binaries.
    pause
    exit /b 1
)
echo [+] Playwright browsers installed.
echo.

echo [.] Downloading latest salesforce_playwright.py agent script...
if exist salesforce_playwright_temp.py del /f /q salesforce_playwright_temp.py
powershell -Command "[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '${currentOrigin}/salesforce_playwright.py' -OutFile 'salesforce_playwright_temp.py'"
if %errorlevel% neq 0 (
    echo [.] Trying fallback download...
    powershell -Command "curl -o salesforce_playwright_temp.py '${currentOrigin}/salesforce_playwright.py'"
)

if not exist salesforce_playwright_temp.py goto DOWNLOAD_FAILED

findstr "import os" salesforce_playwright_temp.py >nul 2>&1
if %errorlevel% neq 0 goto DOWNLOAD_FAILED

findstr "def init_db" salesforce_playwright_temp.py >nul 2>&1
if %errorlevel% neq 0 goto DOWNLOAD_FAILED

findstr "class RequestHandler" salesforce_playwright_temp.py >nul 2>&1
if %errorlevel% neq 0 goto DOWNLOAD_FAILED

move /y salesforce_playwright_temp.py salesforce_playwright.py >nul
echo [+] Downloaded and updated latest agent script.
goto LAUNCH_AGENT

:DOWNLOAD_FAILED
if exist salesforce_playwright_temp.py del /f /q salesforce_playwright_temp.py
if exist salesforce_playwright.py (
    findstr "import os" salesforce_playwright.py >nul 2>&1
    if %errorlevel% equ 0 (
        echo [!] Warning: Latest agent download failed or was invalid. Using existing local agent script.
        goto LAUNCH_AGENT
    )
)
echo [x] Error: Failed to download salesforce_playwright.py and no valid local copy exists.
pause
exit /b 1

:LAUNCH_AGENT
echo [.] Launching agent server...
%PYTHON_CMD% salesforce_playwright.py
pause`;
    } else {
      filename = 'install_salesforce_agent.sh';
      content = `#!/bin/bash
echo "==================================================="
echo "  Salesforce Automator - Local Agent Setup (macOS/Linux)"
echo "==================================================="
echo

if ! command -v python3 &> /dev/null; then
    echo "[!] Python3 is not installed."
    echo "[.] Please install Python3 using brew install python or your package manager."
    exit 1
else
    echo "[+] Python3 detected: \$(python3 --version)"
fi

# Create a virtual environment to avoid PEP 668 restrictions
echo "[.] Creating virtual environment..."
python3 -m venv .venv
if [ -d ".venv" ]; then
    echo "[+] Virtual environment created."
    source .venv/bin/activate
else
    echo "[!] Virtual environment creation failed. Using system python with fallback flag."
    BREAK_FLAG="--break-system-packages"
fi

echo "[.] Installing Playwright python package..."
python3 -m pip install --upgrade pip \$BREAK_FLAG
python3 -m pip install playwright \$BREAK_FLAG
if [ \$? -ne 0 ]; then
    echo "[x] Failed to install Playwright package."
    exit 1
fi
echo "[+] Playwright package installed."
echo

echo "[.] Installing Playwright Chromium browser..."
if [ -d ".venv" ]; then
    playwright install chromium
else
    python3 -m playwright install chromium
fi
if [ \$? -ne 0 ]; then
    echo "[x] Failed to install Playwright browsers."
    exit 1
fi
echo "[+] Playwright browsers installed."
echo

echo "[.] Downloading latest agent script..."
curl -L -o salesforce_playwright_temp.py "${currentOrigin}/salesforce_playwright.py"

NEW_VALID=0
if [ -f salesforce_playwright_temp.py ]; then
    if grep -q "import os" salesforce_playwright_temp.py && grep -q "def init_db" salesforce_playwright_temp.py && grep -q "class RequestHandler" salesforce_playwright_temp.py; then
        NEW_VALID=1
    fi
fi

if [ \$NEW_VALID -eq 1 ]; then
    mv -f salesforce_playwright_temp.py salesforce_playwright.py
    echo "[+] Downloaded and updated latest agent script."
else
    rm -f salesforce_playwright_temp.py
    if [ -f salesforce_playwright.py ] && grep -q "import os" salesforce_playwright.py; then
        echo "[!] Warning: Latest agent download failed. Using existing local agent script."
    else
        echo "[x] Error: Failed to download salesforce_playwright.py and no valid local copy exists."
        read -p "Press enter to exit"
        exit 1
    fi
fi

echo "[+] Setup complete! Starting local agent..."
if [ -d ".venv" ]; then
    python salesforce_playwright.py
else
    python3 salesforce_playwright.py
fi`;
    }
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  // Register Event Listeners
  document.addEventListener('DOMContentLoaded', () => {
    // Initialize run mode state
    const mode = localStorage.getItem('sf_run_mode') || 'local';
    const cloudRadio = document.getElementById('runModeCloud');
    const localRadio = document.getElementById('runModeLocal');
    if (mode === 'local') {
      if (localRadio) localRadio.checked = true;
      setRunMode('local');
    } else {
      if (cloudRadio) cloudRadio.checked = true;
      setRunMode('cloud');
    }

    const formulaInput = document.getElementById('valFormula');
    if (formulaInput) {
      formulaInput.addEventListener('input', lintValidationFormula);
    }
    const valObjectNameInput = document.getElementById('valObjectName');
    if (valObjectNameInput) {
      valObjectNameInput.addEventListener('blur', lintValidationFormula);
    }

    // Check for prefilled params from MOM
    setTimeout(checkPrefill, 200);
  });

  function checkPrefill() {
    const params = new URLSearchParams(window.location.search);
    const prefill = params.get('prefill') === 'true';
    if (!prefill) return;

    const desc = params.get('desc') || '';
    const project = params.get('project') || '';

    // Show prefill banner
    const banner = document.getElementById('prefillBanner');
    const descEl = document.getElementById('prefillDesc');
    if (banner && descEl) {
      banner.style.display = 'block';
      descEl.textContent = desc;
    }

    // Attempt to select the project
    if (project) {
      const projSelect = document.getElementById('projectSelector');
      if (projSelect) {
        let found = false;
        for (let i = 0; i < projSelect.options.length; i++) {
          if (projSelect.options[i].value === project || projSelect.options[i].text.toLowerCase() === project.toLowerCase()) {
            projSelect.selectedIndex = i;
            found = true;
            break;
          }
        }
        if (found) {
          if (typeof loadProjectCredentials === 'function') {
            loadProjectCredentials();
          }
        }
      }
    }

    // Determine and switch to appropriate tab
    const lowerDesc = desc.toLowerCase();
    let targetMode = 'single'; // default

    if (lowerDesc.includes('validate') || lowerDesc.includes('validation') || lowerDesc.includes('rule') || lowerDesc.includes('prevent') || lowerDesc.includes('isblank') || lowerDesc.includes('error message')) {
      targetMode = 'validation';
    } else if (lowerDesc.includes('change field') || lowerDesc.includes('change data type') || lowerDesc.includes('field type') || lowerDesc.includes('modify type') || lowerDesc.includes('convert type') || lowerDesc.includes('change type')) {
      targetMode = 'change';
    } else if (lowerDesc.includes('create user') || lowerDesc.includes('new user') || lowerDesc.includes('add user') || lowerDesc.includes('assign permission')) {
      targetMode = 'user';
    } else if (lowerDesc.includes('new custom object') || lowerDesc.includes('create object') || lowerDesc.includes('custom object')) {
      targetMode = 'object';
    } else if (lowerDesc.includes('flow') || lowerDesc.includes('create flow') || lowerDesc.includes('automate flow')) {
      targetMode = 'flow';
    }

    // Switch tab
    if (typeof switchSidebarTab === 'function') {
      switchSidebarTab(targetMode, null);
    } else if (typeof switchTab === 'function') {
      switchTab(targetMode, null);
    }
  }

  // Clear prefill banner
  window.clearPrefill = function() {
    const banner = document.getElementById('prefillBanner');
    if (banner) banner.style.display = 'none';
    const url = new URL(window.location);
    url.searchParams.delete('prefill');
    url.searchParams.delete('desc');
    url.searchParams.delete('project');
    window.history.replaceState({}, document.title, url.toString());
  };

  window.triggerAIAssist = async function() {
    let apiKey = localStorage.getItem('GEMINI_API_KEY') || '';
    const desc = document.getElementById('prefillDesc').textContent.trim();
    const model = localStorage.getItem('GEMINI_MODEL') || 'gemini-2.5-flash';
    const aiBtn = document.getElementById('aiAssistBtn');

    if (!desc) {
      showToast('No description available to parse.');
      return;
    }

    if (!apiKey) {
      const userKey = prompt('Please enter your Google Gemini API Key to run the AI assistant (saved in your local browser storage):');
      if (userKey) {
        localStorage.setItem('GEMINI_API_KEY', userKey.trim());
        apiKey = userKey.trim();
      } else {
        return;
      }
    }

    aiBtn.disabled = true;
    aiBtn.textContent = 'Parsing...';

    const systemPrompt = `You are a Salesforce developer assistant.
Parse the following meeting action item / task description into a structured JSON payload for Salesforce customization.
The target mode/tab is "${currentMode}".

Strictly output ONLY a JSON object matching one of the following schemas based on currentMode, with absolutely no markdown wrapping (do not use \`\`\`json) and no explanations.

If currentMode is "single", schema is:
{
  "objectName": "String (e.g., Account)",
  "dataType": "Number | Currency | Date | Date/Time | Phone | Picklist | Text",
  "label": "String (e.g., Annual Revenue)",
  "apiName": "String (e.g., Annual_Revenue__c)",
  "length": Number (optional),
  "decimalPlaces": Number (optional),
  "picklistValues": "String (newline separated values, optional)",
  "required": Boolean (optional)
}

If currentMode is "validation", schema is:
{
  "objectName": "String (e.g., Account)",
  "ruleName": "String (API name containing only letters, numbers, underscores, e.g., Prevent_Invalid_Age)",
  "formula": "String (Valid Salesforce validation rule formula, e.g., Age__c < 18)",
  "errorMsg": "String (Error message display text)",
  "errorField": "String (Field API name where error is located, e.g., Age__c)"
}

If currentMode is "change", schema is:
{
  "objectName": "String (e.g., Account)",
  "apiName": "String (e.g., My_Custom_Field__c)",
  "newDataType": "Number | Currency | Date | Date/Time | Phone | Picklist | Text",
  "length": Number (optional),
  "decimalPlaces": Number (optional),
  "picklistValues": "String (newline separated values, optional)"
}

Description to parse:
"${desc}"`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      
      const resData = await response.json();
      let aiText = resData.candidates[0].content.parts[0].text.trim();
      aiText = aiText.replace(/^```(json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      
      const parsed = JSON.parse(aiText);
      
      // Populate Form Fields
      if (currentMode === 'single') {
        if (parsed.objectName) document.getElementById('objectName').value = parsed.objectName;
        
        if (parsed.dataType) {
          const typeSearch = document.getElementById('dataTypeSearch');
          const typeHidden = document.getElementById('dataType');
          if (typeSearch && typeHidden) {
            typeSearch.value = parsed.dataType;
            typeHidden.value = parsed.dataType;
            typeHidden.dispatchEvent(new Event('change'));
          }
          
          setTimeout(() => {
            const labelInput = document.querySelector(`[name="${parsed.dataType}-FieldLabel"]`);
            const nameInput = document.querySelector(`[name="${parsed.dataType}-FieldName"]`);
            if (labelInput) labelInput.value = parsed.label || '';
            if (nameInput) nameInput.value = parsed.apiName || '';
            
            if (parsed.dataType === 'Number' || parsed.dataType === 'Currency') {
              const lenInput = document.querySelector(`[name="${parsed.dataType}-Length"]`);
              const decInput = document.querySelector(`[name="${parsed.dataType}-DecimalPlaces"]`);
              if (lenInput && parsed.length !== undefined) lenInput.value = parsed.length;
              if (decInput && parsed.decimalPlaces !== undefined) decInput.value = parsed.decimalPlaces;
            } else if (parsed.dataType === 'Text') {
              const lenInput = document.querySelector(`[name="Text-Length"]`);
              if (lenInput && parsed.length !== undefined) lenInput.value = parsed.length;
            } else if (parsed.dataType === 'Picklist') {
              const valsInput = document.querySelector(`[name="Picklist-Values"]`);
              if (valsInput && parsed.picklistValues) valsInput.value = parsed.picklistValues;
            }
          }, 50);
        }
      } else if (currentMode === 'validation') {
        if (parsed.objectName) {
          document.getElementById('valObjectName').value = parsed.objectName;
          if (typeof loadObjectFields === 'function') loadObjectFields();
        }
        if (parsed.ruleName) document.getElementById('valRuleName').value = parsed.ruleName;
        if (parsed.formula) document.getElementById('valFormula').value = parsed.formula;
        if (parsed.errorMsg) document.getElementById('valErrorMsg').value = parsed.errorMsg;
        if (parsed.errorField) {
          document.getElementById('valTargetField').value = parsed.errorField;
          document.getElementById('valErrorField').value = parsed.errorField;
        }
      } else if (currentMode === 'change') {
        if (parsed.objectName) document.getElementById('changeObjectName').value = parsed.objectName;
        if (parsed.apiName) document.getElementById('changeFieldName').value = parsed.apiName;
        
        if (parsed.newDataType) {
          const typeSearch = document.getElementById('changeDataTypeSearch');
          const typeHidden = document.getElementById('changeDataType');
          if (typeSearch && typeHidden) {
            typeSearch.value = parsed.newDataType;
            typeHidden.value = parsed.newDataType;
            typeHidden.dispatchEvent(new Event('change'));
          }
          
          setTimeout(() => {
            if (parsed.newDataType === 'Number' || parsed.newDataType === 'Currency') {
              const lenInput = document.querySelector(`[name="Change${parsed.newDataType}-Length"]`);
              const decInput = document.querySelector(`[name="Change${parsed.newDataType}-DecimalPlaces"]`);
              if (lenInput && parsed.length !== undefined) lenInput.value = parsed.length;
              if (decInput && parsed.decimalPlaces !== undefined) decInput.value = parsed.decimalPlaces;
            } else if (parsed.newDataType === 'Text') {
              const lenInput = document.querySelector(`[name="ChangeText-Length"]`);
              if (lenInput && parsed.length !== undefined) lenInput.value = parsed.length;
            } else if (parsed.newDataType === 'Picklist') {
              const valsInput = document.querySelector(`[name="ChangePicklist-Values"]`);
              if (valsInput && parsed.picklistValues) valsInput.value = parsed.picklistValues;
            }
          }, 50);
        }
      }

      showToast('AI Assist parsing completed!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to parse description using AI: ' + err.message);
    } finally {
      aiBtn.disabled = false;
      aiBtn.textContent = '✨ AI Assist Parse';
    }
  };

window.showToast = function(msg, type="error") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerText = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

