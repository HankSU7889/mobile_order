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
    const seriesValue = document.getElementById('filter-series').value;
    const brand = document.getElementById('filter-brand').value;
    const status = document.getElementById('filter-status').value;

    // 区分前缀筛选（__prefix:）和精确系列筛选
    const apiParams = {
        keyword,
        brand,
        status,
        page,
        page_size: state.pageSize
    };
    if (seriesValue && seriesValue.startsWith('__prefix:')) {
        apiParams.series_prefix = seriesValue.slice(9); // 去掉 "__prefix:" 前缀
    } else if (seriesValue) {
        apiParams.product_series = seriesValue;
    }

    const tbody = document.getElementById('inventory-tbody');
    tbody.innerHTML = '<tr class="loading-row"><td colspan="6">加载中...</td></tr>';

    try {
        const result = await callAPI('get_inventory_items', apiParams);

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
        tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="icon">📭</div><p>没有找到符合条件的物料</p></div></td></tr>';
        return;
    }

    tbody.innerHTML = state.items.map(item => `
        <tr>
            <td><span class="item-code">${escapeHtml(item.item_code)}</span></td>
            <td class="item-name"><div class="item-name-text">${escapeHtml(item.item_name)}</div></td>
            <td>${escapeHtml(item.item_group || '-')}</td>
            <td>${item.disabled ? '<span class="disabled-tag">停售</span>' : '<span class="enabled-tag">在售</span>'}</td>
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
        const [prefixes, brands] = await Promise.all([
            callAPI('get_inventory_series_prefixes'),
            callAPI('get_inventory_brands')
        ]);

        state.seriesPrefixes = prefixes;
        state.brands = brands;

        // 系列下拉：只保留合并后的前缀分组
        const seriesSelect = document.getElementById('filter-series');
        seriesSelect.innerHTML = '<option value="">全部系列</option>' +
            prefixes.map(g =>
                `<option value="__prefix:${escapeHtml(g.prefix)}">${escapeHtml(g.prefix)} (${g.count}个系列)</option>`
            ).join('');

        const brandSelect = document.getElementById('filter-brand');
        brandSelect.innerHTML = '<option value="">全部品牌</option>' +
            brands.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('');
    } catch (e) {
        console.error('加载筛选选项失败:', e);
    }
}

function resetFilters() {
    document.getElementById('filter-keyword').value = '';
    document.getElementById('filter-series').value = '';
    document.getElementById('filter-brand').value = '';
    document.getElementById('filter-status').value = '';
    loadInventory(1);
}

async function exportExcel() {
    const keyword = document.getElementById('filter-keyword').value.trim();
    const seriesValue = document.getElementById('filter-series').value;
    const brand = document.getElementById('filter-brand').value;
    const status = document.getElementById('filter-status').value;

    const apiParams = { keyword, brand, status };
    if (seriesValue && seriesValue.startsWith('__prefix:')) {
        apiParams.series_prefix = seriesValue.slice(9);
    } else if (seriesValue) {
        apiParams.product_series = seriesValue;
    }

    showToast('正在生成 Excel 文件...', 'info');

    try {
        const result = await callAPI('export_inventory_excel', apiParams);

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
