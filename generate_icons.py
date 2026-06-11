#!/usr/bin/env python3
"""Generate simple PNG icons for the extension."""

import struct
import zlib

def create_png(width, height, color):
    """Create a simple solid color PNG."""
    def make_chunk(chunk_type, data):
        chunk = chunk_type + data
        return struct.pack('>I', len(data)) + chunk + struct.pack('>I', zlib.crc32(chunk) & 0xffffffff)

    sig = b'\x89PNG\r\n\x1a\n'

    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    ihdr = make_chunk(b'IHDR', ihdr_data)

    raw_data = b''
    r, g, b = color
    for y in range(height):
        raw_data += b'\x00'
        for x in range(width):
            raw_data += bytes([r, g, b])

    idat = make_chunk(b'IDAT', zlib.compress(raw_data))
    iend = make_chunk(b'IEND', b'')

    return sig + ihdr + idat + iend

def main():
    green = (76, 175, 80)

    for size in [16, 48, 128]:
        png_data = create_png(size, size, green)
        with open(f'icons/icon{size}.png', 'wb') as f:
            f.write(png_data)
        print(f'Created icons/icon{size}.png')

if __name__ == '__main__':
    main()
