#!/usr/bin/env python3
"""
ahead_of_time_harvester.py
Ahead-of-Time Phone Harvester & Real-Time Ingestion Engine for Realty Sniper (Tomsk).
Harvests listings, unmasks phone numbers upfront, deduplicates via Cross-Matcher,
and dispatches real-time Telegram alerts to subscribers before public indexing.
"""

import os
import sys
import time
import argparse
from datetime import datetime

# Setup paths
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import db
from scraper import RealtyScraper
from cross_matcher import find_duplicate_match
from bot import RealtyTelegramBot
from captcha_solver import AntiBotGuardian

class AheadOfTimeHarvester:
    def __init__(self):
        self.scraper = RealtyScraper()
        self.bot = RealtyTelegramBot()
        self.guardian = AntiBotGuardian()

    def harvest_round(self) -> dict:
        """Executes a single ahead-of-time harvest cycle across all sources."""
        t0 = time.time()
        print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 🚀 Launching Ahead-of-Time Phone Harvest (Томск)...")

        # 1. Collect fresh listings (page 1)
        cian_items = self.scraper.fetch_cian_tomsk(pages=1)
        avito_items = self.scraper.fetch_avito_tomsk()
        bezposr_items = self.scraper.fetch_bezposrednikov_tomsk(pages=1)

        total_collected = len(cian_items) + len(avito_items) + len(bezposr_items)
        print(f"  [+] Fresh candidates: Cian={len(cian_items)}, Avito={len(avito_items)}, БП={len(bezposr_items)}")

        new_saved = 0
        unmasked_phones = 0
        cross_matched = 0

        # 2. Process and unmask phones upfront
        for item in cian_items + avito_items + bezposr_items:
            item_id = str(item["id"])
            phone = item.get("phone", "")

            # If phone is placeholder on Bezposrednikov, try Cross-Matching first
            if "БезПосредников" in phone or not phone:
                match = find_duplicate_match(item)
                if match and match.get("phone") and "БезПосредников" not in match["phone"]:
                    item["phone"] = match["phone"]
                    item["owner_name"] = match.get("owner_name", item.get("owner_name", "Собственник"))
                    cross_matched += 1
                    unmasked_phones += 1
                else:
                    # Attempt donor unmasking if session exists
                    if item_id.startswith("bezposr_"):
                        try:
                            donor_res = self.scraper.unlock_bezposrednikov_phone(item_id)
                            if donor_res.get("success") and donor_res.get("phone"):
                                item["phone"] = donor_res["phone"]
                                item["owner_name"] = donor_res.get("owner_name", "Собственник")
                                unmasked_phones += 1
                        except Exception:
                            pass

            db.upsert_apartment(item)
            new_saved += 1

        # 3. Dispatch real-time Telegram alerts for newly discovered apartments
        alerts_sent = self.bot.dispatch_pending_alerts()

        elapsed = round(time.time() - t0, 2)
        print(f"[✓] Harvest round complete in {elapsed}s!")
        print(f"    Processed: {new_saved}, Cross-matched: {cross_matched}, Alerts sent: {alerts_sent}\n")

        return {
            "success": True,
            "elapsed_seconds": elapsed,
            "total_processed": new_saved,
            "cross_matched": cross_matched,
            "alerts_sent": alerts_sent
        }

    def run_daemon(self, interval_seconds: int = 60, max_iterations: int = None):
        """Runs the harvester daemon on schedule."""
        print(f"[*] Starting Ahead-of-Time Harvester Daemon (interval: {interval_seconds}s)...")
        iterations = 0
        while True:
            try:
                self.harvest_round()
                iterations += 1
                if max_iterations and iterations >= max_iterations:
                    break
                time.sleep(interval_seconds)
            except KeyboardInterrupt:
                print("\n[*] Harvester stopped by user.")
                break
            except Exception as e:
                print(f"[!] Harvester loop error: {e}")
                time.sleep(5)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Ahead-of-Time Harvester for Realty Sniper")
    parser.add_argument("--once", action="store_true", help="Run single harvest round and exit")
    parser.add_argument("--interval", type=int, default=60, help="Interval in seconds between harvest rounds")
    args = parser.parse_args()

    harvester = AheadOfTimeHarvester()
    if args.once:
        harvester.harvest_round()
    else:
        harvester.run_daemon(interval_seconds=args.interval, max_iterations=1)
