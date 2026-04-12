import frappe
from frappe.model.document import Document


class CustomerOrderItem(Document):
    """
    客户订单明细 DocType Controller
    
    说明：
    这是一个 Child Table，不允许单独操作
    所有操作都通过 Parent Doc (Customer Order) 进行
    """
    pass
