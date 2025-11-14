#!/usr/bin/env python3
"""
訊息代碼驗證腳本

驗證後端訊息代碼、前端常量和翻譯文件的一致性。
確保所有訊息代碼都有對應的定義和翻譯。

使用方式：
    python scripts/validate_message_codes.py
"""

import json
import re
import sys
from pathlib import Path


def extract_backend_codes():
    """從後端 Python 文件中提取所有訊息代碼"""
    codes = set()

    # 讀取 MessageCodes 類別
    message_codes_file = Path(
        "src/mcp_feedback_enhanced/web/constants/message_codes.py"
    )
    if message_codes_file.exists():
        content = message_codes_file.read_text(encoding="utf-8")
        # 匹配形如 SESSION_FEEDBACK_SUBMITTED = "session.feedbackSubmitted"
        pattern = r'([A-Z_]+)\s*=\s*"([^"]+)"'
        matches = re.findall(pattern, content)
        for constant_name, code in matches:
            codes.add(code)

    return codes


def extract_frontend_codes():
    """從前端 JavaScript 文件中提取所有訊息代碼"""
    codes = set()

    # 讀取 message-codes.js
    message_codes_js = Path(
        "src/mcp_feedback_enhanced/web/static/js/modules/constants/message-codes.js"
    )
    if message_codes_js.exists():
        content = message_codes_js.read_text(encoding="utf-8")
        # 匹配形如 FEEDBACK_SUBMITTED: 'session.feedbackSubmitted'
        pattern = r'[A-Z_]+:\s*[\'"]([^\'"]+)[\'"]'
        matches = re.findall(pattern, content)
        codes.update(matches)

    # 讀取 utils.js 中的 fallback 訊息
    utils_js = Path("src/mcp_feedback_enhanced/web/static/js/modules/utils.js")
    if utils_js.exists():
        content = utils_js.read_text(encoding="utf-8")
        # 匹配 fallbackMessages 物件中的 key
        fallback_section = re.search(
            r"fallbackMessages\s*=\s*\{([^}]+)\}", content, re.DOTALL
        )
        if fallback_section:
            pattern = r'[\'"]([^\'"]+)[\'"]:\s*[\'"][^\'"]+[\'"]'
            matches = re.findall(pattern, fallback_section.group(1))
            codes.update(matches)

    return codes


def extract_translation_keys(locale="zh-TW"):
    """從翻譯文件中提取所有 key"""
    keys = set()

    translation_file = Path(
        f"src/mcp_feedback_enhanced/web/locales/{locale}/translation.json"
    )
    if translation_file.exists():
        try:
            data = json.loads(translation_file.read_text(encoding="utf-8"))

            def extract_keys_recursive(obj, prefix=""):
                """遞迴提取所有 key"""
                if isinstance(obj, dict):
                    for key, value in obj.items():
                        full_key = f"{prefix}.{key}" if prefix else key
                        if isinstance(value, dict):
                            extract_keys_recursive(value, full_key)
                        else:
                            keys.add(full_key)

            extract_keys_recursive(data)
        except json.JSONDecodeError as e:
            print(f"❌ 無法解析翻譯文件 {translation_file}: {e}")

    return keys


def validate_message_codes():
    """執行驗證"""
    print("🔍 開始驗證訊息代碼一致性...\n")

    # 提取所有代碼
    backend_codes = extract_backend_codes()
    frontend_codes = extract_frontend_codes()

    # 提取所有語言的翻譯 key
    locales = ["zh-TW", "en", "zh-CN"]
    translation_keys = {}
    for locale in locales:
        translation_keys[locale] = extract_translation_keys(locale)

    # 統計資訊
    print("📊 統計資訊：")
    print(f"  - 後端訊息代碼數量: {len(backend_codes)}")
    print(f"  - 前端訊息代碼數量: {len(frontend_codes)}")
    for locale in locales:
        print(f"  - {locale} 翻譯 key 數量: {len(translation_keys[locale])}")
    print()

    # 驗證後端代碼是否都有前端定義
    print("🔍 檢查後端代碼是否都有前端定義...")
    missing_in_frontend = backend_codes - frontend_codes
    if missing_in_frontend:
        print("❌ 以下後端代碼在前端沒有定義:")
        for code in sorted(missing_in_frontend):
            print(f"   - {code}")
    else:
        print("✅ 所有後端代碼都有前端定義")
    print()

    # 驗證前端代碼是否都有翻譯
    print("🔍 檢查前端代碼是否都有翻譯...")
    all_frontend_codes = backend_codes | frontend_codes

    for locale in locales:
        print(f"\n  檢查 {locale} 翻譯:")
        missing_translations = set()

        for code in all_frontend_codes:
            if code not in translation_keys[locale]:
                missing_translations.add(code)

        if missing_translations:
            print("  ❌ 缺少以下翻譯:")
            for code in sorted(missing_translations):
                print(f"     - {code}")
        else:
            print("  ✅ 所有代碼都有翻譯")

    # 檢查是否有多餘的翻譯
    print("\n🔍 檢查是否有多餘的翻譯...")
    for locale in locales:
        # 過濾掉非訊息代碼的 key（如 buttons, labels 等）
        message_keys = {
            k
            for k in translation_keys[locale]
            if any(
                k.startswith(prefix)
                for prefix in [
                    "system.",
                    "session.",
                    "settings.",
                    "error.",
                    "command.",
                    "file.",
                    "prompt.",
                    "notification.",
                ]
            )
        }

        extra_translations = message_keys - all_frontend_codes
        if extra_translations:
            print(f"\n  {locale} 有多餘的翻譯:")
            for key in sorted(extra_translations):
                print(f"     - {key}")

    print("\n✅ 驗證完成！")

    # 返回是否有錯誤
    return len(missing_in_frontend) == 0 and all(
        len(
            [
                code
                for code in all_frontend_codes
                if code not in translation_keys[locale]
            ]
        )
        == 0
        for locale in locales
    )


if __name__ == "__main__":
    # 切換到專案根目錄
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    import os

    os.chdir(project_root)

    # 執行驗證
    success = validate_message_codes()
    sys.exit(0 if success else 1)
