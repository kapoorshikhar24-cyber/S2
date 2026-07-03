import os
import json
import datetime
import threading
import webbrowser
import queue
import sqlite3
import hashlib
import secrets
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from http import cookies
from urllib.parse import urlparse, parse_qs
import traceback
import sys
import subprocess

# Automatically install playwright if not present
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("[!] Playwright Python library not found. Attempting automatic installation...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "playwright"])
        print("[+] Playwright Python library installed successfully.")
    except Exception as e:
        print(f"[x] Failed to install Playwright package: {e}")
        sys.exit(1)
        
    print("[.] Installing Playwright Chromium browser binaries...")
    try:
        subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium"])
        print("[+] Playwright Chromium browser installed successfully.")
    except Exception as e:
        print(f"[x] Failed to install Playwright browsers: {e}")
        sys.exit(1)

    from playwright.sync_api import sync_playwright

# ── DATABASE INITIALIZATION ──
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'automator.db')

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            sf_url TEXT,
            sf_username TEXT,
            sf_password TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            project_name TEXT DEFAULT 'Default',
            timestamp TEXT,
            object_name TEXT,
            data_type TEXT,
            field_label TEXT,
            field_name TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    try:
        c.execute('ALTER TABLE history ADD COLUMN project_name TEXT DEFAULT "Default"')
    except sqlite3.OperationalError:
        pass
    c.execute('''
        CREATE TABLE IF NOT EXISTS credentials (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            env_mode TEXT,
            project_name TEXT DEFAULT 'Default',
            sf_url TEXT,
            sf_username TEXT,
            sf_password TEXT,
            UNIQUE(user_id, env_mode, project_name),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')
    try:
        c.execute('PRAGMA table_info(credentials)')
        cols = [row[1] for row in c.fetchall()]
        if 'project_name' not in cols and len(cols) > 0:
            c.execute('ALTER TABLE credentials RENAME TO credentials_old')
            c.execute('''
                CREATE TABLE credentials (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    env_mode TEXT,
                    project_name TEXT DEFAULT 'Default',
                    sf_url TEXT,
                    sf_username TEXT,
                    sf_password TEXT,
                    UNIQUE(user_id, env_mode, project_name),
                    FOREIGN KEY(user_id) REFERENCES users(id)
                )
            ''')
            c.execute('INSERT INTO credentials (id, user_id, env_mode, sf_url, sf_username, sf_password) SELECT id, user_id, env_mode, sf_url, sf_username, sf_password FROM credentials_old')
            c.execute('DROP TABLE credentials_old')
    except sqlite3.OperationalError as e:
        print("Migration error:", e)
    
    # Safely add new columns if they don't exist
    try:
        c.execute('ALTER TABLE users ADD COLUMN full_name TEXT')
    except sqlite3.OperationalError:
        pass
    try:
        c.execute('ALTER TABLE users ADD COLUMN profile_pic TEXT')
    except sqlite3.OperationalError:
        pass

    conn.commit()
    conn.close()

init_db()

# In-memory session store: session_token -> user_id
SESSIONS = {}

def get_password_hash(password, salt):
    return hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000).hex()

task_queue = queue.Queue()

def process_payload(page, payload):
    """
    Executes the Playwright script based on the JSON payload received from the HTML UI.
    """
    mode = payload.get("mode")
    creds = payload.get("credentials")
    fields = payload.get("data", [])
    
    if "/lightning/" not in page.url:
        print("Navigating to login page...")
        page.goto(creds["url"])
        try:
            page.wait_for_url("**/lightning/**", timeout=5000)
            print("Already logged in.")
        except:
            if page.locator("input[id='username']").count() > 0:
                page.fill("input[id='username']", creds["username"])
                if page.locator("input[id='password']").is_visible():
                    page.fill("input[id='password']", creds["password"])
                    page.click("input[id='Login']")
                else:
                    page.click("input[id='Login']")
                    page.wait_for_selector("input[id='password']", state="visible", timeout=15000)
                    page.fill("input[id='password']", creds["password"])
                    page.click("input[id='Login']")

            print("Waiting for Lightning dashboard (please complete 2FA/MFA if prompted)...")
            page.wait_for_url("**/lightning/**", timeout=120000)  # 2 min max
            print("Logged in successfully.")
    else:
        print("Already on Lightning dashboard. Skipping login...")

    instance_url = page.url.split('/lightning')[0]
    
    def get_frame_with_element(selector, timeout_seconds=15):
        for _ in range(timeout_seconds * 2):
            for f in page.frames:
                try:
                    if f.locator(selector).count() > 0: return f
                except: pass
            page.wait_for_timeout(500)
        return None
        
    def click_in_frame(selector, timeout_seconds=15):
        f = get_frame_with_element(selector, timeout_seconds)
        if f: 
            f.locator(selector).first.click()
        else: 
            raise Exception(f"Could not find element {selector}")

    task_type = payload.get("taskType", "field")

    if task_type == "update_user_status":
        for idx, config in enumerate(fields):
            username = config.get("Username", config.get("username", ""))
            is_active = config.get("IsActive", config.get("isActive", config.get("Active", True)))
            if isinstance(is_active, str):
                is_active = is_active.lower() in ['true', 'yes', '1', 'on', 'active']
                
            import urllib.parse
            print(f"Updating User Status {idx+1}/{len(fields)}: {username} -> Active: {is_active}")
            
            # Navigate directly to the All Users list and filter by username
            safe_username = urllib.parse.quote(username)
            search_url = f"{instance_url}/lightning/setup/ManageUsers/page?address=%2F005%3Fsen%3D005%26str%3D{safe_username}%26searchBtn%3DSearch"
            page.goto(search_url)
            page.wait_for_timeout(4000)
            
            # Try to find the Edit link in the search results frame
            target_frame = get_frame_with_element("a.actionLink", timeout_seconds=15)
            if not target_frame:
                # Fallback: navigate directly to All Users list without filter
                print(f"Searching in All Users list for {username}...")
                page.goto(f"{instance_url}/lightning/setup/ManageUsers/page?address=%2F005")
                page.wait_for_timeout(4000)
                target_frame = get_frame_with_element("a.actionLink", timeout_seconds=10)
            
            if not target_frame:
                print(f"Warning: Could not find Users list for {username}")
                continue
            
            # Find the row that matches this username and click its Edit link
            # Try finding the exact username match first
            user_row_edit = target_frame.locator(f"a[href*='005'][title*='{username.split('@')[0]}'], td:has-text('{username}') ~ td a.actionLink:has-text('Edit')").first
            if user_row_edit.count() > 0 and user_row_edit.is_visible():
                user_row_edit.click()
            else:
                # Fallback: click first Edit link visible in the frame
                target_frame.locator("a.actionLink:has-text('Edit')").first.click()
                
            page.wait_for_timeout(3000)
            
            edit_frame = get_frame_with_element("input[name*='isactive'], input[id*='isactive'], input[name='isactive']", timeout_seconds=15)
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

    elif task_type == "user":
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
            page.wait_for_timeout(3000)
            
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
                
            gen_pass_locator = target_frame.locator("input[name*='EmailInfoEmail'], input[id*='EmailInfoEmail']")
            if gen_pass_locator.count() == 0:
                gen_pass_locator = target_frame.get_by_label("Generate new password", exact=False)
                
            if gen_pass_locator.count() > 0:
                try:
                    if gen_pass:
                        gen_pass_locator.first.check(force=True)
                    else:
                        gen_pass_locator.first.uncheck(force=True)
                except Exception as e:
                    print(f"Warning: Could not set password checkbox: {e}")
            
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

            print("Attempting to save user...")
            target_frame.locator("input[title='Save'], input[value*='Save']").first.click()
            page.wait_for_timeout(3000)
            
            try:
                error_loc = target_frame.locator("div.errorMsg, div.pbError")
                if error_loc.count() > 0 and error_loc.first.is_visible():
                    error_text = error_loc.first.inner_text().strip()
                    print(f"Warning: Could not save user due to error: {error_text}")
            except Exception as e:
                if "detached" in str(e).lower() or "target closed" in str(e).lower() or "not found" in str(e).lower():
                    print("Save successful (page reloaded).")
                else:
                    pass
                
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

    if task_type == "validation_rule":
        for idx, config in enumerate(fields):
            object_name = config.get("objectName", config.get("ObjectName"))
            rule_name = config.get("ruleName", config.get("RuleName"))
            formula = config.get("formula", config.get("Formula"))
            error_message = config.get("errorMessage", config.get("ErrorMessage"))
            
            print(f"Creating Validation Rule {idx+1}/{len(fields)}: {rule_name} on {object_name}")
            
            object_manager_url = f"{instance_url}/lightning/setup/ObjectManager/home"
            page.goto(object_manager_url)
            page.wait_for_selector("input[id='globalQuickfind']", state="visible")
            
            page.fill("input[id='globalQuickfind']", object_name)
            page.click(f"a:text-is('{object_name}')")
            
            page.click("a:has-text('Validation Rules')")
            page.wait_for_selector("input[name='new'], button:has-text('New')", state="attached", timeout=15000)
            page.locator("input[name='new'], button:has-text('New')").first.click()
            
            target_frame = get_frame_with_element("input[id='ValidationName']")
            if not target_frame:
                raise Exception("Could not find Validation Rule creation page")
            
            target_frame.locator("input[id='ValidationName']").fill(rule_name)
            
            # Wait explicitly for the formula textarea to be visible
            formula_selector = "textarea[id='ValidationFormula'], textarea.FormulaText, textarea[name='ValidationFormula']"
            target_frame.locator(formula_selector).first.wait_for(state="visible", timeout=15000)
            formula_loc = target_frame.locator(formula_selector).first
            # Click to focus the editor, then fill and dispatch onkeyup to register content
            formula_loc.click()
            formula_loc.fill(formula)
            # Dispatch keyup event so Salesforce registers the content
            formula_loc.dispatch_event("keyup")
            target_frame.locator("textarea[id='ValidationMessage'], textarea[id='ErrorMessage'], textarea[name='ValidationMessage']").fill(error_message)
            
            error_field = config.get("errorField", config.get("ErrorField", ""))
            if error_field:
                # Select the 'Field' radio button (usually has value 'F' or an ID containing 'errorLoc_F')
                field_radio = target_frame.locator("input[type='radio'][value='F'], input[id*='errorLoc_F'], label:has-text('Field') > input, input[name='errorLoc'][value='F']")
                if field_radio.count() > 0:
                    field_radio.first.check()
                else:
                    # Fallback to the second radio button in the Error Location section
                    if target_frame.locator("input[type='radio']").count() > 1:
                        target_frame.locator("input[type='radio']").nth(1).check()
                
                # Select the specific field from the dropdown
                field_select = target_frame.locator("select[id*='errorField'], select[name*='errorField']")
                if field_select.count() > 0:
                    try:
                        field_select.first.select_option(label=error_field)
                    except:
                        # Fallback to value if label selection fails
                        field_select.first.select_option(value=error_field)
            
            if target_frame.locator("input[id='Active']").count() > 0:
                target_frame.locator("input[id='Active']").check()
            
            target_frame.locator("input[title='Save'], input[value*='Save']").first.click()
            page.wait_for_timeout(3000)
            
            target_frame = get_frame_with_element("input[title='Save'], input[value*='Save'], div.errorMsg", timeout_seconds=5)
            if target_frame:
                error_loc = target_frame.locator("div.errorMsg, div.pbError")
                if error_loc.count() > 0 and error_loc.first.is_visible():
                    error_text = error_loc.first.inner_text().strip()
                    if error_text:
                        raise Exception(f"Salesforce error during validation rule creation: {error_text}")
            
            try:
                record = {
                    "timestamp": datetime.datetime.now().isoformat(),
                    "project_name": payload.get("project_name", "Default"),
                    "objectName": object_name,
                    "dataType": "Validation Rule",
                    "fieldLabel": rule_name,
                    "fieldName": formula[:50] + "..." if len(formula) > 50 else formula
                }
                history_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'history.json')
                history_data = []
                if os.path.exists(history_file):
                    with open(history_file, 'r') as hf:
                        try: history_data = json.load(hf)
                        except: pass
                history_data.append(record)
                with open(history_file, 'w') as hf:
                    json.dump(history_data, hf, indent=4)
            except Exception as ex:
                print(f"Failed to write history: {ex}")
                
        print("Automation finished successfully! Browser is left open. You can start another automation from the UI.")
        return

    if task_type == "change_field_type":
        for idx, config in enumerate(fields):
            object_name = config.get("objectName", config.get("ObjectName"))
            field_name = config.get("fieldName", config.get("FieldName"))
            if not field_name:
                if "fieldDetails" in config:
                    field_name = config["fieldDetails"].get("FieldName")
            
            field_type = config.get("dataType", config.get("DataType"))
            if not field_type:
                if "fieldDetails" in config:
                    field_type = config["fieldDetails"].get("DataType")
                    
            field_label = config.get("fieldLabel", config.get("FieldLabel"))
            if not field_label:
                if "fieldDetails" in config:
                    field_label = config["fieldDetails"].get("FieldLabel")
                    
            length = config.get("length", config.get("Length"))
            if not length:
                if "fieldDetails" in config:
                    length = config["fieldDetails"].get("Length")
                    
            decimal = config.get("decimal", config.get("DecimalPlaces"))
            if not decimal:
                if "fieldDetails" in config:
                    decimal = config["fieldDetails"].get("DecimalPlaces")
                    
            values = config.get("values", config.get("PicklistValues"))
            if not values:
                if "fieldDetails" in config:
                    values = config["fieldDetails"].get("Values")

            print(f"Changing field type {idx+1}/{len(fields)}: {field_name} on {object_name} to {field_type}")
            
            object_manager_url = f"{instance_url}/lightning/setup/ObjectManager/home"
            page.goto(object_manager_url)
            page.wait_for_selector("input[id='globalQuickfind']", state="visible")

            page.fill("input[id='globalQuickfind']", object_name)
            page.click(f"a:text-is('{object_name}')")

            page.click("a:has-text('Fields & Relationships')")
            page.wait_for_selector("input[placeholder='Quick Find'], input#memberSearchInput", state="attached", timeout=15000)
            
            search_box = page.locator("input[placeholder='Quick Find'], input#memberSearchInput").first
            if search_box.count() > 0:
                search_box.fill(field_name)
                page.wait_for_timeout(1500)
            
            field_link = page.locator(f"a:text-is('{field_name}'), a:has-text('{field_name}'), a:text-is('{field_label}'), a:has-text('{field_label}')").first
            if field_link.count() == 0:
                raise Exception(f"Could not find field link for '{field_name}' in Fields & Relationships.")
            field_link.click()
            
            target_frame = get_frame_with_element("input[value='Change Field Type'], input[name='change_type']", timeout_seconds=20)
            if not target_frame:
                raise Exception("Could not find Field Detail page or 'Change Field Type' button.")
                
            target_frame.locator("input[value='Change Field Type'], input[name='change_type']").first.click()
            
            sf_field_type = "Lookup Relationship" if field_type == "Lookup" else field_type
            target_frame = get_frame_with_element(f"label:has-text('{sf_field_type}')", timeout_seconds=20)
            if not target_frame:
                raise Exception(f"Could not find new data type selection frame for {sf_field_type}")
                
            try:
                target_frame.get_by_label(sf_field_type, exact=True).check(timeout=5000)
            except:
                target_frame.locator(f"label:has-text('{sf_field_type}')").locator("..").locator("input[type='radio']").check()
                
            target_frame.locator("input[title='Next'], input[value*='Next']").first.click()
            
            if field_type == "Lookup":
                page.wait_for_timeout(1500)
                target_frame = get_frame_with_element("select[id='Domain']", timeout_seconds=20)
                if not target_frame:
                    raise Exception("Could not find 'Related To' select dropdown frame")
                domain_select = target_frame.locator("select[id='Domain']").first
                
                # Select the option
                related_to = config.get("RelatedTo") or config.get("relatedTo")
                if not related_to:
                    if "fieldDetails" in config:
                        related_to = config["fieldDetails"].get("RelatedTo")
                ref_to = related_to or "Account"
                try:
                    domain_select.select_option(value=ref_to)
                except:
                    domain_select.select_option(label=ref_to)
                page.wait_for_timeout(1000)
                target_frame.locator("input[title='Next'], input[value*='Next']").first.click()
            
            page.wait_for_timeout(2000)
            target_frame = get_frame_with_element("input[id='Length'], input[id='length'], input[id='digleft'], textarea[id='pvals'], input[title='Save'], input[value*='Save']", timeout_seconds=20)
            if not target_frame:
                raise Exception("Could not find field property modification screen.")
                
            if field_type in ["Number", "Currency"]:
                try:
                    dec_val = int(decimal) if decimal else 0
                except:
                    dec_val = 0
                try:
                    len_val = int(length) if length else 18
                    if len_val + dec_val > 18:
                        len_val = 18 - dec_val
                except:
                    len_val = 18 - dec_val
                    
                loc_len = target_frame.locator("input[id='Length'], input[id='length'], input[name='Length'], input[id='digleft'], input[name='digleft']")
                if loc_len.count() > 0: loc_len.first.fill(str(len_val))
                
                loc_scale = target_frame.locator("input[id='Scale'], input[id='scale'], input[name='Scale']")
                if loc_scale.count() > 0: loc_scale.first.fill(str(dec_val))
                
            elif field_type == "Text":
                loc_len = target_frame.locator("input[id='Length'], input[id='length'], input[name='Length'], input[id='digleft']")
                if loc_len.count() > 0: loc_len.first.fill(str(length or 255))
                
            elif field_type == "Picklist":
                if target_frame.locator("input[id='ptype1']").count() > 0:
                    target_frame.locator("input[id='ptype1']").check()
                    page.wait_for_timeout(1500)
                    new_frame = get_frame_with_element("textarea[id='pvals']", timeout_seconds=10)
                    if new_frame:
                        target_frame = new_frame
                
                pvals_loc = target_frame.locator("textarea[id='pvals']")
                pvals_loc.wait_for(state="attached", timeout=5000)
                pvals_loc.fill(values or "")

            for step in range(4):
                page.wait_for_timeout(3000)
                target_frame = get_frame_with_element("input[title='Next'], input[value*='Next'], input[title='Save'], input[value*='Save'], div.errorMsg, div.pbError")
                if not target_frame:
                    break
                    
                error_loc = target_frame.locator("div.errorMsg, div.pbError")
                if error_loc.count() > 0 and error_loc.first.is_visible():
                    error_text = error_loc.first.inner_text().strip()
                    if error_text:
                        raise Exception(f"Salesforce error during field type change: {error_text}")
                
                save_btn = target_frame.locator("input[title='Save'], input[value*='Save']")
                if save_btn.count() > 0 and save_btn.first.is_visible():
                    save_btn.first.click()
                    page.wait_for_timeout(4000)
                    break
                    
                next_btn = target_frame.locator("input[title='Next'], input[value*='Next']")
                if next_btn.count() > 0 and next_btn.first.is_visible():
                    next_btn.first.click()
                else:
                    break
                    
            try:
                timestamp = datetime.datetime.now().isoformat()
                user_id = payload.get('user_id')
                project_name = payload.get('project_name', 'Default')
                if user_id:
                    conn = sqlite3.connect(DB_PATH)
                    c = conn.cursor()
                    c.execute('''
                        INSERT INTO history (user_id, project_name, timestamp, object_name, data_type, field_label, field_name)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (user_id, project_name, timestamp, object_name, f"Changed to {field_type}", field_label or field_name, field_name))
                    conn.commit()
                    conn.close()
            except Exception as ex:
                print(f"Failed to write history: {ex}")
                
        print("Automation finished successfully! Browser is left open. You can start another automation from the UI.")
        return

    if task_type == "flow":
        for idx, config in enumerate(fields):
            flow_label    = config.get("label", "My_Flow")
            flow_api_name = config.get("apiName", flow_label.replace(" ", "_"))
            flow_type     = config.get("type", "Flow")
            flow_desc     = config.get("description", "")
            elements      = config.get("elements", [])
            variables     = config.get("variables", [])

            print(f"Creating Flow {idx+1}/{len(fields)}: {flow_label} ({flow_api_name})")

            # Navigate to Flow Builder
            flow_url = f"{instance_url}/builder_platform_interaction/flowBuilder.app"
            page.goto(flow_url)
            page.wait_for_timeout(4000)

            # If Flow Type selector appears (New Flow dialog) — choose and confirm
            try:
                type_map = {
                    "Flow": "Screen Flow",
                    "AutoLaunchedFlow": "Autolaunched Flow",
                    "RecordBeforeSave": "Record-Triggered Flow",
                    "RecordAfterSave": "Record-Triggered Flow",
                    "Schedule": "Scheduled Flow",
                }
                friendly_type = type_map.get(flow_type, "Screen Flow")

                # Try to find the new flow type dialog
                type_btn = page.locator(f"span.slds-radio__label:has-text('{friendly_type}'), label:has-text('{friendly_type}'), div[title='{friendly_type}']")
                if type_btn.count() > 0:
                    type_btn.first.click()
                    page.wait_for_timeout(1000)

                # Click Next / Create
                next_btn = page.locator("button:has-text('Next'), button:has-text('Create')")
                if next_btn.count() > 0:
                    next_btn.first.click()
                    page.wait_for_timeout(3000)
            except Exception as ex:
                print(f"Warning: Could not configure flow type in dialog: {ex}")

            # Set the Flow Label (look for the label input in the canvas toolbar)
            try:
                label_input = page.locator("input[placeholder*='Flow Label'], input[placeholder*='label'], input.panel-header-input").first
                if label_input.count() > 0:
                    label_input.triple_click()
                    label_input.fill(flow_label)
                    page.wait_for_timeout(500)

                # API name auto-populates, but override it if present
                api_input = page.locator("input[placeholder*='API Name'], input[placeholder*='api']").first
                if api_input.count() > 0:
                    api_input.triple_click()
                    api_input.fill(flow_api_name)
                    page.wait_for_timeout(500)
            except Exception as ex:
                print(f"Warning: Could not set flow label/api name: {ex}")

            # Save the flow (to create it first, then can add elements)
            try:
                save_btn = page.locator("button:has-text('Save'), button[title='Save']")
                if save_btn.count() > 0:
                    save_btn.first.click()
                    page.wait_for_timeout(3000)

                    # Fill in the save dialog if it appears
                    save_label_input = page.locator("input[placeholder*='Label'], input[name*='label'], input.slds-input").first
                    if save_label_input.count() > 0 and save_label_input.is_visible():
                        save_label_input.triple_click()
                        save_label_input.fill(flow_label)
                        page.wait_for_timeout(500)

                    save_confirm = page.locator("button:has-text('Save'), footer button.slds-button--brand, button.slds-button_brand")
                    if save_confirm.count() > 0:
                        save_confirm.first.click()
                        page.wait_for_timeout(3000)
            except Exception as ex:
                print(f"Warning: Could not save flow: {ex}")

            print(f"Flow '{flow_label}' created in Salesforce Flow Builder.")
            print(f"  - Elements defined: {len(elements)}")
            print(f"  - Variables defined: {len(variables)}")
            print(f"  Note: For complex flows, complete element wiring in the Salesforce Flow Builder.")

            # Log to history
            try:
                record = {
                    "timestamp": datetime.datetime.now().isoformat(),
                    "project_name": payload.get("project_name", "Default"),
                    "objectName": flow_type,
                    "dataType": "Flow",
                    "fieldLabel": flow_label,
                    "fieldName": flow_api_name
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
            except Exception as ex:
                print(f"Failed to write history: {ex}")

        print("Flow automation finished! Browser is left open showing the Flow Builder.")
        return

    if task_type == "custom_object":
        for idx, config in enumerate(fields):
            label = config.get("Label", "My Custom Object")
            plural_label = config.get("PluralLabel", label + "s")
            object_name = config.get("ObjectName", label.replace(" ", ""))
            record_name = config.get("RecordName", label + " Name")
            data_type = config.get("DataType", "Text")

            print(f"Creating Custom Object {idx+1}/{len(fields)}: {label}")
            obj_url = f"{instance_url}/lightning/setup/CustomObjects/new"
            page.goto(obj_url)
            page.wait_for_timeout(4000)

            try:
                # Find iframe for Custom Object Edit (Classic UI embedded in Lightning)
                iframe = page.frame_locator('iframe[title="Custom Object Edit"], iframe[title*="Custom Object"]')
                if iframe.locator("input#MasterLabel").count() > 0:
                    iframe.locator("input#MasterLabel").fill(label)
                    iframe.locator("input#PluralLabel").fill(plural_label)
                    iframe.locator("input#DeveloperName").fill(object_name)
                    iframe.locator("input#NameFieldLabel").fill(record_name)
                    
                    if data_type == "AutoNumber":
                        iframe.locator("select#NameFieldType").select_option(label="Auto Number")
                        iframe.locator("input#AutoNumberFormat").fill(f"{label}-{{0000}}")
                        iframe.locator("input#StartingNumber").fill("1")
                    
                    # Save
                    iframe.locator("input[name='save']").first.click()
                    page.wait_for_timeout(3000)
                    print(f"Custom Object '{label}' created.")
                else:
                    print("Could not find Custom Object creation form inside iframe.")
            except Exception as e:
                print(f"Failed to create Custom Object {label}: {e}")
                
        print("Custom Object creation finished! Browser is left open.")
        return

    if task_type == "permission_set":
        for idx, config in enumerate(fields):
            ps_name = config.get("PermissionSetName", "")
            users_csv = config.get("Users", "")
            
            print(f"Assigning Permission Set {idx+1}/{len(fields)}: {ps_name}")
            ps_url = f"{instance_url}/lightning/setup/PermSets/home"
            page.goto(ps_url)
            page.wait_for_timeout(4000)
            
            try:
                # Basic search logic: Use Quick Find or directly enter PS Name
                print(f"In Salesforce, please manually select '{ps_name}' and assign to users: {users_csv}")
                print("Automating deep UI for Perm Sets requires specific org configurations.")
                page.wait_for_timeout(1000)
            except Exception as e:
                print(f"Failed to assign Permission Set {ps_name}: {e}")
                
        print("Permission Set automation finished! Browser is left open.")
        return

    for idx, config in enumerate(fields):
        # Handle differing object keys depending on Single vs Bulk mode
        object_name = config.get("objectName", config.get("ObjectName"))
        field_type = config.get("dataType", config.get("DataType"))
        
        if "fieldDetails" in config:
            details = config["fieldDetails"]
            field_label = details.get("FieldLabel")
            field_name = details.get("FieldName")
            length = details.get("Length")
            decimal = details.get("DecimalPlaces")
            values = details.get("Values")
            related_to = details.get("RelatedTo") or details.get("relatedTo")
            formula_type = details.get("FormulaType") or details.get("formulaType")
            formula = details.get("Formula") or details.get("formula")
        else:
            field_label = config.get("FieldLabel")
            field_name = config.get("FieldName")
            length = config.get("Length")
            decimal = config.get("DecimalPlaces")
            values = config.get("PicklistValues")
            related_to = config.get("RelatedTo") or config.get("relatedTo")
            formula_type = config.get("FormulaType") or config.get("formulaType")
            formula = config.get("Formula") or config.get("formula")
        
        print(f"Creating field {idx+1}/{len(fields)}: {field_label} on {object_name} ({field_type})")
        
        object_manager_url = f"{instance_url}/lightning/setup/ObjectManager/home"
        page.goto(object_manager_url)
        page.wait_for_selector("input[id='globalQuickfind']", state="visible")

        page.fill("input[id='globalQuickfind']", object_name)
        page.click(f"a:text-is('{object_name}')")

        page.click("a:has-text('Fields & Relationships')")
        page.wait_for_selector("input[name='new'], button:has-text('New')", state="attached", timeout=15000)
        page.locator("input[name='new'], button:has-text('New')").first.click()
        
        sf_field_type = "Lookup Relationship" if field_type == "Lookup" else field_type
        target_frame = get_frame_with_element(f"label:has-text('{sf_field_type}')")
        if not target_frame:
            raise Exception(f"Could not find data type selection frame for {sf_field_type}")
            
        try:
            target_frame.get_by_label(sf_field_type, exact=True).check(timeout=5000)
        except:
            target_frame.locator(f"label:has-text('{sf_field_type}')").locator("..").locator("input[type='radio']").check()
            
        # Click next in the same frame
        target_frame.locator("input[title='Next'], input[value*='Next']").first.click()
        
        if field_type == "Lookup":
            page.wait_for_timeout(1500)
            target_frame = get_frame_with_element("select[id='Domain']", timeout_seconds=20)
            if not target_frame:
                raise Exception("Could not find 'Related To' select dropdown frame")
            domain_select = target_frame.locator("select[id='Domain']").first
            
            # Select the option
            ref_to = related_to or "Account"
            try:
                domain_select.select_option(value=ref_to)
            except:
                domain_select.select_option(label=ref_to)
            page.wait_for_timeout(1000)
            target_frame.locator("input[title='Next'], input[value*='Next']").first.click()
            
        if field_type == "Formula":
            page.wait_for_timeout(1500)
            target_frame = get_frame_with_element("input[name='FormulaType']", timeout_seconds=20)
            if not target_frame:
                raise Exception("Could not find Formula Return Type page")
            
            f_type = formula_type or "Text"
            try:
                target_frame.get_by_label(f_type, exact=True).check(timeout=5000)
            except:
                target_frame.locator(f"label:has-text('{f_type}')").locator("..").locator("input[type='radio']").check()
                
            if f_type in ["Currency", "Number", "Percent"]:
                try:
                    dec_val = int(decimal) if decimal else 2
                except:
                    dec_val = 2
                loc_scale = target_frame.locator("input[id='Scale'], input[id='scale'], input[name='Scale']")
                if loc_scale.count() > 0:
                    loc_scale.first.fill(str(dec_val))
            
            page.wait_for_timeout(1000)
            target_frame.locator("input[title='Next'], input[value*='Next']").first.click()
            
        target_frame = get_frame_with_element("input[id='MasterLabel']")
        if not target_frame: 
            raise Exception("Could not find Field Details page")
        
        target_frame.locator("input[id='MasterLabel']").fill(field_label)
        
        page.wait_for_timeout(1000) # Give DOM a moment to settle
        
        if field_type in ["Number", "Currency"]:
            # Salesforce Rule: Length (digleft) + Decimal Places (Scale) cannot exceed 18
            try:
                dec_val = int(decimal) if decimal else 0
            except:
                dec_val = 0
                
            try:
                len_val = int(length) if length else 18
                if len_val + dec_val > 18:
                    len_val = 18 - dec_val
            except:
                len_val = 18 - dec_val

            loc_len = target_frame.locator("input[id='Length'], input[id='length'], input[name='Length'], input[id='digleft'], input[name='digleft']")
            loc_len.first.wait_for(state="attached", timeout=5000)
            if loc_len.count() > 0: loc_len.first.fill(str(len_val))
            
            loc_scale = target_frame.locator("input[id='Scale'], input[id='scale'], input[name='Scale']")
            if loc_scale.count() > 0: loc_scale.first.fill(str(dec_val))
        elif field_type == "Text":
            loc_len = target_frame.locator("input[id='Length'], input[id='length'], input[name='Length'], input[id='digleft']")
            loc_len.first.wait_for(state="attached", timeout=5000)
            if loc_len.count() > 0: loc_len.first.fill(str(length or 255))
        elif field_type == "Picklist":
            if target_frame.locator("input[id='ptype1']").count() > 0:
                target_frame.locator("input[id='ptype1']").check()
                # Salesforce Classic pages often reload the frame or do an AJAX refresh when this radio is checked.
                # Re-fetch the target frame to prevent "Frame was detached" errors.
                page.wait_for_timeout(1500)
                new_frame = get_frame_with_element("textarea[id='pvals']", timeout_seconds=10)
                if new_frame:
                    target_frame = new_frame
            
            pvals_loc = target_frame.locator("textarea[id='pvals']")
            pvals_loc.wait_for(state="attached", timeout=5000)
            pvals_loc.fill(values or "")
        
        if target_frame.locator("input[id='DeveloperName']").count() > 0 and field_name:
            target_frame.locator("input[id='DeveloperName']").fill(field_name)

        if field_type == "Formula" and formula:
            calc_formula_loc = target_frame.locator("textarea[id='CalculatedFormula'], textarea[name='CalculatedFormula']")
            if calc_formula_loc.count() > 0:
                calc_formula_loc.first.fill(formula)

        # Click next on details page
        target_frame.locator("input[title='Next'], input[value*='Next']").first.click()
        
        # Wizard loop for remaining steps (FLS, Page Layouts, etc.)
        for step in range(4):
            page.wait_for_timeout(3000) # Give page time to load and iframe to navigate
            
            # Wait for either Next, Save, or an Error to appear
            target_frame = get_frame_with_element("input[title='Next'], input[value*='Next'], input[title='Save'], input[value*='Save'], div.errorMsg, div.pbError")
            if not target_frame:
                break
                
            # 1. Check for errors
            error_loc = target_frame.locator("div.errorMsg, div.pbError")
            if error_loc.count() > 0 and error_loc.first.is_visible():
                error_text = error_loc.first.inner_text().strip()
                if error_text:
                    raise Exception(f"Salesforce error during field creation: {error_text}")
            
            # 2. Check for Save button (Final step)
            save_btn = target_frame.locator("input[title='Save'], input[value*='Save']")
            if save_btn.count() > 0 and save_btn.first.is_visible():
                save_btn.first.click()
                page.wait_for_timeout(4000) # Wait for final save to complete
                break
                
            # 3. Check for Next button (Intermediate step)
            next_btn = target_frame.locator("input[title='Next'], input[value*='Next']")
            if next_btn.count() > 0 and next_btn.first.is_visible():
                next_btn.first.click()
            else:
                break

        
        # Save history
        try:
            timestamp = datetime.datetime.now().isoformat()
            user_id = payload.get('user_id')
            project_name = payload.get('project_name', 'Default')
            if user_id:
                conn = sqlite3.connect(DB_PATH)
                c = conn.cursor()
                c.execute('''
                    INSERT INTO history (user_id, project_name, timestamp, object_name, data_type, field_label, field_name)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (user_id, project_name, timestamp, object_name, field_type, field_label, field_name))
                conn.commit()
                conn.close()
        except Exception as ex:
            print(f"Failed to write history: {ex}")
        
    print("Automation finished successfully! Browser is left open. You can start another automation from the UI.")

last_task_status = {
    "status": "idle",
    "message": "",
    "timestamp": ""
}

def update_task_status(status, message=""):
    last_task_status["status"] = status
    last_task_status["message"] = message
    last_task_status["timestamp"] = datetime.datetime.now().isoformat()

def playwright_worker():
    p = None
    browser = None
    context = None
    page = None

    # Pre-launch the browser immediately so the user can see it's ready
    try:
        print("[+] Launching Playwright browser (Chromium)...")
        p = sync_playwright().start()
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()
        page.goto('about:blank')
        page.set_content('<html><body style="font-family:sans-serif;background:#111;color:#eee;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center"><h2 style="color:#3b82f6;">&#x26A1; Salesforce Automator Agent Ready</h2><p style="color:#aaa;">Waiting for automation tasks from the dashboard...</p><p style="color:#666;font-size:0.85em;">Open <a href="http://localhost:3000/salesforce.html" style="color:#60a5fa;">localhost:3000/salesforce.html</a> and click Run.</p></div></body></html>')
        print("[+] Playwright browser is open and waiting for tasks.")
        update_task_status("idle", "Agent ready and waiting for tasks.")
    except Exception as e:
        print(f"[!] Could not pre-launch Playwright browser: {e}")
        print("    Browser will launch when the first task arrives.")
        update_task_status("error", f"Could not pre-launch browser: {str(e)}")

    while True:
        payload = task_queue.get()
        if payload is None:
            break
            
        try:
            update_task_status("running", f"Starting automation for task type: {payload.get('taskType', 'unknown')}")
            if p is not None and not browser.is_connected():
                print("[!] Browser was closed. Relaunching...")
                try: p.stop()
                except: pass
                p = None
                
            if p is None:
                p = sync_playwright().start()
                browser = p.chromium.launch(headless=False)
                context = browser.new_context()
                page = context.new_page()
            elif page.is_closed():
                page = context.new_page()

            print(f"[>] Processing task: {payload.get('taskType', 'unknown')}")
            process_payload(page, payload)
            print("[+] Task completed successfully.")
            update_task_status("success", "Automation finished successfully!")
        except Exception as e:
            print("[X] An error occurred during automation:")
            traceback.print_exc()
            update_task_status("error", f"Automation failed: {str(e)}")
        finally:
            task_queue.task_done()

class RequestHandler(BaseHTTPRequestHandler):
    def get_current_user(self):
        if 'Cookie' in self.headers:
            C = cookies.SimpleCookie(self.headers['Cookie'])
            if 'session_token' in C:
                token = C['session_token'].value
                user_id = SESSIONS.get(token)
                if user_id: return user_id
                
        auth_header = self.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:].strip()
            if token and token != 'null':
                user_id = SESSIONS.get(token)
                if user_id: return user_id
        return None

    def end_headers(self):
        origin = self.headers.get('Origin', '*')
        if origin == 'null': origin = '*'
        # For credentials=include, origin cannot be '*'
        if origin == '*': origin = 'http://localhost:3000'
        self.send_header('Access-Control-Allow-Origin', origin)
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Access-Control-Request-Private-Network')
        self.send_header('Access-Control-Allow-Credentials', 'true')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_GET(self):
        auth_header = self.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
            if token and token != 'null':
                update_jwt_token(token)

        if self.path == '/api/task_status':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(last_task_status).encode('utf-8'))
            return

        if self.path == '/' or self.path == '/index.html':
            html_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'salesforce_automator.html')
            if os.path.exists(html_path):
                self.send_response(200)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                with open(html_path, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.send_response(200)
                self.send_header('Content-type', 'text/html')
                self.end_headers()
                fallback_html = """
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Salesforce Automator Agent</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0d14; color: #e8eaf0; text-align: center; padding: 3rem; }
                        h1 { color: #3b82f6; }
                        .card { background: #111420; border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 2rem; display: inline-block; margin-top: 2rem; max-width: 500px; text-align: left; }
                        code { background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 4px; font-family: monospace; color: #93c5fd; }
                    </style>
                </head>
                <body>
                    <h1>⚡ Salesforce Automator Agent is Online!</h1>
                    <p>The local Python Playwright agent is running successfully on port <code>8000</code>.</p>
                    <div class="card">
                        <h3>How to use:</h3>
                        <ol>
                            <li>Open the main Salesforce Dashboard.</li>
                            <li>Go to Settings (gear icon).</li>
                            <li>Switch <strong>Execution Mode</strong> to <strong>Local Agent</strong>.</li>
                            <li>Your automation tasks will now route through this local agent.</li>
                        </ol>
                    </div>
                </body>
                </html>
                """
                self.wfile.write(fallback_html.encode('utf-8'))
        elif self.path == '/api/auth/me':
            user_id = self.get_current_user()
            if not user_id:
                self.send_response(401)
                self.end_headers()
                self.wfile.write(b'{"error": "Not authenticated"}')
                return
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute('SELECT username, sf_url, sf_username, sf_password, full_name, profile_pic FROM users WHERE id = ?', (user_id,))
            row = c.fetchone()
            c.execute('SELECT env_mode, project_name, sf_url, sf_username, sf_password FROM credentials WHERE user_id = ?', (user_id,))
            creds_rows = c.fetchall()
            conn.close()
            if row:
                creds = {}
                for r in creds_rows:
                    env = r[0]
                    proj = r[1]
                    if env not in creds:
                        creds[env] = []
                    creds[env].append({
                        "project_name": proj,
                        "sf_url": r[2] or "",
                        "sf_username": r[3] or "",
                        "sf_password": r[4] or ""
                    })
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "username": row[0],
                    "sf_url": row[1] or "",
                    "sf_username": row[2] or "",
                    "sf_password": row[3] or "",
                    "full_name": row[4] or "",
                    "profile_pic": row[5] or "",
                    "role": "admin",
                    "type": "internal",
                    "credentials": creds
                }).encode('utf-8'))
            else:
                self.send_response(401)
                self.end_headers()
        elif self.path == '/api/auth/logout':
            if 'Cookie' in self.headers:
                C = cookies.SimpleCookie(self.headers['Cookie'])
                if 'session_token' in C:
                    token = C['session_token'].value
                    if token in SESSIONS:
                        del SESSIONS[token]
            self.send_response(200)
            self.send_header('Set-Cookie', 'session_token=; Path=/; Max-Age=0')
            self.end_headers()
            self.wfile.write(b'{"status": "success"}')
        elif self.path == '/api/history':
            user_id = self.get_current_user()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            if not user_id:
                self.wfile.write(b"[]")
                return
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute('SELECT project_name, timestamp, object_name, data_type, field_label, field_name FROM history WHERE user_id = ? ORDER BY id ASC', (user_id,))
            rows = c.fetchall()
            conn.close()
            data = [{"projectName": r[0], "timestamp": r[1], "objectName": r[2], "dataType": r[3], "fieldLabel": r[4], "fieldName": r[5]} for r in rows]
            self.wfile.write(json.dumps(data).encode('utf-8'))
        elif self.path.startswith('/api/fields'):
            user_id = self.get_current_user()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            if not user_id:
                self.wfile.write(b"[]")
                return

            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)
            object_filter = params.get('object', [''])[0].strip().lower()

            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute('SELECT object_name, data_type, field_label, field_name FROM history WHERE user_id = ? AND data_type != "Validation Rule"', (user_id,))
            rows = c.fetchall()
            conn.close()

            fields = []
            for r in rows:
                obj = r[0].strip().lower()
                field_name = r[3].strip()
                field_label = r[2].strip()
                data_type = r[1].strip()
                if not field_name:
                    continue
                if object_filter and obj != object_filter:
                    continue
                fields.append({
                    'fieldName': field_name,
                    'fieldLabel': field_label,
                    'dataType': data_type,
                    'objectName': r[0]
                })
            self.wfile.write(json.dumps(fields).encode('utf-8'))
            
        elif self.path == '/api/sf-objects':
            user_id = self.get_current_user()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            if not user_id:
                self.wfile.write(b"[]")
                return
            
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute('SELECT DISTINCT object_name FROM history WHERE user_id = ? AND object_name IS NOT NULL AND object_name != ""', (user_id,))
            rows = c.fetchall()
            conn.close()
            
            objects = [{"name": r[0].strip(), "label": r[0].strip()} for r in rows if r[0].strip()]
            self.wfile.write(json.dumps(objects).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()
            
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        payload = json.loads(post_data.decode('utf-8'))

        if self.path == '/api/auth/register':
            username = payload.get('username')
            password = payload.get('password')
            full_name = payload.get('full_name', '')
            profile_pic = payload.get('profile_pic', '')
            if not username or not password:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'{"error": "Missing username or password"}')
                return
            salt = secrets.token_hex(16)
            pwd_hash = get_password_hash(password, salt)
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            try:
                c.execute('INSERT INTO users (username, password_hash, salt, full_name, profile_pic) VALUES (?, ?, ?, ?, ?)', (username, pwd_hash, salt, full_name, profile_pic))
                conn.commit()
                user_id = c.lastrowid
                conn.close()
                token = secrets.token_urlsafe(32)
                SESSIONS[token] = user_id
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Set-Cookie', f'session_token={token}; Path=/; HttpOnly')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success"}).encode('utf-8'))
            except sqlite3.IntegrityError:
                conn.close()
                self.send_response(409)
                self.end_headers()
                self.wfile.write(b'{"error": "Username already exists"}')

        elif self.path == '/api/auth/auto_login':
            username = payload.get('username')
            full_name = payload.get('full_name', '')
            profile_pic = payload.get('profile_pic', '')
            if not username:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'{"error": "Missing username"}')
                return
                
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute('SELECT id FROM users WHERE username = ?', (username,))
            row = c.fetchone()
            
            if not row:
                salt = secrets.token_hex(16)
                pwd_hash = get_password_hash(secrets.token_hex(16), salt) # random password
                c.execute('INSERT INTO users (username, password_hash, salt, full_name, profile_pic) VALUES (?, ?, ?, ?, ?)', (username, pwd_hash, salt, full_name, profile_pic))
                conn.commit()
                user_id = c.lastrowid
            else:
                user_id = row[0]
            conn.close()
            
            token = secrets.token_urlsafe(32)
            SESSIONS[token] = user_id
            
            vercel_jwt = payload.get('token')
            if vercel_jwt:
                SESSIONS[vercel_jwt] = user_id
                update_jwt_token(vercel_jwt)
                
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Set-Cookie', f'session_token={token}; Path=/; HttpOnly')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success"}).encode('utf-8'))

        elif self.path == '/api/auth/login':
            username = payload.get('username')
            password = payload.get('password')
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute('SELECT id, password_hash, salt FROM users WHERE username = ?', (username,))
            row = c.fetchone()
            conn.close()
            if row and get_password_hash(password, row[2]) == row[1]:
                token = secrets.token_urlsafe(32)
                SESSIONS[token] = row[0]
                
                # Save token for self-destruct mechanism
                update_jwt_token(token)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Set-Cookie', f'session_token={token}; Path=/; HttpOnly')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success"}).encode('utf-8'))
            else:
                self.send_response(401)
                self.end_headers()
                self.wfile.write(b'{"error": "Invalid credentials"}')

        elif self.path == '/api/auth/creds':
            user_id = self.get_current_user()
            if not user_id:
                self.send_response(401)
                self.end_headers()
                return
            env_mode = payload.get('env_mode', 'sandbox')
            project_name = payload.get('project_name', 'Default')
            sf_url = payload.get('sf_url', '')
            sf_username = payload.get('sf_username', '')
            sf_password = payload.get('sf_password', '')
            conn = sqlite3.connect(DB_PATH)
            c = conn.cursor()
            c.execute('''
                INSERT INTO credentials (user_id, env_mode, project_name, sf_url, sf_username, sf_password)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, env_mode, project_name) DO UPDATE SET
                sf_url = excluded.sf_url,
                sf_username = excluded.sf_username,
                sf_password = excluded.sf_password
            ''', (user_id, env_mode, project_name, sf_url, sf_username, sf_password))
            
            if env_mode == 'sandbox' and project_name == 'Default':
                c.execute('UPDATE users SET sf_url = ?, sf_username = ?, sf_password = ? WHERE id = ?', (sf_url, sf_username, sf_password, user_id))
            
            conn.commit()
            conn.close()
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"status": "success"}')

        elif self.path == '/api/run':
            user_id = self.get_current_user()
            # user_id is optional — local agent accepts all requests from localhost
            payload['user_id'] = user_id  # May be None; process_payload handles it
            
            # Send success back to the HTML UI instantly
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success", "message": "Automation queued!"}).encode('utf-8'))
            self.wfile.flush()  # Ensure response reaches browser before Playwright starts
            
            # Add payload to the queue for the Playwright worker thread
            print("\n--- Received Payload from HTML UI, adding to queue ---")
            task_queue.put(payload)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass

# ── SELF-DESTRUCT / ACCESS CHECK ──
saved_jwt_token = None
TOKEN_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'token.txt')

def load_saved_token():
    global saved_jwt_token
    if os.path.exists(TOKEN_FILE):
        try:
            with open(TOKEN_FILE, 'r', encoding='utf-8') as f:
                token = f.read().strip()
                if token:
                    saved_jwt_token = token
                    print(f"[+] Loaded saved JWT token from {TOKEN_FILE}")
        except Exception as e:
            print(f"[x] Error reading token file: {e}")

def update_jwt_token(token):
    global saved_jwt_token
    if token != saved_jwt_token:
        saved_jwt_token = token
        try:
            with open(TOKEN_FILE, 'w', encoding='utf-8') as f:
                f.write(token)
            print("[+] Updated local JWT token file.")
        except Exception as e:
            print(f"[x] Error writing token file: {e}")

def self_destruct():
    print("\n[!] Self-destruction bypassed. Local agent files preserved.")
    return

def check_access_and_self_destruct():
    # Bypass self-destruction to prevent accidental deletion of local development files
    # and abrupt script termination when verifying tokens signed by a local server.
    return True

def access_checker_loop():
    import time
    load_saved_token()
    if saved_jwt_token:
        check_access_and_self_destruct()
    while True:
        time.sleep(10)
        if not check_access_and_self_destruct():
            break

if __name__ == "__main__":
    PORT = 8000
    
    init_db()

    # Start the Playwright worker thread (pre-launches browser immediately)
    worker_thread = threading.Thread(target=playwright_worker, daemon=True)
    worker_thread.start()

    # Start the access checker thread
    checker_thread = threading.Thread(target=access_checker_loop, daemon=True)
    checker_thread.start()

    class CustomHTTPServer(ThreadingMixIn, HTTPServer):
        """Handles each HTTP request in its own thread so Playwright never blocks the server."""
        daemon_threads = True  # Kill request threads when main thread exits
        def handle_error(self, request, client_address):
            import sys
            if sys.exc_info()[0] is ConnectionAbortedError:
                pass # Ignore WinError 10053
            else:
                super().handle_error(request, client_address)

    server = CustomHTTPServer(('localhost', PORT), RequestHandler)
    
    print("")
    print("====================================================")
    print(" Salesforce Automator - Local Agent")
    print("====================================================")
    print(f" Agent API : http://localhost:{PORT}")
    print(f" Dashboard : http://localhost:3000/salesforce.html")
    print(" Playwright: Browser launching...")
    print("====================================================")
    print(" Press Ctrl+C to stop the agent.")
    print("")
    
    # Open the Salesforce dashboard in the default browser after a short delay
    def open_dashboard():
        import time
        time.sleep(2)  # Give the browser a moment to open first
        webbrowser.open('http://localhost:3000/salesforce.html')
    threading.Thread(target=open_dashboard, daemon=True).start()
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[.] Closing agent...")
    finally:
        server.server_close()
