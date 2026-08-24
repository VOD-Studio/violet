import { MascotSdkSection } from "./components/MascotSdkSection";
import { MascotTheater } from "./components/MascotTheater";
import { useMascotExhibit } from "./hooks/useMascotExhibit";

/** 堇喵演出工作台，将舞台、状态选择与导演控制保持在同一视口。 */
export function MascotLab() {
	const exhibit = useMascotExhibit();

	return (
		<main className="mx-auto max-w-360 px-4 pb-16 sm:px-6 lg:px-8">
			<MascotTheater
				def={exhibit.def}
				bubble={exhibit.bubble}
				group={exhibit.group}
				groupList={exhibit.groupList}
				activeId={exhibit.pinnedDef.id}
				isTouring={exhibit.isTouring}
				onSelectGroup={exhibit.selectGroup}
				onSelectEmotion={exhibit.selectEmotion}
				onToggleTour={exhibit.toggleTour}
				onReplay={exhibit.replay}
				onAIMessage={exhibit.applyAIMessage}
			/>

			<MascotSdkSection pinnedDef={exhibit.pinnedDef} />
		</main>
	);
}
