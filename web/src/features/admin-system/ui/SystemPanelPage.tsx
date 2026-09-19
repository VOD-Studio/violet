import { PageShell } from "@features/admin-layout/ui/PageShell";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { Segmented, type SegmentedItem } from "@shared/ui/segmented";
import { ArchiveRestore, Database, FileDown, ServerCog, SquareTerminal } from "lucide-react";
import { useState } from "react";
import { BackupRestoreTab } from "./BackupRestoreTab";
import { DatabaseStatusTab } from "./DatabaseStatusTab";
import { DataExportTab } from "./DataExportTab";
import { ServerStatusTab } from "./ServerStatusTab";
import { SQLConsoleTab } from "./SQLConsoleTab";

type SystemPanelTab = "database" | "server" | "sql" | "export" | "backup";

const viewTabs: SegmentedItem<SystemPanelTab>[] = [
	{
		value: "database",
		label: (
			<>
				<Database className="size-3.5" />
				数据库
			</>
		),
	},
	{
		value: "server",
		label: (
			<>
				<ServerCog className="size-3.5" />
				服务器状态
			</>
		),
	},
];

const manageTabs: SegmentedItem<SystemPanelTab>[] = [
	{
		value: "sql",
		label: (
			<>
				<SquareTerminal className="size-3.5" />
				SQL 控制台
			</>
		),
	},
	{
		value: "export",
		label: (
			<>
				<FileDown className="size-3.5" />
				数据导出
			</>
		),
	},
	{
		value: "backup",
		label: (
			<>
				<ArchiveRestore className="size-3.5" />
				备份与恢复
			</>
		),
	},
];

/** 管理后台系统面板，按权限展示只读诊断与高风险维护页签。 */
export function SystemPanelPage() {
	const canView = useHasPermission("system:view");
	const canManage = useHasPermission("system:manage");
	const [selectedTab, setSelectedTab] = useState<SystemPanelTab>("database");
	const tabs = [...(canView ? viewTabs : []), ...(canManage ? manageTabs : [])];
	const activeTab = tabs.some((tab) => tab.value === selectedTab)
		? selectedTab
		: (tabs[0]?.value ?? "database");

	return (
		<PageShell
			title="系统面板"
			description="集中查看运行状态，并在明确授权下执行数据库维护。"
			sticky={
				tabs.length > 0 ? (
					<div className="mt-3 overflow-x-auto pb-0.5">
						<Segmented
							value={activeTab}
							onValueChange={setSelectedTab}
							segments={tabs}
							size="default"
						/>
					</div>
				) : undefined
			}
		>
			{tabs.length === 0 ? (
				<div className="text-muted-foreground flex flex-1 items-center justify-center py-20 text-sm">
					当前账号没有系统面板权限
				</div>
			) : (
				<SystemPanelContent tab={activeTab} />
			)}
		</PageShell>
	);
}

function SystemPanelContent({ tab }: { tab: SystemPanelTab }) {
	switch (tab) {
		case "database":
			return <DatabaseStatusTab />;
		case "server":
			return <ServerStatusTab />;
		case "sql":
			return <SQLConsoleTab />;
		case "export":
			return <DataExportTab />;
		case "backup":
			return <BackupRestoreTab />;
	}
}
