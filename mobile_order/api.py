import frappe
from frappe.utils import now_datetime, today
import json
from typing import Optional, List, Dict, Any
from functools import lru_cache


# ==================== 工具函数 ====================

def parse_item_name(item_name: str) -> Optional[Dict[str, str]]:
    """
    解析 item_name，返回系列/品牌/型号/颜色
    
    规则：
    - 按 '-' 分割
    - parts[0] = 系列
    - parts[1] = 品牌
    - parts[2] = 型号
    - parts[3:] = 颜色（可能含多个'-'，用join保留）
    
    Args:
        item_name: 如 "水晶三星-S26-透"
    
    Returns:
        dict: {
            'series': '水晶',
            'brand': '三星', 
            'model': 'S26',
            'color': '透',
            'raw': '水晶三星-S26-透'
        }
        如果格式不符合返回 None
    """
    if not item_name:
        return None
    
    parts = item_name.split('-')
    
    if len(parts) < 4:
        # 数据不规范，至少需要 4 段
        return None
    
    return {
        'series': parts[0],
        'brand': parts[1],
        'model': parts[2],
        'color': '-'.join(parts[3:]),  # 颜色可能含-
        'raw': item_name
    }


# ==================== 缓存函数 ====================

# 注意：Frappe 请求间不共享内存，这里只是减少单次请求内的重复查询


# ==================== API 接口 ====================

@frappe.whitelist()
def get_item_index() -> Dict[str, Any]:
    """
    获取完整的产品索引（带缓存）
    
    用于前端页面初始化时加载所有可选系列/品牌/型号/颜色
    
    Returns:
        dict: 产品索引结构
    """
    return _build_item_index_cached()


def _get_items_from_erp():
    """获取所有启用的 Item"""
    return frappe.get_all(
        "Item",
        filters={
            "disabled": 0,
            "item_name": ["like", "%-%-%-%"]  # 简单过滤，至少有 4 段
        },
        fields=["item_code", "item_name", "item_group", "brand"]
    )


def _build_item_index_cached() -> Dict[str, Any]:
    """
    构建产品索引（内部版本，带请求内缓存）
    """
    # 检查是否已有缓存（存储在 frappe.local）
    if hasattr(frappe.local, 'mobile_order_item_index'):
        return frappe.local.mobile_order_item_index
    
    items = _get_items_from_erp()
    
    # 构建索引
    index = {
        'series': set(),
        'brands': {},  # {series: [brands]}
        'models': {},  # {series-brand: [models]}
        'items': {}     # {series-brand-model: [{item_code, color, item_name}]}
    }
    
    for item in items:
        parsed = parse_item_name(item.item_name)
        if not parsed:
            continue
        
        series = parsed['series']
        brand = parsed['brand']
        model = parsed['model']
        color = parsed['color']
        
        # 添加系列
        index['series'].add(series)
        
        # 添加品牌
        if series not in index['brands']:
            index['brands'][series] = set()
        index['brands'][series].add(brand)
        
        # 添加型号
        key_brand = f"{series}-{brand}"
        if key_brand not in index['models']:
            index['models'][key_brand] = set()
        index['models'][key_brand].add(model)
        
        # 添加具体商品
        key_model = f"{series}-{brand}-{model}"
        if key_model not in index['items']:
            index['items'][key_model] = []
        index['items'][key_model].append({
            'item_code': item.item_code,
            'color': color,
            'item_name': item.item_name
        })
    
    # 转换 set 为 sorted list
    index['series'] = sorted(list(index['series']))
    for series in index['brands']:
        index['brands'][series] = sorted(list(index['brands'][series]))
    for key in index['models']:
        index['models'][key] = sorted(list(index['models'][key]))
    
    # 存入缓存
    frappe.local.mobile_order_item_index = index
    
    return index


@frappe.whitelist()
def get_series_list() -> List[str]:
    """
    获取所有系列列表（去重）
    
    Returns:
        list: 系列名称列表，按字母排序
    """
    index = _build_item_index_cached()
    return index['series']


@frappe.whitelist()
def get_brands_by_series(series: str) -> List[str]:
    """
    获取指定系列下的品牌列表
    
    Args:
        series: 系列名称
    
    Returns:
        list: 品牌名称列表
    """
    if not series:
        return []
    
    index = _build_item_index_cached()
    return index['brands'].get(series, [])


