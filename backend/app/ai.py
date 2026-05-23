import os
import json
import logging
from typing import Optional
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """你是一个专业的简历解析器。从以下简历文本中提取结构化信息，以 JSON 格式返回。
无法确定的字段填 null。

严格按照以下 JSON 格式输出，不要输出任何其他内容：
{
  "name": "姓名",
  "phone": "手机号",
  "email": "邮箱",
  "years_of_experience": 数字或null,
  "current_company": "最近公司",
  "highest_degree": "最高学历",
  "school": "毕业院校",
  "skills": ["技能1", "技能2"],
  "expected_salary": "期望薪资",
  "availability": "到岗时间",
  "work_history": [
    {"company": "公司名", "position": "职位", "duration": "时间段", "summary": "工作摘要"}
  ],
  "project_experience": [
    {"name": "项目名称", "role": "担任角色", "duration": "时间段", "description": "项目描述和技术要点"}
  ],
  "research_experience": [
    {"topic": "研究课题", "role": "担任角色", "duration": "时间段", "achievement": "研究成果/论文"}
  ]
}"""

_client: Optional[OpenAI] = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        base_url = os.getenv("OPENAI_BASE_URL", None)
        _client = OpenAI(api_key=api_key, base_url=base_url)
    return _client


def parse_resume(resume_text: str) -> dict:
    client = get_client()
    model = os.getenv("AI_MODEL", "gpt-4o-mini")

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"简历文本：\n---\n{resume_text}"},
            ],
            temperature=0,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        result = json.loads(content)

        if "skills" in result and isinstance(result["skills"], str):
            result["skills"] = [s.strip() for s in result["skills"].split(",")]

        return result
    except json.JSONDecodeError as e:
        logger.error("AI 返回的 JSON 解析失败: %s", e)
        raise ValueError(f"AI 返回结果解析失败: {e}")
    except Exception as e:
        logger.error("AI 调用失败: %s", e)
        raise RuntimeError(f"AI 调用失败: {e}")


SCORE_PROMPT = """你是一位资深的招聘匹配分析师。请根据候选人信息和岗位要求，评估匹配程度。

岗位要求：
{job_requirements}

候选人信息：
姓名：{name}
工作年限：{years_of_experience}
当前公司：{current_company}
最高学历：{highest_degree}
毕业院校：{school}
技能：{skills}
工作经历：{work_history}
项目经验：{project_experience}

请以 JSON 格式返回评估结果：
{{
  "score": 评分(0-100的整数，匹配度评分),
  "summary": "一句话评价候选人与岗位的匹配度",
  "recommendation": "强烈推荐/推荐面试/可以考虑/不推荐",
  "match_details": {{
    "skills_match": ["匹配的技能列表"],
    "skills_missing": ["缺失的技能"],
    "experience_assessment": "经验评估说明",
    "education_match": true或false,
    "strengths": ["优势1", "优势2"],
    "concerns": ["关注点1"]
  }}
}}"""


COMPARE_PROMPT = """你是资深招聘顾问。请对比以下候选人，为「{job_title}」岗位推荐最合适的人选。

岗位要求：{job_requirements}

候选人列表：
{candidates_info}

请以 JSON 格式返回：
{{
  "ranking": [
    {{"candidate_id": id, "rank": 排名数字, "reason": "推荐理由"}}
  ],
  "comparison_summary": "整体对比分析摘要",
  "recommendation": "最终推荐建议"
}}"""


def _call_ai(system_prompt: str, user_prompt: str) -> dict:
    client = get_client()
    model = os.getenv("AI_MODEL", "gpt-4o-mini")
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0,
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content
    return json.loads(content)


def score_candidate(candidate_info: dict, job_requirements: dict) -> dict:
    req_text = json.dumps(job_requirements, ensure_ascii=False) if job_requirements else "无明确要求"
    user_prompt = SCORE_PROMPT.format(
        job_requirements=req_text,
        name=candidate_info.get("name", "未知"),
        years_of_experience=candidate_info.get("years_of_experience", "未知"),
        current_company=candidate_info.get("current_company", "未知"),
        highest_degree=candidate_info.get("highest_degree", "未知"),
        school=candidate_info.get("school", "未知"),
        skills=", ".join(candidate_info.get("skills", [])),
        work_history=json.dumps(candidate_info.get("work_history", []), ensure_ascii=False),
        project_experience=json.dumps(candidate_info.get("project_experience", []), ensure_ascii=False),
    )
    result = _call_ai("你是专业的招聘匹配分析师。", user_prompt)
    if isinstance(result.get("score"), str):
        try:
            result["score"] = float(result["score"])
        except (ValueError, TypeError):
            result["score"] = 50.0
    return result


