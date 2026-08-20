import type { SegmentedItem } from "@/shared/ui/segmented";
import { Segmented } from "@/shared/ui/segmented";
import type { EmotionDef } from "../engine/expressions";
import { EmotionGridItem } from "./components/EmotionGridItem";
import { MascotSdkSection } from "./components/MascotSdkSection";
import { MascotTheater } from "./components/MascotTheater";
import { useMascotExhibit } from "./hooks/useMascotExhibit";

const GROUP_SEGMENTS: SegmentedItem<EmotionDef["group"]>[] = [
	{ value: "lifecycle", label: <>生命周期</> },
	{ value: "emotion", label: <>情绪反应</> },
	{ value: "agent", label: <>代理工作</> },
];

/** 吉祥物展馆:聚光舞台 sticky 常驻视线,目录分段切换、缩略卡 hover 本地预览、点击固定上演,SDK 协议全宽收尾。 */
export function MascotLab() {
	const exhibit = useMascotExhibit();

	return (
		<div className="lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-10">
			{/* 舞台:桌面端 sticky 左栏常驻视线;移动端不吸顶——舞台高占视口 71%,吸顶会把下方目录全挡死 */}
			<div className="lg:sticky lg:top-24 lg:z-40 lg:self-start">
				<MascotTheater
					def={exhibit.def}
					bubble={exhibit.bubble}
					isTouring={exhibit.isTouring}
					onToggleTour={exhibit.toggleTour}
					onAIMessage={(msg) => exhibit.applyAIMessage(msg.emotionId, msg.tips)}
				/>
			</div>
			{/* 目录:分段切换分组,hover 只起动缩略卡自身,click 固定并交舞台上演 */}
			<div className="mt-10 lg:mt-0">
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

				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
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

			<MascotSdkSection pinnedDef={exhibit.pinnedDef} />
		</div>
	);
}
