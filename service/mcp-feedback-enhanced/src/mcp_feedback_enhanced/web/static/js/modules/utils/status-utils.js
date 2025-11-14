/**
 * MCP Feedback Enhanced - 狀態處理工具模組
 * ========================================
 * 
 * 提供狀態映射、顏色管理和狀態轉換功能
 */

(function() {
    'use strict';

    // 確保命名空間存在
    window.MCPFeedback = window.MCPFeedback || {};
    window.MCPFeedback.Utils = window.MCPFeedback.Utils || {};

    /**
     * 狀態工具類
     */
    const StatusUtils = {
        /**
         * 獲取會話狀態文字（使用 i18n）
         */
        getSessionStatusText: function(status) {
            if (!window.i18nManager) {
                // 回退到硬編碼文字
                const fallbackMap = {
                    'waiting': '等待回饋',
                    'waiting_for_feedback': '等待回饋',
                    'active': '進行中',
                    'feedback_submitted': '已提交回饋',
                    'completed': '已完成',
                    'timeout': '已逾時',
                    'error': '錯誤',
                    'expired': '已過期',
                    'connecting': '連接中',
                    'connected': '已連接',
                    'disconnected': '已斷開',
                    'processing': '處理中',
                    'ready': '就緒',
                    'closed': '已關閉'
                };
                return fallbackMap[status] || status;
            }

            // 使用 i18n 翻譯
            const i18nKeyMap = {
                'waiting': 'connectionMonitor.waiting',
                'waiting_for_feedback': 'connectionMonitor.waiting',
                'active': 'status.processing.title',
                'feedback_submitted': 'status.submitted.title',
                'completed': 'status.completed.title',
                'timeout': 'session.timeout',
                'error': 'status.error',
                'expired': 'session.timeout',
                'connecting': 'connectionMonitor.connecting',
                'connected': 'connectionMonitor.connected',
                'disconnected': 'connectionMonitor.disconnected',
                'processing': 'status.processing.title',
                'ready': 'connectionMonitor.connected',
                'closed': 'connectionMonitor.disconnected'
            };

            const i18nKey = i18nKeyMap[status];
            return i18nKey ? window.i18nManager.t(i18nKey) : status;
        },

        /**
         * 獲取連線狀態文字（使用 i18n）
         */
        getConnectionStatusText: function(status) {
            if (!window.i18nManager) {
                // 回退到硬編碼文字
                const fallbackMap = {
                    'connecting': '連接中',
                    'connected': '已連接',
                    'disconnected': '已斷開',
                    'reconnecting': '重連中',
                    'error': '連接錯誤'
                };
                return fallbackMap[status] || status;
            }

            // 使用 i18n 翻譯
            const i18nKeyMap = {
                'connecting': 'connectionMonitor.connecting',
                'connected': 'connectionMonitor.connected',
                'disconnected': 'connectionMonitor.disconnected',
                'reconnecting': 'connectionMonitor.reconnecting',
                'error': 'status.error'
            };

            const i18nKey = i18nKeyMap[status];
            return i18nKey ? window.i18nManager.t(i18nKey) : status;
        },

        /**
         * 狀態顏色映射
         */
        STATUS_COLOR_MAP: {
            'waiting': '#9c27b0',
            'waiting_for_feedback': '#9c27b0',
            'active': '#2196f3',
            'feedback_submitted': '#4caf50',
            'completed': '#4caf50',
            'timeout': '#ff5722',
            'error': '#f44336',
            'expired': '#757575',
            'connecting': '#ff9800',
            'connected': '#4caf50',
            'disconnected': '#757575',
            'reconnecting': '#9c27b0',
            'processing': '#2196f3',
            'ready': '#4caf50',
            'closed': '#757575'
        },

        /**
         * 獲取連線品質標籤（使用 i18n）
         */
        getConnectionQualityLabel: function(level) {
            if (!window.i18nManager) {
                // 回退到硬編碼文字
                const fallbackLabels = {
                    'excellent': '優秀',
                    'good': '良好',
                    'fair': '一般',
                    'poor': '較差',
                    'unknown': '未知'
                };
                return fallbackLabels[level] || level;
            }

            const i18nKey = `connectionMonitor.quality.${level}`;
            return window.i18nManager.t(i18nKey);
        },

        /**
         * 連線品質等級
         */
        CONNECTION_QUALITY_LEVELS: {
            'excellent': { threshold: 50, color: '#4caf50' },
            'good': { threshold: 100, color: '#8bc34a' },
            'fair': { threshold: 200, color: '#ff9800' },
            'poor': { threshold: Infinity, color: '#f44336' }
        },

        /**
         * 獲取狀態文字（統一入口，優先使用新方法）
         */
        getStatusText: function(status) {
            if (!status) {
                return window.i18nManager ? window.i18nManager.t('sessionManagement.sessionDetails.unknown') : '未知';
            }

            // 優先嘗試會話狀態
            const sessionText = this.getSessionStatusText(status);
            if (sessionText !== status) {
                return sessionText;
            }

            // 然後嘗試連線狀態
            const connectionText = this.getConnectionStatusText(status);
            if (connectionText !== status) {
                return connectionText;
            }

            return status;
        },

        /**
         * 獲取狀態顏色
         */
        getStatusColor: function(status) {
            if (!status) return '#757575';
            return this.STATUS_COLOR_MAP[status] || '#757575';
        },

        /**
         * 根據延遲計算連線品質
         */
        calculateConnectionQuality: function(latency) {
            if (typeof latency !== 'number' || latency < 0) {
                return {
                    level: 'unknown',
                    label: this.getConnectionQualityLabel('unknown'),
                    color: '#757575'
                };
            }

            for (const [level, config] of Object.entries(this.CONNECTION_QUALITY_LEVELS)) {
                if (latency < config.threshold) {
                    return {
                        level: level,
                        label: this.getConnectionQualityLabel(level),
                        color: config.color
                    };
                }
            }

            return {
                level: 'poor',
                label: this.getConnectionQualityLabel('poor'),
                color: '#f44336'
            };
        },

        /**
         * 獲取信號強度等級（基於連線品質）
         */
        getSignalStrength: function(quality) {
            const strengthMap = {
                'excellent': 3,
                'good': 2,
                'fair': 1,
                'poor': 0,
                'unknown': 0
            };

            return strengthMap[quality] || 0;
        },

        /**
         * 檢查狀態是否為已完成狀態
         */
        isCompletedStatus: function(status) {
            const completedStatuses = [
                'completed', 
                'feedback_submitted', 
                'timeout', 
                'error', 
                'expired', 
                'closed'
            ];
            return completedStatuses.includes(status);
        },

        /**
         * 檢查狀態是否為活躍狀態
         */
        isActiveStatus: function(status) {
            const activeStatuses = [
                'waiting',
                'waiting_for_feedback',
                'active',
                'processing',
                'connected',
                'ready'
            ];
            return activeStatuses.includes(status);
        },

        /**
         * 檢查狀態是否為錯誤狀態
         */
        isErrorStatus: function(status) {
            const errorStatuses = ['error', 'timeout', 'disconnected'];
            return errorStatuses.includes(status);
        },

        /**
         * 檢查狀態是否為連接中狀態
         */
        isConnectingStatus: function(status) {
            const connectingStatuses = ['connecting', 'reconnecting'];
            return connectingStatuses.includes(status);
        },

        /**
         * 獲取狀態優先級（用於排序）
         */
        getStatusPriority: function(status) {
            const priorityMap = {
                'error': 1,
                'timeout': 2,
                'disconnected': 3,
                'connecting': 4,
                'reconnecting': 5,
                'waiting': 6,
                'waiting_for_feedback': 6,
                'processing': 7,
                'active': 8,
                'ready': 9,
                'connected': 10,
                'feedback_submitted': 11,
                'completed': 12,
                'closed': 13,
                'expired': 14
            };

            return priorityMap[status] || 0;
        },

        /**
         * 創建狀態徽章 HTML
         */
        createStatusBadge: function(status, options) {
            options = options || {};
            const text = this.getStatusText(status);
            const color = this.getStatusColor(status);
            const className = options.className || 'status-badge';
            
            return `<span class="${className} ${status}" style="color: ${color};">${text}</span>`;
        },

        /**
         * 更新狀態指示器
         */
        updateStatusIndicator: function(element, status, options) {
            if (!element) return false;

            options = options || {};
            const text = this.getStatusText(status);
            const color = this.getStatusColor(status);

            // 更新文字
            if (options.updateText !== false) {
                element.textContent = text;
            }

            // 更新顏色
            if (options.updateColor !== false) {
                element.style.color = color;
            }

            // 更新 CSS 類
            if (options.updateClass !== false) {
                // 移除舊的狀態類
                element.className = element.className.replace(/\b(waiting|active|completed|error|connecting|connected|disconnected|reconnecting|processing|ready|closed|expired|timeout|feedback_submitted)\b/g, '');
                // 添加新的狀態類
                element.classList.add(status);
            }

            return true;
        },

        /**
         * 格式化狀態變更日誌
         */
        formatStatusChangeLog: function(oldStatus, newStatus, timestamp) {
            const oldText = this.getStatusText(oldStatus);
            const newText = this.getStatusText(newStatus);
            const timeStr = timestamp ? new Date(timestamp).toLocaleTimeString() : '現在';
            
            return `${timeStr}: ${oldText} → ${newText}`;
        },

        /**
         * 檢查狀態轉換是否有效
         */
        isValidStatusTransition: function(fromStatus, toStatus) {
            // 定義有效的狀態轉換規則
            const validTransitions = {
                'waiting': ['active', 'processing', 'timeout', 'error', 'connected'],
                'waiting_for_feedback': ['active', 'processing', 'timeout', 'error', 'feedback_submitted'],
                'active': ['processing', 'feedback_submitted', 'completed', 'timeout', 'error'],
                'processing': ['completed', 'feedback_submitted', 'error', 'timeout'],
                'connecting': ['connected', 'error', 'disconnected', 'timeout'],
                'connected': ['disconnected', 'error', 'reconnecting'],
                'disconnected': ['connecting', 'reconnecting'],
                'reconnecting': ['connected', 'error', 'disconnected'],
                'feedback_submitted': ['completed', 'closed'],
                'completed': ['closed'],
                'error': ['connecting', 'waiting', 'closed'],
                'timeout': ['closed', 'waiting'],
                'ready': ['active', 'waiting', 'processing']
            };

            const allowedTransitions = validTransitions[fromStatus];
            return allowedTransitions ? allowedTransitions.includes(toStatus) : true;
        },

        /**
         * 獲取狀態描述
         */
        getStatusDescription: function(status) {
            const descriptions = {
                'waiting': '系統正在等待用戶提供回饋',
                'waiting_for_feedback': '系統正在等待用戶提供回饋',
                'active': '會話正在進行中',
                'processing': '系統正在處理用戶的回饋',
                'feedback_submitted': '用戶已提交回饋',
                'completed': '會話已成功完成',
                'timeout': '會話因超時而結束',
                'error': '會話遇到錯誤',
                'expired': '會話已過期',
                'connecting': '正在建立連接',
                'connected': '連接已建立',
                'disconnected': '連接已斷開',
                'reconnecting': '正在嘗試重新連接',
                'ready': '系統已就緒',
                'closed': '會話已關閉'
            };

            return descriptions[status] || '未知狀態';
        }
    };

    // 將 StatusUtils 加入命名空間
    window.MCPFeedback.StatusUtils = StatusUtils;
    window.MCPFeedback.Utils.Status = StatusUtils; // 保持向後相容

    console.log('✅ StatusUtils 模組載入完成');

})();
