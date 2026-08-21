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

/** 吉祥物展馆:舞台、表情导航与导演台分层,目录在桌面侧栏常驻,SDK 协议全宽收尾。 */
export function MascotLab() {
	const exhibit = useMascotExhibit();

	return (
		<div>
			{/* 表情导航独立常驻:桌面端与舞台并列,移动端先选表情,导演台不再吸附在舞台上。 */}
			<div className="grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(20rem,0.75fr)] lg:items-start">
				<div className="order-2 min-w-0 lg:order-1">
					<MascotTheater
						def={exhibit.def}
						bubble={exhibit.bubble}
						isTouring={exhibit.isTouring}
						onToggleTour={exhibit.toggleTour}
						onReplay={exhibit.replay}
						onAIMessage={(msg) => exhibit.applyAIMessage(msg.emotionId, msg.tips)}
					/>
				</div>

				<aside className="order-1 min-w-0 lg:sticky lg:top-24 lg:z-40">
					<div className="mb-4 flex items-center justify-between gap-4">
						<div>
							<p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
								Expression navigator
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								选择状态,舞台即时切换
							</p>
						</div>
						<span className="shrink-0 font-mono text-xs text-muted-foreground">
							{exhibit.groupList.length} 种状态
						</span>
					</div>

					<Segmented
						value={exhibit.group}
						onValueChange={(g) => exhibit.setGroup(g as EmotionDef["group"])}
						segments={GROUP_SEGMENTS}
					/>

					<div className="mt-4 max-h-88 overflow-y-auto pr-1 lg:max-h-172">
						<div className="grid grid-cols-2 gap-3">
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
				</aside>
			</div>

			{/* SDK 协议全宽收尾。 */}
			<MascotSdkSection pinnedDef={exhibit.pinnedDef} />
		</div>
	);
}
