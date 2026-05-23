# AI 招聘管理平台

智能化招聘数据分析与决策系统。支持简历上传解析、候选人管理、招聘漏斗分析、AI 智能洞察等功能。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Vite + Ant Design 5 |
| 后端 | FastAPI + SQLAlchemy + SQLite |
| 认证 | JWT (HS256) + bcrypt + SHA-256 |
| AI | DeepSeek API (OpenAI 兼容) |
| 图表 | Recharts |

## 快速开始

### 1. 环境要求

- Node.js >= 22
- Python >= 3.10
- npm >= 9

### 2. 安装依赖

```bash
cd HireFlow

# 后端
cd backend
pip install -r requirements.txt
cp .env.example .env
cd ..

# 前端
cd frontend
npm install
cd ..
```

### 3. 配置环境变量

编辑 `backend/.env`，填入 DeepSeek API Key：

```env
OPENAI_API_KEY=sk-your-deepseek-api-key
OPENAI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-v4-flash
```

| 变量 | 必填 | 说明 |
|------|------|------|
| `OPENAI_API_KEY` | 是 | DeepSeek API Key，从 [platform.deepseek.com](https://platform.deepseek.com) 获取 |
| `OPENAI_BASE_URL` | 是 | API 地址，DeepSeek 填 `https://api.deepseek.com` |
| `AI_MODEL` | 否 | 模型名称，默认 `deepseek-v4-flash` |

### 4. 启动项目

#### 方式一：一键启动（推荐）

自动构建前端并启动后端，后端同时托管前端静态文件和 API。

```bash
./start.sh
```

启动后访问 `http://localhost:8080`

#### 方式二：前后端分离启动（开发模式）

适合开发时使用，前端支持热更新。

```bash
# 终端 1 - 启动后端（端口 8080）
cd backend
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload

# 终端 2 - 启动前端（端口 5173，自动代理 API 请求到后端）
cd frontend
npm run dev
```

启动后：
- 前端访问 `http://localhost:5173`
- 后端 API `http://localhost:8080`

**默认账号**：`admin` / `admin`

## 后端依赖

| 包 | 版本 | 用途 |
|----|------|------|
| fastapi | 0.115.6 | Web 框架 |
| uvicorn | 0.34.0 | ASGI 服务器 |
| sqlalchemy | 2.0.36 | ORM |
| pydantic | 2.10.4 | 数据校验 |
| python-multipart | 0.0.20 | 文件上传 |
| python-jose | 3.5.0 | JWT 令牌 |
| bcrypt | 5.0.0 | 密码哈希 |
| openai | 1.59.3 | AI API 客户端 |
| PyPDF2 | 3.0.1 | PDF 解析 |
| python-docx | 1.1.2 | Word 解析 |
| openpyxl | 3.1.5 | Excel 导出 |
| httpx | 0.28.1 | HTTP 客户端 |
| aiofiles | 24.1.0 | 异步文件操作 |
| python-dotenv | 1.0.1 | 环境变量管理 |

## 前端依赖

| 包 | 版本 | 用途 |
|----|------|------|
| react | ^19.2 | UI 框架 |
| react-dom | ^19.2 | React DOM |
| react-router-dom | ^7.15 | 路由 |
| antd | ^5.29 | UI 组件库 |
| @ant-design/icons | ^6.0 | 图标库 |
| axios | ^1.16 | HTTP 客户端 |
| recharts | ^2.15 | 图表库 |
| react-markdown | ^10.1 | Markdown 渲染 |

## 项目结构

```
recruitment-demo/
├── start.sh                    # 一键启动脚本
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI 入口 + 前端托管 + gzip 压缩
│   │   ├── auth.py             # JWT 认证 + bcrypt
│   │   ├── database.py         # SQLite 数据库
│   │   ├── models.py           # 数据模型（含索引）
│   │   ├── ai.py               # AI 调用 + 服务端缓存
│   │   ├── routers/
│   │   │   ├── auth.py         # 登录/注册/修改密码
│   │   │   ├── candidates.py   # 候选人管理
│   │   │   ├── dashboard.py    # 数据看板
│   │   │   ├── export.py       # Excel 导出 + AI 报告
│   │   │   ├── jobs.py         # 岗位管理
│   │   │   ├── resumes.py      # 简历上传解析
│   │   │   ├── screening.py    # AI 筛选
│   │   │   └── workflow.py     # 工作流
│   │   └── services/
│   │       ├── stats.py        # 统计服务（内存缓存）
│   │       └── workflow.py     # 工作流引擎
│   ├── requirements.txt
│   ├── .env                    # 环境变量（不提交）
│   └── .env.example            # 环境变量模板
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # 路由 + 认证守卫（零 antd 依赖）
│   │   ├── AppLayout.tsx       # 主布局（侧边栏 + 顶栏）
│   │   ├── components/
│   │   │   ├── Charts.tsx      # 图表入口（懒加载）
│   │   │   ├── RechartsCharts.tsx # 统一 Recharts 渲染
│   │   │   └── AiSummary.tsx   # AI 总结（懒加载 react-markdown）
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx  # 认证状态管理
│   │   ├── pages/
│   │   │   ├── Login.tsx       # 登录页（纯 CSS，密码显示切换）
│   │   │   ├── Dashboard.tsx   # 数据看板（渐变卡片 + 按需 AI 洞察）
│   │   │   ├── ResumeUpload.tsx
│   │   │   ├── CandidateList.tsx
│   │   │   ├── CandidateDetail.tsx
│   │   │   ├── JobManage.tsx
│   │   │   ├── WorkflowRules.tsx
│   │   │   └── ChangePasswordModal.tsx
│   │   └── services/
│   │       ├── api.ts          # API 客户端 + JWT 拦截器
│   │       ├── auth.ts         # 认证 API
│   │       └── types.ts        # 类型定义
│   ├── index.html              # 内联 CSS 加载动画（首屏 0ms）
│   ├── vite.config.ts          # Vite 配置（分包 + 预构建）
│   └── package.json
└── README.md
```
# HireFlow
