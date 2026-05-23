"""Generate realistic random candidate data for demo purposes."""
import json
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.database import SessionLocal
from app.models import Job, Candidate, Event

db = SessionLocal()

# ---- Data pools ----

SURNAMES = [
    "王", "李", "张", "刘", "陈", "杨", "赵", "黄", "周", "吴",
    "徐", "孙", "马", "朱", "胡", "郭", "何", "高", "林", "罗",
    "郑", "梁", "谢", "宋", "唐", "韩", "曹", "许", "邓", "冯",
    "彭", "蔡", "潘", "袁", "田", "董", "苏", "蒋", "余", "沈",
    "卢", "丁", "魏", "薛", "叶", "阎", "夏", "石", "崔", "姚",
    "段", "邹", "廖", "方", "金", "邱", "姜", "贾", "秦", "尹",
    "孟", "白", "贺", "龙", "万", "任", "向", "欧阳", "司徒", "慕容",
]

GIVEN_NAMES = [
    "伟", "芳", "娜", "洋", "静", "帆", "敏", "志远", "晓燕", "宇飞",
    "航", "程", "悦", "超", "明", "俊杰", "雨桐", "雪", "鑫", "远",
    "成", "思源", "雨", "亮", "梅", "阳", "涛", "丽", "刚", "博",
    "文", "晨", "浩", "蜜", "力", "瑶", "奇", "悦", "默", "峰",
    "然", "鹏", "青", "欢", "晴", "宇", "磊", "健", "曦", "哲",
    "晨", "韵", "明", "舟", "鑫", "泽", "华", "玲", "岚", "强",
    "洋", "非", "露", "军", "飞", "芳", "誉", "枫", "盈盈", "华",
    "辰", "静", "雪", "冲", "岚", "逸", "谧", "轩", "涵", "鸣",
    "天宇", "浩然", "欣怡", "诗涵", "文博", "明哲", "雨霏", "佳琪", "志伟", "雅琪",
    "晓峰", "嘉诚", "雪婷", "振华", "若曦", "景行", "知远", "清扬", "星野", "书瑶",
]

def generate_unique_names(count: int) -> list[str]:
    """Generate count unique Chinese names."""
    names = set()
    # Pre-generate all combinations
    all_names = []
    for s in SURNAMES:
        for g in GIVEN_NAMES:
            all_names.append(s + g)
    random.shuffle(all_names)
    for name in all_names:
        names.add(name)
        if len(names) >= count:
            break
    return list(names)

COMPANIES = [
    "阿里巴巴", "腾讯科技", "字节跳动", "百度", "美团", "京东", "网易",
    "华为技术", "小米科技", "滴滴出行", "快手", "哔哩哔哩", "携程", "拼多多",
    "小红书", "商汤科技", "旷视科技", "依图科技", "云从科技", "地平线",
    "大疆创新", "海康威视", "科大讯飞", "中兴通讯", "浪潮集团", "用友网络",
]

DEGREES = ["本科", "硕士", "博士"]
DEGREE_WEIGHTS = [0.60, 0.30, 0.10]
SCHOOLS = [
    "清华大学", "北京大学", "浙江大学", "上海交通大学", "复旦大学", "南京大学",
    "中国科学技术大学", "哈尔滨工业大学", "武汉大学", "华中科技大学",
    "中山大学", "同济大学", "北京航空航天大学", "西安交通大学", "电子科技大学",
    "北京邮电大学", "华东师范大学", "东南大学", "华南理工大学", "四川大学",
]

STATUSES = ["resume_received", "screening", "interview", "offer", "hired", "rejected"]
STATUS_WEIGHTS = [0.20, 0.18, 0.22, 0.10, 0.15, 0.15]  # funnel shape

SOURCES = ["Boss直聘", "猎头推荐", "内推", "前程无忧", "智联招聘", "拉勾网", "官网投递", "LinkedIn"]
SOURCE_WEIGHTS = [0.25, 0.10, 0.20, 0.15, 0.12, 0.08, 0.05, 0.05]

