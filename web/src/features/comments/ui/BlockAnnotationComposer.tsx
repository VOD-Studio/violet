import { useState } from "react";
import { toast } from "sonner";
import { useSubmitAnnotation } from "../hooks/use-submit-annotation";
import { buildBlockAnchor } from "../lib/block-anchor";
import { getBlockText } from "../lib/extract-blocks";
import { AnnotationComposer } from "./AnnotationComposer";

interface BlockAnnotationComposerProps {
	block: HTMLElement;
	postId: string;
	isLoggedIn: boolean;
	/** 独立卡片提交后关闭；内嵌在批注卡底部时省略，提交后继续阅读。 */
	onClose?: () => void;
	/** 内嵌在批注卡底部：不重复引用整段原文。 */
	embedded?: boolean;
}

/** 对完整正文块发表独立段评，不继承现有批注的回复关系。 */
export function BlockAnnotationComposer({
	block,
	postId,
	isLoggedIn,
	onClose,
	embedded = false,
}: BlockAnnotationComposerProps) {
	const [body, setBody] = useState("");
	const { submit, pending } = useSubmitAnnotation(postId, "paragraph");
	const send = async () => {
		if (!body.trim() || pending) return;
		const anchor = await buildBlockAnchor(block);
		if (!anchor) {
			toast.error("这一段暂不支持段评");
			return;
		}
		submit(body, anchor, () => {
			setBody("");
			onClose?.();
		});
	};
	return (
		<>
			{!embedded && (
				<blockquote className="annotation-quote">{getBlockText(block)}</blockquote>
			)}
			<AnnotationComposer
				autoFocus={!embedded}
				body={body}
				onBodyChange={setBody}
				onSubmit={send}
				pending={pending}
				placeholder="写下你对这一段的想法…"
				editorLabel="段评内容"
				sendLabel="发送段评"
				loginRequired={!isLoggedIn}
				onLoggedIn={send}
			/>
		</>
	);
}
