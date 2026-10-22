#!/usr/bin/env python3
"""Local, read-only Notion report watcher for macOS."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import plistlib
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlencode

if __package__:
    from . import notion_bridge
else:
    import notion_bridge

LABEL = "com.sofdom.notion-report-watcher"
POLL_INTERVAL_SECONDS = 480
STATE_DIR = Path.home() / "Library" / "Application Support" / "SofDom" / "NotionReportWatcher"
STATE_PATH = STATE_DIR / "state.json"
APP_DIR = STATE_DIR / "app"
DEPLOYED_SCRIPT_PATH = APP_DIR / "notion_report_watcher.py"
LOG_DIR = Path.home() / "Library" / "Logs" / "SofDom"
PLIST_PATH = Path.home() / "Library" / "LaunchAgents" / f"{LABEL}.plist"
REPORT_MARKERS = ("Отчёт исполнителя", "Отчет исполнителя")


def _notion_pages_with_status(status: str) -> list[dict[str, Any]]:
    pages: list[dict[str, Any]] = []
    start_cursor: str | None = None

    while True:
        payload: dict[str, Any] = {
            "filter": {
                "property": "Status",
                "status": {"equals": status},
            },
            "page_size": 100,
        }
        if start_cursor:
            payload["start_cursor"] = start_cursor

        result = notion_bridge._notion_request(
            f"databases/{notion_bridge.TASKS_DB_ID}/query",
            method="POST",
            data=payload,
        )
        pages.extend(result.get("results", []))
        if not result.get("has_more"):
            return pages
        start_cursor = result.get("next_cursor")
        if not start_cursor:
            raise RuntimeError("Notion returned has_more without a next_cursor")


def _page_title(page: dict[str, Any]) -> str:
    title = page.get("properties", {}).get("Name", {}).get("title", [])
    return "".join(part.get("plain_text", "") for part in title) or "Без названия"


def _page_report_hash(page_id: str) -> str | None:
    parts: list[str] = []
    found_report = False
    start_cursor: str | None = None

    while True:
        query = {"page_size": 100}
        if start_cursor:
            query["start_cursor"] = start_cursor
        result = notion_bridge._notion_request(
            f"blocks/{page_id}/children?{urlencode(query)}",
            method="GET",
        )
        for block in result.get("results", []):
            block_type = block.get("type", "")
            block_data = block.get(block_type, {})
            rich_text = block_data.get("rich_text", [])
            text = "".join(part.get("plain_text", "") for part in rich_text)

            if not found_report:
                if any(marker in text for marker in REPORT_MARKERS):
                    found_report = True
                continue

            parts.append(f"{block_type}:{text}")

        if not result.get("has_more"):
            break
        start_cursor = result.get("next_cursor")
        if not start_cursor:
            raise RuntimeError("Notion returned has_more without a next_cursor")

    if not found_report or not parts:
        return None
    return hashlib.sha256("\n".join(parts).encode("utf-8")).hexdigest()


def _load_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"initialized": False, "reports": {}}
    with path.open("r", encoding="utf-8") as state_file:
        state = json.load(state_file)
    if not isinstance(state, dict) or not isinstance(state.get("reports"), dict):
        raise ValueError(f"Invalid watcher state file: {path}")
    return state


def _save_state(path: Path, state: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(path.parent, 0o700)
    fd, temporary_path = tempfile.mkstemp(prefix=".state-", dir=path.parent)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as state_file:
            json.dump(state, state_file, ensure_ascii=False, indent=2)
            state_file.write("\n")
        os.replace(temporary_path, path)
    except (OSError, TypeError, ValueError):
        try:
            os.unlink(temporary_path)
        except FileNotFoundError:
            pass
        raise


def _notify(message: str) -> None:
    script = [
        "on run argv",
        'display notification (item 1 of argv) with title "SofDom: отчёт готов"',
        "end run",
    ]
    result = subprocess.run(
        ["osascript", "-e", "\n".join(script), "--", message],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(f"macOS notification failed: {result.stderr.strip()}")


def poll_once(
    state_path: Path = STATE_PATH,
    fetch_pages: Callable[[], list[dict[str, Any]]] | None = None,
    fetch_report_hash: Callable[[str], str | None] | None = None,
    notify: Callable[[str], None] | None = None,
) -> int:
    fetch_pages = fetch_pages or (lambda: _notion_pages_with_status("Done"))
    fetch_report_hash = fetch_report_hash or _page_report_hash
    notify = notify or _notify
    previous_state = _load_state(state_path)
    initialized = previous_state.get("initialized", False)
    previous_reports = previous_state["reports"]
    current_reports: dict[str, dict[str, Any]] = {}
    notifications: list[tuple[str, str]] = []

    for page in fetch_pages():
        page_id = page["id"]
        last_edited_time = page.get("last_edited_time")
        previous = previous_reports.get(page_id, {})
        report_hash = previous.get("report_hash")
        if last_edited_time != previous.get("last_edited_time"):
            report_hash = fetch_report_hash(page_id)

        current_reports[page_id] = {
            "last_edited_time": last_edited_time,
            "report_hash": report_hash,
        }
        if report_hash and report_hash != previous.get("report_hash"):
            notifications.append((_page_title(page), page.get("url", "")))

    _save_state(state_path, {"initialized": True, "reports": current_reports})

    if not initialized:
        print(f"Baseline сохранён: {len(current_reports)} задач Done; уведомления не отправлялись.")
        return 0

    for title, url in notifications:
        message = title if not url else f"{title}\n{url}"
        notify(message)

    if notifications:
        print(f"Новых или изменённых отчётов: {len(notifications)}")
    else:
        print("Новых отчётов нет.")
    return len(notifications)


def _launchctl(*arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["launchctl", *arguments],
        capture_output=True,
        text=True,
        check=False,
    )


def install() -> None:
    if PLIST_PATH.exists():
        raise FileExistsError(
            f"LaunchAgent уже существует: {PLIST_PATH}. Сначала проверьте его через status."
        )
    if not notion_bridge.NOTION_TOKEN:
        raise ValueError("Notion bridge не нашёл учётные данные; установка отменена.")

    STATE_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    APP_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    LOG_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    PLIST_PATH.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(Path(__file__).resolve(), DEPLOYED_SCRIPT_PATH)
    shutil.copy2(Path(notion_bridge.__file__).resolve(), APP_DIR / "notion_bridge.py")
    configuration = {
        "Label": LABEL,
        "ProgramArguments": [
            sys.executable,
            "-u",
            str(DEPLOYED_SCRIPT_PATH),
            "poll",
        ],
        "WorkingDirectory": str(APP_DIR),
        "RunAtLoad": True,
        "StartInterval": POLL_INTERVAL_SECONDS,
        "StandardOutPath": str(LOG_DIR / "notion-report-watcher.log"),
        "StandardErrorPath": str(LOG_DIR / "notion-report-watcher-error.log"),
    }
    with PLIST_PATH.open("wb") as plist_file:
        plistlib.dump(configuration, plist_file)
    os.chmod(PLIST_PATH, 0o600)

    result = _launchctl("bootstrap", f"gui/{os.getuid()}", str(PLIST_PATH))
    if result.returncode:
        PLIST_PATH.unlink(missing_ok=True)
        raise RuntimeError(f"launchctl bootstrap failed: {result.stderr.strip()}")
    print(f"LaunchAgent установлен: {PLIST_PATH}")
    print(f"Интервал: {POLL_INTERVAL_SECONDS} секунд. Проверка Notion только на чтение.")


def uninstall() -> None:
    if not PLIST_PATH.exists():
        print("LaunchAgent не установлен.")
        return
    result = _launchctl("bootout", f"gui/{os.getuid()}", str(PLIST_PATH))
    if result.returncode and "Could not find specified service" not in result.stderr:
        raise RuntimeError(f"launchctl bootout failed: {result.stderr.strip()}")
    PLIST_PATH.unlink()
    DEPLOYED_SCRIPT_PATH.unlink(missing_ok=True)
    (APP_DIR / "notion_bridge.py").unlink(missing_ok=True)
    print("LaunchAgent удалён. История контрольных сумм и логи сохранены.")


def show_status() -> None:
    if not PLIST_PATH.exists():
        print("LaunchAgent не установлен.")
        return
    result = _launchctl("print", f"gui/{os.getuid()}/{LABEL}")
    if result.returncode:
        print("Файл LaunchAgent есть, но служба сейчас не загружена.")
        if result.stderr.strip():
            print(result.stderr.strip())
        return
    print("LaunchAgent загружен.")
    print(result.stdout.strip())


def main() -> int:
    parser = argparse.ArgumentParser(description="Локальные уведомления об отчётах Notion Tasks")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("poll", help="Проверить отчёты один раз")
    commands.add_parser("install", help="Установить локальный LaunchAgent с интервалом 8 минут")
    commands.add_parser("uninstall", help="Остановить и удалить LaunchAgent")
    commands.add_parser("status", help="Показать статус LaunchAgent")
    args = parser.parse_args()

    try:
        if args.command == "poll":
            poll_once()
        elif args.command == "install":
            install()
        elif args.command == "uninstall":
            uninstall()
        else:
            show_status()
    except (OSError, RuntimeError, ValueError, json.JSONDecodeError) as error:
        print(f"Notion report watcher error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