# Job-specific skill pools
JOB_SKILLS = {
    1: {  # 高级前端工程师
        "required": ["React", "TypeScript", "CSS", "JavaScript", "HTML5", "Vue", "Webpack",
                      "Node.js", "ES6+", "Sass", "Next.js", "GraphQL"],
        "often": ["Tailwind", "Jest", "Cypress", "WebGL", "Docker", "Git"],
    },
    2: {  # Java 后端工程师
        "required": ["Java", "Spring Boot", "MySQL", "Redis", "Kafka", "Docker",
                      "Elasticsearch", "Kubernetes", "RabbitMQ", "Nginx"],
        "often": ["MongoDB", "PostgreSQL", "Git", "Jenkins", "Linux"],
    },
    3: {  # AI 算法工程师
        "required": ["Python", "PyTorch", "LangChain", "FastAPI", "TensorFlow", "Scikit-learn",
                      "Docker", "Pandas", "NumPy", "Transformer"],
        "often": ["MLflow", "Kubernetes", "HuggingFace", "OpenCV", "JAX", "Weights & Biases"],
    },
    4: {  # 产品经理
        "required": ["产品规划", "数据分析", "Axure", "需求文档", "用户研究", "SQL",
                      "Figma", "项目管理", "敏捷开发", "竞品分析"],
        "often": ["Jira", "Notion", "A/B测试", "数据可视化", "Tableau"],
    },
    5: {  # UI 设计师
        "required": ["Figma", "UI设计", "用户体验", "设计系统", "Sketch", "Photoshop",
                      "Illustrator", "交互设计", "用户研究", "动效设计"],
        "often": ["C4D", "Blender", "After Effects", "Principle"],
    },
}

RECOMMENDATIONS = {
    "strong": "强烈推荐",
    "recommend": "推荐",
    "consider": "考虑",
    "not_recommend": "不推荐",
}

EVENT_TYPES = ["status_change", "interview_scheduled", "interview_completed", "note_added", "score_changed"]


def pick_weighted(options, weights):
    return random.choices(options, weights=weights, k=1)[0]


def random_date(days_back=30):
    return datetime.now() - timedelta(
        days=random.randint(0, days_back),
        hours=random.randint(0, 23),
        minutes=random.randint(0, 59),
    )


def generate_skills(job_id):
    pool = JOB_SKILLS.get(job_id, JOB_SKILLS[1])
    required = random.sample(pool["required"], k=random.randint(3, len(pool["required"])))
    optional = random.sample(pool["often"], k=random.randint(0, min(3, len(pool["often"]))))
    return required + optional


def generate_work_history(years_exp):
    history = []
    remaining_years = years_exp
    current_year = 2026
    while remaining_years > 0 and len(history) < 3:
        duration = min(remaining_years, random.randint(1, 4))
        end_year = current_year
        start_year = end_year - duration
        company = random.choice(COMPANIES)
        positions = {
            1: ["前端开发工程师", "高级前端开发", "前端技术专家"],
            2: ["Java开发工程师", "高级Java工程师", "后端技术专家"],
            3: ["算法工程师", "高级算法工程师", "AI研究员"],
            4: ["产品助理", "产品经理", "高级产品经理"],
            5: ["UI设计师", "高级UI设计师", "设计主管"],
        }
        position = random.choice(positions.get(random.randint(1, 5), positions[1]))
        history.append({
            "company": company,
            "position": position,
            "start": f"{start_year}",
            "end": f"{end_year}",
        })
        remaining_years -= duration
        current_year = start_year
    return history


def generate_ai_score(job_id, skills):
    """Generate a somewhat realistic AI score based on skill match."""
    pool = JOB_SKILLS.get(job_id, JOB_SKILLS[1])
    # Count matching required skills
    required_set = set(s.lower() for s in pool["required"])
    candidate_set = set(s.lower() for s in skills)
    match_count = len(required_set & candidate_set)

    # Base score from match ratio + randomness
    match_ratio = match_count / len(required_set) if required_set else 0.5
    base_score = match_ratio * 60 + random.randint(10, 35)
    return min(98, max(15, round(base_score)))


