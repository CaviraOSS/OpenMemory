/**
 * MCP Feedback Enhanced - 圖片處理模組
 * ==================================
 * 
 * 處理圖片上傳、預覽、壓縮和管理功能
 */

(function() {
    'use strict';

    // 確保命名空間和依賴存在
    window.MCPFeedback = window.MCPFeedback || {};
    const Utils = window.MCPFeedback.Utils;

    /**
     * 圖片處理器建構函數
     */
    function ImageHandler(options) {
        options = options || {};

        this.imageSizeLimit = options.imageSizeLimit || 0;
        this.enableBase64Detail = options.enableBase64Detail || false;
        this.layoutMode = options.layoutMode || 'combined-vertical';
        this.currentImagePrefix = '';

        // UI 元素（保留用於設定同步）
        this.imageSizeLimitSelect = null;
        this.enableBase64DetailCheckbox = null;

        // 回調函數
        this.onSettingsChange = options.onSettingsChange || null;

        // 創建檔案上傳管理器
        const self = this;
        this.fileUploadManager = new window.MCPFeedback.FileUploadManager({
            maxFileSize: this.imageSizeLimit,
            enableBase64Detail: this.enableBase64Detail,
            onFileAdd: function(fileData) {
                console.log('📁 檔案已添加:', fileData.name);
            },
            onFileRemove: function(fileData, index) {
                console.log('🗑️ 檔案已移除:', fileData.name);
            },
            onSettingsChange: function() {
                if (self.onSettingsChange) {
                    self.onSettingsChange();
                }
            }
        });

        console.log('🖼️ ImageHandler 建構函數初始化完成');
    }

    /**
     * 初始化圖片處理器
     */
    ImageHandler.prototype.init = function() {
        console.log('🖼️ 開始初始化圖片處理功能...');

        // 初始化設定元素
        this.initImageSettingsElements();

        // 初始化檔案上傳管理器
        this.fileUploadManager.initialize();

        console.log('✅ 圖片處理功能初始化完成');
    };

    /**
     * 動態初始化圖片相關元素
     */
    ImageHandler.prototype.initImageSettingsElements = function() {
        // 查找設定頁籤中的圖片設定元素
        this.imageSizeLimitSelect = Utils.safeQuerySelector('#settingsImageSizeLimit');
        this.enableBase64DetailCheckbox = Utils.safeQuerySelector('#settingsEnableBase64Detail');

        // 初始化設定事件監聽器
        this.initImageSettings();

        console.log('✅ 圖片設定元素初始化完成');
    };





    /**
     * 移除圖片設定事件監聽器
     */
    ImageHandler.prototype.removeImageSettingsListeners = function() {
        if (this.imageSizeLimitSelect && this.imageSizeLimitChangeHandler) {
            this.imageSizeLimitSelect.removeEventListener('change', this.imageSizeLimitChangeHandler);
            this.imageSizeLimitChangeHandler = null;
        }

        if (this.enableBase64DetailCheckbox && this.enableBase64DetailChangeHandler) {
            this.enableBase64DetailCheckbox.removeEventListener('change', this.enableBase64DetailChangeHandler);
            this.enableBase64DetailChangeHandler = null;
        }
    };

    /**
     * 初始化圖片設定事件
     */
    ImageHandler.prototype.initImageSettings = function() {
        const self = this;

        // 移除舊的設定事件監聽器
        this.removeImageSettingsListeners();

        if (this.imageSizeLimitSelect) {
            this.imageSizeLimitChangeHandler = function(e) {
                self.imageSizeLimit = parseInt(e.target.value);
                if (self.onSettingsChange) {
                    self.onSettingsChange();
                }
            };
            this.imageSizeLimitSelect.addEventListener('change', this.imageSizeLimitChangeHandler);
        }

        if (this.enableBase64DetailCheckbox) {
            this.enableBase64DetailChangeHandler = function(e) {
                self.enableBase64Detail = e.target.checked;
                if (self.onSettingsChange) {
                    self.onSettingsChange();
                }
            };
            this.enableBase64DetailCheckbox.addEventListener('change', this.enableBase64DetailChangeHandler);
        }
    };





    /**
     * 獲取圖片數據
     */
    ImageHandler.prototype.getImages = function() {
        return this.fileUploadManager.getFiles();
    };

    /**
     * 清空所有圖片
     */
    ImageHandler.prototype.clearImages = function() {
        this.fileUploadManager.clearFiles();
    };

    /**
     * 重新初始化（用於佈局模式切換）
     */
    ImageHandler.prototype.reinitialize = function(layoutMode) {
        console.log('🔄 重新初始化圖片處理功能...');

        this.layoutMode = layoutMode;

        // 重新初始化設定元素
        this.initImageSettingsElements();

        console.log('✅ 圖片處理功能重新初始化完成');
    };

    /**
     * 更新設定
     */
    ImageHandler.prototype.updateSettings = function(settings) {
        this.imageSizeLimit = settings.imageSizeLimit || 0;
        this.enableBase64Detail = settings.enableBase64Detail || false;

        // 更新檔案上傳管理器設定
        this.fileUploadManager.updateSettings({
            imageSizeLimit: this.imageSizeLimit,
            enableBase64Detail: this.enableBase64Detail
        });

        // 同步到 UI 元素
        if (this.imageSizeLimitSelect) {
            this.imageSizeLimitSelect.value = this.imageSizeLimit.toString();
        }
        if (this.enableBase64DetailCheckbox) {
            this.enableBase64DetailCheckbox.checked = this.enableBase64Detail;
        }
    };

    /**
     * 清理資源
     */
    ImageHandler.prototype.cleanup = function() {
        this.removeImageSettingsListeners();
        this.fileUploadManager.cleanup();
    };

    // 將 ImageHandler 加入命名空間
    window.MCPFeedback.ImageHandler = ImageHandler;

    console.log('✅ ImageHandler 模組載入完成');

})();
