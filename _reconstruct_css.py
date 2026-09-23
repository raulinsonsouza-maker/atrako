# -*- coding: utf-8 -*-
import json
from pathlib import Path

transcript = Path(
    r"C:\Users\Raul\.cursor\projects\c-Users-Raul-Desktop-Atrako"
    r"\agent-transcripts\20204ed7-5ed4-4a52-ab0d-8d3cf4756068"
    r"\20204ed7-5ed4-4a52-ab0d-8d3cf4756068.jsonl"
)
out_dir = Path(r"c:\Users\Raul\Desktop\Atrako\_css_recon")
out_dir.mkdir(exist_ok=True)

ops = []
with transcript.open("r", encoding="utf-8") as f:
    for i, line in enumerate(f, 1):
        if "components.css" not in line:
            continue
        try:
            obj = json.loads(line)
        except Exception:
            continue
        content = obj.get("message", {}).get("content", [])
        if not isinstance(content, list):
            continue
        for part in content:
            if not isinstance(part, dict) or part.get("type") != "tool_use":
                continue
            name = part.get("name")
            inp = part.get("input") or {}
            p = str(inp.get("path", ""))
            if "components.css" not in p:
                continue
            if name == "Write":
                ops.append((i, "Write", inp))
            elif name == "StrReplace":
                ops.append((i, "StrReplace", inp))
            elif name == "Read":
                ops.append((i, "Read", inp))

log_lines = []
for i, name, inp in ops:
    if name == "Write":
        c = inp.get("contents", "")
        log_lines.append(f"L{i} Write {len(c.splitlines())} lines / {len(c)} chars")
    elif name == "StrReplace":
        log_lines.append(
            f"L{i} StrReplace old={len(inp.get('old_string',''))} "
            f"new={len(inp.get('new_string',''))} "
            f"replace_all={inp.get('replace_all')}"
        )
    else:
        log_lines.append(f"L{i} Read")

(out_dir / "ops.txt").write_text("\n".join(log_lines), encoding="utf-8")

# Replay: skip typography mis-write (first Write that mentions tipografia)
content = None
history = []
for i, name, inp in ops:
    if name == "Read":
        continue
    if name == "Write":
        c = inp.get("contents", "")
        # Skip accidental typography write into components.css
        if "tipografia" in c[:200] and ".type-hero-display" in c:
            history.append(f"L{i} SKIP typography miswrite")
            continue
        content = c
        history.append(f"L{i} Write applied ({len(c.splitlines())} lines)")
        (out_dir / f"after_L{i}.css").write_text(content, encoding="utf-8")
    elif name == "StrReplace":
        if content is None:
            history.append(f"L{i} StrReplace SKIPPED (no content yet)")
            continue
        old = inp.get("old_string", "")
        new = inp.get("new_string", "")
        replace_all = bool(inp.get("replace_all"))
        if old not in content:
            history.append(f"L{i} StrReplace FAILED - old not found")
            # dump snippet for debug
            (out_dir / f"fail_L{i}_old.txt").write_text(old, encoding="utf-8")
            (out_dir / f"fail_L{i}_current_tail.txt").write_text(
                content[-2000:], encoding="utf-8"
            )
            continue
        if replace_all:
            content = content.replace(old, new)
            count = "all"
        else:
            content = content.replace(old, new, 1)
            count = "1"
        history.append(
            f"L{i} StrReplace OK ({count}) -> {len(content.splitlines())} lines"
        )
        (out_dir / f"after_L{i}.css").write_text(content, encoding="utf-8")

(out_dir / "history.txt").write_text("\n".join(history), encoding="utf-8")
if content:
    (out_dir / "reconstructed.css").write_text(content, encoding="utf-8")
    print(f"FINAL: {len(content.splitlines())} lines, {len(content)} chars")
else:
    print("NO CONTENT")
print("\n".join(history))
