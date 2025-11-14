/**
 * MCP Feedback Enhanced - 設定管理模組
 * ==================================
 * 
 * 處理應用程式設定的載入、保存和同步
 */

(function() {
    'use strict';

    // 確保命名空間和依賴存在
    window.MCPFeedback = window.MCPFeedback || {};
    const Utils = window.MCPFeedback.Utils;

    // 創建模組專用日誌器
    const logger = window.MCPFeedback.Logger ?
        new window.MCPFeedback.Logger({ moduleName: 'SettingsManager' }) :
        console;

    /**
     * 設定管理器建構函數
     */
    function SettingsManager(options) {
        options = options || {};
        
        // 從 i18nManager 獲取當前語言作為預設值
        const defaultLanguage = window.i18nManager ? window.i18nManager.getCurrentLanguage() : 'zh-TW';
        
        // 預設設定
        this.defaultSettings = {
            layoutMode: 'combined-vertical',
            autoClose: false,
            language: defaultLanguage,  // 使用 i18nManager 的當前語言
            imageSizeLimit: 0,
            enableBase64Detail: false,
            // 移除 activeTab - 頁籤切換無需持久化
            sessionPanelCollapsed: false,
            // 自動定時提交設定
            autoSubmitEnabled: false,
            autoSubmitTimeout: 30,
            autoSubmitPromptId: null,
            // 音效通知設定
            audioNotificationEnabled: false,
            audioNotificationVolume: 50,
            selectedAudioId: 'default-beep',
            customAudios: [],
            // 會話歷史設定
            sessionHistoryRetentionHours: 72,
            // 用戶訊息記錄設定
            userMessageRecordingEnabled: true,
            userMessagePrivacyLevel: 'full', // 'full', 'basic', 'disabled'
            // UI 元素尺寸設定
            combinedFeedbackTextHeight: 150, // combinedFeedbackText textarea 的高度（px）
            // 會話超時設定
            sessionTimeoutEnabled: false,  // 預設關閉
            sessionTimeoutSeconds: 3600,   // 預設 1 小時（秒）
            // 自動執行命令設定
            autoCommandEnabled: true,      // 是否啟用自動執行命令
            commandOnNewSession: '',       // 新會話建立時執行的命令
            commandOnFeedbackSubmit: ''    // 提交回饋後執行的命令
        };
        
        // 當前設定
        this.currentSettings = Utils.deepClone(this.defaultSettings);
        
        // 回調函數
        this.onSettingsChange = options.onSettingsChange || null;
        this.onLanguageChange = options.onLanguageChange || null;
        this.onAutoSubmitStateChange = options.onAutoSubmitStateChange || null;

        console.log('✅ SettingsManager 建構函數初始化完成 - 即時保存模式');
    }

    /**
     * 載入設定
     */
    SettingsManager.prototype.loadSettings = function() {
        const self = this;
        
        return new Promise(function(resolve, reject) {
            logger.info('開始載入設定...');

            // 只從伺服器端載入設定
            self.loadFromServer()
                .then(function(serverSettings) {
                    if (serverSettings && Object.keys(serverSettings).length > 0) {
                        self.currentSettings = self.mergeSettings(self.defaultSettings, serverSettings);
                        logger.info('從伺服器端載入設定成功:', self.currentSettings);
                    } else {
                        console.log('沒有找到設定，使用預設值');
                        self.currentSettings = Utils.deepClone(self.defaultSettings);
                    }
                    
                    // 同步語言設定到 i18nManager
                    if (self.currentSettings.language && window.i18nManager) {
                        const currentI18nLanguage = window.i18nManager.getCurrentLanguage();
                        if (self.currentSettings.language !== currentI18nLanguage) {
                            console.log('🔧 SettingsManager.loadSettings: 同步語言設定到 i18nManager');
                            console.log('  從:', currentI18nLanguage, '到:', self.currentSettings.language);
                            window.i18nManager.setLanguage(self.currentSettings.language);
                        }
                    }
                    
                    resolve(self.currentSettings);
                })
                .catch(function(error) {
                    console.error('載入設定失敗:', error);
                    self.currentSettings = Utils.deepClone(self.defaultSettings);
                    resolve(self.currentSettings);
                });
        });
    };

    /**
     * 從伺服器載入設定
     */
    SettingsManager.prototype.loadFromServer = function() {
        const lang = window.i18nManager ? window.i18nManager.getCurrentLanguage() : 'zh-TW';
        return fetch('/api/load-settings?lang=' + lang)
            .then(function(response) {
                if (response.ok) {
                    return response.json();
                } else {
                    throw new Error('伺服器回應錯誤: ' + response.status);
                }
            })
            .catch(function(error) {
                console.warn('從伺服器端載入設定失敗:', error);
                return null;
            });
    };



    /**
     * 保存設定
     */
    SettingsManager.prototype.saveSettings = function(newSettings) {
        if (newSettings) {
            this.currentSettings = this.mergeSettings(this.currentSettings, newSettings);
        }

        logger.debug('保存設定:', this.currentSettings);

        // 只保存到伺服器端
        this.saveToServer();

        // 觸發回調
        if (this.onSettingsChange) {
            this.onSettingsChange(this.currentSettings);
        }

        return this.currentSettings;
    };



    /**
     * 保存到伺服器（即時保存）
     */
    SettingsManager.prototype.saveToServer = function() {
        this._performServerSave();
    };

    /**
     * 執行實際的伺服器保存操作
     */
    SettingsManager.prototype._performServerSave = function() {
        const self = this;

        const lang = window.i18nManager ? window.i18nManager.getCurrentLanguage() : 'zh-TW';
        fetch('/api/save-settings?lang=' + lang, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(self.currentSettings)
        })
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            if (data.status === 'success') {
                console.log('設定已即時同步到伺服器端');
                // 處理訊息代碼
                if (data.messageCode && window.i18nManager) {
                    const message = window.i18nManager.t(data.messageCode, data.params);
                    console.log('伺服器回應:', message);
                }
            } else {
                console.warn('同步設定到伺服器端失敗:', data);
            }
        })
        .catch(function(error) {
            console.warn('同步設定到伺服器端時發生錯誤:', error);
        });
    };



    /**
     * 合併設定
     */
    SettingsManager.prototype.mergeSettings = function(defaultSettings, newSettings) {
        const merged = Utils.deepClone(defaultSettings);
        
        for (const key in newSettings) {
            if (newSettings.hasOwnProperty(key)) {
                merged[key] = newSettings[key];
            }
        }
        
        return merged;
    };

    /**
     * 獲取設定值
     */
    SettingsManager.prototype.get = function(key, defaultValue) {
        if (key in this.currentSettings) {
            return this.currentSettings[key];
        }
        return defaultValue !== undefined ? defaultValue : this.defaultSettings[key];
    };

    /**
     * 設置設定值
     */
    SettingsManager.prototype.set = function(key, value) {
        const oldValue = this.currentSettings[key];
        this.currentSettings[key] = value;

        // 特殊處理語言變更
        if (key === 'language' && oldValue !== value) {
            this.handleLanguageChange(value);
        }

        // 所有設定變更都即時保存
        this.saveSettings();

        return this;
    };

    /**
     * 批量設置設定
     */
    SettingsManager.prototype.setMultiple = function(settings) {
        let languageChanged = false;
        const oldLanguage = this.currentSettings.language;
        
        for (const key in settings) {
            if (settings.hasOwnProperty(key)) {
                this.currentSettings[key] = settings[key];
                
                if (key === 'language' && oldLanguage !== settings[key]) {
                    languageChanged = true;
                }
            }
        }
        
        if (languageChanged) {
            this.handleLanguageChange(this.currentSettings.language);
        }
        
        this.saveSettings();
        return this;
    };

    /**
     * 處理語言變更
     */
    SettingsManager.prototype.handleLanguageChange = function(newLanguage) {
        console.log('🔄 SettingsManager.handleLanguageChange: ' + newLanguage);

        // 通知國際化系統（統一由 SettingsManager 管理）
        if (window.i18nManager) {
            // 使用 setLanguage 方法確保正確更新
            window.i18nManager.setLanguage(newLanguage);
        }

        // 延遲更新動態文字，確保 i18n 已經載入新語言
        setTimeout(() => {
            this.updatePrivacyLevelDescription(this.currentSettings.userMessagePrivacyLevel);
        }, 100);

        // 觸發語言變更回調
        if (this.onLanguageChange) {
            this.onLanguageChange(newLanguage);
        }
    };

    /**
     * 重置設定
     */
    SettingsManager.prototype.resetSettings = function() {
        console.log('重置所有設定');

        // 重置為預設值
        this.currentSettings = Utils.deepClone(this.defaultSettings);

        // 立即保存重置後的設定到伺服器
        this.saveToServer();

        // 觸發回調
        if (this.onSettingsChange) {
            this.onSettingsChange(this.currentSettings);
        }

        return this.currentSettings;
    };

    /**
     * 驗證自動提交設定
     */
    SettingsManager.prototype.validateAutoSubmitSettings = function(settings) {
        const errors = [];

        // 驗證超時時間
        if (settings.autoSubmitTimeout !== undefined) {
            const timeout = parseInt(settings.autoSubmitTimeout);
            if (isNaN(timeout) || timeout < 1) {
                errors.push('自動提交時間必須大於等於 1 秒');
            } else if (timeout > 86400) { // 24 小時
                errors.push('自動提交時間不能超過 24 小時');
            }
        }

        // 驗證提示詞 ID
        if (settings.autoSubmitEnabled && !settings.autoSubmitPromptId) {
            errors.push('啟用自動提交時必須選擇一個提示詞');
        }

        return errors;
    };

    /**
     * 設定自動提交功能
     */
    SettingsManager.prototype.setAutoSubmitSettings = function(enabled, timeout, promptId) {
        const newSettings = {
            autoSubmitEnabled: Boolean(enabled),
            autoSubmitTimeout: parseInt(timeout) || 30,
            autoSubmitPromptId: promptId || null
        };

        // 驗證設定
        const errors = this.validateAutoSubmitSettings(newSettings);
        if (errors.length > 0) {
            throw new Error(errors.join('; '));
        }

        // 如果停用自動提交，清除提示詞 ID
        if (!newSettings.autoSubmitEnabled) {
            newSettings.autoSubmitPromptId = null;
        }

        // 更新設定
        this.set('autoSubmitEnabled', newSettings.autoSubmitEnabled);
        this.set('autoSubmitTimeout', newSettings.autoSubmitTimeout);
        this.set('autoSubmitPromptId', newSettings.autoSubmitPromptId);

        console.log('自動提交設定已更新:', newSettings);
        return newSettings;
    };

    /**
     * 獲取自動提交設定
     */
    SettingsManager.prototype.getAutoSubmitSettings = function() {
        return {
            enabled: this.get('autoSubmitEnabled'),
            timeout: this.get('autoSubmitTimeout'),
            promptId: this.get('autoSubmitPromptId')
        };
    };

    /**
     * 觸發自動提交狀態變更事件
     */
    SettingsManager.prototype.triggerAutoSubmitStateChange = function(enabled) {
        if (this.onAutoSubmitStateChange) {
            const settings = this.getAutoSubmitSettings();
            console.log('🔍 triggerAutoSubmitStateChange 調試:', {
                enabled: enabled,
                settings: settings,
                currentSettings: this.currentSettings
            });
            this.onAutoSubmitStateChange(enabled, settings);
        }

        console.log('自動提交狀態變更:', enabled ? '啟用' : '停用');
    };

    /**
     * 獲取所有設定
     */
    SettingsManager.prototype.getAllSettings = function() {
        return Utils.deepClone(this.currentSettings);
    };

    /**
     * 應用設定到 UI
     */
    SettingsManager.prototype.applyToUI = function() {
        console.log('應用設定到 UI');
        
        // 應用佈局模式
        this.applyLayoutMode();
        
        // 應用自動關閉設定
        this.applyAutoCloseToggle();
        
        // 應用語言設定
        this.applyLanguageSettings();
        
        // 應用圖片設定
        this.applyImageSettings();

        // 應用自動提交設定
        this.applyAutoSubmitSettingsToUI();

        // 應用會話歷史設定
        this.applySessionHistorySettings();

        // 應用用戶訊息記錄設定
        this.applyUserMessageSettings();
        
        // 應用會話超時設定
        this.applySessionTimeoutSettings();
    };

    /**
     * 應用佈局模式
     */
    SettingsManager.prototype.applyLayoutMode = function() {
        const layoutModeInputs = document.querySelectorAll('input[name="layoutMode"]');
        layoutModeInputs.forEach(function(input) {
            input.checked = input.value === this.currentSettings.layoutMode;
        }.bind(this));

        const expectedClassName = 'layout-' + this.currentSettings.layoutMode;
        if (document.body.className !== expectedClassName) {
            console.log('應用佈局模式: ' + this.currentSettings.layoutMode);
            document.body.className = expectedClassName;
        }
    };

    /**
     * 應用自動關閉設定
     */
    SettingsManager.prototype.applyAutoCloseToggle = function() {
        const autoCloseToggle = Utils.safeQuerySelector('#autoCloseToggle');
        if (autoCloseToggle) {
            autoCloseToggle.classList.toggle('active', this.currentSettings.autoClose);
        }
    };

    /**
     * 應用語言設定
     */
    SettingsManager.prototype.applyLanguageSettings = function() {
        if (this.currentSettings.language && window.i18nManager) {
            const currentI18nLanguage = window.i18nManager.getCurrentLanguage();
            if (this.currentSettings.language !== currentI18nLanguage) {
                console.log('應用語言設定: ' + currentI18nLanguage + ' -> ' + this.currentSettings.language);
                window.i18nManager.setLanguage(this.currentSettings.language);
            }
        }

        // 更新下拉選單選項
        const languageSelect = Utils.safeQuerySelector('#settingsLanguageSelect');
        if (languageSelect) {
            console.log(`🔧 SettingsManager.applyLanguageSettings: 設置 select.value = ${this.currentSettings.language}`);
            languageSelect.value = this.currentSettings.language;
            console.log(`🔧 SettingsManager.applyLanguageSettings: 實際 select.value = ${languageSelect.value}`);
        }

        // 更新語言選項顯示（兼容舊版卡片式選擇器）
        const languageOptions = document.querySelectorAll('.language-option');
        languageOptions.forEach(function(option) {
            option.classList.toggle('active', option.getAttribute('data-lang') === this.currentSettings.language);
        }.bind(this));
    };

    /**
     * 應用圖片設定
     */
    SettingsManager.prototype.applyImageSettings = function() {
        // 更新所有圖片大小限制選擇器（包括設定頁籤中的）
        const imageSizeLimitSelects = document.querySelectorAll('[id$="ImageSizeLimit"]');
        imageSizeLimitSelects.forEach(function(select) {
            select.value = this.currentSettings.imageSizeLimit.toString();
        }.bind(this));

        // 更新所有 Base64 相容模式複選框（包括設定頁籤中的）
        const enableBase64DetailCheckboxes = document.querySelectorAll('[id$="EnableBase64Detail"]');
        enableBase64DetailCheckboxes.forEach(function(checkbox) {
            checkbox.checked = this.currentSettings.enableBase64Detail;
        }.bind(this));

        console.log('圖片設定已應用到 UI:', {
            imageSizeLimit: this.currentSettings.imageSizeLimit,
            enableBase64Detail: this.currentSettings.enableBase64Detail
        });
    };

    /**
     * 應用自動提交設定到 UI
     */
    SettingsManager.prototype.applyAutoSubmitSettingsToUI = function() {
        // 更新自動提交啟用開關
        const autoSubmitToggle = Utils.safeQuerySelector('#autoSubmitToggle');
        if (autoSubmitToggle) {
            autoSubmitToggle.classList.toggle('active', this.currentSettings.autoSubmitEnabled);
        }

        // 更新自動提交超時時間輸入框
        const autoSubmitTimeoutInput = Utils.safeQuerySelector('#autoSubmitTimeout');
        if (autoSubmitTimeoutInput) {
            autoSubmitTimeoutInput.value = this.currentSettings.autoSubmitTimeout;
        }

        // 更新自動提交提示詞選擇下拉選單
        const autoSubmitPromptSelect = Utils.safeQuerySelector('#autoSubmitPromptSelect');
        if (autoSubmitPromptSelect) {
            autoSubmitPromptSelect.value = this.currentSettings.autoSubmitPromptId || '';
        }

        // 更新自動提交狀態顯示
        this.updateAutoSubmitStatusDisplay();

        console.log('自動提交設定已應用到 UI:', {
            enabled: this.currentSettings.autoSubmitEnabled,
            timeout: this.currentSettings.autoSubmitTimeout,
            promptId: this.currentSettings.autoSubmitPromptId
        });
    };

    /**
     * 更新自動提交狀態顯示
     */
    SettingsManager.prototype.updateAutoSubmitStatusDisplay = function() {
        const statusElement = Utils.safeQuerySelector('#autoSubmitStatus');
        if (!statusElement) return;

        const statusIcon = statusElement.querySelector('span:first-child');
        const statusText = statusElement.querySelector('.button-text');

        if (this.currentSettings.autoSubmitEnabled && this.currentSettings.autoSubmitPromptId) {
            // 直接設定 HTML 內容，就像提示詞按鈕一樣
            if (statusIcon) statusIcon.innerHTML = '⏰';
            if (statusText) {
                const enabledText = window.i18nManager ?
                    window.i18nManager.t('autoSubmit.enabled', '已啟用') :
                    '已啟用';
                statusText.textContent = `${enabledText} (${this.currentSettings.autoSubmitTimeout}秒)`;
            }
            statusElement.className = 'auto-submit-status-btn enabled';
        } else {
            // 直接設定 HTML 內容，就像提示詞按鈕一樣
            if (statusIcon) statusIcon.innerHTML = '⏸️';
            if (statusText) {
                const disabledText = window.i18nManager ?
                    window.i18nManager.t('autoSubmit.disabled', '已停用') :
                    '已停用';
                statusText.textContent = disabledText;
            }
            statusElement.className = 'auto-submit-status-btn disabled';
        }
    };

    /**
     * 應用會話歷史設定
     */
    SettingsManager.prototype.applySessionHistorySettings = function() {
        // 更新會話歷史保存期限選擇器
        const sessionHistoryRetentionSelect = Utils.safeQuerySelector('#sessionHistoryRetentionHours');
        if (sessionHistoryRetentionSelect) {
            sessionHistoryRetentionSelect.value = this.currentSettings.sessionHistoryRetentionHours.toString();
        }

        console.log('會話歷史設定已應用到 UI:', {
            retentionHours: this.currentSettings.sessionHistoryRetentionHours
        });
    };

    /**
     * 應用用戶訊息記錄設定
     */
    SettingsManager.prototype.applyUserMessageSettings = function() {
        // 更新用戶訊息記錄啟用開關
        const userMessageRecordingToggle = Utils.safeQuerySelector('#userMessageRecordingToggle');
        if (userMessageRecordingToggle) {
            userMessageRecordingToggle.checked = this.currentSettings.userMessageRecordingEnabled;
        }

        // 更新隱私等級選擇器
        const userMessagePrivacySelect = Utils.safeQuerySelector('#userMessagePrivacyLevel');
        if (userMessagePrivacySelect) {
            userMessagePrivacySelect.value = this.currentSettings.userMessagePrivacyLevel;
        }

        console.log('用戶訊息記錄設定已應用到 UI:', {
            recordingEnabled: this.currentSettings.userMessageRecordingEnabled,
            privacyLevel: this.currentSettings.userMessagePrivacyLevel
        });

        // 更新隱私等級描述
        this.updatePrivacyLevelDescription(this.currentSettings.userMessagePrivacyLevel);
    };

    /**
     * 應用會話超時設定
     */
    SettingsManager.prototype.applySessionTimeoutSettings = function() {
        // 更新會話超時啟用開關
        const sessionTimeoutEnabled = Utils.safeQuerySelector('#sessionTimeoutEnabled');
        if (sessionTimeoutEnabled) {
            sessionTimeoutEnabled.checked = this.currentSettings.sessionTimeoutEnabled;
        }

        // 更新會話超時時間輸入框
        const sessionTimeoutSeconds = Utils.safeQuerySelector('#sessionTimeoutSeconds');
        if (sessionTimeoutSeconds) {
            sessionTimeoutSeconds.value = this.currentSettings.sessionTimeoutSeconds;
        }

        console.log('會話超時設定已應用到 UI:', {
            enabled: this.currentSettings.sessionTimeoutEnabled,
            seconds: this.currentSettings.sessionTimeoutSeconds
        });
    };

    /**
     * 更新隱私等級描述文字
     */
    SettingsManager.prototype.updatePrivacyLevelDescription = function(privacyLevel) {
        const descriptionElement = Utils.safeQuerySelector('#userMessagePrivacyDescription');
        if (!descriptionElement || !window.i18nManager) {
            return;
        }

        let descriptionKey = '';
        switch (privacyLevel) {
            case 'full':
                descriptionKey = 'sessionHistory.userMessages.privacyDescription.full';
                break;
            case 'basic':
                descriptionKey = 'sessionHistory.userMessages.privacyDescription.basic';
                break;
            case 'disabled':
                descriptionKey = 'sessionHistory.userMessages.privacyDescription.disabled';
                break;
            default:
                descriptionKey = 'sessionHistory.userMessages.privacyDescription.full';
        }

        // 更新 data-i18n 屬性，這樣在語言切換時會自動更新
        descriptionElement.setAttribute('data-i18n', descriptionKey);

        // 立即更新文字內容
        const description = window.i18nManager.t(descriptionKey);
        descriptionElement.textContent = description;
    };

    /**
     * 設置事件監聽器
     */
    SettingsManager.prototype.setupEventListeners = function() {
        const self = this;
        
        // 佈局模式切換
        const layoutModeInputs = document.querySelectorAll('input[name="layoutMode"]');
        layoutModeInputs.forEach(function(input) {
            input.addEventListener('change', function(e) {
                self.set('layoutMode', e.target.value);
            });
        });

        // 自動關閉切換
        const autoCloseToggle = Utils.safeQuerySelector('#autoCloseToggle');
        if (autoCloseToggle) {
            autoCloseToggle.addEventListener('click', function() {
                const newValue = !self.get('autoClose');
                self.set('autoClose', newValue);
                autoCloseToggle.classList.toggle('active', newValue);
            });
        }

        // 語言切換 - 支援下拉選單
        const languageSelect = Utils.safeQuerySelector('#settingsLanguageSelect');
        if (languageSelect) {
            languageSelect.addEventListener('change', function(e) {
                const lang = e.target.value;
                console.log(`🔄 SettingsManager select change event: ${lang}`);
                self.set('language', lang);
            });
        }

        // 語言切換 - 兼容舊版卡片式選擇器
        const languageOptions = document.querySelectorAll('.language-option');
        languageOptions.forEach(function(option) {
            option.addEventListener('click', function() {
                const lang = option.getAttribute('data-lang');
                self.set('language', lang);
            });
        });

        // 圖片設定 - 大小限制選擇器
        const settingsImageSizeLimit = Utils.safeQuerySelector('#settingsImageSizeLimit');
        if (settingsImageSizeLimit) {
            settingsImageSizeLimit.addEventListener('change', function(e) {
                const value = parseInt(e.target.value);
                self.set('imageSizeLimit', value);
                console.log('圖片大小限制已更新:', value);
            });
        }

        // 圖片設定 - Base64 相容模式切換器
        const settingsEnableBase64Detail = Utils.safeQuerySelector('#settingsEnableBase64Detail');
        if (settingsEnableBase64Detail) {
            settingsEnableBase64Detail.addEventListener('change', function(e) {
                const value = e.target.checked;
                self.set('enableBase64Detail', value);
                console.log('Base64 相容模式已更新:', value);
            });
        }

        // 自動提交功能啟用開關
        const autoSubmitToggle = Utils.safeQuerySelector('#autoSubmitToggle');
        if (autoSubmitToggle) {
            autoSubmitToggle.addEventListener('click', function() {
                const newValue = !self.get('autoSubmitEnabled');
                const currentPromptId = self.get('autoSubmitPromptId');

                console.log('自動提交開關點擊:', {
                    newValue: newValue,
                    currentPromptId: currentPromptId
                });

                try {
                    // 如果要啟用自動提交，檢查是否已選擇提示詞
                    if (newValue && (!currentPromptId || currentPromptId === '')) {
                        const message = window.i18nManager ? 
                            window.i18nManager.t('settingsUI.autoCommitNoPrompt', '請先選擇一個提示詞作為自動提交內容') : 
                            '請先選擇一個提示詞作為自動提交內容';
                        Utils.showMessage(message, Utils.CONSTANTS.MESSAGE_WARNING);
                        return;
                    }

                    self.set('autoSubmitEnabled', newValue);
                    autoSubmitToggle.classList.toggle('active', newValue);

                    console.log('自動提交狀態已更新:', newValue);

                    // 觸發自動提交狀態變更事件
                    self.triggerAutoSubmitStateChange(newValue);
                } catch (error) {
                    Utils.showMessage(error.message, Utils.CONSTANTS.MESSAGE_ERROR);
                }
            });
        }

        // 自動提交超時時間設定
        const autoSubmitTimeoutInput = Utils.safeQuerySelector('#autoSubmitTimeout');
        if (autoSubmitTimeoutInput) {
            autoSubmitTimeoutInput.addEventListener('change', function(e) {
                const timeout = parseInt(e.target.value);
                try {
                    self.setAutoSubmitSettings(
                        self.get('autoSubmitEnabled'),
                        timeout,
                        self.get('autoSubmitPromptId')
                    );
                } catch (error) {
                    Utils.showMessage(error.message, Utils.CONSTANTS.MESSAGE_ERROR);
                    // 恢復原值
                    e.target.value = self.get('autoSubmitTimeout');
                }
            });
        }

        // 自動提交提示詞選擇
        const autoSubmitPromptSelect = Utils.safeQuerySelector('#autoSubmitPromptSelect');
        if (autoSubmitPromptSelect) {
            autoSubmitPromptSelect.addEventListener('change', function(e) {
                const promptId = e.target.value || null;
                console.log('自動提交提示詞選擇變更:', promptId);

                try {
                    // 如果選擇了空值，清除自動提交設定
                    if (!promptId || promptId === '') {
                        self.set('autoSubmitPromptId', null);
                        self.set('autoSubmitEnabled', false);

                        // 同時清除所有提示詞的 isAutoSubmit 標記
                        if (window.feedbackApp && window.feedbackApp.promptManager) {
                            window.feedbackApp.promptManager.clearAutoSubmitPrompt();
                            console.log('🔄 已清除所有提示詞的自動提交標記');
                        } else {
                            console.warn('⚠️ promptManager 未找到，無法清除提示詞標記');
                        }

                        // 觸發狀態變更事件，更新相關 UI 組件
                        self.triggerAutoSubmitStateChange(false);

                        // 更新 UI 元素（按鈕狀態、倒數計時器等）
                        self.applyAutoSubmitSettingsToUI();

                        console.log('清除自動提交設定並更新 UI');
                    } else {
                        // 設定新的自動提交提示詞
                        self.set('autoSubmitPromptId', promptId);
                        console.log('設定自動提交提示詞 ID:', promptId);

                        // 同時更新對應提示詞的 isAutoSubmit 標記
                        if (window.feedbackApp && window.feedbackApp.promptManager) {
                            try {
                                window.feedbackApp.promptManager.setAutoSubmitPrompt(promptId);
                                console.log('🔄 已設定提示詞的自動提交標記:', promptId);

                                // 觸發狀態變更事件，更新相關 UI 組件
                                const currentEnabled = self.get('autoSubmitEnabled');
                                self.triggerAutoSubmitStateChange(currentEnabled);

                                // 更新 UI 元素
                                self.applyAutoSubmitSettingsToUI();

                                console.log('🔄 已更新自動提交 UI 狀態');
                            } catch (promptError) {
                                console.error('❌ 設定提示詞自動提交標記失敗:', promptError);
                                // 如果設定提示詞失敗，回滾設定
                                self.set('autoSubmitPromptId', null);
                                e.target.value = '';
                                throw promptError;
                            }
                        } else {
                            console.warn('⚠️ promptManager 未找到，無法設定提示詞標記');
                        }
                    }
                } catch (error) {
                    Utils.showMessage(error.message, Utils.CONSTANTS.MESSAGE_ERROR);
                    // 恢復原值
                    e.target.value = self.get('autoSubmitPromptId') || '';
                }
            });
        }

        // 會話歷史保存期限設定
        const sessionHistoryRetentionSelect = Utils.safeQuerySelector('#sessionHistoryRetentionHours');
        if (sessionHistoryRetentionSelect) {
            sessionHistoryRetentionSelect.addEventListener('change', function(e) {
                const hours = parseInt(e.target.value);
                self.set('sessionHistoryRetentionHours', hours);
                console.log('會話歷史保存期限已更新:', hours, '小時');

                // 觸發清理過期會話
                if (window.MCPFeedback && window.MCPFeedback.app && window.MCPFeedback.app.sessionManager) {
                    const sessionManager = window.MCPFeedback.app.sessionManager;
                    if (sessionManager.dataManager && sessionManager.dataManager.cleanupExpiredSessions) {
                        sessionManager.dataManager.cleanupExpiredSessions();
                    }
                }
            });
        }

        // 會話歷史匯出按鈕
        const exportHistoryBtn = Utils.safeQuerySelector('#exportSessionHistoryBtn');
        if (exportHistoryBtn) {
            exportHistoryBtn.addEventListener('click', function() {
                if (window.MCPFeedback && window.MCPFeedback.SessionManager) {
                    window.MCPFeedback.SessionManager.exportSessionHistory();
                }
            });
        }

        // 會話歷史清空按鈕
        const clearHistoryBtn = Utils.safeQuerySelector('#clearSessionHistoryBtn');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', function() {
                if (window.MCPFeedback && window.MCPFeedback.SessionManager) {
                    window.MCPFeedback.SessionManager.clearSessionHistory();
                }
            });
        }

        // 清空用戶訊息記錄按鈕
        const clearUserMessagesBtn = Utils.safeQuerySelector('#clearUserMessagesBtn');
        if (clearUserMessagesBtn) {
            clearUserMessagesBtn.addEventListener('click', function() {
                const i18n = window.i18nManager;
                const confirmMessage = i18n ?
                    i18n.t('sessionHistory.userMessages.confirmClearAll') :
                    '確定要清空所有會話的用戶訊息記錄嗎？此操作無法復原。';

                if (confirm(confirmMessage)) {
                    if (window.MCPFeedback && window.MCPFeedback.app && window.MCPFeedback.app.sessionManager) {
                        const success = window.MCPFeedback.app.sessionManager.dataManager.clearAllUserMessages();
                        if (success) {
                            const successMessage = i18n ?
                                i18n.t('sessionHistory.userMessages.clearSuccess') :
                                '用戶訊息記錄已清空';
                            alert(successMessage);
                        }
                    }
                }
            });
        }

        // 用戶訊息記錄啟用開關
        const userMessageRecordingToggle = Utils.safeQuerySelector('#userMessageRecordingToggle');
        if (userMessageRecordingToggle) {
            userMessageRecordingToggle.addEventListener('change', function() {
                const newValue = userMessageRecordingToggle.checked;
                self.set('userMessageRecordingEnabled', newValue);
                console.log('用戶訊息記錄狀態已更新:', newValue);
            });
        }

        // 用戶訊息隱私等級選擇
        const userMessagePrivacySelect = Utils.safeQuerySelector('#userMessagePrivacyLevel');
        if (userMessagePrivacySelect) {
            userMessagePrivacySelect.addEventListener('change', function(e) {
                const privacyLevel = e.target.value;
                self.set('userMessagePrivacyLevel', privacyLevel);
                self.updatePrivacyLevelDescription(privacyLevel);
                console.log('用戶訊息隱私等級已更新:', privacyLevel);
            });
        }

        // 會話超時啟用開關
        const sessionTimeoutEnabled = Utils.safeQuerySelector('#sessionTimeoutEnabled');
        if (sessionTimeoutEnabled) {
            sessionTimeoutEnabled.addEventListener('change', function() {
                const newValue = sessionTimeoutEnabled.checked;
                self.set('sessionTimeoutEnabled', newValue);
                console.log('會話超時狀態已更新:', newValue);
                
                // 觸發 WebSocket 通知後端更新超時設定
                if (window.MCPFeedback && window.MCPFeedback.app && window.MCPFeedback.app.webSocketManager) {
                    window.MCPFeedback.app.webSocketManager.send({
                        type: 'update_timeout_settings',
                        settings: {
                            enabled: newValue,
                            seconds: self.get('sessionTimeoutSeconds')
                        }
                    });
                }
            });
        }

        // 會話超時時間設定
        const sessionTimeoutSeconds = Utils.safeQuerySelector('#sessionTimeoutSeconds');
        if (sessionTimeoutSeconds) {
            sessionTimeoutSeconds.addEventListener('change', function(e) {
                const seconds = parseInt(e.target.value);
                
                // 驗證輸入值範圍
                if (isNaN(seconds) || seconds < 300) {
                    e.target.value = 300;
                    self.set('sessionTimeoutSeconds', 300);
                } else if (seconds > 86400) {
                    e.target.value = 86400;
                    self.set('sessionTimeoutSeconds', 86400);
                } else {
                    self.set('sessionTimeoutSeconds', seconds);
                }
                
                console.log('會話超時時間已更新:', self.get('sessionTimeoutSeconds'), '秒');
                
                // 觸發 WebSocket 通知後端更新超時設定
                if (window.MCPFeedback && window.MCPFeedback.app && window.MCPFeedback.app.webSocketManager) {
                    window.MCPFeedback.app.webSocketManager.send({
                        type: 'update_timeout_settings',
                        settings: {
                            enabled: self.get('sessionTimeoutEnabled'),
                            seconds: self.get('sessionTimeoutSeconds')
                        }
                    });
                }
            });
        }

        // 重置設定
        const resetBtn = Utils.safeQuerySelector('#resetSettingsBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', function() {
                if (confirm('確定要重置所有設定嗎？')) {
                    self.resetSettings();
                    self.applyToUI();
                }
            });
        }

    };

    // 將 SettingsManager 加入命名空間
    window.MCPFeedback.SettingsManager = SettingsManager;

    console.log('✅ SettingsManager 模組載入完成');

})();
