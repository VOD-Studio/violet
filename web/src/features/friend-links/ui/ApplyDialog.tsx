import { useCsrfToken } from "@features/auth/api/queries";
import { Button, Input, Label, Modal, Textarea } from "@violet/ui";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { useApplyFriendLink } from "../api/queries";
import type { CreateFriendLinkBody, FriendLinkPublicDTO } from "../model/types";
import { ApplyIdentityStep } from "./ApplyIdentityStep";
import { EMPTY_FORM, type FriendLinkForm } from "./application-form";
import { BusinessCardFace } from "./BusinessCardFace";
import { useApplicationVerification } from "./use-application-verification";

type Track = "anon" | "member";
type Step = "identity" | "card" | "done";

interface ApplyDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 当前是否已登录（决定 step 1 双轨选择是否显示） */
	isLoggedIn: boolean;
	/** 当前登录用户名（仅展示用，匿名轨不出现） */
	currentUsername?: string;
}

export function ApplyDialog({ open, onOpenChange, isLoggedIn, currentUsername }: ApplyDialogProps) {
	const initialTrack: Track = isLoggedIn ? "member" : "anon";
	const [track, setTrack] = useState<Track>(initialTrack);
	const [step, setStep] = useState<Step>(isLoggedIn ? "card" : "identity");
	const [form, setForm] = useState<FriendLinkForm>(EMPTY_FORM);

	// 弹窗打开时预取 CSRF token 种 violet_csrf cookie；
	// axios interceptor 自动从 cookie 读并注入 X-CSRF-Token header。
	// /friends 对纯匿名访客无其他写入口，不预取则发码/提交首请求 403。
	useCsrfToken({ enabled: open });
	const apply = useApplyFriendLink();

	const set = (key: keyof FriendLinkForm) => (value: string) =>
		setForm((f) => ({ ...f, [key]: value }));

	const verification = useApplicationVerification(form.contact_email, set("contact_email"));

	const reset = () => {
		setTrack(initialTrack);
		setStep(isLoggedIn ? "card" : "identity");
		setForm(EMPTY_FORM);
		verification.reset();
	};

	const stepIndex = step === "identity" ? 1 : step === "card" ? 2 : 3;
	const stepLabel = step === "identity" ? "验明正身" : step === "card" ? "填写名片" : "交换完成";

	/** 预览名片：表单值映射成 FriendLinkPublicDTO 形状，空值走占位文案 */
	const preview: Pick<
		FriendLinkPublicDTO,
		"name" | "url" | "avatar_url" | "description" | "owner_name"
	> = {
		name: form.name.trim() || "你的站名",
		url: form.url.trim() || "https://your.blog",
		avatar_url: form.avatar_url.trim() || null,
		description: form.description.trim() || "一句话介绍你的站点",
		owner_name: form.owner_name.trim() || null,
	};

	const canProceedIdentity =
		track === "member" ||
		(form.contact_email.includes("@") && verification.sent && verification.code.length === 6);
	const canSubmit = form.name.trim().length > 0 && form.url.trim().length > 0;

	const submit = () => {
		if (!canSubmit || apply.isPending) return;
		const body: CreateFriendLinkBody = {
			name: form.name.trim(),
			url: form.url.trim(),
			avatar_url: form.avatar_url.trim(),
			description: form.description.trim(),
			owner_name: form.owner_name.trim(),
			linkback_url: form.linkback_url.trim(),
			contact_email: form.contact_email.trim(),
			code: track === "anon" ? verification.code : undefined,
		};
		apply.mutate(body, {
			onSuccess: () => {
				toast.success("已提交，审核通过后会出现在友链墙上");
				setStep("done");
			},
			onError: (error) => {
				if (track === "anon" && verification.onReject(error)) setStep("identity");
			},
		});
	};

	return (
		<Modal
			open={open}
			onOpenChange={(v) => {
				onOpenChange(v);
				if (!v) reset();
			}}
			title="交换名片"
			description="把站点名片递进站长的名片夹，等候审核"
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
							<Button disabled={!canSubmit || apply.isPending} onClick={submit}>
								{apply.isPending ? "递出中…" : "完成交换"}
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
									className="pointer-events-none absolute right-3 top-3 flex size-16 flex-col items-center justify-center rounded-full border-2 border-warning/60 font-mono text-[9px] uppercase leading-tight tracking-widest text-warning"
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
							<ApplyIdentityStep
								key="identity"
								track={track}
								onTrackChange={setTrack}
								isLoggedIn={isLoggedIn}
								currentUsername={currentUsername}
								email={form.contact_email}
								verification={verification}
							/>
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
							</motion.div>
						) : null}
					</AnimatePresence>
				</div>
			</div>
		</Modal>
	);
}
