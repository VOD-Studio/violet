// 邮箱验证页
// 用户输入 6 位验证码完成邮箱验证

import { AuthLayout } from "@/components/layout/AuthLayout";
import { VerifyEmailForm } from "@/features/auth";

/**
 * 邮箱验证页
 * 包含验证码表单和页面布局
 */
export function VerifyEmail() {
  return (
    <AuthLayout title="验证邮箱" subtitle="请输入发送到你邮箱的验证码">
      <VerifyEmailForm />
    </AuthLayout>
  );
}
