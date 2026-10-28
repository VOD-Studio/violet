import { Card, Switch } from "@violet/ui";
import { toast } from "sonner";
import { useHasPermission } from "@/features/auth/hooks/usePermissions";
import { usePresenceSettings, useUpdatePresenceSettings } from "../api/queries";
import { INGEST_PATH, ingestUrl } from "../lib/ingest-url";
import { CopyField } from "./CopyField";

/**
 * 公开展示开关与 Nowbeam 上报地址。
 */
export function PresenceSettingsCard() {
	const canManage = useHasPermission("presence:manage");
	const { data: settings, isLoading } = usePresenceSettings();
	const update = useUpdatePresenceSettings();
	const url =
		typeof window === "undefined" ? INGEST_PATH : ingestUrl(INGEST_PATH, window.location);

	const toggle = async (publicRead: boolean) => {
		try {
			await update.mutateAsync({ public_read: publicRead });
			toast.success(publicRead ? "访客现在可以看到实时状态" : "已对访客隐藏实时状态");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "保存失败");
		}
	};

	return (
		<Card className="rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
			<div className="flex items-start justify-between gap-6">
				<div className="min-w-0">
					<h3 className="text-base font-medium" id="presence-public-read">
						向访客公开
					</h3>
					<p className="mt-1 text-sm text-muted-foreground">
						开启后顶栏显示正在播放、正在使用的应用与窗口标题。关闭时访客看不到任何状态，这里仍能看到连接诊断。
					</p>
				</div>
				<Switch
					aria-labelledby="presence-public-read"
					checked={settings?.public_read ?? false}
					disabled={!canManage || isLoading || update.isPending}
					onCheckedChange={toggle}
				/>
			</div>
			<div className="mt-5 border-t border-border/60 pt-4">
				<p className="text-sm font-medium">上报地址</p>
				<p className="mt-1 mb-2 text-sm text-muted-foreground">
					在 Nowbeam 设置的「接收端」里添加此地址，并填入下方签发的设备凭证。
				</p>
				<CopyField label="上报地址" value={url} />
			</div>
		</Card>
	);
}
