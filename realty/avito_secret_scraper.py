#!/usr/bin/env python3
"""
Avito Secret Apartment & PoW Bypass Scraper
Automated solver for Avito Firewall 439 + SSR JSON State Extractor.
"""
import sys, re, json, time, hashlib, base64, urllib.parse
from curl_cffi import requests

def solve_avito_pow(session, url, r1, headers):
    pow_challenge = session.cookies.get('pow_challenge') or r1.cookies.get('pow_challenge')
    if pow_challenge:
        pow_challenge = urllib.parse.unquote(pow_challenge)
    
    pow_get_url = 'https://www.avito.ru/web/3/firewallPow/get'
    r2 = session.post(
        pow_get_url,
        headers={**headers, 'Content-Type': 'application/json', 'Referer': url},
        json={'challenge': pow_challenge},
        impersonate='chrome120'
    )
    getData = r2.json()
    challenge_jwt = getData['success']['result']['challenge_jwt']
    
    payload_b64 = challenge_jwt.split('.')[1] + '=='
    payload = json.loads(base64.urlsafe_b64decode(payload_b64))
    pow_id, complexity = payload['id'], payload['compl']
    
    prefix = '0' * complexity
    nonce = 0
    while not hashlib.sha256(f'{pow_id}:{nonce}'.encode()).hexdigest().startswith(prefix):
        nonce += 1
    
    verify_url = 'https://www.avito.ru/web/3/firewallPow/verify'
    session.post(
        verify_url,
        headers={**headers, 'Content-Type': 'application/json', 'Referer': url},
        json={'challenge': challenge_jwt, 'nonce': nonce},
        impersonate='chrome120'
    )
    session.cookies.set('pow_solved', '1', domain='.avito.ru', path='/')

def fetch_avito_apartment(url):
    s = requests.Session()
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9',
    }
    r = s.get(url, headers=headers, impersonate='chrome120')
    if r.status_code == 439:
        solve_avito_pow(s, url, r, headers)
        r = s.get(url, headers=headers, impersonate='chrome120')
    
    if r.status_code != 200:
        raise Exception(f'Failed to fetch page: HTTP {r.status_code}')
        
    m = re.search(r'window\.__staticRouterHydrationData\s*=\s*JSON\.parse\((.*?)\);', r.text, re.DOTALL)
    if not m:
        raise Exception('window.__staticRouterHydrationData not found in HTML')
        
    inner_str = json.loads(m.group(1).strip())
    data = json.loads(inner_str)
    buyer_item = data['loaderData']['catalog-or-main-or-item']['buyerItem']
    return buyer_item

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else 'https://www.avito.ru/tomsk/kvartiry/kvartira-studiya_14_m_19_et._4326801484'
    print(f'Fetching {target}...')
    item = fetch_avito_apartment(target)
    print('Title:', item['item']['title'])
    print('Price:', item['item']['price'])
    print('Secret Modal:', item.get('ltrSecretItemModal', {}).get('packages', {}).get('packagesTitle'))
