// ==================== Mobile Order - Admin JavaScript ====================

// 全局状态
const state = {
    currentTab: 'orders',
    currentOrder: null,
    orders: [],
    salesPersons: []
};

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

async function initApp() {
    bindEvents();
    await loadOrders();
    await loadSalesPersons();
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

async function loadOrders() {
    const status = document.getElementById('status-filter').value;
    const listEl = document.getElementById('orders-list');
    
    listEl.innerHTML = '<div class="loading">加载中...</div>';
    
    try {
        if (status) {
            state.orders = await callAPI('get_all_orders', {status: status});
        } else {
            state.orders = await callAPI('get_pending_orders');
        }
        renderOrders();
    } catch (e) {
        listEl.innerHTML = '<div class="empty-state">加载失败</div>';
        showToast('加载订单失败', 'error');
        console.error(e);
    }
}

async function loadSalesPersons() {
    const listEl = document.getElementById('sales-persons-list');
    
    try {
        state.salesPersons = await callAPI('get_sales_persons', {active_only: false});
        renderSalesPersons();
    } catch (e) {
        listEl.innerHTML = '<div class="empty-state">加载失败</div>';
        showToast('加载业务员失败', 'error');
        console.error(e);
    }
}

// ==================== 事件绑定 ====================

function bindEvents() {
    // Tab 切换
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });
    
    // 刷新按钮
    document.getElementById('refresh-btn').addEventListener('click', function() {
        if (state.currentTab === 'orders') {
            loadOrders();
        } else {
            loadSalesPersons();
        }
    });
    
    // 状态筛选
    document.getElementById('status-filter').addEventListener('change', loadOrders);
    
    // 新增业务员
    document.getElementById('add-sales-person-btn').addEventListener('click', function() {
        openSalesPersonModal();
    });
    
    // 保存业务员
    document.getElementById('save-sales-person-btn').addEventListener('click', saveSalesPerson);
    
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
}

// ==================== Tab 切换 ====================

function switchTab(tab) {
    state.currentTab = tab;
    
    document.querySelectorAll('.nav-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });
    
    document.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.toggle('active', p.id === `${tab}-panel`);
    });
}

// ==================== 渲染订单列表 ====================

function renderOrders() {
    const listEl = document.getElementById('orders-list');
    
    if (!state.orders || state.orders.length === 0) {
        listEl.innerHTML = '<div class="empty-state">暂无订单</div>';
        return;
    }
    
    listEl.innerHTML = state.orders.map(order => `
        <div class="order-card" data-order-id="${order.name}">
            <div class="order-card-header">
                <span class="order-id">${order.name}</span>
                <span class="order-status ${getStatusClass(order.order_status)}">${order.order_status}</span>
            </div>
            <div class="order-info">
                客户：${order.customer_name} | 业务员：${order.sales_person || '未指定'}
            </div>
            <div class="order-info">
                下单时间：${formatDateTime(order.creation)} | 商品数量：${order.total_qty}
            </div>
            <div class="order-actions">
                <button class="btn-action btn-view" data-action="view" data-order-id="${order.name}">查看</button>
                ${order.order_status === '待审核' ? `
                    <button class="btn-action btn-approve" data-action="approve" data-order-id="${order.name}">通过</button>
                    <button class="btn-action btn-reject" data-action="reject" data-order-id="${order.name}">拒绝</button>
                ` : ''}
            </div>
        </div>
    `).join('');
    
    // 绑定按钮事件
    listEl.querySelectorAll('.btn-action').forEach(btn => {
        btn.addEventListener('click', function() {
            const action = this.dataset.action;
            const orderId = this.dataset.orderId;
            
            if (action === 'view') {
                viewOrder(orderId);
            } else if (action === 'approve') {
                approveOrder(orderId);
            } else if (action === 'reject') {
                openRejectModal(orderId);
            }
        });
    });
}

function getStatusClass(status) {
    const map = {
        '待审核': 'pending',
        '已确认': 'approved',
        '已拒绝': 'rejected'
    };
    return map[status] || '';
}

// ==================== 渲染业务员列表 ====================

function renderSalesPersons() {
    const listEl = document.getElementById('sales-persons-list');
    
    if (!state.salesPersons || state.salesPersons.length === 0) {
        listEl.innerHTML = '<div class="empty-state">暂无业务员</div>';
        return;
    }
    
    listEl.innerHTML = state.salesPersons.map(sp => `
        <div class="sp-card">
            <div class="sp-info">
                <div class="sp-name">${sp.name}</div>
                <div class="sp-mobile">${sp.mobile || '未填写电话'}</div>
            </div>
            <span class="sp-status ${sp.is_active ? 'active' : 'inactive'}">
                ${sp.is_active ? '启用' : '禁用'}
            </span>
            <div class="sp-actions">
                <button class="btn-action btn-view" data-action="edit" data-name="${sp.name}">编辑</button>
                <button class="btn-action ${sp.is_active ? 'btn-reject' : 'btn-approve'}" 
                        data-action="toggle" data-name="${sp.name}">
                    ${sp.is_active ? '禁用' : '启用'}
                </button>
            </div>
        </div>
    `).join('');
    
    // 绑定按钮事件
    listEl.querySelectorAll('.btn-action').forEach(btn => {
        btn.addEventListener('click', function() {
            const action = this.dataset.action;
            const name = this.dataset.name;
            
            if (action === 'edit') {
                editSalesPerson(name);
            } else if (action === 'toggle') {
                toggleSalesPerson(name);
            }
        });
    });
}

