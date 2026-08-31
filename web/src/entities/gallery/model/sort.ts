import type { PublishedGalleryItem } from "./types";

/**
 * 按服务端归一化后的 position 升序返回新数组。
 */
export function sortedByPosition<T extends Pick<PublishedGalleryItem, "position">>(
	items: T[],
): T[] {
	return [...items].sort((left, right) => left.position - right.position);
}
