/**
 * AnnouncementBar - 生产公告浮条
 *
 * 数据、已读与定位的薄适配层：把 announcement-bar 单元悬在导航正下方，
 * 多条用淡入淡出轮换，悬停或聚焦时暂停。
 *
 * 不变约束：
 * - 排序权威是后端返回顺序（sort_order ASC, created_at DESC），前端不重排
 * - 关闭即把当前可见的公告 id 记为已读（localStorage，不跨设备同步），
 *   新 id 出现才重现
 * - WCAG 2.2.2：hover/focus 暂停轮换；prefers-reduced-motion 下不轮换，
 *   直接整条静态展示
 */

import { useAnnouncements } from "@features/settings/api/queries";
import { useBannerTicker, usePrefersReducedMotion } from "@shared/hooks/use-banner-ticker";
import { AnnouncementBar as AnnouncementBarUnit } from "@violet/ui";
import { cn } from "cn";
import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "announcement:read-ids";
/** Header 的视觉高度：pt-2.5 + 药丸 h-10 + pb-1 */
const HEADER_HEIGHT = 54;
/** 与设计稿一致：离导航 8px */
const TOP_GAP = 8;
/** 每条公告的驻留时长 */
const ROTATE_MS = 6000;
/** 淡出到可以换下一条的时长，与浮条自身 180ms 的淡入区分开 */
const LEAVE_MS = 150;

/** 读取已读 id 集合 */
function readReadIds(): Set<number> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return new Set();
		return new Set(JSON.parse(raw).map(Number));
	} catch {
		return new Set();
	}
}

/** 写入已读 id 集合；localStorage 不可用时静默降级 */
function writeReadIds(ids: Set<number>) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
	} catch {
		/* 隐私模式等场景下只是这次不记，下次仍会显示 */
	}
}

/** 淡出中要提交的动作：切到下一条，或关闭后记已读 */
type Pending = number | "close";

export default function AnnouncementBar() {
	const { data } = useAnnouncements();
	const reduced = usePrefersReducedMotion();
	const [readIds, setReadIds] = useState<Set<number>>(() => readReadIds());
	const [shownIndex, setShownIndex] = useState(0);
	const [pending, setPending] = useState<Pending | null>(null);
	// 已读标记在 localStorage（客户端概念），SSR 与 hydration 首帧不渲染
	// 浮条——否则先渲染出的条会在 hydration 读到已读后被移除，闪现空壳
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	// useMemo 稳定引用：下面两个 effect 依赖它，不稳定的 filter 产物会反复重启
	const banners = useMemo(
		() => (data ?? []).filter((a) => a.display === "banner").filter((a) => !readIds.has(a.id)),
		[data, readIds],
	);

	const { index, hoverHandlers } = useBannerTicker(banners.length, ROTATE_MS);

	// 轮换：先把当前条淡出，再换内容，由新条自己的 180ms 淡入接手
	useEffect(() => {
		if (banners.length === 0) return;
		const target = index % banners.length;
		if (target === shownIndex) return;
		setPending((current) => current ?? target);
	}, [index, shownIndex, banners.length]);

	// 列表收窄（已读变化、数据刷新）后回落到第一条
	useEffect(() => {
		if (shownIndex >= banners.length) setShownIndex(0);
	}, [banners.length, shownIndex]);

	// 淡出结束再提交：换内容或写入已读。减弱动态下没有淡出，立即提交
	useEffect(() => {
		if (pending === null) return;
		const timer = setTimeout(
			() => {
				if (pending === "close") {
					const ids = new Set([...readIds, ...banners.map((a) => a.id)]);
					setReadIds(ids);
					writeReadIds(ids);
					setShownIndex(0);
				} else {
					setShownIndex(pending);
				}
				setPending(null);
			},
			reduced ? 0 : LEAVE_MS,
		);
		return () => clearTimeout(timer);
	}, [pending, readIds, banners, reduced]);

	if (!mounted) return null;
	const current = banners[Math.min(shownIndex, banners.length - 1)];
	if (!current) return null;
	const link = current.link_url
		? { href: current.link_url, label: current.link_text?.trim() || "查看详情" }
		: undefined;

	return (
		<div
			// Header 是 sticky 的，浮条按页首的导航高度钉在它下面；不占高度，也不拦截周围点击
			style={{ top: HEADER_HEIGHT + TOP_GAP, viewTransitionName: "announcement-bar" }}
			className={cn(
				"pointer-events-none absolute left-1/2 z-30 flex w-fit max-w-[min(35rem,calc(100%_-_2rem))] -translate-x-1/2 justify-center",
				pending !== null &&
					"opacity-0 transition-opacity duration-150 ease-out motion-reduce:transition-none",
			)}
			{...hoverHandlers}
		>
			<AnnouncementBarUnit
				// 换条即重新挂载，复用它自己的淡入
				key={current.id}
				className="pointer-events-auto"
				content={current.content}
				link={link}
				severity={current.severity}
				onClose={() => setPending("close")}
			/>
		</div>
	);
}
