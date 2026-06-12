import sys

def patch_py():
    path = r"c:\Users\Shikhar Kapoor\Downloads\Programs\Salesforce\v1.0\salesforce_playwright.py"
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    new_block = """    if task_type == "user":
        for idx, config in enumerate(fields):
            first_name = config.get("FirstName", config.get("firstName", config.get("First Name", "")))
            last_name = config.get("LastName", config.get("lastName", config.get("Last Name", "")))
            email = config.get("Email", config.get("email", ""))
            username = config.get("Username", config.get("username", ""))
            gen_pass = config.get("GeneratePassword", config.get("generatePassword", False))
            
            if isinstance(gen_pass, str):
                gen_pass = gen_pass.lower() in ['true', 'yes', '1', 'on']
                
            print(f"Creating User {idx+1}/{len(fields)}: {first_name} {last_name} ({username})")
            
            user_url = f"{instance_url}/lightning/setup/ManageUsers/page?address=%2F005%2Fe"
            page.goto(user_url)
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(2000)
            
            target_frame = get_frame_with_element("input[name='name_lastName']")
            if not target_frame:
                raise Exception("Could not find User creation form")
                
            if first_name:
                target_frame.locator("input[name='name_firstName']").fill(first_name)
                
            target_frame.locator("input[name='name_lastName']").fill(last_name)
            
            if first_name:
                alias = (first_name[0] + last_name[:4]).lower()
            else:
                alias = last_name[:5].lower()
            alias = alias[:8]
            
            if target_frame.locator("input[name='Alias']").count() > 0:
                target_frame.locator("input[name='Alias']").fill(alias)
                
            target_frame.locator("input[name='Email']").fill(email)
            target_frame.locator("input[name='Username']").fill(username)
            
            nickname = email.split('@')[0][:40]
            if target_frame.locator("input[name='CommunityNickname']").count() > 0:
                target_frame.locator("input[name='CommunityNickname']").fill(nickname)
                
            gen_pass_locator = target_frame.locator("input[name='EmailInfoEmail'], input[id='EmailInfoEmail']")
            if gen_pass_locator.count() > 0:
                if gen_pass:
                    gen_pass_locator.check()
                else:
                    gen_pass_locator.uncheck()
            
            role_name = config.get("Role", config.get("role", ""))
            if role_name and target_frame.locator("select[name='role']").count() > 0:
                try:
                    target_frame.locator("select[name='role']").select_option(label=role_name)
                except:
                    pass
                
            license_name = config.get("License", config.get("UserLicense", config.get("license", "")))
            if license_name and target_frame.locator("select[name='user_license_id']").count() > 0:
                try:
                    target_frame.locator("select[name='user_license_id']").select_option(label=license_name)
                    page.wait_for_timeout(1000)
                except:
                    pass
                
            profile_name = config.get("Profile", config.get("profile", ""))
            if profile_name and target_frame.locator("select[name='Profile']").count() > 0:
                try:
                    target_frame.locator("select[name='Profile']").select_option(label=profile_name)
                except:
                    pass

            if len(fields) > 1 or profile_name:
                print("Attempting to save user...")
                target_frame.locator("input[title='Save'], input[value*='Save']").first.click()
                page.wait_for_timeout(3000)
                
                error_loc = target_frame.locator("div.errorMsg, div.pbError")
                if error_loc.count() > 0 and error_loc.first.is_visible():
                    error_text = error_loc.first.inner_text().strip()
                    print(f"Warning: Could not save user due to error: {error_text}")
                    if len(fields) > 1:
                        pass
            else:
                print("Fields filled! Please select License/Profile and click Save in the browser.")
                
            try:
                record = {
                    "timestamp": datetime.datetime.now().isoformat(),
                    "project_name": payload.get("project_name", "Default"),
                    "objectName": "User",
                    "dataType": "User Creation",
                    "fieldLabel": f"{first_name} {last_name}",
                    "fieldName": username
                }
                history_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'history.json')
                history_data = []
                import os, json, datetime
                if os.path.exists(history_file):
                    with open(history_file, 'r') as hf:
                        try: history_data = json.load(hf)
                        except: pass
                history_data.append(record)
                with open(history_file, 'w') as hf:
                    json.dump(history_data, hf, indent=4)
            except Exception as ex:
                pass
                
        print("Automation finished successfully! Browser is left open.")
        return

    if task_type == "validation_rule":"""
    
    content = content.replace('    if task_type == "validation_rule":', new_block)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

patch_py()
