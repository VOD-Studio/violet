import { Badge, Button, Card, ConfirmDialog } from "@violet/ui";
import {
	Activity,
	ExternalLink,
	Headphones,
	LogIn,
	LogOut,
	RefreshCw,
	Server,
	ShieldCheck,
	UserCheck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useHasPermission } from "@/features/auth/hooks/usePermissions";
import { useDisconnectMusicAccount, useRefreshMusicAccount, useVerifyMusic } from "../api/queries";
import type { MusicAccount, MusicStatus } from "../model/types";

/**
 * 站点音乐账号与 Kite 服务状态卡片 props。
 */
export interface MusicAccountCardProps {
	/** Kite 服务端配置状态 */
	status?: MusicStatus;
	/** 站点网易云账号连接状态 */
	account?: MusicAccount;
	/** 服务状态是否在加载中 */
	isStatusLoading?: boolean;
	/** 账号状态是否在加载中 */
	isAccountLoading?: boolean;
	/** 无法扫码时的原因；省略表示配置就绪。 */
	loginDisabledReason?: string;
	/** 打开扫码登录对话框的回调 */
	onOpenQrLogin: () => void;
}

/**
 * 展示 Kite 服务基建状态与当前全站统一绑定的网易云账号卡片。
 */
export function MusicAccountCard({
	status,
	account,
	isStatusLoading,
	isAccountLoading,
	loginDisabledReason,
	onOpenQrLogin,
}: MusicAccountCardProps) {
	const canManage = useHasPermission("music:manage");
	const verifyMutation = useVerifyMusic();
	const refreshMutation = useRefreshMusicAccount();
	const disconnectMutation = useDisconnectMusicAccount();

	const [disconnectOpen, setDisconnectOpen] = useState(false);

	const handleVerify = async () => {
		try {
			const res = await verifyMutation.mutateAsync();
			if (res.valid) {
				toast.success(res.message || "Kite 服务与访问令牌验证通过");
			} else {
				toast.error(res.message || "Kite 验证失败");
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "无法连接至 Kite 服务";
			toast.error(message);
		}
	};

	const handleRefresh = async () => {
		try {
			await refreshMutation.mutateAsync();
			toast.success("网易云账号凭据刷新成功");
		} catch (error) {
			const message = error instanceof Error ? error.message : "凭据刷新失败，请重新扫码";
			toast.error(message);
		}
	};

	const handleDisconnect = async () => {
		try {
			await disconnectMutation.mutateAsync();
			toast.success("已断开站点网易云账号连接");
			setDisconnectOpen(false);
		} catch (error) {
			const message = error instanceof Error ? error.message : "断开账号连接失败";
			toast.error(message);
		}
	};

	return (
		<div className="grid gap-4 md:grid-cols-2">
			{/* Kite 服务端状态 */}
			<Card className="rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
				<div className="flex items-center justify-between border-b border-border/40 pb-3">
					<div className="flex items-center gap-2">
						<Server className="size-5 text-muted-foreground" />
						<h3 className="font-medium text-base">Kite 音乐服务</h3>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={handleVerify}
						disabled={!canManage || verifyMutation.isPending || isStatusLoading}
						className="gap-1.5"
					>
						<Activity
							className={`size-3.5 ${verifyMutation.isPending ? "animate-spin" : ""}`}
						/>
						连通性测试
					</Button>
				</div>

				<div className="mt-4 space-y-3 text-sm">
					<div className="flex items-center justify-between">
						<span className="text-muted-foreground">配置状态</span>
						{status?.configured ? (
							<Badge
								variant="outline"
								className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
							>
								已配置服务地址与令牌
							</Badge>
						) : (
							<Badge
								variant="outline"
								className="border-amber-500/30 text-amber-600 dark:text-amber-400"
							>
								未配置
							</Badge>
						)}
					</div>

					<div className="flex items-center justify-between">
						<span className="text-muted-foreground">凭据加密存储</span>
						{status?.credential_storage_ready ? (
							<div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
								<ShieldCheck className="size-4" />
								<span>加密密钥可用</span>
							</div>
						) : (
							<span className="text-amber-600 dark:text-amber-400">密钥未就绪</span>
						)}
					</div>

					<div className="flex items-center justify-between">
						<span className="text-muted-foreground">服务基地址</span>
						<span className="font-mono text-xs text-muted-foreground">
							{status?.base_url ? status.base_url : "—"}
						</span>
					</div>
				</div>
			</Card>

			{/* 站点网易云账号状态 */}
			<Card className="rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
				<div className="flex items-center justify-between border-b border-border/40 pb-3">
					<div className="flex items-center gap-2">
						<Headphones className="size-5 text-muted-foreground" />
						<h3 className="font-medium text-base">站点网易云账号</h3>
					</div>

					{account?.state === "connected" && (
						<Badge
							variant="outline"
							className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
						>
							已连接
						</Badge>
					)}
					{account?.state === "expired" && (
						<Badge
							variant="outline"
							className="border-amber-500/30 text-amber-600 dark:text-amber-400"
						>
							凭据已失效
						</Badge>
					)}
					{(!account || account.state === "disconnected") && (
						<Badge variant="outline" className="text-muted-foreground">
							未连接
						</Badge>
					)}
				</div>

				<div className="mt-4 flex flex-col justify-between space-y-4">
					{isAccountLoading ? (
						<div className="flex items-center gap-3">
							<div className="size-11 animate-pulse rounded-full bg-muted" />
							<div className="space-y-1.5">
								<div className="h-4 w-28 animate-pulse rounded bg-muted" />
								<div className="h-3 w-20 animate-pulse rounded bg-muted" />
							</div>
						</div>
					) : account?.state === "connected" && account.profile ? (
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								{account.profile.avatar_url ? (
									<img
										src={account.profile.avatar_url}
										alt={account.profile.nickname}
										className="size-11 rounded-full object-cover ring-1 ring-border"
									/>
								) : (
									<div className="flex size-11 items-center justify-center rounded-full bg-muted">
										<UserCheck className="size-5 text-muted-foreground" />
									</div>
								)}
								<div>
									<div className="flex items-center gap-1.5 font-medium">
										<span>{account.profile.nickname}</span>
										<a
											href={`https://music.163.com/#/user/home?id=${account.profile.id}`}
											target="_blank"
											rel="noopener noreferrer"
											className="text-muted-foreground hover:text-foreground"
											title="查看网易云个人主页"
										>
											<ExternalLink className="size-3.5" />
										</a>
									</div>
									<div className="font-mono text-muted-foreground text-xs">
										UID: {account.profile.id}
									</div>
								</div>
							</div>

							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={handleRefresh}
									disabled={!canManage || refreshMutation.isPending}
									className="gap-1"
								>
									<RefreshCw
										className={`size-3.5 ${refreshMutation.isPending ? "animate-spin" : ""}`}
									/>
									刷新
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setDisconnectOpen(true)}
									disabled={!canManage || disconnectMutation.isPending}
									className="text-destructive hover:bg-destructive/10"
								>
									<LogOut className="size-3.5" />
									断开
								</Button>
							</div>
						</div>
					) : account?.state === "expired" ? (
						<div className="space-y-3">
							<p className="text-amber-600 dark:text-amber-400 text-xs">
								当前绑定的网易云账号凭据已过期，无法继续拉取私人歌单，请重新扫码连接。
							</p>
							<div className="flex items-center gap-2">
								<Button
									size="sm"
									onClick={onOpenQrLogin}
									disabled={!canManage || Boolean(loginDisabledReason)}
									className="gap-1.5"
								>
									<LogIn className="size-3.5" />
									重新扫码登录
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setDisconnectOpen(true)}
									disabled={!canManage}
									className="text-destructive hover:bg-destructive/10"
								>
									断开连接
								</Button>
							</div>
						</div>
					) : (
						<div className="space-y-3">
							<p className="text-muted-foreground text-xs leading-relaxed">
								连接全站统一使用的网易云账号，方便在后台直接浏览您的歌单并选入站点展示列表。
							</p>
							<div>
								<Button
									size="sm"
									onClick={onOpenQrLogin}
									disabled={!canManage || Boolean(loginDisabledReason)}
									className="gap-1.5"
								>
									<LogIn className="size-3.5" />
									扫码连接账号
								</Button>
							</div>
						</div>
					)}
					{loginDisabledReason && account?.state !== "connected" && (
						<p className="text-muted-foreground text-xs">{loginDisabledReason}</p>
					)}
				</div>
			</Card>

			{/* 断开连接确认二次弹窗 */}
			<ConfirmDialog
				open={disconnectOpen}
				onOpenChange={setDisconnectOpen}
				onConfirm={handleDisconnect}
				title="确认断开站点网易云账号？"
				description="断开后将清除保存在服务端的会话凭据。站点已添加的展示歌单不会受到影响。"
				confirmLabel="断开连接"
				loading={disconnectMutation.isPending}
			/>
		</div>
	);
}