def generate_recommendation(score):
    if score >= 80:
        return "strong"
    elif score >= 65:
        return "recommend"
    elif score >= 50:
        return "consider"
    else:
        return "not_recommend"


def generate_events(candidate, created_at):
    """Generate lifecycle events for a candidate."""
    events = []
    status_order = ["resume_received", "screening", "interview", "offer", "hired"]
    current_idx = status_order.index(candidate.status) if candidate.status in status_order else 0

    # Resume received event
    events.append(Event(
        candidate_id=candidate.id,
        event_type="status_change",
        detail=json.dumps({"from": "", "to": "resume_received", "note": "简历投递成功"}, ensure_ascii=False),
        created_at=created_at,
    ))

    event_time = created_at
    for i in range(1, current_idx + 1):
        event_time = event_time + timedelta(days=random.randint(1, 5))
        status_to = status_order[i]
        events.append(Event(
            candidate_id=candidate.id,
            event_type="status_change",
            detail=json.dumps({"from": status_order[i-1], "to": status_to}, ensure_ascii=False),
            created_at=event_time,
        ))

    # Add interview events for those in interview or beyond
    if current_idx >= 2:
        interview_time = event_time - timedelta(days=random.randint(1, 3))
        events.append(Event(
            candidate_id=candidate.id,
            event_type="interview_scheduled",
            detail=json.dumps({"interviewer": random.choice(["张总监", "李经理", "王主管"])}, ensure_ascii=False),
            created_at=interview_time,
        ))

    if candidate.status in ("offer", "hired") and candidate.ai_score:
        interview_time2 = event_time
        events.append(Event(
            candidate_id=candidate.id,
            event_type="interview_completed",
            detail=json.dumps({"result": "通过", "score": candidate.ai_score}, ensure_ascii=False),
            created_at=interview_time2 + timedelta(days=1),
        ))

    return events


