import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./Login.css";

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <path d="M1 1l22 22" />
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
  </svg>
);

const ThunderboltIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const ErrorIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
  </svg>
);

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setErrorMsg(null);
    setLoading(true);
    try {
      await login({ username: username.trim(), password });
      navigate("/dashboard", { replace: true });
    } catch (e: unknown) {
      const err = e as Record<string, unknown>;
      const resp = err.response as Record<string, unknown> | undefined;
      const data = resp?.data;
      if (data && typeof data === "object" && (data as Record<string, unknown>).detail) {
        setErrorMsg(String((data as Record<string, unknown>).detail));
      } else if (resp?.status === 401) {
        setErrorMsg("用户名或密码错误");
      } else if (resp?.status === 403) {
        setErrorMsg("账号已被禁用，请联系管理员");
      } else if (resp?.status && Number(resp.status) >= 500) {
        setErrorMsg("服务器内部错误，请稍后重试");
      } else {
        setErrorMsg("网络连接失败，请检查网络");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    if (errorMsg) setErrorMsg(null);
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <ThunderboltIcon />
          </div>
          <h1 className="login-title">AI 招聘管理平台</h1>
          <p className="login-subtitle">智能化招聘数据分析与决策系统</p>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off">
          <div className="login-field">
            <UserIcon />
            <input
              type="text"
              placeholder="用户名"
              autoComplete="username"
              value={username}
              onChange={handleChange(setUsername)}
            />
          </div>

          <div className="login-field">
            <LockIcon />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="密码"
              autoComplete="current-password"
              value={password}
              onChange={handleChange(setPassword)}
            />
            <button
              type="button"
              className="login-eye-btn"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>

          {errorMsg && (
            <div className="login-error">
              <ErrorIcon />
              <span>{errorMsg}</span>
            </div>
          )}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "登录中..." : "登录"}
          </button>
        </form>

        <div className="login-hint">演示账号：admin / admin</div>
      </div>

      <div className="login-footer">Powered by AI · DeepSeek</div>
    </div>
  );
}
