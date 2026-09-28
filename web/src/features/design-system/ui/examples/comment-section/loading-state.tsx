import { CommentList, CommentSection } from "@shared/ui/comment-section";
import { demoConfig } from "./shared";

/** 评论加载中：传入 isLoading 渲染 Shimmer 骨架条目。 */
export function CommentSectionLoadingDemo() {
	return (
		<CommentSection title="全部评论" form={null} isLoggedIn={true}>
			<CommentList comments={[]} config={demoConfig} isLoggedIn={true} isLoading={true} />
		</CommentSection>
	);
}
