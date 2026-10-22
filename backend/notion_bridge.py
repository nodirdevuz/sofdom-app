#!/usr/bin/env python3
"""
notion_bridge.py
Модуль и CLI-инструмент для автоматического обмена задачами и отчётами
между Оркестратором и Агентом-исполнителем (Antigravity) через базу Notion Tasks.
"""

import os
import sys
import json
import argparse
import urllib.request
import urllib.error
from typing import List, Dict, Any, Optional

NOTION_TOKEN = os.environ.get("NOTION_TOKEN")
if not NOTION_TOKEN:
    # Загружаем из ~/.gemini/config/mcp_config.json, если не передан через env
    cfg_path = os.path.expanduser("~/.gemini/config/mcp_config.json")
    if os.path.exists(cfg_path):
        try:
            with open(cfg_path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                NOTION_TOKEN = cfg.get("mcpServers", {}).get("notion", {}).get("env", {}).get("NOTION_TOKEN")
        except Exception:
            pass

# ID базы Tasks в воркспейсе Nodirbek’s Space
TASKS_DB_ID = "3d3ee85c-f124-80e3-b7ea-c3a0dc3a9f60"
NOTION_API_VERSION = "2022-06-28"


def _notion_request(endpoint: str, method: str = "GET", data: Optional[dict] = None) -> dict:
    if not NOTION_TOKEN:
        raise ValueError("NOTION_TOKEN не найден в окружении или ~/.gemini/config/mcp_config.json")

    url = f"https://api.notion.com/v1/{endpoint.lstrip('/')}"
    headers = {
        "Authorization": f"Bearer {NOTION_TOKEN}",
        "Notion-Version": NOTION_API_VERSION,
        "Content-Type": "application/json"
    }

    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Notion API error HTTP {e.code}: {err_body}")


def get_pending_tasks(db_id: str = TASKS_DB_ID) -> List[Dict[str, Any]]:
    """Получает задачи со статусом 'Up next' или 'Not started'."""
    query_payload = {
        "filter": {
            "or": [
                {
                    "property": "Status",
                    "status": {
                        "equals": "Up next"
                    }
                },
                {
                    "property": "Status",
                    "status": {
                        "equals": "Not started"
                    }
                }
            ]
        },
        "sorts": [
            {
                "timestamp": "last_edited_time",
                "direction": "ascending"
            }
        ]
    }
    res = _notion_request(f"databases/{db_id}/query", method="POST", data=query_payload)
    tasks = []
    for page in res.get("results", []):
        props = page.get("properties", {})
        title_prop = props.get("Name", {}).get("title", [])
        title = "".join(t.get("plain_text", "") for t in title_prop) if title_prop else "Без названия"
        status = props.get("Status", {}).get("status", {}).get("name", "")
        tasks.append({
            "id": page["id"],
            "title": title,
            "status": status,
            "url": page.get("url", ""),
            "created_time": page.get("created_time"),
            "last_edited_time": page.get("last_edited_time")
        })
    return tasks


def get_page_content_text(page_id: str) -> str:
    """Извлекает весь текст блоков со страницы задачи (ТЗ от оркестратора)."""
    blocks_res = _notion_request(f"blocks/{page_id}/children", method="GET")
    lines = []
    for b in blocks_res.get("results", []):
        b_type = b.get("type")
        block_data = b.get(b_type, {})
        rich_texts = block_data.get("rich_text", [])
        text = "".join(rt.get("plain_text", "") for rt in rich_texts)
        if b_type == "heading_1":
            lines.append(f"# {text}")
        elif b_type == "heading_2":
            lines.append(f"## {text}")
        elif b_type == "heading_3":
            lines.append(f"### {text}")
        elif b_type == "bulleted_list_item":
            lines.append(f"- {text}")
        elif b_type == "numbered_list_item":
            lines.append(f"1. {text}")
        elif b_type == "to_do":
            checked = "x" if block_data.get("checked") else " "
            lines.append(f"- [{checked}] {text}")
        elif b_type == "code":
            lines.append(f"```\n{text}\n```")
        elif text:
            lines.append(text)
    return "\n\n".join(lines)


def set_task_status(page_id: str, status_name: str) -> dict:
    """Обновляет статус задачи: 'Not started', 'Up next', 'In progress', 'Done'."""
    payload = {
        "properties": {
            "Status": {
                "status": {
                    "name": status_name
                }
            }
        }
    }
    return _notion_request(f"pages/{page_id}", method="PATCH", data=payload)


def append_task_report(page_id: str, report_text: str) -> dict:
    """Добавляет подробный отчёт о выполнении в конец страницы Notion."""
    # Разбиваем отчёт на абзацы (лимит одного блока Notion ~2000 символов)
    blocks = [
        {
            "object": "block",
            "type": "divider",
            "divider": {}
        },
        {
            "object": "block",
            "type": "heading_2",
            "heading_2": {
                "rich_text": [
                    {
                        "type": "text",
                        "text": {"content": "📋 Отчёт исполнителя (Antigravity)"}
                    }
                ]
            }
        }
    ]

    paragraphs = [p.strip() for p in report_text.split("\n\n") if p.strip()]
    for p in paragraphs:
        # Нарезаем по 1900 символов, если абзац слишком длинный
        chunks = [p[i:i+1900] for i in range(0, len(p), 1900)]
        for chunk in chunks:
            blocks.append({
                "object": "block",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [
                        {
                            "type": "text",
                            "text": {"content": chunk}
                        }
                    ]
                }
            })

    # Notion API принимает максимум 100 блоков за один вызов
    for i in range(0, len(blocks), 90):
        batch = blocks[i:i+90]
        _notion_request(f"blocks/{page_id}/children", method="PATCH", data={"children": batch})

    return {"status": "ok", "appended_blocks": len(blocks)}


