export function writeTypeFixture(write, metadata) {
	// 公开类型：泛型卡片只要求 id，使用方自己的列类型贯穿插槽；缺 id 的卡片必须被拒绝。
	write(
		"types.tsx",
		`import { Board, InlineEdit, createPointerController, type InlineEditMessages, type NewCard, type BoardCard, type BoardColumn, type BoardLocale, type BoardMessages, type BoardMove, type BoardProps, type BoardState, type DragController, type DragHost, type MoveDecision } from "${metadata.name}";
import { Board as Unstyled, ResponsiveLayout, DEFAULT_NARROW_BREAKPOINT, type ResponsiveLayoutKind, HistoryButtons, useHistoryAnnouncement, useHistoryShortcuts, useHistoryState, type HistoryCommand, type CommandHistory } from "${metadata.name}/unstyled";
import { createHistory, invertMove, fitViewport, zoomAt, DEFAULT_SCALE_LIMITS, type Viewport } from "${metadata.name}/core";
import { Canvas, type CanvasHandle, type CanvasMessages } from "${metadata.name}/canvas";
import { RelationGraph, type RelationGraphProps } from "${metadata.name}/graph";
import { layoutGraph, relatedSubgraph, DEFAULT_GRAPH_LAYOUT, type GraphLayout, type Subgraph } from "${metadata.name}/core";
import { applyMove, violatesAutoSort, createMove, isNoopMove, locateCard, normalizeBoardState, resolveBoard, resolveDropTarget, type ColumnLayout, type ResolvedColumn } from "${metadata.name}/core";
interface Task extends BoardCard { title: string }
interface Stage extends BoardColumn { hint: string }
const canMove = (move: BoardMove): MoveDecision => move.to.columnId === "done" ? { allowed: false, reason: "no" } : { allowed: true };
const controller: DragController = { attach: (host: DragHost) => { host.root.focus(); return () => {}; } };
export const defaultController: DragController = createPointerController({ threshold: 6 });
const tasks: Task[] = [{ id: "a", title: "A" }];
const stages: Stage[] = [{ id: "todo", title: "Todo", hint: "next" }];
const locale: BoardLocale = "zh-CN";
const messages: Partial<BoardMessages> = { emptyColumn: "none" };
export const nodes = [
	<Board columns={stages} cards={tasks} order={{ todo: ["a"] }} locale={locale} messages={messages}
		renderCard={(task, { column, index }) => <span>{task.title}{column.hint}{index}</span>}
		renderColumnHeader={(stage, { count }) => <b>{stage.hint}{count}</b>}
		renderEmpty={(stage) => <i>{stage.hint}</i>}
		onMove={async (move) => { await Promise.resolve(move.cardId); }} canMove={canMove} onMoveError={(error, move) => console.error(error, move.previousId)}
		isDraggable={(task) => task.title !== ""} readOnly={false} dragController={controller} getCardLabel={(task) => task.title} moveMenu="always" />,
	<Unstyled columns={stages} cards={tasks} order={{}} renderCard={(task) => task.title} />,
	<Board columns={[{ id: "todo", title: "Todo", collapsible: false, quickAdd: false }]} cards={tasks} order={{ todo: ["a"] }}
		renderCard={(task) => <InlineEdit value={task.title} label="Title" onSave={async (next) => { await Promise.resolve(next.length); }} allowEmpty={false} maxLength={80} locale="zh-CN" messages={inlineMessages} />}
		collapsible collapsedColumns={["todo"]} defaultCollapsedColumns={[]} onCollapsedColumnsChange={(ids: string[]) => ids.length}
		onAddCard={async (card: NewCard) => { await Promise.resolve(card.columnId + card.title); }} onAddCardError={(error, card) => console.error(error, card.title)}
		filter={(task) => task.title.includes("A")} />,
	<ResponsiveLayout breakpoint={DEFAULT_NARROW_BREAKPOINT} onLayoutChange={(next: ResponsiveLayoutKind) => console.log(next)}
		narrow={<Board columns={stages} cards={tasks} order={{ todo: ["a"] }} renderCard={(task) => task.title}
			layout="switcher" activeColumn="todo" defaultActiveColumn="todo" onActiveColumnChange={(id: string) => id.length} />}>
		<Board columns={stages} cards={tasks} order={{ todo: ["a"] }} renderCard={(task) => task.title} layout="columns" />
	</ResponsiveLayout>,
];
const inlineMessages: Partial<InlineEditMessages> = { saveFailed: "no" };
export const props: BoardProps<Task, Stage>["order"] = {};
const viewport: Viewport = fitViewport({ width: 800, height: 600 }, { width: 400, height: 300 });
export const zoomed: Viewport = zoomAt(viewport, { x: 0, y: 0 }, 1.5, DEFAULT_SCALE_LIMITS);
const canvasMessages: Partial<CanvasMessages> = { fit: "Fit" };
export const canvas = <Canvas defaultViewport={zoomed} onViewportChange={(next) => console.log(next.scale)} fit={{ minScale: 0.5 }} controls locale="zh-CN" messages={canvasMessages} ref={(handle: CanvasHandle | null) => handle?.fit()}><div /></Canvas>;
const graphProps: RelationGraphProps<Task, Stage> = {
	columns: stages, cards: tasks, order: { todo: ["a"] }, relations: [{ sourceId: "a", targetId: "a", type: "extends" }],
	renderCard: (task, { column }) => <span>{task.title}{column.hint}</span>, rootId: "a", subgraph: { direction: "in", depth: 2, types: ["extends"] },
	cardSize: { width: 200, height: 64 }, getCardLabel: (task) => task.title, relationTypes: {}, selectedCardId: null,
	onSelectedCardChange: (id: string | null) => id?.length, locale: "zh-CN", messages: { graphEmpty: "none" },
};
export const graph = <RelationGraph {...graphProps} />;
export const laidOut: GraphLayout = layoutGraph({ columns: ["todo"], cards: [{ id: "a", columnId: "todo", width: DEFAULT_GRAPH_LAYOUT.cardWidth }], relations: [] }, { sweeps: 2 });
export const related: Subgraph = relatedSubgraph([{ sourceId: "a", targetId: "b", type: "extends" }], "a", { direction: "out" });
const command: HistoryCommand = { label: "move", undo: async () => {}, redo: () => {} };
const history: CommandHistory = createHistory({ limit: 10, onError: (error, failed) => console.error(error, failed.label) });
history.push(command);
export function Controls() {
	useHistoryShortcuts(history, { enabled: true });
	const state = useHistoryState(history);
	const announcement = useHistoryAnnouncement(history, { locale: "zh-CN" });
	return <HistoryButtons history={history} locale="zh-CN" messages={{ undo: String(state.canUndo) + announcement.text }} />;
}
const state: BoardState = { columns: ["todo"], order: { todo: ["a"] } };
export const resolved: ResolvedColumn<Task>[] = resolveBoard(state, tasks);
export const normalized: BoardState = normalizeBoardState(state);
const move: BoardMove | null = createMove(state, "a", { columnId: "todo", index: 0 });
export const inverse: BoardMove | null = move && invertMove(move);
const layout: ColumnLayout[] = [{ id: "todo", rect: { left: 0, top: 0, right: 1, bottom: 1 }, cards: [] }];
export const moves = [move && applyMove(state, move), move && isNoopMove(move), move && violatesAutoSort(move, () => false), locateCard(state, "a"), resolveDropTarget(layout, { x: 0, y: 0 })];
// @ts-expect-error 卡片必须有 id
export const bad = <Board columns={stages} cards={[{ title: "no id" }]} order={{}} renderCard={() => null} />;
`,
	);
}

