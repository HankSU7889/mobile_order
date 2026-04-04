// ==================== Mobile Order - Main JavaScript ====================

// 全局状态
const state = {
    mode: 'series',  // 'series' or 'search'
    currentStep: 'series',  // 'series', 'brand', 'model', 'color'
    selectedSeries: null,
    selectedBrand: null,
    selectedModel: null,
    itemIndex: null,
    cart: [],  // [{item_code, item_name, qty}]
    salesPersons: []
};

// LocalStorage key
const CART_KEY = 'mobile_order_cart';

// ==================== 工具函数 ====================

/**
 * HTML 转义，防止 XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

async function initApp() {
    // 加载产品索引
    await loadItemIndex();
    
    // 加载业务员列表
    await loadSalesPersons();
    
    // 绑定事件
    bindEvents();
    
    // 恢复购物车
    loadCart();
    
    // 更新购物车显示
    updateCartDisplay();
}

// ==================== API 调用 ====================

async function callAPI(method, args = {}) {
    return new Promise((resolve, reject) => {
        frappe.call({
            method: `mobile_order.api.${method}`,
            args: args,
            callback: function(r) {
                if (r.exc) {
                    reject(r.exc);
                } else {
                    resolve(r.message);
                }
            },
            error: function(err) {
                reject(err);
            }
        });
    });
}

async function loadItemIndex() {
    try {
        state.itemIndex = await callAPI('get_item_index');
        renderSeriesGrid();
    } catch (e) {
        showToast('加载产品数据失败', 'error');
        console.error(e);
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

// ==================== 事件绑定 ====================

function bindEvents() {
    // Tab 切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            switchMode(this.dataset.mode);
        });
    });
    
    // 返回按钮
    document.querySelectorAll('.back-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            goToStep(this.dataset.toStep);
        });
    });
    
    // 搜索按钮
    document.getElementById('search-btn').addEventListener('click', doSearch);
    document.getElementById('search-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') doSearch();
    });
    
    // 结算按钮
    document.getElementById('checkout-btn').addEventListener('click', openCheckoutModal);
    
    // 提交订单按钮
    document.getElementById('submit-order-btn').addEventListener('click', submitOrder);
    
    // Modal 关闭
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', function() {
            closeModal(this.dataset.close);
        });
    });
    
    // Modal 点击外部关闭
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        });
    });
    
    // 客户姓名输入检测
    document.getElementById('customer-name').addEventListener('input', checkFormValid);
}

// ==================== 模式切换 ====================

function switchMode(mode) {
    state.mode = mode;
    
    // 更新 Tab 状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    // 更新内容显示
    document.getElementById('series-mode').classList.toggle('active', mode === 'series');
    document.getElementById('search-mode').classList.toggle('active', mode === 'search');
    
    // 如果切换到搜索模式，清空搜索结果
    if (mode === 'search') {
        document.getElementById('search-results').innerHTML = '<div class="empty-state"><p>输入型号进行搜索</p></div>';
    }
}

// ==================== Step 导航 ====================

function goToStep(step) {
    state.currentStep = step;
    
    // 隐藏所有 step panels
    document.querySelectorAll('.step-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    // 显示目标 step
    document.getElementById(`step-${step}`).classList.add('active');
}

// ==================== 渲染系列选择 ====================

function renderSeriesGrid() {
    const grid = document.getElementById('series-grid');
    const series = state.itemIndex.series || [];
    
    if (series.length === 0) {
        grid.innerHTML = '<div class="empty-state">暂无可用系列</div>';
        return;
    }
    
    grid.innerHTML = series.map(s => `
        <button class="option-btn" data-series="${escapeHtml(s)}">${escapeHtml(s)}</button>
    `).join('');
    
    // 绑定点击事件
    grid.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            selectSeries(this.dataset.series);
        });
    });
}

// ==================== 选择系列 ====================

function selectSeries(series) {
    state.selectedSeries = series;
    state.selectedBrand = null;
    state.selectedModel = null;
    
    // 更新显示
    document.getElementById('selected-series').textContent = series;
    
    // 渲染品牌列表
    renderBrandGrid();
    
    // 跳转到品牌选择
    goToStep('brand');
}

function renderBrandGrid() {
    const grid = document.getElementById('brand-grid');
    const brands = state.itemIndex.brands[state.selectedSeries] || [];
    
    if (brands.length === 0) {
        grid.innerHTML = '<div class="empty-state">暂无可用品牌</div>';
        return;
    }
    
    grid.innerHTML = brands.map(b => `
        <button class="option-btn" data-brand="${escapeHtml(b)}">${escapeHtml(b)}</button>
    `).join('');
    
    grid.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            selectBrand(this.dataset.brand);
        });
    });
}

// ==================== 选择品牌 ====================

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
    
    grid.innerHTML = models.map(m => `
        <button class="option-btn" data-model="${escapeHtml(m)}">${escapeHtml(m)}</button>
    `).join('');
    
    grid.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            selectModel(this.dataset.model);
        });
    });
}

// ==================== 选择型号 ====================

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
        <div class="color-item" data-item-code="${escapeHtml(item.item_code)}">
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

// ==================== 搜索模式 ====================

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
                    <div class="search-item-sub">
                        ${item.colors.map(c => escapeHtml(c.color)).join(' / ')}
                    </div>
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
        
        // 绑定加入购物车事件
        resultsEl.querySelectorAll('.add-cart-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                addToCart(this.dataset.itemCode, this.dataset.itemName);
            });
        });
        
    } catch (e) {
        resultsEl.innerHTML = '<div class="empty-state">搜索失败，请重试</div>';
        showToast('搜索失败', 'error');
        console.error(e);
    }
}

// ==================== 购物车 ====================

function isInCart(itemCode) {
    return state.cart.some(item => item.item_code === itemCode);
}

function addToCart(itemCode, itemName) {
    // 检查是否已在购物车
    const existing = state.cart.find(item => item.item_code === itemCode);
    if (existing) {
        showToast('该商品已在购物车', 'error');
        return;
    }
    
    // 添加到购物车
    state.cart.push({
        item_code: itemCode,
        item_name: itemName,
        qty: 1
    });
    
    // 保存到 LocalStorage
    saveCart();
    
    // 更新显示
    updateCartDisplay();
    
    // 如果在颜色选择页，更新按钮状态
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
        if (saved) {
            state.cart = JSON.parse(saved);
        }
    } catch (e) {
        state.cart = [];
    }
}

function updateCartDisplay() {
    const count = state.cart.length;
    document.getElementById('cart-count').textContent = count;
    document.getElementById('checkout-btn').disabled = count === 0;
}

function getCartTotalQty() {
    return state.cart.reduce((sum, item) => sum + item.qty, 0);
}

// ==================== 结算 ====================

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
        btn.addEventListener('click', function() {
            removeFromCart(this.dataset.itemCode);
        });
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
    const submitBtn = document.getElementById('submit-order-btn');
    submitBtn.disabled = !customerName;
}

// ==================== 提交订单 ====================

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
            // 清空购物车
            state.cart = [];
            saveCart();
            updateCartDisplay();
            
            // 显示成功
            document.getElementById('success-order-id').textContent = result.order_id;
            closeModal('checkout-modal');
            openModal('success-modal');
        } else {
            showToast(result.message || '提交失败', 'error');
        }
        
    } catch (e) {
        showToast('提交失败：' + e, 'error');
        console.error(e);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '提交订单';
    }
}

// ==================== Modal 辅助 ====================

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// ==================== Toast 提示 ====================

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast active ${type}`;
    
    setTimeout(() => {
        toast.classList.remove('active');
    }, 2500);
}

// ==================== 工具函数 ====================

// 格式化日期
function formatDate(dateStr) {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
