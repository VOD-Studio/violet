import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import { Label } from "@shared/ui/base/label";
import { Textarea } from "@shared/ui/base/textarea";
import { Modal } from "@shared/ui/modal";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@shared/ui/otp";
import { ResendButton } from "@shared/ui/resend-button";
import { ArrowLeft, ArrowRight, Mailbox, UserRoundCheck } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { EMPTY_FORM, type FriendLinkForm } from "../model/mock";
import { BusinessCardFace } from "./CardWall";

type Track = "anon" | "member";
type Step = "identity" | "card" | "done";

/** mock 验证码口令：任意 6 位数字均可通过（实验室不接 API） */
const CODE_HINT = "实验室 mock：任意 6 位数字可通过";

/**
 * 申请弹窗 · 「交换名片」仪式原型
 *
 * 交互叙事：申请友链 = 把站点的名片递进站长的名片夹。
 * - 左栏是「正在填写的名片」实时预览，让表单有了实体；
 * - 匿名轨道先「验明正身」（邮箱 → 验证码），登录轨道直达名片填写（双轨两步流）；
 * - 提交瞬间名片翻面、盖上「PENDING 待审核」邮戳，给出回执编号——
 *   仪式的高潮是「名片已递出」，而不是「表单提交成功」。
 */
export function ApplyDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [track, setTrack] = useState<Track>("anon");
	const [step, setStep] = useState<Step>("identity");
	const [form, setForm] = useState<FriendLinkForm>(EMPTY_FORM);
	const [code, setCode] = useState("");
	const [codeSent, setCodeSent] = useState(false);

	const set = (key: keyof FriendLinkForm) => (value: string) =>
		setForm((f) => ({ ...f, [key]: value }));

	const reset = () => {
		setTrack("anon");
		setStep("identity");
		setForm(EMPTY_FORM);
		setCode("");
		setCodeSent(false);
	};

	const stepIndex = step === "identity" ? 1 : step === "card" ? 2 : 3;
	const stepLabel = step === "identity" ? "验明正身" : step === "card" ? "填写名片" : "交换完成";

	/** 预览名片：表单值映射成 FriendLinkDTO 形状，空值走占位文案 */
	const preview = {
		name: form.name.trim() || "你的站名",
		url: form.url.trim() || "https://your.blog",
		avatar_url: form.avatar_url.trim() || null,
		description: form.description.trim() || "一句话介绍你的站点",
		owner_name: form.owner_name.trim() || null,
	};

	const canProceedIdentity =
		track === "member" || (form.contact_email.includes("@") && code.length === 6);
	const canSubmit = form.name.trim().length > 0 && form.url.trim().length > 0;

	return (
		<Modal
			open={open}
			onOpenChange={(v) => {
				onOpenChange(v);
				if (!v) reset();
			}}
			title="交换名片"
			description="双轨两步流：匿名先验邮箱，登录直达表单"
			size="xl"
			footer={
				<>
					{step === "card" && track === "anon" ? (
						<Button variant="ghost" onClick={() => setStep("identity")}>
							<ArrowLeft className="size-4" />
							上一步
						</Button>
					) : null}
					<div className="ml-auto flex items-center gap-2">
						{step === "identity" ? (
							<Button disabled={!canProceedIdentity} onClick={() => setStep("card")}>
								递出名片
								<ArrowRight className="size-4" />
							</Button>
						) : null}
						{step === "card" ? (
							<Button disabled={!canSubmit} onClick={() => setStep("done")}>
								完成交换
								<ArrowRight className="size-4" />
							</Button>
						) : null}
						{step === "done" ? (
							<Button
								onClick={() => {
									onOpenChange(false);
									reset();
								}}
							>
								收好回执
							</Button>
						) : null}
					</div>
				</>
			}
		>
			<div className="grid gap-6 md:grid-cols-[220px_1fr]">
				{/* 左栏：名片实时预览 + 步骤指示 */}
				<div className="flex flex-col gap-3">
					<p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">
						Your Card
					</p>
					<motion.div
						layout
						className="relative rounded-xl border border-edge-hairline bg-card p-4 shadow-sm"
						animate={
							step === "done"
								? { rotateY: [0, 90, 0], transition: { duration: 0.7 } }
								: {}
						}
					>
						<BusinessCardFace link={preview} />
						{/* 提交后盖戳 */}
						<AnimatePresence>
							{step === "done" ? (
								<motion.span
									initial={{ scale: 2.2, opacity: 0, rotate: -24 }}
									animate={{ scale: 1, opacity: 1, rotate: -12 }}
									transition={{
										type: "spring",
										stiffness: 320,
										damping: 18,
										delay: 0.35,
									}}
									className="pointer-events-none absolute right-3 top-3 flex size-16 flex-col items-center justify-center rounded-full border-2 border-amber-600/50 font-mono text-[9px] uppercase leading-tight tracking-widest text-amber-600/80 dark:text-amber-400/80"
								>
									<span>pending</span>
									<span>待审核</span>
								</motion.span>
							) : null}
						</AnimatePresence>
					</motion.div>
					<p className="font-mono text-xs text-muted-foreground">
						STEP {stepIndex}/3 · {stepLabel}
					</p>
				</div>

				{/* 右栏：步骤区 */}
				<div className="min-h-72">
					<AnimatePresence mode="wait" initial={false}>
						{step === "identity" ? (
							<motion.div
								key="identity"
								initial={{ opacity: 0, x: 24 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: -24 }}
								transition={{ duration: 0.25 }}
								className="flex flex-col gap-5"
							>
								{/* 双轨选择 */}
								<div className="grid grid-cols-2 gap-3">
									<button
										type="button"
										onClick={() => setTrack("anon")}
										className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors ${
											track === "anon"
												? "border-foreground/40 bg-muted/40"
												: "border-edge-hairline hover:bg-muted/30"
										}`}
									>
										<Mailbox className="size-4 text-muted-foreground" />
										<span className="text-sm font-medium">匿名申请</span>
										<span className="text-xs text-muted-foreground">
											邮箱验证码两步流
										</span>
									</button>
									<button
										type="button"
										onClick={() => setTrack("member")}
										className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors ${
											track === "member"
												? "border-foreground/40 bg-muted/40"
												: "border-edge-hairline hover:bg-muted/30"
										}`}
									>
										<UserRoundCheck className="size-4 text-muted-foreground" />
										<span className="text-sm font-medium">登录用户</span>
										<span className="text-xs text-muted-foreground">
											跳过验证，直达名片
										</span>
									</button>
								</div>

								{track === "anon" ? (
									<>
										<div className="flex flex-col gap-2">
											<Label htmlFor="fl-email">
												联系邮箱（仅留存，不公开）
											</Label>
											<div className="flex gap-2">
												<Input
													id="fl-email"
													type="email"
													placeholder="you@your.blog"
													value={form.contact_email}
													onChange={(e) =>
														set("contact_email")(e.target.value)
													}
													className="flex-1"
												/>
												<ResendButton
													variant="outline"
													label={codeSent ? "重新发送" : "发送验证码"}
													resetKey={form.contact_email}
													onResend={() => {
														if (!form.contact_email.includes("@"))
															return false;
														setCodeSent(true);
													}}
												/>
											</div>
										</div>
										{codeSent ? (
											<motion.div
												initial={{ opacity: 0, y: 8 }}
												animate={{ opacity: 1, y: 0 }}
												className="flex flex-col gap-2"
											>
												<Label>验证码</Label>
												<InputOTP
													maxLength={6}
													value={code}
													onChange={setCode}
												>
													<InputOTPGroup>
														{[0, 1, 2, 3, 4, 5].map((i) => (
															<InputOTPSlot key={i} index={i} />
														))}
													</InputOTPGroup>
												</InputOTP>
												<p className="text-xs text-muted-foreground">
													{CODE_HINT}
												</p>
											</motion.div>
										) : null}
									</>
								) : (
									<motion.p
										initial={{ opacity: 0, y: 8 }}
										animate={{ opacity: 1, y: 0 }}
										className="rounded-xl border border-edge-hairline bg-muted/30 p-4 text-sm text-muted-foreground"
									>
										已登录为{" "}
										<span className="font-mono text-foreground">
											@demo-user
										</span>
										，联系邮箱取自账号资料，无需验证码。
									</motion.p>
								)}
							</motion.div>
						) : null}

						{step === "card" ? (
							<motion.div
								key="card"
								initial={{ opacity: 0, x: 24 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: -24 }}
								transition={{ duration: 0.25 }}
								className="grid grid-cols-1 gap-4 sm:grid-cols-2"
							>
								<div className="flex flex-col gap-2">
									<Label htmlFor="fl-name">站名 *</Label>
									<Input
										id="fl-name"
										placeholder="山洪博客"
										value={form.name}
										onChange={(e) => set("name")(e.target.value)}
									/>
								</div>
								<div className="flex flex-col gap-2">
									<Label htmlFor="fl-url">站点 URL *</Label>
									<Input
										id="fl-url"
										type="url"
										placeholder="https://your.blog"
										value={form.url}
										onChange={(e) => set("url")(e.target.value)}
									/>
								</div>
								<div className="flex flex-col gap-2">
									<Label htmlFor="fl-avatar">头像 URL</Label>
									<Input
										id="fl-avatar"
										type="url"
										placeholder="留空则用首字符占位"
										value={form.avatar_url}
										onChange={(e) => set("avatar_url")(e.target.value)}
									/>
								</div>
								<div className="flex flex-col gap-2">
									<Label htmlFor="fl-owner">站长称呼</Label>
									<Input
										id="fl-owner"
										placeholder="怎么称呼你"
										value={form.owner_name}
										onChange={(e) => set("owner_name")(e.target.value)}
									/>
								</div>
								<div className="flex flex-col gap-2 sm:col-span-2">
									<Label htmlFor="fl-desc">一句话描述</Label>
									<Textarea
										id="fl-desc"
										rows={2}
										placeholder="写点什么，让站长和访客认识你的站点"
										value={form.description}
										onChange={(e) => set("description")(e.target.value)}
									/>
								</div>
								<div className="flex flex-col gap-2 sm:col-span-2">
									<Label htmlFor="fl-linkback">
										回链页地址（你把本站挂在了哪页）
									</Label>
									<Input
										id="fl-linkback"
										type="url"
										placeholder="https://your.blog/friends"
										value={form.linkback_url}
										onChange={(e) => set("linkback_url")(e.target.value)}
									/>
								</div>
							</motion.div>
						) : null}

						{step === "done" ? (
							<motion.div
								key="done"
								initial={{ opacity: 0, y: 16 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.35, delay: 0.2 }}
								className="flex h-full flex-col items-start justify-center gap-3"
							>
								<p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">
									Receipt
								</p>
								<h3 className="text-xl font-semibold">名片已递出</h3>
								<p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
									你的名片已进入站长的审核队列。审核通过后，它会出现在友链墙上，
									与这里的其他名片并列——没有邮件回执，回访页面自见分晓。
								</p>
								<p className="font-mono text-xs text-muted-foreground">
									RECEIPT № 20260812-
									{((form.name.length * 7 + form.url.length * 13) % 900) + 100}
								</p>
							</motion.div>
						) : null}
					</AnimatePresence>
				</div>
			</div>
		</Modal>
	);
}
