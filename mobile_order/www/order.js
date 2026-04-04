// ==================== Mobile Order - Main JavaScript ====================

const state = {
    mode: 'series',
    currentStep: 'series',
    selectedSeries: null,
    selectedBrand: null,
    selectedModel: null,
    itemIndex: null,
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
    await loadItemIndex();
    await loadSalesPersons();
    bindEvents();
    loadCart();
    updateCartDisplay();
}

async function callAPI(method, args = {}) {
    return new Promise((resolve, reject) => {
        frappe.call({
            method: `mobile_order.api.${method}`,
            args: args,
            callback: function(r) {
                if (r.exc) reject(r.exc);
                else resolve(r.message);
            },
            error: function(err) { reject(err); }
        });
    });
}

async function loadItemIndex() {
    try {
        state.itemIndex = await callAPI('get_item_index');
        renderSeriesGrid();
    } catch (e) {
        showToast('加载产品数据失败', 'error');
    }
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
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() { switchMode(this.dataset.mode); });
    });
    
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', function() { goToStep(this.dataset.toStep); });
    });
    
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

function switchMode(mode) {
    state.mode = mode;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    document.getElementById('series-mode').classList.toggle('active', mode === 'series');
    document.getElementById('search-mode').classList.toggle('active', mode === 'search');
    if (mode === 'search') {
        document.getElementById('search-results').innerHTML = '<div class="empty-state"><p>输入型号进行搜索</p></div>';
    }
}

function goToStep(step) {
    state.currentStep = step;
    document.querySelectorAll('.step-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    document.getElementById(`step-${step}`).classList.add('active');
}

function renderSeriesGrid() {
    const grid = document.getElementById('series-grid');
    const series = state.itemIndex.series || [];
    if (series.length === 0) {
        grid.innerHTML = '<div class="empty-state">暂无可用系列</div>';
        return;
    }
    grid.innerHTML = series.map(s => 
        `<button class="option-btn" data-series="${escapeHtml(s)}">${escapeHtml(s)}</button>`
    ).join('');
    grid.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', function() { selectSeries(this.dataset.series); });
    });
}

function selectSeries(series) {
    state.selectedSeries = series;
    state.selectedBrand = null;
    state.selectedModel = null;
    document.getElementById('selected-series').textContent = series;
    renderBrandGrid();
    goToStep('brand');
}

function renderBrandGrid() {
    const grid = document.getElementById('brand-grid');
    const brands = state.itemIndex.brands[state.selectedSeries] || [];
    if (brands.length === 0) {
        grid.innerHTML = '<div class="empty-state">暂无可用品牌</div>';
        return;
    }
    grid.innerHTML = brands.map(b => 
        `<button class="option-btn" data-brand="${escapeHtml(b)}">${escapeHtml(b)}</button>`
    ).join('');
    grid.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', function() { selectBrand(this.dataset.brand); });
    });
}

function selectBrand(brand) {
    state.selectedBrand = brand;
    state.selectedModel = null;
    document.getElementById('selected-brand-tag').textContent = `${state.selectedSeries} / ${brand}`;
    renderModelGrid();
    goToStep('model');
}

function renderModelGrid() {
    const grid = document.getElementById('model-grid');
    const key = `${state.selectedSeries}-${state.selectedBrand}`;
    const models = state.itemIndex.models[key] || [];
    if (models.length === 0) {
        grid.innerHTML = '<div class="empty-state">暂无可用型号</div>';
        return;
    }
    grid.innerHTML = models.map(m => 
        `<button class="option-btn" data-model="${escapeHtml(m)}">${escapeHtml(m)}</button>`
    ).join('');
    grid.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', function() { selectModel(this.dataset.model); });
    });
}

function selectModel(model) {
    state.selectedModel = model;
    document.getElementById('selected-model-tag').textContent = 
        `${state.selectedSeries} / ${state.selectedBrand} / ${model}`;
    renderColorList();
    goToStep('color');
}

function renderColorList() {
    const list = document.getElementById('color-list');
    const key = `${state.selectedSeries}-${state.selectedBrand}-${state.selectedModel}`;
    const items = state.itemIndex.items[key] || [];
    if (items.length === 0) {
        list.innerHTML = '<div class="empty-state">暂无可用颜色</div>';
        return;
    }
    list.innerHTML = items.map(item => `
        <div class="color-item">
            <div class="color-info">
                <div class="color-name">${escapeHtml(item.color)}</div>
                <div class="color-code">${escapeHtml(item.item_code)}</div>
            </div>
            <button class="add-cart-btn ${isInCart(item.item_code) ? 'added' : ''}" 
                    data-item-code="${escapeHtml(item.item_code)}"
                    data-item-name="${escapeHtml(item.item_name)}">
                ${isInCart(item.item_code) ? '已添加' : '加入购物车'}
            </button>
        </div>
    `).join('');
    list.querySelectorAll('.add-cart-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            addToCart(this.dataset.itemCode, this.dataset.itemName);
        });
    });
}

