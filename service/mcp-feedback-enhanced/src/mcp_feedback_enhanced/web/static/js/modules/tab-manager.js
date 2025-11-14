/**
 * MCP Feedback Enhanced - 標籤頁管理模組
 * ====================================
 * 
 * 處理多標籤頁狀態同步和智能瀏覽器管理
 */

(function() {
    'use strict';

    // 確保命名空間和依賴存在
    window.MCPFeedback = window.MCPFeedback || {};
    const Utils = window.MCPFeedback.Utils;

    /**
     * 標籤頁管理器建構函數
     */
    function TabManager() {
        this.tabId = Utils.generateId('tab');
        this.heartbeatInterval = null;
        this.heartbeatFrequency = Utils.CONSTANTS.DEFAULT_TAB_HEARTBEAT_FREQUENCY;
        this.storageKey = 'mcp_feedback_tabs';
        this.lastActivityKey = 'mcp_feedback_last_activity';

        this.init();
    }

    /**
     * 初始化標籤頁管理器
     */
    TabManager.prototype.init = function() {
        // 註冊當前標籤頁
        this.registerTab();

        // 向服務器註冊標籤頁
        this.registerTabToServer();

        // 開始心跳
        this.startHeartbeat();

        // 監聽頁面關閉事件
        const self = this;
        window.addEventListener('beforeunload', function() {
            self.unregisterTab();
        });

        // 監聽 localStorage 變化（其他標籤頁的狀態變化）
        window.addEventListener('storage', function(e) {
            if (e.key === self.storageKey) {
                self.handleTabsChange();
            }
        });

        console.log('📋 TabManager 初始化完成，標籤頁 ID: ' + this.tabId);
    };

    /**
     * 註冊當前標籤頁
     */
    TabManager.prototype.registerTab = function() {
        const tabs = this.getActiveTabs();
        tabs[this.tabId] = {
            timestamp: Date.now(),
            url: window.location.href,
            active: true
        };
        
        if (Utils.isLocalStorageSupported()) {
            localStorage.setItem(this.storageKey, JSON.stringify(tabs));
        }
        
        this.updateLastActivity();
        console.log('✅ 標籤頁已註冊: ' + this.tabId);
    };

    /**
     * 註銷當前標籤頁
     */
    TabManager.prototype.unregisterTab = function() {
        const tabs = this.getActiveTabs();
        delete tabs[this.tabId];
        
        if (Utils.isLocalStorageSupported()) {
            localStorage.setItem(this.storageKey, JSON.stringify(tabs));
        }
        
        console.log('❌ 標籤頁已註銷: ' + this.tabId);
    };

    /**
     * 開始心跳
     */
    TabManager.prototype.startHeartbeat = function() {
        const self = this;
        this.heartbeatInterval = setInterval(function() {
            self.sendHeartbeat();
        }, this.heartbeatFrequency);
    };

    /**
     * 發送心跳
     */
    TabManager.prototype.sendHeartbeat = function() {
        const tabs = this.getActiveTabs();
        if (tabs[this.tabId]) {
            tabs[this.tabId].timestamp = Date.now();
            
            if (Utils.isLocalStorageSupported()) {
                localStorage.setItem(this.storageKey, JSON.stringify(tabs));
            }
            
            this.updateLastActivity();
        }
    };

    /**
     * 更新最後活動時間
     */
    TabManager.prototype.updateLastActivity = function() {
        if (Utils.isLocalStorageSupported()) {
            localStorage.setItem(this.lastActivityKey, Date.now().toString());
        }
    };

    /**
     * 獲取活躍標籤頁
     */
    TabManager.prototype.getActiveTabs = function() {
        if (!Utils.isLocalStorageSupported()) {
            return {};
        }

        try {
            const stored = localStorage.getItem(this.storageKey);
            const tabs = stored ? Utils.safeJsonParse(stored, {}) : {};

            // 清理過期的標籤頁
            const now = Date.now();
            const expiredThreshold = Utils.CONSTANTS.TAB_EXPIRED_THRESHOLD;

            for (const tabId in tabs) {
                if (tabs.hasOwnProperty(tabId)) {
                    if (now - tabs[tabId].timestamp > expiredThreshold) {
                        delete tabs[tabId];
                    }
                }
            }

            return tabs;
        } catch (error) {
            console.error('獲取活躍標籤頁失敗:', error);
            return {};
        }
    };

    /**
     * 檢查是否有活躍標籤頁
     */
    TabManager.prototype.hasActiveTabs = function() {
        const tabs = this.getActiveTabs();
        return Object.keys(tabs).length > 0;
    };

    /**
     * 檢查是否為唯一活躍標籤頁
     */
    TabManager.prototype.isOnlyActiveTab = function() {
        const tabs = this.getActiveTabs();
        return Object.keys(tabs).length === 1 && tabs[this.tabId];
    };

    /**
     * 處理其他標籤頁狀態變化
     */
    TabManager.prototype.handleTabsChange = function() {
        console.log('🔄 檢測到其他標籤頁狀態變化');
        // 可以在這裡添加更多邏輯
    };

    /**
     * 向服務器註冊標籤頁
     */
    TabManager.prototype.registerTabToServer = function() {
        const self = this;
        
        fetch('/api/register-tab', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tabId: this.tabId
            })
        })
        .then(function(response) {
            if (response.ok) {
                return response.json();
            } else {
                console.warn('⚠️ 標籤頁服務器註冊失敗: ' + response.status);
            }
        })
        .then(function(data) {
            if (data) {
                console.log('✅ 標籤頁已向服務器註冊: ' + self.tabId);
            }
        })
        .catch(function(error) {
            console.warn('⚠️ 標籤頁服務器註冊錯誤: ' + error);
        });
    };

    /**
     * 清理資源
     */
    TabManager.prototype.cleanup = function() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        this.unregisterTab();
    };

    /**
     * 獲取當前標籤頁 ID
     */
    TabManager.prototype.getTabId = function() {
        return this.tabId;
    };

    // 將 TabManager 加入命名空間
    window.MCPFeedback.TabManager = TabManager;

    console.log('✅ TabManager 模組載入完成');

})();