#!/usr/bin/env python3
"""
migrate_photos_table.py — create and backfill the normalised `photos` table.

Each photo gets its own stable id and a hard foreign-key link to exactly one
apartment, so a photo can never belong to the wrong listing. Idempotent: safe
to run repeatedly. Prints a verification report and exits non-zero if integrity
checks fail.

Usage:
    python3 migrate_photos_table.py [path/to/realty.db]
"""
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import db as dbmod


def main() -> int:
    db_path = sys.argv[1] if len(sys.argv) > 1 else dbmod.DB_PATH
    print(f"[photos-migration] target DB: {db_path}")

    summary = dbmod.backfill_photos(db_path)
    print(f"[photos-migration] apartments processed: {summary['apartments']}")
    print(f"[photos-migration] photos linked:        {summary['photos_linked']}")

    report = dbmod.check_photo_integrity(db_path)
    print(f"[photos-migration] integrity: {report}")

    if not report["ok"]:
        print("[photos-migration] FAILED: integrity problems found")
        return 1
    print("[photos-migration] OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
