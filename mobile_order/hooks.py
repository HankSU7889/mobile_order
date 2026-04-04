app_name = "mobile_order"
app_title = "Mobile Order"
app_publisher = "SuHongKai"
app_description = "B2B Mobile Order App for ERPNext V15"
app_email = "923918316@qq.com"
app_license = "mit"

# 翻译语言
translated_languages = ["zh"]

# DocType JS (后台管理页面用)
doctype_js = {
    "Customer Order": "/assets/mobile_order/js/customer_order.js",
}

# 网站路由配置
website_route_rules = [
    {"from_route": "/order", "to_route": "mobile_order/www/order"},
    {"from_route": "/order/admin", "to_route": "mobile_order/www/admin"},
]

# Website Generator - 创建网页
# website_generators = ["Web Page"]

# 需要的依赖 App (如无则留空)
# required_apps = []

# 定时任务 (如有需要)
# scheduler_events = {
#     "cron": {
#         "0 23 * * *": ["mobile_order.tasks.sync_items"]
#     }
# }

# Document Events (如有需要)
# doc_events = {
#     "Customer Order": {
#         "on_update": "mobile_order.api.on_order_update"
#     }
# }
