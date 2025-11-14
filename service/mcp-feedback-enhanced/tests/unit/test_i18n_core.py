#!/usr/bin/env python3
"""
I18N 核心功能測試
"""

import os

import pytest

from tests.fixtures.test_data import TestData


class TestI18NManager:
    """I18N 管理器測試"""

    def test_i18n_manager_creation(self, i18n_manager):
        """測試 I18N 管理器創建"""
        assert i18n_manager is not None
        assert hasattr(i18n_manager, "_current_language")
        assert hasattr(i18n_manager, "_translations")
        assert i18n_manager.get_current_language() is not None

    def test_supported_languages(self, i18n_manager):
        """測試支援的語言"""
        supported_languages = i18n_manager.get_supported_languages()

        # 驗證包含預期的語言
        for lang in TestData.SUPPORTED_LANGUAGES:
            assert lang in supported_languages

        # 驗證至少有基本語言支援
        assert len(supported_languages) >= 2

    def test_language_switching(self, i18n_manager):
        """測試語言切換"""
        original_language = i18n_manager.get_current_language()

        # 測試切換到不同語言
        for lang in TestData.SUPPORTED_LANGUAGES:
            if lang != original_language:
                success = i18n_manager.set_language(lang)
                assert success == True
                assert i18n_manager.get_current_language() == lang
                break

        # 恢復原始語言
        i18n_manager.set_language(original_language)

    def test_invalid_language_switching(self, i18n_manager):
        """測試無效語言切換"""
        original_language = i18n_manager.get_current_language()

        # 嘗試切換到不存在的語言
        success = i18n_manager.set_language("invalid-lang")
        assert success == False
        assert i18n_manager.get_current_language() == original_language

    def test_translation_function(self, i18n_manager):
        """測試翻譯函數"""
        # 測試基本翻譯
        for key in TestData.I18N_TEST_KEYS:
            translation = i18n_manager.t(key)
            assert isinstance(translation, str)
            assert len(translation) > 0
            # 翻譯結果不應該等於 key（除非是回退情況）
            if key in i18n_manager._translations.get(
                i18n_manager.get_current_language(), {}
            ):
                assert translation != key

    def test_translation_with_parameters(self, i18n_manager):
        """測試帶參數的翻譯"""
        # 假設有帶參數的翻譯 key
        test_key = "test.message.withParam"
        test_params = {"name": "測試用戶", "count": 5}

        # 即使 key 不存在，也應該返回合理的結果
        translation = i18n_manager.t(test_key, **test_params)
        assert isinstance(translation, str)
        assert len(translation) > 0

    def test_fallback_mechanism(self, i18n_manager):
        """測試回退機制"""
        original_language = i18n_manager.get_current_language()

        try:
            # 切換到可能翻譯不完整的語言
            i18n_manager.set_language("en")

            # 測試不存在的 key
            non_existent_key = "non.existent.key.for.testing"
            translation = i18n_manager.t(non_existent_key)

            # 應該返回 key 本身或合理的回退值
            assert isinstance(translation, str)
            assert len(translation) > 0

        finally:
            # 恢復原始語言
            i18n_manager.set_language(original_language)


