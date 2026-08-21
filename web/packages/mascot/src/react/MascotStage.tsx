import { type Ref, useEffect, useRef } from "react";
import { DEFAULT_EMOTION_ID } from "../engine/emotions";
import { Mascot } from "../engine/mascot";
import type { AIMessage, AIMessageResult } from "../protocol";

/**
 * 引擎实例的命令式句柄:经 ref 暴露给宿主,驱动一次性动作与受控状态。
 */
export interface MascotHandle {
	/** 自旋一圈 */
	spin(): void;
	/** 弹跳一次 */
	bounce(): void;
	/** 摸头互动(飞机耳) */
	pet(): void;
	/** 撒花庆祝
	 *
	 * @param count - 粒子数,缺省 20
	 */
	burst(count?: number): void;
	/**
	 * 视线跟随。
	 *
	 * @param nx - 水平归一化 [-1, 1]
	 * @param ny - 垂直归一化 [-1, 1]
	 */
	setGaze(nx: number, ny: number): void;
	/**
	 * 手动偏航角(度):调试通道,直接叠加在自旋结果上。
	 */
	setDevYaw(deg: number): void;
	/** 切换表情;未知 ID 回退待机 */
	setEmotion(id: string): void;
	/**
	 * AI 消息协议入口:未知 emotionId 回退待机。
	 *
	 * @returns 解析结果(回退后的 emotionId + 透传台词),供外部同步固定选中与台词
	 */
	handleAIMessage(msg: AIMessage): AIMessageResult;
}

/**
 * MascotStage 的 props。
 */
export interface MascotStageProps {
	/** 受控表情 ID */
	emotion: string;
	/** 冻结为静态快照(目录缩略卡用),不启动动画循环 */
	frozen?: boolean;
	/** 点击身体回调 */
	onClick?: () => void;
	/** 摸头回调 */
	onPet?: () => void;
	/** handleAIMessage 带台词时回调,供对白气泡消费 */
	onTips?: (tips: string | undefined) => void;
	/** 命令式句柄(React 19 ref-as-prop) */
	ref?: Ref<MascotHandle>;
	/** 透传给宿主容器的类名 */
	className?: string;
}

/**
 * Mascot 引擎的 React 宿主:挂载单例、桥接受控 emotion 与命令式 handle。
 *
 * onTips 在 handleAIMessage 带台词时回调,供外部对白气泡消费。
 */
export function MascotStage({
	emotion,
	frozen = false,
	onClick,
	onPet,
	onTips,
	ref,
	className,
}: MascotStageProps) {
	const hostRef = useRef<HTMLDivElement>(null);
	const mascotRef = useRef<Mascot | null>(null);
	const tipsRef = useRef(onTips);
	tipsRef.current = onTips;

	// biome-ignore lint/correctness/useExhaustiveDependencies: 实例仅建一次,后续变化走 setEmotion
	useEffect(() => {
		if (!hostRef.current) return;
		const m = new Mascot(hostRef.current, { emotion, frozen, onClick, onPet });
		mascotRef.current = m;
		return () => {
			m.destroy();
			mascotRef.current = null;
		};
	}, []);

	useEffect(() => {
		mascotRef.current?.setEmotion(emotion);
	}, [emotion]);
	useEffect(() => {
		if (!ref) return;
		const handle: MascotHandle = {
			spin: () => mascotRef.current?.spinTurns(1),
			bounce: () => mascotRef.current?.bounce(),
			pet: () => mascotRef.current?.pet(1200),
			burst: (count = 20) => mascotRef.current?.burst(count),
			setGaze: (nx: number, ny: number) => mascotRef.current?.setGaze(nx, ny),
			setDevYaw: (deg: number) => mascotRef.current?.setDevYaw(deg),
			setEmotion: (id) => mascotRef.current?.setEmotion(id),
			handleAIMessage: (msg) => {
				const id = msg.emotionId?.trim();
				const resolved = id && id.length > 0 ? id : DEFAULT_EMOTION_ID;
				mascotRef.current?.setEmotion(resolved);
				return { emotionId: resolved, ...(msg.tips !== undefined && { tips: msg.tips }) };
			},
		};
		if (typeof ref === "function") ref(handle);
		else ref.current = handle;
		return () => {
			if (typeof ref === "function") ref(null as never);
			else ref.current = null;
		};
	}, [ref]);

	return <div ref={hostRef} data-emotion={emotion} className={className} />;
}
