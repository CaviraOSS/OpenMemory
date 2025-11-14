/**
 * MCP Feedback Enhanced - 主應用程式
 * =================================
 *
 * 模組化重構版本，整合所有功能模組
 * 依賴模組載入順序：utils -> tab-manager -> websocket-manager -> connection-monitor ->
 *                  session-manager -> image-handler -> settings-manager -> ui-manager ->
 *                  auto-refresh-manager -> app
 */

(function() {
    'use strict';

    // 確保命名空間存在
    window.MCPFeedback = window.MCPFeedback || {};
    const Utils = window.MCPFeedback.Utils;

    /**
     * 主應用程式建構函數
     */
    function FeedbackApp(sessionId) {
        // 會話信息
        this.sessionId = sessionId;
        this.currentSessionId = null;

        // 模組管理器
        this.tabManager = null;
        this.webSocketManager = null;
        this.connectionMonitor = null;
        this.sessionManager = null;
        this.imageHandler = null;
        this.settingsManager = null;
        this.uiManager = null;

        // 提示詞管理器
        this.promptManager = null;
        this.promptModal = null;
        this.promptSettingsUI = null;
        this.promptInputButtons = null;

        // 音效管理器
        this.audioManager = null;
        this.audioSettingsUI = null;

        // 通知管理器
        this.notificationManager = null;
        this.notificationSettings = null;

        // 自動提交管理器
        this.autoSubmitManager = null;

        // 應用程式狀態
        this.isInitialized = false;
        this.pendingSubmission = null;

        // 初始化防抖函數
        this.initDebounceHandlers();

        console.log('🚀 FeedbackApp 建構函數初始化完成');
    }

    /**
     * 初始化防抖處理器
     */
    FeedbackApp.prototype.initDebounceHandlers = function() {
        // 為自動提交檢查添加防抖
        this._debouncedCheckAndStartAutoSubmit = window.MCPFeedback.Utils.DOM.debounce(
            this._originalCheckAndStartAutoSubmit.bind(this),
            200,
            false
        );

        // 為 WebSocket 訊息處理添加防抖
        this._debouncedHandleWebSocketMessage = window.MCPFeedback.Utils.DOM.debounce(
            this._originalHandleWebSocketMessage.bind(this),
            50,
            false
        );

        // 為會話更新處理添加防抖
        this._debouncedHandleSessionUpdated = window.MCPFeedback.Utils.DOM.debounce(
            this._originalHandleSessionUpdated.bind(this),
            100,
            false
        );

        // 為狀態更新處理添加防抖
        this._debouncedHandleStatusUpdate = window.MCPFeedback.Utils.DOM.debounce(
            this._originalHandleStatusUpdate.bind(this),
            100,
            false
        );
    };

    /**
     * 初始化應用程式
     */
    FeedbackApp.prototype.init = function() {
        const self = this;

        console.log('🚀 初始化 MCP Feedback Enhanced 應用程式');

        return new Promise(function(resolve, reject) {
            try {
                // 等待國際化系統
                self.waitForI18n()
                    .then(function() {
                        return self.initializeManagers();
                    })
                    .then(function() {
                        return self.setupEventListeners();
                    })
                    .then(function() {
                        return self.setupCleanupHandlers();
                    })
                    .then(function() {
                        self.isInitialized = true;
                        console.log('✅ MCP Feedback Enhanced 應用程式初始化完成');
                        resolve();
                    })
                    .catch(function(error) {
                        console.error('❌ 應用程式初始化失敗:', error);
                        reject(error);
                    });
            } catch (error) {
                console.error('❌ 應用程式初始化異常:', error);
                reject(error);
            }
        });
    };

    /**
     * 等待國際化系統載入
     */
    FeedbackApp.prototype.waitForI18n = function() {
        return new Promise(function(resolve) {
            if (window.i18nManager) {
                window.i18nManager.init().then(resolve).catch(resolve);
            } else {
                resolve();
            }
        });
    };

    /**
     * 初始化所有管理器
     */
    FeedbackApp.prototype.initializeManagers = function() {
        const self = this;

        return new Promise(function(resolve, reject) {
            try {
                console.log('🔧 初始化管理器...');

                // 1. 初始化設定管理器
                self.settingsManager = new window.MCPFeedback.SettingsManager({
                    onSettingsChange: function(settings) {
                        self.handleSettingsChange(settings);
                    },
                    onLanguageChange: function(language) {
                        self.handleLanguageChange(language);
                    },
                    onAutoSubmitStateChange: function(enabled, settings) {
                        self.handleAutoSubmitStateChange(enabled, settings);
                    }
                });

                // 2. 載入設定
                self.settingsManager.loadSettings()
                    .then(function(settings) {
                        console.log('📋 設定載入完成:', settings);

                        // 3. 初始化 UI 管理器
                        self.uiManager = new window.MCPFeedback.UIManager({
                            // 移除 activeTab - 頁籤切換無需持久化
                            layoutMode: settings.layoutMode,
                            onTabChange: function(tabName) {
                                self.handleTabChange(tabName);
                            },
                            onLayoutModeChange: function(layoutMode) {
                                self.handleLayoutModeChange(layoutMode);
                            }
                        });



                        // 5. 初始化連線監控器
                        self.connectionMonitor = new window.MCPFeedback.ConnectionMonitor({
                            onStatusChange: function(status, message) {
                                console.log('🔍 連線狀態變更:', status, message);
                            },
                            onQualityChange: function(quality, latency) {
                                console.log('🔍 連線品質變更:', quality, latency + 'ms');
                            }
                        });

                        // 6. 初始化會話管理器
                        self.sessionManager = new window.MCPFeedback.SessionManager({
                            settingsManager: self.settingsManager,
                            onSessionChange: function(sessionData) {
                                console.log('📋 會話變更:', sessionData);
                            },
                            onSessionSelect: function(sessionId) {
                                console.log('📋 會話選擇:', sessionId);
                            }
                        });

                        // 7. 初始化 WebSocket 管理器
                        self.webSocketManager = new window.MCPFeedback.WebSocketManager({
                            tabManager: self.tabManager,
                            connectionMonitor: self.connectionMonitor,
                            onOpen: function() {
                                self.handleWebSocketOpen();
                            },
                            onMessage: function(data) {
                                self.handleWebSocketMessage(data);
                            },
                            onClose: function(event) {
                                self.handleWebSocketClose(event);
                            },
                            onConnectionStatusChange: function(status, text) {
                                self.uiManager.updateConnectionStatus(status, text);
                                // 同時更新連線監控器
                                if (self.connectionMonitor) {
                                    self.connectionMonitor.updateConnectionStatus(status, text);
                                }
                            }
                        });

                        // 8. 初始化圖片處理器
                        self.imageHandler = new window.MCPFeedback.ImageHandler({
                            imageSizeLimit: settings.imageSizeLimit,
                            enableBase64Detail: settings.enableBase64Detail,
                            layoutMode: settings.layoutMode,
                            onSettingsChange: function() {
                                self.saveImageSettings();
                            }
                        });

                        // 9. 初始化提示詞管理器
                        self.initializePromptManagers();

                        // 10. 初始化音效管理器
                        self.initializeAudioManagers();

                        // 11. 初始化通知管理器
                        self.initializeNotificationManager();

                        // 12. 初始化自動提交管理器
                        self.initializeAutoSubmitManager();

                        // 13. 初始化 Textarea 高度管理器
                        self.initializeTextareaHeightManager();

                        // 14. 應用設定到 UI
                        self.settingsManager.applyToUI();

                        // 15. 初始化各個管理器
                        self.uiManager.initTabs();
                        self.imageHandler.init();

                        // 16. 檢查並啟動自動提交（如果條件滿足）
                        setTimeout(function() {
                            self.checkAndStartAutoSubmit();
                        }, 500); // 延遲 500ms 確保所有初始化完成

                        // 17. 播放啟動音效（如果音效已啟用）
                        setTimeout(function() {
                            if (self.audioManager) {
                                self.audioManager.playStartupNotification();
                            }
                        }, 800); // 延遲 800ms 確保所有初始化完成且避免與其他音效衝突

                        // 17. 初始化會話超時設定
                        if (self.settingsManager.get('sessionTimeoutEnabled')) {
                            const timeoutSettings = {
                                enabled: self.settingsManager.get('sessionTimeoutEnabled'),
                                seconds: self.settingsManager.get('sessionTimeoutSeconds')
                            };
                            self.webSocketManager.updateSessionTimeoutSettings(timeoutSettings);
                        }

                        // 18. 建立 WebSocket 連接
                        self.webSocketManager.connect();

                        resolve();
                    })
                    .catch(reject);
            } catch (error) {
                reject(error);
            }
        });
    };

    /**
     * 設置事件監聽器
     */
    FeedbackApp.prototype.setupEventListeners = function() {
        const self = this;

        return new Promise(function(resolve) {
            // 提交按鈕事件
            const submitButtons = [
                window.MCPFeedback.Utils.safeQuerySelector('#submitBtn')
            ].filter(function(btn) { return btn !== null; });

            submitButtons.forEach(function(button) {
                button.addEventListener('click', function() {
                    self.submitFeedback();
                });
            });

            // 取消按鈕事件 - 已移除取消按鈕，保留 ESC 快捷鍵功能

            // 命令執行事件
            const runCommandBtn = window.MCPFeedback.Utils.safeQuerySelector('#runCommandBtn');
            if (runCommandBtn) {
                runCommandBtn.addEventListener('click', function() {
                    self.runCommand();
                });
            }

            const commandInput = window.MCPFeedback.Utils.safeQuerySelector('#commandInput');
            if (commandInput) {
                commandInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        self.runCommand();
                    }
                });
            }

            // 複製用戶內容按鈕
            const copyUserFeedback = window.MCPFeedback.Utils.safeQuerySelector('#copyUserFeedback');
            if (copyUserFeedback) {
                copyUserFeedback.addEventListener('click', function(e) {
                    e.preventDefault();
                    self.copyUserFeedback();
                });
            }

            // 快捷鍵
            document.addEventListener('keydown', function(e) {
                // Ctrl+Enter 提交回饋
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    self.submitFeedback();
                }

                // Ctrl+I 聚焦輸入框
                if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
                    e.preventDefault();
                    self.focusInput();
                }

                // ESC 鍵功能已移除 - 避免意外清空用戶輸入的文字
            });

            // 倒數計時器暫停/恢復按鈕
            const countdownPauseBtn = window.MCPFeedback.Utils.safeQuerySelector('#countdownPauseBtn');
            if (countdownPauseBtn) {
                countdownPauseBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    if (self.autoSubmitManager) {
                        self.autoSubmitManager.togglePause();
                    }
                });
            }

            
            // 自動命令設定相關事件
            self.setupAutoCommandEvents();

            // 設置設定管理器的事件監聽器
            self.settingsManager.setupEventListeners();

            // 設置用戶活動監聽（用於重置會話超時）
            self.setupUserActivityListeners();

            console.log('✅ 事件監聽器設置完成');
            resolve();
        });
    };

    /**
     * 設置清理處理器
     */
    FeedbackApp.prototype.setupCleanupHandlers = function() {
        const self = this;

        return new Promise(function(resolve) {
            window.addEventListener('beforeunload', function() {
                self.cleanup();
            });

            console.log('✅ 清理處理器設置完成');
            resolve();
        });
    };

    /**
     * 處理設定變更
     */
    FeedbackApp.prototype.handleSettingsChange = function(settings) {
        console.log('🔧 處理設定變更:', settings);

        // 更新圖片處理器設定
        if (this.imageHandler) {
            this.imageHandler.updateSettings(settings);
        }



        // 更新 UI 管理器佈局模式
        if (this.uiManager && settings.layoutMode) {
            this.uiManager.applyLayoutMode(settings.layoutMode);
        }
    };

    /**
     * 處理語言變更
     */
    FeedbackApp.prototype.handleLanguageChange = function(language) {
        console.log('🌐 處理語言變更:', language);

        // 更新 UI 顯示
        if (this.uiManager) {
            this.uiManager.updateStatusIndicator();
        }


    };

    /**
     * 處理頁籤變更
     */
    FeedbackApp.prototype.handleTabChange = function(tabName) {
        console.log('📋 處理頁籤變更:', tabName);

        // 重新初始化圖片處理器（確保使用正確的佈局模式元素）
        if (this.imageHandler) {
            const layoutMode = this.settingsManager.get('layoutMode');
            this.imageHandler.reinitialize(layoutMode);
        }

        // 移除頁籤狀態保存 - 頁籤切換無需持久化
        // this.settingsManager.set('activeTab', tabName);
    };

    /**
     * 處理佈局模式變更
     */
    FeedbackApp.prototype.handleLayoutModeChange = function(layoutMode) {
        console.log('🎨 處理佈局模式變更:', layoutMode);

        // 重新初始化圖片處理器
        if (this.imageHandler) {
            this.imageHandler.reinitialize(layoutMode);
        }
    };

    /**
     * 保存圖片設定
     */
    FeedbackApp.prototype.saveImageSettings = function() {
        if (this.imageHandler && this.settingsManager) {
            this.settingsManager.setMultiple({
                imageSizeLimit: this.imageHandler.imageSizeLimit,
                enableBase64Detail: this.imageHandler.enableBase64Detail
            });
        }
    };

    /**
     * 初始化提示詞管理器
     */
    FeedbackApp.prototype.initializePromptManagers = function() {
        console.log('📝 初始化提示詞管理器...');

        try {
            // 檢查提示詞模組是否已載入
            if (!window.MCPFeedback.Prompt) {
                console.warn('⚠️ 提示詞模組未載入，跳過初始化');
                return;
            }

            // 1. 初始化提示詞管理器
            this.promptManager = new window.MCPFeedback.Prompt.PromptManager({
                settingsManager: this.settingsManager
            });
            this.promptManager.init();

            // 2. 初始化提示詞彈窗
            this.promptModal = new window.MCPFeedback.Prompt.PromptModal();

            // 3. 初始化設定頁籤 UI
            this.promptSettingsUI = new window.MCPFeedback.Prompt.PromptSettingsUI({
                promptManager: this.promptManager,
                promptModal: this.promptModal,
                settingsManager: this.settingsManager
            });
            this.promptSettingsUI.init('#promptManagementContainer');

            // 4. 初始化輸入按鈕
            this.promptInputButtons = new window.MCPFeedback.Prompt.PromptInputButtons({
                promptManager: this.promptManager,
                promptModal: this.promptModal
            });

            // 初始化輸入按鈕到回饋輸入區域
            const inputContainers = [
                '#combinedFeedbackText'    // 工作區分頁的 textarea
            ];
            this.promptInputButtons.init(inputContainers);

            console.log('✅ 提示詞管理器初始化完成');

        } catch (error) {
            console.error('❌ 提示詞管理器初始化失敗:', error);
        }
    };

    /**
     * 初始化音效管理器
     */
    FeedbackApp.prototype.initializeAudioManagers = function() {
        console.log('🔊 初始化音效管理器...');

        try {
            // 檢查音效模組是否已載入
            if (!window.MCPFeedback.AudioManager) {
                console.warn('⚠️ 音效模組未載入，跳過初始化');
                return;
            }

            // 1. 初始化音效管理器
            this.audioManager = new window.MCPFeedback.AudioManager({
                settingsManager: this.settingsManager,
                onSettingsChange: function(settings) {
                    console.log('🔊 音效設定已變更:', settings);
                }
            });
            this.audioManager.initialize();

            // 2. 初始化音效設定 UI
            this.audioSettingsUI = new window.MCPFeedback.AudioSettingsUI({
                container: document.querySelector('#audioManagementContainer'),
                audioManager: this.audioManager,
                t: window.i18nManager ? window.i18nManager.t.bind(window.i18nManager) : function(key, defaultValue) { return defaultValue || key; }
            });
            this.audioSettingsUI.initialize();

            console.log('✅ 音效管理器初始化完成');

        } catch (error) {
            console.error('❌ 音效管理器初始化失敗:', error);
        }
    };

    /**
     * 初始化通知管理器
     */
    FeedbackApp.prototype.initializeNotificationManager = function() {
        console.log('🔔 初始化通知管理器...');

        try {
            // 檢查通知模組是否已載入
            if (!window.MCPFeedback.NotificationManager) {
                console.warn('⚠️ 通知模組未載入，跳過初始化');
                return;
            }

            // 1. 初始化通知管理器
            this.notificationManager = new window.MCPFeedback.NotificationManager({
                t: window.i18nManager ? window.i18nManager.t.bind(window.i18nManager) : function(key, defaultValue) { return defaultValue || key; }
            });
            this.notificationManager.initialize();

            // 2. 初始化通知設定 UI
            if (window.MCPFeedback.NotificationSettings) {
                const notificationContainer = document.querySelector('#notificationSettingsContainer');
                console.log('🔍 通知設定容器:', notificationContainer);
                
                if (notificationContainer) {
                    this.notificationSettings = new window.MCPFeedback.NotificationSettings({
                        container: notificationContainer,
                        notificationManager: this.notificationManager,
                        t: window.i18nManager ? window.i18nManager.t.bind(window.i18nManager) : function(key, defaultValue) { return defaultValue || key; }
                    });
                    this.notificationSettings.initialize();
                    console.log('✅ 通知設定 UI 初始化完成');
                } else {
                    console.error('❌ 找不到通知設定容器元素 notificationSettingsContainer');
                }
            } else {
                console.warn('⚠️ NotificationSettings 模組未載入');
            }

            console.log('✅ 通知管理器初始化完成');

        } catch (error) {
            console.error('❌ 通知管理器初始化失敗:', error);
        }
    };

    /**
     * 初始化 Textarea 高度管理器
     */
    FeedbackApp.prototype.initializeTextareaHeightManager = function() {
        console.log('📏 初始化 Textarea 高度管理器...');

        try {
            // 檢查 TextareaHeightManager 模組是否已載入
            if (!window.MCPFeedback.TextareaHeightManager) {
                console.warn('⚠️ TextareaHeightManager 模組未載入，跳過初始化');
                return;
            }

            // 建立 TextareaHeightManager 實例
            this.textareaHeightManager = new window.MCPFeedback.TextareaHeightManager({
                settingsManager: this.settingsManager,
                debounceDelay: 500 // 500ms 防抖延遲
            });

            // 初始化管理器
            this.textareaHeightManager.initialize();

            // 註冊 combinedFeedbackText textarea
            const success = this.textareaHeightManager.registerTextarea(
                'combinedFeedbackText',
                'combinedFeedbackTextHeight'
            );

            if (success) {
                console.log('✅ combinedFeedbackText 高度管理已啟用');
            } else {
                console.warn('⚠️ combinedFeedbackText 註冊失敗');
            }

            console.log('✅ Textarea 高度管理器初始化完成');

        } catch (error) {
            console.error('❌ Textarea 高度管理器初始化失敗:', error);
        }
    };

    /**
     * 處理 WebSocket 開啟
     */
    FeedbackApp.prototype.handleWebSocketOpen = function() {
        console.log('🔗 WebSocket 連接已開啟');

        // 如果有待處理的提交，處理它
        if (this.pendingSubmission) {
            console.log('🔄 處理待提交的回饋');
            this.submitFeedbackInternal(this.pendingSubmission);
            this.pendingSubmission = null;
        }
    };

    /**
     * 處理 WebSocket 訊息（原始版本，供防抖使用）
     */
    FeedbackApp.prototype._originalHandleWebSocketMessage = function(data) {
        console.log('📨 處理 WebSocket 訊息:', data);

        switch (data.type) {
            case 'command_output':
                this.appendCommandOutput(data.output);
                break;
            case 'command_complete':
                this.appendCommandOutput('\n[命令完成，退出碼: ' + data.exit_code + ']\n');
                this.enableCommandInput();
                break;
            case 'command_error':
                this.appendCommandOutput('\n[錯誤: ' + data.error + ']\n');
                this.enableCommandInput();
                break;
            case 'feedback_received':
                console.log('回饋已收到');
                this.handleFeedbackReceived(data);
                break;
            case 'status_update':
                console.log('狀態更新:', data.status_info);
                this._originalHandleStatusUpdate(data.status_info);
                break;
            case 'session_updated':
                console.log('🔄 收到會話更新訊息:', data.session_info);
                // 處理訊息代碼
                if (data.messageCode && window.i18nManager) {
                    const message = window.i18nManager.t(data.messageCode);
                    window.MCPFeedback.Utils.showMessage(message, window.MCPFeedback.Utils.CONSTANTS.MESSAGE_SUCCESS);
                }
                this._originalHandleSessionUpdated(data);
                break;
            case 'desktop_close_request':
                console.log('🖥️ 收到桌面關閉請求');
                this.handleDesktopCloseRequest(data);
                break;
            case 'notification':
                console.log('📢 收到通知:', data);
                // 處理 FEEDBACK_SUBMITTED 通知
                if (data.code === 'session.feedbackSubmitted' || data.code === 'FEEDBACK_SUBMITTED' || data.code === 201) {
                    console.log('✅ 回饋提交成功通知');
                    this.handleFeedbackReceived(data);
                }
                break;
        }
    };

    /**
     * 處理 WebSocket 訊息（防抖版本）
     */
    FeedbackApp.prototype.handleWebSocketMessage = function(data) {
        // 命令輸出相關的訊息不應該使用防抖，需要立即處理
        if (data.type === 'command_output' || data.type === 'command_complete' || data.type === 'command_error') {
            this._originalHandleWebSocketMessage(data);
        } else if (this._debouncedHandleWebSocketMessage) {
            // 其他訊息類型使用防抖
            this._debouncedHandleWebSocketMessage(data);
        } else {
            // 回退到原始方法（防抖未初始化時）
            this._originalHandleWebSocketMessage(data);
        }
    };

    /**
     * 處理 WebSocket 關閉
     */
    FeedbackApp.prototype.handleWebSocketClose = function(event) {
        console.log('🔗 WebSocket 連接已關閉');

        // 重置回饋狀態，避免卡在處理狀態
        if (this.uiManager && this.uiManager.getFeedbackState() === window.MCPFeedback.Utils.CONSTANTS.FEEDBACK_PROCESSING) {
            console.log('🔄 WebSocket 斷開，重置處理狀態');
            this.uiManager.setFeedbackState(window.MCPFeedback.Utils.CONSTANTS.FEEDBACK_WAITING);
        }
    };

    /**
     * 處理回饋接收
     */
    FeedbackApp.prototype.handleFeedbackReceived = function(data) {
        // 使用 UI 管理器設置狀態
        this.uiManager.setFeedbackState(window.MCPFeedback.Utils.CONSTANTS.FEEDBACK_SUBMITTED);
        this.uiManager.setLastSubmissionTime(Date.now());

        // 停止自動提交計時器（如果正在運行）
        if (this.autoSubmitManager && this.autoSubmitManager.isEnabled) {
            console.log('⏸️ 反饋已成功提交，停止自動提交倒數計時器');
            this.autoSubmitManager.stop();
        }

        // 顯示成功訊息
        if (data.messageCode && window.i18nManager) {
            const message = window.i18nManager.t(data.messageCode, data.params);
            window.MCPFeedback.Utils.showMessage(message, window.MCPFeedback.Utils.CONSTANTS.MESSAGE_SUCCESS);
        } else {
            const successMessage = window.i18nManager ? window.i18nManager.t('feedback.submitSuccess') : '回饋提交成功！';
            window.MCPFeedback.Utils.showMessage(data.message || successMessage, window.MCPFeedback.Utils.CONSTANTS.MESSAGE_SUCCESS);
        }

        // 更新 AI 摘要區域顯示「已送出反饋」狀態
        const submittedMessage = window.i18nManager ? window.i18nManager.t('feedback.submittedWaiting') : '已送出反饋，等待下次 MCP 調用...';
        this.updateSummaryStatus(submittedMessage);
        
        // 執行提交回饋後的自動命令
        this.executeAutoCommandOnFeedbackSubmit();

        // 刷新會話列表以顯示最新狀態
        this.refreshSessionList();

        console.log('反饋已提交，頁面保持開啟狀態');
    };

    /**
     * 刷新會話列表以顯示最新狀態
     */
    FeedbackApp.prototype.refreshSessionList = function() {
        // 如果有會話管理器，觸發數據刷新
        if (this.sessionManager && this.sessionManager.dataManager) {
            console.log('🔄 刷新會話列表以顯示最新狀態');
            this.sessionManager.dataManager.loadFromServer();
        } else {
            console.log('⚠️ 會話管理器未初始化，跳過會話列表刷新');
        }
    };

    /**
     * 處理桌面關閉請求
     */
    FeedbackApp.prototype.handleDesktopCloseRequest = function(data) {
        console.log('🖥️ 處理桌面關閉請求:', data.message);

        // 顯示關閉訊息
        const closeMessage = data.message || '正在關閉桌面應用程式...';
        window.MCPFeedback.Utils.showMessage(closeMessage, window.MCPFeedback.Utils.CONSTANTS.MESSAGE_INFO);

        // 檢查是否在 Tauri 環境中
        if (window.__TAURI__) {
            console.log('🖥️ 檢測到 Tauri 環境，關閉桌面視窗');
            try {
                // 使用 Tauri API 關閉視窗
                window.__TAURI__.window.getCurrent().close();
            } catch (error) {
                console.error('關閉 Tauri 視窗失敗:', error);
                // 備用方案：關閉瀏覽器視窗
                window.close();
            }
        } else {
            console.log('🖥️ 非 Tauri 環境，嘗試關閉瀏覽器視窗');
            // 在瀏覽器環境中嘗試關閉視窗
            window.close();
        }
    };

    /**
     * 處理會話更新（原始版本，供防抖使用）
     */
    FeedbackApp.prototype._originalHandleSessionUpdated = function(data) {
        console.log('🔄 處理會話更新:', data);
        console.log('🔍 檢查 action 字段:', data.action);
        console.log('🔍 檢查 type 字段:', data.type);

        // 檢查是否是新會話創建的通知
        if (data.action === 'new_session_created' || data.type === 'new_session_created') {
            console.log('🆕 檢測到新會話創建，局部更新頁面內容');

            // 播放音效通知
            if (this.audioManager) {
                this.audioManager.playNotification();
            }
            
            // 執行新會話自動命令
            this.executeAutoCommandOnNewSession();

            // 發送瀏覽器通知
            if (this.notificationManager && data.session_info) {
                this.notificationManager.notifyNewSession(
                    data.session_info.session_id,
                    data.session_info.project_directory || data.project_directory || '未知專案'
                );
            }

            // 顯示新會話通知
            const defaultMessage = window.i18nManager ? 
                window.i18nManager.t('session.created') : 
                'New MCP session created, page will refresh automatically';
            window.MCPFeedback.Utils.showMessage(
                data.message || defaultMessage,
                window.MCPFeedback.Utils.CONSTANTS.MESSAGE_SUCCESS
            );

            // 局部更新頁面內容而非開啟新視窗
            const self = this;
            setTimeout(function() {
                console.log('🔄 執行局部更新頁面內容');

                // 1. 更新會話資訊
                if (data.session_info) {
                    self.currentSessionId = data.session_info.session_id;
                    console.log('📋 新會話 ID:', self.currentSessionId);
                }

                // 2. 刷新頁面內容（AI 摘要、表單等）
                self.refreshPageContent();

                // 3. 重置表單狀態
                self.clearFeedback();

                // 4. 重置回饋狀態為等待中
                if (self.uiManager) {
                    self.uiManager.setFeedbackState(window.MCPFeedback.Utils.CONSTANTS.FEEDBACK_WAITING, self.currentSessionId);
                }
                
                // 5. 重新啟動會話超時計時器（如果已啟用）
                if (self.settingsManager && self.settingsManager.get('sessionTimeoutEnabled')) {
                    console.log('🔄 新會話創建，重新啟動會話超時計時器');
                    const timeoutSettings = {
                        enabled: self.settingsManager.get('sessionTimeoutEnabled'),
                        seconds: self.settingsManager.get('sessionTimeoutSeconds')
                    };
                    self.webSocketManager.updateSessionTimeoutSettings(timeoutSettings);
                }

                // 6. 檢查並啟動自動提交
                self.checkAndStartAutoSubmit();

                console.log('✅ 局部更新完成，頁面已準備好接收新的回饋');
            }, 500);

            return; // 提前返回，不執行後續的局部更新邏輯
        }

        // 播放音效通知
        if (this.audioManager) {
            this.audioManager.playNotification();
        }

        // 顯示更新通知
        window.MCPFeedback.Utils.showMessage(data.message || '會話已更新，正在局部更新內容...', window.MCPFeedback.Utils.CONSTANTS.MESSAGE_SUCCESS);

        // 更新會話信息
        if (data.session_info) {
            const newSessionId = data.session_info.session_id;
            console.log('📋 會話 ID 更新: ' + this.currentSessionId + ' -> ' + newSessionId);

            // 保存舊會話到歷史記錄（在更新當前會話之前）
            if (this.currentSessionId && this.sessionManager && this.currentSessionId !== newSessionId) {
                console.log('📋 嘗試獲取當前會話數據...');
                // 從 SessionManager 獲取當前會話的完整數據
                const currentSessionData = this.sessionManager.getCurrentSessionData();
                console.log('📋 從 currentSession 獲取數據:', this.currentSessionId);

                if (currentSessionData) {
                    // 計算實際持續時間
                    const now = Date.now() / 1000;
                    let duration = 300; // 預設 5 分鐘

                    if (currentSessionData.created_at) {
                        let createdAt = currentSessionData.created_at;
                        // 處理時間戳格式
                        if (createdAt > 1e12) {
                            createdAt = createdAt / 1000;
                        }
                        duration = Math.max(1, Math.round(now - createdAt));
                    }

                    const oldSessionData = {
                        session_id: this.currentSessionId,
                        status: 'completed',
                        created_at: currentSessionData.created_at || (now - duration),
                        completed_at: now,
                        duration: duration,
                        project_directory: currentSessionData.project_directory,
                        summary: currentSessionData.summary
                    };

                    console.log('📋 準備將舊會話加入歷史記錄:', oldSessionData);

                    // 先更新當前會話 ID，再調用 addSessionToHistory
                    this.currentSessionId = newSessionId;

                    // 更新會話管理器的當前會話（這樣 addSessionToHistory 檢查時就不會認為是當前活躍會話）
                    if (this.sessionManager) {
                        this.sessionManager.updateCurrentSession(data.session_info);
                    }

                    // 現在可以安全地將舊會話加入歷史記錄
                    this.sessionManager.dataManager.addSessionToHistory(oldSessionData);
                } else {
                    console.log('⚠️ 無法獲取當前會話數據，跳過歷史記錄保存');
                    // 仍然需要更新當前會話 ID
                    this.currentSessionId = newSessionId;
                    // 更新會話管理器
                    if (this.sessionManager) {
                        this.sessionManager.updateCurrentSession(data.session_info);
                    }
                }
            } else {
                // 沒有舊會話或會話 ID 相同，直接更新
                this.currentSessionId = newSessionId;
                // 更新會話管理器
                if (this.sessionManager) {
                    this.sessionManager.updateCurrentSession(data.session_info);
                }
            }

            // 檢查當前狀態，只有在非已提交狀態時才重置
            const currentState = this.uiManager.getFeedbackState();
            if (currentState !== window.MCPFeedback.Utils.CONSTANTS.FEEDBACK_SUBMITTED) {
                this.uiManager.setFeedbackState(window.MCPFeedback.Utils.CONSTANTS.FEEDBACK_WAITING, newSessionId);
                console.log('🔄 會話更新：重置回饋狀態為等待新回饋');
            } else {
                console.log('🔒 會話更新：保護已提交狀態，不重置');
                // 更新會話ID但保持已提交狀態
                this.uiManager.setFeedbackState(window.MCPFeedback.Utils.CONSTANTS.FEEDBACK_SUBMITTED, newSessionId);
            }

            // 檢查並啟動自動提交（如果條件滿足）
            const self = this;
            setTimeout(function() {
                self.checkAndStartAutoSubmit();
            }, 200); // 延遲確保狀態更新完成

            // 更新頁面標題
            if (data.session_info.project_directory) {
                const projectName = data.session_info.project_directory.split(/[/\\]/).pop();
                document.title = 'MCP Feedback - ' + projectName;
            }

            // 使用局部更新替代整頁刷新
            this.refreshPageContent();
        } else {
            console.log('⚠️ 會話更新沒有包含會話信息，僅重置狀態');
            this.uiManager.setFeedbackState(window.MCPFeedback.Utils.CONSTANTS.FEEDBACK_WAITING);
        }

        console.log('✅ 會話更新處理完成');
    };

    /**
     * 處理會話更新（防抖版本）
     */
    FeedbackApp.prototype.handleSessionUpdated = function(data) {
        if (this._debouncedHandleSessionUpdated) {
            this._debouncedHandleSessionUpdated(data);
        } else {
            // 回退到原始方法（防抖未初始化時）
            this._originalHandleSessionUpdated(data);
        }
    };

    /**
     * 處理狀態更新（原始版本，供防抖使用）
     */
    FeedbackApp.prototype._originalHandleStatusUpdate = function(statusInfo) {
        console.log('📊 處理狀態更新:', statusInfo);

        const sessionId = statusInfo.session_id;
        console.log('🔍 狀態更新詳情:', {
            currentSessionId: this.currentSessionId,
            newSessionId: sessionId,
            status: statusInfo.status,
            message: statusInfo.message,
            isNewSession: sessionId !== this.currentSessionId
        });

        // 更新 SessionManager 的狀態資訊
        if (this.sessionManager && this.sessionManager.updateStatusInfo) {
            this.sessionManager.updateStatusInfo(statusInfo);
        }

        // 更新頁面標題顯示會話信息
        if (statusInfo.project_directory) {
            const projectName = statusInfo.project_directory.split(/[/\\]/).pop();
            document.title = 'MCP Feedback - ' + projectName;
        }

        // 使用之前已聲明的 sessionId

        // 前端只管理會話ID，所有狀態都從服務器獲取
        console.log('📊 收到服務器狀態更新:', statusInfo.status, '會話ID:', sessionId);

        // 更新當前會話ID
        if (sessionId) {
            this.currentSessionId = sessionId;
            console.log('🔄 更新當前會話ID:', sessionId.substring(0, 8) + '...');
        }

        // 刷新會話列表以顯示最新狀態
        this.refreshSessionList();

        // 根據服務器狀態更新消息顯示（不修改前端狀態）
        switch (statusInfo.status) {
            case 'feedback_submitted':
                const submittedMessage = window.i18nManager ? window.i18nManager.t('feedback.submittedWaiting') : '已送出反饋，等待下次 MCP 調用...';
                this.updateSummaryStatus(submittedMessage);
                break;
            case 'waiting':
                const waitingMessage = window.i18nManager ? window.i18nManager.t('feedback.waitingForUser') : '等待用戶回饋...';
                this.updateSummaryStatus(waitingMessage);

                // 檢查並啟動自動提交（如果條件滿足）
                const self = this;
                setTimeout(function() {
                    self.checkAndStartAutoSubmit();
                }, 100);
                break;
            case 'completed':
                const completedMessage = window.i18nManager ? window.i18nManager.t('feedback.completed') : '會話已完成';
                this.updateSummaryStatus(completedMessage);
                break;
        }
    };

    /**
     * 處理狀態更新（防抖版本）
     */
    FeedbackApp.prototype.handleStatusUpdate = function(statusInfo) {
        if (this._debouncedHandleStatusUpdate) {
            this._debouncedHandleStatusUpdate(statusInfo);
        } else {
            // 回退到原始方法（防抖未初始化時）
            this._originalHandleStatusUpdate(statusInfo);
        }
    };

    /**
     * 提交回饋
     */
    FeedbackApp.prototype.submitFeedback = function() {
        console.log('📤 嘗試提交回饋...');

        // 檢查是否可以提交回饋
        if (!this.canSubmitFeedback()) {
            console.log('⚠️ 無法提交回饋');
            this.handleSubmitError();
            return;
        }

        // 收集回饋數據並提交
        const feedbackData = this.collectFeedbackData();
        if (!feedbackData) {
            return;
        }

        this.submitFeedbackInternal(feedbackData);
    };

    /**
     * 檢查是否可以提交回饋
     */
    FeedbackApp.prototype.canSubmitFeedback = function() {
        // 簡化檢查：只檢查WebSocket連接，狀態由服務器端驗證
        const wsReady = this.webSocketManager && this.webSocketManager.isReady();

        console.log('🔍 提交檢查:', {
            wsReady: wsReady,
            sessionId: this.currentSessionId
        });

        return wsReady;
    };

    /**
     * 處理提交錯誤
     */
    FeedbackApp.prototype.handleSubmitError = function() {
        const feedbackState = this.uiManager ? this.uiManager.getFeedbackState() : null;

        if (feedbackState === window.MCPFeedback.Utils.CONSTANTS.FEEDBACK_SUBMITTED) {
            const submittedWarning = window.i18nManager ? window.i18nManager.t('feedback.alreadySubmitted') : '回饋已提交，請等待下次 MCP 調用';
            window.MCPFeedback.Utils.showMessage(submittedWarning, window.MCPFeedback.Utils.CONSTANTS.MESSAGE_WARNING);
        } else if (feedbackState === window.MCPFeedback.Utils.CONSTANTS.FEEDBACK_PROCESSING) {
            const processingWarning = window.i18nManager ? window.i18nManager.t('feedback.processingFeedback') : '正在處理中，請稍候';
            window.MCPFeedback.Utils.showMessage(processingWarning, window.MCPFeedback.Utils.CONSTANTS.MESSAGE_WARNING);
        } else if (!this.webSocketManager || !this.webSocketManager.isReady()) {
            // 收集回饋數據，等待連接就緒後提交
            const feedbackData = this.collectFeedbackData();
            if (feedbackData) {
                this.pendingSubmission = feedbackData;
                const connectingMessage = window.i18nManager ? window.i18nManager.t('feedback.connectingMessage') : 'WebSocket 連接中，回饋將在連接就緒後自動提交...';
                window.MCPFeedback.Utils.showMessage(connectingMessage, window.MCPFeedback.Utils.CONSTANTS.MESSAGE_INFO);
            }
        } else {
            const invalidStateMessage = window.i18nManager ? window.i18nManager.t('feedback.invalidState') : '當前狀態不允許提交';
            window.MCPFeedback.Utils.showMessage(invalidStateMessage + ': ' + feedbackState, window.MCPFeedback.Utils.CONSTANTS.MESSAGE_WARNING);
        }
    };

    /**
     * 收集回饋數據
     */
    FeedbackApp.prototype.collectFeedbackData = function() {
        // 獲取合併模式的回饋內容
        let feedback = '';
        const combinedFeedbackInput = window.MCPFeedback.Utils.safeQuerySelector('#combinedFeedbackText');
        feedback = combinedFeedbackInput ? combinedFeedbackInput.value.trim() : '';

        const images = this.imageHandler ? this.imageHandler.getImages() : [];

        if (!feedback && images.length === 0) {
            const message = window.i18nManager ? 
                window.i18nManager.t('feedback.provideTextOrImage', '請提供回饋文字或上傳圖片') : 
                '請提供回饋文字或上傳圖片';
            window.MCPFeedback.Utils.showMessage(message, window.MCPFeedback.Utils.CONSTANTS.MESSAGE_WARNING);
            return null;
        }

        return {
            feedback: feedback,
            images: images,
            settings: {
                image_size_limit: this.imageHandler ? this.imageHandler.imageSizeLimit : 0,
                enable_base64_detail: this.imageHandler ? this.imageHandler.enableBase64Detail : false
            }
        };
    };

    /**
     * 內部提交回饋方法
     */
    FeedbackApp.prototype.submitFeedbackInternal = function(feedbackData) {
        console.log('📤 內部提交回饋...');

        try {
            // 1. 首先記錄用戶訊息到會話歷史（立即保存到伺服器）
            this.recordUserMessage(feedbackData);

            // 2. 設置處理狀態
            if (this.uiManager) {
                this.uiManager.setFeedbackState(window.MCPFeedback.Utils.CONSTANTS.FEEDBACK_PROCESSING);
            }

            // 停止自動提交計時器（如果正在運行）
            if (this.autoSubmitManager && this.autoSubmitManager.isEnabled) {
                console.log('⏸️ 手動提交反饋，停止自動提交倒數計時器');
                this.autoSubmitManager.stop();
            }
            
            // 停止會話超時計時器
            if (this.webSocketManager) {
                console.log('⏸️ 提交反饋，停止會話超時計時器');
                this.webSocketManager.stopSessionTimeout();
            }

            // 3. 發送回饋到 AI 助手
            const success = this.webSocketManager.send({
                type: 'submit_feedback',
                feedback: feedbackData.feedback,
                images: feedbackData.images,
                settings: feedbackData.settings
            });

            if (success) {
                // 重置表單狀態但保留文字內容
                if (this.uiManager) {
                    this.uiManager.resetFeedbackForm(false);  // false 表示不清空文字
                }
                // 只清空圖片
                if (this.imageHandler) {
                    this.imageHandler.clearImages();
                }
                console.log('📤 回饋已發送，等待服務器確認...');
            } else {
                throw new Error('WebSocket 發送失敗');
            }

        } catch (error) {
            console.error('❌ 發送回饋失敗:', error);
            const sendFailedMessage = window.i18nManager ? window.i18nManager.t('feedback.sendFailed') : '發送失敗，請重試';
            window.MCPFeedback.Utils.showMessage(sendFailedMessage, window.MCPFeedback.Utils.CONSTANTS.MESSAGE_ERROR);

            // 恢復到等待狀態
            if (this.uiManager) {
                this.uiManager.setFeedbackState(window.MCPFeedback.Utils.CONSTANTS.FEEDBACK_WAITING);
            }
        }
    };

    /**
     * 記錄用戶訊息到會話歷史
     */
    FeedbackApp.prototype.recordUserMessage = function(feedbackData) {
        console.log('📝 記錄用戶訊息到會話歷史...');

        try {
            // 檢查是否有會話管理器
            if (!this.sessionManager || !this.sessionManager.dataManager) {
                console.warn('📝 會話管理器未初始化，跳過用戶訊息記錄');
                return;
            }

            // 判斷提交方式
            const submissionMethod = this.autoSubmitManager && this.autoSubmitManager.isEnabled ? 'auto' : 'manual';

            // 建立訊息記錄資料
            const messageData = {
                content: feedbackData.feedback || '',
                images: feedbackData.images || [],
                submission_method: submissionMethod
            };

            // 記錄到會話歷史
            const success = this.sessionManager.dataManager.addUserMessage(messageData);

            if (success) {
                console.log('📝 用戶訊息已記錄到會話歷史');
            } else {
                console.log('📝 用戶訊息記錄被跳過（可能因隱私設定或其他原因）');
            }

        } catch (error) {
            console.error('❌ 記錄用戶訊息失敗:', error);
            // 不影響主要功能，只記錄錯誤
        }
    };

    /**
     * 清空回饋內容
     */
    FeedbackApp.prototype.clearFeedback = function() {
        console.log('🧹 清空回饋內容...');

        // 使用 UI 管理器重置表單，並清空文字
        if (this.uiManager) {
            this.uiManager.resetFeedbackForm(true);  // 傳入 true 表示要清空文字
        }

        // 清空圖片數據
        if (this.imageHandler) {
            this.imageHandler.clearImages();
        }

        console.log('✅ 回饋內容清空完成');
    };

    /**
     * 複製用戶回饋內容
     */
    FeedbackApp.prototype.copyUserFeedback = function() {
        console.log('📋 複製用戶回饋內容...');

        const feedbackInput = window.MCPFeedback.Utils.safeQuerySelector('#combinedFeedbackText');
        if (!feedbackInput || !feedbackInput.value.trim()) {
            window.MCPFeedback.Utils.showMessage(
                window.i18nManager ? window.i18nManager.t('feedback.noContent') : '沒有可複製的內容',
                window.MCPFeedback.Utils.CONSTANTS.MESSAGE_WARNING
            );
            return;
        }

        const textContent = feedbackInput.value;

        // 複製到剪貼板
        navigator.clipboard.writeText(textContent)
            .then(function() {
                console.log('✅ 內容已複製到剪貼板');
                window.MCPFeedback.Utils.showMessage(
                    window.i18nManager ? window.i18nManager.t('feedback.copySuccess') : '內容已複製到剪貼板',
                    window.MCPFeedback.Utils.CONSTANTS.MESSAGE_SUCCESS
                );
            })
            .catch(function(err) {
                console.error('❌ 複製失敗:', err);
                // 降級方案：使用舊的複製方法
                const textarea = document.createElement('textarea');
                textarea.value = textContent;
                textarea.style.position = 'fixed';
                textarea.style.left = '-999999px';
                document.body.appendChild(textarea);
                textarea.select();
                try {
                    document.execCommand('copy');
                    window.MCPFeedback.Utils.showMessage(
                        window.i18nManager ? window.i18nManager.t('feedback.copySuccess') : '內容已複製到剪貼板',
                        window.MCPFeedback.Utils.CONSTANTS.MESSAGE_SUCCESS
                    );
                } catch (error) {
                    window.MCPFeedback.Utils.showMessage(
                        window.i18nManager ? window.i18nManager.t('feedback.copyFailed') : '複製失敗',
                        window.MCPFeedback.Utils.CONSTANTS.MESSAGE_ERROR
                    );
                }
                document.body.removeChild(textarea);
            });
    };

    /**
     * 取消回饋
     */
    FeedbackApp.prototype.cancelFeedback = function() {
        console.log('❌ 取消回饋');
        this.clearFeedback();
    };

    /**
     * 聚焦到輸入框 (Ctrl+I 快捷鍵)
     */
    FeedbackApp.prototype.focusInput = function() {
        console.log('🎯 執行聚焦輸入框...');

        // 聚焦到合併模式的輸入框
        const targetInput = window.MCPFeedback.Utils.safeQuerySelector('#combinedFeedbackText');

        // 確保在工作區分頁
        if (this.uiManager && this.uiManager.getCurrentTab() !== 'combined') {
            this.uiManager.switchTab('combined');
        }

        if (targetInput) {
            // 聚焦並滾動到可見區域
            targetInput.focus();
            targetInput.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });

            console.log('✅ 已聚焦到輸入框');
        } else {
            console.warn('⚠️ 未找到目標輸入框');
        }
    };

    /**
     * 執行命令
     */
    FeedbackApp.prototype.runCommand = function() {
        const commandInput = window.MCPFeedback.Utils.safeQuerySelector('#commandInput');
        const command = commandInput ? commandInput.value.trim() : '';

        if (!command) {
            const emptyCommandMessage = window.i18nManager ? window.i18nManager.t('commands.emptyCommand') : '請輸入命令';
            this.appendCommandOutput('⚠️ ' + emptyCommandMessage + '\n');
            return;
        }

        if (!this.webSocketManager || !this.webSocketManager.isConnected) {
            const notConnectedMessage = window.i18nManager ? window.i18nManager.t('commands.notConnected') : 'WebSocket 未連接，無法執行命令';
            this.appendCommandOutput('❌ ' + notConnectedMessage + '\n');
            return;
        }

        // 顯示執行的命令
        this.appendCommandOutput('$ ' + command + '\n');

        // 發送命令
        try {
            const success = this.webSocketManager.send({
                type: 'run_command',
                command: command
            });

            if (success) {
                // 清空輸入框
                commandInput.value = '';
                const executingMessage = window.i18nManager ? window.i18nManager.t('commands.executing') : '正在執行...';
                this.appendCommandOutput('[' + executingMessage + ']\n');
            } else {
                const sendFailedMessage = window.i18nManager ? window.i18nManager.t('commands.sendFailed') : '發送命令失敗';
                this.appendCommandOutput('❌ ' + sendFailedMessage + '\n');
            }

        } catch (error) {
            const sendFailedMessage = window.i18nManager ? window.i18nManager.t('commands.sendFailed') : '發送命令失敗';
            this.appendCommandOutput('❌ ' + sendFailedMessage + ': ' + error.message + '\n');
        }
    };

    /**
     * 添加命令輸出
     */
    FeedbackApp.prototype.appendCommandOutput = function(output) {
        const commandOutput = window.MCPFeedback.Utils.safeQuerySelector('#commandOutput');
        if (commandOutput) {
            // 檢查是否是空的（首次使用）
            if (commandOutput.textContent === '' && output.startsWith('$')) {
                // 如果是空的且輸出以 $ 開頭，添加歡迎訊息
                const projectPathElement = window.MCPFeedback.Utils.safeQuerySelector('#projectPathDisplay');
                const projectPath = projectPathElement ? projectPathElement.getAttribute('data-full-path') : 'unknown';
                
                const welcomeText = `歡迎使用互動回饋終端
========================================
專案目錄: ${projectPath}
輸入命令後按 Enter 或點擊執行按鈕
支援的命令: ls, dir, pwd, cat, type 等

`;
                commandOutput.textContent = welcomeText;
            }
            
            commandOutput.textContent += output;
            commandOutput.scrollTop = commandOutput.scrollHeight;
        }
    };

    /**
     * 啟用命令輸入
     */
    FeedbackApp.prototype.enableCommandInput = function() {
        const commandInput = window.MCPFeedback.Utils.safeQuerySelector('#commandInput');
        const runCommandBtn = window.MCPFeedback.Utils.safeQuerySelector('#runCommandBtn');

        if (commandInput) commandInput.disabled = false;
        if (runCommandBtn) {
            runCommandBtn.disabled = false;
            runCommandBtn.textContent = '▶️ 執行';
        }
    };

    /**
     * 執行新會話自動命令
     */
    FeedbackApp.prototype.executeAutoCommandOnNewSession = function() {
        if (!this.settingsManager) return;
        
        const settings = this.settingsManager.currentSettings;
        if (!settings.autoCommandEnabled || !settings.commandOnNewSession) {
            console.log('⏩ 新會話自動命令未啟用或未設定');
            return;
        }
        
        const command = settings.commandOnNewSession.trim();
        if (!command) return;
        
        console.log('🚀 執行新會話自動命令:', command);
        this.appendCommandOutput('🆕 [自動執行] $ ' + command + '\n');
        
        // 使用 WebSocket 發送命令
        if (this.webSocketManager && this.webSocketManager.isConnected) {
            console.log('📡 WebSocket 已連接，發送命令:', command);
            this.webSocketManager.send({
                type: 'run_command',
                command: command
            });
        } else {
            console.error('❌ 無法執行自動命令：WebSocket 未連接');
            this.appendCommandOutput('[錯誤] WebSocket 未連接，無法執行命令\n');
        }
    };
    
    /**
     * 執行提交回饋後自動命令
     */
    FeedbackApp.prototype.executeAutoCommandOnFeedbackSubmit = function() {
        if (!this.settingsManager) return;
        
        const settings = this.settingsManager.currentSettings;
        if (!settings.autoCommandEnabled || !settings.commandOnFeedbackSubmit) {
            console.log('⏩ 提交回饋後自動命令未啟用或未設定');
            return;
        }
        
        const command = settings.commandOnFeedbackSubmit.trim();
        if (!command) return;
        
        console.log('🚀 執行提交回饋後自動命令:', command);
        this.appendCommandOutput('✅ [自動執行] $ ' + command + '\n');
        
        // 使用 WebSocket 發送命令
        if (this.webSocketManager && this.webSocketManager.isConnected) {
            console.log('📡 WebSocket 已連接，發送命令:', command);
            this.webSocketManager.send({
                type: 'run_command',
                command: command
            });
        } else {
            console.error('❌ 無法執行自動命令：WebSocket 未連接');
            this.appendCommandOutput('[錯誤] WebSocket 未連接，無法執行命令\n');
        }
    };

    /**
     * 更新摘要狀態
     */
    FeedbackApp.prototype.updateSummaryStatus = function(message) {
        const summaryElements = document.querySelectorAll('.ai-summary-content');
        summaryElements.forEach(function(element) {
            element.innerHTML = '<div style="padding: 16px; background: var(--success-color); color: white; border-radius: 6px; text-align: center;">✅ ' + message + '</div>';
        });
    };

    /**
     * 設置自動命令相關事件
     */
    FeedbackApp.prototype.setupAutoCommandEvents = function() {
        const self = this;
        
        // 自動命令開關
        const autoCommandEnabled = window.MCPFeedback.Utils.safeQuerySelector('#autoCommandEnabled');
        if (autoCommandEnabled) {
            // 載入設定
            if (this.settingsManager) {
                autoCommandEnabled.checked = this.settingsManager.currentSettings.autoCommandEnabled;
                this.updateAutoCommandUI(autoCommandEnabled.checked);
            }
            
            autoCommandEnabled.addEventListener('change', function() {
                const enabled = autoCommandEnabled.checked;
                self.updateAutoCommandUI(enabled);
                
                if (self.settingsManager) {
                    self.settingsManager.saveSettings({
                        autoCommandEnabled: enabled
                    });
                }
            });
        }
        
        // 新會話命令輸入
        const commandOnNewSession = window.MCPFeedback.Utils.safeQuerySelector('#commandOnNewSession');
        if (commandOnNewSession) {
            // 載入設定
            if (this.settingsManager) {
                commandOnNewSession.value = this.settingsManager.currentSettings.commandOnNewSession || '';
            }
            
            commandOnNewSession.addEventListener('change', function() {
                if (self.settingsManager) {
                    self.settingsManager.saveSettings({
                        commandOnNewSession: commandOnNewSession.value
                    });
                }
            });
        }
        
        // 提交回饋後命令輸入
        const commandOnFeedbackSubmit = window.MCPFeedback.Utils.safeQuerySelector('#commandOnFeedbackSubmit');
        if (commandOnFeedbackSubmit) {
            // 載入設定
            if (this.settingsManager) {
                commandOnFeedbackSubmit.value = this.settingsManager.currentSettings.commandOnFeedbackSubmit || '';
            }
            
            commandOnFeedbackSubmit.addEventListener('change', function() {
                if (self.settingsManager) {
                    self.settingsManager.saveSettings({
                        commandOnFeedbackSubmit: commandOnFeedbackSubmit.value
                    });
                }
            });
        }
        
        // 測試執行按鈕
        const testNewSessionCommand = window.MCPFeedback.Utils.safeQuerySelector('#testNewSessionCommand');
        if (testNewSessionCommand) {
            testNewSessionCommand.addEventListener('click', function() {
                const command = commandOnNewSession ? commandOnNewSession.value.trim() : '';
                if (command) {
                    self.testCommand(command, '🆕 [測試] ');
                } else {
                    window.MCPFeedback.Utils.showMessage('請先輸入命令', window.MCPFeedback.Utils.CONSTANTS.MESSAGE_WARNING);
                }
            });
        }
        
        const testFeedbackCommand = window.MCPFeedback.Utils.safeQuerySelector('#testFeedbackCommand');
        if (testFeedbackCommand) {
            testFeedbackCommand.addEventListener('click', function() {
                const command = commandOnFeedbackSubmit ? commandOnFeedbackSubmit.value.trim() : '';
                if (command) {
                    self.testCommand(command, '✅ [測試] ');
                } else {
                    window.MCPFeedback.Utils.showMessage('請先輸入命令', window.MCPFeedback.Utils.CONSTANTS.MESSAGE_WARNING);
                }
            });
        }
    };
    
    /**
     * 更新自動命令 UI 狀態
     */
    FeedbackApp.prototype.updateAutoCommandUI = function(enabled) {
        const autoCommandContent = window.MCPFeedback.Utils.safeQuerySelector('#autoCommandContent');
        if (autoCommandContent) {
            if (enabled) {
                autoCommandContent.classList.remove('disabled');
            } else {
                autoCommandContent.classList.add('disabled');
            }
        }
    };
    
    /**
     * 測試命令執行
     */
    FeedbackApp.prototype.testCommand = function(command, prefix) {
        if (!command) return;
        
        console.log('🧪 測試執行命令:', command);
        this.appendCommandOutput(prefix + '$ ' + command + '\n');
        
        // 使用 WebSocket 發送命令
        if (this.webSocketManager && this.webSocketManager.isConnected) {
            this.webSocketManager.send({
                type: 'run_command',
                command: command
            });
        } else {
            this.appendCommandOutput('❌ WebSocket 未連接\n');
        }
    };

    /**
     * 處理會話更新（來自自動刷新）
     */
    FeedbackApp.prototype.handleSessionUpdate = function(sessionData) {
        console.log('🔄 處理自動檢測到的會話更新:', sessionData);

        // 只更新當前會話 ID，不管理狀態
        this.currentSessionId = sessionData.session_id;

        // 局部更新頁面內容
        this.refreshPageContent();
    };

    /**
     * 刷新頁面內容
     */
    FeedbackApp.prototype.refreshPageContent = function() {
        console.log('🔄 局部更新頁面內容...');

        const self = this;

        fetch('/api/current-session')
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('API 請求失敗: ' + response.status);
                }
                return response.json();
            })
            .then(function(sessionData) {
                console.log('📥 獲取到最新會話資料:', sessionData);

                // 檢查並保護已提交狀態
                if (sessionData.session_id && self.uiManager) {
                    const currentState = self.uiManager.getFeedbackState();
                    if (currentState !== window.MCPFeedback.Utils.CONSTANTS.FEEDBACK_SUBMITTED) {
                        self.uiManager.setFeedbackState(window.MCPFeedback.Utils.CONSTANTS.FEEDBACK_WAITING, sessionData.session_id);
                        console.log('🔄 局部更新：重置回饋狀態為等待中');
                    } else {
                        console.log('🔒 局部更新：保護已提交狀態，不重置');
                        // 只更新會話ID，保持已提交狀態
                        self.uiManager.setFeedbackState(window.MCPFeedback.Utils.CONSTANTS.FEEDBACK_SUBMITTED, sessionData.session_id);
                    }
                }

                // 更新 AI 摘要內容
                if (self.uiManager) {
                    // console.log('🔧 準備更新 AI 摘要內容，summary 長度:', sessionData.summary ? sessionData.summary.length : 'undefined');
                    self.uiManager.updateAISummaryContent(sessionData.summary);
                    self.uiManager.resetFeedbackForm(false);  // 不清空文字內容
                    self.uiManager.updateStatusIndicator();
                }

                // 更新頁面標題
                if (sessionData.project_directory) {
                    const projectName = sessionData.project_directory.split(/[/\\]/).pop();
                    document.title = 'MCP Feedback - ' + projectName;
                }

                console.log('✅ 局部更新完成');
            })
            .catch(function(error) {
                console.error('❌ 局部更新失敗:', error);
                const updateFailedMessage = window.i18nManager ? window.i18nManager.t('app.updateFailed') : '更新內容失敗，請手動刷新頁面以查看新的 AI 工作摘要';
                window.MCPFeedback.Utils.showMessage(updateFailedMessage, window.MCPFeedback.Utils.CONSTANTS.MESSAGE_WARNING);
            });
    };

    /**
     * 初始化自動提交管理器
     */
    FeedbackApp.prototype.initializeAutoSubmitManager = function() {
        console.log('⏰ 初始化自動提交管理器...');

        try {
            const self = this;

            // 創建自動提交管理器
            this.autoSubmitManager = {
                countdown: null,
                isEnabled: false,
                currentPromptId: null,

                // 啟動自動提交
                start: function(timeoutSeconds, promptId) {
                    this.stop(); // 先停止現有的倒數計時

                    this.isEnabled = true;
                    this.currentPromptId = promptId;

                    // 顯示倒數計時器
                    self.showCountdownDisplay();

                    // 創建倒數計時器
                    this.countdown = window.MCPFeedback.Utils.Time.createAutoSubmitCountdown(
                        timeoutSeconds,
                        function(remainingTime, isCompleted) {
                            // 更新倒數計時顯示
                            self.updateCountdownDisplay(remainingTime);
                        },
                        function() {
                            // 時間到，自動提交
                            self.performAutoSubmit();
                        }
                    );

                    this.countdown.start();
                    console.log('⏰ 自動提交倒數計時已啟動:', timeoutSeconds + '秒');
                },

                // 停止自動提交
                stop: function() {
                    if (this.countdown) {
                        this.countdown.stop();
                        this.countdown = null;
                    }

                    this.isEnabled = false;
                    this.currentPromptId = null;

                    // 隱藏倒數計時器
                    self.hideCountdownDisplay();

                    console.log('⏸️ 自動提交倒數計時已停止');
                },

                // 暫停倒數計時
                pause: function() {
                    if (this.countdown && this.countdown.pause) {
                        this.countdown.pause();
                        self.updateCountdownPauseState(true);
                        console.log('⏸ 自動提交倒數計時已暫停');
                    }
                },

                // 恢復倒數計時
                resume: function() {
                    if (this.countdown && this.countdown.resume) {
                        this.countdown.resume();
                        self.updateCountdownPauseState(false);
                        console.log('▶ 自動提交倒數計時已恢復');
                    }
                },

                // 切換暫停/恢復狀態
                togglePause: function() {
                    if (!this.countdown) return;
                    
                    if (this.countdown.isPaused()) {
                        this.resume();
                    } else {
                        this.pause();
                    }
                }
            };

            console.log('✅ 自動提交管理器初始化完成');

        } catch (error) {
            console.error('❌ 自動提交管理器初始化失敗:', error);
        }
    };

    /**
     * 檢查並啟動自動提交（原始版本，供防抖使用）
     */
    FeedbackApp.prototype._originalCheckAndStartAutoSubmit = function() {
        // 減少重複日誌：只在首次檢查或條件變化時記錄
        if (!this._lastAutoSubmitCheck || Date.now() - this._lastAutoSubmitCheck > 1000) {
            console.log('🔍 檢查自動提交條件...');
            this._lastAutoSubmitCheck = Date.now();
        }

        if (!this.autoSubmitManager || !this.settingsManager || !this.promptManager) {
            console.log('⚠️ 自動提交管理器、設定管理器或提示詞管理器未初始化');
            return;
        }

        // 檢查自動提交是否已啟用
        const autoSubmitEnabled = this.settingsManager.get('autoSubmitEnabled');
        const autoSubmitPromptId = this.settingsManager.get('autoSubmitPromptId');
        const autoSubmitTimeout = this.settingsManager.get('autoSubmitTimeout');

        console.log('🔍 自動提交設定檢查:', {
            enabled: autoSubmitEnabled,
            promptId: autoSubmitPromptId,
            timeout: autoSubmitTimeout
        });

        // 雙重檢查：設定中的 promptId 和提示詞的 isAutoSubmit 狀態
        let validAutoSubmitPrompt = null;
        if (autoSubmitPromptId) {
            const prompt = this.promptManager.getPromptById(autoSubmitPromptId);
            if (prompt && prompt.isAutoSubmit) {
                validAutoSubmitPrompt = prompt;
            } else {
                console.log('⚠️ 自動提交提示詞驗證失敗:', {
                    promptExists: !!prompt,
                    isAutoSubmit: prompt ? prompt.isAutoSubmit : false,
                    reason: !prompt ? '提示詞不存在' : '提示詞未標記為自動提交'
                });
                // 只清空無效的 promptId，保留用戶的 autoSubmitEnabled 設定
                // 這樣避免因為提示詞問題而強制關閉用戶的自動提交偏好
                this.settingsManager.set('autoSubmitPromptId', null);
                console.log('🔧 已清空無效的 autoSubmitPromptId，保留 autoSubmitEnabled 設定:', autoSubmitEnabled);
            }
        }

        // 檢查當前狀態是否為等待回饋
        const currentState = this.uiManager ? this.uiManager.getFeedbackState() : null;
        const isWaitingForFeedback = currentState === window.MCPFeedback.Utils.CONSTANTS.FEEDBACK_WAITING;

        console.log('🔍 當前回饋狀態:', currentState, '是否等待回饋:', isWaitingForFeedback);

        // 如果所有條件都滿足，啟動自動提交
        if (autoSubmitEnabled && validAutoSubmitPrompt && autoSubmitTimeout && isWaitingForFeedback) {
            console.log('✅ 自動提交條件滿足，啟動倒數計時器');
            this.autoSubmitManager.start(autoSubmitTimeout, autoSubmitPromptId);
            this.updateAutoSubmitStatus('enabled', autoSubmitTimeout);
        } else {
            console.log('❌ 自動提交條件不滿足，停止倒數計時器');
            this.autoSubmitManager.stop();
            this.updateAutoSubmitStatus('disabled');
        }
    };

    /**
     * 檢查並啟動自動提交（防抖版本）
     */
    FeedbackApp.prototype.checkAndStartAutoSubmit = function() {
        if (this._debouncedCheckAndStartAutoSubmit) {
            this._debouncedCheckAndStartAutoSubmit();
        } else {
            // 回退到原始方法（防抖未初始化時）
            this._originalCheckAndStartAutoSubmit();
        }
    };

    /**
     * 處理自動提交狀態變更
     */
    FeedbackApp.prototype.handleAutoSubmitStateChange = function(enabled, settings) {
        console.log('⏰ 處理自動提交狀態變更:', enabled, settings);

        if (!this.autoSubmitManager) {
            console.warn('⚠️ 自動提交管理器未初始化');
            return;
        }

        if (enabled && settings.promptId && settings.timeout) {
            // 檢查當前狀態是否適合啟動自動提交
            const currentState = this.uiManager ? this.uiManager.getFeedbackState() : null;
            const isWaitingForFeedback = currentState === window.MCPFeedback.Utils.CONSTANTS.FEEDBACK_WAITING;

            if (isWaitingForFeedback) {
                // 啟動自動提交
                this.autoSubmitManager.start(settings.timeout, settings.promptId);
                this.updateAutoSubmitStatus('enabled', settings.timeout);
                console.log('⏰ 自動提交已啟動（設定變更觸發）');
            } else {
                // 只更新狀態顯示，不啟動倒數計時器
                this.updateAutoSubmitStatus('enabled', settings.timeout);
                console.log('⏰ 自動提交設定已啟用，等待適當時機啟動');
            }
        } else {
            // 停止自動提交
            this.autoSubmitManager.stop();
            this.updateAutoSubmitStatus('disabled');
            console.log('⏸️ 自動提交已停用（設定變更觸發）');
        }
    };

    /**
     * 執行自動提交
     */
    FeedbackApp.prototype.performAutoSubmit = function() {
        console.log('⏰ 執行自動提交...');

        if (!this.autoSubmitManager || !this.promptManager || !this.settingsManager) {
            console.error('❌ 自動提交管理器、提示詞管理器或設定管理器未初始化');
            this.autoSubmitManager && this.autoSubmitManager.stop();
            return;
        }

        const promptId = this.autoSubmitManager.currentPromptId;
        const autoSubmitPromptId = this.settingsManager.get('autoSubmitPromptId');

        // 雙重檢查：確保 promptId 有效且與設定一致
        if (!promptId || !autoSubmitPromptId || promptId !== autoSubmitPromptId) {
            console.error('❌ 自動提交提示詞 ID 不一致或為空:', {
                currentPromptId: promptId,
                settingsPromptId: autoSubmitPromptId
            });
            this.pauseAutoSubmit('提示詞 ID 不一致');
            return;
        }

        const prompt = this.promptManager.getPromptById(promptId);

        if (!prompt) {
            console.error('❌ 找不到自動提交提示詞:', promptId);
            this.pauseAutoSubmit('找不到指定的提示詞');
            return;
        }

        // 檢查提示詞的 isAutoSubmit 狀態
        if (!prompt.isAutoSubmit) {
            console.error('❌ 提示詞不是自動提交狀態:', prompt.name);
            this.pauseAutoSubmit('提示詞不是自動提交狀態');
            return;
        }

        // 設定提示詞內容到回饋輸入框
        const feedbackInput = window.MCPFeedback.Utils.safeQuerySelector('#combinedFeedbackText');
        if (feedbackInput) {
            feedbackInput.value = prompt.content;
        }

        // 顯示自動提交訊息
        const message = window.i18nManager ?
            window.i18nManager.t('autoSubmit.executing', '正在執行自動提交...') :
            '正在執行自動提交...';
        window.MCPFeedback.Utils.showMessage(message, window.MCPFeedback.Utils.CONSTANTS.MESSAGE_INFO);

        // 執行提交
        this.submitFeedback();

        // 更新提示詞使用記錄
        this.promptManager.usePrompt(promptId);

        // 停止自動提交
        this.autoSubmitManager.stop();
    };

    /**
     * 暫停自動提交功能（當檢查失敗時）
     */
    FeedbackApp.prototype.pauseAutoSubmit = function(reason) {
        console.error('⏸️ 暫停自動提交功能，原因:', reason);

        // 停止倒數計時器
        if (this.autoSubmitManager) {
            this.autoSubmitManager.stop();
        }

        // 清空自動提交設定
        if (this.settingsManager) {
            this.settingsManager.set('autoSubmitEnabled', false);
            this.settingsManager.set('autoSubmitPromptId', null);
        }

        // 清空所有提示詞的自動提交標記
        if (this.promptManager) {
            this.promptManager.clearAutoSubmitPrompt();
        }

        // 更新 UI 狀態
        this.updateAutoSubmitStatus('disabled');

        // 顯示錯誤訊息
        const message = window.i18nManager ?
            window.i18nManager.t('autoSubmit.paused', '自動提交已暫停：') + reason :
            '自動提交已暫停：' + reason;
        window.MCPFeedback.Utils.showMessage(message, window.MCPFeedback.Utils.CONSTANTS.MESSAGE_ERROR);
    };

    /**
     * 顯示倒數計時器
     */
    FeedbackApp.prototype.showCountdownDisplay = function() {
        const countdownDisplay = document.getElementById('countdownDisplay');

        if (countdownDisplay) {
            countdownDisplay.style.display = 'flex';
        }
    };

    /**
     * 隱藏倒數計時器
     */
    FeedbackApp.prototype.hideCountdownDisplay = function() {
        const countdownDisplay = document.getElementById('countdownDisplay');

        if (countdownDisplay) {
            countdownDisplay.style.display = 'none';
            // 重置暫停狀態
            this.updateCountdownPauseState(false);
        }
    };

    /**
     * 更新倒數計時顯示
     */
    FeedbackApp.prototype.updateCountdownDisplay = function(remainingSeconds) {
        const countdownTimer = document.getElementById('countdownTimer');

        const formattedTime = window.MCPFeedback.Utils.Time.formatAutoSubmitCountdown(remainingSeconds);

        // 更新倒數計時器
        if (countdownTimer) {
            countdownTimer.textContent = formattedTime;

            // 根據剩餘時間調整樣式
            countdownTimer.className = 'countdown-timer';
            if (remainingSeconds <= 10) {
                countdownTimer.classList.add('danger');
            } else if (remainingSeconds <= 30) {
                countdownTimer.classList.add('warning');
            }
        }
    };

    /**
     * 更新自動提交狀態顯示
     */
    FeedbackApp.prototype.updateAutoSubmitStatus = function(status, timeout) {
        const statusElement = document.getElementById('autoSubmitStatus');
        if (!statusElement) return;

        const statusIcon = statusElement.querySelector('span:first-child');
        const statusText = statusElement.querySelector('.button-text');

        if (status === 'enabled') {
            // 直接設定 HTML 內容，就像提示詞按鈕一樣
            if (statusIcon) statusIcon.innerHTML = '⏰';
            if (statusText) {
                const enabledText = window.i18nManager ?
                    window.i18nManager.t('autoSubmit.enabled', '已啟用') :
                    '已啟用';
                statusText.textContent = `${enabledText} (${timeout}秒)`;
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
     * 更新倒數計時器暫停狀態
     */
    FeedbackApp.prototype.updateCountdownPauseState = function(isPaused) {
        const countdownDisplay = document.getElementById('countdownDisplay');
        const pauseBtn = document.getElementById('countdownPauseBtn');
        
        if (!countdownDisplay || !pauseBtn) return;
        
        // 更新暫停/恢復圖標
        const pauseIcon = pauseBtn.querySelector('.pause-icon');
        const resumeIcon = pauseBtn.querySelector('.resume-icon');
        
        if (isPaused) {
            countdownDisplay.classList.add('paused');
            if (pauseIcon) pauseIcon.style.display = 'none';
            if (resumeIcon) resumeIcon.style.display = 'inline';
            
            // 更新按鈕的 tooltip
            const resumeTitle = window.i18nManager ?
                window.i18nManager.t('autoSubmit.resumeCountdown', '恢復倒數') :
                '恢復倒數';
            pauseBtn.setAttribute('title', resumeTitle);
            pauseBtn.setAttribute('data-i18n-title', 'autoSubmit.resumeCountdown');
        } else {
            countdownDisplay.classList.remove('paused');
            if (pauseIcon) pauseIcon.style.display = 'inline';
            if (resumeIcon) resumeIcon.style.display = 'none';
            
            // 更新按鈕的 tooltip
            const pauseTitle = window.i18nManager ?
                window.i18nManager.t('autoSubmit.pauseCountdown', '暫停倒數') :
                '暫停倒數';
            pauseBtn.setAttribute('title', pauseTitle);
            pauseBtn.setAttribute('data-i18n-title', 'autoSubmit.pauseCountdown');
        }
    };

    /**
     * 設置用戶活動監聽器（用於重置會話超時）
     */
    FeedbackApp.prototype.setupUserActivityListeners = function() {
        const self = this;
        
        // 定義需要監聽的活動事件
        const activityEvents = ['click', 'keypress', 'mousemove', 'touchstart', 'scroll'];
        
        // 防抖處理，避免過於頻繁地重置計時器
        const resetTimeout = window.MCPFeedback.Utils.DOM.debounce(function() {
            if (self.webSocketManager) {
                self.webSocketManager.resetSessionTimeout();
            }
        }, 5000, false); // 5秒內的連續活動只重置一次
        
        // 為每個事件添加監聽器
        activityEvents.forEach(function(eventType) {
            document.addEventListener(eventType, resetTimeout, { passive: true });
        });
        
        console.log('✅ 用戶活動監聽器已設置');
    };

    /**
     * 清理資源
     */
    FeedbackApp.prototype.cleanup = function() {
        console.log('🧹 清理應用程式資源...');

        if (this.autoSubmitManager) {
            this.autoSubmitManager.stop();
        }

        if (this.tabManager) {
            this.tabManager.cleanup();
        }

        if (this.webSocketManager) {
            this.webSocketManager.close();
        }

        if (this.connectionMonitor) {
            this.connectionMonitor.cleanup();
        }

        if (this.sessionManager) {
            this.sessionManager.cleanup();
        }

        if (this.imageHandler) {
            this.imageHandler.cleanup();
        }

        if (this.textareaHeightManager) {
            this.textareaHeightManager.destroy();
        }

        console.log('✅ 應用程式資源清理完成');
    };

    // 將 FeedbackApp 加入命名空間
    window.MCPFeedback.FeedbackApp = FeedbackApp;

    console.log('✅ FeedbackApp 主模組載入完成');

})();