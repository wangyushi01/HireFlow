import {
  FunnelChart as RFunnelChart,
  Funnel,
  LabelList,
  PieChart as RPieChart,
  Pie,
  Cell,
  BarChart as RBarChart,
  Bar,
  LineChart as RLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#1890ff", "#36cfc9", "#faad14", "#52c41a", "#722ed1", "#eb2f96", "#13c2c2", "#f5222d"];

interface Props {
  type: "funnel" | "pie" | "bar" | "line";
  data: Array<Record<string, unknown>>;
}

const FUNNEL_COLORS = ["#1890ff", "#36cfc9", "#faad14", "#52c41a", "#722ed1"];

export default function RechartsCharts({ type, data }: Props) {
  switch (type) {
    case "funnel": {
      const sorted = [...data].sort((a, b) => (b.value as number) - (a.value as number));
      return (
        <ResponsiveContainer width="100%" height={300}>
          <RFunnelChart>
            <Tooltip />
            <Funnel data={sorted} dataKey="value" nameKey="name" isAnimationActive>
              {sorted.map((_, i) => (
                <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
              ))}
              <LabelList
                position="right"
                fill="#333"
                stroke="none"
                dataKey="name"
                formatter={(val: string) => `${val}`}
              />
            </Funnel>
          </RFunnelChart>
        </ResponsiveContainer>
      );
    }

    case "pie":
      return (
        <ResponsiveContainer width="100%" height={300}>
          <RPieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={110}
              innerRadius={60}
              label={({ name, value }: Record<string, unknown>) => `${name}: ${value}`}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </RPieChart>
        </ResponsiveContainer>
      );

    case "bar":
      return (
        <ResponsiveContainer width="100%" height={300}>
          <RBarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#1890ff" radius={[4, 4, 0, 0]} />
          </RBarChart>
        </ResponsiveContainer>
      );

    case "line": {
      const keys = data.length > 0 ? Object.keys(data[0]).filter((k) => k !== "name") : [];
      const lineColors = ["#1890ff", "#52c41a"];
      return (
        <ResponsiveContainer width="100%" height={300}>
          <RLineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            {keys.map((k, i) => (
              <Line
                key={k}
                type="monotone"
                dataKey={k}
                stroke={lineColors[i % lineColors.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            ))}
          </RLineChart>
        </ResponsiveContainer>
      );
    }
  }
}
