// Iframe detection and handling
(function() {
    'use strict';
    
    // Check if running in iframe
    const isInIframe = window.self !== window.top;
    
    if (isInIframe) {
        console.log('[IFRAME] Running in iframe mode');
        
        // Notify parent window that iframe is ready
        try {
            window.parent.postMessage({
                type: 'iframe-ready',
                url: window.location.href,
                timestamp: Date.now()
            }, '*');
        } catch (e) {
            console.log('[IFRAME] Could not notify parent window:', e.message);
        }
        
        // Handle messages from parent window
        window.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'iframe-action') {
                console.log('[IFRAME] Received action from parent:', event.data);
                // Handle specific actions from parent if needed
            }
        });
        
        // Add iframe-specific CSS class
        document.body.classList.add('iframe-mode');
        
        // Adjust viewport for iframe
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
        }
    }
})();

// Constants
const CONSTANTS = {
    DELIVERY_FEE: 50,
    AUTO_DISMISS_TIME: 5000,
    MIN_QUANTITY: 1,
    DEBOUNCE_DELAY: 300,
    SELECTORS: {
        CART_COUNTER: '.CartCounter',
        ADD_TO_CART_BTN: '.add-to-cart-btn',
        QUANTITY_INPUT: '.quantity-input',
        QUANTITY_CONTROLS: '.qty',
        TAB_BUTTONS: '.tab-btn',
        TAB_CONTENTS: '.tab-content'
    }
};

// XSS Protection Utility
class XSSProtection {
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static sanitizeHtml(html) {
        // Basic HTML sanitization - only allow safe tags
        const allowedTags = ['b', 'i', 'em', 'strong', 'span', 'div', 'p'];
        const allowedAttributes = ['class', 'id', 'style'];
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Remove script tags and event handlers
        const scripts = tempDiv.querySelectorAll('script');
        scripts.forEach(script => script.remove());
        
        // Remove all elements except allowed ones
        const allElements = tempDiv.querySelectorAll('*');
        allElements.forEach(element => {
            if (!allowedTags.includes(element.tagName.toLowerCase())) {
                element.outerHTML = element.textContent;
            } else {
                // Remove disallowed attributes
                const attributes = Array.from(element.attributes);
                attributes.forEach(attr => {
                    if (!allowedAttributes.includes(attr.name) || 
                        attr.name.startsWith('on') || 
                        attr.value.includes('javascript:')) {
                        element.removeAttribute(attr.name);
                    }
                });
            }
        });
        
        return tempDiv.innerHTML;
    }
}

// Centralized State Management
class AppState {
    constructor() {
        this.state = {
            cart: {
                items: [],
                totalAmount: 0,
                itemCount: 0
            },
            user: {
                isLoggedIn: false,
                userId: null
            },
            ui: {
                isLoading: false,
                theme: 'light'
            }
        };
        this.listeners = new Map();
        this.pendingOperations = new Map();
    }

    // Subscribe to state changes
    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }
        this.listeners.get(key).add(callback);
        
        // Return unsubscribe function
        return () => {
            const callbacks = this.listeners.get(key);
            if (callbacks) {
                callbacks.delete(callback);
            }
        };
    }

    // Notify listeners of state changes
    notify(key) {
        const callbacks = this.listeners.get(key);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(this.state[key]);
                } catch (error) {
                    console.error('State listener error:', error);
                }
            });
        }
    }

    // Update state safely
    update(key, newValue) {
        this.state[key] = { ...this.state[key], ...newValue };
        this.notify(key);
    }

    // Get state safely
    get(key) {
        return this.state[key];
    }

    // Check if operation is pending
    isOperationPending(operationId) {
        return this.pendingOperations.has(operationId);
    }

    // Set operation as pending
    setOperationPending(operationId, promise) {
        this.pendingOperations.set(operationId, promise);
        promise.finally(() => {
            this.pendingOperations.delete(operationId);
        });
    }
}

