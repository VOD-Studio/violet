import { sortedByPosition } from "@entities/gallery/model/sort";
import type { PublishedGallery, PublishedGalleryItem } from "@entities/gallery/model/types";
import { formatDate } from "@shared/lib/date";
import { contentImageUrl } from "@shared/lib/image-url";
import { buttonVariants } from "@violet/ui";
import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
import styles from "./GalleryAlbumContent.module.css";

/** 相册内容的只读布局；链接和工作稿预览分别由消费方提供容器。 */
export interface GalleryAlbumContentProps {
	gallery: Pick<PublishedGallery, "title" | "summary" | "location" | "items"> & {
		published_at?: string;
	};
	featured?: boolean;
}

function AlbumImage({ item, eager }: { item: PublishedGalleryItem; eager: boolean }) {
	const [failedSource, setFailedSource] = useState("");
	const source = item.url || item.thumbnail;
	const failed = failedSource === source;

	return (
		<div className={styles.image}>
			{failed ? (
				<span
					className="text-center text-sm text-muted-foreground"
					role="img"
					aria-label={item.alt_text}
				>
					图片暂时无法显示
				</span>
			) : (
				<img
					src={contentImageUrl(source, { width: eager ? 1600 : 1024 })}
					alt={item.alt_text}
					title={item.caption || undefined}
					width={item.width > 0 ? item.width : undefined}
					height={item.height > 0 ? item.height : undefined}
					loading={eager ? "eager" : "lazy"}
					fetchPriority={eager ? "high" : "auto"}
					onError={() => setFailedSource(source)}
				/>
			)}
		</div>
	);
}

/** 相册封面按首张图片裁切，精选最多展示三张不同素材；不提供逐图交互。 */
export function GalleryAlbumContent({ gallery, featured = false }: GalleryAlbumContentProps) {
	const seen = new Set<string>();
	const previews = sortedByPosition(gallery.items)
		.filter((item) => {
			const source = item.url || item.thumbnail;
			if (!source || seen.has(source)) return false;
			seen.add(source);
			return true;
		})
		.slice(0, featured ? 3 : 1);
	const date = gallery.published_at
		? formatDate(gallery.published_at, "dotted-date", "").slice(0, 7)
		: "";

	return (
		<div className={styles.album} data-featured={featured || undefined}>
			{previews.length > 0 ? (
				<div
					className={featured ? styles.featureImages : styles.coverStack}
					data-count={previews.length}
				>
					{previews.map((item, index) => (
						<AlbumImage
							key={item.file_id}
							item={item}
							eager={featured && index === 0}
						/>
					))}
				</div>
			) : null}
			<div className={featured ? styles.featureInfo : styles.cardInfo}>
				<div className="min-w-0">
					<h2 className={featured ? styles.featureTitle : styles.cardTitle}>
						{gallery.title}
					</h2>
					{featured && gallery.summary ? (
						<p className={styles.summary}>{gallery.summary}</p>
					) : null}
				</div>
				<div className={styles.metadata}>
					<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
						{date ? <time dateTime={gallery.published_at}>{date}</time> : null}
						{gallery.location ? <span>{gallery.location}</span> : null}
						<span className="tabular-nums">{gallery.items.length} 张</span>
					</div>
					{featured ? (
						<span
							className={buttonVariants({
								variant: "secondary",
								size: "md",
								className: "mt-3",
							})}
						>
							看全部 <ArrowUpRight className="size-4" aria-hidden="true" />
						</span>
					) : null}
				</div>
			</div>
		</div>
	);
}
