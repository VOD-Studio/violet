import type { EmotionDef } from "@violet/mascot";
import type { SegmentedItem } from "@/shared/ui/segmented";
import { Segmented } from "@/shared/ui/segmented";
import { EmotionGridItem } from "./components/EmotionGridItem";
import { MascotSdkSection } from "./components/MascotSdkSection";
import { MascotTheater } from "./components/MascotTheater";
import { GROUP_LABEL, useMascotExhibit } from "./hooks/useMascotExhibit";

const GROUP_SEGMENTS: SegmentedItem<EmotionDef["group"]>[] = [
	{ value: "emotion", label: <>{GROUP_LABEL.emotion}</> },
	{ value: "lifecycle", label: <>{GROUP_LABEL.lifecycle}</> },
	{ value: "agent", label: <>{GROUP_LABEL.agent}</> },
];

/** 吉祥物展馆:聚光舞台 sticky 常驻视线,目录分段切换、缩略卡 hover 本地预览、点击固定上演,SDK 协议全宽收尾。 */
export function MascotLab() {
	const exhibit = useMascotExhibit();

	return (
		<div>
			{/* 顶部导演台:舞台与控制台同高,桌面端吸顶;目录从下方开始,不与舞台抢视觉层级。 */}
			<div className="lg:sticky lg:top-24 lg:z-40 lg:self-start">
				<MascotTheater
					def={exhibit.def}
					bubble={exhibit.bubble}
					isTouring={exhibit.isTouring}
					onToggleTour={exhibit.toggleTour}
					onReplay={exhibit.replay}
					onAIMessage={(msg) => exhibit.applyAIMessage(msg.emotionId, msg.tips)}
				/>
			</div>

			{/* 状态目录:导演台完成一轮演出后,在下方切换与固定状态。 */}
			<div className="mt-10">
				<div className="mb-5 flex items-center justify-between gap-4">
					<Segmented
						value={exhibit.group}
						onValueChange={(g) => exhibit.setGroup(g as EmotionDef["group"])}
						segments={GROUP_SEGMENTS}
					/>
					<span className="shrink-0 font-mono text-xs text-muted-foreground">
						{exhibit.groupList.length} 种状态
					</span>
				</div>

				{/* 最小高度锁死:切换不同条目数分组时目录不推挤下方内容。 */}
				<div className="min-h-145">
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
						{exhibit.groupList.map((e) => (
							<EmotionGridItem
								key={e.id}
								def={e}
								active={e.id === exhibit.pinnedDef.id}
								onSelect={exhibit.selectEmotion}
							/>
						))}
					</div>
				</div>
			</div>

			{/* SDK 协议全宽收尾。 */}
			<MascotSdkSection pinnedDef={exhibit.pinnedDef} />
		</div>
	);
}
