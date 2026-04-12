# Mobile Order App

B2B 手机配件下单系统 for ERPNext V15

## 功能特性

- 📱 **移动端优先** - 专为手机设计的 H5 下单页面
- 🔄 **双模式选品** - 支持「系列优先」和「型号搜索」两种选品方式
- 🛒 **购物车** - 支持多商品下单
- 👤 **客户信息** - 填写姓名即可下单，无需登录
- 👔 **业务员选择** - 支持选择归属业务员
- ✅ **订单审核** - 后台审核通过后生成 ERPNext Sales Order
- 📊 **业务员管理** - 后台管理业务员列表

## 产品命名规则

```
{item_name} = "{系列}-{品牌}-{型号}-{颜色}"
示例: 水晶三星-S26-透
```

品牌从 item_name 自动解析，无需手动维护。

## 安装

```bash
# 进入 bench 目录
cd ~/frappe-bench

# 获取 App
bench get-app https://github.com/HankSU7889/mobile_order.git

# 安装到站点
bench --site yoursitename install-app mobile_order

# 重新编译资源
bench build --app mobile_order --force

# 重启服务
bench restart
```

## 升级

```bash
bench update --apps mobile_order --pull --reset
bench build --app mobile_order --force
bench restart
```

## 卸载

```bash
bench --site yoursitename uninstall-app mobile_order
```

## 页面访问

- 客户下单页: `/order`
- 后台管理: `/order/admin`
- 业务员管理: `/order/admin/sales_person`

## 开发说明

详见 [WORKFLOW.md](./WORKFLOW.md)

## License

MIT

## Nginx 配置（可选但推荐）

### 问题
微信/浏览器会对静态资源（JS/CSS）进行缓存，导致更新后客户仍使用旧版本。

### 解决方案
禁用 `/assets/mobile_order` 路径的缓存：



或者手动添加以下配置到 `/etc/nginx/conf.d/frappe-bench.conf`：



然后运行：


## 版本历史

- **1.0.3** - 实现缓存破坏机制，JS/CSS 使用版本化 URL
- **1.0.2** - 增强搜索：同时搜索物料名称和描述，支持缩写查询
- **1.0.1** - 新增 + 和 - 按钮支持快速增减购物车数量
- **1.0.0** - 初始版本
