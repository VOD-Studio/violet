import { PageShell } from "@features/admin-layout/ui/PageShell";
import { IssueDeviceDialog } from "@features/admin-presence/ui/IssueDeviceDialog";
import { PresenceDevicesCard } from "@features/admin-presence/ui/PresenceDevicesCard";
import { PresenceSettingsCard } from "@features/admin-presence/ui/PresenceSettingsCard";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

/**
 * /admin/presence - Nowbeam 实时状态：公开开关、上报地址与设备凭证。
 */
function AdminPresencePage() {
	const [issueOpen, setIssueOpen] = useState(false);
	return (
		<PageShell
			title="实时状态"
			description="接收 Nowbeam 上报的设备状态，管理设备凭证与是否向访客公开。"
		>
			<div className="grid gap-4">
				<PresenceSettingsCard />
				<PresenceDevicesCard onIssue={() => setIssueOpen(true)} />
			</div>
			<IssueDeviceDialog open={issueOpen} onOpenChange={setIssueOpen} />
		</PageShell>
	);
}

export const Route = createFileRoute("/admin/presence")({
	component: AdminPresencePage,
});
