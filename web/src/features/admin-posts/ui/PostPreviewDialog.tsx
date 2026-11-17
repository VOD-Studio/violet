import ArticleContent from "@shared/ui/markdown-preview/ArticleContent";
import { Button, Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@violet/ui";
import { useAdminPost } from "../api/queries";

/** 已保存的非公开文章通过后台详情接口预览，不生成公开链接。 */
export interface PostPreviewDialogProps {
	postId: string;
	onClose: () => void;
}

/** 复用文章正文渲染器展示后台保存内容。 */
export function PostPreviewDialog({ postId, onClose }: PostPreviewDialogProps) {
	const { data, isLoading, error, refetch } = useAdminPost(postId);
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent size="xl" className="h-[85dvh]" aria-describedby={undefined}>
				<DialogHeader>
					<DialogTitle>文章预览{data ? ` · ${data.title}` : ""}</DialogTitle>
				</DialogHeader>
				<DialogBody>
					{error ? (
						<div role="alert">
							<p>{error.message}</p>
							<Button onClick={() => void refetch()}>重新加载</Button>
						</div>
					) : isLoading ? (
						<p role="status">正在加载文章…</p>
					) : data ? (
						<article className="prose max-w-none dark:prose-invert">
							<h1>{data.title}</h1>
							<ArticleContent
								content={data.content_html || data.content_md || ""}
								contentType={data.content_html ? "html" : "markdown"}
							/>
						</article>
					) : null}
				</DialogBody>
			</DialogContent>
		</Dialog>
	);
}
