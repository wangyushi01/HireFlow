import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  Tag,
  Space,
  Input,
  Select,
  Button,
  Typography,
  Popconfirm,
  message,
  Drawer,
  Descriptions,
  Timeline,
  Modal,
  Form,
  InputNumber,
  Card,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  DeleteOutlined,
  EyeOutlined,
  EditOutlined,
  FilePdfOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  fetchCandidates,
  fetchJobs,
  deleteCandidate,
  fetchCandidate,
  fetchEvents,
  changeStatus,
  updateCandidate,
  exportCandidates,
} from "../services/api";
import type { Candidate, Job, Event } from "../services/types";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  SOURCE_LABELS,
  RECOMMENDATION_COLORS,
} from "../services/types";

const { Title, Text, Paragraph } = Typography;

const VALID_TRANSITIONS: Record<string, string[]> = {
  resume_received: ["screening", "rejected", "talent_pool"],
  screening: ["interview", "rejected", "talent_pool"],
  interview: ["offer", "rejected", "talent_pool"],
  offer: ["hired", "rejected", "talent_pool"],
  hired: [],
  rejected: ["talent_pool"],
  talent_pool: ["screening"],
};

const SOURCE_OPTIONS = [
  { value: "boss", label: "Boss直聘" },
  { value: "lagou", label: "拉勾" },
  { value: "referral", label: "内推" },
  { value: "official", label: "官网" },
  { value: "other", label: "其他" },
];

