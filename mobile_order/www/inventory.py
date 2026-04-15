import frappe
import os

def get_context(context):
    """库存查询页面"""
    html_file = os.path.join(
        frappe.get_app_path("mobile_order"),
        "www",
        "inventory.html"
    )
    with open(html_file, "r", encoding="utf-8") as f:
        context.html = f.read()

    context.title = "库存查询"
    context.no_header = True
    context.no_footer = True
    context.no_breadcrumbs = True
