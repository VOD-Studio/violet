import { Field, Input, InputOTP, Label, ResendButton } from "@violet/ui";
import { Mailbox, UserRoundCheck } from "lucide-react";
import { motion } from "motion/react";
import type { ApplicationVerification } from "./use-application-verification";

interface ApplyIdentityStepProps {
	track: "anon" | "member";
	onTrackChange: (track: "anon" | "member") => void;
	isLoggedIn: boolean;
	currentUsername?: string;
	email: string;
	verification: ApplicationVerification;
}

/** 申请身份选择与匿名邮箱验证码输入。 */
export function ApplyIdentityStep({
	track,
	onTrackChange,
	isLoggedIn,
	currentUsername,
	email,
	verification,
}: ApplyIdentityStepProps) {
	return (
		<motion.div
			initial={{ opacity: 0, x: 24 }}
			animate={{ opacity: 1, x: 0 }}
			exit={{ opacity: 0, x: -24 }}
			transition={{ duration: 0.25 }}
			className="flex flex-col gap-5"
		>
			{!isLoggedIn ? (
				<div className="grid grid-cols-2 gap-3">
					<button
						type="button"
						onClick={() => onTrackChange("anon")}
						className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors ${
							track === "anon"
								? "border-foreground/40 bg-muted/40"
								: "border-edge-hairline hover:bg-muted/30"
						}`}
					>
						<Mailbox className="size-4 text-muted-foreground" />
						<span className="text-sm font-medium">匿名申请</span>
						<span className="text-xs text-muted-foreground">邮箱验证码两步流</span>
					</button>
					<button
						type="button"
						onClick={() => onTrackChange("member")}
						className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors ${
							track === "member"
								? "border-foreground/40 bg-muted/40"
								: "border-edge-hairline hover:bg-muted/30"
						}`}
					>
						<UserRoundCheck className="size-4 text-muted-foreground" />
						<span className="text-sm font-medium">登录用户</span>
						<span className="text-xs text-muted-foreground">跳过验证，直达名片</span>
					</button>
				</div>
			) : null}
			{track === "anon" ? (
				<>
					<div className="flex flex-col gap-2">
						<Label htmlFor="fl-email">联系邮箱（仅留存，不公开）</Label>
						<div className="flex gap-2">
							<Input
								id="fl-email"
								type="email"
								placeholder="you@your.blog"
								value={email}
								onChange={(event) => verification.changeEmail(event.target.value)}
								classNames={{ control: "min-w-0 flex-1" }}
							/>
							<ResendButton
								variant="outline"
								label={verification.sent ? "重新发送" : "发送验证码"}
								resetKey={email}
								onResend={verification.onResend}
							/>
						</div>
					</div>
					{verification.sent ? (
						<Field
							label="邮箱验证码"
							hint="请前往邮箱查收 6 位验证码"
							error={verification.error}
						>
							<InputOTP
								name="code"
								value={verification.code}
								onChange={verification.onChange}
								invalid={verification.invalid}
								required
							/>
						</Field>
					) : null}
				</>
			) : (
				<p className="rounded-xl border border-edge-hairline bg-muted/30 p-4 text-sm text-muted-foreground">
					已登录为{" "}
					<span className="font-mono text-foreground">@{currentUsername ?? "you"}</span>
					，联系邮箱取自账号资料，无需验证码。
				</p>
			)}
		</motion.div>
	);
}
