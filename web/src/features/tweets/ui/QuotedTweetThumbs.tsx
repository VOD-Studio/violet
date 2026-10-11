import { contentImageUrl } from "@shared/lib/image-url";
import { ImagePreview, useImagePreview } from "@shared/ui/image-preview";
import { cn } from "cn";

/** 引用卡片缩略图最多展示的张数，其余折叠为最后一格上的「+N」。 */
const MAX_VISIBLE = 4;

/**
 * 被引用本站推文的图片：固定大小的方形小拼图，沿用推文包引用卡片的缩略图样式，
 * 点击以对应图片打开灯箱，不触发卡片导航。
 */
export function QuotedTweetThumbs({ images }: { images: string[] }) {
	const preview = useImagePreview();
	if (images.length === 0) return null;
	const visible = images.slice(0, MAX_VISIBLE);
	const hidden = images.length - visible.length;
	return (
		<div
			className="v-tweet__media"
			onClick={(event) => {
				if (event.currentTarget.contains(event.target as Node)) event.stopPropagation();
			}}
			onKeyDown={(event) => {
				if (event.currentTarget.contains(event.target as Node)) event.stopPropagation();
			}}
		>
			<div className="v-tweet__thumbs" data-count={visible.length}>
				{visible.map((url, index) => (
					<button
						key={`${url}:${index}`}
						type="button"
						aria-label={`查看第 ${index + 1} 张图片，共 ${images.length} 张`}
						onClick={(event) =>
							preview.openPreview(
								images,
								index,
								event.currentTarget,
								images.map((src) => contentImageUrl(src, { width: 400 })),
							)
						}
						className={cn("v-tweet__photo cursor-zoom-in border-0 p-0")}
					>
						<img src={contentImageUrl(url, { width: 200 })} alt="" loading="lazy" />
						{hidden > 0 && index === visible.length - 1 && (
							<span className="v-tweet__more" aria-hidden="true">
								+{hidden}
							</span>
						)}
					</button>
				))}
			</div>
			<ImagePreview
				open={preview.open}
				images={preview.images}
				thumbnails={preview.thumbnails}
				currentIndex={preview.currentIndex}
				triggerElement={preview.triggerElement}
				onClose={preview.closePreview}
				onIndexChange={preview.setCurrentIndex}
			/>
		</div>
	);
}
