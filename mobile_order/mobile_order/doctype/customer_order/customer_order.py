import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime


class CustomerOrder(Document):
    """
    客户订单 DocType Controller
    
    业务逻辑：
    1. 订单号自动生成: CO-YYYY-MM-DD-####
    2. 订单状态: 待审核 → 已确认/已拒绝
    3. 审核通过后生成 ERPNext Sales Order
    4. 拒绝时需填写拒绝原因
    """
    
    def validate(self):
        """保存前验证"""
        # 确保客户姓名去空格
        if self.customer_name:
            self.customer_name = self.customer_name.strip()
        
        # 确保至少有一个商品
        if not self.items or len(self.items) == 0:
            frappe.throw("订单至少需要一个商品")
        
        # 计算商品总数量
        self.total_qty = sum(item.qty for item in self.items)
    
    def before_save(self):
        """保存前处理"""
        # 如果状态变为已确认，需要有 Sales Order 关联
        pass
    
    def on_submit(self):
        """提交后处理（审核时调用）"""
        pass
    
    def on_cancel(self):
        """取消提交"""
        # 如果已有 Sales Order，不允许取消
        if hasattr(self, 'sales_order') and self.sales_order:
            frappe.throw("此订单已生成销售订单，无法取消")
