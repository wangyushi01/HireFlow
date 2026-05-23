import { lazy, Suspense } from "react";
import { Spin, Typography } from "antd";

const ReactMarkdown = lazy(() => import("react-markdown"));

const { Title } = Typography;

interface Props {
  summary: string;
  title: string | null;
}

export default function AiSummary({ summary, title }: Props) {
  return (
    <Suspense
      fallback={
        <div style={{ textAlign: "center", padding: 40 }}>
          <Spin />
        </div>
      }
    >
      <div style={{ padding: "8px 0" }}>
        {title && (
          <Title level={5} style={{ marginBottom: 12 }}>
            {title}
          </Title>
        )}
        <div className="ai-report-content">
          <ReactMarkdown>{summary}</ReactMarkdown>
        </div>
      </div>
    </Suspense>
  );
}
