import { useEffect, useState } from "react";
import { Button, type ButtonProps } from "@/shared/ui/button";

/**
 * ResendButton - 验证码倒计时重发按钮
 *
 * 点击后触发 onResend 并进入 60 秒冷却（防止滥发邮件/刷接口）。
 * 冷却中 disabled 显示剩余秒数，结束后恢复可点击。
 *
 * 受控倒计时：若父组件需要在表单字段变化时重置倒计时（如换邮箱），
 * 传 resetKey，其值变化时立即结束冷却。
 *
 * @example
 * <ResendButton onResend={() => register.mutate(email)} resetKey={email} />
 */
interface ResendButtonProps {
    /** 点击重发的回调（冷却结束后才触发） */
    onResend: () => void;
    /** 冷却秒数，默认 60 */
    cooldownSeconds?: number;
    /** 重置倒计时的触发值（变化时立即结束冷却） */
    resetKey?: string;
    /** Button 变体，默认 link */
    variant?: ButtonProps["variant"];
    /** 是否禁用（如重发请求进行中） */
    disabled?: boolean;
    /** 按钮文案，默认「重新发送」 */
    label?: string;
}

export function ResendButton({
    onResend,
    cooldownSeconds = 60,
    resetKey,
    variant = "link",
    disabled = false,
    label = "重新发送",
}: ResendButtonProps) {
    const [remaining, setRemaining] = useState(0);

    // resetKey 变化（如切换邮箱）时立即结束冷却。
    // 依赖 resetKey 是有意为之：监听其变化触发重置，函数体内无需读取它。
    // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey 是触发器，非函数体内使用的值
    useEffect(() => {
        setRemaining(0);
    }, [resetKey]);

    // 倒计时
    useEffect(() => {
        if (remaining <= 0) return;
        const timer = setInterval(() => {
            setRemaining((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [remaining]);

    const handleClick = () => {
        if (remaining > 0 || disabled) return;
        onResend();
        setRemaining(cooldownSeconds);
    };

    const isCoolingDown = remaining > 0;

    return (
        <Button
            type="button"
            variant={variant}
            size="sm"
            className="h-auto p-0 text-xs"
            disabled={isCoolingDown || disabled}
            onClick={handleClick}
        >
            {isCoolingDown ? `${remaining}s 后可重发` : label}
        </Button>
    );
}
