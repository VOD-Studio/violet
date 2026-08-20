import { type Ref, useEffect, useRef } from "react";
import type { EmotionDef } from "../../engine/expressions";
import { Mascot } from "../../engine/mascot";

export interface MascotHandle {
	spin(): void;
	bounce(): void;
	pet(): void;
	burst(count?: number): void;
	setGaze(nx: number, ny: number): void;
	setEmotion(id: string): void;
	/** AI 消息协议入口:未知 emotionId 回退待机,返回解析结果供外部同步固定选中与台词 */
	handleAIMessage(msg: AIMessage): AIMessageResult;
}

export interface AIMessage {
	emotionId?: string;
	tips?: string;
}

export type AIMessageResult = { emotionId: string; tips?: string };

interface MascotStageProps {
	emotion: string;
	frozen?: boolean;
	onClick?: () => void;
	onPet?: () => void;
	onTips?: (tips: string | undefined) => void;
	ref?: Ref<MascotHandle>;
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
			setEmotion: (id) => mascotRef.current?.setEmotion(id),
			handleAIMessage: (msg) => {
				const id = msg.emotionId?.trim();
				const resolved = id && id.length > 0 ? id : "00";
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

	return <div ref={hostRef} className={className} />;
}

/** 分组元数据:标题与 segment 定义同源,目录与舞台状态签共用。 */
export const GROUP_LABEL: Record<EmotionDef["group"], string> = {
	lifecycle: "猫猫日常",
	emotion: "喜怒哀乐",
	agent: "工作模式",
};
