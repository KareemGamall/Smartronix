// Admin Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Bootstrap components
    initializeBootstrapComponents();
    
    // Initialize admin-specific functionality
    initializeAdminFeatures();
    
    // Initialize modern alert system
    window.alertSystem = new AlertSystem();
});

function initializeBootstrapComponents() {
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Initialize dropdowns
    const dropdownElementList = [].slice.call(document.querySelectorAll('.dropdown-toggle'));
    dropdownElementList.map(function (dropdownToggleEl) {
        return new bootstrap.Dropdown(dropdownToggleEl);
    });

    // Initialize modals
    const modalElementList = [].slice.call(document.querySelectorAll('.modal'));
    modalElementList.map(function (modalEl) {
        return new bootstrap.Modal(modalEl);
    });
}

function initializeAdminFeatures() {
    // Sidebar toggle functionality
    const sidebarToggle = document.querySelector('#sidebarCollapse');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            document.getElementById('sidebar').classList.toggle('active');
        });
    }

    // Auto-hide old Bootstrap alerts after 5 seconds (for backward compatibility)
    const alerts = document.querySelectorAll('.alert:not(.custom-alert)');
    alerts.forEach(alert => {
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    });

    // Confirm delete actions
    const deleteButtons = document.querySelectorAll('.btn-delete');
    deleteButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            if (!confirm('Are you sure you want to delete this item?')) {
                e.preventDefault();
            }
        });
    });
}

// =====================
// MODERN ALERT SYSTEM
// =====================

class AlertSystem {
    constructor() {
        this.container = this.createContainer();
        this.alertCount = 0;
    }

    createContainer() {
        let container = document.getElementById('alertContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'alertContainer';
            container.className = 'alert-container';
            document.body.appendChild(container);
        }
        return container;
    }

    show(message, type = 'info', duration = 5000) {
        const alertId = `alert-${++this.alertCount}`;
        const alert = this.createAlert(message, type, alertId);
        
        this.container.appendChild(alert);

        // Auto remove after duration
        setTimeout(() => {
            this.remove(alertId);
        }, duration);

        return alertId;
    }

