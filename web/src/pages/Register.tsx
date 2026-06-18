// 注册页
// 展示注册表单，用户填写信息完成账号注册

import { AuthLayout } from "@/components/layout/AuthLayout";
import { RegisterForm } from "@/features/auth";

/**
 * 注册页
 * 包含注册表单和页面布局
 */
export function Register() {
  return (
    <AuthLayout title="创建账号" subtitle="注册一个新账号开始使用">
      <RegisterForm />
    </AuthLayout>
  );
}
