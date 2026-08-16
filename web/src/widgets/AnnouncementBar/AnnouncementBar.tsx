/**
 * AnnouncementBar - 生产公告横幅（电传打字形态）
 *
 * 公告实验室选型落地：电传打字方向（/lab/announcement）升为现役。
 * 公告像电传机逐字打上横幅：打出 → 驻留（光标闪烁）→ 快速退格
 * 清屏 → 打下一条，节拍由文本长度自然决定。
 *
 * 不变约束（见 CONTEXT.md）：
 * - 排序权威是后端返回顺序（sort_order ASC, created_at DESC），前端不重排
 * - 关闭即标记当前可见全部 id 为已读（localStorage），新 id 出现才重现
 * - WCAG 2.2.2：hover/focus 暂停打字、滚轮手动翻（原生非被动监听 +
 *   全量 delta 拦截 + 400ms 冷却，触控板惯性不穿透），prefers-reduced-motion
 *   下降级为静态整条展示
 */

import { BANNER_NEON } from "@features/lab/announcement/ui/BannerStage";
import {
	usePrefersReducedMotion,
	useWheelStep,
} from "@features/lab/announcement/ui/use-banner-ticker";
import { useAnnouncements } from "@features/settings/api/queries";
import { cn } from "@shared/lib/utils";
import { getAnnouncementSev } from "@shared/ui/announcement-severity";
import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "announcement:read-ids";
const CHAR_MS = 45; // 打字每字耗时
const CLEAR_MS = 16; // 退格每字耗时（清屏快于打出）
const HOLD_MS = 2600; // 全显驻留

type Phase = "typing" | "holding" | "clearing";

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

export default function AnnouncementBar() {
	const { data } = useAnnouncements();
	const reduced = usePrefersReducedMotion();
	const [readIds, setReadIds] = useState<Set<number>>(() => readReadIds());

	// useMemo 稳定引用：rAF 节拍 effect 依赖 banners，不稳定的 filter
	// 产物会每帧重启循环
	const banners = useMemo(
		() => (data ?? []).filter((a) => a.display === "banner").filter((a) => !readIds.has(a.id)),
		[data, readIds],
	);

	const [index, setIndex] = useState(0);
	const [chars, setChars] = useState(0);
	const [phase, setPhase] = useState<Phase>("typing");
	const [paused, setPaused] = useState(false);
	// 已读标记在 localStorage（客户端概念），SSR 与 hydration 首帧不渲染
	// 横幅——否则 SSR 渲染的条会在 hydration 读到已读后被移除，闪现空壳
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	// 打字状态机最新值进 ref：rAF 循环里读写，避免每帧重建循环
	const stateRef = useRef({ index, chars, phase });
	stateRef.current = { index, chars, phase };
	const accRef = useRef(0); // 当前阶段已积累 ms

	const current = banners[index];

	// 首条公告跳过打字机直接全显：数据到达的瞬间条已是完整内容，
	// 不出现「空深条 + 光标」的空壳开场；打字动画留给后续轮换
	const bootedRef = useRef(false);
	useEffect(() => {
		if (bootedRef.current || banners.length === 0) return;
		bootedRef.current = true;
		setChars(banners[0].content.length);
		setPhase("holding");
	}, [banners]);

	// 打字节拍：rAF 累积 dt 推进状态机，暂停即冻结（reduced 下不跑）
	useEffect(() => {
		if (paused || reduced || banners.length <= 1) return;
		let raf = 0;
		let last = performance.now();
		const nextItem = () => {
			accRef.current = 0;
			setChars(0);
			setPhase("typing");
			setIndex((i) => (i + 1) % banners.length);
		};
		const advance = (dt: number) => {
			const s = stateRef.current;
			const total = banners[s.index].content.length;
			accRef.current += dt;
			if (s.phase === "typing" && accRef.current >= CHAR_MS) {
				accRef.current -= CHAR_MS;
				const next = s.chars + 1;
				if (next >= total) {
					setChars(total);
					setPhase("holding");
					accRef.current = 0;
				} else {
					setChars(next);
				}
			} else if (s.phase === "holding" && accRef.current >= HOLD_MS) {
				accRef.current = 0;
				if (total > 0) {
					setPhase("clearing");
				} else {
					nextItem();
				}
			} else if (s.phase === "clearing" && accRef.current >= CLEAR_MS) {
				accRef.current -= CLEAR_MS;
				const next = s.chars - 1;
				if (next <= 0) {
					nextItem();
				} else {
					setChars(next);
				}
			}
		};
		const tick = (t: number) => {
			advance(t - last);
			last = t;
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [paused, reduced, banners]);

	// reduced-motion：跳过打字/退格，直接整条驻留轮换
	useEffect(() => {
		if (!reduced || !current) return;
		setChars(current.content.length);
		setPhase("holding");
	}, [reduced, current]);

	// 重置 index 防越界
	useEffect(() => {
		if (index >= banners.length) setIndex(0);
	}, [banners.length, index]);

	/** 手动翻页：清屏态切到下一条重新打（reduced 下直接整条） */
	const step = (dir: number) => {
		if (banners.length <= 1) return;
		accRef.current = 0;
		const next = (index + dir + banners.length) % banners.length;
		setIndex(next);
		setChars(reduced ? banners[next].content.length : 0);
		setPhase(reduced ? "holding" : "typing");
	};
	const barRef = useWheelStep(step);

	const handleClose = () => {
		const ids = banners.map((a) => a.id);
		const next = new Set([...readIds, ...ids]);
		setReadIds(next);
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
		} catch {
			/* localStorage 不可用时静默降级 */
		}
	};

	if (!mounted || !current) return null;
	const cfg = getAnnouncementSev(current.severity);
	const text = current.content.slice(0, chars);

	return (
		<div
			ref={barRef}
			style={{ viewTransitionName: "announcement-bar" }}
			className="relative flex h-7 items-center justify-center gap-2 border-b border-edge-hairline bg-primary/95 px-12 font-mono text-xs dark:bg-zinc-900"
			onMouseEnter={() => setPaused(true)}
			onMouseLeave={() => setPaused(false)}
			onFocus={() => setPaused(true)}
			onBlur={() => setPaused(false)}
		>
			<cfg.Icon
				className={cn(
					"size-3.5 shrink-0",
					BANNER_NEON[current.severity] ?? BANNER_NEON.info,
				)}
			/>
			<span className="truncate text-primary-foreground dark:text-foreground">
				{text}
				{/* 光标：打字/清屏时常亮，驻留时闪烁 */}
				<span
					aria-hidden
					className={cn(
						"ml-0.5 inline-block h-[0.95em] w-[0.5em] translate-y-[0.1em] bg-current motion-safe:animate-caret-blink",
						phase !== "holding" && "motion-safe:animate-none",
					)}
				/>
			</span>
			<span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[10px] text-primary-foreground/50 dark:text-foreground/50">
				{index + 1}/{banners.length}
			</span>
			<button
				type="button"
				onClick={handleClose}
				aria-label="关闭公告"
				className="absolute top-1/2 right-3 z-10 -translate-y-1/2 text-primary-foreground/70 transition-colors hover:text-primary-foreground dark:text-foreground/70 dark:hover:text-foreground"
			>
				✕
			</button>
		</div>
	);
}
