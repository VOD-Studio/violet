// 邮箱验证表单组件
// 包含 6 位验证码输入和重新发送验证码功能

import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { MagneticButton } from "@/components/reactbits/components/MagneticButton";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { type VerifyEmailFormData, verifyEmailSchema } from "@/lib/validations";

/** 重新发送冷却时间，单位为秒 */
const RESEND_COOLDOWN = 60;

/** 验证码长度 */
const CODE_LENGTH = 6;

/**
 * 邮箱验证表单组件
 * 用户输入 6 位数字验证码完成邮箱验证，支持自动聚焦、粘贴、回删
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
  /** 6 位验证码值数组 */
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  /** 6 个输入框的 ref */
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  /** 表单控制，使用 zod 验证 */
  const {
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<VerifyEmailFormData>({
    resolver: zodResolver(verifyEmailSchema),
  });

  /** 更新验证码值并同步到 react-hook-form */
  const updateCode = useCallback(
    (newDigits: string[]) => {
      setDigits(newDigits);
      const code = newDigits.join("");
      setValue("code", code, { shouldValidate: code.length === CODE_LENGTH });
    },
    [setValue],
  );

  /** 处理单个输入框变化 */
  const handleChange = useCallback(
    (index: number, value: string) => {
      const sanitized = value.replace(/\D/g, "").slice(0, 1);
      if (!sanitized) return;

      const newDigits = [...digits];
      newDigits[index] = sanitized;
      updateCode(newDigits);

      // 自动聚焦下一个输入框
      if (index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits, updateCode],
  );

  /** 处理键盘事件，支持回删跳转 */
  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        if (digits[index] === "" && index > 0) {
          // 当前为空且回删，聚焦上一个并清空
          const newDigits = [...digits];
          newDigits[index - 1] = "";
          updateCode(newDigits);
          inputRefs.current[index - 1]?.focus();
        } else if (digits[index] !== "") {
          // 当前有值，清空当前
          const newDigits = [...digits];
          newDigits[index] = "";
          updateCode(newDigits);
        }
      } else if (e.key === "ArrowLeft" && index > 0) {
        inputRefs.current[index - 1]?.focus();
      } else if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits, updateCode],
  );

  /** 处理粘贴事件 */
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, CODE_LENGTH);
      if (!pasted) return;

      const newDigits = [...digits];
      for (let i = 0; i < pasted.length; i++) {
        if (i < CODE_LENGTH) {
          newDigits[i] = pasted[i];
        }
      }
      updateCode(newDigits);

      // 聚焦到粘贴内容后的下一个空位或最后一位
      const focusIndex = Math.min(pasted.length, CODE_LENGTH - 1);
      inputRefs.current[focusIndex]?.focus();
    },
    [digits, updateCode],
  );

  /**
   * 表单提交处理
   * 将验证码发送到后端进行验证
   */
  const onSubmit = async () => {
    const code = digits.join("");
    if (code.length !== CODE_LENGTH) return;

    try {
      setServerError(null);
      setIsVerifying(true);
      await api.post("/auth/verify-email", { code });
      navigate({ to: "/login" });
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
        err instanceof Error ? err.message : "发送验证码失败，请重试",
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

      {/* 6 位验证码输入框 */}
      <div className="space-y-2">
        <label htmlFor="code-0" className="text-sm font-medium">
          验证码
        </label>
        <div className="flex justify-center gap-2">
          {Array.from({ length: CODE_LENGTH }, (_, i) => (
            <input
              // biome-ignore lint/suspicious/noArrayIndexKey: 6 个固定验证码输入框，顺序永不改变
              key={`code-${i}`}
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              id={i === 0 ? "code-0" : undefined}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digits[i]}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              className="flex h-12 w-12 rounded-md border border-input bg-transparent text-center text-lg font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              disabled={isVerifying}
            />
          ))}
        </div>
        {errors.code && (
          <p className="text-center text-sm text-destructive">
            {errors.code.message}
          </p>
        )}
      </div>

      {/* 验证按钮 */}
      <MagneticButton className="w-full">
        <Button
          type="submit"
          className="w-full"
          disabled={isVerifying || digits.join("").length !== CODE_LENGTH}
        >
          {isVerifying ? "验证中..." : "验证"}
        </Button>
      </MagneticButton>

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
