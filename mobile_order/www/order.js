// ==================== Mobile Order - Main JavaScript ====================

const state = {
    mode: 'search',
    selectedItem: null,
    searchResults: [],
    cart: [],
    salesPersons: []
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
    document.getElementById('checkout-btn').addEventListener('click', openCheckoutModal);
    document.getElementById('submit-order-btn').addEventListener('click', submitOrder);
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', function() { closeModal(this.dataset.close); });
    });
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) this.classList.remove('active');
        });
    });
    // 表单输入时检查有效性
    document.getElementById('customer-name').addEventListener('input', checkFormValid);
    document.getElementById('customer-mobile').addEventListener('input', checkFormValid);
    document.getElementById('customer-address').addEventListener('input', checkFormValid);
    document.getElementById('sales-person').addEventListener('change', checkFormValid);
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
            // 如果点击的是添加按钮
            if (e.target.classList.contains('add-btn')) {
                const itemCode = this.dataset.itemCode;
                const item = results.find(i => i.item_code === itemCode);
                if (item) {
                    // 快速添加1件
                    quickAddToCart(item);
                }
            } else {
                // 点击卡片查看详情
                const itemCode = this.dataset.itemCode;
                const item = results.find(i => i.item_code === itemCode);
                if (item) selectItem(item);
            }
        });
    });
}

// 快速添加产品到购物车
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
    // 重新渲染搜索结果以更新徽章
    renderSearchResults(state.searchResults);
    showToast('已添加: ' + item.item_name, 'success');
}

function selectItem(item) {
    state.selectedItem = item;
    const cartItem = state.cart.find(c => c.item_code === item.item_code);
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
            '<button class="checkout-item-remove" data-index="' + i + '">删除</button>' +
            '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
    
    container.querySelectorAll('.checkout-item-remove').forEach(btn => {
        btn.addEventListener('click', function() {
            const idx = parseInt(this.dataset.index);
            state.cart.splice(idx, 1);
            saveCart();
            updateCartDisplay();
            renderCheckoutItems();
            checkFormValid();
        });
    });
}

function checkFormValid() {
    const name = document.getElementById('customer-name').value.trim();
    const mobile = document.getElementById('customer-mobile').value.trim();
    const address = document.getElementById('customer-address').value.trim();
    const sp = document.getElementById('sales-person').value;
    const btn = document.getElementById('submit-order-btn');
    // 所有字段都必填
    btn.disabled = !(name && mobile && address && sp);
    
    // 更新结算按钮状态
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
            saveCart();
            updateCartDisplay();
            closeModal('checkout-modal');
            // 清空表单
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
    
    // 更新购物车徽章
    const badge = document.getElementById('cart-badge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'inline' : 'none';
    }
    
    // 更新结算按钮状态
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.disabled = count === 0;
    }
    
    // 更新购物车列表
    const list = document.getElementById('cart-items');
    if (!list) return;
    
    if (state.cart.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>购物车是空的</p></div>';
        return;
    }
    
    list.innerHTML = state.cart.map((c, i) => 
        '<div class="cart-item" data-index="' + i + '">' +
        '<div class="cart-item-info">' +
        '<div class="cart-item-name">' + escapeHtml(c.item_name) + '</div>' +
        '<div class="cart-item-qty">x ' + c.qty + '</div>' +
        '</div>' +
        '<button class="cart-item-remove" data-index="' + i + '">×</button>' +
        '</div>'
    ).join('');
    
    // 购物车项目点击可查看详情
    list.querySelectorAll('.cart-item').forEach(item => {
        item.addEventListener('click', function(e) {
            if (e.target.classList.contains('cart-item-remove')) return;
            const idx = parseInt(this.dataset.index);
            const cartItem = state.cart[idx];
            if (cartItem) {
                // 找到对应的产品
                showItemDetail(cartItem);
            }
        });
    });
    
    // 删除按钮
    list.querySelectorAll('.cart-item-remove').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const idx = parseInt(this.dataset.index);
            state.cart.splice(idx, 1);
            saveCart();
            updateCartDisplay();
        });
    });
}

// 显示产品详情
function showItemDetail(item) {
    // 先尝试从搜索结果中找到完整的产品信息
    const fullItem = state.searchResults ? state.searchResults.find(i => i.item_code === item.item_code) : null;
    if (fullItem) {
        selectItem(fullItem);
    } else {
        // 如果搜索结果中没有，创建一个基本对象
        selectItem({
            item_code: item.item_code,
            item_name: item.item_name,
            item_group: '',
            brand: null
        });
    }
}

function addToCart() {
    const qty = parseInt(document.getElementById('item-qty').value) || 1;
    const item = state.selectedItem;
    if (!item) return;
    
    // 从购物车中找到当前数量
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
    
    saveCart();
    updateCartDisplay();
    closeModal('item-modal');
    showToast(qty > 0 ? '已更新购物车' : '已从购物车移除', 'success');
    
    // 如果有搜索结果，重新渲染以更新徽章
    if (state.searchResults.length > 0) {
        renderSearchResults(state.searchResults);
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
