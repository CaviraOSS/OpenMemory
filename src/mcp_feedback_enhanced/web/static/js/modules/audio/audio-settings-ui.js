/**
 * MCP Feedback Enhanced - 音效設定 UI 模組
 * ======================================
 * 
 * 處理音效通知設定的使用者介面
 * 參考 prompt-settings-ui.js 的設計模式
 */

(function() {
    'use strict';

    // 確保命名空間存在
    window.MCPFeedback = window.MCPFeedback || {};
    const Utils = window.MCPFeedback.Utils;

    /**
     * 音效設定 UI 建構函數
     */
    function AudioSettingsUI(options) {
        options = options || {};
        
        // 容器元素
        this.container = options.container || null;
        
        // 音效管理器引用
        this.audioManager = options.audioManager || null;
        
        // i18n 翻譯函數
        this.t = options.t || function(key, defaultValue) { return defaultValue || key; };
        
        // UI 元素引用
        this.enabledToggle = null;
        this.volumeSlider = null;
        this.volumeValue = null;
        this.audioSelect = null;
        this.testButton = null;
        this.uploadButton = null;
        this.uploadInput = null;
        this.audioList = null;
        
        console.log('🎨 AudioSettingsUI 初始化完成');
    }

    /**
     * 初始化 UI
     */
    AudioSettingsUI.prototype.initialize = function() {
        if (!this.container) {
            console.error('❌ AudioSettingsUI 容器未設定');
            return;
        }

        if (!this.audioManager) {
            console.error('❌ AudioManager 未設定');
            return;
        }

        this.createUI();
        this.setupEventListeners();
        this.refreshUI();

        // 主動應用翻譯到新創建的元素
        this.applyInitialTranslations();

        console.log('✅ AudioSettingsUI 初始化完成');
    };

    /**
     * 創建 UI 結構
     */
    AudioSettingsUI.prototype.createUI = function() {
        const html = `
            <div class="settings-card">
                <div class="settings-card-header">
                    <h3 class="settings-card-title" data-i18n="audio.notification.title">
                        🔊 音效通知設定
                    </h3>
                </div>
                <div class="settings-card-body">
                    <div class="audio-management-description" data-i18n="audio.notification.description">
                        設定會話更新時的音效通知
                    </div>
                    
                    <div class="audio-settings-controls">
                    <!-- 啟用開關 -->
                    <div class="setting-item">
                        <div class="setting-info">
                            <div class="setting-label" data-i18n="audio.notification.enabled"></div>
                            <div class="setting-description" data-i18n="audio.notification.enabledDesc"></div>
                        </div>
                        <div class="setting-control">
                            <button type="button" id="audioNotificationEnabled" class="toggle-btn" data-i18n-aria-label="aria.toggleAudioNotification">
                                <span class="toggle-slider"></span>
                            </button>
                        </div>
                    </div>
                    
                    <!-- 音量控制 -->
                    <div class="audio-setting-item">
                        <label class="audio-setting-label" data-i18n="audio.notification.volume">音量</label>
                        <div class="audio-volume-control">
                            <input type="range" id="audioVolumeSlider" class="audio-volume-slider" 
                                   min="0" max="100" value="50">
                            <span id="audioVolumeValue" class="audio-volume-value">50%</span>
                        </div>
                    </div>
                    
                    <!-- 音效選擇 -->
                    <div class="audio-setting-item">
                        <label class="audio-setting-label" data-i18n="audio.notification.selectAudio">選擇音效</label>
                        <div class="audio-select-control">
                            <select id="audioSelect" class="audio-select">
                                <!-- 選項將動態生成 -->
                            </select>
                            <button type="button" id="audioTestButton" class="btn btn-secondary audio-test-btn">
                                <span data-i18n="audio.notification.testPlay">測試播放</span>
                            </button>
                        </div>
                    </div>
                    
                    <!-- 自訂音效上傳 -->
                    <div class="audio-setting-item">
                        <label class="audio-setting-label" data-i18n="audio.notification.uploadCustom">上傳自訂音效</label>
                        <div class="audio-upload-control">
                            <input type="file" id="audioUploadInput" class="audio-upload-input" 
                                   accept="audio/mp3,audio/wav,audio/ogg" style="display: none;">
                            <button type="button" id="audioUploadButton" class="btn btn-primary audio-upload-btn">
                                📁 <span data-i18n="audio.notification.chooseFile">選擇檔案</span>
                            </button>
                            <span class="audio-upload-hint" data-i18n="audio.notification.supportedFormats">
                                支援 MP3、WAV、OGG 格式
                            </span>
                        </div>
                    </div>
                    
                    <!-- 自訂音效列表 -->
                    <div class="audio-setting-item">
                        <label class="audio-setting-label" data-i18n="audio.notification.customAudios">自訂音效</label>
                        <div class="audio-custom-list" id="audioCustomList">
                            <!-- 自訂音效列表將在這裡動態生成 -->
                        </div>
                    </div>
                </div>
                </div>
            </div>
        `;

        this.container.insertAdjacentHTML('beforeend', html);

        // 獲取 UI 元素引用
        this.enabledToggle = this.container.querySelector('#audioNotificationEnabled');
        this.volumeSlider = this.container.querySelector('#audioVolumeSlider');
        this.volumeValue = this.container.querySelector('#audioVolumeValue');
        this.audioSelect = this.container.querySelector('#audioSelect');
        this.testButton = this.container.querySelector('#audioTestButton');
        this.uploadButton = this.container.querySelector('#audioUploadButton');
        this.uploadInput = this.container.querySelector('#audioUploadInput');
        this.audioList = this.container.querySelector('#audioCustomList');
    };

    /**
     * 設置事件監聽器
     */
    AudioSettingsUI.prototype.setupEventListeners = function() {
        const self = this;

        // 啟用開關事件
        if (this.enabledToggle) {
            this.enabledToggle.addEventListener('click', function() {
                const newValue = !self.enabledToggle.classList.contains('active');
                self.handleEnabledChange(newValue);
            });
        }

        // 音量滑桿事件
        if (this.volumeSlider) {
            this.volumeSlider.addEventListener('input', function(e) {
                self.handleVolumeChange(parseInt(e.target.value));
            });
        }

        // 音效選擇事件
        if (this.audioSelect) {
            this.audioSelect.addEventListener('change', function(e) {
                self.handleAudioSelect(e.target.value);
            });
        }

        // 測試播放事件
        if (this.testButton) {
            this.testButton.addEventListener('click', function() {
                self.handleTestPlay();
            });
        }

        // 上傳按鈕事件
        if (this.uploadButton) {
            this.uploadButton.addEventListener('click', function() {
                self.uploadInput.click();
            });
        }

        // 檔案上傳事件
        if (this.uploadInput) {
            this.uploadInput.addEventListener('change', function(e) {
                self.handleFileUpload(e.target.files[0]);
            });
        }

        // 設置音效管理器回調
        if (this.audioManager) {
            this.audioManager.onSettingsChange = function(settings) {
                console.log('🎨 音效設定變更，重新渲染 UI');
                self.refreshUI();
            };
        }

        // 語言變更將由 i18n.js 直接調用 updateAudioSelectTranslations 方法
    };

    /**
     * 處理啟用狀態變更
     */
    AudioSettingsUI.prototype.handleEnabledChange = function(enabled) {
        try {
            this.audioManager.setEnabled(enabled);
            this.updateControlsState();
            this.showSuccess(this.t('audio.notification.enabledChanged', '音效通知設定已更新'));
        } catch (error) {
            console.error('❌ 設定啟用狀態失敗:', error);
            this.showError(error.message);
            // 恢復原狀態
            this.enabledToggle.classList.toggle('active', this.audioManager.getSettings().enabled);
        }
    };

    /**
     * 處理音量變更
     */
    AudioSettingsUI.prototype.handleVolumeChange = function(volume) {
        try {
            this.audioManager.setVolume(volume);
            this.volumeValue.textContent = volume + '%';
        } catch (error) {
            console.error('❌ 設定音量失敗:', error);
            this.showError(error.message);
        }
    };

    /**
     * 處理音效選擇
     */
    AudioSettingsUI.prototype.handleAudioSelect = function(audioId) {
        try {
            this.audioManager.setSelectedAudio(audioId);
            this.showSuccess(this.t('audio.notification.audioSelected', '音效已選擇'));
        } catch (error) {
            console.error('❌ 選擇音效失敗:', error);
            this.showError(error.message);
            // 恢復原選擇
            this.audioSelect.value = this.audioManager.getSettings().selectedAudioId;
        }
    };

    /**
     * 處理測試播放
     */
    AudioSettingsUI.prototype.handleTestPlay = function() {
        try {
            const selectedAudioId = this.audioSelect.value;
            const audioData = this.audioManager.getAudioById(selectedAudioId);
            
            if (audioData) {
                this.audioManager.playAudio(audioData);
                this.showSuccess(this.t('audio.notification.testPlaying', '正在播放測試音效'));
            } else {
                this.showError(this.t('audio.notification.audioNotFound', '找不到選擇的音效'));
            }
        } catch (error) {
            console.error('❌ 測試播放失敗:', error);
            this.showError(error.message);
        }
    };

    /**
     * 處理檔案上傳
     */
    AudioSettingsUI.prototype.handleFileUpload = function(file) {
        if (!file) return;

        // 生成預設檔案名稱（去除副檔名）
        const defaultName = file.name.replace(/\.[^/.]+$/, '');

        // 顯示美觀的名稱輸入模態框
        this.showAudioNameModal(defaultName, (audioName) => {
            if (!audioName || !audioName.trim()) {
                this.showError(this.t('audio.notification.nameRequired', '音效名稱不能為空'));
                return;
            }

            // 顯示上傳中狀態
            this.uploadButton.disabled = true;
            this.uploadButton.innerHTML = '⏳ <span data-i18n="audio.notification.uploading">上傳中...</span>';

            this.audioManager.addCustomAudio(audioName.trim(), file)
                .then(audioData => {
                    this.showSuccess(this.t('audio.notification.uploadSuccess', '音效上傳成功: ') + audioData.name);
                    this.refreshAudioSelect();
                    this.refreshCustomAudioList();
                    // 清空檔案輸入
                    this.uploadInput.value = '';
                })
                .catch(error => {
                    console.error('❌ 上傳音效失敗:', error);
                    this.showError(error.message);
                })
                .finally(() => {
                    // 恢復按鈕狀態
                    this.uploadButton.disabled = false;
                    this.uploadButton.innerHTML = '📁 <span data-i18n="audio.notification.chooseFile">選擇檔案</span>';
                });
        });
    };

    /**
     * 處理刪除自訂音效
     */
    AudioSettingsUI.prototype.handleDeleteCustomAudio = function(audioId) {
        const audioData = this.audioManager.getAudioById(audioId);
        if (!audioData) return;

        const confirmMessage = this.t('audio.notification.deleteConfirm', '確定要刪除音效 "{name}" 嗎？')
            .replace('{name}', audioData.name);
        
        if (!confirm(confirmMessage)) return;

        try {
            this.audioManager.removeCustomAudio(audioId);
            this.showSuccess(this.t('audio.notification.deleteSuccess', '音效已刪除'));
            this.refreshAudioSelect();
            this.refreshCustomAudioList();
        } catch (error) {
            console.error('❌ 刪除音效失敗:', error);
            this.showError(error.message);
        }
    };

    /**
     * 刷新整個 UI
     */
    AudioSettingsUI.prototype.refreshUI = function() {
        const settings = this.audioManager.getSettings();
        
        // 更新啟用狀態
        if (this.enabledToggle) {
            this.enabledToggle.classList.toggle('active', settings.enabled);
        }
        
        // 更新音量
        if (this.volumeSlider && this.volumeValue) {
            this.volumeSlider.value = settings.volume;
            this.volumeValue.textContent = settings.volume + '%';
        }
        
        // 更新音效選擇
        this.refreshAudioSelect();
        
        // 更新自訂音效列表
        this.refreshCustomAudioList();
        
        // 更新控制項狀態
        this.updateControlsState();
    };

    /**
     * 刷新音效選擇下拉選單
     */
    AudioSettingsUI.prototype.refreshAudioSelect = function() {
        if (!this.audioSelect) return;

        const settings = this.audioManager.getSettings();
        const allAudios = this.audioManager.getAllAudios();
        
        // 清空現有選項
        this.audioSelect.innerHTML = '';
        
        // 新增音效選項
        allAudios.forEach(audio => {
            const option = document.createElement('option');
            option.value = audio.id;

            // 使用翻譯後的名稱
            let displayName = audio.name;
            if (audio.isDefault) {
                // 為預設音效提供翻譯
                const translationKey = this.getDefaultAudioTranslationKey(audio.id);
                if (translationKey) {
                    displayName = this.t(translationKey, audio.name);
                }
                displayName += ' (' + this.t('audio.notification.default', '預設') + ')';
            }

            option.textContent = displayName;

            // 為預設音效選項新增 data-i18n 屬性，以便語言切換時自動更新
            if (audio.isDefault) {
                const translationKey = this.getDefaultAudioTranslationKey(audio.id);
                if (translationKey) {
                    option.setAttribute('data-audio-id', audio.id);
                    option.setAttribute('data-is-default', 'true');
                    option.setAttribute('data-translation-key', translationKey);
                }
            }

            if (audio.id === settings.selectedAudioId) {
                option.selected = true;
            }
            this.audioSelect.appendChild(option);
        });
    };

    /**
     * 刷新自訂音效列表
     */
    AudioSettingsUI.prototype.refreshCustomAudioList = function() {
        if (!this.audioList) return;

        const customAudios = this.audioManager.getSettings().customAudios;
        
        if (customAudios.length === 0) {
            this.audioList.innerHTML = `
                <div class="audio-empty-state">
                    <div style="font-size: 32px; margin-bottom: 8px;">🎵</div>
                    <div data-i18n="audio.notification.noCustomAudios">尚未上傳任何自訂音效</div>
                </div>
            `;
            return;
        }

        let html = '';
        customAudios.forEach(audio => {
            html += this.createCustomAudioItemHTML(audio);
        });
        
        this.audioList.innerHTML = html;
        this.setupCustomAudioEvents();
    };

    /**
     * 創建自訂音效項目 HTML
     */
    AudioSettingsUI.prototype.createCustomAudioItemHTML = function(audio) {
        const createdDate = new Date(audio.createdAt).toLocaleDateString();
        
        return `
            <div class="audio-custom-item" data-audio-id="${audio.id}">
                <div class="audio-custom-info">
                    <div class="audio-custom-name">${Utils.escapeHtml(audio.name)}</div>
                    <div class="audio-custom-meta">
                        <span data-i18n="audio.notification.created">建立於</span>: ${createdDate}
                        | <span data-i18n="audio.notification.format">格式</span>: ${audio.mimeType}
                    </div>
                </div>
                <div class="audio-custom-actions">
                    <button type="button" class="btn btn-sm btn-secondary audio-play-btn" 
                            data-audio-id="${audio.id}" title="播放">
                        ▶️
                    </button>
                    <button type="button" class="btn btn-sm btn-danger audio-delete-btn" 
                            data-audio-id="${audio.id}" title="刪除">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    };

    /**
     * 設置自訂音效項目事件
     */
    AudioSettingsUI.prototype.setupCustomAudioEvents = function() {
        const self = this;

        // 播放按鈕事件
        const playButtons = this.audioList.querySelectorAll('.audio-play-btn');
        playButtons.forEach(button => {
            button.addEventListener('click', function() {
                const audioId = button.getAttribute('data-audio-id');
                const audioData = self.audioManager.getAudioById(audioId);
                if (audioData) {
                    self.audioManager.playAudio(audioData);
                }
            });
        });

        // 刪除按鈕事件
        const deleteButtons = this.audioList.querySelectorAll('.audio-delete-btn');
        deleteButtons.forEach(button => {
            button.addEventListener('click', function() {
                const audioId = button.getAttribute('data-audio-id');
                self.handleDeleteCustomAudio(audioId);
            });
        });
    };

    /**
     * 更新控制項狀態
     */
    AudioSettingsUI.prototype.updateControlsState = function() {
        const enabled = this.enabledToggle ? this.enabledToggle.classList.contains('active') : false;
        
        // 根據啟用狀態禁用/啟用控制項
        const controls = [
            this.volumeSlider,
            this.audioSelect,
            this.testButton,
            this.uploadButton
        ];
        
        controls.forEach(control => {
            if (control) {
                control.disabled = !enabled;
            }
        });
    };

    /**
     * 顯示成功訊息
     */
    AudioSettingsUI.prototype.showSuccess = function(message) {
        if (Utils && Utils.showMessage) {
            Utils.showMessage(message, Utils.CONSTANTS.MESSAGE_SUCCESS);
        } else {
            console.log('✅', message);
        }
    };

    /**
     * 顯示錯誤訊息
     */
    AudioSettingsUI.prototype.showError = function(message) {
        if (Utils && Utils.showMessage) {
            Utils.showMessage(message, Utils.CONSTANTS.MESSAGE_ERROR);
        } else {
            console.error('❌', message);
        }
    };

    /**
     * 顯示音效名稱輸入模態框
     */
    AudioSettingsUI.prototype.showAudioNameModal = function(defaultName, onConfirm) {
        const self = this;

        // 創建模態框 HTML
        const modalHTML = `
            <div class="audio-name-modal-overlay" id="audioNameModalOverlay">
                <div class="audio-name-modal">
                    <div class="audio-name-modal-header">
                        <h4 data-i18n="audio.notification.enterAudioName">輸入音效名稱</h4>
                        <button type="button" class="audio-name-modal-close" id="audioNameModalClose">×</button>
                    </div>
                    <div class="audio-name-modal-body">
                        <label for="audioNameInput" data-i18n="audio.notification.audioName">音效名稱:</label>
                        <input type="text" id="audioNameInput" class="audio-name-input"
                               value="${Utils.escapeHtml(defaultName)}"
                               placeholder="${this.t('audio.notification.audioNamePlaceholder', '請輸入音效名稱...')}"
                               maxlength="50">
                        <div class="audio-name-hint" data-i18n="audio.notification.audioNameHint">
                            留空將使用預設檔案名稱
                        </div>
                    </div>
                    <div class="audio-name-modal-footer">
                        <button type="button" class="btn btn-secondary" id="audioNameModalCancel">
                            <span data-i18n="buttons.cancel">取消</span>
                        </button>
                        <button type="button" class="btn btn-primary" id="audioNameModalConfirm">
                            <span data-i18n="buttons.ok">確定</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // 新增模態框到頁面
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // 獲取元素引用
        const overlay = document.getElementById('audioNameModalOverlay');
        const input = document.getElementById('audioNameInput');
        const closeBtn = document.getElementById('audioNameModalClose');
        const cancelBtn = document.getElementById('audioNameModalCancel');
        const confirmBtn = document.getElementById('audioNameModalConfirm');

        // 聚焦輸入框並選中文字
        setTimeout(() => {
            input.focus();
            input.select();
        }, 100);

        // 關閉模態框函數
        const closeModal = () => {
            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        };

        // 確認函數
        const confirm = () => {
            const audioName = input.value.trim() || defaultName;
            closeModal();
            if (onConfirm) {
                onConfirm(audioName);
            }
        };

        // 事件監聽器
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        confirmBtn.addEventListener('click', confirm);

        // 點擊遮罩關閉
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                closeModal();
            }
        });

        // Enter 鍵確認，Escape 鍵取消
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirm();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeModal();
            }
        });
    };



    /**
     * 應用初始翻譯到新創建的元素
     */
    AudioSettingsUI.prototype.applyInitialTranslations = function() {
        if (!this.container) return;

        // 對容器內所有有 data-i18n 屬性的元素應用翻譯
        const elements = this.container.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            if (translation && translation !== key) {
                element.textContent = translation;
            }
        });

        // 對有 data-i18n-placeholder 屬性的元素應用翻譯
        const placeholderElements = this.container.querySelectorAll('[data-i18n-placeholder]');
        placeholderElements.forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            const translation = this.t(key);
            if (translation && translation !== key) {
                element.placeholder = translation;
            }
        });

        // 對有 data-i18n-aria-label 屬性的元素應用翻譯
        const ariaLabelElements = this.container.querySelectorAll('[data-i18n-aria-label]');
        ariaLabelElements.forEach(element => {
            const key = element.getAttribute('data-i18n-aria-label');
            const translation = this.t(key);
            if (translation && translation !== key) {
                element.setAttribute('aria-label', translation);
            }
        });

        console.log('🌐 AudioSettingsUI 初始翻譯已應用');
    };

    /**
     * 更新所有翻譯（包括靜態文字和動態內容）
     */
    AudioSettingsUI.prototype.updateTranslations = function() {
        // 更新所有靜態文字元素
        this.applyInitialTranslations();

        // 更新音效選擇器的翻譯
        this.updateAudioSelectTranslations();

        console.log('🌐 AudioSettingsUI 翻譯已更新');
    };

    /**
     * 更新音效選擇器的翻譯
     */
    AudioSettingsUI.prototype.updateAudioSelectTranslations = function() {
        if (!this.audioSelect) return;

        const options = this.audioSelect.querySelectorAll('option[data-is-default="true"]');
        options.forEach(option => {
            const audioId = option.getAttribute('data-audio-id');
            const translationKey = option.getAttribute('data-translation-key');

            if (audioId && translationKey) {
                const audioData = this.audioManager.getAudioById(audioId);
                if (audioData) {
                    const translatedName = this.t(translationKey, audioData.name);
                    const defaultText = this.t('audio.notification.default', '預設');
                    option.textContent = translatedName + ' (' + defaultText + ')';
                }
            }
        });
    };

    /**
     * 獲取預設音效的翻譯鍵值
     */
    AudioSettingsUI.prototype.getDefaultAudioTranslationKey = function(audioId) {
        const translationMap = {
            'default-beep': 'audio.notification.defaultBeep',
            'notification-ding': 'audio.notification.notificationDing',
            'soft-chime': 'audio.notification.softChime'
        };
        return translationMap[audioId] || null;
    };

    // 匯出到全域命名空間
    window.MCPFeedback.AudioSettingsUI = AudioSettingsUI;

})();