async function doSearch() {
    const input = document.getElementById('search-input');
    const keyword = input.value.trim();
    if (!keyword) {
        showToast('请输入搜索关键词', 'error');
        return;
    }
    const resultsEl = document.getElementById('search-results');
    resultsEl.innerHTML = '<div class="loading">搜索中...</div>';
    try {
        const results = await callAPI('search_models', {keyword: keyword});
        if (!results || results.length === 0) {
            resultsEl.innerHTML = '<div class="empty-state">未找到匹配的型号</div>';
            return;
        }
        resultsEl.innerHTML = results.map(item => `
            <div class="search-item">
                <div class="search-item-info">
                    <div class="search-item-title">${escapeHtml(item.series)} ${escapeHtml(item.brand)} ${escapeHtml(item.model)}</div>
                    <div class="search-item-sub">${item.colors.map(c => escapeHtml(c.color)).join(' / ')}</div>
                </div>
            </div>
            <div class="color-list" style="margin-bottom: 12px;">
                ${item.colors.map(c => `
                    <div class="color-item" style="background: #f9f9f9;">
                        <div class="color-info">
                            <div class="color-name">${escapeHtml(c.color)}</div>
                            <div class="color-code">${escapeHtml(c.item_code)}</div>
                        </div>
                        <button class="add-cart-btn ${isInCart(c.item_code) ? 'added' : ''}"
                                data-item-code="${escapeHtml(c.item_code)}"
                                data-item-name="${escapeHtml(c.item_name)}">
                            ${isInCart(c.item_code) ? '已添加' : '加入'}
                        </button>
                    </div>
                `).join('')}
            </div>
        `).join('');
        resultsEl.querySelectorAll('.add-cart-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                addToCart(this.dataset.itemCode, this.dataset.itemName);
            });
        });
    } catch (e) {
        resultsEl.innerHTML = '<div class="empty-state">搜索失败，请重试</div>';
        showToast('搜索失败', 'error');
    }
}

function isInCart(itemCode) {
    return state.cart.some(item => item.item_code === itemCode);
}

function addToCart(itemCode, itemName) {
    const existing = state.cart.find(item => item.item_code === itemCode);
    if (existing) {
        showToast('该商品已在购物车', 'error');
        return;
    }
    state.cart.push({ item_code: itemCode, item_name: itemName, qty: 1 });
    saveCart();
    updateCartDisplay();
    const btn = document.querySelector(`.add-cart-btn[data-item-code="${CSS.escape(itemCode)}"]`);
    if (btn) {
        btn.classList.add('added');
        btn.textContent = '已添加';
    }
    showToast('已加入购物车', 'success');
}

function removeFromCart(itemCode) {
    state.cart = state.cart.filter(item => item.item_code !== itemCode);
    saveCart();
    updateCartDisplay();
    renderCheckoutItems();
}

function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
}

function loadCart() {
    try {
        const saved = localStorage.getItem(CART_KEY);
        if (saved) state.cart = JSON.parse(saved);
    } catch (e) { state.cart = []; }
}

function updateCartDisplay() {
    document.getElementById('cart-count').textContent = state.cart.length;
    document.getElementById('checkout-btn').disabled = state.cart.length === 0;
}

function openCheckoutModal() {
    if (state.cart.length === 0) {
        showToast('购物车是空的', 'error');
        return;
    }
    renderCheckoutItems();
    renderSalesPersonSelect();
    checkFormValid();
    openModal('checkout-modal');
}

function renderCheckoutItems() {
    const container = document.getElementById('checkout-items');
    container.innerHTML = state.cart.map(item => `
        <div class="checkout-item">
            <div class="checkout-item-info">
                <div class="checkout-item-name">${escapeHtml(item.item_name)}</div>
                <div class="checkout-item-qty">x ${item.qty}</div>
            </div>
            <button class="checkout-item-remove" data-item-code="${escapeHtml(item.item_code)}">删除</button>
        </div>
    `).join('');
    container.querySelectorAll('.checkout-item-remove').forEach(btn => {
        btn.addEventListener('click', function() { removeFromCart(this.dataset.itemCode); });
    });
}

function renderSalesPersonSelect() {
    const select = document.getElementById('sales-person-select');
    const persons = state.salesPersons || [];
    select.innerHTML = '<option value="">请选择业务员</option>' +
        persons.map(p => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`).join('');
}

function checkFormValid() {
    const customerName = document.getElementById('customer-name').value.trim();
    document.getElementById('submit-order-btn').disabled = !customerName;
}

async function submitOrder() {
    const customerName = document.getElementById('customer-name').value.trim();
    const salesPerson = document.getElementById('sales-person-select').value;
    if (!customerName) {
        showToast('请填写客户姓名', 'error');
        return;
    }
    if (state.cart.length === 0) {
        showToast('购物车是空的', 'error');
        return;
    }
    const submitBtn = document.getElementById('submit-order-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '提交中...';
    try {
        const result = await callAPI('submit_order', {
            customer_name: customerName,
            sales_person: salesPerson || null,
            items: JSON.stringify(state.cart)
        });
        if (result.success) {
            state.cart = [];
            saveCart();
            updateCartDisplay();
            document.getElementById('success-order-id').textContent = result.order_id;
            closeModal('checkout-modal');
            openModal('success-modal');
        } else {
            showToast(result.message || '提交失败', 'error');
        }
    } catch (e) {
        showToast('提交失败：' + e, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '提交订单';
    }
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast active ${type}`;
    setTimeout(() => { toast.classList.remove('active'); }, 2500);
}
