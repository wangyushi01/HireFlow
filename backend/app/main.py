import asyncio
import hashlib
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from jose import JWTError

from .database import engine, Base, SessionLocal
from .auth import decode_token, hash_password
from .models import Job, WorkflowRule, User
from .routers import auth, candidates, dashboard, export, jobs, resumes, screening, workflow
from .services.workflow import run_workflow_engine


def _sha256(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()


UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _seed_demo_jobs()
    task = asyncio.create_task(_workflow_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


async def _workflow_loop():
    while True:
        await asyncio.sleep(60)
        try:
            await asyncio.to_thread(run_workflow_engine)
        except Exception:
            pass


def _seed_demo_jobs():
    db = SessionLocal()
    try:
        if db.query(Job).count() == 0:
            demo_jobs = [
                Job(
                    title="高级前端工程师", department="技术部",
                    requirements=json.dumps({
                        "required_skills": ["React", "TypeScript", "CSS", "JavaScript"],
                        "min_experience": 3,
                        "education": "本科及以上",
                        "description": "负责前端架构设计和核心业务开发"
                    }, ensure_ascii=False),
                ),
                Job(
                    title="Java 后端工程师", department="技术部",
                    requirements=json.dumps({
                        "required_skills": ["Java", "Spring Boot", "MySQL", "Redis"],
                        "min_experience": 3,
                        "education": "本科及以上",
                        "description": "负责后端服务和API开发"
                    }, ensure_ascii=False),
                ),
                Job(
                    title="AI 算法工程师", department="技术部",
                    requirements=json.dumps({
                        "required_skills": ["Python", "PyTorch", "LangChain", "FastAPI"],
                        "min_experience": 2,
                        "education": "硕士及以上",
                        "description": "负责AI应用开发和模型部署"
                    }, ensure_ascii=False),
                ),
                Job(
                    title="产品经理", department="产品部",
                    requirements=json.dumps({
                        "required_skills": ["产品规划", "数据分析", "Axure", "需求文档"],
                        "min_experience": 2,
                        "education": "本科及以上",
                        "description": "负责产品规划和需求管理"
                    }, ensure_ascii=False),
                ),
                Job(
                    title="UI 设计师", department="设计部",
                    requirements=json.dumps({
                        "required_skills": ["Figma", "UI设计", "用户体验", "设计系统"],
                        "min_experience": 2,
                        "education": "本科及以上",
                        "description": "负责产品界面和用户体验设计"
                    }, ensure_ascii=False),
                ),
            ]
            db.add_all(demo_jobs)
            db.commit()

        if db.query(WorkflowRule).count() == 0:
            default_rule = WorkflowRule(
                name="AI评分达标自动推进",
                trigger_type="score_threshold",
                trigger_config=json.dumps({"min_score": 60, "source_status": "resume_received"}, ensure_ascii=False),
                action_type="auto_advance",
                action_config=json.dumps({"target_status": "screening"}, ensure_ascii=False),
                is_active=1,
            )
            db.add(default_rule)
            db.commit()

        if db.query(User).count() == 0:
            admin = User(
                username="admin",
                hashed_password=hash_password(_sha256("admin")),
                display_name="管理员",
                is_active=1,
            )
            db.add(admin)
            db.commit()
    finally:
        db.close()


app = FastAPI(title="AI 招聘管理平台", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Gzip compression middleware ---
@app.middleware("http")
async def gzip_middleware(request: Request, call_next):
    import gzip as _gzip
    response = await call_next(request)
    if request.headers.get("accept-encoding", "").find("gzip") == -1:
        return response
    ct = response.headers.get("content-type", "")
    if not any(t in ct for t in ("json", "javascript", "css", "text", "xml", "svg")):
        return response
    body = b""
    async for chunk in response.body_iterator:
        body += chunk
    if len(body) < 500:
        from starlette.responses import Response
        return Response(content=body, status_code=response.status_code,
                        headers=dict(response.headers), media_type=response.media_type)
    compressed = _gzip.compress(body, compresslevel=6)
    if len(compressed) >= len(body):
        from starlette.responses import Response
        return Response(content=body, status_code=response.status_code,
                        headers=dict(response.headers), media_type=response.media_type)
    from starlette.responses import Response
    resp = Response(content=compressed, status_code=response.status_code,
                    media_type=response.media_type)
    resp.headers["content-encoding"] = "gzip"
    resp.headers["content-length"] = str(len(compressed))
    for k, v in response.headers.items():
        if k.lower() not in ("content-length", "content-encoding", "transfer-encoding"):
            resp.headers[k] = v
    return resp


# Auth middleware — protect all /api/* routes except auth endpoints and health
@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path
    public_paths = {"/api/auth/login", "/api/auth/refresh", "/api/health"}
    if not path.startswith("/api/") or path in public_paths:
        return await call_next(request)

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JSONResponse(
            status_code=401,
            content={"detail": "未提供认证令牌"},
        )
    token = auth_header[7:]
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            return JSONResponse(status_code=401, content={"detail": "无效的令牌类型"})
    except JWTError:
        return JSONResponse(status_code=401, content={"detail": "令牌无效或已过期"})

    return await call_next(request)


app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(candidates.router)
app.include_router(resumes.router)
app.include_router(screening.router)
app.include_router(dashboard.router)
app.include_router(workflow.router)
app.include_router(export.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# --- Serve frontend static files in production ---
if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/favicon.svg")
    async def favicon():
        f = FRONTEND_DIST / "favicon.svg"
        if f.exists():
            return FileResponse(str(f))
        return JSONResponse(status_code=404, content={"detail": "not found"})

    # SPA fallback: all non-API, non-upload routes serve index.html
    @app.get("/{path:path}")
    async def spa_fallback(path: str):
        # Specific file exists? Serve it
        file = FRONTEND_DIST / path
        if file.exists() and file.is_file():
            return FileResponse(str(file))
        # Otherwise serve index.html (SPA routing)
        return FileResponse(str(FRONTEND_DIST / "index.html"))
