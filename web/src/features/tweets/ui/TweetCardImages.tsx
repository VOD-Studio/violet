import type { TweetImageRef } from "@entities/tweet/model/types";
import { contentImageUrl } from "@shared/lib/image-url";
import { ImagePreview, useImagePreview } from "@shared/ui/image-preview";
import { resolveLocalization, type TweetPhoto, TweetPhotos } from "@violetjs/react-tweet";
import { useMemo } from "react";

/** 本站推文图片布局：单图保比例、竖图组横向滚动、其余方格，点击进本站灯箱。 */
export function TweetCardImages({ images }: { images: TweetImageRef[] }) {
	const preview = useImagePreview();
	const localization = useMemo(
		() => resolveLocalization({ locale: "zh-CN", timeZone: "Asia/Shanghai" }),
		[],
	);
	if (images.length === 0) return null;

	const photos: TweetPhoto[] = images.map((img) => ({
		kind: "photo",
		url: img.url,
		// 灯箱保留原图，卡片只下载缩略图。
		thumbnailUrl: contentImageUrl(img.url, { width: 400 }),
		// 历史图无尺寸：TweetPhotos 整组退方格（包内降级路径）。
		width: img.width ?? undefined,
		height: img.height ?? undefined,
	}));

	return (
		<>
			<div
				onClick={(event) => {
					if (event.currentTarget.contains(event.target as Node)) event.stopPropagation();
				}}
				onKeyDown={(event) => {
					if (event.currentTarget.contains(event.target as Node)) event.stopPropagation();
				}}
				className="mt-2 w-full"
			>
				<TweetPhotos
					photos={photos}
					localization={localization}
					onOpenPhoto={(allPhotos, index, trigger) => {
						const urls = allPhotos.map((photo) => photo.url);
						const thumbs = allPhotos.map((photo) => photo.thumbnailUrl);
						// 缩略图与原图一一对应才传给预览：飞入占位与底部导航条不必拉原图。
						preview.openPreview(
							urls,
							index,
							trigger,
							thumbs.every((t): t is string => !!t) ? thumbs : undefined,
						);
					}}
				/>
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
		</>
	);
}
