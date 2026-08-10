import { useSearchPosts } from "@features/posts/api/queries";
import { NAV_ITEMS, type NavItem } from "@shared/config/nav";
import { type CmdItem, filterCommands } from "@shared/lib/hooks/cmd-filter";
import { CommandList } from "@shared/ui/command";
import { useNavigate } from "@tanstack/react-router";
import { useThemeSwitcher } from "@widgets/ThemeToggle/variants/use-theme-switcher";
import { useEffect, useMemo, useState } from "react";

import { useCommandUIStore } from "./command-ui-store";

/** 分组中文名映射 */
const GROUP_LABELS: Record<string, string> = {
	posts: "文章",
	navigation: "导航",
	theme: "主题",
};

/**
 * CommandPalette - 全局 Cmd/Ctrl+K 搜索 + 命令面板
 *
 * 双模态：输入 ≥ 2 字符触发服务端文章搜索（debounce 250ms），同时本地过滤
 * 导航/主题命令。文章结果来自服务端（已按 query 检索），不再经 filterCommands
 * 二次过滤——query 可能命中正文而非标题，本地过滤会误删结果。
 * - Cmd/Ctrl+K 打开（也可由 HeaderActions 搜索按钮 open()）
 * - 导航命令派生自 NAV_ITEMS（与 Header nav 同源）；主题切换为面板独有
 *
 * 显隐状态走 useCommandUIStore（与 HeaderActions 共享）。
 */
const CommandPalette = () => {
	const isOpen = useCommandUIStore((s) => s.isOpen);
	const close = useCommandUIStore((s) => s.close);
	const toggleOpen = useCommandUIStore((s) => s.toggle);
	const [query, setQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const navigate = useNavigate();
	const { theme, switchTheme } = useThemeSwitcher();
	const { data: searchData, isFetching } = useSearchPosts(debouncedQuery);

	// 输入防抖：避免每次击键都打后端
	useEffect(() => {
		const t = setTimeout(() => setDebouncedQuery(query), 250);
		return () => clearTimeout(t);
	}, [query]);

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

	// 关闭时清空输入，避免下次打开残留上次查询
	useEffect(() => {
		if (!isOpen) {
			setQuery("");
			setDebouncedQuery("");
		}
	}, [isOpen]);

	// 本地命令：导航 + 主题（经 filterCommands 子串过滤）
	const localCommands: CmdItem[] = useMemo(
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
				id: "theme-light",
				label: "切换亮色主题",
				group: "theme",
				keywords: ["light", "day", "亮色"],
				run: () => {
					if (theme !== "light") switchTheme("light");
				},
			},
			{
				id: "theme-dark",
				label: "切换暗黑主题",
				group: "theme",
				keywords: ["dark", "night", "暗黑"],
				run: () => {
					if (theme !== "dark") switchTheme("dark");
				},
			},
			{
				id: "theme-system",
				label: "跟随系统主题",
				group: "theme",
				keywords: ["system", "auto", "跟随系统"],
				run: () => {
					if (theme !== "system") switchTheme("system");
				},
			},
		],
		[navigate, switchTheme, theme],
	);

	const filtered = useMemo(() => {
		// 文章结果来自服务端搜索，不经本地过滤
		const posts: CmdItem[] = (searchData?.data ?? []).map((p) => ({
			id: `post-${p.id}`,
			label: p.title,
			group: "posts",
			description: p.snippet,
			run: () => navigate({ to: "/blog/$slug", params: { slug: p.slug } }),
		}));
		// 文章结果在前，本地命令在后
		return [...posts, ...filterCommands(localCommands, query)];
	}, [localCommands, query, searchData, navigate]);
	// 文章搜索请求飞行中（关键词达查询阈值且请求未完成）
	const isSearching = debouncedQuery.trim().length >= 2 && isFetching;

	return (
		<CommandList
			open={isOpen}
			onOpenChange={(v) => (v ? null : close())}
			items={filtered}
			query={query}
			onQueryChange={setQuery}
			loading={isSearching}
			groupLabels={GROUP_LABELS}
		/>
	);
};

export default CommandPalette;
