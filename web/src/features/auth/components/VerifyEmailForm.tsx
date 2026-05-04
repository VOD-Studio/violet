// 邮箱验证表单组件
// 包含 6 位验证码输入和重新发送验证码功能

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { verifyEmailSchema, type VerifyEmailFormData } from "@/lib/validations";
import { api } from "@/lib/api";

/** 重新发送冷却时间，单位为秒 */
const RESEND_COOLDOWN = 60;

/**
 * 邮箱验证表单组件
 * 用户输入 6 位数字验证码完成邮箱验证
 */
export function VerifyEmailForm() {
  /** 路由导航 */
  const navigate = useNavigate();
  /** 服务端错误信息 */
  const [serverError, setServerError] = useState<string | null>(null);
  /** 是否正在验证 */
  const [isVerifying, setIsVerifying] = useState(false);
  /** 重新发送冷却倒计时 */
  const [cooldown, setCooldown] = useState(0);

  /** 表单控制，使用 zod 验证 */
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyEmailFormData>({
    resolver: zodResolver(verifyEmailSchema),
  });

  /**
   * 表单提交处理
   * 将验证码发送到后端进行验证
   */
  const onSubmit = async (data: VerifyEmailFormData) => {
    try {
      setServerError(null);
      setIsVerifying(true);
      await api.post("/auth/verify-email", { code: data.code });
      navigate("/login");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "验证失败，请重试");
    } finally {
      setIsVerifying(false);
    }
  };

  /**
   * 重新发送验证码
   * 发送后启动冷却倒计时，防止频繁请求
   */
  const handleResend = async () => {
    if (cooldown > 0) return;
    try {
      await api.post("/auth/resend-verification");
      setCooldown(RESEND_COOLDOWN);

      /* 每秒递减冷却计时器 */
      const timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "发送验证码失败，请重试"
      );
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

      {/* 验证码提示文字 */}
      <p className="text-sm text-muted-foreground">
        我们已向您的邮箱发送了验证码，请输入 6 位验证码完成验证。
      </p>

      {/* 验证码输入框 */}
      <div className="space-y-2">
        <label htmlFor="code" className="text-sm font-medium">
          验证码
        </label>
        <input
          id="code"
          type="text"
          placeholder="请输入 6 位验证码"
          maxLength={6}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-center text-lg tracking-[0.5em] shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          {...register("code")}
        />
        {errors.code && (
          <p className="text-sm text-destructive">{errors.code.message}</p>
        )}
      </div>

      {/* 验证按钮 */}
      <Button type="submit" className="w-full" disabled={isVerifying}>
        {isVerifying ? "验证中..." : "验证"}
      </Button>

      {/* 重新发送验证码 */}
      <div className="text-center">
        <Button
          type="button"
          variant="ghost"
          onClick={handleResend}
          disabled={cooldown > 0}
        >
          {cooldown > 0 ? `${cooldown} 秒后可重新发送` : "重新发送验证码"}
        </Button>
      </div>
    </form>
  );
}
