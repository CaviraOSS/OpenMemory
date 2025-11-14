#!/usr/bin/env python3
"""
生成基本的應用程式圖標

這個腳本會生成 Tauri 應用程式所需的基本圖標文件。
在實際部署中，應該使用專業的圖標設計。
"""

import os

from PIL import Image, ImageDraw


def create_simple_icon(size, output_path):
    """創建簡單的圖標"""
    # 創建圖像
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 繪製簡單的圖標 - 一個帶邊框的圓形
    margin = size // 8
    draw.ellipse(
        [margin, margin, size - margin, size - margin],
        fill=(52, 152, 219, 255),
        outline=(41, 128, 185, 255),
        width=2,
    )

    # 在中心繪製 "MCP" 文字
    try:
        # 嘗試使用系統字體
        from PIL import ImageFont

        font_size = size // 4
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            font = ImageFont.load_default()
    except ImportError:
        font = None

    text = "MCP"
    if font:
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
    else:
        text_width = len(text) * (size // 8)
        text_height = size // 6

    text_x = (size - text_width) // 2
    text_y = (size - text_height) // 2

    draw.text((text_x, text_y), text, fill=(255, 255, 255, 255), font=font)

    # 保存圖像
    img.save(output_path)
    print(f"已生成圖標: {output_path}")


def main():
    """主函數"""
    icons_dir = "icons"
    os.makedirs(icons_dir, exist_ok=True)

    # 生成不同尺寸的 PNG 圖標
    sizes = [32, 128, 256]
    for size in sizes:
        if size == 128:
            # 生成普通和 2x 版本
            create_simple_icon(size, f"{icons_dir}/{size}x{size}.png")
            create_simple_icon(size * 2, f"{icons_dir}/{size}x{size}@2x.png")
        else:
            create_simple_icon(size, f"{icons_dir}/{size}x{size}.png")

    # 為 Windows 創建 ICO 文件
    try:
        img_256 = Image.open(f"{icons_dir}/256x256.png")
        img_256.save(
            f"{icons_dir}/icon.ico",
            format="ICO",
            sizes=[(256, 256), (128, 128), (64, 64), (32, 32), (16, 16)],
        )
        print(f"已生成 Windows 圖標: {icons_dir}/icon.ico")
    except Exception as e:
        print(f"生成 ICO 文件失敗: {e}")

    # 為 macOS 創建 ICNS 文件（需要額外工具）
    print("注意：macOS ICNS 文件需要使用專門的工具生成")
    print("可以使用在線工具或 iconutil 命令將 PNG 轉換為 ICNS")

    print("圖標生成完成！")


if __name__ == "__main__":
    try:
        main()
    except ImportError:
        print("錯誤：需要安裝 Pillow 庫")
        print("請運行：pip install Pillow")
    except Exception as e:
        print(f"生成圖標時發生錯誤: {e}")
