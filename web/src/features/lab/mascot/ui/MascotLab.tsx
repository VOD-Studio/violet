import type { SegmentedItem } from "@/shared/ui/segmented";
import { Segmented } from "@/shared/ui/segmented";
import type { EmotionDef } from "../engine/expressions";
import { EmotionGridItem } from "./components/EmotionGridItem";
import { MascotSdkSection } from "./components/MascotSdkSection";
import { MascotTheater } from "./components/MascotTheater";
import { useMascotExhibit } from "./hooks/useMascotExhibit";

const GROUP_SEGMENTS: SegmentedItem<EmotionDef["group"]>[] = [
	{ value: "emotion", label: <>喜怒哀乐</> },
	{ value: "lifecycle", label: <>猫猫日常</> },
	{ value: "agent", label: <>工作模式</> },
];

/** 吉祥物展馆:聚光舞台 sticky 常驻视线,目录分段切换、缩略卡 hover 本地预览、点击固定上演,SDK 协议全宽收尾。 */
export function MascotLab() {
	const exhibit = useMascotExhibit();

	return (
		<div>
			{/* 两列区:sticky 的作用域就是本容器——右列目录滚完,舞台随容器滚出,不会压到下方 SDK 全宽区 */}
			<div className="lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-10">
				{/* 舞台:桌面端 sticky 左栏常驻视线;移动端不吸顶——舞台高占视口 71%,吸顶会把下方目录全挡死 */}
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

					{/* 最小高度锁死：消除切换不同条目数分组时整个页面高度骤缩带来的剧烈跳动 */}
					<div className="min-h-[580px]">
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
				</div>
			</div>

			{/* SDK 协议全宽收尾:在两列 grid 之外,不被 sticky 舞台遮挡 */}
			<MascotSdkSection pinnedDef={exhibit.pinnedDef} />
		</div>
	);
}
