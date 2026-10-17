import {
	AICommentProfile,
	type AICommentProfileProps,
} from "@entities/comment/ui/AICommentProfile";
import { useContext } from "react";
import { AnnotationOverlayContext } from "./annotation-overlay-context";

type AnnotationAuthorProfileProps = Omit<AICommentProfileProps, "disabled">;

/** 批注隐藏或被筛选时关闭作者介绍；普通评论区默认可用。 */
export function AnnotationAuthorProfile(props: AnnotationAuthorProfileProps) {
	const active = useContext(AnnotationOverlayContext);
	return <AICommentProfile {...props} disabled={!active} />;
}
