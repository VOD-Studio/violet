import { useVerifyOAuth } from "@features/admin-settings/api/queries";
import type { OAuthProviderStatus } from "@features/admin-settings/model/types";
import { copyText } from "@shared/lib/clipboard";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/base/button";
import { Switch } from "@shared/ui/base/switch";
import { Check, Copy } from "lucide-react";
import { type ReactNode, useState } from "react";

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
	/** provider 控制台要求填写的回调/来源（输入区展开时展示并供复制） */
	callbackHint?: { label: string; value: string };
	/** provider 标识（google/github），探测端点入参 */
	provider: string;
	/** 凭据输入项，仅在输入区展开时渲染 */
	children?: ReactNode;
}

/**
 * 第三方登录 provider 卡：开关与凭据输入同卡。
 *
 * 输入区显隐跟随开关的表单值（改开关即出现/收起，无需先保存）；已配置且
 * 生效时输入区折叠，只留脱敏预览与「修改」入口——正常状态不占地方，
 * 「检测」也只在折叠态出现（测的是已保存凭据，编辑中隐藏避免歧义）。
 * 状态只在异常时说话：未配置给原因（与登录链路拒绝原因一致）。
 */
export function OAuthProviderCard({
	name,
	provider,
	enabled,
	onEnabledChange,
	status,
	docsUrl,
	callbackHint,
	children,
}: OAuthProviderCardProps) {
	const verify = useVerifyOAuth();
	const [result, setResult] = useState<{ valid: boolean; detail: string } | null>(null);
	const [editing, setEditing] = useState(false);
	const [copied, setCopied] = useState(false);

	// 已配置默认折叠（点「修改」展开）；未配置强制展开，异常要能直接操作
	const expanded = enabled && (editing || !status?.configured);

	const copyHint = async () => {
		if (!callbackHint) return;
		if (await copyText(callbackHint.value)) {
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		}
	};

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
								status.issue
							)}
						</span>
					)}
					{enabled && status?.configured && (
						<>
							<span className="text-muted-foreground truncate font-mono text-xs">
								{status.client_id_preview}
							</span>
							<button
								type="button"
								className="text-muted-foreground text-xs underline decoration-dotted underline-offset-2 hover:text-foreground"
								onClick={() => setEditing((v) => !v)}
							>
								{expanded ? "收起" : "修改"}
							</button>
						</>
					)}
					{enabled && status?.configured && !expanded && (
						<Button
							// type="button" 必须显式声明：form 内默认 submit，点检测会连带提交站点设置
							// 并触发卡片 key 重置，检测结果随重挂丢失
							type="button"
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
			{enabled && !expanded && result && (
				<p className={cn("text-xs", result.valid ? "text-green-600" : "text-amber-600")}>
					{result.detail}
				</p>
			)}
			{expanded && (
				<div className="space-y-3">
					{children}
					{callbackHint && (
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<span className="shrink-0">{callbackHint.label}</span>
							<span className="truncate font-mono">{callbackHint.value}</span>
							<button
								type="button"
								className="flex shrink-0 items-center gap-1 hover:text-foreground"
								onClick={copyHint}
							>
								{copied ? (
									<Check className="size-3" />
								) : (
									<Copy className="size-3" />
								)}
								{copied ? "已复制" : "复制"}
							</button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
