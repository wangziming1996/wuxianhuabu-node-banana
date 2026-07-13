"""Markdown report — load existing REPORT.md if present, then append."""
from __future__ import annotations
import os, re, time
from typing import List, Tuple

REPORT_PATH = "/Users/wangziming/aimake/zmt/wuxianhuabu/tests/REPORT.md"

TABLE_RE = re.compile(r"^\|\s*(F\d+|V\d+|P\d+)\s*\|\s*([^|]+?)\s*\|\s*\*\*([^*]+)\*\*\s*\|\s*([^|]*)\s*\|\s*([^|]*?)\s*\|", re.MULTILINE)
SECTION_RE = re.compile(r"^###\s+(F\d+|V\d+|P\d+)\s+", re.MULTILINE)


class Report:
    def __init__(self) -> None:
        self.rows: List[Tuple[str, str, str, str, str]] = []
        self.sections: List[str] = []
        self.header_meta = None
        self._load_existing()

    def _load_existing(self) -> None:
        if not os.path.exists(REPORT_PATH):
            return
        with open(REPORT_PATH, encoding="utf-8") as f:
            content = f.read()
        # Existing rows
        for m in TABLE_RE.finditer(content):
            cid, name, status, dur, art = m.groups()
            self.rows.append((cid.strip(), name.strip(), status.strip(), dur.strip(), art.strip()))
        # Existing sections
        parts = SECTION_RE.split(content)
        # parts[0] = preamble, then alternating (id, body) pairs
        i = 1
        while i < len(parts):
            cid = parts[i]
            body = parts[i+1] if i+1 < len(parts) else ""
            # body runs until next "### " or "## " marker — strip trailing sub-sections
            end = re.search(r"^##\s", body, re.MULTILINE)
            sec_text = body[:end.start()] if end else body
            self.sections.append(f"### {cid} {sec_text}".rstrip() + "\n")
            i += 2

    def add(self, case_id: str, name: str, status: str, duration: str, artifacts: str, body: str = "") -> None:
        # Avoid duplicates — overwrite if same id
        self.rows = [r for r in self.rows if r[0] != case_id]
        self.sections = [s for s in self.sections if not s.startswith(f"### {case_id} ")]
        self.rows.append((case_id, name, status, duration, artifacts))
        if body:
            self.sections.append(body)

    def write(self, started_at: float, ended_at: float, env: dict) -> None:
        # sort rows by id (F1..F99, V1..V99, P1..P99)
        def sort_key(r):
            cid = r[0]
            m = re.match(r"([FVP])(\d+)", cid)
            if not m: return (cid,)
            return (m.group(1), int(m.group(2)))
        rows_sorted = sorted(self.rows, key=sort_key)

        passed = sum(1 for r in rows_sorted if r[2].startswith("PASS"))
        failed = sum(1 for r in rows_sorted if r[2].startswith("FAIL"))
        skipped = sum(1 for r in rows_sorted if r[2] == "SKIPPED")
        errored = sum(1 for r in rows_sorted if r[2].startswith("ERROR"))
        partial = sum(1 for r in rows_sorted if r[2] == "PARTIAL")
        total = len(rows_sorted)

        lines: List[str] = []
        lines.append("# wuxianhuabu AI 功能测试报告\n")
        lines.append(f"\n**生成时间**: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(started_at))} — {time.strftime('%H:%M:%S', time.localtime(ended_at))}")
        lines.append(f"**总耗时**: {int(ended_at-started_at)}s")
        lines.append(f"**API Key 状态**: {'configured ✓' if env.get('configured') else 'NOT CONFIGURED ✗'}  ")
        lines.append(f"**图片模型**: `{env.get('imageModel')}` | **文本模型**: `{env.get('textModel')}` | **视频模型**: `{env.get('videoModel')}`\n")

        lines.append("## 〇、结果汇总\n")
        lines.append(f"**Total**: {total} | **PASS**: {passed} | **FAIL**: {failed} | **PARTIAL**: {partial} | **ERROR**: {errored} | **SKIPPED**: {skipped}\n")
        lines.append("| ID | 用例 | 状态 | 耗时 | 产物 |")
        lines.append("|----|------|------|------|------|")
        for cid, name, status, dur, art in rows_sorted:
            lines.append(f"| {cid} | {name} | **{status}** | {dur} | {art} |")

        lines.append("\n## 一、详细报告\n")
        lines.extend(self.sections)

        lines.append("\n## 二、附录\n")
        lines.append("**Dev server log 末尾(20 行)**:\n")
        lines.append("```")
        try:
            with open("/Users/wangziming/aimake/zmt/wuxianhuabu/dev-server.out.log") as f:
                tail = f.readlines()[-20:]
                lines.extend(tail)
        except Exception:
            lines.append("(unavailable)")
        lines.append("```")

        with open(REPORT_PATH, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
