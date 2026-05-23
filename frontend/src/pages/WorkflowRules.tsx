import { useEffect, useState } from "react";
import {
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Modal,
  Form,
  Select,
  Input,
  InputNumber,
  Switch,
  Popconfirm,
  message,
} from "antd";
import { PlusOutlined, ThunderboltOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  fetchWorkflowRules,
  createWorkflowRule,
  updateWorkflowRule,
  deleteWorkflowRule,
  executeWorkflow,
  fetchJobs,
} from "../services/api";
import type { WorkflowRule, Job, WorkflowAlert } from "../services/types";
import {
  TRIGGER_TYPE_LABELS,
  ACTION_TYPE_LABELS,
} from "../services/types";

const { Title, Text } = Typography;

const TRIGGER_OPTIONS = [
  { value: "score_threshold", label: "评分阈值" },
  { value: "time_in_stage", label: "阶段停留时间" },
];

const ACTION_OPTIONS = [
  { value: "auto_advance", label: "自动推进" },
  { value: "auto_reject", label: "自动拒绝" },
  { value: "to_talent_pool", label: "归档人才库" },
  { value: "alert", label: "预警提醒" },
];

const STATUS_LABELS: Record<string, string> = {
  resume_received: "已投递",
  screening: "筛选中",
  interview: "面试中",
  offer: "Offer",
  hired: "已入职",
  rejected: "已拒绝",
  talent_pool: "人才库",
};

