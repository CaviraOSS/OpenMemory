/**
 * MCP Feedback Enhanced - UI 管理模組
 * =================================
 * 
 * 處理 UI 狀態更新、指示器管理和頁籤切換
 */

(function() {
    'use strict';

    // 確保命名空間和依賴存在
    window.MCPFeedback = window.MCPFeedback || {};
    const Utils = window.MCPFeedback.Utils;

    /**
     * UI 管理器建構函數
     */
    function UIManager(options) {
        options = options || {};
        
        // 當前狀態
        this.currentTab = options.currentTab || 'combined';
        this.feedbackState = Utils.CONSTANTS.FEEDBACK_WAITING;
        this.layoutMode = options.layoutMode || 'combined-vertical';
        this.lastSubmissionTime = null;
        
        // UI 元素
        this.connectionIndicator = null;
        this.connectionText = null;
        this.tabButtons = null;
        this.tabContents = null;
        this.submitBtn = null;
        this.feedbackText = null;
        
        // 回調函數
        this.onTabChange = options.onTabChange || null;
        this.onLayoutModeChange = options.onLayoutModeChange || null;

        // 初始化防抖函數
        this.initDebounceHandlers();

        this.initUIElements();
    }

    /**
     * 初始化防抖處理器
     */
    UIManager.prototype.initDebounceHandlers = function() {
        // 為狀態指示器更新添加防抖
        this._debouncedUpdateStatusIndicator = Utils.DOM.debounce(
            this._originalUpdateStatusIndicator.bind(this),
            100,
            false
        );

        // 為狀態指示器元素更新添加防抖
        this._debouncedUpdateStatusIndicatorElement = Utils.DOM.debounce(
            this._originalUpdateStatusIndicatorElement.bind(this),
            50,
            false
        );
    };

    /**
     * 初始化 UI 元素
     */
    UIManager.prototype.initUIElements = function() {
        // 基本 UI 元素
        this.connectionIndicator = Utils.safeQuerySelector('#connectionIndicator');
        this.connectionText = Utils.safeQuerySelector('#connectionText');

        // 頁籤相關元素
        this.tabButtons = document.querySelectorAll('.tab-button');
        this.tabContents = document.querySelectorAll('.tab-content');

        // 回饋相關元素
        this.submitBtn = Utils.safeQuerySelector('#submitBtn');

        console.log('✅ UI 元素初始化完成');
    };

    /**
     * 初始化頁籤功能
     */
    UIManager.prototype.initTabs = function() {
        const self = this;
        
        // 設置頁籤點擊事件
        this.tabButtons.forEach(function(button) {
            button.addEventListener('click', function() {
                const tabName = button.getAttribute('data-tab');
                self.switchTab(tabName);
            });
        });

        // 根據佈局模式確定初始頁籤
        let initialTab = this.currentTab;
        if (this.layoutMode.startsWith('combined')) {
            initialTab = 'combined';
        } else if (this.currentTab === 'combined') {
            initialTab = 'feedback';
        }

        // 設置初始頁籤
        this.setInitialTab(initialTab);
    };

    /**
     * 設置初始頁籤（不觸發保存）
     */
    UIManager.prototype.setInitialTab = function(tabName) {
        this.currentTab = tabName;
        this.updateTabDisplay(tabName);
        this.handleSpecialTabs(tabName);
        console.log('初始化頁籤: ' + tabName);
    };

    /**
     * 切換頁籤
     */
    UIManager.prototype.switchTab = function(tabName) {
        this.currentTab = tabName;
        this.updateTabDisplay(tabName);
        this.handleSpecialTabs(tabName);
        
        // 觸發回調
        if (this.onTabChange) {
            this.onTabChange(tabName);
        }
        
        console.log('切換到頁籤: ' + tabName);
    };

    /**
     * 更新頁籤顯示
     */
    UIManager.prototype.updateTabDisplay = function(tabName) {
        // 更新按鈕狀態
        this.tabButtons.forEach(function(button) {
            if (button.getAttribute('data-tab') === tabName) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });

        // 更新內容顯示
        this.tabContents.forEach(function(content) {
            if (content.id === 'tab-' + tabName) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
    };

    /**
     * 處理特殊頁籤
     */
    UIManager.prototype.handleSpecialTabs = function(tabName) {
        if (tabName === 'combined') {
            this.handleCombinedMode();
        }
    };

    /**
     * 處理合併模式
     */
    UIManager.prototype.handleCombinedMode = function() {
        console.log('切換到組合模式');
        
        // 確保合併模式的佈局樣式正確應用
        const combinedTab = Utils.safeQuerySelector('#tab-combined');
        if (combinedTab) {
            combinedTab.classList.remove('combined-vertical', 'combined-horizontal');
            if (this.layoutMode === 'combined-vertical') {
                combinedTab.classList.add('combined-vertical');
            } else if (this.layoutMode === 'combined-horizontal') {
                combinedTab.classList.add('combined-horizontal');
            }
        }
    };

    /**
     * 更新頁籤可見性
     */
    UIManager.prototype.updateTabVisibility = function() {
        const combinedTab = document.querySelector('.tab-button[data-tab="combined"]');
        const feedbackTab = document.querySelector('.tab-button[data-tab="feedback"]');
        const summaryTab = document.querySelector('.tab-button[data-tab="summary"]');

        // 只使用合併模式：顯示合併模式頁籤，隱藏回饋和AI摘要頁籤
        if (combinedTab) combinedTab.style.display = 'inline-block';
        if (feedbackTab) feedbackTab.style.display = 'none';
        if (summaryTab) summaryTab.style.display = 'none';
    };

    /**
     * 設置回饋狀態
     */
    UIManager.prototype.setFeedbackState = function(state, sessionId) {
        const previousState = this.feedbackState;
        this.feedbackState = state;

        if (sessionId) {
            console.log('🔄 會話 ID: ' + sessionId.substring(0, 8) + '...');
        }

        console.log('📊 狀態變更: ' + previousState + ' → ' + state);
        this.updateUIState();
        this.updateStatusIndicator();
    };

    /**
     * 更新 UI 狀態
     */
    UIManager.prototype.updateUIState = function() {
        this.updateSubmitButton();
        this.updateFeedbackInputs();
        this.updateImageUploadAreas();
    };

    /**
     * 更新提交按鈕狀態
     */
    UIManager.prototype.updateSubmitButton = function() {
        const submitButtons = [
            Utils.safeQuerySelector('#submitBtn')
        ].filter(function(btn) { return btn !== null; });

        const self = this;
        submitButtons.forEach(function(button) {
            if (!button) return;

            switch (self.feedbackState) {
                case Utils.CONSTANTS.FEEDBACK_WAITING:
                    button.textContent = window.i18nManager ? window.i18nManager.t('buttons.submit') : '提交回饋';
                    button.className = 'btn btn-primary';
                    button.disabled = false;
                    break;
                case Utils.CONSTANTS.FEEDBACK_PROCESSING:
                    button.textContent = window.i18nManager ? window.i18nManager.t('buttons.processing') : '處理中...';
                    button.className = 'btn btn-secondary';
                    button.disabled = true;
                    break;
                case Utils.CONSTANTS.FEEDBACK_SUBMITTED:
                    button.textContent = window.i18nManager ? window.i18nManager.t('buttons.submitted') : '已提交';
                    button.className = 'btn btn-success';
                    button.disabled = true;
                    break;
            }
        });
    };

    /**
     * 更新回饋輸入框狀態
     */
    UIManager.prototype.updateFeedbackInputs = function() {
        const feedbackInput = Utils.safeQuerySelector('#combinedFeedbackText');
        const canInput = this.feedbackState === Utils.CONSTANTS.FEEDBACK_WAITING;

        if (feedbackInput) {
            feedbackInput.disabled = !canInput;
        }
    };

    /**
     * 更新圖片上傳區域狀態
     */
    UIManager.prototype.updateImageUploadAreas = function() {
        const uploadAreas = [
            Utils.safeQuerySelector('#feedbackImageUploadArea'),
            Utils.safeQuerySelector('#combinedImageUploadArea')
        ].filter(function(area) { return area !== null; });

        const canUpload = this.feedbackState === Utils.CONSTANTS.FEEDBACK_WAITING;
        uploadAreas.forEach(function(area) {
            if (canUpload) {
                area.classList.remove('disabled');
            } else {
                area.classList.add('disabled');
            }
        });
    };

    /**
     * 更新狀態指示器（原始版本，供防抖使用）
     */
    UIManager.prototype._originalUpdateStatusIndicator = function() {
        const feedbackStatusIndicator = Utils.safeQuerySelector('#feedbackStatusIndicator');
        const combinedStatusIndicator = Utils.safeQuerySelector('#combinedFeedbackStatusIndicator');

        const statusInfo = this.getStatusInfo();

        if (feedbackStatusIndicator) {
            this._originalUpdateStatusIndicatorElement(feedbackStatusIndicator, statusInfo);
        }

        if (combinedStatusIndicator) {
            this._originalUpdateStatusIndicatorElement(combinedStatusIndicator, statusInfo);
        }

        // 減少重複日誌：只在狀態真正改變時記錄
        if (!this._lastStatusInfo || this._lastStatusInfo.status !== statusInfo.status) {
            console.log('✅ 狀態指示器已更新: ' + statusInfo.status + ' - ' + statusInfo.title);
            this._lastStatusInfo = statusInfo;
        }
    };

    /**
     * 更新狀態指示器（防抖版本）
     */
    UIManager.prototype.updateStatusIndicator = function() {
        if (this._debouncedUpdateStatusIndicator) {
            this._debouncedUpdateStatusIndicator();
        } else {
            // 回退到原始方法（防抖未初始化時）
            this._originalUpdateStatusIndicator();
        }
    };

    /**
     * 獲取狀態信息
     */
    UIManager.prototype.getStatusInfo = function() {
        let icon, title, message, status;

        switch (this.feedbackState) {
            case Utils.CONSTANTS.FEEDBACK_WAITING:
                icon = '⏳';
                title = window.i18nManager ? window.i18nManager.t('status.waiting.title') : '等待回饋';
                message = window.i18nManager ? window.i18nManager.t('status.waiting.message') : '請提供您的回饋意見';
                status = 'waiting';
                break;

            case Utils.CONSTANTS.FEEDBACK_PROCESSING:
                icon = '⚙️';
                title = window.i18nManager ? window.i18nManager.t('status.processing.title') : '處理中';
                message = window.i18nManager ? window.i18nManager.t('status.processing.message') : '正在提交您的回饋...';
                status = 'processing';
                break;

            case Utils.CONSTANTS.FEEDBACK_SUBMITTED:
                const timeStr = this.lastSubmissionTime ?
                    new Date(this.lastSubmissionTime).toLocaleTimeString() : '';
                icon = '✅';
                title = window.i18nManager ? window.i18nManager.t('status.submitted.title') : '回饋已提交';
                message = window.i18nManager ? window.i18nManager.t('status.submitted.message') : '等待下次 MCP 調用';
                if (timeStr) {
                    message += ' (' + timeStr + ')';
                }
                status = 'submitted';
                break;

            default:
                icon = '⏳';
                title = window.i18nManager ? window.i18nManager.t('status.waiting.title') : '等待回饋';
                message = window.i18nManager ? window.i18nManager.t('status.waiting.message') : '請提供您的回饋意見';
                status = 'waiting';
        }

        return { icon: icon, title: title, message: message, status: status };
    };

    /**
     * 更新單個狀態指示器元素（原始版本，供防抖使用）
     */
    UIManager.prototype._originalUpdateStatusIndicatorElement = function(element, statusInfo) {
        if (!element) return;

        // 更新狀態類別
        element.className = 'feedback-status-indicator status-' + statusInfo.status;
        element.style.display = 'block';

        // 更新標題
        const titleElement = element.querySelector('.status-title');
        if (titleElement) {
            titleElement.textContent = statusInfo.icon + ' ' + statusInfo.title;
        }

        // 更新訊息
        const messageElement = element.querySelector('.status-message');
        if (messageElement) {
            messageElement.textContent = statusInfo.message;
        }

        // 減少重複日誌：只記錄元素 ID 變化
        if (element.id) {
            console.log('🔧 已更新狀態指示器: ' + element.id + ' -> ' + statusInfo.status);
        }
    };

    /**
     * 更新單個狀態指示器元素（防抖版本）
     */
    UIManager.prototype.updateStatusIndicatorElement = function(element, statusInfo) {
        if (this._debouncedUpdateStatusIndicatorElement) {
            this._debouncedUpdateStatusIndicatorElement(element, statusInfo);
        } else {
            // 回退到原始方法（防抖未初始化時）
            this._originalUpdateStatusIndicatorElement(element, statusInfo);
        }
    };

    /**
     * 更新連接狀態
     */
    UIManager.prototype.updateConnectionStatus = function(status, text) {
        if (this.connectionIndicator) {
            this.connectionIndicator.className = 'connection-indicator ' + status;
        }
        if (this.connectionText) {
            this.connectionText.textContent = text;
        }
    };

    /**
     * 安全地渲染 Markdown 內容
     */
    UIManager.prototype.renderMarkdownSafely = function(content) {
        try {
            // 檢查 marked 和 DOMPurify 是否可用
            if (typeof window.marked === 'undefined' || typeof window.DOMPurify === 'undefined') {
                console.warn('⚠️ Markdown 庫未載入，使用純文字顯示');
                return this.escapeHtml(content);
            }

            // 使用 marked 解析 Markdown
            const htmlContent = window.marked.parse(content);

            // 使用 DOMPurify 清理 HTML
            const cleanHtml = window.DOMPurify.sanitize(htmlContent, {
                ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote', 'a', 'hr', 'del', 's', 'table', 'thead', 'tbody', 'tr', 'td', 'th'],
                ALLOWED_ATTR: ['href', 'title', 'class', 'align', 'style'],
                ALLOW_DATA_ATTR: false
            });

            return cleanHtml;
        } catch (error) {
            console.error('❌ Markdown 渲染失敗:', error);
            return this.escapeHtml(content);
        }
    };

    /**
     * HTML 轉義函數
     */
    UIManager.prototype.escapeHtml = function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    /**
     * 更新 AI 摘要內容
     */
    UIManager.prototype.updateAISummaryContent = function(summary) {
        console.log('📝 更新 AI 摘要內容...', '內容長度:', summary ? summary.length : 'undefined');
        console.log('📝 marked 可用:', typeof window.marked !== 'undefined');
        console.log('📝 DOMPurify 可用:', typeof window.DOMPurify !== 'undefined');

        // 渲染 Markdown 內容
        const renderedContent = this.renderMarkdownSafely(summary);
        console.log('📝 渲染後內容長度:', renderedContent ? renderedContent.length : 'undefined');

        const summaryContent = Utils.safeQuerySelector('#summaryContent');
        if (summaryContent) {
            summaryContent.innerHTML = renderedContent;
            console.log('✅ 已更新分頁模式摘要內容（Markdown 渲染）');
        } else {
            console.warn('⚠️ 找不到 #summaryContent 元素');
        }

        const combinedSummaryContent = Utils.safeQuerySelector('#combinedSummaryContent');
        if (combinedSummaryContent) {
            combinedSummaryContent.innerHTML = renderedContent;
            console.log('✅ 已更新合併模式摘要內容（Markdown 渲染）');
        } else {
            console.warn('⚠️ 找不到 #combinedSummaryContent 元素');
        }
    };

    /**
     * 重置回饋表單
     * @param {boolean} clearText - 是否清空文字內容，預設為 false
     */
    UIManager.prototype.resetFeedbackForm = function(clearText) {
        console.log('🔄 重置回饋表單...');

        // 根據參數決定是否清空回饋輸入
        const feedbackInput = Utils.safeQuerySelector('#combinedFeedbackText');
        if (feedbackInput) {
            if (clearText === true) {
                feedbackInput.value = '';
                console.log('📝 已清空文字內容');
            }
            // 只有在等待狀態才啟用輸入框
            const canInput = this.feedbackState === Utils.CONSTANTS.FEEDBACK_WAITING;
            feedbackInput.disabled = !canInput;
        }

        // 重新啟用提交按鈕
        const submitButtons = [
            Utils.safeQuerySelector('#submitBtn')
        ].filter(function(btn) { return btn !== null; });

        submitButtons.forEach(function(button) {
            button.disabled = false;
            const defaultText = window.i18nManager ? window.i18nManager.t('buttons.submit') : '提交回饋';
            button.textContent = button.getAttribute('data-original-text') || defaultText;
        });

        console.log('✅ 回饋表單重置完成');
    };

    /**
     * 應用佈局模式
     */
    UIManager.prototype.applyLayoutMode = function(layoutMode) {
        this.layoutMode = layoutMode;
        
        const expectedClassName = 'layout-' + layoutMode;
        if (document.body.className !== expectedClassName) {
            console.log('應用佈局模式: ' + layoutMode);
            document.body.className = expectedClassName;
        }

        this.updateTabVisibility();
        
        // 如果當前頁籤不是合併模式，則切換到合併模式頁籤
        if (this.currentTab !== 'combined') {
            this.currentTab = 'combined';
        }
        
        // 觸發回調
        if (this.onLayoutModeChange) {
            this.onLayoutModeChange(layoutMode);
        }
    };

    /**
     * 獲取當前頁籤
     */
    UIManager.prototype.getCurrentTab = function() {
        return this.currentTab;
    };

    /**
     * 獲取當前回饋狀態
     */
    UIManager.prototype.getFeedbackState = function() {
        return this.feedbackState;
    };

    /**
     * 設置最後提交時間
     */
    UIManager.prototype.setLastSubmissionTime = function(timestamp) {
        this.lastSubmissionTime = timestamp;
        this.updateStatusIndicator();
    };

    // 將 UIManager 加入命名空間
    window.MCPFeedback.UIManager = UIManager;

    console.log('✅ UIManager 模組載入完成');

})();
