import { useAppearanceSwitcher } from "@features/appearance";
import { useSearchPosts } from "@features/posts/api/queries";
import { useDecorationSwitcher } from "@features/seasonal-decor/hooks/useDecorationSwitcher";
import {
	decorationChoiceTitle,
	THEME_CHOICES,
	themeChoiceTitle,
	useThemeSwitcher,
} from "@features/theme-switcher";
import { flattenNavLinks } from "@shared/config/nav";
import { DECORATION_PREFERENCES } from "@shared/lib/decoration-preference";
import { THEME_PRESETS } from "@shared/lib/theme-presets";
import { useNavigate } from "@tanstack/react-router";
import { type CommandGroup, type CommandItem, CommandList } from "@violet/ui";
import { Compass, FileText, Palette, Sparkles, SunMoon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useCommandUIStore } from "./command-ui-store";

const GROUPS: CommandGroup[] = [
	{ id: "posts", label: "文章" },
	{ id: "pages", label: "页面" },
	{ id: "commands", label: "命令" },
	{ id: "fulltext", label: "全文" },
];

/** 输入停顿多久才去服务端搜，避免每次击键都打后端。 */
const SEARCH_DEBOUNCE_MS = 250;
/** 两个字以上才去正文里搜。 */
const FULL_TEXT_MIN = 2;

/**
 * 全局 ⌘K / Ctrl K 命令面板：同一个输入框搜文章、跳页面、切换外观主题与装饰。
 *
 * @remarks 显隐状态走 useCommandUIStore，与顶栏的搜索按钮共享。服务端结果标题含输入的归入「文章」，只在正文命中的归入「全文」。
 */
const CommandPalette = () => {
	const isOpen = useCommandUIStore((s) => s.isOpen);
	const close = useCommandUIStore((s) => s.close);
	const toggleOpen = useCommandUIStore((s) => s.toggle);
	const [query, setQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const navigate = useNavigate();
	const { appearance, switchAppearance } = useAppearanceSwitcher();
	const { switchTheme } = useThemeSwitcher();
	const { switchDecoration } = useDecorationSwitcher();
	const { data: searchData, isFetching } = useSearchPosts(debouncedQuery);

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [query]);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				toggleOpen();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [toggleOpen]);

	// 关闭时清空输入，下次打开不残留上次查询
	useEffect(() => {
		if (!isOpen) {
			setQuery("");
			setDebouncedQuery("");
		}
	}, [isOpen]);

	const localItems = useMemo<CommandItem[]>(
		() => [
			...flattenNavLinks().map((link) => ({
				id: `page-${link.to}`,
				label: link.label,
				group: "pages",
				keywords: [link.to],
				icon: <Compass />,
				onSelect: ({ newTab }: { newTab: boolean }) => {
					if (newTab) {
						window.open(link.to, "_blank", "noopener");
					} else {
						void navigate({ to: link.to });
					}
				},
			})),
			{
				id: "cmd-appearance",
				label: "切换明暗",
				group: "commands",
				keywords: ["appearance", "dark", "light", "外观", "亮色", "暗黑"],
				icon: <SunMoon />,
				children: (
					[
						["light", "亮色"],
						["dark", "暗黑"],
						["system", "跟随系统"],
					] as const
				).map(([value, label]) => ({
					id: `appearance-${value}`,
					label,
					group: "",
					onSelect: () => {
						if (appearance !== value) switchAppearance(value);
					},
				})),
			},
			{
				id: "cmd-theme",
				label: "切换主题",
				group: "commands",
				keywords: ["theme", "season", "主题", "季节"],
				icon: <Palette />,
				children: THEME_CHOICES.map((preference) => ({
					id: `theme-${preference}`,
					label: themeChoiceTitle(preference),
					group: "",
					keywords:
						preference === "follow"
							? ["follow"]
							: [THEME_PRESETS[preference].label, THEME_PRESETS[preference].name],
					onSelect: () => void switchTheme(preference),
				})),
			},
			{
				id: "cmd-decoration",
				label: "切换装饰",
				group: "commands",
				keywords: ["decoration", "装饰", "落花"],
				icon: <Sparkles />,
				children: DECORATION_PREFERENCES.map((preference) => ({
					id: `decoration-${preference}`,
					label: decorationChoiceTitle(preference),
					group: "",
					onSelect: () => void switchDecoration(preference),
				})),
			},
		],
		[navigate, appearance, switchAppearance, switchTheme, switchDecoration],
	);

	const items = useMemo<CommandItem[]>(() => {
		const needle = query.trim().toLowerCase();
		const posts = (searchData?.data ?? []).map((post) => {
			const inTitle = post.title.toLowerCase().includes(needle);
			return {
				id: `post-${post.id}`,
				label: post.title,
				// 标题含输入的按标题匹配，只在正文命中的归入全文并带上摘要
				group: inTitle ? "posts" : "fulltext",
				filter: inTitle,
				description: inTitle ? undefined : post.snippet,
				icon: <FileText />,
				onSelect: ({ newTab }: { newTab: boolean }) => {
					if (newTab) {
						window.open(`/blog/${post.slug}`, "_blank", "noopener");
					} else {
						void navigate({ to: "/blog/$slug", params: { slug: post.slug } });
					}
				},
			};
		});
		return [...posts, ...localItems];
	}, [localItems, query, searchData, navigate]);

	// 防抖等待与请求都算在搜
	const searching =
		query.trim().length >= FULL_TEXT_MIN &&
		(isFetching || query.trim() !== debouncedQuery.trim());

	return (
		<CommandList
			open={isOpen}
			onOpenChange={(next) => {
				if (!next) close();
			}}
			items={items}
			groups={GROUPS}
			fullTextGroup="fulltext"
			query={query}
			onQueryChange={setQuery}
			searching={searching}
		/>
	);
};

export default CommandPalette;
