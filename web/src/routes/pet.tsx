import { PetDemo } from "@features/pet-demo/ui/PetDemo";
import { createFileRoute } from "@tanstack/react-router";

function PetPage() {
	return (
		<div className="min-h-dvh text-foreground">
			<main className="container mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
				<h1 className="text-3xl font-semibold tracking-tight">电子宠物</h1>
				<p className="mt-2 mb-10 max-w-xl text-sm text-muted-foreground">
					规则核心以 WebAssembly
					运行在你的浏览器里，不联网、不存档。刷新页面会孵化一只新的。
				</p>
				<PetDemo />
			</main>
		</div>
	);
}

export const Route = createFileRoute("/pet")({
	head: () => ({ meta: [{ title: "电子宠物" }, { name: "robots", content: "noindex" }] }),
	component: PetPage,
});
