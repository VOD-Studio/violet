import { contentImageUrl } from "@shared/lib/image-url";
import { normalizeLinkUrl } from "@shared/lib/linkify";
import { LinkCard } from "@violet/ui";
import { cn } from "cn";
import { useLinkPreviews } from "../api/queries";
import type { LinkPreviewCard } from "../model/types";

export interface LinkPreviewsProps {
	urls: string[];
	/** SSR 随内容返回的快照，在客户端查询完成前保留。 */
	snapshots?: LinkPreviewCard[];
	/** 嵌入消息时由外层编排间距，不添加文章流外边距。 */
	compact?: boolean;
}

/** 正文链接的共享预览；未知元数据使用统一骨架，失败仍提供原生链接。 */
export function LinkPreviews({ urls, snapshots = [], compact = false }: LinkPreviewsProps) {
	const previews = useLinkPreviews(urls, snapshots);
	const pending = previews.some((preview) => preview.pending);
	const hrefs = new Map(urls.map((href) => [normalizeLinkUrl(href), href]));
	if (!previews.length) return null;
	return (
		<div className={cn("min-w-0 space-y-2", !compact && "my-3")} aria-busy={pending}>
			{previews.map(({ url, card, pending }) => (
				<LinkCard
					key={url}
					href={hrefs.get(url) ?? url}
					title={
						card
							? card.title.trim() || new URL(url).hostname
							: pending
								? new URL(url).hostname
								: "打开原链接"
					}
					description={card?.description ?? "暂时无法读取预览"}
					siteName={card?.site_name}
					imageSrc={
						card?.image_url
							? contentImageUrl(card.image_url, { width: 240 })
							: undefined
					}
					loading={!card && pending}
					onClick={(event) => event.stopPropagation()}
				/>
			))}
		</div>
	);
}
