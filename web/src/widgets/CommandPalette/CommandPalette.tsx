import { type CmdItem, filterCommands } from "@shared/lib/hooks/cmd-filter";
import { CommandList } from "@shared/ui/command";
import { useThemeTransition } from "@shared/ui/theme-transition";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

/**
 * CommandPalette - 全局 Cmd/Ctrl+K 毛玻璃命令面板
 *
 * spec：全站检索 + 快捷切换主题（输入 > Dark）。
 * - Cmd/Ctrl+K 打开
 * - 命令清单：导航（首页/博客/关于/项目）+ 主题（暗/亮）
 * - 过滤走纯函数 filterCommands
 */
const CommandPalette = () => {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const navigate = useNavigate();
	const { toggle, theme } = useThemeTransition();

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setOpen((v) => !v);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	const all: CmdItem[] = useMemo(
		() => [
			{
				id: "nav-home",
				label: "首页",
				group: "navigation",
				keywords: ["home", "index"],
				run: () => navigate({ to: "/" }),
			},
			{
				id: "nav-blog",
				label: "博客",
				group: "navigation",
				keywords: ["blog", "posts"],
				run: () => navigate({ to: "/blog" }),
			},
			{
				id: "nav-about",
				label: "关于",
				group: "navigation",
				run: () => navigate({ to: "/about" }),
			},
			{
				id: "nav-projects",
				label: "项目",
				group: "navigation",
				run: () => navigate({ to: "/projects" }),
			},
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
			open={open}
			onOpenChange={setOpen}
			items={filtered}
			query={query}
			onQueryChange={setQuery}
		/>
	);
};

export default CommandPalette;
