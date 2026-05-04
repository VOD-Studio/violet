// 登录表单组件
// 包含邮箱和密码输入，使用 react-hook-form + zod 进行表单验证

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { loginSchema, type LoginFormData } from "@/lib/validations";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router";
import { useState } from "react";

/**
 * 登录表单组件
 * 提供邮箱密码登录功能，包含表单验证和错误提示
 */
export function LoginForm() {
  /** 认证 hook，提供登录功能 */
  const { login, isLoading } = useAuth();
  /** 路由导航 */
  const navigate = useNavigate();
  /** 服务端错误信息 */
  const [serverError, setServerError] = useState<string | null>(null);

  /** 表单控制，使用 zod 验证 */
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  /**
   * 表单提交处理
   * 调用登录接口，成功后跳转首页
   */
  const onSubmit = async (data: LoginFormData) => {
    try {
      setServerError(null);
      await login(data);
      navigate("/");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "登录失败，请重试");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* 服务端错误提示 */}
      {serverError && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {serverError}
        </div>
      )}

      {/* 邮箱输入框 */}
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          邮箱地址
        </label>
        <input
          id="email"
          type="email"
          placeholder="请输入邮箱"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      {/* 密码输入框 */}
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          密码
        </label>
        <input
          id="password"
          type="password"
          placeholder="请输入密码"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      {/* 提交按钮 */}
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "登录中..." : "登录"}
      </Button>

      {/* 注册链接 */}
      <p className="text-center text-sm text-muted-foreground">
        还没有账号？{" "}
        <Link
          to="/register"
          className="font-medium text-primary hover:underline"
        >
          立即注册
        </Link>
      </p>
    </form>
  );
}
