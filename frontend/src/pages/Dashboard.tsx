import { useEffect, useState, useCallback, useRef, lazy, Suspense } from "react";
import {
  Card, Col, Row, Statistic, Typography, Empty, Alert, Switch,
  Space, Button, Spin, Progress,
} from "antd";
import {
  FileTextOutlined,
  TeamOutlined,
  RiseOutlined,
  ClockCircleOutlined,
  SwapOutlined,
  ReloadOutlined,
  BulbOutlined,
  DownloadOutlined,
  AuditOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { FunnelChart, PieChart, BarChart, LineChart } from "../components/Charts";
import {
  fetchExtendedDashboardStats,
  fetchAiInsights,
  fetchAiSummary,
} from "../services/api";
import type {
  ExtendedDashboardStats,
  AiInsight,
  WeeklyTrend,
} from "../services/types";

const AiSummary = lazy(() => import("../components/AiSummary"));

const { Title, Text } = Typography;

const SEVERITY_COLORS: Record<string, string> = {
  info: "#1890ff",
  warning: "#faad14",
  error: "#ff4d4f",
  success: "#52c41a",
};

const STAT_CARDS = [
  { key: "total", title: "候选人总数", icon: <TeamOutlined />, gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
  { key: "submitted", title: "投递阶段", icon: <FileTextOutlined />, gradient: "linear-gradient(135deg, #36cfc9 0%, #13c2c2 100%)" },
  { key: "interview", title: "面试中", icon: <AuditOutlined />, gradient: "linear-gradient(135deg, #ffd666 0%, #faad14 100%)" },
  { key: "hired", title: "已入职", icon: <TrophyOutlined />, gradient: "linear-gradient(135deg, #73d13d 0%, #52c41a 100%)" },
  { key: "week_new", title: "本周新增", icon: <RiseOutlined />, gradient: "linear-gradient(135deg, #69c0ff 0%, #1890ff 100%)" },
  { key: "cycle", title: "平均招聘周期", icon: <ClockCircleOutlined />, gradient: "linear-gradient(135deg, #b37feb 0%, #722ed1 100%)" },
] as const;

function getStatValue(key: string, stats: ExtendedDashboardStats) {
  switch (key) {
    case "total": return { value: stats.total_candidates, suffix: undefined, valueStyle: undefined };
    case "submitted": return { value: stats.funnel.find((f) => f.stage === "resume_received")?.count || 0, suffix: undefined, valueStyle: undefined };
    case "interview": return { value: stats.funnel.find((f) => f.stage === "interview")?.count || 0, suffix: undefined, valueStyle: undefined };
    case "hired": return { value: stats.funnel.find((f) => f.stage === "hired")?.count || 0, suffix: undefined, valueStyle: { color: "#52c41a" } };
    case "week_new": return { value: stats.this_week_new, suffix: undefined, valueStyle: undefined };
    case "cycle": return { value: stats.time_to_hire ?? "-", suffix: stats.time_to_hire != null ? "天" : "", valueStyle: undefined };
    default: return { value: 0, suffix: undefined, valueStyle: undefined };
  }
}

function useProgress(active: boolean) {
  const [percent, setPercent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (active) {
      setPercent(0);
      timerRef.current = setInterval(() => {
        setPercent((prev) => {
          if (prev >= 90) return prev + (100 - prev) * 0.02;
          if (prev >= 70) return prev + 0.8;
          if (prev >= 40) return prev + 1.2;
          return prev + 2.5;
        });
      }, 300);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setPercent(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [active]);

  return Math.min(Math.round(percent), active ? 95 : 0);
}

function GeneratingProgress({ label, percent }: { label: string; percent: number }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 0" }}>
      <Spin />
      <div style={{ marginTop: 16, maxWidth: 320, marginLeft: "auto", marginRight: "auto" }}>
        <Progress
          percent={percent}
          status="active"
          strokeColor={{ from: "#667eea", to: "#764ba2" }}
          showInfo
          format={(p) => `${p}%`}
          size="small"
        />
      </div>
      <Text type="secondary" style={{ fontSize: 13, marginTop: 8, display: "block" }}>
        AI 正在生成{label}...
      </Text>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<ExtendedDashboardStats | null>(null);
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [trendData, setTrendData] = useState<WeeklyTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiReportTitle, setAiReportTitle] = useState<string | null>(null);
  const [aiReportPeriod, setAiReportPeriod] = useState<string>("week");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const insightsProgress = useProgress(insightsLoading);
  const summaryProgress = useProgress(summaryLoading);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [s, insightsData] = await Promise.all([
        fetchExtendedDashboardStats(),
        fetchAiInsights().catch(() => null),
      ]);
      setStats(s);
      setTrendData(s.weekly_trend);
      if (insightsData && insightsData.length > 0) {
        setInsights(insightsData);
      }
    } catch {
      // ignore
    } finally {
      setStatsLoading(false);
      setLoading(false);
    }
  }, []);

  const loadInsights = useCallback(async (force = false) => {
    setInsights([]);
    setInsightsLoading(true);
    try {
      const data = await fetchAiInsights(force);
      setInsights(data);
    } catch {
      // ignore
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  const loadAiSummary = useCallback(async (period: string) => {
    setSummaryLoading(true);
    try {
      const data = await fetchAiSummary(period);
      setAiSummary(data.summary);
      setAiReportTitle(data.title);
      setAiReportPeriod(period);
    } catch {
      // ignore
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (!aiSummary) return;
    const title = aiReportTitle || "招聘工作报告";
    const periodLabel = aiReportPeriod === "month" ? "月报" : "周报";
    const now = new Date().toISOString().slice(0, 10);
    const content = `# ${title}

> 生成时间：${now}
> 报告周期：${periodLabel}

${aiSummary}

---
*本报告由 AI 招聘管理平台自动生成*
`;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `招聘${periodLabel}_${now}.md`;
    a.click();
    window.URL.revokeObjectURL(url);
  }, [aiSummary, aiReportTitle, aiReportPeriod]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        loadStats();
      }, 30000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, loadStats]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!stats) return <Empty description="暂无数据" />;

  const funnelData = stats.funnel.map((f) => ({
    name: f.label,
    value: f.count,
  }));

  const pieData = stats.channels.map((c) => ({
    name: c.source,
    value: c.count,
  }));

  const barData = stats.jobs.map((j) => ({
    name: j.job_title,
    value: j.count,
  }));

  const hasTrend = trendData.length > 0;
  const trendNames = [...new Set(trendData.map((t) => t.week))];
  const lineData = trendNames.map((week) => {
    const point: Record<string, unknown> = { name: week };
    for (const t of trendData) {
      if (t.week === week) {
        point["新增"] = t.new_count;
        point["入职"] = t.hired_count;
      }
    }
    return point;
  });

  return (
    <div style={{ margin: "-24px -24px 0" }}>
      {/* Header bar */}
      <div
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          padding: "24px 28px 20px",
          margin: "-24px -24px 24px",
          borderRadius: "8px 8px 0 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0, color: "#fff" }}>
            数据看板
          </Title>
          <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 13 }}>
            AI 驱动招聘数据实时监控
          </Text>
        </div>
        <Space>
          <Space size="small">
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>
              自动刷新
            </Text>
            <Switch size="small" checked={autoRefresh} onChange={setAutoRefresh} />
          </Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => { loadStats(); loadInsights(); }}
            size="small"
            loading={statsLoading}
            style={{ borderRadius: 6 }}
          >
            刷新
          </Button>
        </Space>
      </div>

      {/* Stat cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {STAT_CARDS.map((card) => {
          const { value, suffix, valueStyle } = getStatValue(card.key, stats);
          return (
            <Col span={4} key={card.key}>
              <Card
                loading={statsLoading}
                bodyStyle={{ padding: "20px 16px" }}
                style={{ borderRadius: 10, border: "none", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: card.gradient, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ color: "#fff", fontSize: 18 }}>{card.icon}</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <Text type="secondary" style={{ fontSize: 12, display: "block" }}>{card.title}</Text>
                    <Statistic value={value} suffix={suffix} valueStyle={{ fontSize: 22, fontWeight: 700, ...valueStyle }} style={{ marginTop: 2 }} />
                  </div>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* Conversion rates */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card loading={statsLoading} bodyStyle={{ padding: "20px 16px" }} style={{ borderRadius: 10, border: "none", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #ff85c0 0%, #eb2f96 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <SwapOutlined style={{ color: "#fff", fontSize: 18 }} />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>整体转化率 (投递→入职)</Text>
                <Statistic value={stats.overall_conversion != null ? `${(stats.overall_conversion * 100).toFixed(1)}%` : "-"} valueStyle={{ fontSize: 22, fontWeight: 700 }} style={{ marginTop: 2 }} />
              </div>
            </div>
          </Card>
        </Col>
        <Col span={18}>
          <Card size="small" loading={statsLoading} style={{ borderRadius: 10, border: "none", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <Text strong style={{ fontSize: 13, marginBottom: 10, display: "block" }}>阶段转化率</Text>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {stats.conversion_rates.map((cr, i) => (
                <div key={i} style={{ padding: "8px 16px", background: "linear-gradient(135deg, #f0f5ff 0%, #e6f7ff 100%)", borderRadius: 8, textAlign: "center", border: "1px solid #d6e4ff" }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>{cr.from_stage} → {cr.to}</Text>
                  <div><Text strong style={{ fontSize: 16, color: "#2f54eb" }}>{(cr.rate * 100).toFixed(1)}%</Text></div>
                </div>
              ))}
              {stats.conversion_rates.length === 0 && <Text type="secondary">暂无数据</Text>}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Charts: trend + funnel */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={14}>
          <Card title={<span style={{ fontWeight: 600 }}>招聘趋势 (近 30 天)</span>} loading={statsLoading} style={{ borderRadius: 10, border: "none", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            {hasTrend ? <LineChart data={lineData} /> : <Empty description="暂无趋势数据" />}
          </Card>
        </Col>
        <Col span={10}>
          <Card title={<span style={{ fontWeight: 600 }}>招聘漏斗</span>} loading={statsLoading} style={{ borderRadius: 10, border: "none", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            {stats.funnel.some((f) => f.count > 0) ? <FunnelChart data={funnelData} /> : <Empty description="暂无漏斗数据" />}
          </Card>
        </Col>
      </Row>

      {/* Channel + Job */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={12}>
          <Card title={<span style={{ fontWeight: 600 }}>渠道来源分布</span>} loading={statsLoading} style={{ borderRadius: 10, border: "none", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            {pieData.length > 0 ? <PieChart data={pieData} /> : <Empty description="暂无渠道数据" />}
          </Card>
        </Col>
        <Col span={12}>
          <Card title={<span style={{ fontWeight: 600 }}>岗位候选人统计</span>} loading={statsLoading} style={{ borderRadius: 10, border: "none", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            {barData.length > 0 ? <BarChart data={barData} /> : <Empty description="暂无岗位数据" />}
          </Card>
        </Col>
      </Row>

      {/* AI Insights */}
      <Card
        title={
          <Space>
            <BulbOutlined style={{ color: "#faad14" }} />
            <span style={{ fontWeight: 600 }}>AI 招聘洞察</span>
          </Space>
        }
        extra={
          <Button size="small" onClick={() => loadInsights(true)} loading={insightsLoading} style={{ borderRadius: 6 }}>
            {insights.length > 0 ? "重新生成" : "生成洞察"}
          </Button>
        }
        style={{ borderRadius: 10, border: "none", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}
      >
        {insightsLoading ? (
          <GeneratingProgress label="招聘洞察" percent={insightsProgress} />
        ) : insights.length === 0 ? (
          <Empty description="点击「生成洞察」获取 AI 分析" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {insights.map((item, i) => (
              <Alert
                key={i}
                type={item.severity === "error" ? "error" : item.severity === "warning" ? "warning" : item.severity === "success" ? "success" : "info"}
                message={<Text strong style={{ color: SEVERITY_COLORS[item.severity] || "#1890ff" }}>{item.title}</Text>}
                description={item.content}
                showIcon
                style={{ borderRadius: 8 }}
              />
            ))}
          </div>
        )}
      </Card>

      {/* AI Summary Report */}
      <Card
        title={
          <Space>
            <FileTextOutlined />
            <span style={{ fontWeight: 600 }}>AI 招聘总结报告</span>
          </Space>
        }
        extra={
          <Space>
            <Button size="small" onClick={() => loadAiSummary("week")} loading={summaryLoading} disabled={summaryLoading} style={{ borderRadius: 6 }}>
              生成周报
            </Button>
            <Button size="small" onClick={() => loadAiSummary("month")} loading={summaryLoading} disabled={summaryLoading} style={{ borderRadius: 6 }}>
              生成月报
            </Button>
            {aiSummary && (
              <Button size="small" icon={<DownloadOutlined />} onClick={handleDownload} style={{ borderRadius: 6 }}>
                下载报告
              </Button>
            )}
          </Space>
        }
        style={{ borderRadius: 10, border: "none", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
      >
        {summaryLoading ? (
          <GeneratingProgress label="总结报告" percent={summaryProgress} />
        ) : aiSummary ? (
          <Suspense fallback={<div style={{ textAlign: "center", padding: 40 }}><Spin /></div>}>
            <AiSummary summary={aiSummary} title={aiReportTitle} />
          </Suspense>
        ) : (
          <Empty description="点击「生成周报」或「生成月报」获取 AI 总结" />
        )}
      </Card>
    </div>
  );
}