// ==================== 订单操作 ====================

async function viewOrder(orderId) {
    try {
        const order = await callAPI('get_order_status', {order_id: orderId});
        state.currentOrder = order;
        
        const bodyEl = document.getElementById('order-detail-body');
        const actionsEl = document.getElementById('order-detail-actions');
        
        bodyEl.innerHTML = `
            <div class="detail-row">
                <span class="detail-label">订单号</span>
                <span class="detail-value">${order.order_id}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">客户姓名</span>
                <span class="detail-value">${order.customer_name}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">业务员</span>
                <span class="detail-value">${order.sales_person || '未指定'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">订单状态</span>
                <span class="detail-value">${order.order_status}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">下单时间</span>
                <span class="detail-value">${formatDateTime(order.creation)}</span>
            </div>
            <div class="detail-items">
                <strong>商品明细：</strong>
                ${order.items.map(item => `
                    <div style="padding: 4px 0;">
                        ${item.item_name} × ${item.qty}
                    </div>
                `).join('')}
            </div>
        `;
        
        if (order.order_status === '待审核') {
            actionsEl.innerHTML = `
                <button class="btn-success" onclick="approveOrder('${order.order_id}')">审核通过</button>
                <button class="btn-danger" onclick="openRejectModal('${order.order_id}')">审核拒绝</button>
            `;
        } else {
            actionsEl.innerHTML = '';
        }
        
        openModal('order-detail-modal');
        
    } catch (e) {
        showToast('加载订单详情失败', 'error');
        console.error(e);
    }
}

async function approveOrder(orderId) {
    if (!confirm('确认通过此订单？')) return;
    
    try {
        const result = await callAPI('approve_order', {order_id: orderId});
        showToast('订单已审核通过', 'success');
        closeModal('order-detail-modal');
        await loadOrders();
    } catch (e) {
        showToast('审核失败：' + e, 'error');
        console.error(e);
    }
}

function openRejectModal(orderId) {
    state.currentOrder = orderId;
    document.getElementById('reject-reason').value = '';
    openModal('reject-modal');
}

async function confirmReject() {
    const reason = document.getElementById('reject-reason').value.trim();
    const orderId = state.currentOrder;
    
    try {
        const result = await callAPI('reject_order', {
            order_id: orderId,
            reason: reason
        });
        showToast('订单已拒绝', 'success');
        closeModal('reject-modal');
        closeModal('order-detail-modal');
        await loadOrders();
    } catch (e) {
        showToast('操作失败：' + e, 'error');
        console.error(e);
    }
}

// 绑定确认拒绝按钮
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('confirm-reject-btn').addEventListener('click', confirmReject);
});

// ==================== 业务员操作 ====================

function openSalesPersonModal(name = null) {
    document.getElementById('sp-old-name').value = name || '';
    document.getElementById('sp-modal-title').textContent = name ? '编辑业务员' : '新增业务员';
    document.getElementById('sp-name').value = name || '';
    document.getElementById('sp-mobile').value = '';
    
    // 如果是编辑，填充数据
    if (name) {
        const sp = state.salesPersons.find(s => s.name === name);
        if (sp) {
            document.getElementById('sp-name').value = sp.name;
            document.getElementById('sp-mobile').value = sp.mobile || '';
        }
    }
    
    openModal('sales-person-modal');
}

function editSalesPerson(name) {
    openSalesPersonModal(name);
}

async function saveSalesPerson() {
    const oldName = document.getElementById('sp-old-name').value;
    const name = document.getElementById('sp-name').value.trim();
    const mobile = document.getElementById('sp-mobile').value.trim();
    
    if (!name) {
        showToast('请填写业务员姓名', 'error');
        return;
    }
    
    try {
        if (oldName) {
            // 更新
            await callAPI('update_sales_person', {
                name: oldName,
                mobile: mobile || null
            });
            showToast('业务员已更新', 'success');
        } else {
            // 新建
            await callAPI('create_sales_person', {
                name: name,
                mobile: mobile || null
            });
            showToast('业务员已创建', 'success');
        }
        
        closeModal('sales-person-modal');
        await loadSalesPersons();
        
    } catch (e) {
        showToast('保存失败：' + e, 'error');
        console.error(e);
    }
}

async function toggleSalesPerson(name) {
    const sp = state.salesPersons.find(s => s.name === name);
    if (!sp) return;
    
    try {
        await callAPI('update_sales_person', {
            name: name,
            is_active: !sp.is_active
        });
        showToast(`业务员已${sp.is_active ? '禁用' : '启用'}`, 'success');
        await loadSalesPersons();
    } catch (e) {
        showToast('操作失败：' + e, 'error');
        console.error(e);
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

function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
