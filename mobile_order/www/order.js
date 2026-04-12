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
    document.getElementById('customer-name').addEventListener('input', checkFormValid);
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
            html += '<div class="item-card" data-item-code="' + escapeHtml(item.item_code) + '">' +
                '<div class="item-name">' + escapeHtml(item.item_name) + '</div>' +
                '<div class="item-group">' + escapeHtml(item.item_group || '') + '</div>' +
                '</div>';
        });
        html += '</div></div>';
    }
    
    container.innerHTML = html;
    
    container.querySelectorAll('.item-card').forEach(card => {
        card.addEventListener('click', function() {
            const itemCode = this.dataset.itemCode;
            const item = results.find(i => i.item_code === itemCode);
            if (item) selectItem(item);
        });
    });
}

function selectItem(item) {
    state.selectedItem = item;
    document.getElementById('selected-item-name').textContent = item.item_name;
    document.getElementById('item-qty').value = 1;
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
    openModal('checkout-modal');
    checkFormValid();
}

function checkFormValid() {
    const name = document.getElementById('customer-name').value.trim();
    const mobile = document.getElementById('customer-mobile').value.trim();
    const sp = document.getElementById('sales-person').value;
    const btn = document.getElementById('submit-order-btn');
    btn.disabled = !(name && mobile && sp);
}

async function submitOrder() {
    const name = document.getElementById('customer-name').value.trim();
    const mobile = document.getElementById('customer-mobile').value.trim();
    const sp = document.getElementById('sales-person').value;
    const remarks = document.getElementById('order-remarks').value.trim();
    
    if (!name || !mobile || !sp) {
        showToast('请填写完整信息', 'warning');
        return;
    }
    
    const btn = document.getElementById('submit-order-btn');
    btn.disabled = true;
    btn.textContent = '提交中...';
    
    try {
        const data = {
            customer_name: name,
            customer_mobile: mobile,
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
            document.getElementById('customer-name').value = '';
            document.getElementById('customer-mobile').value = '';
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
    
    const list = document.getElementById('cart-items');
    if (!list) return;
    
    if (state.cart.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>购物车是空的</p></div>';
        return;
    }
    
    list.innerHTML = state.cart.map((c, i) => 
        '<div class="cart-item">' +
        '<div class="cart-item-info">' +
        '<div class="cart-item-name">' + escapeHtml(c.item_name) + '</div>' +
        '<div class="cart-item-qty">x ' + c.qty + '</div>' +
        '</div>' +
        '<button class="cart-item-remove" data-index="' + i + '">×</button>' +
        '</div>'
    ).join('');
    
    list.querySelectorAll('.cart-item-remove').forEach(btn => {
        btn.addEventListener('click', function() {
            const idx = parseInt(this.dataset.index);
            state.cart.splice(idx, 1);
            saveCart();
            updateCartDisplay();
        });
    });
}

function addToCart() {
    const qty = parseInt(document.getElementById('item-qty').value) || 1;
    const item = state.selectedItem;
    if (!item) return;
    
    const existing = state.cart.find(c => c.item_code === item.item_code);
    if (existing) {
        existing.qty += qty;
    } else {
        state.cart.push({
            item_code: item.item_code,
            item_name: item.item_name,
            qty: qty
        });
    }
    
    saveCart();
    updateCartDisplay();
    closeModal('item-modal');
    showToast('已添加到购物车', 'success');
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
