import {
	type ArticleEmbedDefinition,
	type ArticleEmbedInserter,
	type ArticleEmbedPickerProps,
	LazyArticleEmbed,
} from "@shared/ui/article-embeds";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@violet/ui";
import {
	type ComponentType,
	type LazyExoticComponent,
	lazy,
	Suspense,
	useRef,
	useState,
} from "react";

/** 每种嵌入的选择表单一个懒加载组件，按入口缓存，重开弹层时不重新下载。 */
const pickers = new WeakMap<
	ArticleEmbedInserter,
	LazyExoticComponent<ComponentType<ArticleEmbedPickerProps>>
>();

function lazyPicker(inserter: ArticleEmbedInserter) {
	let picker = pickers.get(inserter);
	if (!picker) {
		picker = lazy(() => inserter.loadPicker().then((Picker) => ({ default: Picker })));
		pickers.set(inserter, picker);
	}
	return picker;
}

export interface EmbedInsertDialogProps {
	/** 要插入或编辑的嵌入；null 时弹层关闭。没有插入入口的嵌入不会打开。 */
	definition: ArticleEmbedDefinition | null;
	/**
	 * 编辑已有块时它的原文：标题与按钮改为「编辑」「更新」，表单从中回填。
	 *
	 * @default undefined — 新插入。
	 */
	initialSource?: string;
	/** 确认插入或更新，参数是围栏块原文；随后弹层关闭。 */
	onSubmit: (source: string) => void;
	onClose: () => void;
	/** 弹层关闭后把焦点还给编辑器；弹层不是由按钮打开的，Radix 不知道该还给谁。 */
	returnFocus: () => void;
}

/** 选择表单与预览：每次打开重新挂载，上一次的选择不会带过来。 */
function EmbedInsertBody({
	definition,
	inserter,
	initialSource,
	onSubmit,
	onClose,
}: Omit<EmbedInsertDialogProps, "definition" | "returnFocus"> & {
	definition: ArticleEmbedDefinition;
	inserter: ArticleEmbedInserter;
}) {
	const Picker = lazyPicker(inserter);
	const [source, setSource] = useState<string | null>(null);
	const editing = initialSource !== undefined;
	return (
		<>
			<DialogHeader>
				<DialogTitle>
					{editing ? "编辑" : "插入"}
					{inserter.title}
				</DialogTitle>
				<DialogDescription>{inserter.description}</DialogDescription>
			</DialogHeader>
			<Suspense fallback={<p className="text-sm text-muted-foreground">正在加载表单…</p>}>
				<Picker initialSource={initialSource} onChange={setSource} />
			</Suspense>
			<section aria-label="预览" className="space-y-1">
				<h3 className="text-xs text-muted-foreground">预览</h3>
				{source ? (
					<LazyArticleEmbed definition={definition} source={source} />
				) : (
					<p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
						选好之后在这里预览
					</p>
				)}
			</section>
			<DialogFooter>
				<Button type="button" variant="outline" onClick={onClose}>
					取消
				</Button>
				<Button
					type="button"
					disabled={!source}
					onClick={() => {
						if (!source) return;
						onSubmit(source);
						onClose();
					}}
				>
					{editing ? "更新" : "插入"}
				</Button>
			</DialogFooter>
		</>
	);
}

/** 编辑器里插入或编辑一个文章嵌入：嵌入自己的选择表单、实时预览与确认。 */
export function EmbedInsertDialog({
	definition,
	initialSource,
	onSubmit,
	onClose,
	returnFocus,
}: EmbedInsertDialogProps) {
	// 关闭时 definition 先变成 null，淡出期间仍画上一次的内容
	const last = useRef(definition);
	if (definition) last.current = definition;
	const shown = definition ?? last.current;
	const inserter = shown?.inserter;
	return (
		<Dialog
			open={Boolean(definition?.inserter)}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent
				className="max-h-[calc(100dvh-4rem)] gap-5 overflow-y-auto sm:max-w-2xl"
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					returnFocus();
				}}
			>
				{shown && inserter ? (
					<EmbedInsertBody
						definition={shown}
						inserter={inserter}
						initialSource={initialSource}
						onSubmit={onSubmit}
						onClose={onClose}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
