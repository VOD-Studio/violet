// 注册页
// 展示注册表单，用户填写信息完成账号注册

import { motion } from "motion/react";
import { RegisterForm } from "@/components/auth/RegisterForm";

/**
 * 注册页
 * 包含注册表单和页面布局
 */
export default function Register() {
  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* 页面标题 */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">创建账号</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            注册一个新账号开始使用
          </p>
        </div>

        {/* 注册表单 */}
        <RegisterForm />
      </motion.div>
    </div>
  );
}