    createAlert(message, type, id) {
        const alert = document.createElement('div');
        alert.id = id;
        alert.className = `custom-alert alert-${type}-custom`;

        const icons = {
            success: 'fas fa-check-circle',
            danger: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        const titles = {
            success: 'Success',
            danger: 'Error',
            warning: 'Warning',
            info: 'Information'
        };

        alert.innerHTML = `
            <div class="alert-content">
                <div class="alert-icon">
                    <i class="${icons[type]}"></i>
                </div>
                <div class="alert-text">
                    <div class="alert-title">${titles[type]}</div>
                    <div class="alert-message">${message}</div>
                </div>
                <button class="alert-close" onclick="alertSystem.remove('${id}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="alert-progress">
                <div class="alert-progress-bar"></div>
            </div>
        `;

        return alert;
    }

    remove(alertId) {
        const alert = document.getElementById(alertId);
        if (alert) {
            alert.classList.add('alert-exit');
            setTimeout(() => {
                if (alert.parentNode) {
                    alert.parentNode.removeChild(alert);
                }
            }, 300);
        }
    }

    // Custom confirmation dialog
    confirm(message, type = 'warning') {
        return new Promise((resolve, reject) => {
            const alertId = `alert-${++this.alertCount}`;
            const alert = document.createElement('div');
            alert.id = alertId;
            alert.className = `custom-alert alert-${type}-custom`;
            const icons = {
                success: 'fas fa-check-circle',
                danger: 'fas fa-exclamation-circle',
                warning: 'fas fa-exclamation-triangle',
                info: 'fas fa-info-circle'
            };
            const titles = {
                success: 'Success',
                danger: 'Error',
                warning: 'Confirmation',
                info: 'Information'
            };
            alert.innerHTML = `
                <div class="alert-content">
                    <div class="alert-icon">
                        <i class="${icons[type]}"></i>
                    </div>
                    <div class="alert-text">
                        <div class="alert-title">${titles[type]}</div>
                        <div class="alert-message">${message}</div>
                    </div>
                    <button class="alert-close" tabindex="0"><i class="fas fa-times"></i></button>
                </div>
                <div class="d-flex justify-content-end mt-2" style="gap: 8px;">
                    <button class="btn btn-sm btn-primary alert-confirm-yes">Yes</button>
                    <button class="btn btn-sm btn-secondary alert-confirm-no">No</button>
                </div>
            `;
            this.container.appendChild(alert);
            alert.querySelector('.alert-close').onclick = () => {
                this.remove(alertId);
                reject();
            };
            alert.querySelector('.alert-confirm-yes').onclick = () => {
                this.remove(alertId);
                resolve(true);
            };
            alert.querySelector('.alert-confirm-no').onclick = () => {
                this.remove(alertId);
                resolve(false);
            };
        });
    }
}

// Updated AdminUtils with modern alert system
const AdminUtils = {
    showAlert: function(message, type = 'info', duration = 5000) {
        if (!window.alertSystem) {
            window.alertSystem = new AlertSystem();
        }
        return window.alertSystem.show(message, type, duration);
    },

    formatCurrency: function(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    },

    formatDate: function(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
};

// Make AdminUtils globally available
window.AdminUtils = AdminUtils;

// =====================
// Admin Page Scripts
// =====================

// USERS PAGE
window.showAddUserModal = function() {
    const modalTitle = document.getElementById('modalTitle');
    const userForm = document.getElementById('userForm');
    const userId = document.getElementById('userId');
    const passwordField = document.getElementById('passwordField');
    const passwordInput = document.getElementById('password');
    
    if (modalTitle) modalTitle.textContent = 'Add New User';
    if (userForm) userForm.reset();
    if (userId) userId.value = '';
    if (passwordField) passwordField.style.display = 'block';
    if (passwordInput) passwordInput.required = true;
    
    if (window.userModal) window.userModal.show();
};

window.editUser = async function(userId) {
    try {
        const response = await fetch(`/admin/users/${userId}`);
        if (!response.ok) throw new Error('Failed to fetch user details');
        const user = await response.json();
        const modalTitle = document.getElementById('modalTitle');
        const userIdInput = document.getElementById('userId');
        const nameInput = document.getElementById('name');
        const emailInput = document.getElementById('email');
        const phoneInput = document.getElementById('phoneNumber');
        const roleInput = document.getElementById('role');
        const passwordField = document.getElementById('passwordField');
        const passwordInput = document.getElementById('password');
        
        if (modalTitle) modalTitle.textContent = 'Edit User';
        if (userIdInput) userIdInput.value = user._id;
        if (nameInput) nameInput.value = user.name;
        if (emailInput) emailInput.value = user.email;
        if (phoneInput) phoneInput.value = user.phoneNumber || '';
        if (roleInput) roleInput.value = user.role || 'user';
        if (passwordField) passwordField.style.display = 'none';
        if (passwordInput) passwordInput.required = false;
        
        if (window.userModal) window.userModal.show();
    } catch (error) {
        console.error('Error:', error);
        AdminUtils.showAlert('Failed to load user details. Please try again.', 'danger');
    }
};

window.deleteUser = async function(userId) {
    const confirmed = await window.alertSystem.confirm('Are you sure you want to delete this user?', 'warning');
    if (confirmed) {
        try {
            const response = await fetch(`/admin/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            if (data.success) {
                const row = document.querySelector(`tr[data-user-id="${userId}"]`);
                if (row) row.remove();
                AdminUtils.showAlert('User deleted successfully', 'success');
                // No reload for dynamic experience
            } else {
                throw new Error(data.message || 'Failed to delete user');
            }
        } catch (error) {
            console.error('Error:', error);
            AdminUtils.showAlert('Failed to delete user. Please try again.', 'danger');
        }
    }
};

window.saveUser = async function() {
    try {
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const phoneNumber = document.getElementById('phoneNumber').value;
        const password = document.getElementById('password').value;
        const role = document.getElementById('role').value;
        
        const userIdValue = document.getElementById('userId').value;
        const isNewUser = !userIdValue;
        
        // Validate required fields
        if (!name || !email || !phoneNumber || !role) {
            AdminUtils.showAlert('Please fill in all required fields', 'warning');
            return;
        }
        
        // For new users, password is required
        if (isNewUser && !password) {
            AdminUtils.showAlert('Password is required for new users', 'warning');
            return;
        }
        
        const phoneRegex = /^(10|11|12|15)\d{8}$/;
        if (!phoneRegex.test(phoneNumber)) {
            AdminUtils.showAlert('Please enter a valid Egyptian phone number', 'warning');
            return;
        }
        
        const userData = { name, email, phoneNumber, role };
        if (isNewUser) {
            userData.password = password;
        }
        
        const url = userIdValue ? `/admin/users/${userIdValue}` : '/admin/users';
        const method = userIdValue ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(userData)
        });
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response:', text);
            throw new Error('Server returned non-JSON response. Please try again.');
        }
        const data = await response.json();
        if (data.success) {
            if (window.userModal) window.userModal.hide();
            AdminUtils.showAlert(userIdValue ? 'User updated successfully' : 'User added successfully', 'success');
            // No reload or redirect for dynamic experience
        } else {
            throw new Error(data.message || 'Failed to save user');
        }
    } catch (error) {
        console.error('Error:', error);
        AdminUtils.showAlert(error.message || 'Failed to save user. Please try again.', 'danger');
    }
};

// USERS & PRODUCTS & ORDERS: Table Search
function setupTableSearch(inputId, tableSelector) {
    const searchInput = document.getElementById(inputId);
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const filter = searchInput.value.toLowerCase();
            document.querySelectorAll(`${tableSelector} tbody tr`).forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(filter) ? '' : 'none';
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Users page modal
    const userModalElement = document.getElementById('userModal');
    if (userModalElement) {
        window.userModal = new bootstrap.Modal(userModalElement);
        setupTableSearch('searchInput', 'table');
    }
});

// PRODUCTS PAGE
window.showAddProductModal = function() {
    const modalTitle = document.getElementById('modalTitle');
    const productForm = document.getElementById('productForm');
    const productId = document.getElementById('productId');
    const imagePreview = document.getElementById('imagePreview');
    if (modalTitle) modalTitle.textContent = 'Add New Product';
    if (productForm) productForm.reset();
    if (productId) productId.value = '';
    if (imagePreview) imagePreview.style.display = 'none';
    if (window.productModal) window.productModal.show();
};

window.editProduct = async function(productId) {
    try {
        const response = await fetch(`/admin/products/${productId}`);
        if (!response.ok) throw new Error('Failed to fetch product details');
        const product = await response.json();
        const modalTitle = document.getElementById('modalTitle');
        const productIdInput = document.getElementById('productId');
        const nameInput = document.getElementById('name');
        const priceInput = document.getElementById('price');
        const categoryInput = document.getElementById('category');
        const stockInput = document.getElementById('stock');
        const imageInput = document.getElementById('imageUrl');
        const descriptionInput = document.getElementById('description');
        const preview = document.getElementById('imagePreview');
        if (modalTitle) modalTitle.textContent = 'Edit Product';
        if (productIdInput) productIdInput.value = product._id;
        if (nameInput) nameInput.value = product.name;
        if (priceInput) priceInput.value = product.price;
        if (categoryInput) categoryInput.value = product.category ? (product.category._id || product.category) : '';
        if (stockInput) stockInput.value = product.stockQuantity;
        if (imageInput) imageInput.value = product.imageUrl;
        if (descriptionInput) descriptionInput.value = product.description;
        if (preview) {
            preview.src = product.imageUrl;
            preview.style.display = 'block';
        }
        if (window.productModal) window.productModal.show();
    } catch (error) {
        console.error('Error:', error);
        AdminUtils.showAlert('Failed to load product details. Please try again.', 'danger');
    }
};

window.deleteProduct = async function(productId) {
    const confirmed = await window.alertSystem.confirm('Are you sure you want to delete this product?', 'warning');
    if (confirmed) {
        try {
            const response = await fetch(`/admin/products/${productId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            if (data.success) {
                const row = document.querySelector(`tr[data-product-id="${productId}"]`);
                if (row) row.remove();
                AdminUtils.showAlert('Product deleted successfully', 'success');
                // No reload for dynamic experience
            } else {
                throw new Error(data.message || 'Failed to delete product');
            }
        } catch (error) {
            console.error('Error:', error);
            AdminUtils.showAlert('Failed to delete product. Please try again.', 'danger');
        }
    }
};

window.saveProduct = async function() {
    try {
        const productId = document.getElementById('productId').value;
        const name = document.getElementById('name').value.trim();
        const price = document.getElementById('price').value.trim();
        const category = document.getElementById('category').value.trim();
        const stock = document.getElementById('stock').value.trim();
        const image = document.getElementById('imageUrl').value.trim();
        const description = document.getElementById('description').value.trim();
        const requiredFields = { name, price, category, stock, image, description };
        const missingFields = Object.entries(requiredFields)
            .filter(([_, value]) => !value)
            .map(([key]) => key);
        if (missingFields.length > 0) {
            AdminUtils.showAlert(`The following fields are required: ${missingFields.join(', ')}`, 'warning');
            return;
        }
        if (isNaN(price) || parseFloat(price) < 0) {
            AdminUtils.showAlert('Price must be a positive number', 'warning');
            return;
        }
        if (isNaN(stock) || parseInt(stock) < 0) {
            AdminUtils.showAlert('Stock must be a positive number', 'warning');
            return;
        }
        const productData = {
            name: name,
            price: parseFloat(price),
            category: category,
            stockQuantity: parseInt(stock),
            imageUrl: image,
            description: description
        };
        const url = productId ? `/admin/products/${productId}` : '/admin/products';
        const method = productId ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData)
        });
        const data = await response.json();
        if (data.success) {
            if (window.productModal) window.productModal.hide();
            AdminUtils.showAlert(data.message || 'Product saved successfully', 'success');
            // No reload or redirect for dynamic experience
        } else {
            throw new Error(data.message || 'Failed to save product');
        }
    } catch (error) {
        console.error('Error:', error);
        AdminUtils.showAlert(error.message || 'Failed to save product. Please try again.', 'danger');
    }
};

document.addEventListener('DOMContentLoaded', function() {
    // Products page modal
    const productModalElement = document.getElementById('productModal');
    if (productModalElement) {
        window.productModal = new bootstrap.Modal(productModalElement);
        // Image preview
        const imageInput = document.getElementById('imageUrl');
        if (imageInput) {
            imageInput.addEventListener('input', function(e) {
                const preview = document.getElementById('imagePreview');
                if (e.target.value) {
                    preview.src = e.target.value;
                    preview.style.display = 'block';
                } else {
                    preview.style.display = 'none';
                }
            });
        }
        setupTableSearch('searchInput', 'table');
    }
});

// ORDERS PAGE
window.viewOrder = function(orderId) {
    if (!window.ordersData) return;
    const selectedOrder = window.ordersData.find(o => o._id === orderId);
    if (!selectedOrder) return;
    let html = `<strong>Order ID:</strong> ${selectedOrder.OrderID}<br>`;
    html += `<strong>User:</strong> ${selectedOrder.user ? selectedOrder.user.name : 'Guest'}<br>`;
    html += `<strong>Status:</strong> ${selectedOrder.orderStatus}<br>`;
    html += `<strong>Date:</strong> ${selectedOrder.OrderDate ? new Date(selectedOrder.OrderDate).toLocaleString() : ''}<br>`;
    html += `<strong>Shipping Address:</strong> ${selectedOrder.ShippingAddress || ''}<br>`;
    html += `<strong>Contact Number:</strong> ${selectedOrder.ContactNumber || ''}<br>`;
    html += `<strong>Payment Method:</strong> ${selectedOrder.PaymentMethod || ''}<br>`;
    html += `<strong>Total Amount:</strong> $${selectedOrder.totalAmount.toFixed(2)}<br>`;
    html += `<strong>Products:</strong><ul>`;
    selectedOrder.products.forEach(item => {
        html += `<li>${item.product ? item.product.name : 'Unknown'} x ${item.quantity}</li>`;
    });
    html += `</ul>`;
    document.getElementById('orderModalBody').innerHTML = html;
    const orderModal = new bootstrap.Modal(document.getElementById('orderModal'));
    orderModal.show();
};

document.addEventListener('DOMContentLoaded', function() {
    // Orders page: expose ordersData if present
    if (typeof ordersData !== 'undefined') {
        window.ordersData = ordersData;
        setupTableSearch('searchInput', 'table');
    }
});

// PROFILE PAGE
function setupProfileImagePreview() {
    const photoInput = document.getElementById('photo');
    if (photoInput) {
        photoInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(evt) {
                    document.getElementById('profileImagePreview').src = evt.target.result;
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Profile page image preview
    setupProfileImagePreview();
});

// CATEGORY PAGE LOGIC
let categoryModal;
document.addEventListener('DOMContentLoaded', function() {
    const modalElement = document.getElementById('categoryModal');
    if (modalElement) {
        categoryModal = new bootstrap.Modal(modalElement);
        setupTableSearch('categorySearchInput', 'table');
    }
});
window.showAddCategoryModal = function() {
    document.getElementById('categoryModalTitle').textContent = 'Add New Category';
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = '';
    // Clear extra fields if present
    if (document.getElementById('categoryDescription')) document.getElementById('categoryDescription').value = '';
    if (document.getElementById('categoryImageUrl')) document.getElementById('categoryImageUrl').value = '';
    if (document.getElementById('categoryID')) document.getElementById('categoryID').value = '';
    if (categoryModal) categoryModal.show();
};
window.editCategory = async function(categoryId) {
    try {
        const row = document.querySelector(`tr[data-category-id="${categoryId}"]`);
        const name = row.querySelector('.category-name').textContent;
        // If you add more fields, get them from data attributes or hidden cells
        document.getElementById('categoryModalTitle').textContent = 'Edit Category';
        document.getElementById('categoryId').value = categoryId;
        document.getElementById('categoryName').value = name;
        if (document.getElementById('categoryDescription')) document.getElementById('categoryDescription').value = row.getAttribute('data-description') || '';
        if (document.getElementById('categoryImageUrl')) document.getElementById('categoryImageUrl').value = row.getAttribute('data-imageurl') || '';
        if (document.getElementById('categoryID')) document.getElementById('categoryID').value = row.getAttribute('data-categoryid') || '';
        if (categoryModal) categoryModal.show();
    } catch (error) {
        AdminUtils.showAlert('Failed to load category details.', 'danger');
    }
};
window.saveCategory = async function() {
    const id = document.getElementById('categoryId').value;
    const name = document.getElementById('categoryName').value.trim();
    const description = document.getElementById('categoryDescription') ? document.getElementById('categoryDescription').value.trim() : '';
    const imageUrl = document.getElementById('categoryImageUrl') ? document.getElementById('categoryImageUrl').value.trim() : '';
    const categoryID = document.getElementById('categoryID') ? document.getElementById('categoryID').value.trim() : '';
    // Improved required fields check
    const requiredFields = {
        'Category Name': name,
        'Description': description,
        'Image URL': imageUrl,
        'Category ID': categoryID
    };
    const missingFields = Object.entries(requiredFields)
        .filter(([_, value]) => !value)
        .map(([key]) => key);
    if (missingFields.length > 0) {
        AdminUtils.showAlert(`The following fields are required: ${missingFields.join(', ')}`, 'warning');
        return;
    }
    try {
        const url = id ? `/admin/categories/${id}` : '/admin/categories';
        const method = id ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description, imageUrl, categoryID })
        });
        const data = await response.json();
        if (data.success) {
            if (categoryModal) categoryModal.hide();
            AdminUtils.showAlert(id ? 'Category updated.' : 'Category added.', 'success');
            setTimeout(() => window.location.reload(), 1000);
        } else {
            throw new Error(data.message || 'Failed to save category');
        }
    } catch (error) {
        AdminUtils.showAlert(error.message, 'danger');
    }
};
window.deleteCategory = async function(categoryId) {
    const confirmed = await window.alertSystem.confirm('Are you sure you want to delete this category?', 'warning');
    if (!confirmed) return;
    try {
        const response = await fetch(`/admin/categories/${categoryId}`, { method: 'DELETE' });
        const data = await response.json();
        if (data.success) {
            const row = document.querySelector(`tr[data-category-id="${categoryId}"]`);
            if (row) row.remove();
            AdminUtils.showAlert('Category deleted.', 'success');
            // Reload page after 1 second to refresh navbar categories
            setTimeout(() => window.location.reload(), 1000);
        } else {
            throw new Error(data.message || 'Failed to delete category');
        }
    } catch (error) {
        AdminUtils.showAlert(error.message, 'danger');
    }
};