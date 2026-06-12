import sys

def patch_ui():
    path = r"c:\Users\Shikhar Kapoor\Downloads\Programs\Salesforce\v1.0\salesforce_automator.html"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add fields to HTML
    old_fields = """          <div class="row">
            <div class="field">
              <label for="userEmail">Email</label>
              <input type="email" id="userEmail" placeholder="you@example.com" class="single-user-req" oninput="updateUserUsername()">
            </div>
            <div class="field">
              <label for="userUsername">Username</label>
              <input type="email" id="userUsername" placeholder="Auto-fills based on email" class="single-user-req">
            </div>
          </div>
          <div class="field">"""
    
    new_fields = """          <div class="row">
            <div class="field">
              <label for="userEmail">Email</label>
              <input type="email" id="userEmail" placeholder="you@example.com" class="single-user-req" oninput="updateUserUsername()">
            </div>
            <div class="field">
              <label for="userUsername">Username</label>
              <input type="email" id="userUsername" placeholder="Auto-fills based on email" class="single-user-req">
            </div>
          </div>
          <div class="row">
            <div class="field">
              <label for="userRole">Role (Optional)</label>
              <input type="text" id="userRole" placeholder="e.g. CEO">
            </div>
            <div class="field">
              <label for="userLicense">User License</label>
              <input type="text" id="userLicense" placeholder="e.g. Salesforce">
            </div>
          </div>
          <div class="field">
            <label for="userProfile">Profile</label>
            <input type="text" id="userProfile" placeholder="e.g. System Administrator">
          </div>
          <div class="field">"""
    content = content.replace(old_fields, new_fields)
    
    # 2. Update JS payload
    old_js = """    } else if (currentMode === 'user') {
      const singleData = {
        FirstName: document.getElementById('userFirstName').value,
        LastName: document.getElementById('userLastName').value,
        Email: document.getElementById('userEmail').value,
        Username: document.getElementById('userUsername').value,
        GeneratePassword: document.getElementById('userGenPassword').checked
      };
      payload.data = [singleData];"""
      
    new_js = """    } else if (currentMode === 'user') {
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
    content = content.replace(old_js, new_js)
    
    # 3. Update CSV template
    old_csv = """    } else if (type === 'user') {
      csvRows = [
        'FirstName,LastName,Email,Username,GeneratePassword',
        'John,Doe,john@example.com,john@example.com,true',
        'Jane,Smith,jane@example.com,jane@example.com.uat,false'
      ];"""
    
    new_csv = """    } else if (type === 'user') {
      csvRows = [
        'FirstName,LastName,Email,Username,GeneratePassword,Role,License,Profile',
        'John,Doe,john@example.com,john@example.com,true,CEO,Salesforce,System Administrator',
        'Jane,Smith,jane@example.com,jane@example.com.uat,false,,,Standard User'
      ];"""
    content = content.replace(old_csv, new_csv)
    
    old_info = """<code style="font-size:0.7rem; word-break:break-all;">FirstName,LastName,Email,Username,GeneratePassword</code>"""
    new_info = """<code style="font-size:0.7rem; word-break:break-all;">FirstName,LastName,Email,Username,GeneratePassword,Role,License,Profile</code>"""
    content = content.replace(old_info, new_info)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

patch_ui()
