// =====================
// DISCOUNT MANAGEMENT
// =====================

function initializeDiscountManagement() {
    console.log('🔄 Initializing discount management...');
    
    // Wait for DOM elements to be available
    setTimeout(() => {
        // Validate modal elements first
        if (validateModalState()) {
            // Load discounts on page load
            loadDiscounts();
            
            // Load all products for discount modal
            loadAllProducts();
            
            // Set up event listeners
            setupDiscountEventListeners();
            
            // Set default dates for discount modal
            setDefaultDiscountDates();
            
            console.log('✅ Discount management initialized successfully!');
        } else {
            console.error('❌ Cannot initialize discount management - modal elements missing');
        }
    }, 100);
}

function setupDiscountEventListeners() {
    console.log('🔧 Setting up discount event listeners...');
    
    // Save discount button
    const saveDiscountBtn = document.getElementById('saveDiscount');
    if (saveDiscountBtn) {
        saveDiscountBtn.addEventListener('click', saveDiscount);
        console.log('✅ Save discount button listener added');
    } else {
        console.warn('⚠️ Save discount button not found');
    }
    
    // Product selection change
    const productSelect = document.getElementById('discountProduct');
    if (productSelect) {
        productSelect.addEventListener('change', onProductSelectionChange);
        console.log('✅ Product select change listener added');
    } else {
        console.warn('⚠️ Product select not found');
    }
    
    // Percentage input change
    const percentageInput = document.getElementById('discountPercentage');
    if (percentageInput) {
        percentageInput.addEventListener('input', calculateFinalPrice);
        console.log('✅ Percentage input listener added');
    } else {
        console.warn('⚠️ Percentage input not found');
    }
    
    console.log('🔧 Event listeners setup complete');
}

function setDefaultDiscountDates() {
    const now = new Date();
    const startDate = document.getElementById('discountStartDate');
    const endDate = document.getElementById('discountEndDate');
    
    if (startDate) {
        // Format date for datetime-local input (YYYY-MM-DDTHH:MM)
        const startDateTime = new Date(now.getTime() + 5 * 60 * 1000); // Add 5 minutes to avoid past time
        startDate.value = startDateTime.toISOString().slice(0, 16);
        console.log('✅ Start date set to:', startDate.value);
    } else {
        console.warn('⚠️ Start date input not found');
    }
    
    if (endDate) {
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        endDate.value = nextWeek.toISOString().slice(0, 16);
        console.log('✅ End date set to:', endDate.value);
    } else {
        console.warn('⚠️ End date input not found');
    }
    
    // Add event listeners to ensure valid date selection
    if (startDate && endDate) {
        startDate.addEventListener('change', function() {
            const startValue = new Date(this.value);
            const endValue = new Date(endDate.value);
            
            if (endValue <= startValue) {
                // Set end date to 1 hour after start date
                const newEndDate = new Date(startValue.getTime() + 60 * 60 * 1000);
                endDate.value = newEndDate.toISOString().slice(0, 16);
                console.log('✅ End date adjusted to:', endDate.value);
            }
        });
        
        endDate.addEventListener('change', function() {
            const startValue = new Date(startDate.value);
            const endValue = new Date(this.value);
            
            if (endValue <= startValue) {
                // Set start date to 1 hour before end date
                const newStartDate = new Date(endValue.getTime() - 60 * 60 * 1000);
                startDate.value = newStartDate.toISOString().slice(0, 16);
                console.log('✅ Start date adjusted to:', startDate.value);
            }
        });
    }
}

