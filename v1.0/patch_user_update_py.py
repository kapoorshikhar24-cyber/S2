import sys

def patch_backend():
    path = r"c:\Users\Shikhar Kapoor\Downloads\Programs\Salesforce\v1.0\salesforce_playwright.py"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    old_logic = """    if task_type == "user":"""
    
    new_logic = """    if task_type == "update_user_status":
        for idx, config in enumerate(fields):
            username = config.get("Username", config.get("username", ""))
            is_active = config.get("IsActive", config.get("isActive", config.get("Active", True)))
            if isinstance(is_active, str):
                is_active = is_active.lower() in ['true', 'yes', '1', 'on', 'active']
                
            print(f"Updating User Status {idx+1}/{len(fields)}: {username} -> Active: {is_active}")
            
            # Navigate to Setup Search
            search_url = f"{instance_url}/lightning/setup/ManageUsers/page?address=%2Fsetup%2Fown%2Fentityresc.jsp%3FtxtSearch%3D{username}%26searchBtn%3DGo%21"
            page.goto(search_url)
            page.wait_for_timeout(3000)
            
            target_frame = get_frame_with_element("a:has-text('Edit')", timeout_sec=15)
            if not target_frame:
                print(f"Warning: Could not find search results or 'Edit' link for {username}")
                continue
                
            target_frame.locator("a:has-text('Edit')").first.click()
            page.wait_for_timeout(3000)
            
            edit_frame = get_frame_with_element("input[name*='isactive'], input[id*='isactive'], input[name='isactive']", timeout_sec=15)
            if not edit_frame:
                print(f"Warning: Could not find User Edit form for {username}")
                continue
                
            active_checkbox = edit_frame.locator("input[type='checkbox'][name*='isactive'], input[type='checkbox'][id*='isactive']").first
            if active_checkbox.count() > 0:
                if is_active:
                    active_checkbox.check(force=True)
                else:
                    active_checkbox.uncheck(force=True)
            
            print(f"Saving updated status for {username}...")
            edit_frame.locator("input[title='Save'], input[value*='Save']").first.click()
            page.wait_for_timeout(3000)
            
            try:
                error_loc = edit_frame.locator("div.errorMsg, div.pbError")
                if error_loc.count() > 0 and error_loc.first.is_visible():
                    error_text = error_loc.first.inner_text().strip()
                    print(f"Warning: Could not save user status due to error: {error_text}")
            except Exception:
                pass
                    
            try:
                record = {
                    "timestamp": datetime.datetime.now().isoformat(),
                    "project_name": payload.get("project_name", "Default"),
                    "objectName": "User Status",
                    "dataType": "User Update",
                    "fieldLabel": f"Active: {is_active}",
                    "fieldName": username
                }
                history_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'history.json')
                history = []
                if os.path.exists(history_file):
                    with open(history_file, 'r', encoding='utf-8') as f:
                        try: history = json.load(f)
                        except: pass
                history.append(record)
                with open(history_file, 'w', encoding='utf-8') as f:
                    json.dump(history, f, indent=2)
            except:
                pass

    elif task_type == "user":"""
    
    content = content.replace(old_logic, new_logic)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

patch_backend()
