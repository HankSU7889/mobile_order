// ==================== Inventory Page - JavaScript ====================

let state = {
    items: [],
    total: 0,
    page: 1,
    pageSize: 200,
    itemGroups: [],
    brands: []
};

const MAX_VISIBLE_PAGES = 5;

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + (type === 'error' ? 'error' : type === 'success' ? 'success' : '');
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

async function callAPI(method, args = {}) {
    const url = '/api/method/mobile_order.api.' + method + '?' + new URLSearchParams(args);
    const response = await fetch(url);
    const data = await response.json();
    if (data.exc) throw new Error(data.exc);
    return data.message;
}

async function loadInventory(page = 1) {
    state.page = page;
    const keyword = document.getElementById('filter-keyword').value.trim();
    const itemGroup = document.getElementById('filter-group').value;
    const brand = document.getElementById('filter-brand').value;
    const includeDisabled = document.getElementById('filter-disabled').checked;

    const tbody = document.getElementById('inventory-tbody');
    tbody.innerHTML = '<tr class="loading-row"><td colspan="6">加载中...</td></tr>';

    try {
        const result = await callAPI('get_inventory_items', {
            keyword,
            item_group: itemGroup,
            brand,
            include_disabled: includeDisabled,
            page,
            page_size: state.pageSize
        });

        state.items = result.items;
        state.total = result.total;

        renderTable();
        renderPagination();
        updateStats();
    } catch (e) {
        tbody.innerHTML = '<tr class="loading-row"><td colspan="6">加载失败: ' + escapeHtml(String(e)) + '</td></tr>';
        showToast('加载失败: ' + e.message, 'error');
    }
}

function renderTable() {
    const tbody = document.getElementById('inventory-tbody');

    if (state.items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="icon">📭</div><p>没有找到符合条件的物料</p></div></td></tr>';
        return;
    }

    tbody.innerHTML = state.items.map(item => `
        <tr>
            <td><span class="item-code">${escapeHtml(item.item_code)}</span></td>
            <td class="item-name"><div class="item-name-text">${escapeHtml(item.item_name)}</div></td>
            <td>${escapeHtml(item.item_group || '-')}</td>
            <td>${item.brand ? `<span class="brand-tag">${escapeHtml(item.brand)}</span>` : '-'}</td>
            <td>${item.disabled ? '<span class="disabled-tag">已禁用</span>' : '<span class="enabled-tag">启用</span>'}</td>
            <td class="date-text">${item.modified ? new Date(item.modified).toLocaleString('zh-CN', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-'}</td>
        </tr>
    `).join('');
}

function renderPagination() {
    const totalPages = Math.ceil(state.total / state.pageSize);
    if (totalPages <= 1) {
        document.getElementById('pagination-controls').innerHTML = '';
        return;
    }

    const startPage = Math.max(1, state.page - Math.floor(MAX_VISIBLE_PAGES / 2));
    const endPage = Math.min(totalPages, startPage + MAX_VISIBLE_PAGES - 1);
    const adjustedStart = Math.max(1, endPage - MAX_VISIBLE_PAGES + 1);

    let html = `
        <button class="page-btn" onclick="loadInventory(${state.page - 1})" ${state.page === 1 ? 'disabled' : ''}>上一页</button>
    `;

    for (let p = adjustedStart; p <= endPage; p++) {
        html += `<button class="page-btn ${p === state.page ? 'active' : ''}" onclick="loadInventory(${p})">${p}</button>`;
    }

    html += `<button class="page-btn" onclick="loadInventory(${state.page + 1})" ${state.page === totalPages ? 'disabled' : ''}>下一页</button>`;

    document.getElementById('pagination-controls').innerHTML = html;
}

function updateStats() {
    const totalPages = Math.ceil(state.total / state.pageSize);
    document.getElementById('total-count').textContent = state.total.toLocaleString();
    document.getElementById('page-info').textContent = totalPages > 1 ? `第 ${state.page} / ${totalPages} 页` : '';
    document.getElementById('pagination-info').textContent =
        `第 ${(state.page - 1) * state.pageSize + 1} - ${Math.min(state.page * state.pageSize, state.total)} 条，共 ${state.total.toLocaleString()} 条`;
}

async function loadFilterOptions() {
    try {
        const [groups, brands] = await Promise.all([
            callAPI('get_inventory_item_groups'),
            callAPI('get_inventory_brands')
        ]);

        state.itemGroups = groups;
        state.brands = brands;

        const groupSelect = document.getElementById('filter-group');
        groupSelect.innerHTML = '<option value="">全部系列</option>' +
            groups.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('');

        const brandSelect = document.getElementById('filter-brand');
        brandSelect.innerHTML = '<option value="">全部品牌</option>' +
            brands.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('');
    } catch (e) {
        console.error('加载筛选选项失败:', e);
    }
}

function resetFilters() {
    document.getElementById('filter-keyword').value = '';
    document.getElementById('filter-group').value = '';
    document.getElementById('filter-brand').value = '';
    document.getElementById('filter-disabled').checked = false;
    loadInventory(1);
}

async function exportExcel() {
    const keyword = document.getElementById('filter-keyword').value.trim();
    const itemGroup = document.getElementById('filter-group').value;
    const brand = document.getElementById('filter-brand').value;
    const includeDisabled = document.getElementById('filter-disabled').checked;

    showToast('正在生成 Excel 文件...', 'info');

    try {
        const result = await callAPI('export_inventory_excel', {
            keyword,
            item_group: itemGroup,
            brand,
            include_disabled: includeDisabled
        });

        // 触发下载
        const link = document.createElement('a');
        link.href = result.file_url;
        link.download = result.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('导出成功: ' + result.filename, 'success');
    } catch (e) {
        showToast('导出失败: ' + String(e), 'error');
    }
}

// Enter key triggers search
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('filter-keyword').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') loadInventory(1);
    });

    loadFilterOptions().then(() => loadInventory(1));
});
