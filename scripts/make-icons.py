"""Generate PWA icons from the SUPER SNAKE screenshot."""
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "snake-game" / "screenshot.png"
OUT_DIR = ROOT / "public" / "icons"
OUT_DIR.mkdir(parents=True, exist_ok=True)

source = Image.open(SOURCE).convert("RGBA")


def square_crop(image: Image.Image) -> Image.Image:
    width, height = image.size
    side = min(width, height)
    left = (width - side) // 2
    top = (height - side) // 3
    return image.crop((left, top, left + side, top + side))


square = square_crop(source)

icon_192 = ImageOps.fit(square, (192, 192), Image.LANCZOS)
icon_512 = ImageOps.fit(square, (512, 512), Image.LANCZOS)
icon_192.save(OUT_DIR / "icon-192.png")
icon_512.save(OUT_DIR / "icon-512.png")

# Maskable icon: solid background with the artwork scaled to the safe zone.
maskable = Image.new("RGBA", (512, 512), (13, 27, 42, 255))
art = ImageOps.fit(square, (380, 380), Image.LANCZOS)
maskable.alpha_composite(art, ((512 - 380) // 2, (512 - 380) // 2))
maskable.save(OUT_DIR / "icon-maskable-512.png")

print("icons generated")
