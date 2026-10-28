import { contentImageUrl } from "@shared/lib/image-url";
import { normalizeLinkUrl } from "@shared/lib/linkify";
import { LinkCard } from "@violet/ui";
import { LoaderCircle } from "lucide-react";
import { useLinkPreviews } from "../api/queries";
import type { LinkPreviewCard } from "../model/types";

export interface LinkPreviewsProps {
	urls: string[];
	/** SSR 随内容返回的快照，在客户端查询完成前保留。 */
	snapshots?: LinkPreviewCard[];
}

/** 正文链接的共享预览；成功后就地补卡片，上游拒绝读取则保留原文链接。 */
export function LinkPreviews({ urls, snapshots = [] }: LinkPreviewsProps) {
	const previews = useLinkPreviews(urls, snapshots);
	const pending = previews.some((preview) => preview.pending);
	const hrefs = new Map(urls.map((href) => [normalizeLinkUrl(href), href]));
	if (!pending && previews.every((preview) => !preview.card)) return null;
	return (
		<div className="my-3 min-w-0 space-y-2" aria-busy={pending}>
			{previews.map(({ url, card }) =>
				card ? (
					<LinkCard
						key={url}
						href={hrefs.get(url) ?? card.url}
						title={card.title.trim() === "" ? new URL(url).hostname : card.title}
						description={card.description}
						siteName={card.site_name}
						imageSrc={
							card.image_url
								? contentImageUrl(card.image_url, { width: 240 })
								: undefined
						}
						onClick={(event) => event.stopPropagation()}
					/>
				) : null,
			)}
			{pending && (
				<p
					role="status"
					className="flex items-center gap-2 py-1 text-xs text-muted-foreground"
				>
					<LoaderCircle
						className="size-3.5 animate-spin motion-reduce:animate-none"
						aria-hidden="true"
					/>
					正在读取链接预览…
				</p>
			)}
		</div>
	);
}
