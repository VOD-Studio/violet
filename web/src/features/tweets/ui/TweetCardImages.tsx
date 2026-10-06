import { contentImageUrl } from "@shared/lib/image-url";
import { ImageGrid } from "@shared/ui/image-grid";

/** 本站推文图片网格，点击打开灯箱而不触发卡片导航。 */
export function TweetCardImages({ images }: { images: string[] }) {
	if (images.length === 0) return null;

	return (
		<div
			onClick={(event) => {
				if (event.currentTarget.contains(event.target as Node)) event.stopPropagation();
			}}
			onKeyDown={(event) => {
				if (event.currentTarget.contains(event.target as Node)) event.stopPropagation();
			}}
			className="w-full mt-2"
		>
			<ImageGrid
				images={images.map((url) => ({
					url,
					// 灯箱保留原图，卡片只下载缩略图。
					thumbnail: contentImageUrl(url, { width: 400 }),
				}))}
			/>
		</div>
	);
}