def compare_candidates(candidates_info: list[dict], job_title: str, job_requirements: dict) -> dict:
    req_text = json.dumps(job_requirements, ensure_ascii=False) if job_requirements else "无明确要求"
    candidates_text = ""
    for c in candidates_info:
        candidates_text += f"\n---\nID: {c['id']}\n姓名: {c.get('name', '未知')}\n"
        candidates_text += f"工作年限: {c.get('years_of_experience', '未知')}\n"
        candidates_text += f"技能: {', '.join(c.get('skills', []))}\n"
        candidates_text += f"学历: {c.get('highest_degree', '未知')}\n"
        candidates_text += f"公司: {c.get('current_company', '未知')}\n"
        if c.get("ai_summary"):
            candidates_text += f"AI评价: {c['ai_summary']}\n"
    user_prompt = COMPARE_PROMPT.format(
        job_title=job_title,
        job_requirements=req_text,
        candidates_info=candidates_text,
    )
    return _call_ai("你是资深招聘顾问。", user_prompt)


INSIGHTS_PROMPT = """你是资深招聘数据分析师。根据以下招聘数据，生成 3-5 条关键洞察。

招聘数据：
- 候选人总数：{total_candidates}
- 各阶段数量：{funnel}
- 渠道分布：{channels}
- 岗位分布：{jobs}
- 平均招聘周期：{time_to_hire} 天
- 整体转化率：{overall_conversion}
- 各阶段转化率：{conversion_rates}
- 本周新增：{this_week_new}

请以 JSON 数组格式返回洞察，每条洞察包含 severity（info/warning/error/success）、title（简短标题）、content（详细说明）：
[
  {{"severity": "warning", "title": "瓶颈阶段", "content": "..."}},
  {{"severity": "info", "title": "渠道建议", "content": "..."}},
  ...
]

重点关注：
1. 瓶颈分析：哪个阶段转化率异常低或候选人堆积
2. 渠道建议：哪个渠道转化率高，应该加大投入
3. 趋势预警：新增候选人走势
4. 效率分析：招聘周期是否合理"""


def generate_insights(stats: dict) -> list[dict]:
    funnel_text = ", ".join(
        f"{s.get('label', s.get('stage', '?'))}: {s.get('count', 0)}人"
        for s in stats.get("funnel", [])
    )
    channels_text = ", ".join(
        f"{c.get('source', '?')}: {c.get('count', 0)}人"
        for c in stats.get("channels", [])
    )
    jobs_text = ", ".join(
        f"{j.get('job_title', '?')}: {j.get('count', 0)}人"
        for j in stats.get("jobs", [])
    )
    conv_text = ", ".join(
        f"{c.get('from_stage', '?')}→{c.get('to', '?')}: {c.get('rate', 0)}"
        for c in stats.get("conversion_rates", [])
    )

    user_prompt = INSIGHTS_PROMPT.format(
        total_candidates=stats.get("total_candidates", 0),
        funnel=funnel_text,
        channels=channels_text,
        jobs=jobs_text,
        time_to_hire=stats.get("time_to_hire", "N/A"),
        overall_conversion=stats.get("overall_conversion", "N/A"),
        conversion_rates=conv_text,
        this_week_new=stats.get("this_week_new", 0),
    )

    result = _call_ai("你是资深招聘数据分析师。", user_prompt)
    if isinstance(result, list):
        return result
    if isinstance(result, dict) and "insights" in result:
        return result["insights"]
    return []


# --- Server-side cache for AI insights ---
_insights_cache: list[dict] | None = None
_insights_cache_ts: float = 0
_INSIGHTS_CACHE_TTL = 300  # 5 minutes


def get_cached_insights(stats: dict) -> list[dict] | None:
    """Return cached insights if still valid, otherwise None."""
    global _insights_cache, _insights_cache_ts
    import time as _time
    if _insights_cache and (_time.time() - _insights_cache_ts) < _INSIGHTS_CACHE_TTL:
        return _insights_cache
    return None


def generate_and_cache_insights(stats: dict) -> list[dict]:
    """Generate insights, cache them, and return."""
    global _insights_cache, _insights_cache_ts
    import time as _time
    result = generate_insights(stats)
    _insights_cache = result
    _insights_cache_ts = _time.time()
    return result
