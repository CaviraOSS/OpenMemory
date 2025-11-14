/**
 * MCP Feedback Enhanced - 通知管理模組
 * ===================================
 * 
 * 處理瀏覽器通知功能，支援新會話通知和緊急狀態通知
 * 使用 Web Notification API，提供極簡的通知體驗
 */

(function() {
    'use strict';

    // 確保命名空間存在
    window.MCPFeedback = window.MCPFeedback || {};
    const Utils = window.MCPFeedback.Utils;

    /**
     * 通知管理器建構函數
     */
    function NotificationManager(options) {
        options = options || {};
        
        // 通知設定
        this.enabled = false;
        this.permission = 'default';
        this.triggerMode = 'focusLost';  // 預設為失去焦點時通知
        
        // 狀態追蹤
        this.lastSessionId = null;  // 避免重複通知同一會話
        this.isInitialized = false;
        this.hasFocus = true;  // 追蹤視窗焦點狀態
        
        // 設定鍵名
        this.STORAGE_KEY = 'notificationsEnabled';
        this.TRIGGER_MODE_KEY = 'notificationTriggerMode';
        
        // i18n 翻譯函數
        this.t = options.t || function(key, defaultValue) { return defaultValue || key; };
        
        console.log('🔔 NotificationManager 建構完成');
    }

    /**
     * 初始化通知管理器
     */
    NotificationManager.prototype.initialize = function() {
        if (this.isInitialized) return;
        
        // 檢查瀏覽器支援
        if (!this.checkBrowserSupport()) {
            console.warn('⚠️ 瀏覽器不支援 Notification API');
            return;
        }
        
        // 載入設定
        this.loadSettings();
        
        // 更新權限狀態
        this.updatePermissionStatus();
        
        // 設定焦點追蹤
        this.setupFocusTracking();
        
        this.isInitialized = true;
        console.log('✅ NotificationManager 初始化完成', {
            enabled: this.enabled,
            permission: this.permission,
            triggerMode: this.triggerMode
        });
    };

    /**
     * 檢查瀏覽器支援
     */
    NotificationManager.prototype.checkBrowserSupport = function() {
        return 'Notification' in window;
    };

    /**
     * 載入設定
     */
    NotificationManager.prototype.loadSettings = function() {
        try {
            this.enabled = localStorage.getItem(this.STORAGE_KEY) === 'true';
            this.triggerMode = localStorage.getItem(this.TRIGGER_MODE_KEY) || 'focusLost';
        } catch (error) {
            console.error('❌ 載入通知設定失敗:', error);
            this.enabled = false;
            this.triggerMode = 'focusLost';
        }
    };

    /**
     * 儲存設定
     */
    NotificationManager.prototype.saveSettings = function() {
        try {
            localStorage.setItem(this.STORAGE_KEY, this.enabled.toString());
        } catch (error) {
            console.error('❌ 儲存通知設定失敗:', error);
        }
    };

    /**
     * 更新權限狀態
     */
    NotificationManager.prototype.updatePermissionStatus = function() {
        if (this.checkBrowserSupport()) {
            this.permission = Notification.permission;
        }
    };

    /**
     * 請求通知權限
     */
    NotificationManager.prototype.requestPermission = async function() {
        if (!this.checkBrowserSupport()) {
            throw new Error('瀏覽器不支援通知功能');
        }
        
        try {
            const result = await Notification.requestPermission();
            this.permission = result;
            return result;
        } catch (error) {
            console.error('❌ 請求通知權限失敗:', error);
            throw error;
        }
    };

    /**
     * 啟用通知
     */
    NotificationManager.prototype.enable = async function() {
        // 檢查權限
        if (this.permission === 'default') {
            const result = await this.requestPermission();
            if (result !== 'granted') {
                return false;
            }
        } else if (this.permission === 'denied') {
            console.warn('⚠️ 通知權限已被拒絕');
            return false;
        }
        
        this.enabled = true;
        this.saveSettings();
        console.log('✅ 通知已啟用');
        return true;
    };

    /**
     * 停用通知
     */
    NotificationManager.prototype.disable = function() {
        this.enabled = false;
        this.saveSettings();
        console.log('🔇 通知已停用');
    };

    /**
     * 設定焦點追蹤
     */
    NotificationManager.prototype.setupFocusTracking = function() {
        const self = this;
        
        // 監聽焦點事件
        window.addEventListener('focus', function() {
            self.hasFocus = true;
            console.log('👁️ 視窗獲得焦點');
        });
        
        window.addEventListener('blur', function() {
            self.hasFocus = false;
            console.log('👁️ 視窗失去焦點');
        });
    };

    /**
     * 檢查是否可以顯示通知
     */
    NotificationManager.prototype.canNotify = function() {
        if (!this.enabled || this.permission !== 'granted') {
            return false;
        }
        
        // 根據觸發模式判斷
        switch (this.triggerMode) {
            case 'always':
                return true;  // 總是通知
            case 'background':
                return document.hidden;  // 只在頁面隱藏時通知
            case 'tabSwitch':
                return document.hidden;  // 只在切換標籤頁時通知
            case 'focusLost':
                return document.hidden || !this.hasFocus;  // 失去焦點或頁面隱藏時通知
            default:
                return document.hidden || !this.hasFocus;
        }
    };

    /**
     * 新會話通知
     */
    NotificationManager.prototype.notifyNewSession = function(sessionId, projectPath) {
        // 避免重複通知
        if (sessionId === this.lastSessionId) {
            console.log('🔇 跳過重複的會話通知');
            return;
        }
        
        // 檢查是否可以通知
        if (!this.canNotify()) {
            console.log('🔇 不符合通知條件', {
                enabled: this.enabled,
                permission: this.permission,
                pageHidden: document.hidden,
                hasFocus: this.hasFocus,
                triggerMode: this.triggerMode
            });
            return;
        }
        
        this.lastSessionId = sessionId;
        
        try {
            const notification = new Notification(this.t('notification.browser.title', 'MCP Feedback - 新會話'), {
                body: `${this.t('notification.browser.ready', '準備就緒')}: ${this.truncatePath(projectPath)}`,
                icon: '/static/icon-192.png',
                badge: '/static/icon-192.png',
                tag: 'mcp-session',
                timestamp: Date.now(),
                silent: false
            });
            
            // 點擊後聚焦視窗
            notification.onclick = () => {
                window.focus();
                notification.close();
                console.log('🖱️ 通知被點擊，視窗已聚焦');
            };
            
            // 5秒後自動關閉
            setTimeout(() => notification.close(), 5000);
            
            console.log('🔔 已發送新會話通知', {
                sessionId: sessionId,
                projectPath: projectPath
            });
        } catch (error) {
            console.error('❌ 發送通知失敗:', error);
        }
    };

    /**
     * 緊急通知（連線問題等）
     */
    NotificationManager.prototype.notifyCritical = function(type, message) {
        if (!this.canNotify()) return;
        
        try {
            const notification = new Notification(this.t('notification.browser.criticalTitle', 'MCP Feedback - 警告'), {
                body: message,
                icon: '/static/icon-192.png',
                badge: '/static/icon-192.png',
                tag: 'mcp-critical',
                requireInteraction: true,  // 需要手動關閉
                timestamp: Date.now()
            });
            
            notification.onclick = () => {
                window.focus();
                notification.close();
                console.log('🖱️ 緊急通知被點擊');
            };
            
            console.log('⚠️ 已發送緊急通知', {
                type: type,
                message: message
            });
        } catch (error) {
            console.error('❌ 發送緊急通知失敗:', error);
        }
    };

    /**
     * 路徑截斷顯示
     */
    NotificationManager.prototype.truncatePath = function(path, maxLength) {
        maxLength = maxLength || 50;
        if (!path || path.length <= maxLength) return path || this.t('notification.browser.unknownProject', '未知專案');
        return '...' + path.slice(-(maxLength - 3));
    };

    /**
     * 設定觸發模式
     */
    NotificationManager.prototype.setTriggerMode = function(mode) {
        const validModes = ['always', 'background', 'tabSwitch', 'focusLost'];
        if (validModes.includes(mode)) {
            this.triggerMode = mode;
            try {
                localStorage.setItem(this.TRIGGER_MODE_KEY, mode);
                console.log('✅ 通知觸發模式已更新:', mode);
            } catch (error) {
                console.error('❌ 儲存觸發模式失敗:', error);
            }
        }
    };

    /**
     * 獲取當前設定
     */
    NotificationManager.prototype.getSettings = function() {
        return {
            enabled: this.enabled,
            permission: this.permission,
            browserSupported: this.checkBrowserSupport(),
            triggerMode: this.triggerMode
        };
    };

    /**
     * 測試通知
     */
    NotificationManager.prototype.testNotification = function() {
        if (!this.checkBrowserSupport()) {
            alert(this.t('notification.browser.notSupported', '您的瀏覽器不支援通知功能'));
            return;
        }
        
        if (this.permission !== 'granted') {
            alert(this.t('notification.browser.permissionRequired', '請先授權通知權限'));
            return;
        }
        
        try {
            const notification = new Notification(this.t('notification.browser.testTitle', '測試通知'), {
                body: this.t('notification.browser.testBody', '這是一個測試通知，5秒後將自動關閉'),
                icon: '/static/icon-192.png',
                tag: 'mcp-test',
                timestamp: Date.now()
            });
            
            notification.onclick = () => {
                notification.close();
            };
            
            setTimeout(() => notification.close(), 5000);
            
            console.log('🔔 測試通知已發送');
        } catch (error) {
            console.error('❌ 測試通知失敗:', error);
            alert('發送測試通知失敗');
        }
    };

    // 匯出到全域命名空間
    window.MCPFeedback.NotificationManager = NotificationManager;

})();