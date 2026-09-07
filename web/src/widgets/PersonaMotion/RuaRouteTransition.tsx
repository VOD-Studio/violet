import { useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const SHOW_DELAY_MS = 140;
const MIN_VISIBLE_MS = 320;
const STAR_PATH = "polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%)";

function useDelayedRouteStatus(active: boolean): boolean {
	const [visible, setVisible] = useState(false);
	const visibleSince = useRef(0);

	useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | undefined;

		if (active && !visible) {
			timer = setTimeout(() => {
				visibleSince.current = Date.now();
				setVisible(true);
			}, SHOW_DELAY_MS);
		} else if (!active && visible) {
			const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - visibleSince.current));
			timer = setTimeout(() => setVisible(false), remaining);
		}

		return () => {
			if (timer) clearTimeout(timer);
		};
	}, [active, visible]);

	return visible;
}

/**
 * 在前台路由加载期间显示瑠爱主题的细线翻页提示。
 */
const RuaRouteTransition = () => {
	const isLoading = useRouterState({ select: (state) => state.isLoading });
	const pathname = useRouterState({ select: (state) => state.location.pathname });
	const reduceMotion = useReducedMotion();
	const visible = useDelayedRouteStatus(isLoading);
	const enabled = visible && !pathname.startsWith("/admin");

	return (
		<AnimatePresence>
			{enabled && (
				<motion.div
					className="pointer-events-none fixed inset-0 z-50"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: reduceMotion ? 0 : 0.18 }}
				>
					<div
						aria-hidden
						className="absolute inset-x-0 top-0 h-px overflow-hidden bg-border/45"
					>
						<motion.span
							className="absolute inset-y-0 left-0 w-1/3 bg-linear-to-r from-transparent via-(--persona-violet) to-(--persona-gold)"
							initial={reduceMotion ? { x: "0%" } : { x: "-110%" }}
							animate={reduceMotion ? { x: "0%" } : { x: "310%" }}
							transition={{
								duration: 0.82,
								ease: [0.22, 1, 0.36, 1],
								repeat: Number.POSITIVE_INFINITY,
							}}
						/>
						<motion.span
							className="absolute top-1/2 left-0 size-2 -translate-y-1/2 bg-(--persona-gold)"
							style={{ clipPath: STAR_PATH }}
							initial={reduceMotion ? { x: "50vw" } : { x: "-2vw" }}
							animate={reduceMotion ? { x: "50vw" } : { x: "102vw" }}
							transition={{
								duration: 1.12,
								ease: [0.22, 1, 0.36, 1],
								repeat: Number.POSITIVE_INFINITY,
							}}
						/>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
};

export default RuaRouteTransition;
