// 认证状态管理 Hook
// 基于 zustand store 管理认证状态，使用 react-query 的 useMutation 处理登录/注册
// 支持自动刷新即将过期的 token

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store";
import { toast } from "sonner";
import type { LoginFormData, RegisterFormData } from "@/lib/validations";

/** 登录响应结构 */
interface LoginResponse {
  /** JWT 访问令牌 */
  access_token: string;
  /** JWT 刷新令牌 */
  refresh_token: string;
  /** 令牌过期时间（秒） */
  expires_in: number;
}

/** 用户信息结构 */
interface UserInfo {
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  bio?: string;
  role?: string;
  email_verified?: boolean;
  is_active?: boolean;
}

/**
 * 认证状态管理 Hook
 */
export function useAuth() {
  const queryClient = useQueryClient();
  const { token, user, setAuth, clearAuth, setUser } = useAuthStore();

  /** 查询当前用户信息 */
  const userQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.get<UserInfo>("/auth/me"),
    enabled: !!token && !user,
    retry: false,
  });

  /* 查询成功时更新 store 中的用户信息 */
  useEffect(() => {
    if (userQuery.data && !user) {
      setUser(userQuery.data);
    }
  }, [userQuery.data, user, setUser]);

  /* 查询失败时清除认证状态 */
  useEffect(() => {
    if (userQuery.isError && token) {
      clearAuth();
      queryClient.removeQueries({ queryKey: ["auth"] });
    }
  }, [userQuery.isError, token, clearAuth, queryClient]);

  /**
   * 登录成功后保存 token 和获取用户信息
   * 先设置 token，再获取用户信息（确保 API 有 Authorization）
   */
  async function handleLoginSuccess(response: LoginResponse) {
    // 先设置 token（store 更新是同步的，API 拦截器立即能读取）
    useAuthStore.getState().setAuth(
      response.access_token,
      response.refresh_token,
      response.expires_in
    );

    // 然后获取用户信息（此时 API 拦截器已有 token）
    const userInfo = await api.get<UserInfo>("/auth/me");

    // 最后设置用户信息
    useAuthStore.getState().setUser(userInfo);
    queryClient.invalidateQueries({ queryKey: ["auth"] });

    toast.success("登录成功");
  }

  /** 登录 mutation */
  const loginMutation = useMutation({
    mutationFn: (data: LoginFormData) =>
      api.post<LoginResponse>("/auth/login", data),
    onSuccess: handleLoginSuccess,
    onError: (error) => {
      toast.error(error.message || "登录失败");
    },
  });

  /** 注册 mutation */
  const registerMutation = useMutation({
    mutationFn: (data: RegisterFormData) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { confirmPassword: _, ...registerData } = data;
      return api.post<LoginResponse>("/auth/register", registerData);
    },
    onSuccess: handleLoginSuccess,
    onError: (error) => {
      toast.error(error.message || "注册失败");
    },
  });

  /** 登出函数 */
  const logout = () => {
    clearAuth();
    queryClient.removeQueries({ queryKey: ["auth"] });
    queryClient.clear();
    toast.success("已退出登录");
  };

  return {
    /** 当前用户信息 */
    user,
    /** JWT 令牌 */
    token,
    /** 是否正在加载 */
    isLoading:
      userQuery.isLoading ||
      loginMutation.isPending ||
      registerMutation.isPending,
    /** 是否已登录 */
    isAuthenticated: !!token && !!user,
    /** 登录函数 */
    login: loginMutation.mutateAsync,
    /** 注册函数 */
    register: registerMutation.mutateAsync,
    /** 登出函数 */
    logout,
    /** 重新获取用户信息 */
    refetchUser: userQuery.refetch,
  };
}

/** 更新个人资料请求体 */
interface UpdateProfileData {
  username: string;
  bio?: string;
  avatar_url?: string;
}

/** 修改密码请求体 */
interface UpdatePasswordData {
  old_password: string;
  new_password: string;
}

/**
 * 更新个人资料 mutation hook
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { setUser } = useAuthStore();

  return useMutation({
    mutationFn: (data: UpdateProfileData) =>
      api.patch<UserInfo>("/auth/profile", data),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      toast.success("个人资料已更新");
    },
    onError: (error) => {
      toast.error(error.message || "更新失败");
    },
  });
}

/**
 * 修改密码 mutation hook
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: (data: UpdatePasswordData) =>
      api.patch<{ message: string }>("/auth/password", data),
    onSuccess: () => {
      toast.success("密码已修改");
    },
    onError: (error) => {
      toast.error(error.message || "修改密码失败");
    },
  });
}
