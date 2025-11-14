/**
 * MCP Feedback Enhanced - DOM 操作工具模組
 * ==========================================
 * 
 * 提供通用的 DOM 操作和元素管理功能
 */

(function() {
    'use strict';

    // 確保命名空間存在
    window.MCPFeedback = window.MCPFeedback || {};
    window.MCPFeedback.Utils = window.MCPFeedback.Utils || {};

    /**
     * DOM 工具類
     */
    const DOMUtils = {
        /**
         * 安全查詢選擇器
         */
        safeQuerySelector: function(selector) {
            try {
                return document.querySelector(selector);
            } catch (error) {
                console.warn('查詢選擇器失敗:', selector, error);
                return null;
            }
        },

        /**
         * 安全查詢所有選擇器
         */
        safeQuerySelectorAll: function(selector) {
            try {
                return document.querySelectorAll(selector);
            } catch (error) {
                console.warn('查詢所有選擇器失敗:', selector, error);
                return [];
            }
        },

        /**
         * 安全設置文本內容
         */
        safeSetTextContent: function(element, text) {
            if (element && typeof element.textContent !== 'undefined') {
                element.textContent = text || '';
                return true;
            }
            return false;
        },

        /**
         * 安全設置 HTML 內容
         */
        safeSetInnerHTML: function(element, html) {
            if (element && typeof element.innerHTML !== 'undefined') {
                element.innerHTML = html || '';
                return true;
            }
            return false;
        },

        /**
         * 安全添加 CSS 類
         */
        safeAddClass: function(element, className) {
            if (element && element.classList && className) {
                element.classList.add(className);
                return true;
            }
            return false;
        },

        /**
         * 安全移除 CSS 類
         */
        safeRemoveClass: function(element, className) {
            if (element && element.classList && className) {
                element.classList.remove(className);
                return true;
            }
            return false;
        },

        /**
         * 安全切換 CSS 類
         */
        safeToggleClass: function(element, className) {
            if (element && element.classList && className) {
                element.classList.toggle(className);
                return true;
            }
            return false;
        },

        /**
         * 檢查元素是否包含指定類
         */
        hasClass: function(element, className) {
            return element && element.classList && element.classList.contains(className);
        },

        /**
         * 創建元素
         */
        createElement: function(tagName, options) {
            options = options || {};
            const element = document.createElement(tagName);

            if (options.className) {
                element.className = options.className;
            }

            if (options.id) {
                element.id = options.id;
            }

            if (options.textContent) {
                element.textContent = options.textContent;
            }

            if (options.innerHTML) {
                element.innerHTML = options.innerHTML;
            }

            if (options.attributes) {
                Object.keys(options.attributes).forEach(function(key) {
                    element.setAttribute(key, options.attributes[key]);
                });
            }

            if (options.styles) {
                Object.keys(options.styles).forEach(function(key) {
                    element.style[key] = options.styles[key];
                });
            }

            return element;
        },

        /**
         * 安全移除元素
         */
        safeRemoveElement: function(element) {
            if (element && element.parentNode) {
                element.parentNode.removeChild(element);
                return true;
            }
            return false;
        },

        /**
         * 清空元素內容
         */
        clearElement: function(element) {
            if (element) {
                while (element.firstChild) {
                    element.removeChild(element.firstChild);
                }
                return true;
            }
            return false;
        },

        /**
         * 顯示元素
         */
        showElement: function(element) {
            if (element) {
                element.style.display = '';
                return true;
            }
            return false;
        },

        /**
         * 隱藏元素
         */
        hideElement: function(element) {
            if (element) {
                element.style.display = 'none';
                return true;
            }
            return false;
        },

        /**
         * 切換元素顯示狀態
         */
        toggleElement: function(element) {
            if (element) {
                const isHidden = element.style.display === 'none' || 
                               window.getComputedStyle(element).display === 'none';
                if (isHidden) {
                    this.showElement(element);
                } else {
                    this.hideElement(element);
                }
                return true;
            }
            return false;
        },

        /**
         * 設置元素屬性
         */
        setAttribute: function(element, name, value) {
            if (element && name) {
                element.setAttribute(name, value);
                return true;
            }
            return false;
        },

        /**
         * 獲取元素屬性
         */
        getAttribute: function(element, name) {
            if (element && name) {
                return element.getAttribute(name);
            }
            return null;
        },

        /**
         * 移除元素屬性
         */
        removeAttribute: function(element, name) {
            if (element && name) {
                element.removeAttribute(name);
                return true;
            }
            return false;
        },

        /**
         * 添加事件監聽器
         */
        addEventListener: function(element, event, handler, options) {
            if (element && event && typeof handler === 'function') {
                element.addEventListener(event, handler, options);
                return true;
            }
            return false;
        },

        /**
         * 移除事件監聽器
         */
        removeEventListener: function(element, event, handler, options) {
            if (element && event && typeof handler === 'function') {
                element.removeEventListener(event, handler, options);
                return true;
            }
            return false;
        },

        /**
         * 獲取元素的邊界矩形
         */
        getBoundingRect: function(element) {
            if (element && typeof element.getBoundingClientRect === 'function') {
                return element.getBoundingClientRect();
            }
            return null;
        },

        /**
         * 檢查元素是否在視窗內
         */
        isElementInViewport: function(element) {
            const rect = this.getBoundingRect(element);
            if (!rect) return false;

            return (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );
        },

        /**
         * 滾動到元素
         */
        scrollToElement: function(element, options) {
            if (element && typeof element.scrollIntoView === 'function') {
                element.scrollIntoView(options || { behavior: 'smooth', block: 'center' });
                return true;
            }
            return false;
        },

        /**
         * 防抖函數 - 延遲執行，在指定時間內重複調用會重置計時器
         * @param {Function} func - 要防抖的函數
         * @param {number} delay - 延遲時間（毫秒）
         * @param {boolean} immediate - 是否立即執行第一次調用
         * @returns {Function} 防抖後的函數
         */
        debounce: function(func, delay, immediate) {
            let timeoutId;
            return function() {
                const context = this;
                const args = arguments;

                const later = function() {
                    timeoutId = null;
                    if (!immediate) {
                        func.apply(context, args);
                    }
                };

                const callNow = immediate && !timeoutId;
                clearTimeout(timeoutId);
                timeoutId = setTimeout(later, delay);

                if (callNow) {
                    func.apply(context, args);
                }
            };
        },

        /**
         * 節流函數 - 限制函數執行頻率，在指定時間內最多執行一次
         * @param {Function} func - 要節流的函數
         * @param {number} limit - 時間間隔（毫秒）
         * @returns {Function} 節流後的函數
         */
        throttle: function(func, limit) {
            let inThrottle;
            return function() {
                const context = this;
                const args = arguments;

                if (!inThrottle) {
                    func.apply(context, args);
                    inThrottle = true;
                    setTimeout(function() {
                        inThrottle = false;
                    }, limit);
                }
            };
        },

        /**
         * 創建帶有防抖的函數包裝器
         * @param {Object} target - 目標對象
         * @param {string} methodName - 方法名稱
         * @param {number} delay - 防抖延遲時間
         * @param {boolean} immediate - 是否立即執行
         * @returns {Function} 原始函數的引用
         */
        wrapWithDebounce: function(target, methodName, delay, immediate) {
            if (!target || typeof target[methodName] !== 'function') {
                console.warn('無法為不存在的方法添加防抖:', methodName);
                return null;
            }

            const originalMethod = target[methodName];
            target[methodName] = this.debounce(originalMethod.bind(target), delay, immediate);
            return originalMethod;
        },

        /**
         * 創建帶有節流的函數包裝器
         * @param {Object} target - 目標對象
         * @param {string} methodName - 方法名稱
         * @param {number} limit - 節流時間間隔
         * @returns {Function} 原始函數的引用
         */
        wrapWithThrottle: function(target, methodName, limit) {
            if (!target || typeof target[methodName] !== 'function') {
                console.warn('無法為不存在的方法添加節流:', methodName);
                return null;
            }

            const originalMethod = target[methodName];
            target[methodName] = this.throttle(originalMethod.bind(target), limit);
            return originalMethod;
        }
    };

    // 將 DOMUtils 加入命名空間
    window.MCPFeedback.DOMUtils = DOMUtils;
    window.MCPFeedback.Utils.DOM = DOMUtils; // 保持向後相容

    console.log('✅ DOMUtils 模組載入完成');

})();
