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
    "Customer Order": "public/js/customer_order.js",
    "Sales Person": "public/js/sales_person.js",
}

# 网站路由
# website_generators = ["Web Page"]

# Web Template (可选，后续使用)
# web_template = "templates/web_template.html"

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

# 需要的依赖 App (如无则留空)
# required_apps = []
