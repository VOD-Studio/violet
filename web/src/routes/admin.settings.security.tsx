import { PageShell } from "@features/admin-layout/ui/PageShell";
import {
	useCancelSecurityChange,
	useConfirmSecurityChange,
	useRequestSecurityChange,
	useSecuritySettings,
} from "@features/admin-settings/api/queries";
import type { SecuritySettingsDTO } from "@features/admin-settings/model/types";
import { OpsGrantDialog } from "@features/admin-settings/ui/security/OpsGrantDialog";
import { SecurityPendingCard } from "@features/admin-settings/ui/security/SecurityPendingCard";
import {
	type RevokeTarget,
	SecuritySessionsSection,
} from "@features/admin-settings/ui/security/SecuritySessionsSection";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { useRevokeSession } from "@features/auth/api/sessions";
import { ApiError } from "@shared/api/error";
import { Button } from "@shared/ui/base/button";
import { Input } from "@shared/ui/base/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@shared/ui/base/select";
import { Skeleton } from "@shared/ui/base/skeleton";
import { Switch } from "@shared/ui/base/switch";
import { Textarea } from "@shared/ui/base/textarea";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { InlineError } from "@shared/ui/inline-error";
import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

/** 安全策略子页表单值 */
interface SecurityForm {
	trusted_origins: string;
	trusted_proxies: string;
	cookie_secure: boolean;
	cookie_same_site: string;
	session_max_devices: number;
}

const SAME_SITE_OPTIONS = [
	{ value: "lax", label: "Lax（默认，顶级导航携带 Cookie）" },
	{ value: "strict", label: "Strict（跨站一律不携带）" },
	{ value: "none", label: "None（跨站携带，必须配合 Secure）" },
];

/** 0 表示不限制；比较按无限处理（0→3 是缩小上限，3→0 是放宽）。 */
const deviceLimit = (value: number): number => (value === 0 ? Number.POSITIVE_INFINITY : value);

