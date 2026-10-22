import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from backend import notion_report_watcher as watcher


class NotionReportWatcherTests(unittest.TestCase):
    def test_poll_interval_is_five_minutes(self):
        self.assertEqual(watcher.POLL_INTERVAL_SECONDS, 300)

    def test_first_poll_creates_silent_baseline(self):
        with tempfile.TemporaryDirectory() as directory:
            state_path = Path(directory) / "state.json"
            page = {
                "id": "page-1",
                "last_edited_time": "2026-01-01T10:00:00Z",
                "properties": {"Name": {"title": [{"plain_text": "Report"}]}},
            }
            notify = Mock()

            watcher.poll_once(
                state_path,
                fetch_pages=lambda: [page],
                fetch_report_hash=lambda _: "baseline-hash",
                notify=notify,
            )

            notify.assert_not_called()
            state = json.loads(state_path.read_text(encoding="utf-8"))
            self.assertEqual(state["reports"]["page-1"]["report_hash"], "baseline-hash")

    def test_new_report_notifies_once(self):
        with tempfile.TemporaryDirectory() as directory:
            state_path = Path(directory) / "state.json"
            page = {
                "id": "page-1",
                "last_edited_time": "2026-01-01T10:05:00Z",
                "url": "https://notion.so/page-1",
                "properties": {"Name": {"title": [{"plain_text": "Geo audit"}]}},
            }
            state_path.write_text(
                json.dumps(
                    {
                        "initialized": True,
                        "reports": {
                            "page-1": {
                                "last_edited_time": "2026-01-01T10:00:00Z",
                                "report_hash": "old-hash",
                            }
                        }
                    }
                ),
                encoding="utf-8",
            )
            notify = Mock()

            watcher.poll_once(
                state_path,
                fetch_pages=lambda: [page],
                fetch_report_hash=lambda _: "new-hash",
                notify=notify,
            )
            watcher.poll_once(
                state_path,
                fetch_pages=lambda: [page],
                fetch_report_hash=lambda _: self.fail("unchanged page should not be refetched"),
                notify=notify,
            )

            notify.assert_called_once_with("Geo audit\nhttps://notion.so/page-1")

    def test_empty_baseline_does_not_suppress_first_future_report(self):
        with tempfile.TemporaryDirectory() as directory:
            state_path = Path(directory) / "state.json"
            notify = Mock()

            watcher.poll_once(
                state_path,
                fetch_pages=lambda: [],
                fetch_report_hash=lambda _: None,
                notify=notify,
            )
            page = {
                "id": "page-1",
                "last_edited_time": "2026-01-01T10:05:00Z",
                "url": "https://notion.so/page-1",
                "properties": {"Name": {"title": [{"plain_text": "Geo audit"}]}},
            }
            watcher.poll_once(
                state_path,
                fetch_pages=lambda: [page],
                fetch_report_hash=lambda _: "new-hash",
                notify=notify,
            )

            notify.assert_called_once_with("Geo audit\nhttps://notion.so/page-1")

    def test_pagination_loads_done_tasks(self):
        first = {
            "results": [{"id": "first"}],
            "has_more": True,
            "next_cursor": "cursor-1",
        }
        second = {"results": [{"id": "second"}], "has_more": False}
        with patch.object(watcher.notion_bridge, "_notion_request", side_effect=[first, second]) as request:
            pages = watcher._notion_pages_with_status("Done")

        self.assertEqual([page["id"] for page in pages], ["first", "second"])
        self.assertNotIn("start_cursor", request.call_args_list[0].kwargs["data"])
        self.assertEqual(request.call_args_list[1].kwargs["data"]["start_cursor"], "cursor-1")


if __name__ == "__main__":
    unittest.main()
