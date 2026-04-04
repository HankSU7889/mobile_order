import frappe
from frappe.model.document import Document


class SalesPerson(Document):
    """
    业务员 DocType Controller
    
    业务逻辑：
    1. 业务员姓名唯一
    2. 可关联 ERPNext User（预留字段，暂不使用）
    3. 支持启用/禁用
    """
    
    def validate(self):
        """保存前验证"""
        # 确保姓名去空格
        if self.name:
            self.name = self.name.strip()
        
        # 确保手机号格式（如果填写了的话）
        if self.mobile:
            self.mobile = self.mobile.strip()
    
    def before_insert(self):
        """插入前处理"""
        pass
    
    def after_insert(self):
        """插入后处理"""
        pass
    
    def before_save(self):
        """保存前处理"""
        pass
    
    def on_update(self):
        """更新后处理"""
        pass
    
    def on_trash(self):
        """删除前处理"""
        # 检查是否有未完成的订单关联此业务员
        orders = frappe.get_all(
            "Customer Order",
            filters={
                "sales_person": self.name,
                "order_status": ["in", ["待审核"]]
            },
            limit=1
        )
        if orders:
            frappe.throw(f"无法删除：存在待审核订单关联此业务员")
