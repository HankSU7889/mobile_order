// ==================== Mobile Order - Main JavaScript ====================

const state = {
    mode: 'search',
    selectedItem: null,
    searchResults: [],
    cart: [],
    salesPersons: [],
    selectedItemsInCart: new Set() // 用于购物车多选
};

const CART_KEY = 'mobile_order_cart';

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

async function initApp() {
    await loadSalesPersons();
    bindEvents();
    loadCart();
    updateCartDisplay();
}

async function callAPI(method, args = {}) {
    const url = '/api/method/mobile_order.api.' + method + '?' + new URLSearchParams(args);
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        },
        credentials: 'include'
    });
    const data = await response.json();
    if (data.exc) {
        throw new Error(data.exc);
    }
    return data.message;
}

async function loadSalesPersons() {
    try {
        state.salesPersons = await callAPI('get_sales_persons', {active_only: true});
        renderSalesPersonSelect();
    } catch (e) {
        console.error('加载业务员失败', e);
    }
}

function bindEvents() {
    document.getElementById('search-btn').addEventListener('click', doSearch);
    document.getElementById('search-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') doSearch();
    });
    
    // 购物车栏点击打开购物车
    document.getElementById('cart-bar').addEventListener('click', function(e) {
        if (e.target.id !== 'checkout-btn' && !e.target.classList.contains('cart-info')) {
            return;
        }
        openCartModal();
    });
    
    document.getElementById('checkout-btn').addEventListener('click', function(e) {
        e.stopPropagation();
        openCartModal();
    });
    
    document.getElementById('submit-order-btn').addEventListener('click', submitOrder);
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', function() { closeModal(this.dataset.close); });
    });
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) this.classList.remove('active');
        });
    });
    document.getElementById('customer-name').addEventListener('input', checkFormValid);
    document.getElementById('customer-mobile').addEventListener('input', checkFormValid);
    document.getElementById('customer-address').addEventListener('input', checkFormValid);
    document.getElementById('sales-person').addEventListener('change', checkFormValid);
    
    // 购物车全选
    document.getElementById('select-all-cart').addEventListener('click', toggleSelectAll);
    // 清空购物车
    document.getElementById('clear-cart-btn').addEventListener('click', clearCart);
    // 删除选中
    document.getElementById('delete-selected-btn').addEventListener('click', deleteSelectedItems);
}

function openCartModal() {
    if (state.cart.length === 0) {
        showToast('购物车是空的', 'warning');
        return;
    }
    state.selectedItemsInCart.clear();
    updateCartModal();
    openModal('cart-modal');
}

function updateCartModal() {
    renderCartItemsList();
    updateCartSelectionUI();
}

function renderCartItemsList() {
    const container = document.getElementById('cart-items-list');
    if (!container) return;
    
    if (state.cart.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>购物车是空的</p></div>';
        return;
    }
    
    let html = '';
    state.cart.forEach((c, i) => {
        const isSelected = state.selectedItemsInCart.has(i);
        html += '<div class="cart-item' + (isSelected ? ' selected' : '') + '" data-index="' + i + '">' +
            '<div class="cart-item-checkbox">' +
            '<input type="checkbox" id="cart-check-' + i + '" ' + (isSelected ? 'checked' : '') + '>' +
            '</div>' +
            '<div class="cart-item-info" onclick="showCartItemDetail(' + i + ')">' +
            '<div class="cart-item-name">' + escapeHtml(c.item_name) + '</div>' +
            '<div class="cart-item-qty">x ' + c.qty + '</div>' +
            '</div>' +
            '<button class="cart-item-remove" onclick="removeFromCart(' + i + ')">删除</button>' +
            '</div>';
    });
    
    container.innerHTML = html;
    
    // 绑定复选框事件
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', function() {
            const idx = parseInt(this.id.replace('cart-check-', ''));
            if (this.checked) {
                state.selectedItemsInCart.add(idx);
            } else {
                state.selectedItemsInCart.delete(idx);
            }
            updateCartSelectionUI();
        });
    });
}

function updateCartSelectionUI() {
    const selectedCount = state.selectedItemsInCart.size;
    const deleteBtn = document.getElementById('delete-selected-btn');
    const selectAllBtn = document.getElementById('select-all-cart');
    
    if (deleteBtn) {
        deleteBtn.disabled = selectedCount === 0;
        deleteBtn.textContent = '删除选中' + (selectedCount > 0 ? ' (' + selectedCount + ')' : '');
    }
    
    // 更新全选状态
    if (selectAllBtn) {
        selectAllBtn.textContent = state.selectedItemsInCart.size === state.cart.length ? '取消全选' : '全选';
    }
}

function toggleSelectAll() {
    if (state.selectedItemsInCart.size === state.cart.length) {
        // 取消全选
        state.selectedItemsInCart.clear();
    } else {
        // 全选
        state.cart.forEach((_, i) => state.selectedItemsInCart.add(i));
    }
    renderCartItemsList();
    updateCartSelectionUI();
}

