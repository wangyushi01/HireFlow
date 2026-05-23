#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== AI 招聘管理平台 - 启动 ==="
echo ""

# 1. 构建前端（如果 dist 不存在或源码有更新）
if [ ! -d "frontend/dist" ] || [ "frontend/src" -nt "frontend/dist" ]; then
    echo "[1/2] 构建前端..."
    cd frontend
    npm run build 2>&1 | tail -3
    cd ..
    echo "      完成"
else
    echo "[1/2] 前端已构建，跳过 (删除 frontend/dist 可强制重新构建)"
fi

# 2. 启动后端（同时托管前端静态文件 + API）
echo "[2/2] 启动服务..."
echo ""
echo "  访问地址: http://localhost:8080"
echo "  演示账号: admin / admin"
echo "  按 Ctrl+C 停止"
echo ""

cd backend
exec python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8080 "$@"
