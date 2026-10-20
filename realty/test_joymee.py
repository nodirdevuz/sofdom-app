import urllib.request, ssl, re, json

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

req = urllib.request.Request(
    "https://joymee.uz/ru/",
    headers={"User-Agent": "Mozilla/5.0"}
)
with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
    html = resp.read().decode("utf-8")
    scripts = re.findall(r'<script[^>]*src=[\'"](/_next/static/chunks/[^\'"]+)[\'"]', html)
    print(f"Total chunk scripts: {len(scripts)}")
    apis = set()
    for s in scripts:
        url = "https://joymee.uz" + s
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), context=ctx, timeout=5) as sresp:
                js = sresp.read().decode("utf-8", errors="ignore")
                for m in re.finditer(r'https?://[a-zA-Z0-9\.\-_/:]+/api/[a-zA-Z0-9\.\-_/:]+|/api/[a-zA-Z0-9\.\-_/:]+', js):
                    apis.add(m.group(0))
        except Exception as e:
            pass
    print("API endpoints:")
    for a in sorted(apis):
        print("  ", a)
