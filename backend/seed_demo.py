"""Seed demo data for AI Recruitment Platform demo."""

import json
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app.database import engine, SessionLocal, Base
from app.models import Job, Candidate, Event

DEMO_CANDIDATES = [
    {
        "name": "张伟",
        "phone": "13800138001",
        "email": "zhangwei@example.com",
        "source": "boss",
        "job_id": 1,
        "status": "interview",
        "years_of_experience": 5,
        "current_company": "字节跳动",
        "highest_degree": "本科",
        "school": "浙江大学",
        "skills": ["React", "TypeScript", "Next.js", "Node.js"],
        "expected_salary": "30-40K",
        "availability": "1个月内",
        "work_history": [
            {"company": "字节跳动", "position": "高级前端工程师", "duration": "2021-06 至今", "summary": "负责抖音创作者平台前端架构，带领 5 人团队完成平台重构"},
            {"company": "阿里巴巴", "position": "前端工程师", "duration": "2019-07 ~ 2021-05", "summary": "参与淘宝首页性能优化，首屏加载速度提升 40%"}
        ],
    },
    {
        "name": "李娜",
        "phone": "13900139002",
        "email": "lina@example.com",
        "source": "lagou",
        "job_id": 2,
        "status": "screening",
        "years_of_experience": 3,
        "current_company": "美团",
        "highest_degree": "硕士",
        "school": "北京大学",
        "skills": ["Java", "Spring Boot", "MySQL", "Redis"],
        "expected_salary": "25-35K",
        "availability": "随时到岗",
        "work_history": [
            {"company": "美团", "position": "Java后端工程师", "duration": "2023-03 至今", "summary": "负责外卖订单系统核心模块开发，日均处理订单量 500万+"}
        ],
    },
    {
        "name": "王磊",
        "phone": "13700137003",
        "email": "wanglei@example.com",
        "source": "referral",
        "job_id": 1,
        "status": "offer",
        "years_of_experience": 7,
        "current_company": "腾讯",
        "highest_degree": "硕士",
        "school": "清华大学",
        "skills": ["React", "Vue", "TypeScript", "Webpack", "微前端"],
        "expected_salary": "40-50K",
        "availability": "2周内",
        "work_history": [
            {"company": "腾讯", "position": "前端技术专家", "duration": "2019-03 至今", "summary": "主导微信小程序开放平台前端架构设计，支撑百万级开发者"},
            {"company": "百度", "position": "高级前端工程师", "duration": "2017-07 ~ 2019-02", "summary": "负责百度地图 Web 版核心模块开发"}
        ],
    },
    {
        "name": "陈静",
        "phone": "13600136004",
        "email": "chenjing@example.com",
        "source": "boss",
        "job_id": 3,
        "status": "resume_received",
        "years_of_experience": 4,
        "current_company": "网易",
        "highest_degree": "本科",
        "school": "复旦大学",
        "skills": ["产品规划", "数据分析", "Axure", "Figma"],
        "expected_salary": "25-30K",
        "availability": "1个月内",
        "work_history": [
            {"company": "网易", "position": "产品经理", "duration": "2022-01 至今", "summary": "负责网易云音乐会员产品线，DAU 提升 25%"}
        ],
    },
    {
        "name": "刘洋",
        "phone": "13500135005",
        "email": "liuyang@example.com",
        "source": "official",
        "job_id": 4,
        "status": "hired",
        "years_of_experience": 6,
        "current_company": "小米",
        "highest_degree": "本科",
        "school": "同济大学",
        "skills": ["Figma", "Sketch", "Adobe XD", "设计系统"],
        "expected_salary": "30-35K",
        "availability": "已入职",
        "work_history": [
            {"company": "小米", "position": "高级UI设计师", "duration": "2020-06 至今", "summary": "主导 MIUI 设计系统建设，覆盖 100+ 组件"},
            {"company": "OPPO", "position": "UI设计师", "duration": "2018-07 ~ 2020-05", "summary": "负责 ColorOS 系统应用视觉设计"}
        ],
    },
    {
        "name": "赵鑫",
        "phone": "13400134006",
        "email": "zhaoxin@example.com",
        "source": "boss",
        "job_id": 2,
        "status": "interview",
        "years_of_experience": 8,
        "current_company": "京东",
        "highest_degree": "硕士",
        "school": "上海交通大学",
        "skills": ["Java", "Spring Cloud", "Kafka", "Elasticsearch", "K8s"],
        "expected_salary": "45-55K",
        "availability": "1个月内",
        "work_history": [
            {"company": "京东", "position": "资深Java工程师", "duration": "2019-08 至今", "summary": "负责京东物流调度系统微服务架构，支撑双十一亿级订单"},
            {"company": "华为", "position": "Java工程师", "duration": "2016-07 ~ 2019-07", "summary": "参与云计算平台后端开发"}
        ],
    },
    {
        "name": "孙芳",
        "phone": "13300133007",
        "email": "sunfang@example.com",
        "source": "lagou",
        "job_id": 3,
        "status": "rejected",
        "years_of_experience": 2,
        "current_company": "快手",
        "highest_degree": "本科",
        "school": "南京大学",
        "skills": ["需求分析", "竞品调研", "SQL", "Axure"],
        "expected_salary": "20-25K",
        "availability": "随时到岗",
        "work_history": [
            {"company": "快手", "position": "产品经理", "duration": "2024-03 至今", "summary": "负责快手电商B端产品功能迭代"}
        ],
    },
    {
        "name": "周杰",
        "phone": "13200132008",
        "email": "zhoujie@example.com",
        "source": "referral",
        "job_id": 1,
        "status": "screening",
        "years_of_experience": 4,
        "current_company": "滴滴",
        "highest_degree": "本科",
        "school": "华中科技大学",
        "skills": ["React", "Vue", "TypeScript", "GraphQL"],
        "expected_salary": "28-35K",
        "availability": "2周内",
        "work_history": [
            {"company": "滴滴", "position": "前端工程师", "duration": "2022-06 至今", "summary": "负责司机端 Web 管理后台开发"},
            {"company": "携程", "position": "前端工程师", "duration": "2020-07 ~ 2022-05", "summary": "参与机票预订流程前端重构"}
        ],
    },
    {
        "name": "吴敏",
        "phone": "13100131009",
        "email": "wumin@example.com",
        "source": "boss",
        "job_id": 4,
        "status": "resume_received",
        "years_of_experience": 3,
        "current_company": "小红书",
        "highest_degree": "硕士",
        "school": "中国美术学院",
        "skills": ["Figma", "C4D", "动效设计", "品牌设计"],
        "expected_salary": "22-28K",
        "availability": "1个月内",
        "work_history": [
            {"company": "小红书", "position": "UI设计师", "duration": "2023-07 至今", "summary": "负责小红书商城核心页面视觉设计"}
        ],
    },
    {
        "name": "郑强",
        "phone": "13000130010",
        "email": "zhengqiang@example.com",
        "source": "other",
        "job_id": 2,
        "status": "talent_pool",
        "years_of_experience": 10,
        "current_company": "蚂蚁集团",
        "highest_degree": "博士",
        "school": "中国科学技术大学",
        "skills": ["Java", "分布式系统", "数据库", "中间件"],
        "expected_salary": "60-80K",
        "availability": "3个月内",
        "work_history": [
            {"company": "蚂蚁集团", "position": "技术总监", "duration": "2018-01 至今", "summary": "负责蚂蚁分布式数据库核心模块，支撑支付宝核心交易"},
            {"company": "Oracle", "position": "高级工程师", "duration": "2014-07 ~ 2017-12", "summary": "参与 MySQL InnoDB 存储引擎开发"}
        ],
    },
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        if db.query(Candidate).count() > 0:
            print("候选人数据已存在，跳过初始化")
            return

        for item in DEMO_CANDIDATES:
            skills = item.pop("skills")
            work_history = item.pop("work_history")

            c = Candidate(**item, parse_status="done")
            c.set_skills(skills)
            c.set_work_history(work_history)
            db.add(c)
            db.flush()

            event = Event(
                candidate_id=c.id,
                event_type="resume_parsed",
            )
            event.set_detail({"source": "demo_seed"})
            db.add(event)

            if c.status != "resume_received":
                event2 = Event(
                    candidate_id=c.id,
                    event_type="status_changed",
                )
                event2.set_detail({"from": "resume_received", "to": c.status})
                db.add(event2)

        db.commit()
        print(f"✓ 成功初始化 {len(DEMO_CANDIDATES)} 条候选人 demo 数据")
    except Exception as e:
        db.rollback()
        print(f"✗ 初始化失败: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
