import { ApiTable, type ApiTableColumn } from "@features/ui-docs/ui/ApiTable";
import { ComponentDoc } from "@features/ui-docs/ui/ComponentDoc";
import { UploadTileBasicDemo } from "@features/ui-docs/ui/examples/upload-tile/basic";
import basicSource from "@features/ui-docs/ui/examples/upload-tile/basic.tsx?raw";
import { AnchoredHeading } from "@shared/ui/anchored-heading";
import { CodeCard } from "@shared/ui/code-preview/components/CodeCard";

interface PropRow {
	name: string;
	type: string;
	meaning: string;
}

const COLUMNS: ApiTableColumn<PropRow>[] = [
	{ label: "属性", cellClassName: "font-mono text-foreground", render: (row) => row.name },
	{ label: "类型", cellClassName: "font-mono text-muted-foreground", render: (row) => row.type },
	{ label: "用途", cellClassName: "text-muted-foreground", render: (row) => row.meaning },
];
const ROWS: PropRow[] = [
	{
		name: "busy",
		type: "boolean",
		meaning: "显示加载指示，设置 aria-busy 并原生禁用按钮；状态由消费方管理。",
	},
	{ name: "disabled", type: "boolean", meaning: "原生禁用；busy 恢复后仍尊重该属性。" },
	{
		name: "children / aria-label",
		type: "ReactNode / string",
		meaning: "children 显示在图标下方；纯图标按钮必须提供 aria-label。",
	},
	{
		name: "type",
		type: '"button" | "submit" | "reset"',
		meaning: '默认 "button"；可显式参与原生表单提交或重置。',
	},
	{
		name: "ref / className / style",
		type: "原生 button 属性",
		meaning: "直接落在按钮节点；父容器决定网格尺寸，按钮默认方形填满单元格。",
	},
	{
		name: "onClick / form / name / value",
		type: "原生 button 属性",
		meaning: "保留原生事件与表单属性，支持 preventDefault 取消默认行为。",
	},
];

/** 展示上传入口的原生交互与消费方状态边界。 */
export function UploadTileDocPage() {
	return (
		<ComponentDoc componentId="upload-tile">
			<article className="space-y-12 pb-24 font-sans">
				<header className="space-y-3">
					<p className="font-mono text-xs text-muted-foreground">动作 · UploadTile</p>
					<h1 className="text-3xl font-extrabold text-foreground sm:text-4xl">
						UploadTile 上传入口
					</h1>
					<p className="text-base leading-relaxed text-muted-foreground">
						网格中的方形原生按钮，提供加号、忙碌状态与焦点反馈。文件选择、校验、上传请求、会话与通知均由消费方负责。
					</p>
				</header>
				<section aria-labelledby="upload-tile-usage" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="upload-tile-usage"
						className="text-xl font-bold text-foreground"
					>
						用法
					</AnchoredHeading>
					<p className="text-sm leading-relaxed text-muted-foreground">
						从 @violet/ui 或 @violet/ui/upload-tile
						导入。示例只记录激活次数，不伪造上传成功；切换忙碌和禁用后再恢复，观察按钮能否重新激活。
					</p>
					<CodeCard code={basicSource} language="tsx" lineNumbers collapseLines={12}>
						<UploadTileBasicDemo />
					</CodeCard>
				</section>
				<section aria-labelledby="upload-tile-api" className="space-y-4">
					<AnchoredHeading
						as="h2"
						id="upload-tile-api"
						className="text-xl font-bold text-foreground"
					>
						API 与键盘
					</AnchoredHeading>
					<ApiTable
						title="UploadTileProps"
						columns={COLUMNS}
						rows={ROWS}
						rowKey={(row) => row.name}
					/>
					<p className="text-sm leading-relaxed text-muted-foreground">
						Tab 聚焦，Enter 或 Space
						激活；忙碌和禁用时不可聚焦或激活。无额外键盘协议、变体或上传逻辑。悬停只改变颜色与描边，不缩放或滑动；减弱动态时停止加载图标旋转。
					</p>
					<p className="text-sm leading-relaxed text-muted-foreground">
						普通 CSS 宿主先加载 @violet/ui/tokens.css，再加载
						@violet/ui/components/upload-tile.css；Tailwind v4 宿主在 Tailwind 后加载
						@violet/ui/styles.css。
					</p>
				</section>
			</article>
		</ComponentDoc>
	);
}
