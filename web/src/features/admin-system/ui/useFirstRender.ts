import { useEffect, useRef, useState } from "react";

/** 动画播放时长（ms），与各图表 animationDuration 一致 */
const FIRST_ANIM_DURATION = 1200;

/**
 * useFirstRender - 标记「首次有效渲染」hook
 *
 * 用于 recharts 图表的首屏动画控制：recharts 每次数据变化都会重画整条曲线
 * （feature request #5547 未解决），高频轮询下开着 isAnimationActive 会持续抖动。
 *
 * 用法：传入数据，hook 在「首次拿到非空数据」后返回 true 并保持一个动画周期，
 * 供 isAnimationActive 播放完整首屏动画；动画结束后恒返回 false，轮询刷新走静态。
 *
 * @param data 当前数据
 * @param hasData 判断数据是否有效的函数（默认检查数组非空）
 * @returns 是否处于首屏动画期（isAnimationActive 的值）
 */
export function useFirstRender<T>(
	data: T,
	hasData: (data: T) => boolean = (d) => Array.isArray(d) && d.length > 0,
): boolean {
	// isFirst 在「首次有数据」后置 true，动画结束后置 false，之后不再变 true
	const [isFirst, setIsFirst] = useState(true);
	const playedRef = useRef(false);

	useEffect(() => {
		if (playedRef.current) return;
		if (hasData(data)) {
			playedRef.current = true;
			// 保持 true 一个动画周期，让 recharts 播完整首屏动画，之后转静态
			const timer = setTimeout(() => setIsFirst(false), FIRST_ANIM_DURATION);
			return () => clearTimeout(timer);
		}
	}, [data, hasData]);

	return isFirst;
}