def create_task(title: str, body_text: str, status: str = "Up next", db_id: str = TASKS_DB_ID) -> dict:
    """Создаёт новую задачу (для Оркестратора)."""
    blocks = []
    if body_text:
        paragraphs = [p.strip() for p in body_text.split("\n\n") if p.strip()]
        for p in paragraphs:
            chunks = [p[i:i+1900] for i in range(0, len(p), 1900)]
            for chunk in chunks:
                blocks.append({
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [{"type": "text", "text": {"content": chunk}}]
                    }
                })

    payload = {
        "parent": {"database_id": db_id},
        "properties": {
            "Name": {
                "title": [{"type": "text", "text": {"content": title}}]
            },
            "Status": {
                "status": {"name": status}
            }
        },
        "children": blocks[:100]
    }
    return _notion_request("pages", method="POST", data=payload)


def main():
    parser = argparse.ArgumentParser(description="Notion Tasks Bridge CLI")
    subparsers = parser.add_subparsers(dest="cmd")

    subparsers.add_parser("list-pending", help="Показать задачи в статусе Up next / Not started")

    p_get = subparsers.add_parser("get", help="Показать детали и ТЗ задачи")
    p_get.add_argument("page_id", help="UUID страницы задачи")

    p_start = subparsers.add_parser("start", help="Перевести задачу в статус In progress")
    p_start.add_argument("page_id", help="UUID страницы задачи")

    p_complete = subparsers.add_parser("complete", help="Прикрепить отчёт и перевести статус в Done")
    p_complete.add_argument("page_id", help="UUID страницы задачи")
    p_complete.add_argument("--report", required=True, help="Текст отчёта или путь к .md файлу")

    p_create = subparsers.add_parser("create", help="Создать задачу (для Оркестратора)")
    p_create.add_argument("--title", required=True, help="Название задачи")
    p_create.add_argument("--body", default="", help="Описание / ТЗ задачи")

    args = parser.parse_args()

    if args.cmd == "list-pending":
        tasks = get_pending_tasks()
        print(json.dumps(tasks, ensure_ascii=False, indent=2))
    elif args.cmd == "get":
        content = get_page_content_text(args.page_id)
        print(content)
    elif args.cmd == "start":
        set_task_status(args.page_id, "In progress")
        print(f"Статус задачи {args.page_id} изменён на 'In progress'")
    elif args.cmd == "complete":
        report_text = args.report
        if os.path.exists(report_text):
            with open(report_text, "r", encoding="utf-8") as f:
                report_text = f.read()
        append_task_report(args.page_id, report_text)
        set_task_status(args.page_id, "Done")
        print(f"Отчёт добавлен, статус задачи {args.page_id} изменён на 'Done'")
    elif args.cmd == "create":
        res = create_task(args.title, args.body)
        print(f"Задача создана: {res.get('url')}")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
