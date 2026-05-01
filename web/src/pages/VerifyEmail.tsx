// 邮箱验证页
// 用户输入 6 位验证码完成邮箱验证

import { motion } from "motion/react";
import { VerifyEmailForm } from "@/components/auth/VerifyEmailForm";

/**
 * 邮箱验证页
 * 包含验证码表单和页面布局
 */
export default function VerifyEmail() {
  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* 页面标题 */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">验证邮箱</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            请输入发送到你邮箱的验证码
          </p>
        </div>

        {/* 验证码表单 */}
        <VerifyEmailForm />
      </motion.div>
    </div>
  );
}
