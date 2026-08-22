import { MascotEmotionLibrary } from "./components/MascotEmotionLibrary";
import { MascotSdkSection } from "./components/MascotSdkSection";
import { MascotTheater } from "./components/MascotTheater";
import { useMascotExhibit } from "./hooks/useMascotExhibit";

/** 堇喵工作台，将状态发现、角色舞台与导演控制收在同一工作面。 */
export function MascotLab() {
	const exhibit = useMascotExhibit();

	return (
		<div className="mx-auto max-w-400 px-4 pb-20 sm:px-6 lg:px-8">
			<div className="grid items-start gap-4 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
				<MascotEmotionLibrary
					group={exhibit.group}
					groupList={exhibit.groupList}
					activeId={exhibit.pinnedDef.id}
					onSelectGroup={exhibit.selectGroup}
					onSelectEmotion={exhibit.selectEmotion}
				/>
				<MascotTheater
					def={exhibit.def}
					bubble={exhibit.bubble}
					isTouring={exhibit.isTouring}
					onToggleTour={exhibit.toggleTour}
					onReplay={exhibit.replay}
					onAIMessage={exhibit.applyAIMessage}
				/>
			</div>

			<MascotSdkSection pinnedDef={exhibit.pinnedDef} />
		</div>
	);
}
