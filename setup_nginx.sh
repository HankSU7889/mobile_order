#!/bin/bash
# Mobile Order App - Nginx 配置脚本
# 用于禁用 mobile_order 资源的浏览器缓存
# 运行方式: sudo bash setup_nginx.sh

set -e

NGINX_CONF="/etc/nginx/conf.d/frappe-bench.conf"
BACKUP_CONF="${NGINX_CONF}.backup.$(date +%Y%m%d%H%M%S)"

echo "=== Mobile Order - Nginx 缓存配置 ==="

# 检查是否为 root
if [ "$EUID" -ne 0 ]; then
    echo "错误: 请使用 sudo 运行此脚本"
    exit 1
fi

# 备份原配置
echo "备份配置文件到: $BACKUP_CONF"
cp "$NGINX_CONF" "$BACKUP_CONF"

# 检查是否已添加 mobile_order 缓存配置
if grep -q "# mobile_order - disable cache" "$NGINX_CONF"; then
    echo "mobile_order 缓存配置已存在，无需修改"
else
    echo "添加 mobile_order 缓存配置..."
    
    # 在 location /assets { 之前插入 mobile_order 配置
    sed -i '/location \/assets {/i\	# mobile_order - disable cache\n	location /assets/mobile_order {\n		try_files $uri =404;\n		add_header Cache-Control "no-cache, no-store, must-revalidate";\n		add_header Pragma "no-cache";\n		add_header Expires "0";\n	}\n' "$NGINX_CONF"
    
    echo "配置已添加"
fi

# 测试 nginx 配置
echo "测试 nginx 配置..."
nginx -t

# 重新加载 nginx
echo "重新加载 nginx..."
systemctl reload nginx

echo "=== 完成 ==="
echo "mobile_order 资源现在使用 no-cache 头，客户刷新即可获取最新版本"
