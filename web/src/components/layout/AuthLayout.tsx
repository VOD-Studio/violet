// 认证页布局组件
// 全屏居中卡片，背景使用粒子动画，用于登录、注册、验证邮箱等认证页面

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { ParticleBackground } from "@/components/reactbits/backgrounds/ParticleBackground";

/** AuthLayout 组件的属性 */
interface AuthLayoutProps {
  /** 页面内容 */
  children: ReactNode;
  /** 页面标题 */
  title?: string;
  /** 页面副标题 */
  subtitle?: string;
}

/**
 * 认证页布局组件
 * 提供全屏居中卡片布局，带粒子背景动画和玻璃态卡片效果
 */
export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-[calc(100svh-3.5rem)] items-center justify-center overflow-hidden px-4">
      {/* 粒子背景 */}
      <ParticleBackground
        className="absolute inset-0 z-0"
        particleCount={60}
        connectionDistance={100}
      />

      {/* 居中卡片 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="rounded-2xl border border-border/50 bg-card/80 p-8 shadow-lg backdrop-blur-sm">
          {/* 页面标题 */}
          {(title || subtitle) && (
            <div className="mb-8 text-center">
              {title && <h1 className="text-2xl font-bold">{title}</h1>}
              {subtitle && (
                <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
          )}

          {children}
        </div>
      </motion.div>
    </div>
  );
}
