import frappe
import os

def get_context(context):
    """后台管理页"""
    # 获取当前 app 的 www 目录路径
    app_path = frappe.get_app_path("mobile_order")
    www_path = os.path.join(app_path, "www", "admin")
    
    # 读取 HTML 文件
    html_file = os.path.join(www_path, "index.html")
    with open(html_file, "r", encoding="utf-8") as f:
        context.html = f.read()
    
    context.title = "订单管理"
    context.layout = "Base"
