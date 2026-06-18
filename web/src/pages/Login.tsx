// 登录页
// 展示登录表单，用户输入邮箱和密码进行登录

import { AuthLayout } from "@/components/layout/AuthLayout";
import { LoginForm } from "@/features/auth";

/**
 * 登录页
 * 包含登录表单和页面布局
 */
export function Login() {
  return (
    <AuthLayout title="欢迎回来" subtitle="登录你的账号以继续">
      <LoginForm />
    </AuthLayout>
  );
}
