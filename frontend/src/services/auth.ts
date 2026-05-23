import axios from "axios";

const api = axios.create({ baseURL: "", timeout: 30000 });

// Attach token for authenticated requests (fetchMe)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  display_name: string;
}

export interface UserInfo {
  id: number;
  username: string;
  display_name: string;
}

export async function login(data: LoginRequest): Promise<TokenResponse> {
  const res = await api.post("/api/auth/login", data);
  return res.data;
}

export async function refreshToken(
  refreshToken: string
): Promise<TokenResponse> {
  const res = await api.post("/api/auth/refresh", { refresh_token: refreshToken });
  return res.data;
}

export async function fetchMe(): Promise<UserInfo> {
  const res = await api.get("/api/auth/me");
  return res.data;
}