@frappe.whitelist()
def get_models(series: str = None, brand: str = None) -> List[str]:
    """
    获取指定系列/品牌下的型号列表
    
    Args:
        series: 系列名称（可选）
        brand: 品牌名称（可选）
    
    Returns:
        list: 型号名称列表
    """
    if not series and not brand:
        # 返回所有型号
        index = _build_item_index_cached()
        all_models = set()
        for key, models in index['models'].items():
            all_models.update(models)
        return sorted(list(all_models))
    
    if series and brand:
        key = f"{series}-{brand}"
        index = _build_item_index_cached()
        return index['models'].get(key, [])
    
    return []


@frappe.whitelist()
def get_colors(series: str, brand: str, model: str) -> List[Dict[str, str]]:
    """
    获取指定型号的所有颜色变体
    
    Args:
        series: 系列名称
        brand: 品牌名称
        model: 型号名称
    
    Returns:
        list: [{item_code, color, item_name}, ...]
    """
    if not all([series, brand, model]):
        return []
    
    key = f"{series}-{brand}-{model}"
    index = _build_item_index_cached()
    return index['items'].get(key, [])


@frappe.whitelist()
def search_models(keyword: str) -> List[Dict[str, Any]]:
    """
    搜索型号（模糊匹配）
    
    Args:
        keyword: 搜索关键词
    
    Returns:
        list: 匹配的商品列表
    """
    if not keyword or len(keyword) < 1:
        return []
    
    keyword = keyword.strip().upper()
    
    # 使用缓存的索引，只查询一次
    index = _build_item_index_cached()
    
    results = []
    seen_keys = set()
    
    # 遍历所有商品进行匹配
    for key, items_list in index['items'].items():
        parts = key.split('-')
        if len(parts) < 3:
            continue
        
        series = parts[0]
        brand = parts[1]
        model = parts[2]
        
        # 检查型号是否匹配
        if keyword in model.upper():
            if key not in seen_keys:
                seen_keys.add(key)
                results.append({
                    'series': series,
                    'brand': brand,
                    'model': model,
                    'colors': items_list
                })
    
    return results


@frappe.whitelist()
def get_item_by_code(item_code: str) -> Optional[Dict[str, Any]]:
    """
    根据 item_code 获取 Item 详情
    
    Args:
        item_code: 物料代码
    
    Returns:
        dict: Item 详情，包含解析后的信息
    """
    if not item_code:
        return None
    
    item = frappe.get_doc("Item", item_code)
    parsed = parse_item_name(item.item_name)
    
    if not parsed:
        return None
    
    return {
        'item_code': item.item_code,
        'item_name': item.item_name,
        'series': parsed['series'],
        'brand': parsed['brand'],
        'model': parsed['model'],
        'color': parsed['color']
    }


# ==================== 订单 API ====================

@frappe.whitelist()
def submit_order(customer_name: str, sales_person: str = None, 
                 items: str = None) -> Dict[str, Any]:
    """
    提交客户订单
    
    Args:
        customer_name: 客户姓名
        sales_person: 业务员姓名（可选）
        items: 商品列表 JSON 字符串，格式：
               [{"item_code": "ITM001", "qty": 1}, ...]
    
    Returns:
        dict: {"success": True, "order_id": "CO-2026-04-0001"}
    """
    if not customer_name:
        frappe.throw("请填写客户姓名")
    
    customer_name = customer_name.strip()
    
    # 解析商品列表
    if items:
        try:
            items_list = json.loads(items)
        except json.JSONDecodeError:
            frappe.throw("商品数据格式错误")
    else:
        items_list = []
    
    if not items_list:
        frappe.throw("请选择至少一个商品")
    
    # 验证所有商品是否存在
    for item_data in items_list:
        if not item_data.get("item_code"):
            frappe.throw("商品代码不能为空")
        if not frappe.db.exists("Item", item_data.get("item_code")):
            frappe.throw(f"商品 {item_data.get('item_code')} 不存在")
    
    # 创建订单
    order = frappe.new_doc("Customer Order")
    order.customer_name = customer_name
    order.sales_person = sales_person
    order.order_status = "待审核"
    
    # 添加订单明细
    for item_data in items_list:
        order.append("items", {
            "item_code": item_data.get("item_code"),
            "item_name": item_data.get("item_name", ""),
            "qty": item_data.get("qty", 1)
        })
    
    # 保存订单（不再调用 submit，保持草稿状态等待审核）
    order.insert()
    order.save()
    
    return {
        "success": True,
        "order_id": order.name,
        "message": "订单提交成功，请等待审核"
    }


