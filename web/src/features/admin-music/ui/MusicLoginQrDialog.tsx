import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@violet/ui";
import { CheckCircle2, QrCode, RefreshCw, Smartphone } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useCancelMusicLoginQR, useCreateMusicLoginQR, useMusicQrPolling } from "../api/queries";
import { generateQrSvgPath } from "../lib/qr";
import type { MusicAccount, MusicChallenge } from "../model/types";

/**
 * 扫码登录对话框 props。
 */
export interface MusicLoginQrDialogProps {
	/** 对话框是否打开 */
	open: boolean;
	/** 打开状态改变事件 */
	onOpenChange: (open: boolean) => void;
	/** 成功扫码登录并绑定账号后的回调 */
	onSuccess?: (account: MusicAccount) => void;
}

/**
 * 网易云音乐客户端扫码登录对话框。
 */
export function MusicLoginQrDialog({ open, onOpenChange, onSuccess }: MusicLoginQrDialogProps) {
	const createQrMutation = useCreateMusicLoginQR();
	const cancelQrMutation = useCancelMusicLoginQR();

	const [challenge, setChallenge] = useState<MusicChallenge | null>(null);
	const activeChallengeIdRef = useRef<string | null>(null);
	activeChallengeIdRef.current = challenge?.id ?? null;

	const startChallenge = useCallback(async () => {
		try {
			const res = await createQrMutation.mutateAsync();
			setChallenge(res);
		} catch (error) {
			const message = error instanceof Error ? error.message : "获取登录二维码失败";
			toast.error(message);
		}
	}, [createQrMutation]);

	// 弹窗打开时生成挑战，关闭时清理
	useEffect(() => {
		if (open) {
			startChallenge();
		} else {
			const idToCancel = activeChallengeIdRef.current;
			if (idToCancel) {
				cancelQrMutation.mutate(idToCancel);
			}
			setChallenge(null);
		}
	}, [open, startChallenge, cancelQrMutation]);

	const handleConfirmed = (account: MusicAccount) => {
		toast.success(`网易云账号「${account.profile?.nickname ?? "已连接"}」连接成功！`);
		onSuccess?.(account);
		onOpenChange(false);
	};

	const { qrState } = useMusicQrPolling(challenge?.id ?? null, handleConfirmed);

	const qrSvg = useMemo(() => {
		if (!challenge?.url) return null;
		try {
			return generateQrSvgPath(challenge.url, 6, 2);
		} catch {
			return null;
		}
	}, [challenge?.url]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<QrCode className="size-5 text-primary" />
						扫码连接网易云账号
					</DialogTitle>
					<DialogDescription>
						全站统一使用该账号访问歌单库；不会代表访客获取付费歌曲播放权。
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col items-center justify-center py-6">
					<div className="relative flex size-56 items-center justify-center rounded-2xl border border-border bg-white p-3 shadow-xs">
						{createQrMutation.isPending || !challenge ? (
							<div className="flex flex-col items-center gap-2 text-muted-foreground text-xs">
								<RefreshCw className="size-6 animate-spin text-primary" />
								<span>正在生成二维码...</span>
							</div>
						) : qrSvg ? (
							<>
								<svg
									viewBox={`0 0 ${qrSvg.size} ${qrSvg.size}`}
									className="size-full text-neutral-900"
									aria-label="网易云登录二维码"
									role="img"
								>
									<path d={qrSvg.path} fill="currentColor" />
								</svg>

								{/* 已扫码待确认遮罩 */}
								{qrState === "scanned" && (
									<div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-white/92 backdrop-blur-xs">
										<Smartphone className="size-8 text-primary animate-bounce" />
										<p className="mt-2 font-medium text-neutral-800 text-sm">
											扫描成功
										</p>
										<p className="mt-1 text-neutral-500 text-xs">
											请在手机上点击确认登录
										</p>
									</div>
								)}

								{/* 确认成功遮罩 */}
								{qrState === "confirmed" && (
									<div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-white/92 backdrop-blur-xs">
										<CheckCircle2 className="size-8 text-emerald-600" />
										<p className="mt-2 font-medium text-neutral-800 text-sm">
											登录成功
										</p>
									</div>
								)}

								{/* 过期遮罩 */}
								{qrState === "expired" && (
									<div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-white/92 backdrop-blur-xs">
										<p className="font-medium text-neutral-700 text-sm">
											二维码已失效
										</p>
										<Button
											size="sm"
											onClick={startChallenge}
											className="mt-3 gap-1.5"
										>
											<RefreshCw className="size-3.5" />
											刷新二维码
										</Button>
									</div>
								)}
							</>
						) : (
							<div className="text-destructive text-xs">二维码解析失败</div>
						)}
					</div>

					<div className="mt-4 text-center">
						{qrState === "waiting" && (
							<p className="text-muted-foreground text-xs">
								请使用{" "}
								<span className="font-medium text-foreground">网易云音乐 APP</span>{" "}
								扫一扫
							</p>
						)}
						{qrState === "scanned" && (
							<p className="text-primary text-xs">正在等待客户端确认...</p>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
