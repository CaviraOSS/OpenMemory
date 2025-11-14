/**
 * MCP Feedback Enhanced - 會話 UI 渲染模組
 * =======================================
 * 
 * 負責會話相關的 UI 渲染和更新
 */

(function() {
    'use strict';

    // 確保命名空間存在
    window.MCPFeedback = window.MCPFeedback || {};
    window.MCPFeedback.Session = window.MCPFeedback.Session || {};

    const DOMUtils = window.MCPFeedback.Utils.DOM;
    const TimeUtils = window.MCPFeedback.Utils.Time;

    // 創建模組專用日誌器
    const logger = window.MCPFeedback.Logger ?
        new window.MCPFeedback.Logger({ moduleName: 'SessionUIRenderer' }) :
        console;
    const StatusUtils = window.MCPFeedback.Utils.Status;
    
    // 調試模式標誌 - 生產環境應設為 false
    const DEBUG_MODE = false;

    /**
     * 會話 UI 渲染器
     */
    function SessionUIRenderer(options) {
        options = options || {};

        // UI 元素引用
        this.currentSessionCard = null;
        this.historyList = null;
        this.statsElements = {};

        // 渲染選項
        this.showFullSessionId = options.showFullSessionId || false;
        this.enableAnimations = options.enableAnimations !== false;

        // 活躍時間定時器
        this.activeTimeTimer = null;
        this.currentSessionData = null;

        // 渲染防抖機制
        this.renderDebounceTimers = {
            stats: null,
            history: null,
            currentSession: null
        };
        this.renderDebounceDelay = options.renderDebounceDelay || 100; // 預設 100ms 防抖延遲

        // 快取上次渲染的數據，避免不必要的重渲染
        this.lastRenderedData = {
            stats: null,
            historyLength: 0,
            currentSessionId: null
        };

        this.initializeElements();
        this.initializeProjectPathDisplay();
        this.startActiveTimeTimer();

        logger.info('SessionUIRenderer 初始化完成，渲染防抖延遲:', this.renderDebounceDelay + 'ms');
    }

    /**
     * 初始化 UI 元素
     */
    SessionUIRenderer.prototype.initializeElements = function() {
        this.currentSessionCard = DOMUtils.safeQuerySelector('#currentSessionCard');
        this.historyList = DOMUtils.safeQuerySelector('#sessionHistoryList');

        // 統計元素
        this.statsElements = {
            todayCount: DOMUtils.safeQuerySelector('.stat-today-count'),
            averageDuration: DOMUtils.safeQuerySelector('.stat-average-duration')
        };
    };

    /**
     * 初始化專案路徑顯示
     */
    SessionUIRenderer.prototype.initializeProjectPathDisplay = function() {
        if (DEBUG_MODE) console.log('🎨 初始化專案路徑顯示');

        const projectPathElement = document.getElementById('projectPathDisplay');
        if (DEBUG_MODE) console.log('🎨 初始化時找到專案路徑元素:', !!projectPathElement);

        if (projectPathElement) {
            const fullPath = projectPathElement.getAttribute('data-full-path');
            if (DEBUG_MODE) console.log('🎨 初始化時的完整路徑:', fullPath);

            if (fullPath) {
                // 使用工具函數截斷路徑
                const pathResult = window.MCPFeedback.Utils.truncatePathFromRight(fullPath, 2, 40);
                if (DEBUG_MODE) console.log('🎨 初始化時路徑處理:', { fullPath, shortPath: pathResult.truncated });

                // 更新顯示文字
                DOMUtils.safeSetTextContent(projectPathElement, pathResult.truncated);

                // 添加點擊複製功能
                if (!projectPathElement.hasAttribute('data-copy-handler')) {
                    if (DEBUG_MODE) console.log('🎨 初始化時添加點擊複製功能');
                    projectPathElement.setAttribute('data-copy-handler', 'true');
                    projectPathElement.addEventListener('click', function() {
                        if (DEBUG_MODE) console.log('🎨 初始化的專案路徑被點擊');
                        const fullPath = this.getAttribute('data-full-path');
                        if (DEBUG_MODE) console.log('🎨 初始化時準備複製路徑:', fullPath);

                        if (fullPath) {
                            const successMessage = window.i18nManager ?
                                window.i18nManager.t('app.pathCopied', '專案路徑已複製到剪貼板') :
                                '專案路徑已複製到剪貼板';
                            const errorMessage = window.i18nManager ?
                                window.i18nManager.t('app.pathCopyFailed', '複製路徑失敗') :
                                '複製路徑失敗';

                            if (DEBUG_MODE) console.log('🎨 初始化時調用複製函數');
                            window.MCPFeedback.Utils.copyToClipboard(fullPath, successMessage, errorMessage);
                        }
                    });
                } else {
                    if (DEBUG_MODE) console.log('🎨 初始化時點擊複製功能已存在');
                }

                // 添加 tooltip 位置自動調整
                this.adjustTooltipPosition(projectPathElement);
            }
        }
    };

    /**
     * 渲染當前會話（帶防抖機制）
     */
    SessionUIRenderer.prototype.renderCurrentSession = function(sessionData) {
        if (!this.currentSessionCard || !sessionData) return;

        const self = this;

        // 檢查是否是新會話（會話 ID 變更）
        const isNewSession = !this.currentSessionData ||
                            this.currentSessionData.session_id !== sessionData.session_id;

        // 檢查數據是否有變化
        if (!isNewSession && self.lastRenderedData.currentSessionId === sessionData.session_id &&
            self.currentSessionData &&
            self.currentSessionData.status === sessionData.status &&
            self.currentSessionData.summary === sessionData.summary) {
            // 數據沒有重要變化，跳過渲染
            return;
        }

        // 清除之前的防抖定時器
        if (self.renderDebounceTimers.currentSession) {
            clearTimeout(self.renderDebounceTimers.currentSession);
        }

        // 對於新會話，立即渲染；對於更新，使用防抖
        if (isNewSession) {
            self._performCurrentSessionRender(sessionData, isNewSession);
        } else {
            self.renderDebounceTimers.currentSession = setTimeout(function() {
                self._performCurrentSessionRender(sessionData, false);
            }, self.renderDebounceDelay);
        }
    };

    /**
     * 執行實際的當前會話渲染
     */
    SessionUIRenderer.prototype._performCurrentSessionRender = function(sessionData, isNewSession) {
        if (DEBUG_MODE) console.log('🎨 渲染當前會話:', sessionData);

        // 更新快取
        this.lastRenderedData.currentSessionId = sessionData.session_id;
        this.currentSessionData = sessionData;

        // 如果是新會話，重置活躍時間定時器
        if (isNewSession) {
            if (DEBUG_MODE) console.log('🎨 檢測到新會話，重置活躍時間定時器');
            this.resetActiveTimeTimer();
        }

        // 更新會話 ID
        this.updateSessionId(sessionData);

        // 更新狀態徽章
        this.updateStatusBadge(sessionData);

        // 更新時間資訊
        this.updateTimeInfo(sessionData);

        // 更新專案資訊
        this.updateProjectInfo(sessionData);

        // 更新摘要
        this.updateSummary(sessionData);

        // 更新會話狀態列
        this.updateSessionStatusBar(sessionData);
    };

    /**
     * 更新會話 ID 顯示
     */
    SessionUIRenderer.prototype.updateSessionId = function(sessionData) {
        const sessionIdElement = this.currentSessionCard.querySelector('.session-id');
        if (sessionIdElement && sessionData.session_id) {
            const displayId = this.showFullSessionId ?
                sessionData.session_id :
                sessionData.session_id.substring(0, 8) + '...';
            const sessionIdLabel = window.i18nManager ? window.i18nManager.t('sessionManagement.sessionId') : '會話 ID';
            DOMUtils.safeSetTextContent(sessionIdElement, sessionIdLabel + ': ' + displayId);
        }
    };

    /**
     * 更新狀態徽章
     */
    SessionUIRenderer.prototype.updateStatusBadge = function(sessionData) {
        const statusBadge = this.currentSessionCard.querySelector('.status-badge');
        if (statusBadge && sessionData.status) {
            StatusUtils.updateStatusIndicator(statusBadge, sessionData.status, {
                updateText: true,
                updateColor: false, // 使用 CSS 類控制顏色
                updateClass: true
            });
        }
    };

    /**
     * 更新時間資訊
     */
    SessionUIRenderer.prototype.updateTimeInfo = function(sessionData) {
        const timeElement = this.currentSessionCard.querySelector('.session-time');
        if (timeElement && sessionData.created_at) {
            const timeText = TimeUtils.formatTimestamp(sessionData.created_at, { format: 'time' });
            const createdTimeLabel = window.i18nManager ? window.i18nManager.t('sessionManagement.createdTime') : '建立時間';
            DOMUtils.safeSetTextContent(timeElement, createdTimeLabel + ': ' + timeText);
        }
    };

    /**
     * 更新專案資訊
     */
    SessionUIRenderer.prototype.updateProjectInfo = function(sessionData) {
        const projectElement = this.currentSessionCard.querySelector('.session-project');
        if (projectElement) {
            const projectDir = sessionData.project_directory || './';
            const projectLabel = window.i18nManager ? window.i18nManager.t('sessionManagement.project') : '專案';
            DOMUtils.safeSetTextContent(projectElement, projectLabel + ': ' + projectDir);
        }

        // 更新頂部狀態列的專案路徑顯示
        this.updateTopProjectPathDisplay(sessionData);
    };

    /**
     * 更新頂部狀態列的專案路徑顯示
     */
    SessionUIRenderer.prototype.updateTopProjectPathDisplay = function(sessionData) {
        if (DEBUG_MODE) console.log('🎨 updateProjectPathDisplay 被調用:', sessionData);

        const projectPathElement = document.getElementById('projectPathDisplay');
        if (DEBUG_MODE) console.log('🎨 找到專案路徑元素:', !!projectPathElement);

        if (projectPathElement && sessionData.project_directory) {
            const fullPath = sessionData.project_directory;

            // 使用工具函數截斷路徑
            const pathResult = window.MCPFeedback.Utils.truncatePathFromRight(fullPath, 2, 40);
            if (DEBUG_MODE) console.log('🎨 路徑處理:', { fullPath, shortPath: pathResult.truncated });

            // 更新顯示文字
            DOMUtils.safeSetTextContent(projectPathElement, pathResult.truncated);

            // 更新完整路徑屬性
            projectPathElement.setAttribute('data-full-path', fullPath);

            // 添加點擊複製功能（如果還沒有）
            if (!projectPathElement.hasAttribute('data-copy-handler')) {
                if (DEBUG_MODE) console.log('🎨 添加點擊複製功能');
                projectPathElement.setAttribute('data-copy-handler', 'true');
                projectPathElement.addEventListener('click', function() {
                    if (DEBUG_MODE) console.log('🎨 專案路徑被點擊');
                    const fullPath = this.getAttribute('data-full-path');
                    if (DEBUG_MODE) console.log('🎨 準備複製路徑:', fullPath);

                    if (fullPath) {
                        const successMessage = window.i18nManager ?
                            window.i18nManager.t('app.pathCopied', '專案路徑已複製到剪貼板') :
                            '專案路徑已複製到剪貼板';
                        const errorMessage = window.i18nManager ?
                            window.i18nManager.t('app.pathCopyFailed', '複製路徑失敗') :
                            '複製路徑失敗';

                        if (DEBUG_MODE) console.log('🎨 調用複製函數');
                        window.MCPFeedback.Utils.copyToClipboard(fullPath, successMessage, errorMessage);
                    }
                });
            } else {
                if (DEBUG_MODE) console.log('🎨 點擊複製功能已存在');
            }

            // 添加 tooltip 位置自動調整
            this.adjustTooltipPosition(projectPathElement);
        }
    };

    /**
     * 調整 tooltip 位置以避免超出視窗邊界
     */
    SessionUIRenderer.prototype.adjustTooltipPosition = function(element) {
        if (!element) return;

        // 移除之前的位置類別
        element.classList.remove('tooltip-up', 'tooltip-left', 'tooltip-right');

        // 獲取元素位置
        const rect = element.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // 檢查是否需要調整垂直位置
        if (rect.bottom + 100 > viewportHeight) {
            element.classList.add('tooltip-up');
        }

        // 檢查是否需要調整水平位置
        if (rect.left + 200 > viewportWidth) {
            element.classList.add('tooltip-right');
        } else if (rect.left < 200) {
            element.classList.add('tooltip-left');
        }
    };

    /**
     * 更新摘要
     */
    SessionUIRenderer.prototype.updateSummary = function(sessionData) {
        const summaryElement = this.currentSessionCard.querySelector('.session-summary');
        if (summaryElement) {
            const noSummaryText = window.i18nManager ? window.i18nManager.t('sessionManagement.noSummary') : '無摘要';
            const summary = sessionData.summary || noSummaryText;
            const summaryLabel = window.i18nManager ? window.i18nManager.t('sessionManagement.aiSummary') : 'AI 摘要';
            DOMUtils.safeSetTextContent(summaryElement, summaryLabel + ': ' + summary);
        }
    };

    /**
     * 更新會話狀態列
     */
    SessionUIRenderer.prototype.updateSessionStatusBar = function(sessionData) {
        if (!sessionData) return;

        if (DEBUG_MODE) console.log('🎨 更新會話狀態列:', sessionData);

        // 更新當前會話 ID - 顯示縮短版本，完整ID存在data-full-id中
        const currentSessionElement = document.getElementById('currentSessionId');
        if (currentSessionElement && sessionData.session_id) {
            const shortId = sessionData.session_id.substring(0, 8) + '...';
            DOMUtils.safeSetTextContent(currentSessionElement, shortId);
            currentSessionElement.setAttribute('data-full-id', sessionData.session_id);

            // 添加點擊複製功能（如果還沒有）
            if (!currentSessionElement.hasAttribute('data-copy-handler')) {
                currentSessionElement.setAttribute('data-copy-handler', 'true');
                currentSessionElement.addEventListener('click', function() {
                    const fullId = this.getAttribute('data-full-id');
                    if (fullId) {
                        const successMessage = window.i18nManager ?
                            window.i18nManager.t('app.sessionIdCopied', '會話ID已複製到剪貼板') :
                            '會話ID已複製到剪貼板';
                        const errorMessage = window.i18nManager ?
                            window.i18nManager.t('app.sessionIdCopyFailed', '複製會話ID失敗') :
                            '複製會話ID失敗';

                        window.MCPFeedback.Utils.copyToClipboard(fullId, successMessage, errorMessage);
                    }
                });
            }
        }

        // 立即更新活躍時間（定時器會持續更新）
        this.updateActiveTime();
    };

    /**
     * 渲染會話歷史列表（帶防抖機制）
     */
    SessionUIRenderer.prototype.renderSessionHistory = function(sessionHistory) {
        if (!this.historyList || !sessionHistory) return;

        const self = this;

        // 檢查數據是否有變化（簡單比較長度）
        if (self.lastRenderedData.historyLength === sessionHistory.length) {
            // 長度沒有變化，跳過渲染（可以進一步優化為深度比較）
            return;
        }

        // 清除之前的防抖定時器
        if (self.renderDebounceTimers.history) {
            clearTimeout(self.renderDebounceTimers.history);
        }

        // 設置新的防抖定時器
        self.renderDebounceTimers.history = setTimeout(function() {
            self._performHistoryRender(sessionHistory);
        }, self.renderDebounceDelay);
    };

    /**
     * 執行實際的會話歷史渲染
     */
    SessionUIRenderer.prototype._performHistoryRender = function(sessionHistory) {
        if (DEBUG_MODE) console.log('🎨 渲染會話歷史:', sessionHistory.length, '個會話');

        // 更新快取
        this.lastRenderedData.historyLength = sessionHistory.length;

        // 清空現有內容
        DOMUtils.clearElement(this.historyList);

        if (sessionHistory.length === 0) {
            this.renderEmptyHistory();
            return;
        }

        // 渲染歷史會話
        const fragment = document.createDocumentFragment();
        sessionHistory.forEach((session) => {
            const card = this.createSessionCard(session, true);
            fragment.appendChild(card);
        });

        this.historyList.appendChild(fragment);
    };

    /**
     * 渲染空歷史狀態
     */
    SessionUIRenderer.prototype.renderEmptyHistory = function() {
        const noHistoryText = window.i18nManager ? window.i18nManager.t('sessionManagement.noHistory') : '暫無歷史會話';
        const emptyElement = DOMUtils.createElement('div', {
            className: 'no-sessions',
            textContent: noHistoryText
        });
        this.historyList.appendChild(emptyElement);
    };

    /**
     * 創建會話卡片
     */
    SessionUIRenderer.prototype.createSessionCard = function(sessionData, isHistory) {
        const card = DOMUtils.createElement('div', {
            className: 'session-card' + (isHistory ? ' history' : ''),
            attributes: {
                'data-session-id': sessionData.session_id
            }
        });

        // 創建卡片內容
        const header = this.createSessionHeader(sessionData);
        const info = this.createSessionInfo(sessionData, isHistory);
        const actions = this.createSessionActions(sessionData, isHistory);

        card.appendChild(header);
        card.appendChild(info);
        card.appendChild(actions);

        return card;
    };

    /**
     * 創建會話卡片標題
     */
    SessionUIRenderer.prototype.createSessionHeader = function(sessionData) {
        const header = DOMUtils.createElement('div', { className: 'session-header' });

        // 會話 ID 容器
        const sessionIdContainer = DOMUtils.createElement('div', {
            className: 'session-id'
        });

        // 會話 ID 標籤
        const sessionIdLabel = DOMUtils.createElement('span', {
            attributes: {
                'data-i18n': 'sessionManagement.sessionId'
            },
            textContent: window.i18nManager ? window.i18nManager.t('sessionManagement.sessionId') : '會話 ID'
        });

        // 會話 ID 值
        const sessionIdValue = DOMUtils.createElement('span', {
            textContent: ': ' + (sessionData.session_id || '').substring(0, 8) + '...'
        });

        sessionIdContainer.appendChild(sessionIdLabel);
        sessionIdContainer.appendChild(sessionIdValue);

        // 狀態徽章
        const statusContainer = DOMUtils.createElement('div', { className: 'session-status' });
        const statusText = StatusUtils.getStatusText(sessionData.status);

        // 添加調試信息
        if (DEBUG_MODE) {
            console.log('🎨 會話狀態調試:', {
                sessionId: sessionData.session_id ? sessionData.session_id.substring(0, 8) + '...' : 'unknown',
                rawStatus: sessionData.status,
                displayText: statusText
            });
        }

        const statusBadge = DOMUtils.createElement('span', {
            className: 'status-badge ' + (sessionData.status || 'waiting'),
            textContent: statusText
        });

        statusContainer.appendChild(statusBadge);
        header.appendChild(sessionIdContainer);
        header.appendChild(statusContainer);

        return header;
    };

    /**
     * 創建會話資訊區域
     */
    SessionUIRenderer.prototype.createSessionInfo = function(sessionData, isHistory) {
        const info = DOMUtils.createElement('div', { className: 'session-info' });

        // 時間資訊容器
        const timeContainer = DOMUtils.createElement('div', {
            className: 'session-time'
        });

        // 時間標籤
        const timeLabelKey = isHistory ? 'sessionManagement.createdTime' : 'sessionManagement.createdTime';
        const timeLabel = DOMUtils.createElement('span', {
            attributes: {
                'data-i18n': timeLabelKey
            },
            textContent: window.i18nManager ? window.i18nManager.t(timeLabelKey) : '建立時間'
        });

        // 時間值
        const timeText = sessionData.created_at ?
            TimeUtils.formatTimestamp(sessionData.created_at, { format: 'time' }) :
            '--:--:--';
        const timeValue = DOMUtils.createElement('span', {
            textContent: ': ' + timeText
        });

        timeContainer.appendChild(timeLabel);
        timeContainer.appendChild(timeValue);
        info.appendChild(timeContainer);

        // 歷史會話顯示持續時間
        if (isHistory) {
            const duration = this.calculateDisplayDuration(sessionData);
            
            // 持續時間容器
            const durationContainer = DOMUtils.createElement('div', {
                className: 'session-duration'
            });

            // 持續時間標籤
            const durationLabel = DOMUtils.createElement('span', {
                attributes: {
                    'data-i18n': 'sessionManagement.sessionDetails.duration'
                },
                textContent: window.i18nManager ? window.i18nManager.t('sessionManagement.sessionDetails.duration') : '持續時間'
            });

            // 持續時間值
            const durationValue = DOMUtils.createElement('span', {
                textContent: ': ' + duration
            });

            durationContainer.appendChild(durationLabel);
            durationContainer.appendChild(durationValue);
            info.appendChild(durationContainer);
        }

        return info;
    };

    /**
     * 計算顯示用的持續時間
     */
    SessionUIRenderer.prototype.calculateDisplayDuration = function(sessionData) {
        if (sessionData.duration && sessionData.duration > 0) {
            return TimeUtils.formatDuration(sessionData.duration);
        } else if (sessionData.created_at && sessionData.completed_at) {
            const duration = sessionData.completed_at - sessionData.created_at;
            return TimeUtils.formatDuration(duration);
        } else if (sessionData.created_at) {
            return TimeUtils.estimateSessionDuration(sessionData);
        }
        return window.i18nManager ? window.i18nManager.t('sessionManagement.sessionDetails.unknown') : '未知';
    };

    /**
     * 創建會話操作區域
     */
    SessionUIRenderer.prototype.createSessionActions = function(sessionData, isHistory) {
        const actions = DOMUtils.createElement('div', { className: 'session-actions' });

        // 查看詳情按鈕
        const viewButton = DOMUtils.createElement('button', {
            className: 'btn-small',
            attributes: {
                'data-i18n': 'sessionManagement.viewDetails'
            },
            textContent: window.i18nManager ? window.i18nManager.t('sessionManagement.viewDetails') : '詳細資訊'
        });

        // 添加查看詳情點擊事件
        DOMUtils.addEventListener(viewButton, 'click', function() {
            if (window.MCPFeedback && window.MCPFeedback.SessionManager) {
                window.MCPFeedback.SessionManager.viewSessionDetails(sessionData.session_id);
            }
        });

        actions.appendChild(viewButton);

        // 如果是歷史會話，新增匯出按鈕
        if (isHistory) {
            const exportButton = DOMUtils.createElement('button', {
                className: 'btn-small btn-export',
                attributes: {
                    'data-i18n': 'sessionHistory.management.exportSingle'
                },
                textContent: window.i18nManager ? window.i18nManager.t('sessionHistory.management.exportSingle') : '匯出此會話',
                style: 'margin-left: 4px; font-size: 11px; padding: 2px 6px;'
            });

            // 添加匯出點擊事件
            DOMUtils.addEventListener(exportButton, 'click', function(e) {
                e.stopPropagation(); // 防止觸發父元素事件
                if (window.MCPFeedback && window.MCPFeedback.SessionManager) {
                    window.MCPFeedback.SessionManager.exportSingleSession(sessionData.session_id);
                }
            });

            actions.appendChild(exportButton);
        }

        return actions;
    };

    /**
     * 渲染統計資訊（帶防抖機制）
     */
    SessionUIRenderer.prototype.renderStats = function(stats) {
        if (!stats) return;

        const self = this;

        // 檢查數據是否有變化
        if (self.lastRenderedData.stats &&
            self.lastRenderedData.stats.todayCount === stats.todayCount &&
            self.lastRenderedData.stats.averageDuration === stats.averageDuration) {
            // 數據沒有變化，跳過渲染
            return;
        }

        // 清除之前的防抖定時器
        if (self.renderDebounceTimers.stats) {
            clearTimeout(self.renderDebounceTimers.stats);
        }

        // 設置新的防抖定時器
        self.renderDebounceTimers.stats = setTimeout(function() {
            self._performStatsRender(stats);
        }, self.renderDebounceDelay);
    };

    /**
     * 執行實際的統計資訊渲染
     */
    SessionUIRenderer.prototype._performStatsRender = function(stats) {
        logger.debug('渲染統計資訊:', stats);

        // 更新快取
        this.lastRenderedData.stats = {
            todayCount: stats.todayCount,
            averageDuration: stats.averageDuration
        };

        // 更新今日會話數
        if (this.statsElements.todayCount) {
            DOMUtils.safeSetTextContent(this.statsElements.todayCount, stats.todayCount.toString());
            logger.debug('已更新今日會話數:', stats.todayCount);
        } else {
            logger.warn('找不到今日會話數元素 (.stat-today-count)');
        }

        // 更新今日平均時長
        if (this.statsElements.averageDuration) {
            const durationText = TimeUtils.formatDuration(stats.averageDuration);
            DOMUtils.safeSetTextContent(this.statsElements.averageDuration, durationText);
            logger.debug('已更新今日平均時長:', durationText);
        } else {
            logger.warn('找不到平均時長元素 (.stat-average-duration)');
        }
    };

    /**
     * 添加載入動畫
     */
    SessionUIRenderer.prototype.showLoading = function(element) {
        if (element && this.enableAnimations) {
            DOMUtils.safeAddClass(element, 'loading');
        }
    };

    /**
     * 移除載入動畫
     */
    SessionUIRenderer.prototype.hideLoading = function(element) {
        if (element && this.enableAnimations) {
            DOMUtils.safeRemoveClass(element, 'loading');
        }
    };

    /**
     * 啟動活躍時間定時器
     */
    SessionUIRenderer.prototype.startActiveTimeTimer = function() {
        const self = this;

        // 清除現有定時器
        if (this.activeTimeTimer) {
            clearInterval(this.activeTimeTimer);
        }

        // 每秒更新活躍時間
        this.activeTimeTimer = setInterval(function() {
            self.updateActiveTime();
        }, 1000);

        if (DEBUG_MODE) console.log('🎨 活躍時間定時器已啟動');
    };

    /**
     * 停止活躍時間定時器
     */
    SessionUIRenderer.prototype.stopActiveTimeTimer = function() {
        if (this.activeTimeTimer) {
            clearInterval(this.activeTimeTimer);
            this.activeTimeTimer = null;
            if (DEBUG_MODE) console.log('🎨 活躍時間定時器已停止');
        }
    };

    /**
     * 重置活躍時間定時器
     */
    SessionUIRenderer.prototype.resetActiveTimeTimer = function() {
        this.stopActiveTimeTimer();
        this.startActiveTimeTimer();
    };

    /**
     * 更新活躍時間顯示
     */
    SessionUIRenderer.prototype.updateActiveTime = function() {
        if (!this.currentSessionData || !this.currentSessionData.created_at) {
            return;
        }

        const activeTimeElement = document.getElementById('sessionAge');
        if (activeTimeElement) {
            const timeText = TimeUtils.formatElapsedTime(this.currentSessionData.created_at);
            DOMUtils.safeSetTextContent(activeTimeElement, timeText);
        }
    };

    /**
     * 清理資源
     */
    SessionUIRenderer.prototype.cleanup = function() {
        // 停止定時器
        this.stopActiveTimeTimer();

        // 清理防抖定時器
        Object.keys(this.renderDebounceTimers).forEach(key => {
            if (this.renderDebounceTimers[key]) {
                clearTimeout(this.renderDebounceTimers[key]);
                this.renderDebounceTimers[key] = null;
            }
        });

        // 清理引用
        this.currentSessionCard = null;
        this.historyList = null;
        this.statsElements = {};
        this.currentSessionData = null;
        this.lastRenderedData = {
            stats: null,
            historyLength: 0,
            currentSessionId: null
        };

        if (DEBUG_MODE) console.log('🎨 SessionUIRenderer 清理完成');
    };

    // 將 SessionUIRenderer 加入命名空間
    window.MCPFeedback.Session.UIRenderer = SessionUIRenderer;

    if (DEBUG_MODE) console.log('✅ SessionUIRenderer 模組載入完成');

})();