def main():
    # Remove existing candidates and events
    print("Clearing existing candidates and events...")
    db.query(Event).delete()
    db.query(Candidate).delete()
    db.commit()

    jobs = db.query(Job).all()
    if not jobs:
        print("No jobs found! Run main.py first to seed jobs.")
        return

    candidates_list = []
    target_count = 85
    unique_names = generate_unique_names(target_count)

    for i in range(target_count):
        job = random.choice(jobs)
        status = pick_weighted(STATUSES, STATUS_WEIGHTS)
        source = pick_weighted(SOURCES, SOURCE_WEIGHTS)

        # Demographics
        name = unique_names[i]
        phone = f"1{random.randint(30, 99)}{random.randint(10000000, 99999999)}"
        email = f"candidate{i+1}_{random.randint(100, 999)}@{random.choice(['qq.com', '163.com', 'gmail.com', 'outlook.com'])}"

        years_exp = random.randint(1, 12) if status != "resume_received" else random.randint(0, 10)
        degree = pick_weighted(DEGREES, DEGREE_WEIGHTS)
        school = random.choice(SCHOOLS) if random.random() < 0.7 else "其他院校"
        company = random.choice(COMPANIES) if years_exp > 0 else ""

        # Skills based on job
        skills = generate_skills(job.id)

        # Salary
        salary_ranges = {
            1: ["15K-25K", "20K-30K", "25K-35K", "30K-40K", "18K-28K"],
            2: ["18K-28K", "22K-35K", "25K-35K", "30K-45K"],
            3: ["25K-40K", "30K-50K", "35K-55K", "40K-60K"],
            4: ["15K-25K", "20K-30K", "18K-28K"],
            5: ["12K-20K", "15K-25K", "18K-28K", "20K-30K"],
        }
        expected_salary = random.choice(salary_ranges.get(job.id, salary_ranges[1]))

        # AI scoring
        ai_score = generate_ai_score(job.id, skills)
        recommendation = generate_recommendation(ai_score)

        # Adjust score distribution based on status
        if status == "hired":
            ai_score = min(98, ai_score + random.randint(5, 20))
        elif status == "rejected":
            ai_score = max(10, ai_score - random.randint(15, 40))

        # Match details
        pool = JOB_SKILLS.get(job.id, JOB_SKILLS[1])
        required_set = set(s.lower() for s in pool["required"])
        candidate_set = set(s.lower() for s in skills)
        matched = list(required_set & candidate_set)
        missing = list(required_set - candidate_set)
        match_details = {
            "matched_skills": matched,
            "missing_skills": missing[:5],
            "experience_match": round(random.uniform(0.3, 1.0), 2),
            "education_match": round(random.uniform(0.5, 1.0), 2),
            "skill_match_rate": round(len(matched) / len(required_set), 2),
        }

        # AI summary
        rec_text = RECOMMENDATIONS[recommendation]
        summaries = {
            "strong": f"候选人{name}与{job.title}岗位高度匹配。具备{', '.join(skills[:5])}等关键技能，{years_exp}年相关工作经验，综合评分{ai_score}分。建议优先安排面试。",
            "recommend": f"{name}在{', '.join(skills[:3])}等方面表现良好，{years_exp}年经验基本满足要求。部分技能有待提升，但整体可进入面试环节。",
            "consider": f"{name}具备基础能力，但在核心技能匹配上存在差距。建议进一步沟通后决定是否推进。",
            "not_recommend": f"{name}的技能组合与岗位要求差距较大，不建议继续推进此岗位的招聘流程。",
        }
        ai_summary = summaries.get(recommendation, summaries["consider"])

        # Timestamps
        created_at = random_date(30)
        updated_at = created_at + timedelta(days=random.randint(0, 5))
        stage_entered_at = created_at

        # Work history
        work_history = generate_work_history(years_exp) if years_exp > 0 else []
        project_experience = []
        if random.random() < 0.6:
            project_experience.append({
                "name": random.choice(["电商平台重构", "数据中台建设", "用户增长项目", "AI推荐系统", "移动端改版",
                                       "微服务架构升级", "实时数据看板", "智能客服系统", "自动化测试平台"]),
                "description": "核心参与",
                "tech_stack": random.sample(skills, min(3, len(skills))),
            })

        candidate = Candidate(
            name=name,
            phone=phone,
            email=email,
            source=source,
            job_id=job.id,
            status=status,
            years_of_experience=years_exp,
            current_company=company,
            highest_degree=degree,
            school=school,
            skills=json.dumps(skills, ensure_ascii=False),
            expected_salary=expected_salary,
            work_history=json.dumps(work_history, ensure_ascii=False) if work_history else None,
            project_experience=json.dumps(project_experience, ensure_ascii=False) if project_experience else None,
            parse_status="done",
            ai_score=ai_score,
            ai_summary=ai_summary,
            ai_recommendation=RECOMMENDATIONS[recommendation],
            ai_match_details=json.dumps(match_details, ensure_ascii=False),
            stage_entered_at=created_at,
            created_at=created_at,
            updated_at=updated_at,
        )
        db.add(candidate)
        db.flush()  # Get candidate.id

        # Generate events
        for event in generate_events(candidate, created_at):
            db.add(event)

    db.commit()

    # Print summary
    print(f"\nSeeded {target_count} candidates across {len(jobs)} jobs.\n")
    for job in jobs:
        count = db.query(Candidate).filter(Candidate.job_id == job.id).count()
        print(f"  {job.title}: {count} candidates")

    print("\nStatus distribution:")
    for status in STATUSES:
        count = db.query(Candidate).filter(Candidate.status == status).count()
        print(f"  {status}: {count}")

    print("\nSource distribution:")
    for source in SOURCES:
        count = db.query(Candidate).filter(Candidate.source == source).count()
        if count > 0:
            print(f"  {source}: {count}")

    print("\nDone! ✓")


if __name__ == "__main__":
    main()
