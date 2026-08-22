import { EMOTION_MAP, EMOTIONS, type EmotionDef } from "@violet/mascot";
import { useEffect, useRef, useState } from "react";

export type MascotGroupFilter = EmotionDef["group"] | "all";

/** 分组标题，供状态库与舞台状态标签共用。 */
export const GROUP_LABEL: Record<EmotionDef["group"], string> = {
	lifecycle: "猫猫日常",
	emotion: "喜怒哀乐",
	agent: "工作模式",
};

/** 新台词抵达时递增 gen，让气泡重新播放入场动画。 */
export interface BubbleLine {
	text: string;
	gen: number;
}

/** 吉祥物展馆提供给工作台的状态与动作。 */
export interface MascotExhibitState {
	def: EmotionDef;
	pinnedDef: EmotionDef;
	group: MascotGroupFilter;
	groupList: EmotionDef[];
	selectGroup: (group: MascotGroupFilter) => void;
	isTouring: boolean;
	toggleTour: () => void;
	replay: () => void;
	bubble: BubbleLine;
	selectEmotion: (id: string) => void;
	applyAIMessage: (emotionId: string, tips?: string) => void;
}

/** 管理固定状态、分组筛选、自动巡演与台词代际。 */
export function useMascotExhibit(): MascotExhibitState {
	const [pinnedId, setPinnedId] = useState("08");
	const [group, setGroup] = useState<MascotGroupFilter>("all");
	const [isTouring, setIsTouring] = useState(false);
	const [bubble, setBubble] = useState<BubbleLine>(() => ({
		text: (EMOTION_MAP.get("08") ?? EMOTIONS[0]).desc,
		gen: 0,
	}));
	const tourTimerRef = useRef<number | undefined>(undefined);
	const generationRef = useRef(0);
	const aiTipsRef = useRef<string | null>(null);

	const pinnedDef = EMOTION_MAP.get(pinnedId) ?? EMOTIONS[0];
	const def = pinnedDef;
	const groupList =
		group === "all" ? EMOTIONS : EMOTIONS.filter((emotion) => emotion.group === group);

	const pushBubble = (text: string) => {
		generationRef.current += 1;
		setBubble({ text, gen: generationRef.current });
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
			setPinnedId((previousId) => {
				const currentIndex = EMOTIONS.findIndex((emotion) => emotion.id === previousId);
				const next = EMOTIONS[(currentIndex + 1) % EMOTIONS.length];
				setGroup((currentGroup) => (currentGroup === "all" ? currentGroup : next.group));
				return next.id;
			});
		}, 3200);
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: def.id 是台词切换的唯一触发键
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
		return () => clearInterval(tourTimerRef.current);
	}, []);

	const selectEmotion = (id: string) => {
		setPinnedId(id);
		const nextGroup = EMOTION_MAP.get(id)?.group;
		if (nextGroup) {
			setGroup((currentGroup) => (currentGroup === "all" ? currentGroup : nextGroup));
		}
		if (isTouring) stopTour();
	};

	const applyAIMessage = (emotionId: string, tips?: string) => {
		const nextDef = EMOTION_MAP.get(emotionId) ?? EMOTIONS[0];
		const isSameEmotion = nextDef.id === pinnedId;
		aiTipsRef.current = tips ?? null;
		selectEmotion(nextDef.id);
		if (isSameEmotion) {
			aiTipsRef.current = null;
			pushBubble(tips ?? nextDef.desc);
		}
	};

	return {
		def,
		pinnedDef,
		group,
		groupList,
		selectGroup: setGroup,
		isTouring,
		toggleTour,
		replay: () => pushBubble(def.desc),
		bubble,
		selectEmotion,
		applyAIMessage,
	};
}
