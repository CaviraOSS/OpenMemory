/**
 * MCP Feedback Enhanced - 時間處理工具模組
 * ========================================
 * 
 * 提供時間格式化、計算和顯示功能
 */

(function() {
    'use strict';

    // 確保命名空間存在
    window.MCPFeedback = window.MCPFeedback || {};
    window.MCPFeedback.Utils = window.MCPFeedback.Utils || {};

    /**
     * 時間工具類
     */
    const TimeUtils = {
        /**
         * 格式化時間戳為可讀時間
         */
        formatTimestamp: function(timestamp, options) {
            options = options || {};
            
            if (!timestamp) return '未知';

            try {
                // 處理時間戳格式（毫秒轉秒）
                let normalizedTimestamp = timestamp;
                if (timestamp > 1e12) {
                    normalizedTimestamp = timestamp / 1000;
                }

                const date = new Date(normalizedTimestamp * 1000);
                if (isNaN(date.getTime())) {
                    return '無效時間';
                }

                if (options.format === 'time') {
                    // 只返回時間部分
                    return date.toLocaleTimeString();
                } else if (options.format === 'date') {
                    // 只返回日期部分
                    return date.toLocaleDateString();
                } else if (options.format === 'iso') {
                    // ISO 格式
                    return date.toISOString();
                } else {
                    // 完整格式
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    const seconds = String(date.getSeconds()).padStart(2, '0');

                    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
                }
            } catch (error) {
                console.warn('時間格式化失敗:', timestamp, error);
                return '格式錯誤';
            }
        },

        /**
         * 格式化持續時間（秒）- 支援國際化
         */
        formatDuration: function(seconds) {
            if (!seconds || seconds < 0) {
                const secondsText = this.getTimeUnitText('seconds');
                return `0${secondsText}`;
            }

            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const remainingSeconds = Math.floor(seconds % 60);

            const hoursText = this.getTimeUnitText('hours');
            const minutesText = this.getTimeUnitText('minutes');
            const secondsText = this.getTimeUnitText('seconds');

            if (hours > 0) {
                return `${hours}${hoursText}${minutes > 0 ? minutes + minutesText : ''}`;
            } else if (minutes > 0) {
                return `${minutes}${minutesText}${remainingSeconds > 0 ? remainingSeconds + secondsText : ''}`;
            } else {
                return `${remainingSeconds}${secondsText}`;
            }
        },

        /**
         * 獲取時間單位文字（支援國際化）
         */
        getTimeUnitText: function(unit) {
            if (window.i18nManager && typeof window.i18nManager.t === 'function') {
                return window.i18nManager.t(`timeUnits.${unit}`, unit);
            }

            // 回退到預設值（繁體中文）
            const fallbackUnits = {
                'seconds': '秒',
                'minutes': '分鐘',
                'hours': '小時',
                'days': '天',
                'ago': '前',
                'justNow': '剛剛',
                'about': '約'
            };

            return fallbackUnits[unit] || unit;
        },

        /**
         * 格式化相對時間（多久之前）- 支援國際化
         */
        formatRelativeTime: function(timestamp) {
            if (!timestamp) return '未知';

            try {
                let normalizedTimestamp = timestamp;
                if (timestamp > 1e12) {
                    normalizedTimestamp = timestamp / 1000;
                }

                const now = Date.now() / 1000;
                const diff = now - normalizedTimestamp;

                const minutesText = this.getTimeUnitText('minutes');
                const hoursText = this.getTimeUnitText('hours');
                const daysText = this.getTimeUnitText('days');
                const agoText = this.getTimeUnitText('ago');
                const justNowText = this.getTimeUnitText('justNow');

                if (diff < 60) {
                    return justNowText;
                } else if (diff < 3600) {
                    const minutes = Math.floor(diff / 60);
                    return `${minutes}${minutesText}${agoText}`;
                } else if (diff < 86400) {
                    const hours = Math.floor(diff / 3600);
                    return `${hours}${hoursText}${agoText}`;
                } else {
                    const days = Math.floor(diff / 86400);
                    return `${days}${daysText}${agoText}`;
                }
            } catch (error) {
                console.warn('相對時間計算失敗:', timestamp, error);
                return '計算錯誤';
            }
        },

        /**
         * 計算經過時間（從指定時間到現在）
         */
        calculateElapsedTime: function(startTimestamp) {
            if (!startTimestamp) return 0;

            try {
                let normalizedTimestamp = startTimestamp;
                if (startTimestamp > 1e12) {
                    normalizedTimestamp = startTimestamp / 1000;
                }

                const now = Date.now() / 1000;
                return Math.max(0, now - normalizedTimestamp);
            } catch (error) {
                console.warn('經過時間計算失敗:', startTimestamp, error);
                return 0;
            }
        },

        /**
         * 格式化經過時間為 MM:SS 格式
         */
        formatElapsedTime: function(startTimestamp) {
            const elapsed = this.calculateElapsedTime(startTimestamp);
            const minutes = Math.floor(elapsed / 60);
            const seconds = Math.floor(elapsed % 60);
            return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        },

        /**
         * 獲取當前時間戳（秒）
         */
        getCurrentTimestamp: function() {
            return Math.floor(Date.now() / 1000);
        },

        /**
         * 獲取當前時間戳（毫秒）
         */
        getCurrentTimestampMs: function() {
            return Date.now();
        },

        /**
         * 檢查時間戳是否有效
         */
        isValidTimestamp: function(timestamp) {
            if (!timestamp || typeof timestamp !== 'number') return false;
            
            // 檢查是否在合理範圍內（1970年到2100年）
            const minTimestamp = 0;
            const maxTimestamp = 4102444800; // 2100年1月1日
            
            let normalizedTimestamp = timestamp;
            if (timestamp > 1e12) {
                normalizedTimestamp = timestamp / 1000;
            }
            
            return normalizedTimestamp >= minTimestamp && normalizedTimestamp <= maxTimestamp;
        },

        /**
         * 標準化時間戳（統一轉換為秒）
         */
        normalizeTimestamp: function(timestamp) {
            if (!this.isValidTimestamp(timestamp)) return null;
            
            if (timestamp > 1e12) {
                return timestamp / 1000;
            }
            return timestamp;
        },

        /**
         * 創建倒計時器
         */
        createCountdown: function(endTimestamp, callback, options) {
            options = options || {};
            const interval = options.interval || 1000;
            
            const timer = setInterval(function() {
                const now = Date.now() / 1000;
                const remaining = endTimestamp - now;
                
                if (remaining <= 0) {
                    clearInterval(timer);
                    if (callback) callback(0, true);
                    return;
                }
                
                if (callback) callback(remaining, false);
            }, interval);
            
            return timer;
        },

        /**
         * 格式化倒計時顯示
         */
        formatCountdown: function(remainingSeconds) {
            if (remainingSeconds <= 0) return '00:00';
            
            const minutes = Math.floor(remainingSeconds / 60);
            const seconds = Math.floor(remainingSeconds % 60);
            return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        },

        /**
         * 獲取今天的開始時間戳
         */
        getTodayStartTimestamp: function() {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return Math.floor(today.getTime() / 1000);
        },

        /**
         * 創建自動提交倒計時器
         */
        createAutoSubmitCountdown: function(timeoutSeconds, onTick, onComplete, options) {
            options = options || {};
            const interval = options.interval || 1000;

            let remainingTime = timeoutSeconds;
            let timer = null;
            let isPaused = false;
            let isCompleted = false;

            const countdownManager = {
                start: function() {
                    if (timer || isCompleted) return;

                    timer = setInterval(function() {
                        if (isPaused || isCompleted) return;

                        remainingTime--;

                        if (onTick) {
                            onTick(remainingTime, false);
                        }

                        if (remainingTime <= 0) {
                            isCompleted = true;
                            clearInterval(timer);
                            timer = null;

                            if (onComplete) {
                                onComplete();
                            }
                        }
                    }, interval);

                    // 立即觸發第一次 tick
                    if (onTick) {
                        onTick(remainingTime, false);
                    }

                    return this;
                },

                pause: function() {
                    isPaused = true;
                    return this;
                },

                resume: function() {
                    isPaused = false;
                    return this;
                },

                stop: function() {
                    if (timer) {
                        clearInterval(timer);
                        timer = null;
                    }
                    isCompleted = true;
                    return this;
                },

                reset: function(newTimeoutSeconds) {
                    this.stop();
                    remainingTime = newTimeoutSeconds || timeoutSeconds;
                    isPaused = false;
                    isCompleted = false;
                    return this;
                },

                getRemainingTime: function() {
                    return remainingTime;
                },

                isPaused: function() {
                    return isPaused;
                },

                isCompleted: function() {
                    return isCompleted;
                },

                isRunning: function() {
                    return timer !== null && !isPaused && !isCompleted;
                }
            };

            return countdownManager;
        },

        /**
         * 格式化自動提交倒計時顯示
         */
        formatAutoSubmitCountdown: function(remainingSeconds) {
            if (remainingSeconds <= 0) return '00:00';

            const hours = Math.floor(remainingSeconds / 3600);
            const minutes = Math.floor((remainingSeconds % 3600) / 60);
            const seconds = Math.floor(remainingSeconds % 60);

            if (hours > 0) {
                return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            } else {
                return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }
        },

        /**
         * 檢查時間戳是否是今天
         */
        isToday: function(timestamp) {
            if (!this.isValidTimestamp(timestamp)) return false;
            
            const normalizedTimestamp = this.normalizeTimestamp(timestamp);
            const todayStart = this.getTodayStartTimestamp();
            const todayEnd = todayStart + 86400; // 24小時後
            
            return normalizedTimestamp >= todayStart && normalizedTimestamp < todayEnd;
        },

        /**
         * 估算會話持續時間（用於歷史會話）- 支援國際化
         */
        estimateSessionDuration: function(sessionData) {
            // 基礎時間 2 分鐘
            let estimatedMinutes = 2;

            // 根據摘要長度調整
            if (sessionData.summary) {
                const summaryLength = sessionData.summary.length;
                if (summaryLength > 100) {
                    estimatedMinutes += Math.floor(summaryLength / 50);
                }
            }

            // 根據會話 ID 的哈希值增加隨機性
            if (sessionData.session_id) {
                const hash = this.simpleHash(sessionData.session_id);
                const variation = (hash % 5) + 1; // 1-5 分鐘的變化
                estimatedMinutes += variation;
            }

            // 限制在合理範圍內
            estimatedMinutes = Math.max(1, Math.min(estimatedMinutes, 15));

            const aboutText = this.getTimeUnitText('about');
            const minutesText = this.getTimeUnitText('minutes');
            return `${aboutText} ${estimatedMinutes} ${minutesText}`;
        },

        /**
         * 簡單哈希函數
         */
        simpleHash: function(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // 轉換為 32 位整數
            }
            return Math.abs(hash);
        }
    };

    // 將 TimeUtils 加入命名空間
    window.MCPFeedback.TimeUtils = TimeUtils;
    window.MCPFeedback.Utils.Time = TimeUtils; // 保持向後相容

    console.log('✅ TimeUtils 模組載入完成');

})();
