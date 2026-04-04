import frappe
import os

def get_context(context):
    """客户下单页"""
    # 获取当前 app 的 www 目录路径
    app_path = frappe.get_app_path("mobile_order")
    www_path = os.path.join(app_path, "www", "order")
    
    # 读取 HTML 文件
    html_file = os.path.join(www_path, "index.html")
    with open(html_file, "r", encoding="utf-8") as f:
        context.html = f.read()
    
    context.title = "手机下单"
    context.layout = "Base"
