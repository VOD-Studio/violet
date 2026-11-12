import { Field, InputOTP, InputOTPGroup, InputOTPSlot, ResendButton } from "@violet/ui";
import { useEffect, useRef, useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

type Verification = "idle" | "checking" | "error" | "success";

function OTPScenario({ state }: ExhibitRenderProps) {
	const [code, setCode] = useState(
		state === "filled"
			? "482"
			: ["success", "readonly", "disabled", "invalid"].includes(state)
				? "482916"
				: "",
	);
	const [verification, setVerification] = useState<Verification>(
		state === "invalid" ? "error" : state === "success" ? "success" : "idle",
	);
	const [sendError, setSendError] = useState("");
	const otp = useRef<HTMLInputElement>(null);
	const resend = useRef<HTMLButtonElement>(null);
	const verificationTimer = useRef<number | undefined>(undefined);
	const sendTimer = useRef<number | undefined>(undefined);
	const sendResolution = useRef<((accepted: boolean) => void) | undefined>(undefined);
	useEffect(() => {
		if (state === "focus") otp.current?.focus({ preventScroll: true });
		if (state === "cooldown" || state === "pending" || state === "send-failed") {
			resend.current?.click();
		}
		return () => {
			clearTimeout(verificationTimer.current);
			clearTimeout(sendTimer.current);
			sendResolution.current?.(false);
		};
	}, [state]);

	return (
		<div className="flex flex-col gap-3 p-1">
			<Field
				label="邮箱验证码"
				hint="验证码已发送至 x•••@rua.plus"
				checking={verification === "checking" ? "正在验证…" : undefined}
				error={verification === "error" ? "验证码不对，请重新输入" : undefined}
				success={verification === "success" ? "验证通过" : undefined}
			>
				<InputOTP
					ref={otp}
					name="verification-code"
					value={code}
					invalid={verification === "error"}
					valid={verification === "success"}
					readOnly={state === "readonly" || verification === "checking"}
					disabled={state === "disabled"}
					onChange={(next) => {
						setCode(next);
						if (next && verification !== "checking") setVerification("idle");
					}}
					onComplete={(complete) => {
						setVerification("checking");
						clearTimeout(verificationTimer.current);
						verificationTimer.current = window.setTimeout(() => {
							setVerification(complete === "482916" ? "success" : "error");
						}, 600);
					}}
				>
					<InputOTPGroup>
						{Array.from({ length: 6 }, (_, index) => (
							<InputOTPSlot key={index} index={index} />
						))}
					</InputOTPGroup>
				</InputOTP>
			</Field>
			<div className="flex items-center gap-2 text-13">
				<span className="text-muted-foreground">没有收到？</span>
				<ResendButton
					ref={resend}
					disabled={state === "disabled" || state === "readonly"}
					onResend={() => {
						setSendError("");
						if (state === "cooldown") return true;
						const { promise, resolve } = Promise.withResolvers<boolean>();
						sendResolution.current = resolve;
						sendTimer.current = window.setTimeout(
							() => {
								if (state === "send-failed") {
									setSendError("暂时无法发送，请稍后重试");
									resolve(false);
									return;
								}
								clearTimeout(verificationTimer.current);
								setCode("");
								setVerification("idle");
								resolve(true);
							},
							state === "pending" ? 3000 : 600,
						);
						return promise;
					}}
				/>
			</div>
			<p className="m-0 min-h-5 text-13 text-muted-foreground" aria-live="polite">
				{sendError || "演示验证码：482916。输入其他六位数字可看出错反馈。"}
			</p>
		</div>
	);
}

function OTPFamily({ state }: ExhibitRenderProps) {
	return <OTPScenario key={state} state={state} />;
}

export const otpExhibit: Exhibit = {
	id: "otp",
	name: "验证码与重新发送",
	units: ["otp", "resend-button"],
	zone: "field",
	category: "form",
	footprint: { width: 360, height: 240 },
	states: [
		{ id: "rest", label: "待输入" },
		{ id: "focus", label: "首格聚焦" },
		{ id: "filled", label: "输入中" },
		{ id: "invalid", label: "验证码错误" },
		{ id: "success", label: "验证通过" },
		{ id: "readonly", label: "只读" },
		{ id: "disabled", label: "禁用" },
		{ id: "cooldown", label: "重发冷却" },
		{ id: "pending", label: "发送中" },
		{ id: "send-failed", label: "重发失败" },
	],
	Render: OTPFamily,
};
