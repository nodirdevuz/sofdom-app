#!/usr/bin/env python3
"""
pipeline_daemon.py
Autonomous Multi-Source Realty Sniper Pipeline (Tomsk).
Collects 100% direct-owner apartments from Avito & Cian,
cleans them through Anti-Broker filters, and publishes to database and live feed.
"""

import sys
import os
import json

from scraper import RealtyScraper
import db

def main():
    print("[*] Launching Realty Sniper Pipeline for Томск...")
    scraper = RealtyScraper()
    res = scraper.sync_all()
    
    # Export feed_live.json for external tools / legacy clients
    apartments = db.list_apartments(limit=100)
    feed_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "feed_live.json")
    with open(feed_path, "w", encoding="utf-8") as f:
        json.dump(apartments, f, ensure_ascii=False, indent=2)
    print(f"[✓] feed_live.json updated ({len(apartments)} items)")

if __name__ == '__main__':
    main()
