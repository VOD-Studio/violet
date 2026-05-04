// 注册表单组件
// 包含用户名、邮箱、密码、确认密码输入，使用 react-hook-form + zod 验证

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { registerSchema, type RegisterFormData } from "@/lib/validations";
import { useAuth } from "@/hooks/useAuth";

/**
 * 注册表单组件
 * 提供用户注册功能，包含完整的表单验证和错误提示
 */
export function RegisterForm() {
  /** 认证 hook，提供注册功能 */
  const { register: registerUser, isLoading } = useAuth();
  /** 路由导航 */
  const navigate = useNavigate();
  /** 服务端错误信息 */
  const [serverError, setServerError] = useState<string | null>(null);

  /** 表单控制，使用 zod 验证 */
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  /**
   * 表单提交处理
   * 调用注册接口，成功后跳转到邮箱验证页
   */
  const onSubmit = async (data: RegisterFormData) => {
    try {
      setServerError(null);
      await registerUser(data);
      navigate("/verify-email");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "注册失败，请重试");
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

      {/* 用户名输入框 */}
      <div className="space-y-2">
        <label htmlFor="username" className="text-sm font-medium">
          用户名
        </label>
        <input
          id="username"
          type="text"
          placeholder="请输入用户名"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          {...register("username")}
        />
        {errors.username && (
          <p className="text-sm text-destructive">{errors.username.message}</p>
        )}
      </div>

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

      {/* 确认密码输入框 */}
      <div className="space-y-2">
        <label htmlFor="confirmPassword" className="text-sm font-medium">
          确认密码
        </label>
        <input
          id="confirmPassword"
          type="password"
          placeholder="请再次输入密码"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="text-sm text-destructive">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      {/* 提交按钮 */}
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "注册中..." : "注册"}
      </Button>

      {/* 登录链接 */}
      <p className="text-center text-sm text-muted-foreground">
        已有账号？{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          立即登录
        </Link>
      </p>
    </form>
  );
}
