import json
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session

from ..database import get_db
from ..services.export import export_candidates_excel
from ..services.stats import get_dashboard_stats, get_weekly_trend, STATUS_LABELS
from ..ai import _call_ai

router = APIRouter(prefix="/api/export", tags=["export"])


def _build_report_prompt(stats: dict, period: str) -> str:
    period_label = "本周" if period == "week" else "本月"
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    funnel_text = "\n".join(
        f"  - {s['label']}: {s['count']} 人"
        for s in stats.get("funnel", [])
    )
    channels_text = "\n".join(
        f"  - {c['source']}: {c['count']} 人"
        for c in stats.get("channels", [])
    )
    jobs_text = "\n".join(
        f"  - {j['job_title']}: {j['count']} 人"
        for j in stats.get("jobs", [])
    )
    conversions_text = "\n".join(
        f"  - {c.get('from_stage', '?')} → {c['to']}: {c['rate'] * 100:.1f}%"
        for c in stats.get("conversion_rates", [])
    )

    return f"""你是一位拥有 15 年经验的招聘总监，正在为管理层撰写{period_label}招聘工作报告。

## 当前招聘数据

### 基本信息
- 候选人总数：{stats['total_candidates']} 人
- {period_label}新增：{stats.get('this_week_new', 0)} 人
- 平均招聘周期：{stats.get('time_to_hire', 'N/A')} 天
- 整体转化率（投递→入职）：{stats.get('overall_conversion', 0) * 100:.1f}%

### 各阶段候选人分布
{funnel_text}

### 渠道来源分布
{channels_text}

### 岗位候选人分布
{jobs_text}

### 阶段转化率
{conversions_text}

## 报告要求

请以 JSON 格式返回，格式如下：
{{
  "title": "报告标题（如：2026年第20周招聘工作报告）",
  "summary": "完整的 Markdown 格式报告（800-1000字），内容专业、数据驱动",
  "generated_at": "{now}"
}}

报告必须包含以下结构（用 Markdown 格式）：

### 一、执行摘要
用 2-3 句话概括{period_label}招聘整体情况，突出最关键的数字和趋势。

### 二、数据总览
用表格展示核心指标：候选人总数、新增数、各阶段人数、转化率、招聘周期。

### 三、各阶段深度分析
针对每个招聘阶段进行分析。哪个阶段候选人堆积？哪个阶段流失严重？结合转化率数据给出原因分析和改进建议。

### 四、渠道效果评估
分析各渠道的候选人数量和质量。哪个渠道转化率最高？哪个渠道需要加大投入或优化？

### 五、岗位招聘进度
逐个岗位分析招聘进展。哪些岗位急需推进？哪些岗位候选人充足？

### 六、趋势判断与预警
基于当前数据判断招聘趋势，指出潜在风险。

### 七、下周/下月行动计划
列出 3-5 条具体可执行的行动建议，每条建议标注优先级（🔴高/🟡中/🟢低）。

**重要提醒：**
- 报告面向管理层，语言要专业、简洁、有洞察力
- 每个结论必须有数据支撑
- 建议要具体可执行，不要泛泛而谈
- 使用 Markdown 表格、列表等格式增强可读性"""


@router.get("/ai-summary")
def ai_summary(period: str = Query("week"), db: Session = Depends(get_db)):
    stats = get_dashboard_stats(db)
    stats["weekly_trend"] = get_weekly_trend(db, 30)
    prompt = _build_report_prompt(stats, period)

    try:
        result = _call_ai(
            "你是一位拥有15年经验的招聘总监，擅长撰写专业的数据驱动报告。",
            prompt,
        )
        if isinstance(result, dict):
            return {"period": period, **result}
    except Exception:
        pass
    return {
        "period": period,
        "title": "招聘工作报告",
        "summary": "AI 总结生成失败，请稍后重试",
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }


@router.get("/ai-summary/download")
def download_ai_summary(period: str = Query("week"), db: Session = Depends(get_db)):
    stats = get_dashboard_stats(db)
    stats["weekly_trend"] = get_weekly_trend(db, 30)
    prompt = _build_report_prompt(stats, period)

    try:
        result = _call_ai(
            "你是一位拥有15年经验的招聘总监，擅长撰写专业的数据驱动报告。",
            prompt,
        )
        title = result.get("title", "招聘工作报告") if isinstance(result, dict) else "招聘工作报告"
        summary = result.get("summary", "生成失败") if isinstance(result, dict) else "生成失败"
        generated = result.get("generated_at", "") if isinstance(result, dict) else ""
    except Exception:
        title = "招聘工作报告"
        summary = "生成失败"
        generated = ""

    content = f"""# {title}

> 生成时间：{generated}
> 报告周期：{'周报' if period == 'week' else '月报'}

{summary}

---
*本报告由 AI 招聘管理平台自动生成*
"""
    from urllib.parse import quote

    filename = quote(f"招聘{'周报' if period == 'week' else '月报'}_{datetime.now().strftime('%Y%m%d')}.md")
    return Response(
        content=content,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )
