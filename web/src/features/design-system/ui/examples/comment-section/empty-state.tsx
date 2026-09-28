import { CommentList, CommentSection } from "@shared/ui/comment-section";
import { demoConfig } from "./shared";

/** 评论空状态：空数据时的轻量占位。 */
export function CommentSectionEmptyDemo() {
	return (
		<CommentSection title="全部评论 (0)" form={null} isLoggedIn={true}>
			<CommentList comments={[]} config={demoConfig} isLoggedIn={true} />
		</CommentSection>
	);
}