export default function CandidateList() {
  const navigate = useNavigate();
  const [data, setData] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [jobFilter, setJobFilter] = useState<number | undefined>();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<Candidate | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {};
      if (keyword) params.keyword = keyword;
      if (statusFilter) params.status = statusFilter;
      if (jobFilter) params.job_id = jobFilter;
      const res = await fetchCandidates(params);
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs().then(setJobs);
  }, []);

  useEffect(() => {
    load();
  }, [statusFilter, jobFilter]);

  const handleDelete = async (id: number) => {
    try {
      await deleteCandidate(id);
      message.success("已删除");
      if (detail?.id === id) {
        setDrawerOpen(false);
        setDetail(null);
      }
      load();
    } catch {
      message.error("删除失败");
    }
  };

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    setDrawerOpen(true);
    try {
      const [c, evts] = await Promise.all([
        fetchCandidate(id),
        fetchEvents(id),
      ]);
      setDetail(c);
      setEvents(evts);
    } catch {
      message.error("加载失败");
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async () => {
    if (!detail) return;
    const [c, evts] = await Promise.all([
      fetchCandidate(detail.id),
      fetchEvents(detail.id),
    ]);
    setDetail(c);
    setEvents(evts);
  };

  const handleChangeStatus = async (newStatus: string) => {
    if (!detail) return;
    try {
      await changeStatus(detail.id, newStatus);
      await refreshDetail();
      message.success(`状态已变更为「${STATUS_LABELS[newStatus]}」`);
      load();
    } catch {
      message.error("状态变更失败");
    }
  };

  const openEdit = () => {
    if (!detail) return;
    form.setFieldsValue({
      name: detail.name,
      phone: detail.phone,
      email: detail.email,
      source: detail.source,
      job_id: detail.job_id,
      years_of_experience: detail.years_of_experience,
      current_company: detail.current_company,
      highest_degree: detail.highest_degree,
      school: detail.school,
      expected_salary: detail.expected_salary,
      availability: detail.availability,
      skills: detail.skills.join(", "),
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!detail) return;
    const values = await form.validateFields();
    setEditLoading(true);
    try {
      const submitData: Record<string, unknown> = { ...values };
      if (typeof values.skills === "string" && values.skills.trim()) {
        submitData.skills = values.skills.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean);
      } else {
        submitData.skills = [];
      }
      await updateCandidate(detail.id, submitData);
      setEditOpen(false);
      await refreshDetail();
      message.success("已更新");
      load();
    } catch {
      message.error("更新失败");
    } finally {
      setEditLoading(false);
    }
  };

  const columns: ColumnsType<Candidate> = [
    {
      title: "姓名",
      dataIndex: "name",
      width: 100,
    },
    {
      title: "应聘岗位",
      dataIndex: "job_title",
      width: 140,
      render: (v: string | null) => v || "-",
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (status: string) => (
        <Tag color={STATUS_COLORS[status] || "default"}>
          {STATUS_LABELS[status] || status}
        </Tag>
      ),
    },
    {
      title: "来源",
      dataIndex: "source",
      width: 90,
      render: (v: string | null) =>
        v ? SOURCE_LABELS[v] || v : "-",
    },
    {
      title: "学历",
      dataIndex: "highest_degree",
      width: 80,
      render: (v: string | null) => v || "-",
    },
    {
      title: "经验",
      dataIndex: "years_of_experience",
      width: 70,
      render: (v: number | null) => (v != null ? `${v}年` : "-"),
    },
    {
      title: "技能",
      dataIndex: "skills",
      width: 200,
      render: (skills: string[]) =>
        skills.length > 0
          ? skills.slice(0, 4).map((s) => (
              <Tag color="blue" key={s} style={{ marginBottom: 2 }}>
                {s}
              </Tag>
            ))
          : "-",
    },
    {
      title: "公司",
      dataIndex: "current_company",
      width: 120,
      render: (v: string | null) => v || "-",
    },
    {
      title: "AI 评分",
      dataIndex: "ai_score",
      width: 90,
      sorter: (a: Candidate, b: Candidate) => (a.ai_score ?? 0) - (b.ai_score ?? 0),
      render: (v: number | null, record: Candidate) => {
        if (v == null) return "-";
        const color = v >= 70 ? "#52c41a" : v >= 50 ? "#faad14" : "#ff4d4f";
        return (
          <Space size={4}>
            <Text strong style={{ color }}>{v}</Text>
            {record.ai_recommendation && (
              <Tag color={RECOMMENDATION_COLORS[record.ai_recommendation] || "default"} style={{ fontSize: 11 }}>
                {record.ai_recommendation}
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: "投递时间",
      dataIndex: "created_at",
      width: 110,
      render: (v: string) => v?.slice(0, 10) || "-",
    },
    {
      title: "操作",
      width: 120,
      render: (_: unknown, record: Candidate) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => openDetail(record.id)}
          >
            详情
          </Button>
          <Popconfirm
            title="确认删除该候选人？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const nextStatuses = detail
    ? VALID_TRANSITIONS[detail.status] || []
    : [];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          候选人管理
        </Title>
        <Space>
          <Button
            icon={<DownloadOutlined />}
            onClick={async () => {
              try {
                const params: Record<string, unknown> = {};
                if (statusFilter) params.status = statusFilter;
                if (jobFilter) params.job_id = jobFilter;
                await exportCandidates(params);
                message.success("导出成功");
              } catch {
                message.error("导出失败");
              }
            }}
          >
            导出 Excel
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/resumes/upload")}
          >
            上传简历
          </Button>
        </Space>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索姓名/手机/邮箱/公司"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={load}
            style={{ width: 240 }}
          />
          <Select
            placeholder="状态筛选"
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 130 }}
            options={Object.entries(STATUS_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <Select
            placeholder="岗位筛选"
            allowClear
            value={jobFilter}
            onChange={setJobFilter}
            style={{ width: 160 }}
            options={jobs.map((j) => ({ value: j.id, label: j.title }))}
          />
          <Button onClick={load}>刷新</Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: false }}
      />

      {/* 详情抽屉 */}
      <Drawer
        title={
          detail ? (
            <Space>
              <span>{detail.name}</span>
              <Tag color={STATUS_COLORS[detail.status]}>
                {STATUS_LABELS[detail.status]}
              </Tag>
            </Space>
          ) : "候选人详情"
        }
        width={640}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setDetail(null);
        }}
        loading={detailLoading}
        extra={
          detail && (
            <Space>
              <Button icon={<EditOutlined />} onClick={openEdit}>编辑</Button>
              <Popconfirm title="确认删除？" onConfirm={() => { handleDelete(detail.id); setDrawerOpen(false); }}>
                <Button danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
              {nextStatuses.length > 0 && (
                <>
                  <span style={{ fontSize: 13, color: "#888", marginLeft: 4 }}>变更状态：</span>
                  {nextStatuses.map((s) => (
                    <Button key={s} size="small" onClick={() => handleChangeStatus(s)}>
                      {STATUS_LABELS[s]}
                    </Button>
                  ))}
                </>
              )}
            </Space>
          )
        }
      >
        {detail && (
          <>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="姓名">{detail.name}</Descriptions.Item>
              <Descriptions.Item label="手机">{detail.phone || "-"}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{detail.email || "-"}</Descriptions.Item>
              <Descriptions.Item label="来源">
                {detail.source ? SOURCE_LABELS[detail.source] || detail.source : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="应聘岗位">{detail.job_title || "-"}</Descriptions.Item>
              <Descriptions.Item label="工作年限">
                {detail.years_of_experience != null ? `${detail.years_of_experience} 年` : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="当前公司">{detail.current_company || "-"}</Descriptions.Item>
              <Descriptions.Item label="最高学历">{detail.highest_degree || "-"}</Descriptions.Item>
              <Descriptions.Item label="毕业院校">{detail.school || "-"}</Descriptions.Item>
              <Descriptions.Item label="期望薪资">{detail.expected_salary || "-"}</Descriptions.Item>
              <Descriptions.Item label="到岗时间">{detail.availability || "-"}</Descriptions.Item>
              <Descriptions.Item label="简历文件">
                {detail.resume_saved_name ? (
                  <a href={`/uploads/${detail.resume_saved_name}`} target="_blank" rel="noreferrer">
                    <FilePdfOutlined /> {detail.resume_filename || "查看简历"}
                  </a>
                ) : (
                  detail.resume_filename || "-"
                )}
              </Descriptions.Item>
              <Descriptions.Item label="技能标签" span={2}>
                {detail.skills.length > 0
                  ? detail.skills.map((s) => <Tag color="blue" key={s}>{s}</Tag>)
                  : "-"}
              </Descriptions.Item>
            </Descriptions>

            {/* AI 评估卡片 */}
            {detail.ai_score != null && (
              <div style={{ marginTop: 24 }}>
                <Title level={5}>AI 智能评估</Title>
                <Card size="small" style={{ background: "#f6ffed", borderColor: "#b7eb8f" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{
                        width: 80, height: 80, borderRadius: "50%",
                        border: `4px solid ${detail.ai_score >= 70 ? "#52c41a" : detail.ai_score >= 50 ? "#faad14" : "#ff4d4f"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 24, fontWeight: 700,
                        color: detail.ai_score >= 70 ? "#52c41a" : detail.ai_score >= 50 ? "#faad14" : "#ff4d4f",
                      }}>
                        {detail.ai_score}
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>匹配度评分</Text>
                    </div>
                    <div style={{ flex: 1 }}>
                      {detail.ai_recommendation && (
                        <div style={{ marginBottom: 8 }}>
                          <Tag color={RECOMMENDATION_COLORS[detail.ai_recommendation] || "default"} style={{ fontSize: 14, padding: "2px 12px" }}>
                            {detail.ai_recommendation}
                          </Tag>
                        </div>
                      )}
                      {detail.ai_summary && <Paragraph style={{ marginBottom: 8 }}>{detail.ai_summary}</Paragraph>}
                      {detail.ai_match_details && (
                        <Space wrap>
                          {detail.ai_match_details.skills_match && detail.ai_match_details.skills_match.length > 0 && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              匹配技能: {detail.ai_match_details.skills_match.join(", ")}
                            </Text>
                          )}
                          {detail.ai_match_details.skills_missing && detail.ai_match_details.skills_missing.length > 0 && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              缺失技能: {detail.ai_match_details.skills_missing.join(", ")}
                            </Text>
                          )}
                        </Space>
                      )}
                    </div>
                  </div>
                  {detail.ai_match_details?.strengths && detail.ai_match_details.strengths.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>优势: </Text>
                      {detail.ai_match_details.strengths.map((s, i) => (
                        <Tag color="green" key={i} style={{ fontSize: 11 }}>{s}</Tag>
                      ))}
                    </div>
                  )}
                  {detail.ai_match_details?.concerns && detail.ai_match_details.concerns.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>关注: </Text>
                      {detail.ai_match_details.concerns.map((s, i) => (
                        <Tag color="orange" key={i} style={{ fontSize: 11 }}>{s}</Tag>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {detail.work_history && detail.work_history.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <Title level={5}>工作经历</Title>
                {detail.work_history.map((w, i) => (
                  <div key={i} style={{ marginBottom: 12, padding: 12, background: "#fafafa", borderRadius: 6 }}>
                    <Space style={{ marginBottom: 4 }}>
                      <Text strong>{w.company}</Text>
                      <Text type="secondary">{w.position}</Text>
                      <Text type="secondary">{w.duration}</Text>
                    </Space>
                    {w.summary && <Paragraph type="secondary" style={{ marginBottom: 0 }}>{w.summary}</Paragraph>}
                  </div>
                ))}
              </div>
            )}

            {detail.project_experience && detail.project_experience.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <Title level={5}>项目经验</Title>
                {detail.project_experience.map((p, i) => (
                  <div key={i} style={{ marginBottom: 12, padding: 12, background: "#fafafa", borderRadius: 6 }}>
                    <Space style={{ marginBottom: 4 }}>
                      <Text strong>{p.name}</Text>
                      {p.role && <Text type="secondary">{p.role}</Text>}
                      {p.duration && <Text type="secondary">{p.duration}</Text>}
                    </Space>
                    {p.description && <Paragraph type="secondary" style={{ marginBottom: 0 }}>{p.description}</Paragraph>}
                  </div>
                ))}
              </div>
            )}

            {detail.research_experience && detail.research_experience.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <Title level={5}>科研经历</Title>
                {detail.research_experience.map((r, i) => (
                  <div key={i} style={{ marginBottom: 12, padding: 12, background: "#fafafa", borderRadius: 6 }}>
                    <Space style={{ marginBottom: 4 }}>
                      <Text strong>{r.topic}</Text>
                      {r.role && <Text type="secondary">{r.role}</Text>}
                      {r.duration && <Text type="secondary">{r.duration}</Text>}
                    </Space>
                    {r.achievement && <Paragraph type="secondary" style={{ marginBottom: 0 }}>{r.achievement}</Paragraph>}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 24 }}>
              <Title level={5}>事件时间线</Title>
              {events.length === 0 ? (
                <Text type="secondary">暂无事件记录</Text>
              ) : (
                <Timeline
                  items={events.map((e) => {
                    let content = "";
                    if (e.event_type === "status_changed") {
                      const d = e.detail as { from?: string; to?: string };
                      const from = d.from ? STATUS_LABELS[d.from] || d.from : "";
                      const to = d.to ? STATUS_LABELS[d.to] || d.to : "";
                      content = `状态变更：${from} → ${to}`;
                    } else if (e.event_type === "resume_parsed") {
                      const d = e.detail as { filename?: string };
                      content = `简历解析完成：${d.filename || ""}`;
                    } else {
                      content = e.event_type;
                    }
                    return {
                      children: (
                        <div>
                          <div>{content}</div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {new Date(e.created_at).toLocaleString("zh-CN")}
                          </Text>
                        </div>
                      ),
                    };
                  })}
                />
              )}
            </div>
          </>
        )}
      </Drawer>

      {/* 编辑弹窗 */}
      <Modal
        title="编辑候选人信息"
        open={editOpen}
        onOk={handleEdit}
        onCancel={() => setEditOpen(false)}
        confirmLoading={editLoading}
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: "请输入姓名" }]}>
            <Input />
          </Form.Item>
          <Space style={{ width: "100%" }} size="middle">
            <Form.Item name="phone" label="手机" style={{ width: 300 }}>
              <Input />
            </Form.Item>
            <Form.Item name="email" label="邮箱" style={{ width: 300 }}>
              <Input />
            </Form.Item>
          </Space>
          <Space style={{ width: "100%" }} size="middle">
            <Form.Item name="source" label="来源" style={{ width: 300 }}>
              <Select allowClear placeholder="选择来源" options={SOURCE_OPTIONS} />
            </Form.Item>
            <Form.Item name="job_id" label="应聘岗位" style={{ width: 300 }}>
              <Select allowClear placeholder="选择岗位" options={jobs.map((j) => ({ value: j.id, label: j.title }))} />
            </Form.Item>
          </Space>
          <Space style={{ width: "100%" }} size="middle">
            <Form.Item name="years_of_experience" label="工作年限" style={{ width: 300 }}>
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="current_company" label="当前公司" style={{ width: 300 }}>
              <Input />
            </Form.Item>
          </Space>
          <Space style={{ width: "100%" }} size="middle">
            <Form.Item name="highest_degree" label="最高学历" style={{ width: 300 }}>
              <Input />
            </Form.Item>
            <Form.Item name="school" label="毕业院校" style={{ width: 300 }}>
              <Input />
            </Form.Item>
          </Space>
          <Space style={{ width: "100%" }} size="middle">
            <Form.Item name="expected_salary" label="期望薪资" style={{ width: 300 }}>
              <Input />
            </Form.Item>
            <Form.Item name="availability" label="到岗时间" style={{ width: 300 }}>
              <Input />
            </Form.Item>
          </Space>
          <Form.Item name="skills" label="技能（逗号分隔）">
            <Input placeholder="如：React, Python, MySQL" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