// Global state instance
const appState = new AppState();

// Debounce Utility
class DebounceManager {
    constructor() {
        this.timeouts = new Map();
    }

    debounce(key, func, delay = CONSTANTS.DEBOUNCE_DELAY) {
        // Clear existing timeout
        if (this.timeouts.has(key)) {
            clearTimeout(this.timeouts.get(key));
        }

        // Set new timeout
        const timeoutId = setTimeout(() => {
            func();
            this.timeouts.delete(key);
        }, delay);

        this.timeouts.set(key, timeoutId);
    }

    cancel(key) {
        if (this.timeouts.has(key)) {
            clearTimeout(this.timeouts.get(key));
            this.timeouts.delete(key);
        }
    }
}

// Global debounce manager
const debounceManager = new DebounceManager();

// API Service for cart operations
class CartAPI {
    static async makeRequest(url, options = {}) {
        const defaultOptions = {
            // Always send cookies on same-origin so session-based cart works
            credentials: 'same-origin',
            // Prevent any caching of API responses used for UI state
            cache: 'no-store',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        };

        try {
            const response = await fetch(url, { ...defaultOptions, ...options });
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }
            
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getCart() {
        // Add cache buster to always get fresh cart payload
        const ts = Date.now();
        return await this.makeRequest(`/cart?ts=${ts}`, { method: 'GET' });
    }

    static async addToCart(productId, quantity) {
        return await this.makeRequest('/cart/add', {
            method: 'POST',
            body: JSON.stringify({ productId, quantity })
        });
    }

    static async updateCart(productId, quantity) {
        return await this.makeRequest('/cart/update', {
            method: 'PUT',
            body: JSON.stringify({ productId, quantity })
        });
    }

    static async removeFromCart(productId) {
        return await this.makeRequest(`/cart/remove/${productId}`, {
            method: 'DELETE'
        });
    }
}

// Utility functions
const Utils = {
    formatPrice(price) {
        return `$${parseFloat(price).toFixed(2)}`;
    },

    parseInteger(value, defaultValue = 0) {
        const parsed = parseInt(value);
        return isNaN(parsed) ? defaultValue : parsed;
    },

    validateQuantity(quantity, stockLimit) {
        const qty = this.parseInteger(quantity, CONSTANTS.MIN_QUANTITY);
        return Math.max(CONSTANTS.MIN_QUANTITY, Math.min(qty, stockLimit));
    },

    generateOperationId(operation, productId) {
        return `${operation}_${productId}_${Date.now()}`;
    }
};

// UI Manager for DOM manipulations and user feedback
class UIManager {
    static showMessage(message, type = 'info') {
        // Sanitize message to prevent XSS
        const sanitizedMessage = XSSProtection.escapeHtml(message);
        
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${sanitizedMessage}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        document.body.insertBefore(alertDiv, document.body.firstChild);
        
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, CONSTANTS.AUTO_DISMISS_TIME);
    }

