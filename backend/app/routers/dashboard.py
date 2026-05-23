import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import DashboardStats
from ..services.stats import get_dashboard_stats, get_weekly_trend
from ..models import AiCache
from ..ai import generate_insights

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

INSIGHTS_CACHE_KEY = "dashboard_ai_insights"


@router.get("/stats", response_model=DashboardStats)
def stats(db: Session = Depends(get_db)):
    return get_dashboard_stats(db)


@router.get("/ai-insights")
def ai_insights(force: bool = Query(False), db: Session = Depends(get_db)):
    row = db.query(AiCache).filter(AiCache.key == INSIGHTS_CACHE_KEY).first()

    if row and not force:
        return json.loads(row.data)

    stats_data = get_dashboard_stats(db)
    result = generate_insights(stats_data)

    if row:
        row.data = json.dumps(result, ensure_ascii=False)
    else:
        db.add(AiCache(key=INSIGHTS_CACHE_KEY, data=json.dumps(result, ensure_ascii=False)))
    db.commit()

    return result


@router.get("/trend")
def trend(days: int = Query(30, ge=7, le=365), db: Session = Depends(get_db)):
    weekly_trend = get_weekly_trend(db, days)
    return {"weekly_trend": weekly_trend}