@frappe.whitelist()
def get_order_status(order_id: str) -> Optional[Dict[str, Any]]:
    """
    查询订单状态
    
    Args:
        order_id: 订单编号
    
    Returns:
        dict: 订单状态信息
    """
    if not order_id:
        return None
    
    try:
        order = frappe.get_doc("Customer Order", order_id)
        return {
            "order_id": order.name,
            "customer_name": order.customer_name,
            "order_status": order.order_status,
            "items": [
                {
                    "item_code": item.item_code,
                    "item_name": item.item_name,
                    "qty": item.qty
                }
                for item in order.items
            ],
            "creation": str(order.creation)
        }
    except frappe.DoesNotExistError:
        return None


# ==================== 后台管理 API ====================

@frappe.whitelist()
def get_pending_orders() -> List[Dict[str, Any]]:
    """
    获取待审核订单列表
    
    Returns:
        list: 待审核订单列表
    """
    orders = frappe.get_all(
        "Customer Order",
        filters={
            "order_status": "待审核"
        },
        fields=["name", "customer_name", "sales_person", "creation"],
        order_by="creation desc"
    )
    
    for order in orders:
        # 获取订单明细数量
        items = frappe.get_all(
            "Customer Order Item",
            filters={"parent": order["name"]},
            fields=["qty"]
        )
        order["total_qty"] = sum(item["qty"] for item in items)
        order["creation"] = str(order["creation"])
    
    return orders


@frappe.whitelist()
def get_all_orders(status: str = None) -> List[Dict[str, Any]]:
    """
    获取所有订单，可按状态筛选
    
    Args:
        status: 订单状态筛选（可选）
    
    Returns:
        list: 订单列表
    """
    filters = {}
    if status:
        filters["order_status"] = status
    
    orders = frappe.get_all(
        "Customer Order",
        filters=filters,
        fields=["name", "customer_name", "sales_person", "order_status", "creation"],
        order_by="creation desc"
    )
    
    for order in orders:
        items = frappe.get_all(
            "Customer Order Item",
            filters={"parent": order["name"]},
            fields=["qty"]
        )
        order["total_qty"] = sum(item["qty"] for item in items)
        order["creation"] = str(order["creation"])
    
    return orders


@frappe.whitelist()
def approve_order(order_id: str) -> Dict[str, Any]:
    """
    审核通过订单
    
    Args:
        order_id: 订单编号
    
    Returns:
        dict: {"success": True, "message": "...", "sales_order": "SO-..."}
    """
    if not order_id:
        frappe.throw("订单号不能为空")
    
    order = frappe.get_doc("Customer Order", order_id)
    
    if order.order_status != "待审核":
        frappe.throw("只能审核待处理的订单")
    
    # TODO: 生成 Sales Order
    # 后续实现：
    # so = frappe.new_doc("Sales Order")
    # so.customer = "_B2C_Customer"  # 或创建 Customer
    # so.custom_sales_person = order.sales_person
    # for item in order.items:
    #     so.append("items", {
    #         "item_code": item.item_code,
    #         "qty": item.qty
    #     })
    # so.insert()
    # so.submit()
    
    # 更新订单状态
    order.order_status = "已确认"
    order.save()
    
    return {
        "success": True,
        "message": "订单已审核通过",
        "order_id": order.name
    }