    static setLoadingState(element, isLoading, loadingText = 'Loading...') {
        if (!element) return;

        if (isLoading) {
            element.dataset.originalContent = element.innerHTML;
            element.disabled = true;
            element.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${XSSProtection.escapeHtml(loadingText)}`;
        } else {
            element.disabled = false;
            element.innerHTML = element.dataset.originalContent || '';
        }
    }

    static setInputLoadingState(input, isLoading) {
        if (!input) return;
        
        if (isLoading) {
            input.dataset.originalValue = input.value;
            input.disabled = true;
            input.style.opacity = '0.6';
        } else {
            input.disabled = false;
            input.style.opacity = '1';
            delete input.dataset.originalValue;
        }
    }

    static updateItemTotal(productId, total) {
        const itemElement = document.querySelector(`.cartitem .qty[data-product-id="${productId}"]`)?.closest('.cartitem');
        if (itemElement) {
            const totalElement = itemElement.querySelector('.totalprice');
            if (totalElement) {
                totalElement.textContent = `$${parseFloat(total).toFixed(2)}`;
            }
        }
    }

    static updateCartTotals(cart) {
        if (!cart) return;
        
        // Update subtotal
        const subtotalElement = document.querySelector('.subtotal');
        if (subtotalElement) {
            subtotalElement.textContent = `$${parseFloat(cart.totalAmount).toFixed(2)}`;
        }
        
        // Update grand total
        const grandTotalElement = document.querySelector('.grandtotal');
        if (grandTotalElement) {
            const grandTotal = parseFloat(cart.totalAmount) + 50; // 50 is delivery fee
            grandTotalElement.textContent = `$${grandTotal.toFixed(2)}`;
        }
    }

    static updateCartCounter(cartData) {
        const counter = document.querySelector(CONSTANTS.SELECTORS.CART_COUNTER);
        if (!counter) return;

        const totalQuantity = cartData.items ? 
            cartData.items.reduce((sum, item) => sum + item.quantity, 0) : 0;

        if (totalQuantity > 0) {
            counter.textContent = totalQuantity.toString();
            counter.style.display = 'block';
        } else {
            counter.textContent = '';
            counter.style.display = 'none';
        }
    }

    static updateCartTotals(cartData) {
        const elements = {
            subtotal: document.querySelector('.subtotal'),
            grandTotal: document.querySelector('.grandtotal')
        };

        if (elements.subtotal) {
            elements.subtotal.textContent = Utils.formatPrice(cartData.totalAmount);
        }

        if (elements.grandTotal) {
            const grandTotal = cartData.totalAmount + CONSTANTS.DELIVERY_FEE;
            elements.grandTotal.textContent = Utils.formatPrice(grandTotal);
        }
    }

    static updateItemTotal(productId, total) {
        const cartItem = document.querySelector(`input[data-product-id="${productId}"]`)?.closest('.cartitem');
        if (!cartItem) return;

        const totalElement = cartItem.querySelector('.totalprice');
        if (totalElement) {
            totalElement.textContent = Utils.formatPrice(total);
        }
    }
}

// Cart Manager - main cart functionality with race condition prevention
class CartManager {
    static async updateCartCounter() {
        const result = await CartAPI.getCart();
        if (result.success) {
            appState.update('cart', result.data);
        } else {
            console.error('Error updating cart counter:', result.error);
        }
    }

    static async addToCart(productId, quantity = 1) {
        const operationId = Utils.generateOperationId('add', productId);
        
        // Prevent concurrent operations
        if (appState.isOperationPending(operationId)) {
            console.log('Add to cart operation already in progress');
            return;
        }

        const button = document.querySelector(`[data-product-id="${productId}"]`);
        UIManager.setLoadingState(button, true, 'Adding...');

        const operation = this.performAddToCart(productId, quantity, button);
        appState.setOperationPending(operationId, operation);
        
        return operation;
    }

    static async performAddToCart(productId, quantity, button) {
        try {
            const result = await CartAPI.addToCart(productId, quantity);
            
            if (result.success) {
                UIManager.showMessage('Item added to cart successfully!', 'success');
                
                // Scroll to cart icon after successful addition
                this.scrollToCartIcon();
                
                // Prefer using the server's updated cart payload directly to avoid any race
                const updatedCart = (result.data && (result.data.data || result.data.cart)) || null;
                if (updatedCart) {
                    appState.update('cart', updatedCart);
                } else {
                    await this.updateCartCounter();
                }
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            UIManager.showMessage(error.message || 'Error adding item to cart', 'danger');
        } finally {
            UIManager.setLoadingState(button, false);
        }
    }

    static async updateQuantity(productId, quantity) {
        const operationId = Utils.generateOperationId('update', productId);
        
        // Prevent concurrent operations
        if (appState.isOperationPending(operationId)) {
            console.log('Update quantity operation already in progress');
            return;
        }

        const input = document.querySelector(`input[data-product-id="${productId}"]`);
        UIManager.setInputLoadingState(input, true);

        const operation = this.performUpdateQuantity(productId, quantity, input);
        appState.setOperationPending(operationId, operation);
        
        return operation;
    }

    static async performUpdateQuantity(productId, quantity, input) {
        try {
            const result = await CartAPI.updateCart(productId, quantity);
            
            if (result.success && result.data.cart) {
                const updatedItem = result.data.cart.items.find(item => 
                    item.product._id === productId || item.product === productId
                );

                if (updatedItem) {
                    UIManager.updateItemTotal(productId, updatedItem.total);
                    UIManager.updateCartTotals(result.data.cart);
                    await this.updateCartCounter();
                }
            } else {
                throw new Error(result.error || 'Failed to update quantity');
            }
        } catch (error) {
            UIManager.showMessage(error.message || 'Error updating quantity', 'danger');
            if (input && input.dataset.originalValue) {
                input.value = input.dataset.originalValue;
            }
        } finally {
            UIManager.setInputLoadingState(input, false);
        }
    }

    static async removeFromCart(productId) {
        const operationId = Utils.generateOperationId('remove', productId);
        
        // Prevent concurrent operations
        if (appState.isOperationPending(operationId)) {
            console.log('Remove from cart operation already in progress');
            return;
        }

        const operation = this.performRemoveFromCart(productId);
        appState.setOperationPending(operationId, operation);
        
        return operation;
    }

    static async performRemoveFromCart(productId) {
        try {
            const result = await CartAPI.removeFromCart(productId);
            
            if (result.success) {
                window.location.reload();
            } else {
                UIManager.showMessage('Error removing item', 'danger');
            }
        } catch (error) {
            console.error('Error:', error);
            UIManager.showMessage('Error removing item', 'danger');
        }
    }

    // Scroll to cart icon smoothly with highlight effect
    static scrollToCartIcon() {
        const cartIcon = document.querySelector('.fa-cart-shopping');
        if (cartIcon) {
            // Scroll to cart icon with offset for better visibility
            cartIcon.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center',
                inline: 'nearest'
            });
            
            // Add small offset for better positioning
            setTimeout(() => {
                window.scrollBy({
                    top: -50,
                    behavior: 'smooth'
                });
            }, 500);
            
            // Add highlight effect using CSS class
            cartIcon.classList.add('highlight');
            
            // Remove highlight after animation
            setTimeout(() => {
                cartIcon.classList.remove('highlight');
            }, 1000);
        }
    }

    static async updateCartItemQuantity(productId, quantity) {
        const operationId = Utils.generateOperationId('update', productId);
        if (appState.isOperationPending(operationId)) {
            console.log('Update cart item quantity operation already in progress');
            return;
        }

        const input = document.querySelector(`input[data-product-id="${productId}"]`);
        UIManager.setInputLoadingState(input, true);

        const operation = this.performUpdateCartItemQuantity(productId, quantity, input);
        appState.setOperationPending(operationId, operation);
    }

    static async performUpdateCartItemQuantity(productId, quantity, input) {
        try {
            const result = await CartAPI.updateCart(productId, quantity);
            if (result.success && result.data.cart) {
                const updatedItem = result.data.cart.items.find(item => 
                    item.product._id === productId || item.product === productId
                );
                if (updatedItem) {
                    UIManager.updateItemTotal(productId, updatedItem.total);
                    UIManager.updateCartTotals(result.data.cart);
                    await this.updateCartCounter();
                }
            } else {
                throw new Error(result.error || 'Failed to update cart item quantity');
            }
        } catch (error) {
            UIManager.showMessage(error.message || 'Error updating cart item quantity', 'danger');
            if (input && input.dataset.originalValue) {
                input.value = input.dataset.originalValue;
            }
        } finally {
            UIManager.setInputLoadingState(input, false);
        }
    }
}

// Product Details Manager
class ProductDetailsManager {
    static initializeQuantityControls() {
        const quantityInput = document.querySelector(CONSTANTS.SELECTORS.QUANTITY_INPUT);
        if (!quantityInput) return;

        const stockLimit = Utils.parseInteger(quantityInput.dataset.stock, 1);
        const decreaseBtn = document.querySelector('.quantity-btn:first-child');
        const increaseBtn = document.querySelector('.quantity-btn:last-child');

        // Decrease button
        if (decreaseBtn) {
            decreaseBtn.addEventListener('click', () => {
                const currentValue = Utils.parseInteger(quantityInput.value, 1);
                if (currentValue > CONSTANTS.MIN_QUANTITY) {
                    quantityInput.value = currentValue - 1;
                }
            });
        }

        // Increase button
        if (increaseBtn) {
            increaseBtn.addEventListener('click', () => {
                const currentValue = Utils.parseInteger(quantityInput.value, 1);
                if (currentValue < stockLimit) {
                    quantityInput.value = currentValue + 1;
                } else {
                    UIManager.showMessage(`Sorry, only ${stockLimit} items available in stock`, 'warning');
                }
            });
        }

        // Input validation
        const validateInput = () => {
            const value = Utils.validateQuantity(quantityInput.value, stockLimit);
            if (value !== Utils.parseInteger(quantityInput.value)) {
                if (value === stockLimit) {
                    UIManager.showMessage(`Sorry, only ${stockLimit} items available in stock`, 'warning');
                }
                quantityInput.value = value;
            }
        };

        quantityInput.addEventListener('change', validateInput);
        quantityInput.addEventListener('input', validateInput);
    }

    static initializeTabs() {
        const tabButtons = document.querySelectorAll(CONSTANTS.SELECTORS.TAB_BUTTONS);
        const tabContents = document.querySelectorAll(CONSTANTS.SELECTORS.TAB_CONTENTS);

        if (!tabButtons.length || !tabContents.length) return;

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove active class from all
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                // Add active class to current
                button.classList.add('active');
                const tabId = button.getAttribute('data-tab');
                const targetContent = document.getElementById(tabId);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });
    }
}

// Event Handlers Manager
class EventHandlers {
    static initializeCartButtons() {
        const addToCartButtons = document.querySelectorAll(CONSTANTS.SELECTORS.ADD_TO_CART_BTN);
        
        addToCartButtons.forEach(button => {
            // Prevent duplicate bindings across re-renders or repeated initializations
            if (button.dataset.bound === '1') return;
            button.dataset.bound = '1';

            button.addEventListener('click', async function(e) {
                e.preventDefault();
                const productId = this.dataset.productId;
                
                // FIXED: Get the actual quantity from the input field
                const quantityInput = document.querySelector('#quantity');
                const quantity = quantityInput ? 
                    Utils.parseInteger(quantityInput.value, 1) : 1;
                
                // More explicit logging for easier debugging
                console.log('Adding to cart:', 'productId=', productId, 'quantity=', quantity);
                
                // Scroll to cart icon after adding to cart
                await CartManager.addToCart(productId, quantity);
                
                // Scroll to cart icon with highlight effect
                CartManager.scrollToCartIcon();
            });
        });
    }

    static initializeQuantityInputs() {
        const quantityInputs = document.querySelectorAll(CONSTANTS.SELECTORS.QUANTITY_CONTROLS);
        
        quantityInputs.forEach(input => {
            const debouncedUpdate = debounceManager.debounce.bind(
                debounceManager, 
                `quantity_${input.dataset.productId}`,
                () => {
                    const productId = input.dataset.productId;
                    const stockLimit = Utils.parseInteger(input.dataset.stock, 1);
                    const quantity = Utils.validateQuantity(input.value, stockLimit);

                    if (quantity !== Utils.parseInteger(input.value)) {
                        if (quantity === stockLimit) {
                            UIManager.showMessage(`Sorry, only ${stockLimit} items available in stock`, 'warning');
                        }
                        input.value = quantity;
                    }

                    CartManager.updateQuantity(productId, quantity);
                },
                CONSTANTS.DEBOUNCE_DELAY
            );

            input.addEventListener('change', debouncedUpdate);

            // Prevent invalid input during typing
            input.addEventListener('input', function() {
                const stockLimit = Utils.parseInteger(this.dataset.stock, 1);
                const value = Utils.parseInteger(this.value);
                if (value > stockLimit) {
                    this.value = stockLimit;
                }
            });
        });
    }

    static initializeProductDetailsAddToCart() {
        const addToCartBtn = document.querySelector('.add-to-cart');
        if (!addToCartBtn) return;

        addToCartBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            
            const productId = this.getAttribute('data-product-id');
            const quantityInput = document.querySelector(CONSTANTS.SELECTORS.QUANTITY_INPUT);
            const quantity = quantityInput ? Utils.parseInteger(quantityInput.value, 1) : 1;

            await CartManager.addToCart(productId, quantity);
        });
    }

    static initializeBuyNowButton() {
        const buyNowBtn = document.querySelector('.buy-now-btn');
        if (!buyNowBtn) return;

        buyNowBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            
            const productId = this.dataset.productId;
            const quantityInput = document.querySelector('#quantity');
            const quantity = quantityInput ? Utils.parseInteger(quantityInput.value, 1) : 1;

            // Show loading state
            UIManager.setLoadingState(this, true, 'Processing...');

            try {
                // Add item to cart first
                const result = await CartAPI.addToCart(productId, quantity);
                
                if (result.success) {
                    // Scroll to cart icon briefly before redirecting
                    CartManager.scrollToCartIcon();
                    
                    // Small delay to show the scroll effect before redirecting
                    setTimeout(() => {
                        window.location.href = '/order/checkout';
                    }, 800);
                } else {
                    throw new Error(result.error || 'Failed to process buy now request');
                }
            } catch (error) {
                UIManager.showMessage(error.message || 'Error processing buy now request', 'danger');
                UIManager.setLoadingState(this, false);
            }
        });
    }

    static initializeQuantityControls() {
        // Handle quantity button clicks
        document.addEventListener('click', function(e) {
            if (e.target.closest('.quantity-btn')) {
                const button = e.target.closest('.quantity-btn');
                const action = button.dataset.action;
                const productId = button.dataset.productId;
                const input = button.parentElement.querySelector('.quantity-input, .qty');
                
                if (!input) return;
                
                let currentValue = parseInt(input.value) || 1;
                const min = parseInt(input.min) || 1;
                const max = parseInt(input.max) || 99;
                
                if (action === 'increase') {
                    currentValue = Math.min(currentValue + 1, max);
                } else if (action === 'decrease') {
                    currentValue = Math.max(currentValue - 1, min);
                }
                
                input.value = currentValue;
                
                // If this is in the cart, update the cart
                if (input.classList.contains('qty') && productId) {
                    CartManager.updateCartItemQuantity(productId, currentValue);
                }
                
                // Trigger input event for any listeners
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
        
        // Handle quantity input changes
        document.addEventListener('input', function(e) {
            if (e.target.classList.contains('quantity-input') || e.target.classList.contains('qty')) {
                const input = e.target;
                let value = parseInt(input.value) || 1;
                const min = parseInt(input.min) || 1;
                const max = parseInt(input.max) || 99;
                
                // Ensure value is within bounds
                value = Math.max(min, Math.min(value, max));
                input.value = value;
                
                // If this is in the cart, update the cart
                if (input.classList.contains('qty') && input.dataset.productId) {
                    CartManager.updateCartItemQuantity(input.dataset.productId, value);
                }
            }
        });
    }
}

// Bootstrap Manager
class BootstrapManager {
    static initializeTooltips() {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }

    static initializeDropdowns() {
        // Fix dropdown positioning for profile dropdown
        const profileDropdown = document.querySelector('.navbar-nav .dropdown:last-child');
        if (profileDropdown) {
            const dropdownMenu = profileDropdown.querySelector('.dropdown-menu');
            if (dropdownMenu) {
                // Ensure dropdown opens to the left if it would go outside viewport
                profileDropdown.addEventListener('show.bs.dropdown', function() {
                    const rect = dropdownMenu.getBoundingClientRect();
                    const viewportWidth = window.innerWidth;
                    
                    if (rect.right > viewportWidth) {
                        dropdownMenu.style.left = 'auto';
                        dropdownMenu.style.right = '0';
                    }
                });
            }
        }
    }
}

// Theme Manager
class ThemeManager {
    static init() {
        const themeToggle = document.getElementById('themeToggle');
        if (!themeToggle) return; // Exit if themeToggle doesn't exist
        
        const themeIcon = themeToggle.querySelector('i');
        
        // Check for saved theme preference
        const savedTheme = localStorage.getItem('theme') || 'light';
        appState.update('ui', { theme: savedTheme });
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(themeIcon, savedTheme);

        // Add click event listener
        themeToggle.addEventListener('click', () => {
            const currentTheme = appState.get('ui').theme;
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            appState.update('ui', { theme: newTheme });
            this.updateThemeIcon(themeIcon, newTheme);
        });
    }

    static updateThemeIcon(icon, theme) {
        if (icon) {
            icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }
}

// Main Application
class ECommerceApp {
    static async initialize() {
        // Initialize Bootstrap components
        BootstrapManager.initializeTooltips();
        BootstrapManager.initializeDropdowns();

        // Initialize cart functionality
        EventHandlers.initializeCartButtons();
        EventHandlers.initializeQuantityInputs();
        EventHandlers.initializeProductDetailsAddToCart();
        EventHandlers.initializeBuyNowButton(); // Initialize buy now button
        EventHandlers.initializeQuantityControls(); // Initialize quantity controls

        // Initialize product details tabs
        ProductDetailsManager.initializeTabs();

        // Subscribe to cart state changes
        appState.subscribe('cart', (cartData) => {
            UIManager.updateCartCounter(cartData);
        });

        // Update cart counter on page load
        await CartManager.updateCartCounter();

        // Check if user just logged in (look for login success message)
        const urlParams = new URLSearchParams(window.location.search);
        const message = urlParams.get('message');
        if (message && message.includes('Login successful')) {
            // Force cart counter update after login
            setTimeout(async () => {
                await CartManager.updateCartCounter();
            }, 1000);
        }

        // Make removeFromCart globally available for legacy compatibility
        window.removeFromCart = (productId) => CartManager.removeFromCart(productId);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    ECommerceApp.initialize();
    ThemeManager.init();

    // Handle Contact Us link click
    const contactLink = document.querySelector('a[href="#contact"]');
    if (contactLink) {
        contactLink.addEventListener('click', function(e) {
            e.preventDefault();
            const footer = document.getElementById('contact');
            if (footer) {
                footer.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    // Search form handling
    const searchForm = document.querySelector('form[role="search"]');
    const searchInput = document.getElementById('search');
    
    if (searchForm && searchInput) {
        searchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (query) {
                // Sanitize search query
                const sanitizedQuery = XSSProtection.escapeHtml(query);
                window.location.href = `/products/search?q=${encodeURIComponent(sanitizedQuery)}`;
            }
        });
    }

    // Smooth scroll functionality
    const scrollLinks = document.querySelectorAll('a[href^="#"]');
    
    scrollLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            
            // If href is just "#", do nothing to allow default anchor behavior
            // or Bootstrap dropdowns to work.
            if (targetId === '#') {
                return;
            }
            
            e.preventDefault();
            
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});