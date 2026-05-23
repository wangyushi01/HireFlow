import { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload, Card, Tag, Space, Alert, Spin, Typography, Select,
  Progress, Table, Button, Tooltip,
} from "antd";
import {
  InboxOutlined, CheckCircleOutlined, UploadOutlined,
  FileAddOutlined, FileTextOutlined, ThunderboltOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import {
  uploadResume, fetchJobs, batchUploadResumes, fetchBatchStatus,
} from "../services/api";
import type { ParseResult, Job, BatchTaskStatus } from "../services/types";
import { RECOMMENDATION_COLORS } from "../services/types";

const { Dragger } = Upload;
const { Title, Text } = Typography;

type UploadStage = "idle" | "uploading" | "parsing" | "scoring" | "done" | "error";
type ActiveStage = Exclude<UploadStage, "idle">;

const STAGE_CONFIG: Record<ActiveStage, { label: string; icon: React.ReactNode; color: string }> = {
  uploading: { label: "上传文件", icon: <UploadOutlined />, color: "#1890ff" },
  parsing: { label: "AI 解析简历", icon: <FileTextOutlined />, color: "#722ed1" },
  scoring: { label: "AI 评分匹配", icon: <ThunderboltOutlined />, color: "#faad14" },
  done: { label: "完成", icon: <SafetyCertificateOutlined />, color: "#52c41a" },
  error: { label: "失败", icon: <SafetyCertificateOutlined />, color: "#ff4d4f" },
};

const BATCH_STEPS = [
  { key: "uploading", label: "上传文件" },
  { key: "processing", label: "AI 批量处理" },
  { key: "done", label: "完成" },
] as const;

function useSmoothProgress(active: boolean, targetPercent: number) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      setDisplay(0);
      return;
    }
    const step = () => {
      setDisplay((prev) => {
        if (prev >= targetPercent) return targetPercent;
        const diff = targetPercent - prev;
        const speed = diff > 20 ? 4 : diff > 5 ? 2 : 1;
        return Math.min(prev + speed, targetPercent);
      });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, targetPercent]);

  return active ? Math.min(Math.round(display), 100) : 0;
}

