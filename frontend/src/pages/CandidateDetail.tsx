import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  Descriptions,
  Tag,
  Timeline,
  Button,
  Space,
  Typography,
  Spin,
  message,
  Popconfirm,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
} from "antd";
import {
  ArrowLeftOutlined,
  SwapOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import {
  fetchCandidate,
  fetchEvents,
  changeStatus,
  updateCandidate,
  deleteCandidate,
  fetchJobs,
} from "../services/api";
import type { Candidate, Event, Job } from "../services/types";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  SOURCE_LABELS,
} from "../services/types";

const { Title } = Typography;

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

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [c, evts, j] = await Promise.all([
        fetchCandidate(Number(id)),
        fetchEvents(Number(id)),
        fetchJobs(),
      ]);
      setCandidate(c);
      setEvents(evts);
      setJobs(j);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleChangeStatus = async (newStatus: string) => {
    if (!candidate) return;
    try {
      const updated = await changeStatus(candidate.id, newStatus);
      setCandidate(updated);
      const evts = await fetchEvents(candidate.id);
      setEvents(evts);
      message.success(
        `状态已变更为「${STATUS_LABELS[newStatus] || newStatus}」`
      );
    } catch {
      message.error("状态变更失败");
    }
  };

  const handleDelete = async () => {
    if (!candidate) return;
    try {
      await deleteCandidate(candidate.id);
      message.success("已删除");
      navigate("/candidates");
    } catch {
      message.error("删除失败");
    }
  };

  const openEdit = () => {
    if (!candidate) return;
    form.setFieldsValue({
      name: candidate.name,
      phone: candidate.phone,
      email: candidate.email,
      source: candidate.source,
      job_id: candidate.job_id,
      years_of_experience: candidate.years_of_experience,
      current_company: candidate.current_company,
      highest_degree: candidate.highest_degree,
      school: candidate.school,
      expected_salary: candidate.expected_salary,
      availability: candidate.availability,
      skills: candidate.skills.join(", "),
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!candidate) return;
    const values = await form.validateFields();
    setEditLoading(true);
    try {
      const data: Record<string, unknown> = { ...values };
      if (typeof values.skills === "string" && values.skills.trim()) {
        data.skills = values.skills.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean);
      } else {
        data.skills = [];
      }
      const updated = await updateCandidate(candidate.id, data);
      setCandidate(updated);
      setEditOpen(false);
      message.success("已更新");
    } catch {
      message.error("更新失败");
    } finally {
      setEditLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!candidate) {
    return <div>候选人不存在</div>;
  }

  const nextStatuses = VALID_TRANSITIONS[candidate.status] || [];

  const renderEventTimeline = () => {
    if (events.length === 0) {
      return <Typography.Text type="secondary">暂无事件记录</Typography.Text>;
    }

    return (
      <Timeline
        items={events.map((e) => {
          let content = "";
          if (e.event_type === "status_changed") {
            const detail = e.detail as { from?: string; to?: string };
            const fromLabel = detail.from ? (STATUS_LABELS[detail.from] || detail.from) : "";
            const toLabel = detail.to ? (STATUS_LABELS[detail.to] || detail.to) : "";
            content = `状态变更：${fromLabel} → ${toLabel}`;
          } else if (e.event_type === "resume_parsed") {
            const detail = e.detail as { filename?: string };
            content = `简历解析完成：${detail.filename || ""}`;
          } else {
            content = `${e.event_type}`;
          }

          return {
            children: (
              <div>
                <div>{content}</div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {new Date(e.created_at).toLocaleString("zh-CN")}
                </Typography.Text>
              </div>
            ),
          };
        })}
      />
    );
  };

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
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/candidates")}
          >
            返回列表
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            {candidate.name}
          </Title>
          <Tag color={STATUS_COLORS[candidate.status]}>
            {STATUS_LABELS[candidate.status]}
          </Tag>
        </Space>

        <Space>
          <Button icon={<EditOutlined />} onClick={openEdit}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除该候选人？删除后不可恢复"
            onConfirm={handleDelete}
          >
            <Button danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
          {nextStatuses.length > 0 && (
            <>
              <SwapOutlined style={{ marginLeft: 8 }} />
              <span>变更状态：</span>
              {nextStatuses.map((s) => (
                <Button
                  key={s}
                  size="small"
                  onClick={() => handleChangeStatus(s)}
                >
                  {STATUS_LABELS[s]}
                </Button>
              ))}
            </>
          )}
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions bordered column={2} size="small">
          <Descriptions.Item label="姓名">
            {candidate.name}
          </Descriptions.Item>
          <Descriptions.Item label="手机">
            {candidate.phone || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="邮箱">
            {candidate.email || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="来源">
            {candidate.source
              ? SOURCE_LABELS[candidate.source] || candidate.source
              : "-"}
          </Descriptions.Item>
          <Descriptions.Item label="应聘岗位">
            {candidate.job_title || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="工作年限">
            {candidate.years_of_experience != null
              ? `${candidate.years_of_experience} 年`
              : "-"}
          </Descriptions.Item>
          <Descriptions.Item label="当前公司">
            {candidate.current_company || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="最高学历">
            {candidate.highest_degree || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="毕业院校">
            {candidate.school || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="期望薪资">
            {candidate.expected_salary || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="到岗时间">
            {candidate.availability || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="简历文件">
            {candidate.resume_filename || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="技能标签" span={2}>
            {candidate.skills.length > 0
              ? candidate.skills.map((s) => (
                  <Tag color="blue" key={s}>
                    {s}
                  </Tag>
                ))
              : "-"}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {candidate.work_history && candidate.work_history.length > 0 && (
        <Card title="工作经历" style={{ marginBottom: 16 }}>
          {candidate.work_history.map((w, i) => (
            <Card key={i} size="small" style={{ marginBottom: 8 }} type="inner">
              <Descriptions column={3} size="small">
                <Descriptions.Item label="公司">
                  {w.company}
                </Descriptions.Item>
                <Descriptions.Item label="职位">
                  {w.position}
                </Descriptions.Item>
                <Descriptions.Item label="时间">
                  {w.duration}
                </Descriptions.Item>
              </Descriptions>
              {w.summary && (
                <Typography.Paragraph
                  type="secondary"
                  style={{ marginTop: 4, marginBottom: 0 }}
                >
                  {w.summary}
                </Typography.Paragraph>
              )}
            </Card>
          ))}
        </Card>
      )}

      <Card title="事件时间线">{renderEventTimeline()}</Card>

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
