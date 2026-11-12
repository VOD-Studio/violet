import type { TweetImageRef } from "@entities/tweet/model/types";
import { contentImageUrl } from "@shared/lib/image-url";
import { ImageGrid } from "@shared/ui/image-grid";

/** 本站推文配图复用通用网格和本站灯箱，不触发整卡导航。 */
export function TweetCardImages({ images }: { images: TweetImageRef[] }) {
	if (images.length === 0) return null;
	return (
		<div
			onClick={(event) => event.stopPropagation()}
			onKeyDown={(event) => event.stopPropagation()}
			className="mt-2 w-full"
		>
			<ImageGrid
				images={images.map((image) => ({
					url: image.url,
					thumbnail: contentImageUrl(image.url, { width: 400 }),
					width: image.width ?? undefined,
					height: image.height ?? undefined,
				}))}
			/>
		</div>
	);
}
