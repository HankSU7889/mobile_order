import frappe
from typing import Optional, List, Dict, Any


@frappe.whitelist(allow_guest=True)
def get_item_index() -> Dict[str, Any]:
    if hasattr(frappe.local, 'mobile_order_item_index'):
        return frappe.local.mobile_order_item_index

    # 只获取变体产品(variant_of IS NOT NULL 且非空),排除模板
    items = frappe.get_all(
        "Item",
        filters={"disabled": 0, "variant_of": ["not like", ""]},
        fields=["item_code", "item_name", "item_group", "brand", "description"]
    )

    index = {}
    for item in items:
        if not item.item_name:
            continue
        parts = item.item_name.split("-")
        series = parts[0] if parts else item.item_name

        if series not in index:
            index[series] = []
        index[series].append({
            "item_code": item.item_code,
            "item_name": item.item_name,
            "item_group": item.item_group or "",
            "brand": item.brand or "",
            "description": item.description or ""
        })

    frappe.local.mobile_order_item_index = index
    return index


@frappe.whitelist(allow_guest=True)
def search_items(keyword: str) -> List[Dict[str, Any]]:
    if not keyword or len(keyword) < 1:
        return []

    keyword = keyword.strip()

    # 搜索变体产品(排除模板),同时匹配 item_name 和 description
    items = frappe.db.sql("""
        SELECT item_code, item_name, item_group, brand, description
        FROM tabItem
        WHERE disabled = 0
        AND variant_of IS NOT NULL AND variant_of != ''
        AND (item_name LIKE %s OR description LIKE %s)
        ORDER BY item_name
    """, ("%" + keyword + "%", "%" + keyword + "%"), as_dict=1)

    return items


@frappe.whitelist(allow_guest=True)
def get_all_series() -> List[str]:
    index = get_item_index()
    return sorted(index.keys())


@frappe.whitelist(allow_guest=True)
def get_items_by_series(series: str) -> List[Dict[str, Any]]:
    if not series:
        return []
    index = get_item_index()
    return index.get(series, [])


@frappe.whitelist(allow_guest=True)
def get_item_by_code(item_code: str) -> Optional[Dict[str, Any]]:
    if not item_code:
        return None
    try:
        item = frappe.get_doc("Item", item_code)
        return {
            "item_code": item.item_code,
            "item_name": item.item_name,
            "item_group": item.item_group,
            "brand": item.brand,
            "description": item.description or ""
        }
    except Exception:
        return None


@frappe.whitelist(allow_guest=True)
def get_sales_persons(active_only: bool = True) -> List[Dict[str, Any]]:
    filters = {}
    if active_only:
        filters["enabled"] = 1
    sales_persons = frappe.get_all(
        "Sales Person",
        filters=filters,
        fields=["name", "sales_person_name", "employee", "department", "enabled"],
        order_by="sales_person_name"
    )
    return sales_persons


