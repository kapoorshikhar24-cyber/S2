import re
import sys

def patch_html():
    path = r"c:\Users\Shikhar Kapoor\Downloads\Programs\Salesforce\v1.0\salesforce_automator.html"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Tabs
    content = content.replace(
        """<button type="button" class="tab-btn" onclick="switchTab('validation',event)">Validation Rule</button>
          <button type="button" class="tab-btn" onclick="switchTab('bulk',event)">Bulk Upload</button>""",
        """<button type="button" class="tab-btn" onclick="switchTab('validation',event)">Validation Rule</button>
          <button type="button" class="tab-btn" onclick="switchTab('user',event)">Create User</button>
          <button type="button" class="tab-btn" onclick="switchTab('bulk',event)">Bulk Upload</button>"""
    )

    # 2. User Tab Content
    user_tab = """      <!-- User Tab -->
      <div id="user-tab" class="tab-content">
        <div class="section" id="section-user">
          <div class="section-label">User Configuration</div>
          <div class="row">
            <div class="field">
              <label for="userFirstName">First Name</label>
              <input type="text" id="userFirstName" placeholder="e.g. John">
            </div>
            <div class="field">
              <label for="userLastName">Last Name</label>
              <input type="text" id="userLastName" placeholder="e.g. Doe" class="single-user-req">
            </div>
          </div>
          <div class="row">
            <div class="field">
              <label for="userEmail">Email</label>
              <input type="email" id="userEmail" placeholder="you@example.com" class="single-user-req" oninput="updateUserUsername()">
            </div>
            <div class="field">
              <label for="userUsername">Username</label>
              <input type="email" id="userUsername" placeholder="Auto-fills based on email" class="single-user-req">
            </div>
          </div>
          <div class="field">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="userGenPassword" style="width:auto; transform:scale(1.2);">
              Generate new password and notify user immediately
            </label>
            <div style="font-size:0.75rem; color:var(--muted); margin-top:4px;" id="userGenPasswordNote">Disabled in Sandbox mode.</div>
          </div>
        </div>
      </div>

      <!-- Bulk Tab -->"""
    content = content.replace("<!-- Bulk Tab -->", user_tab)

    # 3. Bulk Upload buttons and csv info
    content = content.replace(
        """<button type="button" class="save-btn" style="padding:0.4rem 0.8rem; font-size:0.75rem; border-radius:6px;" onclick="downloadTemplate('validation')">Validation Template</button>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">""",
        """<button type="button" class="save-btn" style="padding:0.4rem 0.8rem; font-size:0.75rem; border-radius:6px;" onclick="downloadTemplate('validation')">Validation Template</button>
              <button type="button" class="save-btn" style="padding:0.4rem 0.8rem; font-size:0.75rem; border-radius:6px;" onclick="downloadTemplate('user')">User Template</button>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">"""
    )
    content = content.replace(
        """<code style="font-size:0.7rem; word-break:break-all;">ObjectName,RuleName,Formula,ErrorMessage,ErrorField</code>
            </div>
          </div>""",
        """<code style="font-size:0.7rem; word-break:break-all;">ObjectName,RuleName,Formula,ErrorMessage,ErrorField</code>
            </div>
            <div class="csv-info" style="margin-bottom:0;">
              <p style="font-weight: 500; margin-bottom: 4px;">Users CSV Headers:</p>
              <code style="font-size:0.7rem; word-break:break-all;">FirstName,LastName,Email,Username,GeneratePassword</code>
            </div>
          </div>"""
    )

    # 4. update setMode
    set_mode_inject = """function setMode(mode, isManualClick = false) {
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
    }"""
    content = content.replace("function setMode(mode, isManualClick = false) {\n    currentEnvMode = mode;\n    localStorage.setItem('sf_env_mode', mode);", set_mode_inject)


    # 5. updateUserUsername function
    js_inject = """  function updateUserUsername() {
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
  
  let currentMode = 'single';"""
    content = content.replace("let currentMode = 'single';", js_inject)

    # 6. switchTab logic
    old_switch = """      if (mode === 'single') {
        document.getElementById('btn-label').textContent = 'Run Field Automation';
      } else if (mode === 'validation') {
        document.getElementById('btn-label').textContent = 'Run Validation Automation';
      } else {
        document.getElementById('btn-label').textContent = 'Run Bulk Automation';
      }"""
    new_switch = """      if (mode === 'single') {
        document.getElementById('btn-label').textContent = 'Run Field Automation';
      } else if (mode === 'validation') {
        document.getElementById('btn-label').textContent = 'Run Validation Automation';
      } else if (mode === 'user') {
        document.getElementById('btn-label').textContent = 'Run User Automation';
      } else {
        document.getElementById('btn-label').textContent = 'Run Bulk Automation';
      }"""
    content = content.replace(old_switch, new_switch)

    old_switch_2 = """    if (mode === 'single') {
      currentTaskType = 'field';
      document.querySelectorAll('.single-req').forEach(el => el.setAttribute('required','true'));
      document.querySelectorAll('.single-val-req').forEach(el => el.removeAttribute('required'));
      document.querySelectorAll('.bulk-req').forEach(el => el.removeAttribute('required'));
    } else if (mode === 'validation') {
      currentTaskType = 'validation_rule';
      document.querySelectorAll('.single-req').forEach(el => el.removeAttribute('required'));
      document.querySelectorAll('.single-val-req').forEach(el => el.setAttribute('required','true'));
      document.querySelectorAll('.bulk-req').forEach(el => el.removeAttribute('required'));
      // Auto-load fields from history for the current object name
      loadObjectFields();
    } else if (mode === 'bulk') {
      document.querySelectorAll('.single-req, .single-val-req').forEach(el => el.removeAttribute('required'));
      document.querySelectorAll('.bulk-req').forEach(el => el.setAttribute('required','true'));
    } else {
      document.querySelectorAll('.single-req, .single-val-req, .bulk-req').forEach(el => el.removeAttribute('required'));
    }"""
    new_switch_2 = """    if (mode === 'single') {
      currentTaskType = 'field';
      document.querySelectorAll('.single-req').forEach(el => el.setAttribute('required','true'));
      document.querySelectorAll('.single-val-req').forEach(el => el.removeAttribute('required'));
      document.querySelectorAll('.single-user-req').forEach(el => el.removeAttribute('required'));
      document.querySelectorAll('.bulk-req').forEach(el => el.removeAttribute('required'));
    } else if (mode === 'validation') {
      currentTaskType = 'validation_rule';
      document.querySelectorAll('.single-req').forEach(el => el.removeAttribute('required'));
      document.querySelectorAll('.single-val-req').forEach(el => el.setAttribute('required','true'));
      document.querySelectorAll('.single-user-req').forEach(el => el.removeAttribute('required'));
      document.querySelectorAll('.bulk-req').forEach(el => el.removeAttribute('required'));
      // Auto-load fields from history for the current object name
      loadObjectFields();
    } else if (mode === 'user') {
      currentTaskType = 'user';
      document.querySelectorAll('.single-req').forEach(el => el.removeAttribute('required'));
      document.querySelectorAll('.single-val-req').forEach(el => el.removeAttribute('required'));
      document.querySelectorAll('.single-user-req').forEach(el => el.setAttribute('required','true'));
      document.querySelectorAll('.bulk-req').forEach(el => el.removeAttribute('required'));
    } else if (mode === 'bulk') {
      document.querySelectorAll('.single-req, .single-val-req, .single-user-req').forEach(el => el.removeAttribute('required'));
      document.querySelectorAll('.bulk-req').forEach(el => el.setAttribute('required','true'));
    } else {
      document.querySelectorAll('.single-req, .single-val-req, .single-user-req, .bulk-req').forEach(el => el.removeAttribute('required'));
    }"""
    content = content.replace(old_switch_2, new_switch_2)

    # 7. Download template
    old_tpl = """      csvRows = [
        'ObjectName,RuleName,Formula,ErrorMessage,ErrorField',
        'Account,Prevent_Invalid_Age,Age__c < 18,Age must be 18 or older.,Age__c',
        'Opportunity,Prevent_Stage_Change,ISPICKVAL(StageName, "Closed Won") && Amount < 100,Closed Won opportunities must have an amount >= 100.,'
      ];
    }
    const csv = csvRows.join('\\n');"""
    new_tpl = """      csvRows = [
        'ObjectName,RuleName,Formula,ErrorMessage,ErrorField',
        'Account,Prevent_Invalid_Age,Age__c < 18,Age must be 18 or older.,Age__c',
        'Opportunity,Prevent_Stage_Change,ISPICKVAL(StageName, "Closed Won") && Amount < 100,Closed Won opportunities must have an amount >= 100.,'
      ];
    } else if (type === 'user') {
      csvRows = [
        'FirstName,LastName,Email,Username,GeneratePassword',
        'John,Doe,john@example.com,john@example.com,true',
        'Jane,Smith,jane@example.com,jane@example.com.uat,false'
      ];
    }
    const csv = csvRows.join('\\n');"""
    content = content.replace(old_tpl, new_tpl)
    
    old_download = """a.download = type === 'field' ? 'field_import_template.csv' : 'validation_import_template.csv';"""
    new_download = """a.download = type === 'field' ? 'field_import_template.csv' : (type === 'validation' ? 'validation_import_template.csv' : 'user_import_template.csv');"""
    content = content.replace(old_download, new_download)

    # 8. Submit payload
    old_payload = """      taskType: currentMode === 'single' ? 'field' : (currentMode === 'validation' ? 'validation_rule' : 'field'),"""
    new_payload = """      taskType: currentMode === 'single' ? 'field' : (currentMode === 'validation' ? 'validation_rule' : (currentMode === 'user' ? 'user' : 'field')),"""
    content = content.replace(old_payload, new_payload)

    old_submit = """      const singleData = {
        objectName: document.getElementById('valObjectName').value,
        ruleName: document.getElementById('valRuleName').value,
        formula: document.getElementById('valFormula').value,
        errorMessage: document.getElementById('valErrorMsg').value,
        errorField: document.getElementById('valErrorField').value
      };
      payload.data = [singleData];
    } else {"""
    new_submit = """      const singleData = {
        objectName: document.getElementById('valObjectName').value,
        ruleName: document.getElementById('valRuleName').value,
        formula: document.getElementById('valFormula').value,
        errorMessage: document.getElementById('valErrorMsg').value,
        errorField: document.getElementById('valErrorField').value
      };
      payload.data = [singleData];
    } else if (currentMode === 'user') {
      const singleData = {
        FirstName: document.getElementById('userFirstName').value,
        LastName: document.getElementById('userLastName').value,
        Email: document.getElementById('userEmail').value,
        Username: document.getElementById('userUsername').value,
        GeneratePassword: document.getElementById('userGenPassword').checked
      };
      payload.data = [singleData];
    } else {"""
    content = content.replace(old_submit, new_submit)

    old_csv_parse = """          if ('RuleName' in firstRow || 'ruleName' in firstRow || 'Formula' in firstRow || 'formula' in firstRow) {
            payload.taskType = 'validation_rule';
          } else {
            payload.taskType = 'field';
          }"""
    new_csv_parse = """          if ('RuleName' in firstRow || 'ruleName' in firstRow || 'Formula' in firstRow || 'formula' in firstRow) {
            payload.taskType = 'validation_rule';
          } else if ('LastName' in firstRow || 'lastName' in firstRow || 'Email' in firstRow || 'email' in firstRow || 'Username' in firstRow) {
            payload.taskType = 'user';
          } else {
            payload.taskType = 'field';
          }"""
    content = content.replace(old_csv_parse, new_csv_parse)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

patch_html()
