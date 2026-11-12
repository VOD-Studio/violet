/** 小屏用抽屉显示目录；跳转到标题后自动关闭。 */
import ArticleToc, { type ArticleTocProps } from "@features/posts/ui/ArticleToc";
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerTitle } from "@violet/ui";

import { ListTree } from "lucide-react";
import { useState } from "react";

interface MobileTocFabProps {
	items: ArticleTocProps["items"];
	contentRef: ArticleTocProps["contentRef"];
}

const MobileTocFab = ({ items, contentRef }: MobileTocFabProps) => {
	const [open, setOpen] = useState(false);

	if (!items.length) return null;

	return (
		<Drawer open={open} onOpenChange={setOpen}>
			<button
				type="button"
				onClick={() => setOpen(true)}
				aria-label="打开目录"
				className="group flex size-11 items-center justify-center rounded-full border border-edge-hairline bg-background/80 text-muted-foreground shadow-soft backdrop-blur transition-colors duration-300 hover:border-selected-foreground hover:bg-accent hover:text-foreground"
			>
				<span className="absolute inset-0 rounded-full bg-decoration-muted opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100" />
				<ListTree className="relative size-5" />
			</button>
			<DrawerContent aria-describedby={undefined}>
				<DrawerHeader>
					<DrawerTitle>目录</DrawerTitle>
				</DrawerHeader>
				<DrawerBody className="scrollbar-none overflow-x-hidden">
					<ArticleToc
						items={items}
						contentRef={contentRef}
						hideTitle
						onNavigate={() => setOpen(false)}
					/>
				</DrawerBody>
			</DrawerContent>
		</Drawer>
	);
};

export default MobileTocFab;
