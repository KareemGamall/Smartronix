// Constants
const CONSTANTS = {
    DELIVERY_FEE: 50,
    AUTO_DISMISS_TIME: 5000,
    MIN_QUANTITY: 1,
    SELECTORS: {
        CART_COUNTER: '.CartCounter',
        ADD_TO_CART_BTN: '.add-to-cart-btn',
        QUANTITY_INPUT: '.quantity-input',
        QUANTITY_CONTROLS: '.qty',
        TAB_BUTTONS: '.tab-btn',
        TAB_CONTENTS: '.tab-content'
    }
};

// API Service for cart operations
class CartAPI {
    static async makeRequest(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
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
        return await this.makeRequest('/cart');
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
    }
};

// UI Manager for DOM manipulations and user feedback
class UIManager {
    static showMessage(message, type = 'info') {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
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
            element.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${loadingText}`;
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
            input.classList.add('loading');
        } else {
            input.disabled = false;
            input.classList.remove('loading');
        }
    }

    static updateCartCounter(cartData) {
        const counter = document.querySelector(CONSTANTS.SELECTORS.CART_COUNTER);
        if (!counter) return;

        const totalQuantity = cartData.items ? 
            cartData.items.reduce((sum, item) => sum + item.quantity, 0) : 0;

        if (totalQuantity > 0) {
            counter.textContent = totalQuantity;
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

// Cart Manager - main cart functionality
class CartManager {
    static async updateCartCounter() {
        const result = await CartAPI.getCart();
        if (result.success) {
            UIManager.updateCartCounter(result.data);
        } else {
            console.error('Error updating cart counter:', result.error);
        }
    }

    static async addToCart(productId, quantity = 1) {
        const button = document.querySelector(`[data-product-id="${productId}"]`);
        UIManager.setLoadingState(button, true, 'Adding...');

        try {
            const result = await CartAPI.addToCart(productId, quantity);
            
            if (result.success) {
                UIManager.showMessage('Item added to cart successfully!', 'success');
                await this.updateCartCounter();
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
        const input = document.querySelector(`input[data-product-id="${productId}"]`);
        UIManager.setInputLoadingState(input, true);

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
            button.addEventListener('click', async function(e) {
                e.preventDefault();
                const productId = this.dataset.productId;
                
                // FIXED: Get the actual quantity from the input field
                const quantityInput = document.querySelector('#quantity');
                const quantity = quantityInput ? 
                    Utils.parseInteger(quantityInput.value, 1) : 1;
                
                console.log('Adding to cart:', { productId, quantity }); // Debug log
                
                // Scroll to nav bar
                const navBar = document.querySelector('nav');
                if (navBar) {
                    navBar.scrollIntoView({ behavior: 'smooth' });
                }
                
                // Open mobile menu if on mobile device
                const isMobile = window.innerWidth <= 992;
                if (isMobile) {
                    const navbarToggler = document.querySelector('.navbar-toggler');
                    const navbarContent = document.getElementById('navbarContent');
                    
                    if (navbarToggler && navbarContent && !navbarContent.classList.contains('show')) {
                        // Trigger the mobile menu to open
                        navbarToggler.click();
                    }
                }
                
                await CartManager.addToCart(productId, quantity);
            });
        });
    }

    static initializeQuantityInputs() {
        const quantityInputs = document.querySelectorAll(CONSTANTS.SELECTORS.QUANTITY_CONTROLS);
        
        quantityInputs.forEach(input => {
            input.addEventListener('change', function() {
                const productId = this.dataset.productId;
                const stockLimit = Utils.parseInteger(this.dataset.stock, 1);
                const quantity = Utils.validateQuantity(this.value, stockLimit);

                if (quantity !== Utils.parseInteger(this.value)) {
                    if (quantity === stockLimit) {
                        UIManager.showMessage(`Sorry, only ${stockLimit} items available in stock`, 'warning');
                    }
                    this.value = quantity;
                }

                CartManager.updateQuantity(productId, quantity);
            });

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
}

// Bootstrap Manager
class BootstrapManager {
    static initializeTooltips() {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
}

// Theme Manager
class ThemeManager {
    static init() {
        const themeToggle = document.getElementById('themeToggle');
        if (!themeToggle) return; // Exit if themeToggle doesn't exist
        
        const themeIcon = themeToggle.querySelector('i');
        
        // Check for saved theme preference
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
            this.updateThemeIcon(themeIcon, savedTheme);
        }

        // Add click event listener
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
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

        // Initialize cart functionality
        EventHandlers.initializeCartButtons();
        EventHandlers.initializeQuantityInputs();
        EventHandlers.initializeProductDetailsAddToCart();

        // Initialize product details
        ProductDetailsManager.initializeQuantityControls();
        ProductDetailsManager.initializeTabs();

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
        window.removeFromCart = CartManager.removeFromCart;
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
                window.location.href = `/products/search?q=${encodeURIComponent(query)}`;
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