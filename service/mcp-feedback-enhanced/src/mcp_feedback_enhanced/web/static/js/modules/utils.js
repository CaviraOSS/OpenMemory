/**
 * MCP Feedback Enhanced - 工具模組
 * ================================
 * 
 * 提供共用的工具函數和常數定義
 */

(function() {
    'use strict';

    // 確保命名空間存在
    window.MCPFeedback = window.MCPFeedback || {};
    window.MCPFeedback.Utils = window.MCPFeedback.Utils || {};

    /**
     * 工具函數模組 - 擴展現有的 Utils 物件
     */
    Object.assign(window.MCPFeedback.Utils, {
        
        /**
         * 格式化檔案大小
         * @param {number} bytes - 位元組數
         * @returns {string} 格式化後的檔案大小
         */
        formatFileSize: function(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },

        /**
         * 生成唯一 ID
         * @param {string} prefix - ID 前綴
         * @returns {string} 唯一 ID
         */
        generateId: function(prefix) {
            prefix = prefix || 'id';
            return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        },

        /**
         * 深度複製物件
         * @param {Object} obj - 要複製的物件
         * @returns {Object} 複製後的物件
         */
        deepClone: function(obj) {
            if (obj === null || typeof obj !== 'object') return obj;
            if (obj instanceof Date) return new Date(obj.getTime());
            if (obj instanceof Array) return obj.map(item => this.deepClone(item));
            if (typeof obj === 'object') {
                const clonedObj = {};
                for (const key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        clonedObj[key] = this.deepClone(obj[key]);
                    }
                }
                return clonedObj;
            }
        },

        /**
         * 防抖函數
         * @param {Function} func - 要防抖的函數
         * @param {number} wait - 等待時間（毫秒）
         * @returns {Function} 防抖後的函數
         */
        debounce: function(func, wait) {
            let timeout;
            return function executedFunction() {
                const later = () => {
                    clearTimeout(timeout);
                    func.apply(this, arguments);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        /**
         * 節流函數
         * @param {Function} func - 要節流的函數
         * @param {number} limit - 限制時間（毫秒）
         * @returns {Function} 節流後的函數
         */
        throttle: function(func, limit) {
            let inThrottle;
            return function() {
                const args = arguments;
                const context = this;
                if (!inThrottle) {
                    func.apply(context, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        },

        /**
         * 安全的 JSON 解析
         * @param {string} jsonString - JSON 字串
         * @param {*} defaultValue - 預設值
         * @returns {*} 解析結果或預設值
         */
        safeJsonParse: function(jsonString, defaultValue) {
            try {
                return JSON.parse(jsonString);
            } catch (error) {
                console.warn('JSON 解析失敗:', error);
                return defaultValue;
            }
        },

        /**
         * 檢查元素是否存在
         * @param {string} selector - CSS 選擇器
         * @returns {boolean} 元素是否存在
         */
        elementExists: function(selector) {
            return document.querySelector(selector) !== null;
        },

        /**
         * 從右側截斷路徑，保留最後幾個目錄層級
         * @param {string} path - 完整路徑
         * @param {number} maxLevels - 保留的最大目錄層級數（默認2）
         * @param {number} maxLength - 最大顯示長度（默認40）
         * @returns {object} 包含 truncated（截斷後的路徑）和 isTruncated（是否被截斷）
         */
        truncatePathFromRight: function(path, maxLevels, maxLength) {
            maxLevels = maxLevels || 2;
            maxLength = maxLength || 40;

            if (!path || typeof path !== 'string') {
                return { truncated: path || '', isTruncated: false };
            }

            // 如果路徑長度小於最大長度，直接返回
            if (path.length <= maxLength) {
                return { truncated: path, isTruncated: false };
            }

            // 統一路徑分隔符為反斜線（Windows風格）
            const normalizedPath = path.replace(/\//g, '\\');

            // 分割路徑
            const parts = normalizedPath.split('\\').filter(part => part.length > 0);

            if (parts.length <= maxLevels) {
                return { truncated: normalizedPath, isTruncated: false };
            }

            // 取最後幾個層級
            const lastParts = parts.slice(-maxLevels);
            const truncatedPath = '...' + '\\' + lastParts.join('\\');

            return {
                truncated: truncatedPath,
                isTruncated: true
            };
        },

        /**
         * 複製文字到剪貼板（統一的複製功能）
         * @param {string} text - 要複製的文字
         * @param {string} successMessage - 成功提示訊息
         * @param {string} errorMessage - 錯誤提示訊息
         * @returns {Promise<boolean>} 複製是否成功
         */
        copyToClipboard: function(text, successMessage, errorMessage) {
            successMessage = successMessage || (window.i18nManager ? 
                window.i18nManager.t('utils.copySuccess', '已複製到剪貼板') : 
                '已複製到剪貼板');
            errorMessage = errorMessage || (window.i18nManager ? 
                window.i18nManager.t('utils.copyError', '複製失敗') : 
                '複製失敗');

            return new Promise(function(resolve) {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    // 使用現代 Clipboard API
                    navigator.clipboard.writeText(text).then(function() {
                        if (window.MCPFeedback && window.MCPFeedback.Utils && window.MCPFeedback.Utils.showMessage) {
                            window.MCPFeedback.Utils.showMessage(successMessage, window.MCPFeedback.Utils.CONSTANTS.MESSAGE_SUCCESS);
                        }
                        resolve(true);
                    }).catch(function(err) {
                        console.error('Clipboard API 複製失敗:', err);
                        // 回退到舊方法
                        const success = window.MCPFeedback.Utils.fallbackCopyToClipboard(text);
                        if (success) {
                            if (window.MCPFeedback && window.MCPFeedback.Utils && window.MCPFeedback.Utils.showMessage) {
                                window.MCPFeedback.Utils.showMessage(successMessage, window.MCPFeedback.Utils.CONSTANTS.MESSAGE_SUCCESS);
                            }
                            resolve(true);
                        } else {
                            if (window.MCPFeedback && window.MCPFeedback.Utils && window.MCPFeedback.Utils.showMessage) {
                                window.MCPFeedback.Utils.showMessage(errorMessage, window.MCPFeedback.Utils.CONSTANTS.MESSAGE_ERROR);
                            }
                            resolve(false);
                        }
                    });
                } else {
                    // 直接使用回退方法
                    const success = window.MCPFeedback.Utils.fallbackCopyToClipboard(text);
                    if (success) {
                        if (window.MCPFeedback && window.MCPFeedback.Utils && window.MCPFeedback.Utils.showMessage) {
                            window.MCPFeedback.Utils.showMessage(successMessage, window.MCPFeedback.Utils.CONSTANTS.MESSAGE_SUCCESS);
                        }
                        resolve(true);
                    } else {
                        if (window.MCPFeedback && window.MCPFeedback.Utils && window.MCPFeedback.Utils.showMessage) {
                            window.MCPFeedback.Utils.showMessage(errorMessage, window.MCPFeedback.Utils.CONSTANTS.MESSAGE_ERROR);
                        }
                        resolve(false);
                    }
                }
            });
        },

        /**
         * 回退的複製到剪貼板方法
         * @param {string} text - 要複製的文字
         * @returns {boolean} 複製是否成功
         */
        fallbackCopyToClipboard: function(text) {
            try {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();

                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);

                return successful;
            } catch (err) {
                console.error('回退複製方法失敗:', err);
                return false;
            }
        },

        /**
         * 安全的元素查詢
         * @param {string} selector - CSS 選擇器
         * @param {Element} context - 查詢上下文（可選）
         * @returns {Element|null} 找到的元素或 null
         */
        safeQuerySelector: function(selector, context) {
            try {
                const root = context || document;
                return root.querySelector(selector);
            } catch (error) {
                console.warn('元素查詢失敗:', selector, error);
                return null;
            }
        },

        /**
         * 顯示訊息提示
         * @param {string} message - 訊息內容
         * @param {string} type - 訊息類型 (success, error, warning, info)
         * @param {number} duration - 顯示時間（毫秒）
         */
        showMessage: function(messageOrCode, type, duration) {
            // 處理訊息代碼物件
            let actualMessage = messageOrCode;
            let actualType = type || 'info';
            
            if (typeof messageOrCode === 'object' && messageOrCode.code) {
                // 使用 i18n 系統翻譯訊息代碼
                if (window.i18nManager) {
                    actualMessage = window.i18nManager.t(messageOrCode.code, messageOrCode.params);
                } else {
                    // 改善 fallback 機制：提供基本的英文訊息
                    actualMessage = this.getFallbackMessage(messageOrCode.code, messageOrCode.params);
                }
                // 使用訊息物件中的嚴重程度
                actualType = messageOrCode.severity || type || 'info';
            }
            
            // 呼叫內部顯示方法
            return this._displayMessage(actualMessage, actualType, duration);
        },
        
        /**
         * 獲取 fallback 訊息
         * 當 i18n 系統尚未載入時使用
         * @param {string} code - 訊息代碼
         * @param {Object} params - 參數
         * @returns {string} fallback 訊息
         */
        getFallbackMessage: function(code, params) {
            // 基本的 fallback 訊息對照表
            const fallbackMessages = {
                // 系統相關
                'system.connectionEstablished': 'WebSocket connection established',
                'system.connectionLost': 'WebSocket connection lost',
                'system.connectionReconnecting': 'Reconnecting...',
                'system.connectionReconnected': 'Reconnected',
                'system.connectionFailed': 'Connection failed',
                'system.websocketError': 'WebSocket error',
                'system.websocketReady': 'WebSocket ready',
                'system.memoryPressure': 'Memory pressure cleanup',
                'system.shutdown': 'System shutdown',
                'system.processKilled': 'Process killed',
                'system.heartbeatStopped': 'Heartbeat stopped',
                
                // 會話相關
                'session.noActiveSession': 'No active session',
                'session.created': 'New session created',
                'session.updated': 'Session updated',
                'session.expired': 'Session expired',
                'session.timeout': 'Session timed out',
                'session.cleaned': 'Session cleaned',
                'session.feedbackSubmitted': 'Feedback submitted successfully',
                'session.userMessageRecorded': 'User message recorded',
                'session.historySaved': 'Session history saved',
                'session.historyLoaded': 'Session history loaded',
                
                // 設定相關
                'settings.saved': 'Settings saved',
                'settings.loaded': 'Settings loaded',
                'settings.cleared': 'Settings cleared',
                'settings.saveFailed': 'Save failed',
                'settings.loadFailed': 'Load failed',
                'settings.clearFailed': 'Clear failed',
                'settings.setFailed': 'Set failed',
                'settings.logLevelUpdated': 'Log level updated',
                'settings.invalidLogLevel': 'Invalid log level',
                
                // 錯誤相關
                'error.generic': 'An error occurred',
                'error.userMessageFailed': 'Failed to add user message',
                'error.getSessionsFailed': 'Failed to get sessions',
                'error.getLogLevelFailed': 'Failed to get log level',
                'error.command': 'Command execution error',
                'error.resourceCleanup': 'Resource cleanup error',
                'error.processing': 'Processing error',
                
                // 通知相關
                'notification.autoplayBlocked': 'Browser blocked autoplay, click page to enable sound',
                
                // 預設訊息
                'default': 'System message'
            };
            
            // 嘗試獲取對應的 fallback 訊息
            let message = fallbackMessages[code] || fallbackMessages['default'];
            
            // 處理參數替換（簡單版本）
            if (params && typeof params === 'object') {
                for (const key in params) {
                    if (params.hasOwnProperty(key)) {
                        const placeholder = '{{' + key + '}}';
                        message = message.replace(placeholder, params[key]);
                    }
                }
            }
            
            // 在開發模式下顯示警告
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.warn('[i18n] Fallback message used for:', code, '→', message);
            }
            
            return message;
        },
        
        /**
         * 內部方法：實際顯示訊息
         * @private
         */
        _displayMessage: function(message, type, duration) {
            type = type || 'info';
            duration = duration || 3000;

            // 創建訊息元素
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message message-' + type;
            messageDiv.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                z-index: 1001;
                padding: 12px 20px;
                background: var(--${type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'success'}-color, #4CAF50);
                color: white;
                border-radius: 6px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                max-width: 300px;
                word-wrap: break-word;
                transition: opacity 0.3s ease;
            `;
            messageDiv.textContent = message;

            document.body.appendChild(messageDiv);

            // 自動移除
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.style.opacity = '0';
                    setTimeout(() => {
                        if (messageDiv.parentNode) {
                            messageDiv.parentNode.removeChild(messageDiv);
                        }
                    }, 300);
                }
            }, duration);
        },

        /**
         * 檢查 WebSocket 是否可用
         * @returns {boolean} WebSocket 是否可用
         */
        isWebSocketSupported: function() {
            return 'WebSocket' in window;
        },



        /**
         * HTML 轉義函數
         * @param {string} text - 要轉義的文字
         * @returns {string} 轉義後的文字
         */
        escapeHtml: function(text) {
            if (typeof text !== 'string') {
                return text;
            }

            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        /**
         * 常數定義
         */
        CONSTANTS: {
            // WebSocket 狀態
            WS_CONNECTING: 0,
            WS_OPEN: 1,
            WS_CLOSING: 2,
            WS_CLOSED: 3,

            // 回饋狀態
            FEEDBACK_WAITING: 'waiting_for_feedback',
            FEEDBACK_SUBMITTED: 'feedback_submitted',
            FEEDBACK_PROCESSING: 'processing',

            // 預設設定（優化後的值）
            DEFAULT_HEARTBEAT_FREQUENCY: 60000,  // 從 30 秒調整為 60 秒，減少網路負載
            DEFAULT_TAB_HEARTBEAT_FREQUENCY: 10000,  // 從 5 秒調整為 10 秒，減少標籤頁檢查頻率
            DEFAULT_RECONNECT_DELAY: 1000,
            MAX_RECONNECT_ATTEMPTS: 5,
            TAB_EXPIRED_THRESHOLD: 60000,  // 從 30 秒調整為 60 秒，與心跳頻率保持一致

            // 訊息類型
            MESSAGE_SUCCESS: 'success',
            MESSAGE_ERROR: 'error',
            MESSAGE_WARNING: 'warning',
            MESSAGE_INFO: 'info'
        }
    });

    console.log('✅ Utils 模組載入完成');

})();
