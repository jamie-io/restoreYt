#!/usr/bin/env python3
"""Generate branded icons for the Deslopify extension.

Requires ImageMagick (the `convert` or `magick` command).
Run: python3 generate_icons.py
"""

import subprocess
import sys


def generate_icon(size):
    padding = size // 8
    corners = size // 4
    font_size = size // 2
    out = f"icons/icon{size}.png"

    cmd = [
        "convert",
        "-size", f"{size}x{size}", "xc:none",
        "-fill", "#4CAF50",
        "-draw", f"roundrectangle {padding},{padding} {size - padding},{size - padding} {corners},{corners}",
        "-fill", "white",
        "-font", "Adwaita-Mono-Bold",
        "-pointsize", f"{font_size}",
        "-gravity", "center",
        "-annotate", "+0+0", "D",
        out,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error creating {out}: {result.stderr.strip()}", file=sys.stderr)
        return False
    print(f"Created {out}")
    return True


def main():
    for size in [16, 48, 128]:
        if not generate_icon(size):
            sys.exit(1)


if __name__ == "__main__":
    main()