function UploadStageProgress({ stage, percent }: { stage: UploadStage; percent: number }) {
  if (stage === "idle") return null;

  const stages: ActiveStage[] = ["uploading", "parsing", "scoring"];
  const currentIdx = stages.indexOf(stage as ActiveStage);
  const isFinal = stage === "done" || stage === "error";

  return (
    <Card
      style={{
        marginTop: 16, borderRadius: 10, border: "none",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      {/* Steps indicator */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: 20 }}>
        {stages.map((s, i) => {
          const cfg = STAGE_CONFIG[s];
          const completed = isFinal || i < currentIdx;
          const current = i === currentIdx && !isFinal;
          return (
            <div key={s} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 80 }}>
                <div
                  style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: completed
                      ? "linear-gradient(135deg, #73d13d 0%, #52c41a 100%)"
                      : current
                        ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                        : "#f0f0f0",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.3s ease",
                    boxShadow: current ? "0 2px 8px rgba(102,126,234,0.4)" : "none",
                  }}
                >
                  {completed ? (
                    <CheckCircleOutlined style={{ color: "#fff", fontSize: 16 }} />
                  ) : (
                    <span style={{ color: current ? "#fff" : "#bbb", fontSize: 14 }}>{cfg.icon}</span>
                  )}
                </div>
                <Text
                  style={{
                    fontSize: 12, marginTop: 6,
                    color: completed ? "#52c41a" : current ? "#667eea" : "#bbb",
                    fontWeight: current || completed ? 600 : 400,
                  }}
                >
                  {cfg.label}
                </Text>
              </div>
              {i < stages.length - 1 && (
                <div
                  style={{
                    width: 40, height: 2, margin: "0 4px", marginBottom: 20,
                    background: completed || currentIdx > i ? "#52c41a" : "#f0f0f0",
                    borderRadius: 1, transition: "background 0.3s ease",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div style={{ maxWidth: 400, margin: "0 auto" }}>
        <Progress
          percent={percent}
          status={isFinal ? (stage === "done" ? "success" : "exception" as const) : "active"}
          strokeColor={
            stage === "done" ? "#52c41a" : stage === "error" ? "#ff4d4f"
              : { from: "#667eea", to: "#764ba2" }
          }
          format={(p) => `${p}%`}
          size={["100%", 10]}
        />
      </div>

      <div style={{ textAlign: "center", marginTop: 12 }}>
        <Spin size="small" spinning={!isFinal} />
        <Text type="secondary" style={{ fontSize: 13, marginLeft: 8 }}>
          {isFinal
            ? stage === "done" ? "处理完成" : "处理失败"
            : `${STAGE_CONFIG[stage].label}中...`}
        </Text>
      </div>
    </Card>
  );
}

function BatchProgressCard({
  percent, polling, status,
}: {
  percent: number; polling: boolean; status: BatchTaskStatus | null;
}) {
  const completed = status?.completed ?? 0;
  const failed = status?.failed ?? 0;
  const total = status?.total ?? 0;
  const done = completed + failed;
  type BatchStepKey = typeof BATCH_STEPS[number]["key"];
  const currentStep: BatchStepKey = percent >= 100 ? "done" : percent > 0 ? "processing" : "uploading";
  const isDone = currentStep === "done";
  const currentStepIdx = BATCH_STEPS.findIndex((s) => s.key === currentStep);

  return (
    <Card
      style={{
        marginTop: 16, borderRadius: 10, border: "none",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      {/* Step indicators */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: 20 }}>
        {BATCH_STEPS.map((step, i) => {
          const stepKey = step.key;
          const isCompleted = isDone || currentStepIdx > i;
          const isCurrent = stepKey === currentStep && !isDone;
          return (
            <div key={stepKey} style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 80 }}>
                <div
                  style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: isCompleted
                      ? "linear-gradient(135deg, #73d13d 0%, #52c41a 100%)"
                      : isCurrent
                        ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                        : "#f0f0f0",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.3s ease",
                    boxShadow: isCurrent ? "0 2px 8px rgba(102,126,234,0.4)" : "none",
                  }}
                >
                  {isCompleted ? (
                    <CheckCircleOutlined style={{ color: "#fff", fontSize: 16 }} />
                  ) : (
                    <span style={{ color: isCurrent ? "#fff" : "#bbb", fontSize: 14 }}>{i + 1}</span>
                  )}
                </div>
                <Text
                  style={{
                    fontSize: 12, marginTop: 6,
                    color: isCompleted ? "#52c41a" : isCurrent ? "#667eea" : "#bbb",
                    fontWeight: isCurrent || isCompleted ? 600 : 400,
                  }}
                >
                  {step.label}
                </Text>
              </div>
              {i < BATCH_STEPS.length - 1 && (
                <div
                  style={{
                    width: 40, height: 2, margin: "0 4px", marginBottom: 20,
                    background: isCompleted ? "#52c41a" : "#f0f0f0",
                    borderRadius: 1, transition: "background 0.3s ease",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div style={{ maxWidth: 400, margin: "0 auto" }}>
        <Progress
          percent={percent}
          status={isDone ? "success" : "active"}
          strokeColor={isDone ? "#52c41a" : { from: "#667eea", to: "#764ba2" }}
          format={(p) => `${p}%`}
          size={["100%", 10]}
        />
      </div>

      <div style={{ textAlign: "center", marginTop: 12 }}>
        <Spin size="small" spinning={polling} />
        <Text type="secondary" style={{ fontSize: 13, marginLeft: 8 }}>
          {isDone
            ? `全部完成（成功 ${completed} / 失败 ${failed}）`
            : polling
              ? `正在处理 ${done} / ${total} ...`
              : "准备中..."}
        </Text>
      </div>

      {/* Per-file mini progress */}
      {polling && total > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
            {Array.from({ length: total }).map((_, i) => {
              const isFileDone = i < completed;
              const isFileFailed = i >= completed && i < done;
              const isProcessing = i === done && done < total;
              return (
                <Tooltip key={i} title={isFileDone ? "成功" : isFileFailed ? "失败" : isProcessing ? "处理中" : "等待中"}>
                  <div
                    style={{
                      width: 12, height: 12, borderRadius: 3,
                      background: isFileDone ? "#52c41a" : isFileFailed ? "#ff4d4f" : isProcessing ? "#667eea" : "#f0f0f0",
                      transition: "background 0.3s ease",
                      animation: isProcessing ? "pulse 1.2s ease-in-out infinite" : "none",
                    }}
                  />
                </Tooltip>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function ResumeUpload() {
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);

  // Single upload state
  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");
  const [rawPercent, setRawPercent] = useState(0);
  const parseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const smoothPercent = useSmoothProgress(uploadStage !== "idle", rawPercent);

  // Batch state
  const [batchProgress, setBatchProgress] = useState<BatchTaskStatus | null>(null);
  const [batchPolling, setBatchPolling] = useState(false);
  const [batchPercent, setBatchPercent] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchJobs().then(setJobs);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (parseTimerRef.current) clearInterval(parseTimerRef.current);
    };
  }, []);

  const resetState = useCallback(() => {
    setError(null);
    setResult(null);
    setUploadStage("idle");
    setRawPercent(0);
    setBatchProgress(null);
    setBatchPercent(0);
    if (parseTimerRef.current) clearInterval(parseTimerRef.current);
  }, []);

  const handleSingleUpload = async (file: File) => {
    if (!selectedJobId) {
      setError("请先选择应聘岗位");
      return;
    }

    resetState();
    setLoading(true);

    // Stage 1: uploading (real progress via axios)
    setUploadStage("uploading");
    setRawPercent(0);

    try {
      const res = await uploadResume(file, selectedJobId, (pct) => {
        // Upload is roughly first 30% of total progress
        setRawPercent(Math.round(pct * 0.3));
        if (pct >= 100) {
          // Move to parsing stage
          setUploadStage("parsing");
          setRawPercent(30);
          // Simulate parsing progress 30% → 65%
          if (parseTimerRef.current) clearInterval(parseTimerRef.current);
          parseTimerRef.current = setInterval(() => {
            setRawPercent((prev) => {
              if (prev >= 65) return prev;
              return prev + (65 - prev) * 0.08;
            });
          }, 300);
        }
      });

      // Stage 3: scoring (simulate 65% → 95%)
      setUploadStage("scoring");
      if (parseTimerRef.current) clearInterval(parseTimerRef.current);
      parseTimerRef.current = setInterval(() => {
        setRawPercent((prev) => {
          if (prev >= 95) return 95;
          return prev + (95 - prev) * 0.1;
        });
      }, 200);

      // Small delay to show scoring stage
      await new Promise((r) => setTimeout(r, 600));

      if (parseTimerRef.current) clearInterval(parseTimerRef.current);
      setRawPercent(100);
      setUploadStage("done");
      setResult(res);

      if (res.parse_status === "failed") {
        setUploadStage("error");
        setError(res.error || "解析失败，请检查文件内容");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "上传失败";
      setUploadStage("error");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const startBatchPolling = (taskId: string) => {
    setBatchPolling(true);
    setBatchPercent(0);
    pollRef.current = setInterval(async () => {
      try {
        const status = await fetchBatchStatus(taskId);
        setBatchProgress(status);
        const done = status.completed + status.failed;
        setBatchPercent(Math.round((done / status.total) * 100));
        if (done >= status.total) {
          if (pollRef.current) clearInterval(pollRef.current);
          setBatchPolling(false);
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current);
        setBatchPolling(false);
      }
    }, 1500);
  };

  const handleBatchUpload = async (files: File[]) => {
    if (!selectedJobId) {
      setError("请先选择应聘岗位");
      return;
    }

    resetState();
    setLoading(true);
    setBatchPercent(5);

    try {
      const { task_id } = await batchUploadResumes(files, selectedJobId);
      setBatchProgress({ task_id, total: files.length, completed: 0, failed: 0, results: [] });
      setLoading(false);
      startBatchPolling(task_id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "批量上传失败";
      setError(msg);
      setLoading(false);
    }
  };

  const batchColumns = [
    {
      title: "候选人",
      dataIndex: ["parsed_data", "name"],
      render: (_: unknown, record: ParseResult) => record.parsed_data?.name || "-",
    },
    {
      title: "AI 评分",
      dataIndex: ["parsed_data", "ai_score"],
      render: (_: unknown, record: ParseResult) => {
        if (record.parsed_data?.ai_score != null) {
          const s = record.parsed_data.ai_score;
          return (
            <Text strong style={{ color: s >= 70 ? "#52c41a" : s >= 50 ? "#faad14" : "#ff4d4f" }}>
              {s}
            </Text>
          );
        }
        return "-";
      },
    },
    {
      title: "AI 推荐",
      dataIndex: ["parsed_data", "ai_recommendation"],
      render: (_: unknown, record: ParseResult) => {
        const r = record.parsed_data?.ai_recommendation;
        return r ? <Tag color={RECOMMENDATION_COLORS[r] || "default"}>{r}</Tag> : "-";
      },
    },
    {
      title: "状态",
      dataIndex: "parse_status",
      render: (s: string) => (
        <Tag color={s === "done" ? "success" : "error"}>
          {s === "done" ? "成功" : "失败"}
        </Tag>
      ),
    },
  ];

  const isBusy = loading || batchPolling;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          padding: "20px 24px 16px",
          margin: "-24px -24px 20px",
          borderRadius: "8px 8px 0 0",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0, color: "#fff" }}>简历上传</Title>
          <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 13 }}>
            上传简历，AI 自动解析并评分
          </Text>
        </div>
        <Space>
          <Button
            type={mode === "single" ? "default" : "text"}
            icon={<FileAddOutlined />}
            onClick={() => { setMode("single"); resetState(); }}
            style={{
              color: mode === "single" ? "#667eea" : "rgba(255,255,255,0.8)",
              background: mode === "single" ? "#fff" : "transparent",
              borderRadius: 6,
            }}
          >
            单份上传
          </Button>
          <Button
            type={mode === "batch" ? "default" : "text"}
            icon={<UploadOutlined />}
            onClick={() => { setMode("batch"); resetState(); }}
            style={{
              color: mode === "batch" ? "#667eea" : "rgba(255,255,255,0.8)",
              background: mode === "batch" ? "#fff" : "transparent",
              borderRadius: 6,
            }}
          >
            批量上传
          </Button>
        </Space>
      </div>

      {/* Job selector */}
      <Card
        style={{
          marginBottom: 16, borderRadius: 10, border: "none",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        <Space>
          <span style={{ fontWeight: 500 }}>应聘岗位：</span>
          <Select
            placeholder="请选择应聘岗位（必填）"
            style={{ width: 300 }}
            value={selectedJobId}
            onChange={setSelectedJobId}
            options={jobs.map((j) => ({ value: j.id, label: j.title }))}
          />
        </Space>
      </Card>

      {mode === "batch" ? (
        <>
          <Dragger
            accept=".pdf,.docx,.doc"
            multiple
            showUploadList={false}
            customRequest={({ onSuccess }) => onSuccess?.("ok")}
            disabled={isBusy || !selectedJobId}
            style={{ borderRadius: 10 }}
            onChange={({ fileList }) => {
              const done = fileList.filter((f) => f.status === "done" && f.originFileObj);
              if (done.length > 0 && !batchPolling) {
                handleBatchUpload(done.map((f) => f.originFileObj!));
              }
            }}
          >
            {isBusy ? (
              <div style={{ padding: "40px 0" }}>
                <Spin size="large" />
                <div style={{ marginTop: 16, color: "#667eea", fontWeight: 500 }}>
                  {loading ? "正在上传文件..." : "AI 正在批量解析简历..."}
                </div>
              </div>
            ) : (
              <>
                <p className="ant-upload-drag-icon"><InboxOutlined style={{ color: "#667eea" }} /></p>
                <p className="ant-upload-text">点击或拖拽多个简历文件到此区域</p>
                <p className="ant-upload-hint">支持 PDF、Word 格式，可同时选择多份简历</p>
              </>
            )}
          </Dragger>

          {/* Batch progress */}
          {(batchPolling || batchPercent > 0) && (
            <BatchProgressCard
              percent={batchPercent}
              polling={batchPolling}
              status={batchProgress}
            />
          )}

          {/* Batch results table */}
          {batchProgress && batchProgress.results.length > 0 && (
            <Card
              style={{
                marginTop: 16, borderRadius: 10, border: "none",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <Table
                rowKey="candidate_id"
                columns={batchColumns}
                dataSource={batchProgress.results.filter((r) => r.candidate_id > 0)}
                pagination={false}
                size="small"
              />
            </Card>
          )}
        </>
      ) : (
        <>
          <Dragger
            accept=".pdf,.docx,.doc"
            showUploadList={false}
            customRequest={({ file: f, onSuccess }) => {
              handleSingleUpload(f as File);
              onSuccess?.("ok");
            }}
            disabled={loading || !selectedJobId}
            style={{ borderRadius: 10 }}
          >
            {loading ? (
              <div style={{ padding: "40px 0" }}>
                <Spin size="large" />
                <div style={{ marginTop: 16, color: "#667eea", fontWeight: 500 }}>
                  AI 正在处理简历...
                </div>
              </div>
            ) : (
              <>
                <p className="ant-upload-drag-icon"><InboxOutlined style={{ color: "#667eea" }} /></p>
                <p className="ant-upload-text">点击或拖拽简历文件到此区域</p>
                <p className="ant-upload-hint">支持 PDF、Word 格式</p>
              </>
            )}
          </Dragger>

          {/* Single upload stage progress */}
          <UploadStageProgress stage={uploadStage} percent={smoothPercent} />

          {error && (
            <Alert
              type="error"
              message="解析失败"
              description={error}
              showIcon
              style={{ marginTop: 16, borderRadius: 8 }}
            />
          )}

          {result?.parsed_data && !loading && (
            <Card
              style={{
                marginTop: 16, borderRadius: 10, border: "none",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div
                  style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: "linear-gradient(135deg, #73d13d 0%, #52c41a 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <CheckCircleOutlined style={{ color: "#fff", fontSize: 24 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Text strong style={{ fontSize: 16 }}>{result.parsed_data.name}</Text>
                    {result.parsed_data.ai_score != null && (
                      <Tag
                        color={result.parsed_data.ai_score >= 70 ? "#52c41a" : result.parsed_data.ai_score >= 50 ? "#faad14" : "#ff4d4f"}
                        style={{ borderRadius: 4, margin: 0 }}
                      >
                        AI 评分 {result.parsed_data.ai_score}
                      </Tag>
                    )}
                    {result.parsed_data.ai_recommendation && (
                      <Tag color={RECOMMENDATION_COLORS[result.parsed_data.ai_recommendation] || "default"}>
                        {result.parsed_data.ai_recommendation}
                      </Tag>
                    )}
                  </div>
                  <Text type="secondary" style={{ fontSize: 13, marginTop: 4, display: "block" }}>
                    简历解析完成，AI 评分已生成
                  </Text>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
