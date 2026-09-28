import {
	Button,
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@violet/ui";

/** 展示可打开、关闭的完整对话框。 */
export function DialogBasicDemo() {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button type="button">打开对话框</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>确认操作</DialogTitle>
					<DialogDescription>这是一个示例对话框，不会提交任何更改。</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<DialogClose asChild>
						<Button type="button" variant="outline">
							关闭
						</Button>
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
