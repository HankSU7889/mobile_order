import frappe
from typing import Optional, List, Dict, Any

@frappe.whitelist(allow_guest=True)
def get_item_index() -> Dict[str, Any]:
    if hasattr(frappe.local, 'mobile_order_item_index'):
        return frappe.local.mobile_order_item_index
    
    items = frappe.get_all(
        'Item',
        filters={'disabled': 0},
        fields=['item_code', 'item_name', 'item_group', 'brand']
    )
    
    index = {}
    for item in items:
        if not item.item_name:
            continue
        parts = item.item_name.split('-')
        series = parts[0] if parts else item.item_name
        
        if series not in index:
            index[series] = []
        index[series].append({
            'item_code': item.item_code,
            'item_name': item.item_name,
            'item_group': item.item_group or '',
            'brand': item.brand or ''
        })
    
    frappe.local.mobile_order_item_index = index
    return index


@frappe.whitelist(allow_guest=True)
def search_items(keyword: str) -> List[Dict[str, Any]]:
    if not keyword or len(keyword) < 1:
        return []
    
    keyword = keyword.strip()
    
    items = frappe.get_all(
        'Item',
        filters={
            'disabled': 0,
            'item_name': ['like', '%{0}%'.format(keyword)]
        },
        fields=['item_code', 'item_name', 'item_group', 'brand'],
        order_by='item_name'
    )
    
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
        item = frappe.get_doc('Item', item_code)
        return {
            'item_code': item.item_code,
            'item_name': item.item_name,
            'item_group': item.item_group,
            'brand': item.brand,
        }
    except Exception:
        return None


@frappe.whitelist(allow_guest=True)
def get_sales_persons(active_only: bool = True) -> List[Dict[str, Any]]:
    filters = {}
    if active_only:
        filters['enabled'] = 1
    sales_persons = frappe.get_all(
        'Sales Person',
        filters=filters,
        fields=['name', 'sales_person_name', 'employee', 'department', 'enabled'],
        order_by='sales_person_name'
    )
    return sales_persons


@frappe.whitelist(allow_guest=True)
def create_customer_order(data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        so = frappe.get_doc({
            'doctype': 'Sales Order',
            'customer_name': data.get('customer_name'),
            'naming_series': 'SO-MO-',
            'order_type': 'Sales',
            'items': []
        })
        
        for item_data in data.get('items', []):
            so.append('items', {
                'item_code': item_data.get('item_code'),
                'qty': item_data.get('qty', 1),
                'rate': item_data.get('rate', 0),
            })
        
        so.insert()
        so.submit()
        
        return {
            'success': True,
            'order_id': so.name,
            'message': '订单 {0} 已创建'.format(so.name)
        }
    except Exception as e:
        return {
            'success': False,
            'order_id': None,
            'message': str(e)
        }


@frappe.whitelist(allow_guest=True)
def get_customer_orders(sales_person: str = None, status: str = None) -> List[Dict[str, Any]]:
    filters = {}
    if sales_person:
        filters['sales_person'] = sales_person
    if status:
        filters['status'] = status
    
    orders = frappe.get_all(
        'Sales Order',
        filters=filters,
        fields=['name', 'customer_name', 'mobile_no', 'sales_person', 'status', 'grand_total', 'creation'],
        order_by='creation desc',
        limit=100
    )
    return orders
