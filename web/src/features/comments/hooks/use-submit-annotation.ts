import { ApiError } from "@shared/api/error";
import { toast } from "sonner";
import { useCreateComment } from "../api/mutations";
import { toCreateCommentAnchor } from "../lib/anchor-mapper";
import type { Anchor } from "../lib/types";

/** 发表对象：选区划线的批注，或对整个段落的段评。决定提示里的称呼。 */
export type AnnotationScope = "selection" | "paragraph";

const NOUN: Record<AnnotationScope, string> = { selection: "批注", paragraph: "段评" };

/**
 * 在给定锚点上发表一条批注或段评，成功与失败都以轻提示反馈。
 *
 * @returns `submit` 成功后调用 `onSuccess`；`pending` 为请求在途
 */
export function useSubmitAnnotation(postId: string, scope: AnnotationScope = "selection") {
	const createComment = useCreateComment(postId);
	const submit = (body: string, anchor: Anchor, onSuccess: () => void) => {
		createComment.mutate(
			{ body: body.trim(), anchor: toCreateCommentAnchor(anchor) },
			{
				onSuccess: (created) => {
					toast.success(
						created.status === "pending"
							? `${NOUN[scope]}已提交，等待审核`
							: `${NOUN[scope]}已提交`,
					);
					onSuccess();
				},
				onError: (err) => toast.error(err instanceof ApiError ? err.message : "提交失败"),
			},
		);
	};
	return { submit, pending: createComment.isPending };
}
