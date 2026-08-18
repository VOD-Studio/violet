import { useVerifyOAuth } from "@features/admin-settings/api/queries";
import type { OAuthProviderStatus } from "@features/admin-settings/model/types";
import { Button } from "@shared/ui/base/button";
import { Switch } from "@shared/ui/base/switch";
import type { ReactNode } from "react";
import { useState } from "react";

export interface OAuthProviderCardProps {
	/** provider 展示名（Google / GitHub） */
	name: string;
	/** 开关的表单实时值——凭据输入区跟随它显隐，未保存也立即预览 */
	enabled: boolean;
	onEnabledChange: (v: boolean) => void;
	/** 服务端凭据状态；未配置时展示原因，已配置时仅行末淡预览 */
	status?: OAuthProviderStatus;
	/** 凭据获取入口（console/oauth apps），未配置时引导跳转 */
	docsUrl?: string;
	/** provider 标识（google/github），探测端点入参 */
	provider: string;
	/** 凭据输入项，仅在 enabled 时渲染 */
	children?: ReactNode;
}

/**
 * 第三方登录 provider 卡：开关与凭据输入同卡。
 *
 * 输入区显隐跟随开关的表单值（改开关即出现/收起，无需先保存）。
 * 状态只在异常时说话：未配置给原因（与登录链路拒绝原因一致）；
 * 已配置安静收尾——脱敏 client_id 以次要文字行末带过，不打扰。
 */
export function OAuthProviderCard({
	name,
	provider,
	enabled,
	onEnabledChange,
	status,
	docsUrl,
	children,
}: OAuthProviderCardProps) {
	const verify = useVerifyOAuth();
	const [result, setResult] = useState<{ valid: boolean; detail: string } | null>(null);

	return (
		<div className="border-edge-hairline space-y-4 rounded-xl border p-4">
			<div className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
					<span className="text-sm font-medium">{name}</span>
					{enabled && status && !status.configured && (
						<span className="text-xs text-amber-600">
							{docsUrl ? (
								<a
									href={docsUrl}
									target="_blank"
									rel="noreferrer"
									className="underline decoration-dotted underline-offset-2"
								>
									{status.issue}，去获取 ↗
								</a>
							) : (
								<span>{status.issue}，保存后仍不可用</span>
							)}
						</span>
					)}
					{enabled && status?.configured && (
						<span className="text-muted-foreground truncate font-mono text-xs">
							{status.client_id_preview}
						</span>
					)}
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{enabled && status?.configured && (
						<Button
							variant="ghost"
							size="sm"
							disabled={verify.isPending}
							onClick={() => verify.mutate(provider, { onSuccess: setResult })}
						>
							{verify.isPending ? "检测中…" : "检测"}
						</Button>
					)}
					<Switch checked={enabled} onCheckedChange={onEnabledChange} />
				</div>
			</div>
			{result && (
				<p className={result.valid ? "text-xs text-green-600" : "text-xs text-amber-600"}>
					{result.detail}
				</p>
			)}
			{enabled && <div className="space-y-3">{children}</div>}
		</div>
	);
}