function deleteSelectedItems() {
    if (state.selectedItemsInCart.size === 0) return;
    
    // 从大到小排序，确保删除索引正确
    const indices = Array.from(state.selectedItemsInCart).sort((a, b) => b - a);
    indices.forEach(idx => {
        state.cart.splice(idx, 1);
    });
    
    state.selectedItemsInCart.clear();
    saveCart();
    updateCartDisplay();
    updateCartModal();
    showToast('已删除 ' + indices.length + ' 个产品', 'success');
}

function clearCart() {
    if (state.cart.length === 0) return;
    
    if (confirm('确定要清空购物车吗？')) {
        state.cart = [];
        state.selectedItemsInCart.clear();
        saveCart();
        updateCartDisplay();
        updateCartModal();
        showToast('购物车已清空', 'success');
    }
}

function removeFromCart(index) {
    state.cart.splice(index, 1);
    state.selectedItemsInCart.delete(index);
    // 重新调整选中项的索引
    const newSelected = new Set();
    state.selectedItemsInCart.forEach(idx => {
        if (idx > index) {
            newSelected.add(idx - 1);
        } else if (idx < index) {
            newSelected.add(idx);
        }
    });
    state.selectedItemsInCart = newSelected;
    
    saveCart();
    updateCartDisplay();
    updateCartModal();
    showToast('已移除', 'success');
}

function showCartItemDetail(index) {
    const item = state.cart[index];
    if (!item) return;
    
    // 创建完整的产品对象
    const fullItem = {
        item_code: item.item_code,
        item_name: item.item_name,
        item_group: '',
        brand: null
    };
    
    selectItem(fullItem, index);
}

async function doSearch() {
    const keyword = document.getElementById('search-input').value.trim();
    if (!keyword) {
        showToast('请输入搜索关键词', 'warning');
        return;
    }
    
    try {
        const results = await callAPI('search_items', {keyword: keyword});
        state.searchResults = results;
        renderSearchResults(results);
    } catch (e) {
        showToast('搜索失败: ' + e, 'error');
    }
}

function renderSearchResults(results) {
    const container = document.getElementById('search-results');
    
    if (!results || results.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>未找到相关产品</p></div>';
        return;
    }
    
    // 按系列分组显示
    const grouped = {};
    results.forEach(item => {
        const series = item.item_group ? item.item_group.split('-')[0] : item.item_name.split('-')[0];
        if (!grouped[series]) grouped[series] = [];
        grouped[series].push(item);
    });
    
    let html = '';
    for (const [series, items] of Object.entries(grouped)) {
        html += '<div class="result-group">';
        html += '<h3 class="result-group-title">' + escapeHtml(series) + '</h3>';
        html += '<div class="result-items">';
        items.forEach(item => {
            const cartItem = state.cart.find(c => c.item_code === item.item_code);
            const qty = cartItem ? cartItem.qty : 0;
            html += '<div class="item-card" data-item-code="' + escapeHtml(item.item_code) + '">' +
                (qty > 0 ? '<span class="item-qty-badge">' + qty + '</span>' : '') +
                '<div class="item-name">' + escapeHtml(item.item_name) + '</div>' +
                '<div class="item-group">' + escapeHtml(item.item_group || '') + '</div>' +
                '<button class="add-btn">+' + (qty > 0 ? qty : '') + '</button>' +
                '</div>';
        });
        html += '</div></div>';
    }
    
    container.innerHTML = html;
    
    container.querySelectorAll('.item-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (e.target.classList.contains('add-btn')) {
                const itemCode = this.dataset.itemCode;
                const item = results.find(i => i.item_code === itemCode);
                if (item) {
                    quickAddToCart(item);
                }
            } else {
                const itemCode = this.dataset.itemCode;
                const item = results.find(i => i.item_code === itemCode);
                if (item) selectItem(item);
            }
        });
    });
}

function quickAddToCart(item) {
    const existing = state.cart.find(c => c.item_code === item.item_code);
    if (existing) {
        existing.qty += 1;
    } else {
        state.cart.push({
            item_code: item.item_code,
            item_name: item.item_name,
            qty: 1
        });
    }
    saveCart();
    updateCartDisplay();
    renderSearchResults(state.searchResults);
    showToast('已添加: ' + item.item_name, 'success');
}

function selectItem(item, cartIndex = null) {
    state.selectedItem = item;
    state.selectedCartIndex = cartIndex;
    const cartItem = cartIndex !== null ? state.cart[cartIndex] : state.cart.find(c => c.item_code === item.item_code);
    const currentQty = cartItem ? cartItem.qty : 0;
    document.getElementById('selected-item-name').textContent = item.item_name;
    document.getElementById('item-qty').value = currentQty > 0 ? currentQty : 1;
    document.getElementById('current-qty').textContent = currentQty > 0 ? '购物车中已有 ' + currentQty + ' 件' : '';
    openModal('item-modal');
}

