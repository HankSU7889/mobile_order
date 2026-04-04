import frappe
import os

def get_context(context):
    """后台管理页"""
    html_file = os.path.join(
        frappe.get_app_path("mobile_order"),
        "www",
        "admin.html"
    )
    with open(html_file, "r", encoding="utf-8") as f:
        context.html = f.read()
    
    context.title = "订单管理"
    context.no_header = True
    context.no_footer = True
    context.no_breadcrumbs = True
