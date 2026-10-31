#!/usr/bin/env python3
"""Render the extension icons from SVG.

icons/icon.svg is drawn for 48 px and up; icons/icon-small.svg is pixel-fitted
for 16 and 32 px. Requires rsvg-convert (librsvg).

Run: python3 generate_icons.py
"""

import subprocess
import sys

SIZES = {16: "icons/icon-small.svg", 32: "icons/icon-small.svg", 48: "icons/icon.svg", 128: "icons/icon.svg"}


def main() -> int:
    for size, source in SIZES.items():
        target = f"icons/icon{size}.png"
        result = subprocess.run(
            ["rsvg-convert", "-w", str(size), "-h", str(size), source, "-o", target],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print(f"Could not render {target}: {result.stderr.strip()}", file=sys.stderr)
            return 1
        print(f"Rendered {target}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
