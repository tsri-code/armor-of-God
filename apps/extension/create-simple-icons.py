#!/usr/bin/env python3

import os
from PIL import Image, ImageDraw, ImageFont
import sys

def create_icon(size, output_path):
    # Create image with gradient-like background
    img = Image.new('RGBA', (size, size), (59, 130, 246, 255))  # Blue background
    draw = ImageDraw.Draw(img)

    # Add a shield-like shape
    margin = size // 8
    draw.rounded_rectangle([margin, margin, size-margin, size-margin],
                         radius=size//10, fill=(234, 179, 8, 255))  # Gold

    # Add text (AOG)
    try:
        # Try to use a system font
        font_size = size // 4
        font = ImageFont.load_default()
    except:
        font = None

    # Add shield emoji or text
    text = "🛡️"
    if size >= 32:
        text_bbox = draw.textbbox((0, 0), text, font=font)
        text_width = text_bbox[2] - text_bbox[0]
        text_height = text_bbox[3] - text_bbox[1]
        x = (size - text_width) // 2
        y = (size - text_height) // 2
        draw.text((x, y), text, fill='white', font=font)

    # Save the image
    img.save(output_path, 'PNG')
    print(f"Created {output_path}")

def main():
    # Create assets directory
    assets_dir = os.path.join('public', 'assets')
    os.makedirs(assets_dir, exist_ok=True)

    # Create icons in different sizes
    sizes = [16, 32, 48, 128]
    for size in sizes:
        icon_path = os.path.join(assets_dir, f'icon-{size}.png')
        create_icon(size, icon_path)

    print("✅ Basic PNG icons created!")
    print("🎨 For production, replace with professionally designed icons")

if __name__ == "__main__":
    try:
        main()
    except ImportError:
        print("❌ Pillow (PIL) not available. Installing...")
        import subprocess
        subprocess.run([sys.executable, "-m", "pip", "install", "Pillow"], check=True)
        main()
    except Exception as e:
        print(f"❌ Error creating icons: {e}")
        print("💡 Continuing without custom icons - extension will use browser defaults")
