#!/usr/bin/env python3
"""
國際化支援模組
===============

提供統一的多語系支援功能，支援繁體中文、英文等語言。
自動偵測系統語言，並提供語言切換功能。

新架構：
- 使用分離的 JSON 翻譯檔案
- 支援巢狀翻譯鍵值
- 元資料支援
- 易於擴充新語言

作者: Minidoracat
"""

import json
import locale
import os
from pathlib import Path
from typing import Any

from .debug import i18n_debug_log as debug_log


class I18nManager:
    """國際化管理器 - 新架構版本"""

    def __init__(self):
        self._current_language = None
        self._translations = {}
        self._supported_languages = ["zh-CN", "zh-TW", "en"]
        self._fallback_language = "zh-TW"
        self._config_file = self._get_config_file_path()
        self._locales_dir = Path(__file__).parent / "web" / "locales"

        # 載入翻譯
        self._load_all_translations()

        # 設定語言
        self._current_language = self._detect_language()

    def _get_config_file_path(self) -> Path:
        """獲取配置文件路徑"""
        config_dir = Path.home() / ".config" / "mcp-feedback-enhanced"
        config_dir.mkdir(parents=True, exist_ok=True)
        return config_dir / "language.json"

    def _load_all_translations(self) -> None:
        """載入所有語言的翻譯檔案"""
        self._translations = {}

        for lang_code in self._supported_languages:
            lang_dir = self._locales_dir / lang_code
            translation_file = lang_dir / "translation.json"

            if translation_file.exists():
                try:
                    with open(translation_file, encoding="utf-8") as f:
                        data = json.load(f)
                        self._translations[lang_code] = data
                        debug_log(
                            f"成功載入語言 {lang_code}: {data.get('meta', {}).get('displayName', lang_code)}"
                        )
                except Exception as e:
                    debug_log(f"載入語言檔案失敗 {lang_code}: {e}")
                    # 如果載入失敗，使用空的翻譯
                    self._translations[lang_code] = {}
            else:
                debug_log(f"找不到語言檔案: {translation_file}")
                self._translations[lang_code] = {}

    def _detect_language(self) -> str:
        """自動偵測語言"""
        # 1. 優先使用用戶保存的語言設定
        saved_lang = self._load_saved_language()
        if saved_lang and saved_lang in self._supported_languages:
            return saved_lang

        # 2. 檢查環境變數
        env_lang = os.getenv("MCP_LANGUAGE", "").strip()
        if env_lang and env_lang in self._supported_languages:
            return env_lang

        # 3. 檢查其他環境變數（LANG, LC_ALL 等）
        for env_var in ["LANG", "LC_ALL", "LC_MESSAGES", "LANGUAGE"]:
            env_value = os.getenv(env_var, "").strip()
            if env_value:
                if env_value.startswith("zh_TW") or env_value.startswith("zh_Hant"):
                    return "zh-TW"
                if env_value.startswith("zh_CN") or env_value.startswith("zh_Hans"):
                    return "zh-CN"
                if env_value.startswith("en"):
                    return "en"

        # 4. 自動偵測系統語言（僅在非測試模式下）
        if not os.getenv("MCP_TEST_MODE"):
            try:
                # 獲取系統語言
                system_locale = locale.getdefaultlocale()[0]
                if system_locale:
                    if system_locale.startswith("zh_TW") or system_locale.startswith(
                        "zh_Hant"
                    ):
                        return "zh-TW"
                    if system_locale.startswith("zh_CN") or system_locale.startswith(
                        "zh_Hans"
                    ):
                        return "zh-CN"
                    if system_locale.startswith("en"):
                        return "en"
            except Exception:
                pass

        # 5. 回退到默認語言
        return self._fallback_language

    def _load_saved_language(self) -> str | None:
        """載入保存的語言設定"""
        try:
            if self._config_file.exists():
                with open(self._config_file, encoding="utf-8") as f:
                    config = json.load(f)
                    language = config.get("language")
                    return language if isinstance(language, str) else None
        except Exception:
            pass
        return None

    def save_language(self, language: str) -> None:
        """保存語言設定"""
        try:
            config = {"language": language}
            with open(self._config_file, "w", encoding="utf-8") as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    def get_current_language(self) -> str:
        """獲取當前語言"""
        return self._current_language or "zh-TW"

    def set_language(self, language: str) -> bool:
        """設定語言"""
        if language in self._supported_languages:
            self._current_language = language
            self.save_language(language)
            return True
        return False

    def get_supported_languages(self) -> list[str]:
        """獲取支援的語言列表"""
        return self._supported_languages.copy()

    def get_language_info(self, language_code: str) -> dict[str, Any]:
        """獲取語言的元資料信息"""
        if language_code in self._translations:
            meta = self._translations[language_code].get("meta", {})
            return meta if isinstance(meta, dict) else {}
        return {}

    def _get_nested_value(self, data: dict[str, Any], key_path: str) -> str | None:
        """從巢狀字典中獲取值，支援點分隔的鍵路徑"""
        keys = key_path.split(".")
        current: Any = data

        for key in keys:
            if isinstance(current, dict) and key in current:
                current = current[key]
            else:
                return None

        return str(current) if isinstance(current, str) else None

    def t(self, key: str, **kwargs) -> str:
        """
        翻譯函數 - 支援新舊兩種鍵值格式

        新格式: 'buttons.submit' -> data['buttons']['submit']
        舊格式: 'btn_submit_feedback' -> 兼容舊的鍵值
        """
        # 獲取當前語言的翻譯
        current_translations = self._translations.get(self._current_language, {})

        # 嘗試新格式（巢狀鍵）
        text = self._get_nested_value(current_translations, key)

        # 如果沒有找到，嘗試舊格式的兼容映射
        if text is None:
            text = self._get_legacy_translation(current_translations, key)

        # 如果還是沒有找到，嘗試使用回退語言
        if text is None:
            fallback_translations = self._translations.get(self._fallback_language, {})
            text = self._get_nested_value(fallback_translations, key)
            if text is None:
                text = self._get_legacy_translation(fallback_translations, key)

        # 最後回退到鍵本身
        if text is None:
            text = key

        # 處理格式化參數
        if kwargs:
            try:
                text = text.format(**kwargs)
            except (KeyError, ValueError):
                pass

        return text

    def _get_legacy_translation(
        self, translations: dict[str, Any], key: str
    ) -> str | None:
        """獲取舊格式翻譯的兼容方法"""
        # 舊鍵到新鍵的映射
        legacy_mapping = {
            # 應用程式
            "app_title": "app.title",
            "project_directory": "app.projectDirectory",
            "language": "app.language",
            "settings": "app.settings",
            # 分頁
            "feedback_tab": "tabs.feedback",
            "command_tab": "tabs.command",
            "images_tab": "tabs.images",
            # 回饋
            "feedback_title": "feedback.title",
            "feedback_description": "feedback.description",
            "feedback_placeholder": "feedback.placeholder",
            # 命令
            "command_title": "command.title",
            "command_description": "command.description",
            "command_placeholder": "command.placeholder",
            "command_output": "command.output",
            # 圖片
            "images_title": "images.title",
            "images_select": "images.select",
            "images_paste": "images.paste",
            "images_clear": "images.clear",
            "images_status": "images.status",
            "images_status_with_size": "images.statusWithSize",
            "images_drag_hint": "images.dragHint",
            "images_delete_confirm": "images.deleteConfirm",
            "images_delete_title": "images.deleteTitle",
            "images_size_warning": "images.sizeWarning",
            "images_format_error": "images.formatError",
            # 按鈕
            "submit": "buttons.submit",
            "cancel": "buttons.cancel",
            "close": "buttons.close",
            "clear": "buttons.clear",
            "btn_submit_feedback": "buttons.submitFeedback",
            "btn_cancel": "buttons.cancel",
            "btn_select_files": "buttons.selectFiles",
            "btn_paste_clipboard": "buttons.pasteClipboard",
            "btn_clear_all": "buttons.clearAll",
            "btn_run_command": "buttons.runCommand",
            # 狀態
            "feedback_submitted": "status.feedbackSubmitted",
            "feedback_cancelled": "status.feedbackCancelled",
            "timeout_message": "status.timeoutMessage",
            "error_occurred": "status.errorOccurred",
            "loading": "status.loading",
            "connecting": "status.connecting",
            "connected": "status.connected",
            "disconnected": "status.disconnected",
            "uploading": "status.uploading",
            "upload_success": "status.uploadSuccess",
            "upload_failed": "status.uploadFailed",
            "command_running": "status.commandRunning",
            "command_finished": "status.commandFinished",
            "paste_success": "status.pasteSuccess",
            "paste_failed": "status.pasteFailed",
            "invalid_file_type": "status.invalidFileType",
            "file_too_large": "status.fileTooLarge",
            # 其他
            "ai_summary": "aiSummary",
            "language_selector": "languageSelector",
            "language_zh_tw": "languageNames.zhTw",
            "language_en": "languageNames.en",
            "language_zh_cn": "languageNames.zhCn",
            # 測試
            "test_web_ui_summary": "test.webUiSummary",
        }

        # 檢查是否有對應的新鍵
        new_key = legacy_mapping.get(key)
        if new_key:
            return self._get_nested_value(translations, new_key)

        return None

    def get_language_display_name(self, language_code: str) -> str:
        """獲取語言的顯示名稱"""
        # 直接從當前語言的翻譯中獲取，避免遞歸
        current_translations = self._translations.get(self._current_language, {})

        # 根據語言代碼構建鍵值
        lang_key = None
        if language_code == "zh-TW":
            lang_key = "languageNames.zhTw"
        elif language_code == "zh-CN":
            lang_key = "languageNames.zhCn"
        elif language_code == "en":
            lang_key = "languageNames.en"
        else:
            # 通用格式
            lang_key = f"languageNames.{language_code.replace('-', '').lower()}"

        # 直接獲取翻譯，避免調用 self.t() 產生遞歸
        if lang_key:
            display_name = self._get_nested_value(current_translations, lang_key)
            if display_name:
                return display_name

        # 回退到元資料中的顯示名稱
        meta = self.get_language_info(language_code)
        display_name = meta.get("displayName", language_code)
        return str(display_name) if display_name else language_code

    def reload_translations(self) -> None:
        """重新載入所有翻譯檔案（開發時使用）"""
        self._load_all_translations()

    def add_language(self, language_code: str, translation_file_path: str) -> bool:
        """動態添加新語言支援"""
        try:
            translation_file = Path(translation_file_path)
            if not translation_file.exists():
                return False

            with open(translation_file, encoding="utf-8") as f:
                data = json.load(f)
                self._translations[language_code] = data

                if language_code not in self._supported_languages:
                    self._supported_languages.append(language_code)

                debug_log(
                    f"成功添加語言 {language_code}: {data.get('meta', {}).get('displayName', language_code)}"
                )
                return True
        except Exception as e:
            debug_log(f"添加語言失敗 {language_code}: {e}")
            return False


# 全域的國際化管理器實例
_i18n_manager = None


def get_i18n_manager() -> I18nManager:
    """獲取全域的國際化管理器實例"""
    global _i18n_manager
    if _i18n_manager is None:
        _i18n_manager = I18nManager()
    return _i18n_manager


def t(key: str, **kwargs) -> str:
    """便捷的翻譯函數"""
    return get_i18n_manager().t(key, **kwargs)


def set_language(language: str) -> bool:
    """設定語言"""
    return get_i18n_manager().set_language(language)


def get_current_language() -> str:
    """獲取當前語言"""
    return get_i18n_manager().get_current_language()


def reload_translations() -> None:
    """重新載入翻譯（開發用）"""
    get_i18n_manager().reload_translations()
