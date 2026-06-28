import { OTPInput, OTPInputContext, REGEXP_ONLY_DIGITS, type SlotProps } from "input-otp";
import * as React from "react";
import { cn } from "@/shared/lib/utils";

/**
 * InputOTP - 验证码输入组件（基于 input-otp 库，shadcn 风格封装）
 *
 * 6 位数字分离输入框，支持粘贴、自动跳格、假光标。
 * 适配明暗主题（沿用项目 CSS 变量）。
 *
 * @example
 * <InputOTP maxLength={6} value={code} onChange={setCode} onComplete={handleSubmit} />
 */
function InputOTP({
    className,
    containerClassName,
    ...props
}: React.ComponentProps<typeof OTPInput>) {
    return (
        <OTPInput
            data-slot="input-otp"
            pattern={REGEXP_ONLY_DIGITS}
            containerClassName={cn(
                "flex items-center gap-2 has-disabled:opacity-50",
                containerClassName,
            )}
            className={cn("disabled:cursor-not-allowed", className)}
            {...props}
        />
    );
}

/**
 * InputOTPGroup - 一组 OTP slot 容器
 */
function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="input-otp-group"
            className={cn("flex items-center", className)}
            {...props}
        />
    );
}

/**
 * InputOTPSlot - 单个验证码输入格
 *
 * 通过 OTPInputContext 读取该 index 的 slot 状态（是否激活、字符、假光标）。
 */
function InputOTPSlot({
    index,
    className,
    ...props
}: React.ComponentProps<"div"> & {
    /** 该格在整组中的位置（从 0 开始） */
    index: number;
}) {
    const inputOTPContext = React.useContext(OTPInputContext);
    const slot = inputOTPContext.slots[index] as SlotProps | undefined;
    const char = slot?.char;
    const hasFakeCaret = slot?.hasFakeCaret;
    const isActive = slot?.isActive;

    if (!inputOTPContext.slots) return null;

    return (
        <div
            data-slot="input-otp-slot"
            data-active={isActive ? "" : undefined}
            className={cn(
                "relative flex size-10 items-center justify-center border-y border-r border-input text-sm shadow-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md",
                isActive && "z-10 ring-2 ring-ring ring-offset-background",
                className,
            )}
            {...props}
        >
            {char}
            {hasFakeCaret && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
                </div>
            )}
        </div>
    );
}

export { InputOTP, InputOTPGroup, InputOTPSlot };