function renderSalesPersonSelect() {
    const select = document.getElementById('sales-person');
    if (!select) return;
    
    let html = '<option value="">请选择业务员</option>';
    state.salesPersons.forEach(sp => {
        html += '<option value="' + escapeHtml(sp.name) + '">' + escapeHtml(sp.sales_person_name) + '</option>';
    });
    select.innerHTML = html;
}

function openCheckoutModal() {
    if (state.cart.length === 0) {
        showToast('购物车是空的', 'warning');
        return;
    }
    renderCheckoutItems();
    openModal('checkout-modal');
    checkFormValid();
}

function renderCheckoutItems() {
    const container = document.getElementById('checkout-items');
    if (!container) return;
    
    let html = '<div class="checkout-item-list">';
    state.cart.forEach((c, i) => {
        html += '<div class="checkout-item">' +
            '<div class="checkout-item-info">' +
            '<div class="checkout-item-name">' + escapeHtml(c.item_name) + '</div>' +
            '<div class="checkout-item-qty">x ' + c.qty + '</div>' +
            '</div>' +
            '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
}

function checkFormValid() {
    const name = document.getElementById('customer-name').value.trim();
    const mobile = document.getElementById('customer-mobile').value.trim();
    const address = document.getElementById('customer-address').value.trim();
    const sp = document.getElementById('sales-person').value;
    const btn = document.getElementById('submit-order-btn');
    btn.disabled = !(name && mobile && address && sp);
    
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.disabled = state.cart.length === 0;
    }
}

async function submitOrder() {
    const name = document.getElementById('customer-name').value.trim();
    const mobile = document.getElementById('customer-mobile').value.trim();
    const address = document.getElementById('customer-address').value.trim();
    const sp = document.getElementById('sales-person').value;
    const remarks = document.getElementById('order-remarks').value.trim();
    
    if (!name || !mobile || !address || !sp) {
        showToast('请填写完整信息（姓名、手机、地址、业务员）', 'warning');
        return;
    }
    
    if (state.cart.length === 0) {
        showToast('购物车是空的', 'warning');
        return;
    }
    
    const btn = document.getElementById('submit-order-btn');
    btn.disabled = true;
    btn.textContent = '提交中...';
    
    try {
        const data = {
            customer_name: name,
            customer_mobile: mobile,
            customer_address: address,
            sales_person: sp,
            remarks: remarks,
            items: state.cart.map(c => ({
                item_code: c.item_code,
                qty: c.qty,
                rate: 0
            }))
        };
        
        const result = await callAPI('create_customer_order', {data: JSON.stringify(data)});
        
        if (result.success) {
            showToast('订单提交成功！订单号: ' + result.order_id, 'success');
            state.cart = [];
            state.selectedItemsInCart.clear();
            saveCart();
            updateCartDisplay();
            closeModal('checkout-modal');
            closeModal('cart-modal');
            document.getElementById('customer-name').value = '';
            document.getElementById('customer-mobile').value = '';
            document.getElementById('customer-address').value = '';
            document.getElementById('sales-person').value = '';
            document.getElementById('order-remarks').value = '';
        } else {
            showToast('提交失败: ' + result.message, 'error');
        }
    } catch (e) {
        showToast('提交失败: ' + e, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '提交订单';
    }
}

function loadCart() {
    try {
        const saved = localStorage.getItem(CART_KEY);
        if (saved) state.cart = JSON.parse(saved);
    } catch (e) { state.cart = []; }
}

function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
}

function updateCartDisplay() {
    const count = state.cart.reduce((sum, c) => sum + c.qty, 0);
    
    const badge = document.getElementById('cart-badge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline' : 'none';
    }
    
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.disabled = count === 0;
    }
}

function addToCart() {
    const qty = parseInt(document.getElementById('item-qty').value) || 1;
    const item = state.selectedItem;
    if (!item) return;
    
    if (state.selectedCartIndex !== null) {
        // 编辑购物车中的产品
        if (qty > 0) {
            state.cart[state.selectedCartIndex].qty = qty;
        } else {
            // 数量为0，移除
            state.cart.splice(state.selectedCartIndex, 1);
        }
    } else {
        // 新增
        const existingIndex = state.cart.findIndex(c => c.item_code === item.item_code);
        if (existingIndex >= 0) {
            state.cart[existingIndex].qty = qty;
            if (qty <= 0) {
                state.cart.splice(existingIndex, 1);
            }
        } else if (qty > 0) {
            state.cart.push({
                item_code: item.item_code,
                item_name: item.item_name,
                qty: qty
            });
        }
    }
    
    saveCart();
    updateCartDisplay();
    closeModal('item-modal');
    
    if (state.searchResults.length > 0) {
        renderSearchResults(state.searchResults);
    }
    
    if (qty > 0) {
        showToast('已更新购物车', 'success');
    } else {
        showToast('已从购物车移除', 'success');
    }
}

function showToast(message, type) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => { toast.classList.add('show'); }, 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

window.addToCart = addToCart;
window.showCartItemDetail = showCartItemDetail;
window.removeFromCart = removeFromCart;