export default function WorkflowRules() {
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<WorkflowRule | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [alerts, setAlerts] = useState<WorkflowAlert[]>([]);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [r, j] = await Promise.all([fetchWorkflowRules(), fetchJobs()]);
      setRules(r);
      setJobs(j);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({
      is_active: true,
      trigger_type: "score_threshold",
      action_type: "auto_advance",
    });
    setModalOpen(true);
  };

  const openEdit = (rule: WorkflowRule) => {
    setEditingRule(rule);
    form.setFieldsValue({
      name: rule.name,
      job_id: rule.job_id,
      trigger_type: rule.trigger_type,
      action_type: rule.action_type,
      is_active: !!rule.is_active,
    });
    if (rule.trigger_config) {
      form.setFieldsValue({
        min_score: (rule.trigger_config as Record<string, unknown>).min_score,
        source_status: (rule.trigger_config as Record<string, unknown>).source_status,
        stage: (rule.trigger_config as Record<string, unknown>).stage,
        max_days: (rule.trigger_config as Record<string, unknown>).max_days,
      });
    }
    if (rule.action_config) {
      form.setFieldsValue({
        target_status: (rule.action_config as Record<string, unknown>).target_status,
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const trigger_type = values.trigger_type;
      const action_type = values.action_type;

      let trigger_config: Record<string, unknown> = {};
      if (trigger_type === "score_threshold") {
        trigger_config = {
          min_score: values.min_score ?? 70,
          source_status: values.source_status ?? "resume_received",
        };
      } else if (trigger_type === "time_in_stage") {
        trigger_config = {
          stage: values.stage ?? "screening",
          max_days: values.max_days ?? 7,
        };
      }

      let action_config: Record<string, unknown> = {};
      if (action_type === "auto_advance") {
        action_config = { target_status: values.target_status ?? "screening" };
      }

      const payload = {
        name: values.name,
        job_id: values.job_id ?? null,
        trigger_type,
        trigger_config,
        action_type,
        action_config,
        is_active: values.is_active ? 1 : 0,
      };

      if (editingRule) {
        await updateWorkflowRule(editingRule.id, payload);
        message.success("规则已更新");
      } else {
        await createWorkflowRule(payload);
        message.success("规则已创建");
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
      await deleteWorkflowRule(id);
      message.success("已删除");
      load();
    } catch {
      message.error("删除失败");
    }
  };

  const handleExecute = async () => {
    setExecuting(true);
    try {
      const res = await executeWorkflow();
      setAlerts(res.alerts);
      setResultOpen(true);
      if (res.alerts.length === 0) {
        message.info("没有匹配的规则需要执行");
      } else {
        message.success(`已执行 ${res.alerts.length} 条操作`);
      }
      load();
    } catch {
      message.error("执行失败");
    } finally {
      setExecuting(false);
    }
  };

  const triggerType = Form.useWatch("trigger_type", form);
  const actionType = Form.useWatch("action_type", form);

  const columns: ColumnsType<WorkflowRule> = [
    { title: "规则名称", dataIndex: "name", width: 180 },
    {
      title: "适用范围",
      dataIndex: "job_id",
      width: 140,
      render: (v: number | null) => {
        if (!v) return <Tag>全局</Tag>;
        const job = jobs.find((j) => j.id === v);
        return job?.title || `岗位 #${v}`;
      },
    },
    {
      title: "触发类型",
      dataIndex: "trigger_type",
      width: 120,
      render: (v: string) => TRIGGER_TYPE_LABELS[v] || v,
    },
    {
      title: "触发条件",
      dataIndex: "trigger_config",
      width: 200,
      render: (v: Record<string, unknown> | null, record: WorkflowRule) => {
        if (!v && !record.trigger_config) return "-";
        const c = v || record.trigger_config || {};
        if (record.trigger_type === "score_threshold") {
          return `评分 ≥ ${c.min_score ?? 70} 分`;
        }
        if (record.trigger_type === "time_in_stage") {
          const stageLabel = STATUS_LABELS[String(c.stage || "screening")] || c.stage;
          return `阶段「${stageLabel}」停留 > ${c.max_days ?? 7} 天`;
        }
        return JSON.stringify(c);
      },
    },
    {
      title: "执行动作",
      dataIndex: "action_type",
      width: 110,
      render: (v: string, record: WorkflowRule) => {
        const label = ACTION_TYPE_LABELS[v] || v;
        if (v === "auto_advance" && record.action_config) {
          const ac = record.action_config as Record<string, unknown>;
          return `${label} → ${STATUS_LABELS[String(ac?.target_status)] || ac?.target_status || "?"}`;
        }
        return label;
      },
    },
    {
      title: "状态",
      dataIndex: "is_active",
      width: 70,
      render: (v: number) => (v ? <Tag color="green">启用</Tag> : <Tag color="default">禁用</Tag>),
    },
    {
      title: "操作",
      width: 120,
      render: (_: unknown, record: WorkflowRule) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="text" danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>自动化工作流</Title>
        <Space>
          <Button icon={<ThunderboltOutlined />} onClick={handleExecute} loading={executing}>
            手动执行
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建规则
          </Button>
        </Space>
      </div>

      <Table rowKey="id" columns={columns} dataSource={rules} loading={loading} pagination={false} />

      <Modal
        title={editingRule ? "编辑规则" : "新建规则"}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: "请输入规则名称" }]}>
            <Input placeholder="如：高分自动推进" />
          </Form.Item>
          <Form.Item name="job_id" label="适用范围">
            <Select allowClear placeholder="留空=全局规则" options={jobs.map((j) => ({ value: j.id, label: j.title }))} />
          </Form.Item>
          <Form.Item name="trigger_type" label="触发类型" rules={[{ required: true }]}>
            <Select options={TRIGGER_OPTIONS} />
          </Form.Item>

          {triggerType === "score_threshold" && (
            <>
              <Form.Item name="source_status" label="来源阶段" initialValue="resume_received">
                <Select
                  options={Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                />
              </Form.Item>
              <Form.Item name="min_score" label="最低评分" initialValue={70}>
                <InputNumber min={0} max={100} style={{ width: "100%" }} />
              </Form.Item>
            </>
          )}

          {triggerType === "time_in_stage" && (
            <>
              <Form.Item name="stage" label="监控阶段" initialValue="screening">
                <Select
                  options={Object.entries(STATUS_LABELS)
                    .filter(([v]) => !["rejected", "talent_pool", "hired"].includes(v))
                    .map(([v, l]) => ({ value: v, label: l }))}
                />
              </Form.Item>
              <Form.Item name="max_days" label="最大停留天数" initialValue={7}>
                <InputNumber min={1} max={365} style={{ width: "100%" }} addonAfter="天" />
              </Form.Item>
            </>
          )}

          <Form.Item name="action_type" label="执行动作" rules={[{ required: true }]}>
            <Select options={ACTION_OPTIONS} />
          </Form.Item>

          {actionType === "auto_advance" && (
            <Form.Item name="target_status" label="推进到" initialValue="screening">
              <Select
                options={Object.entries(STATUS_LABELS)
                  .filter(([v]) => !["rejected", "talent_pool"].includes(v))
                  .map(([v, l]) => ({ value: v, label: l }))}
              />
            </Form.Item>
          )}

          <Form.Item name="is_active" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="执行结果"
        open={resultOpen}
        onCancel={() => setResultOpen(false)}
        footer={null}
        width={600}
      >
        {alerts.length === 0 ? (
          <Text type="secondary">没有匹配的规则需要执行</Text>
        ) : (
          alerts.map((a, i) => (
            <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
              <Space>
                <Tag color="blue">{a.rule_name}</Tag>
                <Text strong>{a.candidate_name}</Text>
                <Text>{a.action}</Text>
              </Space>
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{a.trigger}</Text>
              </div>
            </div>
          ))
        )}
      </Modal>
    </div>
  );
}
