from __future__ import annotations

import math
from pathlib import Path

from PIL import Image


RUN_DIR = Path(__file__).resolve().parent
DECODED = RUN_DIR / "decoded"
BASE = DECODED / "base.png"
KEY = (255, 0, 255)
CELL_W = 192
CELL_H = 208

COUNTS = {
    "idle": 6,
    "running-right": 8,
    "running-left": 8,
    "waving": 4,
    "jumping": 5,
    "failed": 8,
    "waiting": 6,
    "running": 6,
    "review": 6,
}


def keyed_subject() -> Image.Image:
    src = Image.open(BASE).convert("RGBA")
    pixels = src.load()
    min_x, min_y = src.width, src.height
    max_x = max_y = 0

    for y in range(src.height):
        for x in range(src.width):
            r, g, b, a = pixels[x, y]
            if a and abs(r - KEY[0]) + abs(g - KEY[1]) + abs(b - KEY[2]) > 42:
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
            else:
                pixels[x, y] = (0, 0, 0, 0)

    subject = src.crop((min_x, min_y, max_x + 1, max_y + 1))
    subject.thumbnail((142, 178), Image.Resampling.LANCZOS)
    return subject


def canvas(frames: int) -> Image.Image:
    return Image.new("RGBA", (CELL_W * frames, CELL_H), (*KEY, 255))


def pose(subject: Image.Image, scale=1.0, rotate=0.0, flip=False) -> Image.Image:
    w = max(1, round(subject.width * scale))
    h = max(1, round(subject.height * scale))
    img = subject.resize((w, h), Image.Resampling.LANCZOS)
    if flip:
        img = img.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    if rotate:
        img = img.rotate(rotate, resample=Image.Resampling.BICUBIC, expand=True)
    return img


def paste_frame(strip: Image.Image, frame: int, img: Image.Image, x_off=0, y_off=0) -> None:
    x = frame * CELL_W + (CELL_W - img.width) // 2 + x_off
    y = CELL_H - img.height - 10 + y_off
    strip.alpha_composite(img, (x, y))


def write_row(name: str, subject: Image.Image) -> None:
    n = COUNTS[name]
    strip = canvas(n)
    for i in range(n):
        phase = 2 * math.pi * i / n
        scale = 1.0
        rot = 0.0
        x = 0
        y = 0
        flip = False

        if name == "idle":
            scale = 1.0 + 0.012 * math.sin(phase)
            y = round(2 * math.sin(phase))
        elif name == "running-right":
            scale = 0.98
            rot = -4 + 8 * (i % 2)
            x = 7 + (i % 2) * 4
            y = -2 if i % 2 else 0
        elif name == "running-left":
            scale = 0.98
            rot = 4 - 8 * (i % 2)
            x = -7 - (i % 2) * 4
            y = -2 if i % 2 else 0
            flip = True
        elif name == "waving":
            rot = [-2, -10, -6, 1][i]
            y = [0, -2, -1, 0][i]
        elif name == "jumping":
            rot = [0, -5, -1, 5, 0][i]
            y = [0, -22, -44, -22, 0][i]
            scale = [1.0, 0.99, 0.98, 0.99, 1.0][i]
        elif name == "failed":
            rot = [2, 4, 7, 10, 12, 10, 7, 4][i]
            y = [1, 2, 4, 7, 9, 7, 5, 2][i]
            scale = [0.99, 0.985, 0.98, 0.97, 0.96, 0.97, 0.98, 0.985][i]
        elif name == "waiting":
            rot = [-2, -1, 1, 2, 1, -1][i]
            y = [0, -1, -2, -1, 0, 0][i]
        elif name == "running":
            rot = [-5, -2, 1, 4, 2, -2][i]
            x = [0, 1, 3, 2, 1, -1][i]
            y = [0, -1, -2, -1, 0, 0][i]
        elif name == "review":
            rot = [-4, -3, -1, 1, 3, 1][i]
            y = [0, -1, -1, 0, -1, 0][i]

        paste_frame(strip, i, pose(subject, scale, rot, flip), x, y)

    strip.save(DECODED / f"{name}.png")


def main() -> None:
    DECODED.mkdir(parents=True, exist_ok=True)
    subject = keyed_subject()
    for name in COUNTS:
        write_row(name, subject)


if __name__ == "__main__":
    main()
