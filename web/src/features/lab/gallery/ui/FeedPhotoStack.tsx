import { PhotoStack } from "@shared/ui/photo-stack";
import type { MockGallery } from "../model/mock";

/**
 * 浏览流方向 D · 照片堆叠
 *
 * 图集 = 一沓照片：复用 shared PhotoStack 的错位叠放栈，
 * 横向拖拽翻页，展开键切平铺一览全部。对标照片 App 的栈式交互。
 */
export function FeedPhotoStack({ galleries }: { galleries: MockGallery[] }) {
	return (
		<div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
			{galleries.map((g) => (
				<PhotoStack
					key={g.id}
					images={stackImages(g)}
					footer={
						<>
							<h3 className="line-clamp-1 font-semibold group-hover:text-primary">
								{g.title}
							</h3>
							<p className="mt-1 font-mono text-xs text-muted-foreground">
								{g.author} · {g.itemCount} 项 · {g.createdAt.slice(5)}
							</p>
						</>
					}
				/>
			))}
		</div>
	);
}

function stackImages(gallery: MockGallery) {
	if (gallery.items.length > 0) {
		return gallery.items.map((item, index) => ({
			src: item.url,
			alt: index === 0 ? gallery.title : `${gallery.title} 之${index + 1}`,
		}));
	}
	return Array.from({ length: Math.max(gallery.itemCount, 1) }, (_, index) => ({
		src:
			index === 0
				? gallery.cover
				: `https://picsum.photos/seed/${gallery.id}-p${index + 1}/600/800`,
		alt: index === 0 ? gallery.title : `${gallery.title} 之${index + 1}`,
	}));
}