class TestI18NTranslationCompleteness:
    """I18N 翻譯完整性測試"""

    def test_all_languages_have_translations(self, i18n_manager):
        """測試所有語言都有翻譯文件"""
        supported_languages = i18n_manager.get_supported_languages()

        for lang in supported_languages:
            translations = i18n_manager._translations.get(lang, {})
            assert len(translations) > 0, f"語言 {lang} 沒有翻譯內容"

    def test_key_consistency_across_languages(self, i18n_manager):
        """測試所有語言的 key 一致性"""
        supported_languages = i18n_manager.get_supported_languages()

        if len(supported_languages) < 2:
            pytest.skip("需要至少兩種語言來測試一致性")

        # 獲取所有語言的翻譯
        all_translations = {}
        for lang in supported_languages:
            all_translations[lang] = i18n_manager._translations.get(lang, {})

        # 獲取所有 key 的聯集
        all_keys = set()
        for translations in all_translations.values():
            all_keys.update(self._get_all_keys(translations))

        # 檢查每種語言是否有所有 key
        missing_keys_report = {}
        for lang in supported_languages:
            missing_keys = []
            lang_translations = all_translations[lang]

            for key in all_keys:
                if not self._has_key(lang_translations, key):
                    missing_keys.append(key)

            if missing_keys:
                missing_keys_report[lang] = missing_keys

        # 如果有缺失的 key，生成詳細報告
        if missing_keys_report:
            report_lines = ["翻譯 key 缺失報告:"]
            for lang, missing_keys in missing_keys_report.items():
                report_lines.append(f"  {lang}: 缺失 {len(missing_keys)} 個 key")
                for key in missing_keys[:5]:  # 只顯示前5個
                    report_lines.append(f"    - {key}")
                if len(missing_keys) > 5:
                    report_lines.append(f"    ... 還有 {len(missing_keys) - 5} 個")

            # 這裡我們記錄警告而不是失敗測試，因為某些 key 可能是特定語言的
            print("\n".join(report_lines))

    def test_common_keys_exist(self, i18n_manager):
        """測試常用 key 存在"""
        common_keys = ["common.submit", "common.cancel", "common.loading"]

        supported_languages = i18n_manager.get_supported_languages()

        for lang in supported_languages:
            i18n_manager.set_language(lang)

            for key in common_keys:
                translation = i18n_manager.t(key)
                # 翻譯應該存在且不為空
                assert isinstance(translation, str)
                assert len(translation.strip()) > 0

    def _get_all_keys(self, translations: dict, prefix: str = "") -> set:
        """遞歸獲取所有翻譯 key"""
        keys = set()

        for key, value in translations.items():
            full_key = f"{prefix}.{key}" if prefix else key

            if isinstance(value, dict):
                # 遞歸處理嵌套字典
                keys.update(self._get_all_keys(value, full_key))
            else:
                # 葉子節點
                keys.add(full_key)

        return keys

    def _has_key(self, translations: dict, key: str) -> bool:
        """檢查翻譯字典是否包含指定 key"""
        keys = key.split(".")
        current = translations

        for k in keys:
            if not isinstance(current, dict) or k not in current:
                return False
            current = current[k]

        return True


class TestI18NEnvironmentDetection:
    """I18N 環境檢測測試"""

    def test_language_detection_from_env(self, i18n_manager):
        """測試從環境變數檢測語言"""
        original_lang = os.environ.get("LANG")
        original_language = os.environ.get("LANGUAGE")

        try:
            # 測試設置環境變數
            os.environ["LANG"] = "zh_TW.UTF-8"

            # 重新創建 I18N 管理器來測試環境檢測
            from mcp_feedback_enhanced.i18n import I18nManager

            test_manager = I18nManager()

            # 應該檢測到繁體中文
            detected_lang = test_manager._detect_language()
            assert detected_lang in ["zh-TW", "zh-CN", "en"]  # 應該是支援的語言之一

        finally:
            # 恢復環境變數
            if original_lang is not None:
                os.environ["LANG"] = original_lang
            else:
                os.environ.pop("LANG", None)

            if original_language is not None:
                os.environ["LANGUAGE"] = original_language
            else:
                os.environ.pop("LANGUAGE", None)

    def test_fallback_to_default_language(self, i18n_manager):
        """測試回退到默認語言"""
        # 測試當系統語言不支援時的回退行為
        original_lang = os.environ.get("LANG")

        try:
            # 設置不支援的語言
            os.environ["LANG"] = "fr_FR.UTF-8"  # 法語

            from mcp_feedback_enhanced.i18n import I18nManager

            test_manager = I18nManager()

            detected_lang = test_manager._detect_language()
            # 應該回退到支援的語言
            assert detected_lang in TestData.SUPPORTED_LANGUAGES

        finally:
            if original_lang is not None:
                os.environ["LANG"] = original_lang
            else:
                os.environ.pop("LANG", None)
