import { Tabs, TabsContent, TabsList, TabsTrigger } from "@violet/ui";

/** 展示可通过鼠标或方向键切换的两个标签页。 */
export function TabsBasicDemo() {
	return (
		<Tabs defaultValue="overview" className="w-full max-w-md">
			<TabsList aria-label="内容分类">
				<TabsTrigger value="overview">概览</TabsTrigger>
				<TabsTrigger value="details">详情</TabsTrigger>
			</TabsList>
			<TabsContent value="overview" className="rounded-lg border border-border p-4 text-sm">
				概览内容：选择上方标签即可切换。
			</TabsContent>
			<TabsContent value="details" className="rounded-lg border border-border p-4 text-sm">
				详情内容：键盘聚焦标签后可使用方向键切换。
			</TabsContent>
		</Tabs>
	);
}