@frappe.whitelist()
def reject_order(order_id: str, reason: str = None) -> Dict[str, Any]:
    """
    审核拒绝订单
    
    Args:
        order_id: 订单编号
        reason: 拒绝原因
    
    Returns:
        dict: {"success": True, "message": "..."}
    """
    if not order_id:
        frappe.throw("订单号不能为空")
    
    order = frappe.get_doc("Customer Order", order_id)
    
    if order.order_status != "待审核":
        frappe.throw("只能审核待处理的订单")
    
    # 更新订单状态
    order.order_status = "已拒绝"
    order.reject_reason = reason or ""
    order.save()
    
    return {
        "success": True,
        "message": "订单已拒绝",
        "order_id": order.name
    }


# ==================== 业务员管理 API ====================

@frappe.whitelist()
def get_sales_persons(active_only: bool = True) -> List[Dict[str, Any]]:
    """
    获取业务员列表
    
    Args:
        active_only: 是否只返回启用的业务员
    
    Returns:
        list: 业务员列表
    """
    filters = {}
    if active_only:
        filters["is_active"] = 1
    
    persons = frappe.get_all(
        "Sales Person",
        filters=filters,
        fields=["name", "mobile", "is_active", "employee_id"],
        order_by="name"
    )
    
    return persons


@frappe.whitelist()
def create_sales_person(name: str, mobile: str = None) -> Dict[str, Any]:
    """
    创建业务员
    
    Args:
        name: 业务员姓名
        mobile: 联系电话（可选）
    
    Returns:
        dict: {"success": True, "name": "..."}
    """
    if not name:
        frappe.throw("请填写业务员姓名")
    
    name = name.strip()
    
    # 检查是否已存在
    if frappe.db.exists("Sales Person", name):
        frappe.throw(f"业务员「{name}」已存在")
    
    doc = frappe.new_doc("Sales Person")
    doc.name = name
    if mobile:
        doc.mobile = mobile.strip()
    doc.is_active = 1
    doc.insert()
    
    return {
        "success": True,
        "name": doc.name,
        "message": f"业务员「{name}」创建成功"
    }


@frappe.whitelist()
def update_sales_person(name: str, mobile: str = None, 
                         is_active: bool = None) -> Dict[str, Any]:
    """
    更新业务员信息
    
    Args:
        name: 业务员姓名
        mobile: 联系电话（可选）
        is_active: 是否启用（可选）
    
    Returns:
        dict: {"success": True, "message": "..."}
    """
    if not name:
        frappe.throw("业务员姓名不能为空")
    
    doc = frappe.get_doc("Sales Person", name)
    
    if mobile is not None:
        doc.mobile = mobile.strip()
    
    if is_active is not None:
        doc.is_active = 1 if is_active else 0
    
    doc.save()
    
    return {
        "success": True,
        "message": f"业务员「{name}」更新成功"
    }


@frappe.whitelist()
def delete_sales_person(name: str) -> Dict[str, Any]:
    """
    删除业务员
    
    Args:
        name: 业务员姓名
    
    Returns:
        dict: {"success": True, "message": "..."}
    """
    if not name:
        frappe.throw("业务员姓名不能为空")
    
    # 检查是否有待审核订单
    pending = frappe.get_all(
        "Customer Order",
        filters={
            "sales_person": name,
            "order_status": "待审核"
        },
        limit=1
    )
    
    if pending:
        frappe.throw(f"无法删除：存在待审核订单关联此业务员")
    
    frappe.delete_doc("Sales Person", name)
    
    return {
        "success": True,
        "message": f"业务员「{name}」已删除"
    }


# ==================== 价格预留接口 ====================

@frappe.whitelist()
def get_item_price(item_code: str, customer: str = None) -> Optional[float]:
    """
    价格查询接口（预留）
    
    后续接入 ERPNext Price List 时实现：
    1. 优先用客户对应的 Price List
    2. 否则用默认 Price List
    3. 支持批量查询优化性能
    
    Args:
        item_code: 物料代码
        customer: 客户名（可选）
    
    Returns:
        float: 单价，无价格返回 None
    """
    # TODO: 接入 erpnext.selling.doctype.price_list.price_list.get_item_price
    return None


@frappe.whitelist()
def get_items_with_price(item_codes: str = None) -> List[Dict[str, Any]]:
    """
    批量获取商品及价格（预留）
    
    Args:
        item_codes: JSON 字符串的商品代码列表
    
    Returns:
        list: 商品信息及价格
    """
    # TODO: 实现批量价格查询
    return []
