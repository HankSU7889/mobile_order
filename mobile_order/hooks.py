app_name = "mobile_order"
app_title = "Mobile Order"
app_publisher = "SuHongKai"
app_description = "B2B Mobile Order App for ERPNext V15"
app_email = "923918316@qq.com"
app_license = "mit"

# DocType JS (后台管理页面用)
doctype_js = {
    "Customer Order": "/assets/mobile_order/js/customer_order.js",
}

# 网站路由配置
# /order → order.html + order.py (在 mobile_order/www/ 下)
# /order/admin → admin.html + admin.py
website_route_rules = [
    {"from_route": "/order", "to_route": "order"},
    {"from_route": "/order/admin", "to_route": "admin"},
]

# Web/Portal 静态资源
web_include_js = [
    "/assets/mobile_order/js/order.js",
    "/assets/mobile_order/js/admin.js",
]

web_include_css = [
    "/assets/mobile_order/css/order.css",
    "/assets/mobile_order/css/admin.css",
]
