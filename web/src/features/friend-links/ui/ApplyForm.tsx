import { useCsrfToken } from "@features/auth/api/queries";
import { Button, Card, Field, Input, InputOTP, ResendButton, useFieldControl } from "@violet/ui";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { useApplyFriendLink } from "../api/queries";
import { EMPTY_FORM, type FriendLinkForm } from "./application-form";
import {
	type ApplicationVerification,
	useApplicationVerification,
} from "./use-application-verification";

function EmailContactControl({
	email,
	verification,
}: {
	email: string;
	verification: ApplicationVerification;
}) {
	const control = useFieldControl();
	return (
		<div className="flex flex-wrap items-start gap-2">
			<Input
				{...control}
				name="contact_email"
				type="email"
				required
				autoComplete="email"
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
	);
}

/** 交换区的申请表；登录使用账号邮箱，匿名保留邮箱验证码及重发流程。 */
export function ApplyForm({ isLoggedIn, username }: { isLoggedIn: boolean; username?: string }) {
	const [form, setForm] = useState<FriendLinkForm>(EMPTY_FORM);
	const [submitted, setSubmitted] = useState(false);
	const [error, setError] = useState("");
	const apply = useApplyFriendLink();
	useCsrfToken({ enabled: true });
	const set = (key: keyof FriendLinkForm, value: string) => {
		setError("");
		setForm((current) => ({ ...current, [key]: value }));
	};
	const verification = useApplicationVerification(form.contact_email, (email) =>
		set("contact_email", email),
	);

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (apply.isPending) return;
		if (!isLoggedIn && (!verification.sent || verification.code.length !== 6)) {
			setError("请先完成邮箱验证码验证");
			return;
		}
		setError("");
		apply.mutate(
			{
				name: form.name.trim(),
				url: form.url.trim(),
				avatar_url: form.avatar_url.trim(),
				description: form.description.trim(),
				rss_url: form.rss_url.trim(),
				owner_name: form.owner_name.trim(),
				linkback_url: form.linkback_url.trim(),
				contact_email: isLoggedIn ? "" : form.contact_email.trim(),
				code: isLoggedIn ? undefined : verification.code,
			},
			{
				onSuccess: () => setSubmitted(true),
				onError: (reason) => {
					verification.onReject(reason);
					setError(reason.message || "提交失败，请重试");
					toast.error(reason.message || "提交失败，请重试");
				},
			},
		);
	};

	return (
		<Card>
			{submitted ? (
				<div role="status" className="space-y-3 py-8">
					<h3 className="text-xl font-semibold">申请已提交</h3>
					<p className="text-sm leading-7 text-muted-foreground">
						审核通过后，你的站点会出现在友链列表中。
					</p>
				</div>
			) : (
				<form aria-label="申请友链" onSubmit={submit} className="space-y-4">
					<fieldset disabled={apply.isPending} className="min-w-0 space-y-3">
						<legend className="sr-only">站点信息</legend>
						<div className="grid gap-3 sm:grid-cols-2">
							<Field label="站名">
								<Input
									name="name"
									required
									maxLength={30}
									value={form.name}
									onChange={(event) => set("name", event.target.value)}
								/>
							</Field>
							<Field label="地址">
								<Input
									name="url"
									type="url"
									required
									value={form.url}
									onChange={(event) => set("url", event.target.value)}
								/>
							</Field>
						</div>
						<Field label="头像地址" optional>
							<Input
								name="avatar_url"
								type="url"
								value={form.avatar_url}
								onChange={(event) => set("avatar_url", event.target.value)}
							/>
						</Field>
						<Field label="一句话简介" optional>
							<Input
								name="description"
								maxLength={80}
								value={form.description}
								onChange={(event) => set("description", event.target.value)}
							/>
						</Field>
						<Field
							label="RSS 地址"
							optional
							hint="留下 RSS，你的最新文章会显示在卡片上"
						>
							<Input
								name="rss_url"
								type="url"
								maxLength={2048}
								value={form.rss_url}
								onChange={(event) => set("rss_url", event.target.value)}
							/>
						</Field>
						<div className="grid gap-3 sm:grid-cols-2">
							<Field label="站长称呼" optional>
								<Input
									name="owner_name"
									value={form.owner_name}
									onChange={(event) => set("owner_name", event.target.value)}
								/>
							</Field>
							<Field label="回链页地址" optional>
								<Input
									name="linkback_url"
									type="url"
									value={form.linkback_url}
									onChange={(event) => set("linkback_url", event.target.value)}
								/>
							</Field>
						</div>
						{isLoggedIn ? (
							<p className="text-sm text-muted-foreground">
								以 @{username} 的账号申请，联系邮箱取自账号资料。
							</p>
						) : (
							<>
								<Field label="联系邮箱" hint="仅留存，不公开">
									<EmailContactControl
										email={form.contact_email}
										verification={verification}
									/>
								</Field>
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
						)}
					</fieldset>
					{error ? (
						<p role="alert" className="text-sm text-destructive">
							{error}
						</p>
					) : null}
					<div className="flex flex-wrap items-center justify-between gap-4">
						<p className="text-xs text-muted-foreground">
							审核通过后出现在上面的列表中。
						</p>
						<Button type="submit" loading={apply.isPending}>
							提交申请
						</Button>
					</div>
				</form>
			)}
		</Card>
	);
}