export function writeSSRFixture(write, metadata) {
	// Node 服务端渲染：不带样式入口可直接使用，输出确定，列与卡片顺序正确。
	write(
		"ssr.mjs",
		`import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { Board, ResponsiveLayout } from "${metadata.name}/unstyled";
import { createMove, applyMove, resolveBoard, createHistory } from "${metadata.name}/core";
import { HistoryButtons } from "${metadata.name}/unstyled";
import { Canvas } from "${metadata.name}/canvas";
import { RelationGraph } from "${metadata.name}/graph";
import { layoutGraph, relatedSubgraph } from "${metadata.name}/core";
const props = {
	columns: [{ id: "todo", title: "Todo" }, { id: "done", title: "Done" }],
	cards: [{ id: "a", title: "First" }, { id: "b", title: "Second" }],
	order: { todo: ["b", "a"], done: [] },
	renderCard: (card) => card.title,
};
const html = renderToString(createElement(Board, props));
assert.equal(renderToString(createElement(Board, props)), html, "SSR output must be deterministic.");
assert.ok(html.indexOf("Todo") < html.indexOf("Done"));
assert.ok(html.indexOf("Second") < html.indexOf("First"), "Card order must follow the order prop.");
assert.match(renderToString(createElement(Board, { ...props, renderEmpty: () => "consumer-empty" })), /consumer-empty/);
const shell = renderToString(createElement(Board, { ...props, collapsible: true, onAddCard: () => {}, filter: (card) => card.id === "a", onMove: () => {} }));
assert.equal(renderToString(createElement(Board, { ...props, collapsible: true, onAddCard: () => {}, filter: (card) => card.id === "a", onMove: () => {} })), shell, "Shell SSR output must be deterministic.");
assert.match(shell, /aria-expanded="true"/);
assert.match(shell, /<button/);
assert.match(shell, /data-dimmed="true"/);
assert.ok(shell.includes("First") && shell.includes("Second"), "Filtering must preserve the cards in SSR.");
const editable = renderToString(createElement(Board, { ...props, onMove: () => {} }));
assert.equal(renderToString(createElement(Board, { ...props, onMove: () => {} })), editable, "Editable SSR output must be deterministic.");
assert.match(editable, /data-draggable="true"/);
assert.match(editable, /tabindex="0"/);
assert.match(editable, /aria-describedby=/);
assert.match(editable, /<button/);
const switcher = renderToString(createElement(Board, { ...props, layout: "switcher" }));
assert.equal(renderToString(createElement(Board, { ...props, layout: "switcher" })), switcher, "Switcher SSR output must be deterministic.");
assert.match(switcher, /role="tablist"/);
assert.ok(switcher.includes("Second") && !switcher.includes("Done</h3>"), "Only the active column renders in the switcher layout.");
assert.match(renderToString(createElement(ResponsiveLayout, { narrow: createElement("p", null, "narrow") }, createElement("p", null, "wide"))), /wide/, "ResponsiveLayout renders the wide content on the server.");
assert.ok(!/data-draggable/.test(html), "Read-only boards must not advertise dragging.");
assert.ok(!/<script|<style/.test(html));
assert.deepEqual(resolveBoard({ columns: ["todo"], order: { todo: ["b", "x"] } }, props.cards).map((column) => column.cards.map((card) => card.id)), [["b"]]);
const moved = applyMove({ columns: ["todo", "done"], order: { todo: ["a", "b"], done: [] } }, createMove({ columns: ["todo", "done"], order: { todo: ["a", "b"], done: [] } }, "a", { columnId: "done", index: 0 }));
assert.deepEqual(moved.order, { todo: ["b"], done: ["a"] });
const canvasHtml = renderToString(createElement(Canvas, { defaultViewport: { scale: 1, x: 0, y: 0 } }, createElement('p', null, 'Canvas content')));
assert.match(canvasHtml, /Canvas content/);
assert.ok(canvasHtml.includes('translate(0px, 0px) scale(1)'));
assert.match(canvasHtml, /<button/);
const graphProps = {
	columns: props.columns, cards: props.cards, order: { todo: ["a"], done: ["b"] },
	relations: [{ sourceId: "a", targetId: "b", type: "extends" }, { sourceId: "b", targetId: "a", type: "fixes" }],
	renderCard: (card) => card.title,
};
const graphHtml = renderToString(createElement(RelationGraph, graphProps));
assert.equal(renderToString(createElement(RelationGraph, graphProps)), graphHtml, "Graph SSR output must be deterministic.");
assert.ok(graphHtml.indexOf("Todo") < graphHtml.indexOf("Done") && graphHtml.includes("First") && graphHtml.includes("Second"));
assert.match(graphHtml, /v-kanban__relation/);
assert.ok(!renderToString(createElement(RelationGraph, { ...graphProps, cards: [] })).includes("First"));
assert.deepEqual(layoutGraph({ columns: ["todo"], cards: [{ id: "a", columnId: "todo" }], relations: [] }).cards.map((entry) => entry.id), ["a"]);
assert.deepEqual(relatedSubgraph([{ sourceId: "a", targetId: "b", type: "extends" }], "b", { direction: "in" }).ids, ["b", "a"]);
const controls = renderToString(createElement(HistoryButtons, { history: createHistory() }));
assert.equal((controls.match(/aria-disabled="true"/g) ?? []).length, 2);
assert.ok(controls.includes('aria-keyshortcuts="Control+Z Meta+Z"'));
const history = createHistory();
history.push({ undo: () => {}, redo: () => {} });
assert.equal(history.getState().canUndo, true);
console.log("安装包 Node SSR 与核心消费契约通过。");
`,
	);
}
