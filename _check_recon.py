# -*- coding: utf-8 -*-
import json
from pathlib import Path

transcript = Path(
    r"C:\Users\Raul\.cursor\projects\c-Users-Raul-Desktop-Atrako"
    r"\agent-transcripts\20204ed7-5ed4-4a52-ab0d-8d3cf4756068"
    r"\20204ed7-5ed4-4a52-ab0d-8d3cf4756068.jsonl"
)

# Find tool results that contain components.css content (Read results)
# Also find all Write/StrReplace after reconstructing and compare with final Read

recon = Path(r"c:\Users\Raul\Desktop\Atrako\_css_recon\reconstructed.css").read_text(encoding="utf-8")

# Look for tool_result messages with pipeline-lead-card near end state
hits = []
with transcript.open(encoding="utf-8") as f:
    for i, line in enumerate(f, 1):
        if "pipeline-lead-avatar" not in line and "panel-modal-footer" not in line:
            continue
        # size estimate
        hits.append((i, len(line), "pipeline-lead-avatar" in line, "criar-" in line, "journey-rail-dot" in line))

out = Path(r"c:\Users\Raul\Desktop\Atrako\_css_recon\hits.txt")
out.write_text("\n".join(str(h) for h in hits), encoding="utf-8")
print("hits", len(hits))
for h in hits[-15:]:
    print(h)

# Scan subagent transcripts too
sub = Path(
    r"C:\Users\Raul\.cursor\projects\c-Users-Raul-Desktop-Atrako"
    r"\agent-transcripts\20204ed7-5ed4-4a52-ab0d-8d3cf4756068\subagents"
)
if sub.exists():
    for jf in sub.glob("*.jsonl"):
        with jf.open(encoding="utf-8") as f:
            for i, line in enumerate(f, 1):
                if "components.css" in line and ("Write" in line or "StrReplace" in line):
                    print("subagent", jf.name, "L", i, "len", len(line))
