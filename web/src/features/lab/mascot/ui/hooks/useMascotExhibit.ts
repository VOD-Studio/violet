import { useEffect, useRef, useState } from "react";
import { EMOTION_MAP, EMOTIONS, type EmotionDef } from "../../engine/expressions";

/** 台词:来自表情 desc 或 AI 消息 tips,带代际计数——新一轮台词到达时重挂气泡重播动画。 */
export interface BubbleLine {
	text: string;
	gen: number;
}

/**
 * 吉祥物实验室的展馆状态机:固定选中 + 巡演 + 台词代际。
 *
 * 手动点选结束巡演并同步分组;台词随表情切换推陈。
 */
export function useMascotExhibit() {
	const [pinnedId, setPinnedId] = useState("26");
	const [group, setGroup] = useState<EmotionDef["group"]>("emotion");
	const [isTouring, setIsTouring] = useState(false);
	const [bubble, setBubble] = useState<BubbleLine>(() => ({
		text: (EMOTION_MAP.get("26") ?? EMOTIONS[0]).desc,
		gen: 0,
	}));
	const tourTimerRef = useRef<number | undefined>(undefined);
	const genRef = useRef(0);

	const emotionId = pinnedId;
	const def = EMOTION_MAP.get(emotionId) ?? EMOTIONS[0];
	const pinnedDef = EMOTION_MAP.get(pinnedId) ?? EMOTIONS[0];
	const groupList = EMOTIONS.filter((e) => e.group === group);

	/** AI 消息携带的台词:def.id 副作用检测到它时跳过默认 desc,避免覆盖 tips */
	const aiTipsRef = useRef<string | null>(null);

	const pushBubble = (text: string) => {
		genRef.current += 1;
		setBubble({ text, gen: genRef.current });
	};

	const stopTour = () => {
		clearInterval(tourTimerRef.current);
		tourTimerRef.current = undefined;
		setIsTouring(false);
	};

	const toggleTour = () => {
		if (isTouring) {
			stopTour();
			return;
		}
		setIsTouring(true);
		tourTimerRef.current = window.setInterval(() => {
			setPinnedId((prev) => {
				const curIdx = EMOTIONS.findIndex((e) => e.id === prev);
				return EMOTIONS[(curIdx + 1) % EMOTIONS.length].id;
			});
		}, 3200);
	};

	// 表情切换推默认台词;AI 消息路径先落 tips 再切 id,effect 检测到 tips 让位
	// biome-ignore lint/correctness/useExhaustiveDependencies: def.id 是触发键,desc/pushBubble 随 id 走
	useEffect(() => {
		if (aiTipsRef.current !== null) {
			const tips = aiTipsRef.current;
			aiTipsRef.current = null;
			pushBubble(tips);
			return;
		}
		pushBubble(def.desc);
	}, [def.id]);

	useEffect(() => {
		return () => {
			clearInterval(tourTimerRef.current);
		};
	}, []);

	/** 手动点选:固定 + 带回所属分组 + 结束巡演 */
	const selectEmotion = (id: string) => {
		setPinnedId(id);
		const g = EMOTION_MAP.get(id)?.group;
		if (g) setGroup(g);
		if (isTouring) stopTour();
	};

	/** AI 消息落定:固定选中 + 台词覆盖 + 结束巡演(tips 经 aiTipsRef 传递,防被 desc 副作用覆盖) */
	const applyAIMessage = (emotionId: string, tips?: string) => {
		aiTipsRef.current = tips !== undefined ? tips : null;
		selectEmotion(emotionId);
		if (tips !== undefined) pushBubble(tips);
	};

	return {
		emotionId,
		def,
		pinnedDef,
		group,
		groupList,
		setGroup,
		isTouring,
		toggleTour,
		bubble,
		pushBubble,
		selectEmotion,
		applyAIMessage,
	};
}
