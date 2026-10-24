import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@violet/ui";
import { CheckCircle2, QrCode, RefreshCw, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useCancelMusicLoginQR, useCreateMusicLoginQR, useMusicQrPolling } from "../api/queries";
import type { MusicAccount, MusicChallenge } from "../model/types";

/** 扫码登录对话框的受控状态与完成通知。 */
export interface MusicLoginQrDialogProps {
	/** 关闭时卸载当前扫码会话。 */
	open: boolean;
	/** 扫码确认成功后请求关闭对话框。 */
	onOpenChange: (open: boolean) => void;
	/** 仅在确认结果包含有效账号时通知调用方。 */
	onSuccess?: (account: MusicAccount) => void;
}

/** 连接全站统一使用的网易云账号，不向浏览器返回账号凭据。 */
export function MusicLoginQrDialog({ open, onOpenChange, onSuccess }: MusicLoginQrDialogProps) {
	const [attempt, setAttempt] = useState(0);
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
				{open && (
					<MusicQrSession
						key={attempt}
						onRetry={() => setAttempt((value) => value + 1)}
						onConfirmed={(account) => {
							toast.success(
								`网易云账号「${account.profile?.nickname ?? "已连接"}」连接成功`,
							);
							onSuccess?.(account);
							onOpenChange(false);
						}}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}

interface MusicQrSessionProps {
	onRetry: () => void;
	onConfirmed: (account: MusicAccount) => void;
}

/** 每次挂载只创建一个挑战，卸载时取消尚未确认的会话。 */
function MusicQrSession({ onRetry, onConfirmed }: MusicQrSessionProps) {
	const { mutateAsync: createQr, isPending: isCreating } = useCreateMusicLoginQR();
	const { mutate: cancelQr } = useCancelMusicLoginQR();
	const [challenge, setChallenge] = useState<MusicChallenge | null>(null);
	const [createError, setCreateError] = useState<string | null>(null);
	const confirmedRef = useRef(false);

	useEffect(() => {
		const controller = new AbortController();
		let active = true;
		let challengeId: string | undefined;
		// 跳过 StrictMode 同步清理的那次 setup，避免生成两个登录挑战。
		queueMicrotask(async () => {
			if (!active) return;
			try {
				const next = await createQr(controller.signal);
				challengeId = next.id;
				if (!active) {
					cancelQr(next.id);
					return;
				}
				setChallenge(next);
			} catch (cause) {
				if (!active) return;
				setCreateError(cause instanceof Error ? cause.message : "获取登录二维码失败");
			}
		});
		return () => {
			active = false;
			controller.abort();
			if (challengeId && !confirmedRef.current) cancelQr(challengeId);
		};
	}, [createQr, cancelQr]);

	const { qrState, error: pollingError } = useMusicQrPolling(challenge, (account) => {
		confirmedRef.current = true;
		onConfirmed(account);
	});
	const error = createError ?? pollingError;

	return (
		<div className="flex flex-col items-center gap-4 py-6">
			<div className="flex min-h-56 w-full flex-col items-center justify-center gap-3 p-4 text-center">
				{error ? (
					<>
						<p role="alert" className="text-destructive text-sm">
							{error}
						</p>
						<Button size="sm" disabled={isCreating} onClick={onRetry}>
							重试
						</Button>
					</>
				) : isCreating || !challenge ? (
					<div
						role="status"
						className="flex flex-col items-center gap-2 text-muted-foreground text-xs"
					>
						<RefreshCw className="size-6 animate-spin text-primary" />
						正在生成二维码…
					</div>
				) : qrState === "expired" ? (
					<>
						<p className="text-muted-foreground text-sm">二维码已失效</p>
						<Button size="sm" onClick={onRetry}>
							刷新二维码
						</Button>
					</>
				) : qrState === "scanned" ? (
					<div role="status" className="flex flex-col items-center gap-2">
						<Smartphone className="size-8 text-primary" />
						<p className="text-sm">请在手机上确认登录</p>
					</div>
				) : qrState === "confirmed" ? (
					<div role="status" className="flex flex-col items-center gap-2">
						<CheckCircle2 className="size-8 text-success" />
						登录成功
					</div>
				) : (
					<QRCodeSVG
						value={challenge.url}
						size={224}
						level="M"
						marginSize={4}
						bgColor="#ffffff"
						fgColor="#000000"
						className="size-56 rounded-xl"
						aria-label="网易云登录二维码"
						role="img"
					/>
				)}
			</div>
			{challenge && !error && qrState === "waiting" && (
				<p className="text-muted-foreground text-xs">请使用网易云音乐 APP 扫一扫</p>
			)}
		</div>
	);
}
