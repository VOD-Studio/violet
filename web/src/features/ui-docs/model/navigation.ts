import { type CatalogItem, UI_DOCS_CATALOG } from "./guides";

export type UiDocsNavItem = Omit<CatalogItem, "children">;

export const UI_DOCS_NAV_GROUPS = UI_DOCS_CATALOG;
export const ALL_NAV_ITEMS: UiDocsNavItem[] = UI_DOCS_NAV_GROUPS.flatMap((group) =>
	group.items.flatMap((item) => [
		item,
		...(item.children?.map((child) => ({
			id: child.id,
			title: child.title,
			to: child.to,
			scope: child.description,
		})) ?? []),
	]),
);

export function findNavItemByPath(pathname: string): UiDocsNavItem {
	const normalized = pathname.replace(/\/$/, "");
	return ALL_NAV_ITEMS.find((item) => item.to === normalized) ?? ALL_NAV_ITEMS[0];
}

export function getSiblingNavItems(currentId: string): {
	prev: UiDocsNavItem | null;
	next: UiDocsNavItem | null;
} {
	const index = ALL_NAV_ITEMS.findIndex((item) => item.id === currentId);
	return {
		prev: index > 0 ? ALL_NAV_ITEMS[index - 1] : null,
		next: index >= 0 && index < ALL_NAV_ITEMS.length - 1 ? ALL_NAV_ITEMS[index + 1] : null,
	};
}
