import type { Announcement } from "@features/settings/model/types";
import { cn } from "@shared/lib/utils";
import { getAnnouncementSev } from "@shared/ui/announcement-severity";
import { useEffect, useRef, useState } from "react";
import { BANNER_NEON, BannerStage } from "./BannerStage";
import { usePrefersReducedMotion, useWheelStep } from "./use-banner-ticker";

const CHAR_MS = 45; // 打字每字耗时
const CLEAR_MS = 16; // 退格每字耗时（清屏快于打出）
const HOLD_MS = 2600; // 全显驻留

type Phase = "typing" | "holding" | "clearing";

/**
 * 横幅方向 D · 电传打字
 *
 * 公告像电传机逐字打在横幅上：打出 → 驻留（光标闪烁）→ 快速
 * 退格清屏 → 打下一条。节拍由文本长度自然决定，与全站终端
 * DNA（LandingHero / DecryptedText）同源。暂停冻结在当前
 * 字符；reduced-motion 下跳过打字直接整条显示。
 */
export function BannerTeletype({ items }: { items: Announcement[] }) {
	const [index, setIndex] = useState(0);
	const [chars, setChars] = useState(0);
	const [phase, setPhase] = useState<Phase>("typing");
	const [paused, setPaused] = useState(false);
	const reduced = usePrefersReducedMotion();

	// 状态机最新值进 ref：rAF 循环里读写，避免每帧重建循环
	const stateRef = useRef({ index, chars, phase });
	stateRef.current = { index, chars, phase };
	const accRef = useRef(0); // 当前阶段已积累 ms

	useEffect(() => {
		if (paused) return;
		let raf = 0;
		let last = performance.now();
		const advance = (dt: number) => {
			const s = stateRef.current;
			const total = items[s.index].content.length;
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
		const nextItem = () => {
			accRef.current = 0;
			setChars(0);
			setPhase("typing");
			setIndex((i) => (i + 1) % items.length);
		};
		const tick = (t: number) => {
			advance(t - last);
			last = t;
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [paused, items]);

	// reduced-motion：跳过打字/退格，直接整条驻留轮换
	useEffect(() => {
		if (!reduced) return;
		setChars(items[index].content.length);
		setPhase("holding");
	}, [reduced, index, items]);

	/** 手动翻页：清屏态切到下一条重新打（reduced 下直接整条） */
	const step = (dir: number) => {
		accRef.current = 0;
		const next = (index + dir + items.length) % items.length;
		setIndex(next);
		setChars(reduced ? items[next].content.length : 0);
		setPhase(reduced ? "holding" : "typing");
	};
	const wheelRef = useWheelStep(step);

	const current = items[index];
	const cfg = getAnnouncementSev(current.severity);
	const text = current.content.slice(0, chars);

	return (
		<BannerStage
			items={items}
			index={index}
			stageRef={wheelRef}
			onMouseEnter={() => setPaused(true)}
			onMouseLeave={() => setPaused(false)}
			onFocus={() => setPaused(true)}
			onBlur={() => setPaused(false)}
			className="h-7"
		>
			<div
				className={cn(
					"flex h-7 items-center justify-center gap-2 px-12",
					BANNER_NEON[current.severity] ?? BANNER_NEON.info,
				)}
			>
				<cfg.Icon className="size-3.5 shrink-0" />
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
			</div>
		</BannerStage>
	);
}
