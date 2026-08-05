import { NAV_ITEMS, type NavItem } from "@shared/config/nav";
import { type CmdItem, filterCommands } from "@shared/lib/hooks/cmd-filter";
import { CommandList } from "@shared/ui/command";
import { useThemeTransition } from "@shared/ui/theme-transition";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { useCommandUIStore } from "./command-ui-store";

/**
 * CommandPalette - 全局 Cmd/Ctrl+K 毛玻璃命令面板
 *
 * spec：全站检索 + 快捷切换主题（输入 > Dark）。
 * - Cmd/Ctrl+K 打开（也可由 HeaderActions 命令按钮 open()）
 * - 导航命令派生自 NAV_ITEMS（与 Header 桌面/移动端 nav 同源），避免新增路由时漂移
 * - 主题切换为面板独有，单独补充
 * - 过滤走纯函数 filterCommands
 *
 * 显隐状态走 useCommandUIStore（与 HeaderActions 共享，同 MusicUIStore 模式）。
 */
const CommandPalette = () => {
	const isOpen = useCommandUIStore((s) => s.isOpen);
	const close = useCommandUIStore((s) => s.close);
	const toggleOpen = useCommandUIStore((s) => s.toggle);
	const [query, setQuery] = useState("");
	const navigate = useNavigate();
	const { toggle, theme } = useThemeTransition();

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				toggleOpen();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [toggleOpen]);

	const all: CmdItem[] = useMemo(
		() => [
			// 导航：仅取 route 项（action 项由 Header 解释，面板不承接）
			...NAV_ITEMS.filter(
				(item): item is Extract<NavItem, { type: "route" }> => item.type === "route",
			).map((item) => ({
				id: `nav-${item.to}`,
				label: item.label,
				group: "navigation",
				run: () => navigate({ to: item.to }),
			})),
			{
				id: "theme-dark",
				label: "切换暗色主题",
				group: "theme",
				keywords: ["dark", "night"],
				run: () => {
					if (theme !== "dark") toggle();
				},
			},
			{
				id: "theme-light",
				label: "切换亮色主题",
				group: "theme",
				keywords: ["light", "day"],
				run: () => {
					if (theme === "dark") toggle();
				},
			},
		],
		[navigate, toggle, theme],
	);

	const filtered = useMemo(() => filterCommands(all, query), [all, query]);

	return (
		<CommandList
			open={isOpen}
			onOpenChange={(v) => (v ? null : close())}
			items={filtered}
			query={query}
			onQueryChange={setQuery}
		/>
	);
};

export default CommandPalette;
