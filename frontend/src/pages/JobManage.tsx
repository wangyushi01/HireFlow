import { useEffect, useState } from "react";
import {
  Table,
  Button,
  Typography,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Popconfirm,
  message,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { fetchJobs, createJob, updateJob, deleteJob } from "../services/api";
import type { Job } from "../services/types";

const { Title, Text } = Typography;

export default function JobManage() {
  const [data, setData] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<Job | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchJobs();
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditRecord(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: Job) => {
    setEditRecord(record);
    form.setFieldsValue({
      title: record.title,
      department: record.department,
      status: record.status,
      location: record.location,
      salary_range: record.salary_range,
      req_required_skills: record.requirements?.required_skills?.join(", ") || "",
      req_min_experience: record.requirements?.min_experience,
      req_education: record.requirements?.education,
      req_description: record.requirements?.description,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const requirements: Record<string, unknown> = {};
      if (values.req_required_skills) {
        requirements.required_skills = values.req_required_skills.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean);
      }
      if (values.req_min_experience != null) requirements.min_experience = values.req_min_experience;
      if (values.req_education) requirements.education = values.req_education;
      if (values.req_description) requirements.description = values.req_description;

      const submitData: Record<string, unknown> = {
        title: values.title,
        department: values.department,
        location: values.location,
        salary_range: values.salary_range,
      };
      if (editRecord) submitData.status = values.status;
      if (Object.keys(requirements).length > 0) submitData.requirements = requirements;

      if (editRecord) {
        await updateJob(editRecord.id, submitData);
        message.success("岗位已更新");
      } else {
        await createJob(submitData as Parameters<typeof createJob>[0]);
        message.success("岗位已创建");
      }
      setModalOpen(false);
      load();
    } catch {
      message.error("操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteJob(id);
      message.success("已删除");
      load();
    } catch {
      message.error("删除失败");
    }
  };

  const columns: ColumnsType<Job> = [
    {
      title: "岗位名称",
      dataIndex: "title",
      width: 180,
    },
    {
      title: "部门",
      dataIndex: "department",
      width: 120,
      render: (v: string | null) => v || "-",
    },
    {
      title: "地点",
      dataIndex: "location",
      width: 100,
      render: (v: string | null) => v || "-",
    },
    {
      title: "薪资范围",
      dataIndex: "salary_range",
      width: 120,
      render: (v: string | null) => v || "-",
    },
    {
      title: "岗位要求",
      dataIndex: "requirements",
      width: 200,
      render: (v: Record<string, unknown> | null) => {
        if (!v) return <Text type="secondary">未设置</Text>;
        const parts: string[] = [];
        if (v.required_skills) parts.push(`技能: ${(v.required_skills as string[]).join(", ")}`);
        if (v.min_experience) parts.push(`${v.min_experience}年+经验`);
        if (v.education) parts.push(v.education as string);
        return parts.length > 0 ? parts.join(" | ") : <Text type="secondary">未设置</Text>;
      },
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 90,
      render: (status: string) => (
        <Tag color={status === "open" ? "green" : "default"}>
          {status === "open" ? "开放中" : "已关闭"}
        </Tag>
      ),
    },
    {
      title: "操作",
      width: 140,
      render: (_: unknown, record: Job) => (
        <Space>
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除该岗位？" onConfirm={() => handleDelete(record.id)}>
            <Button type="text" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>岗位管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新增岗位
        </Button>
      </div>

      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={false} />

      <Modal
        title={editRecord ? "编辑岗位" : "新增岗位"}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="岗位名称" rules={[{ required: true, message: "请输入岗位名称" }]}>
            <Input />
          </Form.Item>
          <Space style={{ width: "100%" }} size="middle">
            <Form.Item name="department" label="所属部门" style={{ width: 280 }}>
              <Input />
            </Form.Item>
            <Form.Item name="location" label="工作地点" style={{ width: 280 }}>
              <Input placeholder="如：北京" />
            </Form.Item>
          </Space>
          <Space style={{ width: "100%" }} size="middle">
            <Form.Item name="salary_range" label="薪资范围" style={{ width: 280 }}>
              <Input placeholder="如：20K-35K" />
            </Form.Item>
            {editRecord && (
              <Form.Item name="status" label="状态" style={{ width: 280 }}>
                <Select options={[{ value: "open", label: "开放中" }, { value: "closed", label: "已关闭" }]} />
              </Form.Item>
            )}
          </Space>

          <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 16, marginTop: 8 }}>
            <Text strong style={{ marginBottom: 12, display: "block" }}>岗位要求（用于 AI 智能匹配）</Text>
          </div>
          <Form.Item name="req_required_skills" label="必备技能（逗号分隔）">
            <Input placeholder="如：Java, Spring Boot, MySQL" />
          </Form.Item>
          <Space style={{ width: "100%" }} size="middle">
            <Form.Item name="req_min_experience" label="最低工作年限" style={{ width: 280 }}>
              <InputNumber min={0} style={{ width: "100%" }} placeholder="如：3" addonAfter="年" />
            </Form.Item>
            <Form.Item name="req_education" label="学历要求" style={{ width: 280 }}>
              <Select allowClear placeholder="选择学历要求" options={[
                { value: "不限", label: "不限" },
                { value: "大专及以上", label: "大专及以上" },
                { value: "本科及以上", label: "本科及以上" },
                { value: "硕士及以上", label: "硕士及以上" },
              ]} />
            </Form.Item>
          </Space>
          <Form.Item name="req_description" label="岗位描述">
            <Input.TextArea rows={3} placeholder="简要描述岗位职责和期望" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
