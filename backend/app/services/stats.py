from datetime import datetime, timedelta
import time

from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import Candidate, Job, beijing_now

STATUS_LABELS = {
    "resume_received": "投递",
    "screening": "筛选中",
    "interview": "面试中",
    "offer": "Offer",
    "hired": "已入职",
    "rejected": "已拒绝",
    "talent_pool": "人才库",
}

FUNNEL_STAGES = ["resume_received", "screening", "interview", "offer", "hired"]

SOURCE_LABELS = {
    "boss": "Boss直聘",
    "lagou": "拉勾",
    "referral": "内推",
    "official": "官网",
    "other": "其他",
}


_cache: dict | None = None
_cache_ts: float = 0
_CACHE_TTL = 10  # seconds


def get_dashboard_stats(db: Session) -> dict:
    global _cache, _cache_ts
    now = time.monotonic()
    if _cache and (now - _cache_ts) < _CACHE_TTL:
        return _cache

    result = _compute_stats(db)
    _cache = result
    _cache_ts = now
    return result


def _compute_stats(db: Session) -> dict:
    total = db.query(func.count(Candidate.id)).scalar()

    funnel = []
    for stage in FUNNEL_STAGES:
        count = db.query(func.count(Candidate.id)).filter(
            Candidate.status == stage
        ).scalar()
        funnel.append({
            "stage": stage,
            "label": STATUS_LABELS.get(stage, stage),
            "count": count,
        })

    channel_rows = (
        db.query(Candidate.source, func.count(Candidate.id))
        .group_by(Candidate.source)
        .all()
    )
    channels = []
    for source, count in channel_rows:
        channels.append({
            "source": SOURCE_LABELS.get(source, source or "未知"),
            "count": count,
        })

    job_rows = (
        db.query(Job.title, func.count(Candidate.id))
        .outerjoin(Candidate, Candidate.job_id == Job.id)
        .group_by(Job.title)
        .all()
    )
    jobs = [{"job_title": title or "无岗位", "count": count} for title, count in job_rows]

    # 新增：转化率
    conversion_rates = []
    for i in range(len(FUNNEL_STAGES) - 1):
        from_stage = FUNNEL_STAGES[i]
        to_stage = FUNNEL_STAGES[i + 1]
        from_count = next((f["count"] for f in funnel if f["stage"] == from_stage), 0)
        to_count = next((f["count"] for f in funnel if f["stage"] == to_stage), 0)
        rate = round(to_count / from_count, 4) if from_count > 0 else 0.0
        conversion_rates.append({
            "from_stage": from_stage,
            "to": to_stage,
            "rate": rate,
        })

    # 新增：平均招聘周期（已入职候选人从投递到入职的天数）
    time_to_hire = _calc_time_to_hire(db)

    # 新增：本周新增
    now = beijing_now()
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    this_week_new = db.query(func.count(Candidate.id)).filter(
        Candidate.created_at >= week_start
    ).scalar()

    # 新增：整体转化率（投递→入职）
    hired_count = next((f["count"] for f in funnel if f["stage"] == "hired"), 0)
    received_count = next((f["count"] for f in funnel if f["stage"] == "resume_received"), 0)
    overall_conversion = round(hired_count / received_count, 4) if received_count > 0 else 0.0

    # 新增：各渠道转化率
    source_conversion = _calc_source_conversion(db)

    return {
        "total_candidates": total,
        "funnel": funnel,
        "channels": channels,
        "jobs": jobs,
        "time_to_hire": time_to_hire,
        "this_week_new": this_week_new,
        "overall_conversion": overall_conversion,
        "conversion_rates": conversion_rates,
        "weekly_trend": _calc_weekly_trend(db),
        "source_conversion": source_conversion,
    }


def get_weekly_trend(db: Session, days: int = 30) -> list[dict]:
    stats = get_dashboard_stats(db)
    if days == 30 and stats.get("weekly_trend"):
        return stats["weekly_trend"]
    return _calc_weekly_trend(db, days)


def _calc_time_to_hire(db: Session) -> float | None:
    """计算已入职候选人的平均招聘周期（天）"""
    rows = (
        db.query(Candidate.created_at, Candidate.updated_at)
        .filter(Candidate.status == "hired")
        .all()
    )
    if not rows:
        return None
    total_days = sum(((u or c) - c).days for c, u in rows)
    return round(total_days / len(rows), 1)


def _calc_weekly_trend(db: Session, days: int = 30) -> list[dict]:
    """按周统计新增和入职数量"""
    cutoff = beijing_now() - timedelta(days=days)
    rows = (
        db.query(
            func.strftime("%Y-W%W", Candidate.created_at).label("week"),
            func.count(Candidate.id).label("new_count"),
            func.sum(
                func.iif(Candidate.status == "hired", 1, 0)
            ).label("hired_count"),
        )
        .filter(Candidate.created_at >= cutoff)
        .group_by("week")
        .order_by("week")
        .all()
    )
    return [
        {"week": week, "new_count": new_count, "hired_count": hired_count or 0}
        for week, new_count, hired_count in rows
    ]


def _calc_source_conversion(db: Session) -> list[dict]:
    """计算各渠道的候选入职转化率"""
    rows = (
        db.query(
            Candidate.source,
            func.count(Candidate.id).label("total"),
            func.sum(
                func.iif(Candidate.status == "hired", 1, 0)
            ).label("hired"),
        )
        .group_by(Candidate.source)
        .all()
    )
    result = []
    for source, total, hired in rows:
        hired = hired or 0
        rate = round(hired / total, 4) if total > 0 else 0.0
        result.append({
            "source": SOURCE_LABELS.get(source, source or "未知"),
            "conversion_rate": rate,
        })
    return result