@frappe.whitelist(allow_guest=True)
def create_customer_order(data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        so = frappe.get_doc({
            "doctype": "Sales Order",
            "customer_name": data.get("customer_name"),
            "naming_series": "SO-MO-",
            "order_type": "Sales",
            "items": []
        })

        for item_data in data.get("items", []):
            so.append("items", {
                "item_code": item_data.get("item_code"),
                "qty": item_data.get("qty", 1),
                "rate": item_data.get("rate", 0),
            })

        so.insert()
        so.submit()

        return {
            "success": True,
            "order_id": so.name,
            "message": "订单 {0} 已创建".format(so.name)
        }
    except Exception as e:
        return {
            "success": False,
            "order_id": None,
            "message": str(e)
        }


@frappe.whitelist(allow_guest=True)
def get_customer_orders(sales_person: str = None, status: str = None) -> List[Dict[str, Any]]:
    filters = {}
    if sales_person:
        filters["sales_person"] = sales_person
    if status:
        filters["status"] = status

    orders = frappe.get_all(
        "Sales Order",
        filters=filters,
        fields=["name", "customer_name", "mobile_no", "sales_person", "status", "grand_total", "creation"],
        order_by="creation desc",
        limit=100
    )
    return orders


@frappe.whitelist(allow_guest=True)
def get_inventory_items(
    keyword: str = "",
    item_group: str = "",
    brand: str = "",
    include_disabled: bool = False,
    page: int = 1,
    page_size: int = 200
) -> Dict[str, Any]:
    """
    获取库存物料列表，支持搜索、过滤、分页
    """
    filters = []
    params = []

    if not include_disabled:
        filters.append("disabled = %s")
        params.append(0)

    if keyword:
        filters.append("(item_name LIKE %s OR item_code LIKE %s OR brand LIKE %s)")
        params.extend(["%" + keyword + "%", "%" + keyword + "%", "%" + keyword + "%"])

    if item_group:
        filters.append("item_group = %s")
        params.append(item_group)

    if brand:
        filters.append("brand = %s")
        params.append(brand)

    where_clause = " AND ".join(filters) if filters else "1=1"

    # 获取总数
    total = frappe.db.sql(f"""SELECT COUNT(*) as cnt FROM tabItem WHERE {where_clause}""", tuple(params), as_dict=1)[0].cnt

    # 获取分页数据
    offset = (page - 1) * page_size
    items = frappe.db.sql(f"""
        SELECT item_code, item_name, item_group, brand, description, disabled, modified
        FROM tabItem
        WHERE {where_clause}
        ORDER BY modified DESC
        LIMIT %s OFFSET %s
    """, tuple(params + [page_size, offset]), as_dict=1)

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@frappe.whitelist(allow_guest=True)
def get_inventory_item_groups() -> List[str]:
    groups = frappe.get_all("Item Group", fields=["name"], order_by="name")
    return [g.name for g in groups]


@frappe.whitelist(allow_guest=True)
def get_inventory_brands() -> List[str]:
    brands = frappe.get_all("Item", fields=["brand"], distinct=True, filters={"brand": ["!=", ""]})
    return [b.brand for b in brands if b.brand]


@frappe.whitelist(allow_guest=True)
def export_inventory_excel(keyword: str = "", item_group: str = "", brand: str = "", include_disabled: bool = False) -> Dict[str, Any]:
    """导出库存数据为 Excel（后端生成文件）"""
    import openpyxl
    from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
    from frappe.utils import now_datetime
    import io

    filters = []
    params = []

    if not include_disabled:
        filters.append("disabled = %s")
        params.append(0)
    if keyword:
        filters.append("(item_name LIKE %s OR item_code LIKE %s OR brand LIKE %s)")
        params.extend(["%" + keyword + "%", "%" + keyword + "%", "%" + keyword + "%"])
    if item_group:
        filters.append("item_group = %s")
        params.append(item_group)
    if brand:
        filters.append("brand = %s")
        params.append(brand)

    where_clause = " AND ".join(filters) if filters else "1=1"
    items = frappe.db.sql(f"""
        SELECT item_code, item_name, item_group, brand, description, disabled, modified
        FROM tabItem
        WHERE {where_clause}
        ORDER BY modified DESC
    """, tuple(params), as_dict=1)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "库存数据"

    # 表头样式
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="1890FF")
    header_alignment = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style="thin"), right=Side(style="thin"),
        top=Side(style="thin"), bottom=Side(style="thin")
    )

    headers = ["物料编码", "物料名称", "产品系列", "品牌", "描述", "状态", "最后修改"]
    ws.append(headers)
    for col_idx, cell in enumerate(ws[1], 1):
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
        cell.border = thin_border

    for row in items:
        ws.append([
            row.item_code,
            row.item_name,
            row.item_group or "",
            row.brand or "",
            row.description or "",
            "已禁用" if row.disabled else "启用",
            row.modified.strftime("%Y-%m-%d %H:%M") if row.modified else ""
        ])

    for row in ws.iter_rows(min_row=2):
        for cell in row:
            cell.border = thin_border
            cell.alignment = Alignment(vertical="center")

    for col in ws.columns:
        max_length = max((len(str(cell.value or "")) for cell in col if cell.value), default=10)
        ws.column_dimensions[col[0].column_letter].width = min(max_length + 4, 50)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"inventory_export_{now_datetime().strftime('%Y%m%d_%H%M%S')}.xlsx"
    # 保存到 sites files
    from frappe.utils.file_manager import save_file
    from frappe.core.doctype.file.file import get_content_hash

    file = save_file(filename, output.getvalue(), "File", None, is_private=0)

    return {"file_url": file.file_url, "filename": filename}
