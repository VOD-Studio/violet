"use client";

import { cn } from "cn";
import { type ComponentPropsWithRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button, type ButtonProps } from "../button";

/** 成功发送后才开始冷却；resetKey 切换会丢弃旧请求的所有结果。 */
export interface ResendButtonProps
	extends Omit<ComponentPropsWithRef<"button">, "children" | "type" | "onError"> {
	// biome-ignore lint/suspicious/noConfusingVoidType: async 回调不返回值也表示发送成功
	onResend: () => boolean | undefined | Promise<boolean | undefined | void> | void;
	cooldownSeconds?: number;
	resetKey?: string;
	variant?: ButtonProps["variant"];
	label?: string;
	pendingLabel?: string;
	/** 接收发送异常；未提供时原错误会继续抛出，不能当作发送失败静默丢弃。 */
	onError?: (error: unknown) => void;
}

interface ResendSession {
	key?: string;
	deadline: number;
	pending: boolean;
}

/** 防止并发发送的验证码重发按钮，计时依据截止时间而不是 tick 次数。 */
export function ResendButton({
	onResend,
	cooldownSeconds = 60,
	resetKey,
	variant = "link",
	disabled = false,
	label = "重新发送",
	pendingLabel = "发送中…",
	onError,
	onClick,
	className,
	...props
}: ResendButtonProps) {
	const [session, setSession] = useState<ResendSession>({
		key: resetKey,
		deadline: 0,
		pending: false,
	});
	const [clock, setClock] = useState(0);
	const gate = useRef({ active: true, pending: false, deadline: 0 });
	useLayoutEffect(() => {
		const current = { active: true, pending: false, deadline: 0 };
		gate.current = current;
		setSession({ key: resetKey, deadline: 0, pending: false });
		return () => {
			current.active = false;
		};
	}, [resetKey]);

	const current = session.key === resetKey ? session : { deadline: 0, pending: false };
	const remaining = Math.max(0, Math.ceil((current.deadline - clock) / 1000));
	useEffect(() => {
		if (!current.deadline) return;
		const tick = () => {
			const now = Date.now();
			setClock(now);
			if (now >= current.deadline) clearInterval(timer);
		};
		const timer = setInterval(tick, 250);
		return () => clearInterval(timer);
	}, [current.deadline]);

	return (
		<Button
			{...props}
			type="button"
			variant={variant}
			size="sm"
			className={cn("v-resend-button", className)}
			data-cooling={remaining > 0 || undefined}
			aria-busy={current.pending || undefined}
			disabled={disabled || current.pending || remaining > 0}
			onClick={async (event) => {
				onClick?.(event);
				if (event.defaultPrevented || disabled) return;
				const request = gate.current;
				if (!request.active || request.pending || request.deadline > Date.now()) return;
				request.pending = true;
				setSession({ key: resetKey, deadline: 0, pending: true });
				try {
					const accepted = await onResend();
					if (!request.active || request !== gate.current) return;
					if (accepted !== false) {
						const now = Date.now();
						const seconds = Number.isFinite(cooldownSeconds)
							? Math.max(0, cooldownSeconds)
							: 0;
						request.deadline = now + seconds * 1000;
						setClock(now);
					}
				} catch (error) {
					if (!request.active || request !== gate.current) return;
					if (onError) onError(error);
					else throw error;
				} finally {
					if (request.active && request === gate.current) {
						request.pending = false;
						setSession({ key: resetKey, deadline: request.deadline, pending: false });
					}
				}
			}}
		>
			{remaining > 0 ? (
				<>
					<span className="v-resend-button__seconds">{remaining}</span>
					<span> 秒后可重新发送</span>
				</>
			) : current.pending ? (
				pendingLabel
			) : (
				label
			)}
		</Button>
	);
}
