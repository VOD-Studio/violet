import { ApiError } from "@shared/api/error";
import { MessageSquareText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCreateComment } from "../api/mutations";
import { toCreateCommentAnchor } from "../lib/anchor-mapper";
import { computeBlockId } from "../lib/block-id";
import { getBlockText } from "../lib/extract-blocks";
import { buildAnchorFromRange } from "../lib/range-to-anchor";
import { AnnotationComposer } from "./AnnotationComposer";

interface BlockAnnotationComposerProps {
	block: HTMLElement;
	postId: string;
	isLoggedIn: boolean;
	/** 独立面板提交或取消后关闭；内嵌输入区省略，提交后继续阅读。 */
	onClose?: () => void;
	embedded?: boolean;
}

/** 对完整正文块发表独立段评，不继承现有评论的回复关系。 */
export function BlockAnnotationComposer({
	block,
	postId,
	isLoggedIn,
	onClose,
	embedded = false,
}: BlockAnnotationComposerProps) {
	const [body, setBody] = useState("");
	const createComment = useCreateComment(postId);
	const submit = async () => {
		if (!body.trim() || createComment.isPending) return;
		const text = getBlockText(block);
		const blockId = await computeBlockId(text);
		const anchor = await buildAnchorFromRange({
			blockId,
			blockText: text,
			startOffset: 0,
			endOffset: text.length,
		});
		if (!anchor) {
			toast.error("这一段暂不支持段评");
			return;
		}
		createComment.mutate(
			{ body: body.trim(), anchor: toCreateCommentAnchor(anchor) },
			{
				onSuccess: (created) => {
					toast.success(
						created.status === "pending" ? "段评已提交，等待审核" : "段评已提交",
					);
					setBody("");
					onClose?.();
				},
				onError: (err) => toast.error(err instanceof ApiError ? err.message : "提交失败"),
			},
		);
	};
	return (
		<AnnotationComposer
			title="段评"
			icon={<MessageSquareText className="size-4" />}
			quote={embedded ? undefined : getBlockText(block)}
			body={body}
			onBodyChange={setBody}
			embedded={embedded}
			onSubmit={submit}
			onCancel={() => {
				setBody("");
				onClose?.();
			}}
			pending={createComment.isPending}
			placeholder="写下你对这一段的想法…"
			loginRequired={!isLoggedIn}
			onLoggedIn={submit}
		/>
	);
}
