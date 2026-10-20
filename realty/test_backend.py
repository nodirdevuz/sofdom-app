#!/usr/bin/env python3
"""
test_backend.py
Comprehensive test suite for Realty Sniper FastAPI Backend.
Verifies:
 1. Phone number login (no SMS required)
 2. User profile and subscription retrieval
 3. Apartment listings with masked phone numbers
 4. Contact unlocking and daily quota enforcement
 5. Quota exhaustion and 403 error response
 6. Plan upgrade to 'sniper' (990 ₽)
 7. Second contact unlocking under new plan
 8. Favorite toggle and retrieval
 9. System statistics
"""

import sys
import os
import unittest
from fastapi.testclient import TestClient

# Add directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from main import app
import db

class TestRealtyBackend(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.test_phone = "+79998887766"
        with db.get_connection() as conn:
            conn.execute("DELETE FROM users WHERE phone = ?", (self.test_phone,))
            conn.commit()

    def test_full_user_and_monetization_flow(self):
        print("\n--- 1. Testing Phone Login (No SMS) ---")
        login_res = self.client.post("/api/auth/login", json={"phone": self.test_phone, "name": "Тестовый Арендатор"})
        self.assertEqual(login_res.status_code, 200)
        data = login_res.json()
        self.assertTrue(data["success"])
        token = data["token"]
        self.assertIsNotNone(token)
        user_id = data["user"]["id"]
        print(f"[✓] Logged in successfully: User ID={user_id}, Token={token[:15]}...")

        headers = {"Authorization": f"Bearer {token}"}

        print("\n--- 2. Testing /api/auth/me Profile & Initial Quota ---")
        me_res = self.client.get("/api/auth/me", headers=headers)
        self.assertEqual(me_res.status_code, 200)
        me_data = me_res.json()
        sub = me_data["subscription"]
        self.assertEqual(sub["plan_code"], "free_trial")
        self.assertEqual(sub["daily_limit"], 1)
        self.assertEqual(sub["remaining_today"], 1)
        print(f"[✓] Free trial active: limit={sub['daily_limit']}, remaining={sub['remaining_today']}")

        print("\n--- 3. Testing /api/apartments Phone Masking ---")
        apts_res = self.client.get("/api/apartments?city=Томск&limit=5", headers=headers)
        self.assertEqual(apts_res.status_code, 200)
        apts = apts_res.json()["apartments"]
        self.assertGreater(len(apts), 0)
        
        first_apt = apts[0]
        second_apt = apts[1]
        self.assertTrue(first_apt["is_locked"])
        self.assertIn("•••", first_apt["phone_display"])
        self.assertIsNone(first_apt.get("phone"))
        print(f"[✓] First apartment '{first_apt['title']}' is locked. Display: {first_apt['phone_display']}")

        print("\n--- 4. Testing First Contact Unlock (Free Trial Quota) ---")
        unlock1_res = self.client.post(f"/api/apartments/{first_apt['id']}/unlock", headers=headers)
        self.assertEqual(unlock1_res.status_code, 200)
        u1_data = unlock1_res.json()
        self.assertTrue(u1_data["success"])
        self.assertIsNotNone(u1_data["phone"])
        self.assertEqual(u1_data["remaining_today"], 0)
        print(f"[✓] Unlocked successfully! Real phone: {u1_data['phone']}. Remaining today: {u1_data['remaining_today']}")

        # Verify listing now returns unmasked phone for this user
        detail_res = self.client.get(f"/api/apartments/{first_apt['id']}", headers=headers)
        self.assertFalse(detail_res.json()["is_locked"])
        self.assertEqual(detail_res.json()["phone_display"], u1_data["phone"])
        print(f"[✓] Detail page now shows real phone: {detail_res.json()['phone_display']}")

        print("\n--- 5. Testing Quota Exhaustion (403 Expected) ---")
        unlock2_res = self.client.post(f"/api/apartments/{second_apt['id']}/unlock", headers=headers)
        self.assertEqual(unlock2_res.status_code, 403)
        err = unlock2_res.json()["detail"]
        self.assertEqual(err["error"], "QUOTA_EXCEEDED")
        print(f"[✓] Correctly blocked second unlock: {err['message']}")

        print("\n--- 6. Testing Subscription Upgrade to 'sniper' (990 ₽) ---")
        upg_res = self.client.post("/api/subscriptions/upgrade", headers=headers, json={"plan_code": "sniper"})
        self.assertEqual(upg_res.status_code, 200)
        upg_data = upg_res.json()
        new_sub = upg_data["subscription"]
        self.assertEqual(new_sub["plan_code"], "sniper")
        self.assertEqual(new_sub["daily_limit"], 15)
        self.assertEqual(new_sub["remaining_today"], 14)  # 1 was used earlier today
        print(f"[✓] Upgraded to «{new_sub['plan_name']}»! New remaining today: {new_sub['remaining_today']}")

        print("\n--- 7. Testing Second Unlock Under 'sniper' Plan ---")
        unlock2_success = self.client.post(f"/api/apartments/{second_apt['id']}/unlock", headers=headers)
        self.assertEqual(unlock2_success.status_code, 200)
        u2_data = unlock2_success.json()
        self.assertTrue(u2_data["success"])
        self.assertEqual(u2_data["remaining_today"], 13)
        print(f"[✓] Second apartment unlocked! Real phone: {u2_data['phone']}. Remaining today: {u2_data['remaining_today']}")

        print("\n--- 8. Testing Favorites Toggle & Listing ---")
        fav_toggle = self.client.post(f"/api/apartments/{first_apt['id']}/favorite", headers=headers)
        self.assertTrue(fav_toggle.json()["is_favorite"])
        fav_list = self.client.get("/api/favorites", headers=headers)
        self.assertEqual(len(fav_list.json()["favorites"]), 1)
        self.assertEqual(fav_list.json()["favorites"][0]["id"], first_apt["id"])
        print(f"[✓] Favorites working: 1 saved apartment in list.")

        print("\n--- 9. Testing System Stats ---")
        stats_res = self.client.get("/api/stats")
        self.assertEqual(stats_res.status_code, 200)
        st = stats_res.json()
        self.assertEqual(st["city"], "Томск")
        self.assertGreater(st["total_apartments"], 50)
        print(f"[✓] System stats verified: Total={st['total_apartments']}, Secret={st['secret_early_access_count']}, Users={st['total_users']}")

if __name__ == "__main__":
    unittest.main()
