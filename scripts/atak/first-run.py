#!/usr/bin/env python3
"""Walk ATAK first-run, logging every screen and every tap.

Records an ordered journal so the user-facing step count is measured, not
estimated. Only taps controls it can name; stops when it sees something new.
"""
import json, subprocess, sys, time
import ui

JOURNAL = []
SHOTS = "/tmp/claude-1000/-home-user-development-map-room/a5576f6f-4690-41e5-838b-e12ba87d76b5/scratchpad/shots"
subprocess.run(["mkdir", "-p", SHOTS])

# Affirmative controls seen during ATAK first-run, in the order they appear.
# Anything not on this list is reported rather than guessed at.
AFFIRMATIVE = [
    "I agree.", "I understand", "ALLOW", "Allow", "While using the app",
    "Allow all the time", "Continue", "OK", "Next", "Done", "Skip",
    "Dismiss", "Got it", "Accept", "Yes", "Allow all", "Turn on", "Enable",
]

def shot(name):
    path = f"{SHOTS}/{name}.png"
    with open(path, "wb") as handle:
        handle.write(subprocess.run(["adb", "exec-out", "screencap", "-p"],
                                    capture_output=True, timeout=180).stdout)
    return path

def clickable(xml):
    return [n for n in ui.nodes(xml) if n["clickable"] and (n["text"] or n["desc"])]

def label(node):
    return node["text"] or node["desc"]

def step(index):
    xml = ui.dump()
    controls = clickable(xml)
    texts = sorted({n["text"] for n in ui.nodes(xml) if n["text"].strip()})
    path = shot(f"{index:02d}")
    entry = {"step": index, "screenshot": path,
             "controls": [label(n) for n in controls],
             "text_sample": texts[:6]}
    for want in AFFIRMATIVE:
        for node in controls:
            if label(node).strip().lower() == want.lower():
                if not node["enabled"]:
                    # ATAK gates some dialogs behind reading to the end.
                    for _ in range(10):
                        subprocess.run(["adb", "shell", "input", "swipe",
                                        "1200", "800", "1200", "250", "200"], timeout=60)
                    time.sleep(1)
                    node = ui.find(label(node))
                    entry["scrolled_to_enable"] = True
                    if not node or not node["enabled"]:
                        continue
                x, y = node["center"]
                subprocess.run(["adb", "shell", "input", "tap", str(x), str(y)], timeout=60)
                entry["tapped"] = label(node)
                JOURNAL.append(entry)
                return True
    entry["tapped"] = None
    JOURNAL.append(entry)
    return False

for index in range(1, 26):
    advanced = step(index)
    print(f"{index:02d} tapped={JOURNAL[-1]['tapped']!r} controls={JOURNAL[-1]['controls'][:6]}")
    if not advanced:
        print("STOP: no known affirmative control on this screen")
        break
    time.sleep(4)

with open(f"{SHOTS}/journal.json", "w") as handle:
    json.dump(JOURNAL, handle, indent=2)
print(f"\n{len([e for e in JOURNAL if e['tapped']])} taps recorded")
