#!/usr/bin/env python3
"""
test_bezposr_auth.py
Automated test script for BezPosrednikov.ru authentication and phone extraction.
"""

import os
import re
import time
from curl_cffi import requests

ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".bezposrednikov.env")

def load_credentials():
    creds = {}
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, "r") as f:
            for line in f:
                if "=" in line:
                    k, v = line.strip().split("=", 1)
                    creds[k] = v
    return creds

def login_bezposrednikov(session, phone, password):
    print("[*] Fetching login page to extract CSRF token and initial cookies...")
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9',
    }
    
    # 1. Open home page to get session and token
    r = session.get("https://tomsk.bezposrednikov.ru/", headers=headers, impersonate="chrome120", timeout=12)
    print(f"  [+] Main page status: {r.status_code}, cookies count: {len(session.cookies)}")
    
    # Find CSRF token (32-char hex name with value="1")
    tokens = re.findall(r'<input[^>]*type="hidden"[^>]*name="([a-f0-9]{32})"[^>]*value="1"', r.text)
    if not tokens:
        # Try fetching popup directly
        r_pop = session.get("https://tomsk.bezposrednikov.ru/auth/login?tmpl=component", headers=headers, impersonate="chrome120", timeout=12)
        tokens = re.findall(r'<input[^>]*type="hidden"[^>]*name="([a-f0-9]{32})"[^>]*value="1"', r_pop.text)
        
    csrf_token = tokens[0] if tokens else None
    print(f"  [+] CSRF token found: {csrf_token}")
    
    # 2. Submit login form
    clean_phone = phone.strip()
    payload = {
        "username": clean_phone,
        "password": password,
        "option": "com_auth",
        "task": "user.login",
        "return": "",
        "remember": "yes"
    }
    if csrf_token:
        payload[csrf_token] = "1"
        
    login_headers = headers.copy()
    login_headers["Origin"] = "https://tomsk.bezposrednikov.ru"
    login_headers["Referer"] = "https://tomsk.bezposrednikov.ru/"
    login_headers["Content-Type"] = "application/x-www-form-urlencoded"
    
    print("[*] Sending POST login request...")
    post_res = session.post("https://tomsk.bezposrednikov.ru/", data=payload, headers=login_headers, impersonate="chrome120", timeout=15)
    print(f"  [+] Login POST status: {post_res.status_code}")
    
    # Check if we are logged in
    # Profile link or logout link
    check_res = session.get("https://tomsk.bezposrednikov.ru/lichnyy-kabinet", headers=headers, impersonate="chrome120", timeout=12)
    is_logged_in = ("logout" in check_res.text.lower() or "вых" in check_res.text.lower() or "кабинет" in check_res.text.lower() and "Войти на сайт" not in check_res.text)
    print(f"[✓] Logged in successfully: {is_logged_in}")
    return is_logged_in

def test_fetch_contacts(session, sids):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': '*/*',
    }
    
    for sid in sids:
        print(f"\n--- Testing SID: {sid} ---")
        url = f"https://tomsk.bezposrednikov.ru/index.php?option=com_sobipro&task=contacts.details&tmpl=component&format=raw&method=xhr&sid={sid}&v={int(time.time()*1000)}"
        headers['Referer'] = f'https://tomsk.bezposrednikov.ru/component/sobipro/?task=entry.details&sid={sid}'
        res = session.get(url, headers=headers, impersonate='chrome120', timeout=10)
        print(f"Status: {res.status_code}, Length: {len(res.text)}")
        
        # Check what's inside
        phones = re.findall(r'href=[\'"]tel:([^\'"]+)[\'"]', res.text)
        names = re.findall(r'class=[\'"]entryContactsName[\'"][^>]*>([^<]+)<', res.text)
        time_to_show = re.search(r'class="timeToShow"[^>]*data-time="(\d+)"[^>]*>(.*?)</span>', res.text)
        
        if phones:
            print(f"🔥 SUCCESS! Phone numbers found: {phones}, Owner: {names}")
        elif time_to_show:
            print(f"⏳ Time to show active: {time_to_show.group(2)} (seconds: {time_to_show.group(1)})")
        elif "login-popup" in res.text:
            print("❌ Server asked for login again.")
        else:
            print("Preview of response:\n", res.text[:400])

if __name__ == '__main__':
    creds = load_credentials()
    phone = creds.get("BEZPOSR_PHONE")
    password = creds.get("BEZPOSR_PASSWORD")
    if not phone or not password:
        print("Missing credentials in .bezposrednikov.env")
        exit(1)
        
    s = requests.Session()
    logged = login_bezposrednikov(s, phone, password)
    
    # Test on recent Tomsk apartment IDs
    test_sids = ["199124", "199123", "199122", "199121", "199120", "195682", "180231"]
    test_fetch_contacts(s, test_sids)
