import { formatDate, formatRelativeTime } from "@shared/lib/date";
import { Badge, Button, Card, ConfirmDialog } from "@violet/ui";
import { Laptop, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useHasPermission } from "@/features/auth/hooks/usePermissions";
import { usePresenceDevices, useRevokePresenceDevice } from "../api/queries";
import { summarizeSources } from "../lib/summarize";
import type { AdminPresenceDevice } from "../model/types";

/**
 * 设备列表：连接状态、当前上报的来源摘要与撤销操作。
 */
export function PresenceDevicesCard({ onIssue }: { onIssue: () => void }) {
	const canManage = useHasPermission("presence:manage");
	const { data: devices, isLoading, isError } = usePresenceDevices();
	const revoke = useRevokePresenceDevice();
	const [revoking, setRevoking] = useState<AdminPresenceDevice | null>(null);

	const confirmRevoke = async () => {
		if (!revoking) return;
		try {
			await revoke.mutateAsync(revoking.id);
			toast.success(`已撤销「${revoking.display_name}」`);
			setRevoking(null);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "撤销失败");
		}
	};

	return (
		<Card className="rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
			<div className="flex items-center justify-between gap-4 border-b border-border/60 pb-3">
				<h3 className="text-base font-medium">设备</h3>
				{canManage ? (
					<Button size="sm" onClick={onIssue} className="gap-1.5">
						<Plus className="size-3.5" />
						签发凭证
					</Button>
				) : null}
			</div>

			{isLoading ? (
				<p className="py-8 text-center text-sm text-muted-foreground">正在加载设备…</p>
			) : isError ? (
				<p className="py-8 text-center text-sm text-destructive">
					设备列表加载失败，请刷新页面。
				</p>
			) : !devices?.length ? (
				<p className="py-8 text-center text-sm text-muted-foreground">
					还没有设备。签发一个凭证，再在 Nowbeam 里添加接收端。
				</p>
			) : (
				<ul className="divide-y divide-border/60">
					{devices.map((device) => {
						const lines = device.sources ? summarizeSources(device.sources) : [];
						return (
							<li key={device.id} className="flex items-start gap-3 py-4">
								<Laptop
									aria-hidden="true"
									className="mt-0.5 size-4 shrink-0 text-muted-foreground"
								/>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span className="truncate font-medium">
											{device.display_name}
										</span>
										{device.online ? (
											<Badge
												variant="outline"
												className="border-success/30 text-success"
											>
												在线
											</Badge>
										) : (
											<Badge
												variant="outline"
												className="text-muted-foreground"
											>
												离线
											</Badge>
										)}
									</div>
									<div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
										{device.online ? (
											lines.length > 0 ? (
												lines.map((line) => (
													<p key={line} className="truncate">
														{line}
													</p>
												))
											) : (
												<p>在线，没有分享的活动</p>
											)
										) : (
											<p>签发于 {formatDate(device.created_at)}</p>
										)}
										{device.online && device.updated_at ? (
											<p className="text-xs">
												最近上报 {formatRelativeTime(device.updated_at)}
											</p>
										) : null}
									</div>
								</div>
								{canManage ? (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setRevoking(device)}
										className="shrink-0 text-destructive hover:text-destructive"
									>
										撤销
									</Button>
								) : null}
							</li>
						);
					})}
				</ul>
			)}

			<ConfirmDialog
				open={revoking !== null}
				onOpenChange={(open) => !open && setRevoking(null)}
				title={`撤销「${revoking?.display_name ?? ""}」？`}
				description="该设备会立即断开，顶栏上它的状态随之消失。要重新上报，需要签发新凭证。"
				confirmLabel="撤销"
				loading={revoke.isPending}
				onConfirm={confirmRevoke}
			/>
		</Card>
	);
}
