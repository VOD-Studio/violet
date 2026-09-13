import type { SecurityPendingDTO } from "@features/admin-settings/model/types";
import { Button } from "@shared/ui/base/button";
import { cn } from "@/shared/lib/utils";

interface SecurityPendingCardProps {
	pending: SecurityPendingDTO;
	/** 无写权限或确认请求进行中时禁用操作 */
	disabled: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}

/**
 * 待确认变更卡片：展示暂存的覆盖值与确认截止时间。
 * 超时未确认或取消后自动维持上一有效配置（数据库从未写入）。
 */
export function SecurityPendingCard({
	pending,
	disabled,
	onConfirm,
	onCancel,
}: SecurityPendingCardProps) {
	return (
		<section
			className={cn(
				"space-y-3 rounded-lg border border-edge-hairline bg-muted/40 p-4",
				"mb-6",
			)}
			aria-label="待确认变更"
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h3 className="text-sm font-semibold">待确认变更</h3>
				<span className="text-xs text-muted-foreground">
					截止 {new Date(pending.expires_at).toLocaleTimeString()}（超时自动恢复原配置）
				</span>
			</div>
			<pre className="overflow-x-auto whitespace-pre-wrap break-all text-xs">
				{JSON.stringify(pending.values, null, 2)}
			</pre>
			<div className="flex flex-wrap gap-2">
				<Button size="sm" onClick={onConfirm} disabled={disabled}>
					二次验证并确认生效
				</Button>
				<Button size="sm" variant="outline" onClick={onCancel} disabled={disabled}>
					取消变更
				</Button>
			</div>
		</section>
	);
}
