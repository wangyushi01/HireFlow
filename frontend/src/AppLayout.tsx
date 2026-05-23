import { useState, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Layout, Menu, Button, Space, Typography, Spin } from "antd";
import {
  DashboardOutlined,
  UploadOutlined,
  TeamOutlined,
  ApartmentOutlined,
  NodeIndexOutlined,
  LogoutOutlined,
  UserOutlined,
  LockOutlined,
} from "@ant-design/icons";

import { useAuth } from "./contexts/AuthContext";
import ChangePasswordModal from "./pages/ChangePasswordModal";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const ResumeUpload = lazy(() => import("./pages/ResumeUpload"));
const CandidateList = lazy(() => import("./pages/CandidateList"));
const CandidateDetail = lazy(() => import("./pages/CandidateDetail"));
const JobManage = lazy(() => import("./pages/JobManage"));
const WorkflowRules = lazy(() => import("./pages/WorkflowRules"));

const { Header, Content, Sider } = Layout;
const { Text } = Typography;

const menuItems = [
  { key: "/dashboard", icon: <DashboardOutlined />, label: "数据看板" },
  { key: "/resumes/upload", icon: <UploadOutlined />, label: "简历上传" },
  { key: "/candidates", icon: <TeamOutlined />, label: "候选人管理" },
  { key: "/jobs", icon: <ApartmentOutlined />, label: "岗位管理" },
  { key: "/workflow", icon: <NodeIndexOutlined />, label: "工作流" },
];

function PageLoader() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
      <Spin size="large" />
    </div>
  );
}

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [changePwdOpen, setChangePwdOpen] = useState(false);

  const selectedKey = location.pathname.startsWith("/candidates")
    ? "/candidates"
    : location.pathname;

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider width={200} theme="light">
        <div
          style={{
            height: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 16,
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          AI 招聘管理
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: "#fff",
            padding: "0 24px",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text type="secondary">AI 驱动招聘数据智能化管理平台</Text>
          <Space>
            <Space size="small">
              <UserOutlined />
              <Text>{user?.display_name || user?.username}</Text>
            </Space>
            <Button
              type="text"
              icon={<LockOutlined />}
              onClick={() => setChangePwdOpen(true)}
            >
              修改密码
            </Button>
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              danger
            >
              退出
            </Button>
          </Space>
        </Header>
        <Content
          style={{
            margin: 24,
            padding: 24,
            background: "#fff",
            borderRadius: 8,
          }}
        >
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/resumes/upload" element={<ResumeUpload />} />
              <Route path="/candidates" element={<CandidateList />} />
              <Route path="/candidates/:id" element={<CandidateDetail />} />
              <Route path="/jobs" element={<JobManage />} />
              <Route path="/workflow" element={<WorkflowRules />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </Content>
      </Layout>
      <ChangePasswordModal
        open={changePwdOpen}
        onClose={() => setChangePwdOpen(false)}
      />
    </Layout>
  );
}
