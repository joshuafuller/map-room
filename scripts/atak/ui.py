#!/usr/bin/env python3
"""Minimal ATAK UI driver: dump the view tree, find a node, tap it."""
import re, subprocess, sys, time

def dump():
    subprocess.run(["adb", "shell", "uiautomator", "dump", "/sdcard/ui.xml"],
                   capture_output=True, timeout=120)
    return subprocess.run(["adb", "shell", "cat", "/sdcard/ui.xml"],
                          capture_output=True, text=True, timeout=120).stdout

def nodes(xml):
    for node in re.finditer(r'<node[^>]*>', xml):
        tag = node.group(0)
        clickable = 'clickable="true"' in tag
        enabled = 'enabled="true"' in tag
        text = re.search(r'text="([^"]*)"', tag)
        desc = re.search(r'content-desc="([^"]*)"', tag)
        rid = re.search(r'resource-id="([^"]*)"', tag)
        bounds = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', tag)
        if not bounds:
            continue
        x1, y1, x2, y2 = map(int, bounds.groups())
        yield {"clickable": clickable,
               "enabled": enabled,
               "text": text.group(1) if text else "",
               "desc": desc.group(1) if desc else "",
               "id": rid.group(1) if rid else "",
               "center": ((x1 + x2) // 2, (y1 + y2) // 2)}

def find(needle, xml=None, clickable_only=True):
    """Prefer a clickable node whose text matches exactly, then clickable
    substring, then any node. A label containing the same words as its button
    must never win over the button itself."""
    xml = xml or dump()
    candidates = list(nodes(xml))
    needle_l = needle.lower()

    def fields(node):
        return [node["text"].lower(), node["desc"].lower(), node["id"].lower()]

    for want_clickable in ([True, False] if clickable_only else [False]):
        for exact in (True, False):
            for node in candidates:
                if want_clickable and not node["clickable"]:
                    continue
                for value in fields(node):
                    if (value == needle_l) if exact else (needle_l in value and value):
                        return node
    return None

class Disabled(Exception):
    """A control that is present but not yet actionable. Tapping it does
    nothing, so reporting success would be a lie."""

def tap(needle, tries=3, wait=3):
    for _ in range(tries):
        node = find(needle)
        if node and not node["enabled"]:
            raise Disabled(f"{needle!r} is present but disabled")
        if node:
            x, y = node["center"]
            subprocess.run(["adb", "shell", "input", "tap", str(x), str(y)], timeout=60)
            time.sleep(wait)
            return True
        time.sleep(wait)
    return False

def screen():
    return sorted({n["text"] for n in nodes(dump()) if n["text"].strip()})

if __name__ == "__main__":
    command = sys.argv[1]
    if command == "screen":
        print("\n".join(screen()))
    elif command == "tap":
        print("TAPPED" if tap(sys.argv[2]) else f"NOT FOUND: {sys.argv[2]}")
    elif command == "find":
        print(find(sys.argv[2]))