async function loadDiscounts() {
    try {
        const response = await fetch('/api/discounts', {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) throw new Error('Failed to fetch discounts');
        
        const discounts = await response.json();
        displayDiscounts(discounts);
    } catch (error) {
        console.error('Error loading discounts:', error);
        showDiscountError('Failed to load discounts');
    }
}

async function loadAllProducts() {
    console.log('🔄 Loading all products...');
    try {
        const response = await fetch('/admin/products', {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) throw new Error('Failed to fetch products');
        
        const allProducts = await response.json();
        console.log('📦 Loaded products:', allProducts);
        
        const productsWithStatus = allProducts.map(product => ({
            ...product,
            hasExistingDiscount: product.hasDiscount === true
        }));
        
        populateProductSelect(productsWithStatus);
    } catch (error) {
        console.error('❌ Error loading products:', error);
        showDiscountError('Failed to load products');
    }
}

function populateProductSelect(products) {
    console.log('🔄 Populating product select...');
    const select = document.getElementById('discountProduct');
    if (!select) {
        console.error('❌ Product select element not found!');
        return;
    }
    
    console.log('📝 Found select element:', select);
    
    // Clear existing options except the first one
    select.innerHTML = '<option value="">Choose a product...</option>';
    
    let withDiscountCount = 0;
    
    products.forEach(product => {
        const option = document.createElement('option');
        option.value = product._id;
        
        // Annotate if product already has a discount, but keep selectable
        if (product.hasExistingDiscount) {
            option.textContent = `${product.name} - $${product.price} (Has discount)`;
            withDiscountCount++;
        } else {
            option.textContent = `${product.name} - $${product.price}`;
        }
        
        option.setAttribute('data-price', product.price);
        select.appendChild(option);
        console.log('➕ Added product option:', product.name, product.hasExistingDiscount ? '(DISABLED - has discount)' : '(ENABLED)');
    });
    
    // Add helpful message below the select
    const selectContainer = select.parentElement;
    let helpText = selectContainer.querySelector('.help-text');
    if (!helpText) {
        helpText = document.createElement('div');
        helpText.className = 'help-text text-muted mt-2';
        selectContainer.appendChild(helpText);
    }
    
    helpText.innerHTML = `
        <small class="text-info">
            <i class="fas fa-info-circle"></i> 
            ${products.length} product(s) loaded${withDiscountCount ? `, ${withDiscountCount} already have discounts` : ''}. Select a product to continue.
        </small>
        <div class="mt-2">
            <button class="btn btn-sm btn-outline-secondary" onclick="refreshProductList()">
                <i class="fas fa-sync-alt"></i> Refresh
            </button>
        </div>
    `;
    
    console.log(`✅ Added ${products.length} products to select (${withDiscountCount} with existing discounts)`);
}

function displayDiscounts(discounts) {
    const tbody = document.getElementById('discounts-body');
    if (!tbody) return;
    
    if (discounts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted">
                    <i class="fas fa-percentage mr-2"></i>No active discounts
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = discounts.map(discount => `
        <tr>
            <td>${discount.name}</td>
            <td>$${discount.originalPrice?.toFixed(2) || 'N/A'}</td>
            <td><span class="badge badge-success">${discount.discountPercentage}%</span></td>
            <td><strong>$${discount.price?.toFixed(2) || 'N/A'}</strong></td>
            <td>${formatDate(discount.discountStartDate)}</td>
            <td>${formatDate(discount.discountEndDate)}</td>
            <td>
                <span class="badge badge-${discount.hasDiscount ? 'success' : 'secondary'}">
                    ${discount.hasDiscount ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-warning mr-1" onclick="editDiscount('${discount._id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="removeDiscount('${discount._id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function onProductSelectionChange() {
    const select = document.getElementById('discountProduct');
    const percentageInput = document.getElementById('discountPercentage');
    
    if (select.value) {
        const selectedOption = select.options[select.selectedIndex];
        const price = parseFloat(selectedOption.getAttribute('data-price'));
        
        if (percentageInput.value) {
            calculateFinalPrice();
        }
    }
}

function calculateFinalPrice() {
    const select = document.getElementById('discountProduct');
    const percentageInput = document.getElementById('discountPercentage');
    
    if (!select.value || !percentageInput.value) return;
    
    const selectedOption = select.options[select.selectedIndex];
    const price = parseFloat(selectedOption.getAttribute('data-price'));
    const percentage = parseFloat(percentageInput.value);
    
    if (price && percentage) {
        const discountAmount = (price * percentage) / 100;
        const finalPrice = price - discountAmount;
        
        // You can display this somewhere in the modal if needed
        console.log(`Original: $${price}, Discount: ${percentage}%, Final: $${finalPrice.toFixed(2)}`);
    }
}

async function saveDiscount() {
    const productId = document.getElementById('discountProduct').value;
    const percentage = document.getElementById('discountPercentage').value;
    const startDate = document.getElementById('discountStartDate').value;
    const endDate = document.getElementById('discountEndDate').value;
    const active = document.getElementById('discountActive').checked;
    
    if (!productId || !percentage || !startDate || !endDate) {
        showDiscountError('Please fill in all required fields');
        return;
    }
    
            // Check if selected product already has a discount
        const productSelect = document.getElementById('discountProduct');
        if (!productSelect || productSelect.selectedIndex === -1) {
            showDiscountError('Please select a product');
            return;
        }
        
        const selectedOption = productSelect.options[productSelect.selectedIndex];
        if (selectedOption && selectedOption.disabled) {
            showDiscountError('This product already has a discount. Please select a different product or remove the existing discount first.');
            return;
        }
    
    try {
        const response = await fetch('/api/discounts/add', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                productId,
                discountPercentage: parseInt(percentage),
                startDate,
                endDate,
                active
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to add discount');
        }
        
        const result = await response.json();
        
        // Close modal
        const modalElement = document.getElementById('addDiscountModal');
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
        }
        
        // Show success message
        if (window.alertSystem) {
            window.alertSystem.show('Discount added successfully!', 'success');
        } else {
            alert('Discount added successfully!');
        }
        
        // Reload discounts and product list
        await Promise.all([
            loadDiscounts(),
            loadAllProducts()
        ]);
        
        // Clear home page cache and refresh if on home page
        if (window.location.pathname === '/' || window.location.pathname === '/home') {
            console.log('🔄 Warming up home page cache and refreshing...');
            try {
                // Warm up the server-side cache
                await fetch('/warm-cache', { method: 'POST' });
                console.log('✅ Home page cache warmed up');
            } catch (error) {
                console.warn('⚠️ Could not warm up cache:', error);
                // Fallback to clearing cache
                try {
                    await fetch('/clear-cache', { method: 'POST' });
                    console.log('✅ Home page cache cleared (fallback)');
                } catch (clearError) {
                    console.warn('⚠️ Could not clear cache either:', clearError);
                }
            }
            // Force a hard refresh to get fresh data
            window.location.reload(true);
        }
        
        // Reset form
        const form = document.getElementById('discountForm');
        if (form) {
            form.reset();
            setDefaultDiscountDates();
        }
        
    } catch (error) {
        console.error('Error saving discount:', error);
        showDiscountError(error.message);
    }
}

async function editDiscount(discountId) {
    // This would open an edit modal with pre-filled data
    // For now, just show a message
    if (window.alertSystem) {
        window.alertSystem.show('Edit functionality coming soon!', 'info');
    }
}

async function removeDiscount(discountId) {
    // Try to use the alert system's confirm method
    if (window.alertSystem && window.alertSystem.confirm) {
        const confirmed = await window.alertSystem.confirm(
            'Are you sure you want to remove this discount?', 
            'warning'
        );
        
        if (!confirmed) return;
    } else {
        // Fallback to browser confirm
        if (!confirm('Are you sure you want to remove this discount?')) {
            return;
        }
    }
    
    try {
        const response = await fetch(`/api/discounts/remove/${discountId}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to remove discount');
        }
        
        // Show success message
        if (window.alertSystem) {
            window.alertSystem.show('Discount removed successfully!', 'success');
        } else {
            alert('Discount removed successfully!');
        }
        
        // Reload both discounts and product list simultaneously
        await Promise.all([
            loadDiscounts(),
            loadAllProducts()
        ]);
        
        // Clear home page cache and refresh if on home page
        if (window.location.pathname === '/' || window.location.pathname === '/home') {
            console.log('🔄 Warming up home page cache and refreshing...');
            try {
                // Warm up the server-side cache
                await fetch('/warm-cache', { method: 'POST' });
                console.log('✅ Home page cache warmed up');
            } catch (error) {
                console.warn('⚠️ Could not warm up cache:', error);
                // Fallback to clearing cache
                try {
                    await fetch('/clear-cache', { method: 'POST' });
                    console.log('✅ Home page cache cleared (fallback)');
                } catch (clearError) {
                    console.warn('⚠️ Could not clear cache either:', clearError);
                }
            }
            // Force a hard refresh to get fresh data
            window.location.reload(true);
        }
        
    } catch (error) {
        console.error('Error removing discount:', error);
        showDiscountError(error.message);
    }
}

function showDiscountError(message) {
    if (window.alertSystem) {
        window.alertSystem.show(message, 'danger');
    } else {
        alert(message);
    }
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

// Refresh product list manually
function refreshProductList() {
    console.log('🔄 Manually refreshing product list...');
    loadAllProducts();
}

// Validate modal state and elements
function validateModalState() {
    console.log('🔍 Validating modal state...');
    
    const requiredElements = [
        'discountProduct',
        'discountPercentage', 
        'discountStartDate',
        'discountEndDate',
        'discountActive',
        'saveDiscount'
    ];
    
    const missingElements = [];
    
    requiredElements.forEach(elementId => {
        const element = document.getElementById(elementId);
        if (!element) {
            missingElements.push(elementId);
            console.error(`❌ Missing element: ${elementId}`);
        } else {
            console.log(`✅ Found element: ${elementId}`);
        }
    });
    
    if (missingElements.length > 0) {
        console.error('❌ Modal validation failed. Missing elements:', missingElements);
        return false;
    }
    
    console.log('✅ Modal validation passed');
    return true;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeDiscountManagement();
});
