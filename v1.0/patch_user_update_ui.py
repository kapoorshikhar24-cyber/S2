import sys

def patch_ui():
    path = r"c:\Users\Shikhar Kapoor\Downloads\Programs\Salesforce\v1.0\salesforce_automator.html"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update HTML
    old_html = """          <div class="section-label">User Configuration</div>
          <div class="row">
            <div class="field">
              <label for="userFirstName">First Name</label>
              <input type="text" id="userFirstName" placeholder="e.g. John">
            </div>
            <div class="field">
              <label for="userLastName">Last Name</label>
              <input type="text" id="userLastName" placeholder="e.g. Doe" class="single-user-req">
            </div>
          </div>"""
          
    new_html = """          <div class="section-label">User Configuration</div>
          <div class="field" style="margin-bottom: 1rem;">
            <label for="userActionSelect">Action</label>
            <select id="userActionSelect" class="single-user-req" onchange="toggleUserAction()" style="width: 100%; padding: 0.55rem; border-radius: 8px; background: var(--surface2); border: 1px solid var(--border-md); color: var(--text);">
              <option value="create">Create New User</option>
              <option value="update">Update Existing User Status</option>
            </select>
          </div>
          <div id="userCreateFields">
          <div class="row">
            <div class="field">
              <label for="userFirstName">First Name</label>
              <input type="text" id="userFirstName" placeholder="e.g. John">
            </div>
            <div class="field">
              <label for="userLastName">Last Name</label>
              <input type="text" id="userLastName" placeholder="e.g. Doe" class="single-user-req">
            </div>
          </div>"""
    content = content.replace(old_html, new_html)
    
    old_html_2 = """          <div class="field">
            <label for="userProfile">Profile</label>
            <input type="text" id="userProfile" placeholder="e.g. System Administrator">
          </div>
          <div class="field">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="userGenPassword" style="width:auto; transform:scale(1.2);">
              Generate new password and notify user immediately
            </label>
            <div style="font-size:0.75rem; color:var(--muted); margin-top:4px;" id="userGenPasswordNote">Disabled in Sandbox mode.</div>
          </div>
        </div>
      </div>"""
      
    new_html_2 = """          <div class="field">
            <label for="userProfile">Profile</label>
            <input type="text" id="userProfile" placeholder="e.g. System Administrator">
          </div>
          <div class="field">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="userGenPassword" style="width:auto; transform:scale(1.2);">
              Generate new password and notify user immediately
            </label>
            <div style="font-size:0.75rem; color:var(--muted); margin-top:4px;" id="userGenPasswordNote">Disabled in Sandbox mode.</div>
          </div>
          </div>
          <div id="userUpdateFields" style="display: none;">
            <div class="field">
              <label for="updateUserUsername">Username (to search for)</label>
              <input type="email" id="updateUserUsername" placeholder="e.g. you@example.com">
            </div>
            <div class="field">
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input type="checkbox" id="updateUserActive" style="width:auto; transform:scale(1.2);" checked>
                User is Active
              </label>
              <div style="font-size:0.75rem; color:var(--muted); margin-top:4px;">Check to activate, uncheck to deactivate.</div>
            </div>
          </div>
        </div>
      </div>"""
    content = content.replace(old_html_2, new_html_2)

    # 2. Add toggle function in JS
    old_js_1 = """  function updateUserUsername() {"""
    new_js_1 = """  function toggleUserAction() {
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

  function updateUserUsername() {"""
    content = content.replace(old_js_1, new_js_1)
    
    # 3. Update Payload taskType
    old_payload_type = """      taskType: currentMode === 'single' ? 'field' : (currentMode === 'validation' ? 'validation_rule' : (currentMode === 'user' ? 'user' : 'field')),"""
    new_payload_type = """      taskType: currentMode === 'single' ? 'field' : (currentMode === 'validation' ? 'validation_rule' : (currentMode === 'user' ? (document.getElementById('userActionSelect').value === 'update' ? 'update_user_status' : 'user') : 'field')),"""
    content = content.replace(old_payload_type, new_payload_type)

    old_submit = """    } else if (currentMode === 'user') {
      const singleData = {
        FirstName: document.getElementById('userFirstName').value,
        LastName: document.getElementById('userLastName').value,
        Email: document.getElementById('userEmail').value,
        Username: document.getElementById('userUsername').value,
        GeneratePassword: document.getElementById('userGenPassword').checked,
        Role: document.getElementById('userRole').value,
        License: document.getElementById('userLicense').value,
        Profile: document.getElementById('userProfile').value
      };
      payload.data = [singleData];"""
      
    new_submit = """    } else if (currentMode === 'user') {
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
      }"""
    content = content.replace(old_submit, new_submit)
    
    # 4. CSV parsing
    old_csv = """          } else if ('LastName' in firstRow || 'lastName' in firstRow || 'Email' in firstRow || 'email' in firstRow || 'Username' in firstRow) {
            payload.taskType = 'user';"""
    new_csv = """          } else if ('LastName' in firstRow || 'lastName' in firstRow || 'Email' in firstRow || 'email' in firstRow || 'Username' in firstRow) {
            if ('IsActive' in firstRow || 'isActive' in firstRow) {
                payload.taskType = 'update_user_status';
            } else {
                payload.taskType = 'user';
            }"""
    content = content.replace(old_csv, new_csv)
    
    # 5. Templates
    old_btn = """<button type="button" class="save-btn" style="padding:0.4rem 0.8rem; font-size:0.75rem; border-radius:6px;" onclick="downloadTemplate('user')">User Template</button>"""
    new_btn = """<button type="button" class="save-btn" style="padding:0.4rem 0.8rem; font-size:0.75rem; border-radius:6px;" onclick="downloadTemplate('user')">User Template</button>
              <button type="button" class="save-btn" style="padding:0.4rem 0.8rem; font-size:0.75rem; border-radius:6px;" onclick="downloadTemplate('user_update')">Update Status Template</button>"""
    content = content.replace(old_btn, new_btn)
    
    old_csv_text = """    } else if (type === 'user') {
      csvRows = [
        'FirstName,LastName,Email,Username,GeneratePassword,Role,License,Profile',
        'John,Doe,john@example.com,john@example.com,true,CEO,Salesforce,System Administrator',
        'Jane,Smith,jane@example.com,jane@example.com.uat,false,,,Standard User'
      ];
    }
    const csv = csvRows.join('\\n');"""
    new_csv_text = """    } else if (type === 'user') {
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
    const csv = csvRows.join('\\n');"""
    content = content.replace(old_csv_text, new_csv_text)
    
    old_dl = """a.download = type === 'field' ? 'field_import_template.csv' : (type === 'validation' ? 'validation_import_template.csv' : 'user_import_template.csv');"""
    new_dl = """a.download = type === 'field' ? 'field_import_template.csv' : (type === 'validation' ? 'validation_import_template.csv' : (type === 'user_update' ? 'user_status_update_template.csv' : 'user_import_template.csv'));"""
    content = content.replace(old_dl, new_dl)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

patch_ui()
