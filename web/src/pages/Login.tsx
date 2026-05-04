// 登录页
// 展示登录表单，用户输入邮箱和密码进行登录

import { motion } from "motion/react";
import { LoginForm } from "@/features/auth";

/**
 * 登录页
 * 包含登录表单和页面布局
 */
export default function Login() {
  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* 页面标题 */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">欢迎回来</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            登录你的账号以继续
          </p>
        </div>

        {/* 登录表单 */}
        <LoginForm />
      </motion.div>
    </div>
  );
}