function SecuritySettingsPage() {
	const canView = useHasPermission("settings:view");
	const canWrite = useHasPermission("settings:update");
	const query = useSecuritySettings();
	const requestChange = useRequestSecurityChange();
	const confirmChange = useConfirmSecurityChange();
	const cancelChange = useCancelSecurityChange();
	const revokeSessionMut = useRevokeSession();

	const [confirmOpen, setConfirmOpen] = useState(false);
	const [revokeTarget, setRevokeTarget] = useState<RevokeTarget | null>(null);

	const { register, control, reset, watch, formState } = useForm<SecurityForm>({
		defaultValues: {
			trusted_origins: "",
			trusted_proxies: "",
			cookie_secure: false,
			cookie_same_site: "lax",
			session_max_devices: 0,
		},
	});
	const [baseline, setBaseline] = useState<SecurityForm | null>(null);
	const [savedVersion, setSavedVersion] = useState(0);

	const snapshot = query.data;
	useEffect(() => {
		if (!snapshot || formState.isDirty) return;
		const next: SecurityForm = {
			trusted_origins: snapshot.values.trusted_origins,
			trusted_proxies: snapshot.values.trusted_proxies,
			cookie_secure: snapshot.values.cookie_secure,
			cookie_same_site: snapshot.values.cookie_same_site || "lax",
			session_max_devices: snapshot.values.session_max_devices,
		};
		reset(next);
		setBaseline(next);
		setSavedVersion(snapshot.meta.saved_version);
	}, [snapshot, formState.isDirty, reset]);

	/** 确认成功后接纳新快照：重置编辑基线与版本，避免脏表单提交旧版本。 */
	const acceptSnapshot = (data: SecuritySettingsDTO & { meta?: { saved_version?: number } }) => {
		const next: SecurityForm = {
			trusted_origins: data.trusted_origins,
			trusted_proxies: data.trusted_proxies,
			cookie_secure: data.cookie_secure,
			cookie_same_site: data.cookie_same_site || "lax",
			session_max_devices: data.session_max_devices,
		};
		reset(next);
		setBaseline(next);
		if (typeof data.meta?.saved_version === "number") {
			setSavedVersion(data.meta.saved_version);
		}
	};

	const values = watch();
	const dirty =
		baseline !== null &&
		(values.trusted_origins !== baseline.trusted_origins ||
			values.trusted_proxies !== baseline.trusted_proxies ||
			values.cookie_secure !== baseline.cookie_secure ||
			values.cookie_same_site !== baseline.cookie_same_site ||
			Number(values.session_max_devices) !== baseline.session_max_devices);
	const devicesReduced =
		baseline !== null &&
		deviceLimit(Number(values.session_max_devices)) < deviceLimit(baseline.session_max_devices);

	const onSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const patch: Partial<SecuritySettingsDTO> = {};
		if (values.trusted_origins !== baseline?.trusted_origins)
			patch.trusted_origins = values.trusted_origins;
		if (values.trusted_proxies !== baseline?.trusted_proxies)
			patch.trusted_proxies = values.trusted_proxies;
		if (values.cookie_secure !== baseline?.cookie_secure)
			patch.cookie_secure = values.cookie_secure;
		if (values.cookie_same_site !== baseline?.cookie_same_site)
			patch.cookie_same_site = values.cookie_same_site;
		if (Number(values.session_max_devices) !== baseline?.session_max_devices)
			patch.session_max_devices = Number(values.session_max_devices);
		if (Object.keys(patch).length === 0) return;
		requestChange.mutate({ expected_version: savedVersion, values: patch });
	};

	const pending = snapshot?.pending;
	const error =
		requestChange.error ??
		confirmChange.error ??
		cancelChange.error ??
		(query.error as Error | null);
	const fieldErrors =
		error instanceof ApiError && error.details
			? Object.fromEntries(
					Object.entries(error.details).map(([field, detail]) => [
						field,
						Array.isArray(detail) ? detail.join("；") : String(detail),
					]),
				)
			: undefined;

	if (!canView) {
		return (
			<PageShell title="安全策略" description="需要设置查看权限">
				<p className="text-sm text-muted-foreground">
					无 settings:view 权限，无法查看本页。
				</p>
			</PageShell>
		);
	}

	return (
		<PageShell
			title="安全策略"
			description="可信来源、可信代理、Cookie 约束与并发会话上限；变更需经限时确认生效"
			action={
				<Button
					type="submit"
					form="security-form"
					disabled={!canWrite || !dirty || requestChange.isPending}
				>
					{requestChange.isPending ? "暂存中…" : "保存待确认"}
				</Button>
			}
		>
			{query.isLoading ? (
				<div className="space-y-3">
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-24 w-full" />
				</div>
			) : query.isError ? (
				<InlineError
					message={
						query.error instanceof Error ? query.error.message : "加载安全策略失败"
					}
					onRetry={() => query.refetch()}
				/>
			) : (
				<>
					{error && !(error instanceof ApiError) && (
						<InlineError message={error.message} onRetry={() => {}} />
					)}
					{pending && (
						<SecurityPendingCard
							pending={pending}
							disabled={!canWrite || confirmChange.isPending}
							onConfirm={() => setConfirmOpen(true)}
							onCancel={() => cancelChange.mutate()}
						/>
					)}

					<form id="security-form" onSubmit={onSubmit} className="space-y-10">
						<section className="space-y-4">
							<h3 className="text-sm font-semibold">可信来源与代理</h3>
							<p className="text-xs text-muted-foreground">
								可信来源用于跨域允许列表，独立于展示用站点
								URL；仅当直连方命中可信代理列表时才采信
								X-Forwarded-For，伪造转发头无法改变限流计数身份。留空沿用部署默认。
							</p>
							<div className="flex min-w-0 flex-col gap-1.5">
								<label htmlFor="trusted_origins" className="text-sm font-medium">
									可信来源（每行一个 https://host[:port]，或逗号分隔）
								</label>
								<Textarea
									id="trusted_origins"
									rows={3}
									{...register("trusted_origins")}
								/>
								{fieldErrors?.trusted_origins && (
									<span role="alert" className="text-xs text-destructive">
										{fieldErrors.trusted_origins}
									</span>
								)}
							</div>
							<div className="flex min-w-0 flex-col gap-1.5">
								<label htmlFor="trusted_proxies" className="text-sm font-medium">
									可信代理 CIDR/IP（每行一个，支持 v4/v6）
								</label>
								<Textarea
									id="trusted_proxies"
									rows={3}
									{...register("trusted_proxies")}
								/>
								{fieldErrors?.trusted_proxies && (
									<span role="alert" className="text-xs text-destructive">
										{fieldErrors.trusted_proxies}
									</span>
								)}
							</div>
						</section>

						<section className="space-y-4">
							<h3 className="text-sm font-semibold">Cookie 约束</h3>
							<Controller
								control={control}
								name="cookie_secure"
								render={({ field }) => (
									<div className="flex items-center justify-between gap-4">
										<div className="flex flex-col">
											<label
												htmlFor="cookie_secure"
												className="text-sm font-medium"
											>
												强制 Secure Cookie
											</label>
											<span className="text-xs text-muted-foreground">
												仅 HTTPS 传输；生产部署强制开启时不可关闭
											</span>
										</div>
										<Switch
											id="cookie_secure"
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									</div>
								)}
							/>
							<div className="flex min-w-0 flex-col gap-1.5">
								<span className="text-sm font-medium">SameSite 策略</span>
								<Controller
									control={control}
									name="cookie_same_site"
									render={({ field }) => (
										<Select value={field.value} onValueChange={field.onChange}>
											<SelectTrigger className="w-full max-w-96">
												<SelectValue placeholder="选择 SameSite 策略" />
											</SelectTrigger>
											<SelectContent>
												{SAME_SITE_OPTIONS.map((opt) => (
													<SelectItem key={opt.value} value={opt.value}>
														{opt.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									)}
								/>
								{fieldErrors?.cookie_same_site && (
									<span role="alert" className="text-xs text-destructive">
										{fieldErrors.cookie_same_site}
									</span>
								)}
								{fieldErrors?.cookie_secure && (
									<span role="alert" className="text-xs text-destructive">
										{fieldErrors.cookie_secure}
									</span>
								)}
							</div>
						</section>

						<section className="space-y-4">
							<h3 className="text-sm font-semibold">并发会话上限</h3>
							<div className="flex min-w-0 max-w-96 flex-col gap-1.5">
								<label
									htmlFor="session_max_devices"
									className="text-sm font-medium"
								>
									单用户同时登录设备数（0 = 不限制，上限 50）
								</label>
								<Input
									id="session_max_devices"
									type="number"
									min={0}
									max={50}
									{...register("session_max_devices", { valueAsNumber: true })}
								/>
								{fieldErrors?.session_max_devices && (
									<span role="alert" className="text-xs text-destructive">
										{fieldErrors.session_max_devices}
									</span>
								)}
							</div>
							{devicesReduced && (
								<p className="text-xs text-amber-600 dark:text-amber-400">
									缩小上限只影响之后的登录：现有会话保持有效，下一次登录起按创建时间淘汰最旧设备。
								</p>
							)}
						</section>
					</form>

					<SecuritySessionsSection onRevoke={setRevokeTarget} />
				</>
			)}

			{confirmOpen && pending && (
				<OpsGrantDialog
					onOpenChange={setConfirmOpen}
					confirming={confirmChange.isPending}
					onGranted={async () => {
						const result = await confirmChange.mutateAsync(pending.id);
						acceptSnapshot(result.values);
						setConfirmOpen(false);
					}}
				/>
			)}

			<ConfirmDialog
				open={revokeTarget !== null}
				onOpenChange={(open) => !open && setRevokeTarget(null)}
				title="吊销登录会话"
				description={
					revokeTarget?.current
						? "这是当前设备正在使用的会话，吊销后将立即退出登录。确定继续？"
						: "吊销后该会话的请求立即失效，对应设备需重新登录。确定继续？"
				}
				loading={revokeSessionMut.isPending}
				onConfirm={() => {
					if (revokeTarget) revokeSessionMut.mutate(revokeTarget.publicId);
					setRevokeTarget(null);
				}}
			/>
		</PageShell>
	);
}

export const Route = createFileRoute("/admin/settings/security")({
	component: SecuritySettingsPage,
});
