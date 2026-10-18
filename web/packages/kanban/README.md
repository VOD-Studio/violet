# @violetjs/kanban

Controlled kanban boards and relation graphs for React 19, with a React-free core. You own the cards, column order, persistence and permissions. The package renders the board and reports user actions.

[简体中文](./README.zh-CN.md) · [API reference (Chinese)](./docs/api.md) · [Maintainer guide (Chinese)](./DEVELOPMENT.md) · [MIT license](./LICENSE)

This package is being prepared for delivery and is not published to npm. Do not assume the version in `package.json` is available from the registry. A maintainer can create a tarball with `pnpm pack`; install that actual file in a React 19 application with `pnpm add /absolute/path/to/violetjs-kanban-0.1.0.tgz`. The application supplies its React renderer and a bundler that handles CSS imports.

## Choose an entry

| Import | Contents | CSS |
| --- | --- | --- |
| `@violetjs/kanban` | Board, ResponsiveLayout, InlineEdit, RelationList, history UI/hooks, createHistory, pointer controller and their types | Imports default styles |
| `@violetjs/kanban/unstyled` | Same exports as the root | None |
| `@violetjs/kanban/core` | State, moves, rules, command history, relations, graph layout and viewport math | None; no React |
| `@violetjs/kanban/canvas` | Canvas, CanvasHandle, CanvasProps, CanvasMessages | None |
| `@violetjs/kanban/graph` | RelationGraph and RelationGraphProps | None |
| `@violetjs/kanban/styles.css` | Default styles for all components | Explicit stylesheet |
| `@violetjs/kanban/package.json` | Package metadata | None |

Use the root entry once for automatic styles, or import `@violetjs/kanban/styles.css` once when using the CSS-free component entries. There is no dependency on Tailwind, `@violet/ui`, a site theme, a router or a backend. The distribution is ESM, not CommonJS.

## Read-only board

This complete example is copied from [examples/quick-start.tsx](./examples/quick-start.tsx). Each example is an independent TSX module, not a fragment that needs undocumented variables.

<!-- example:quick-start:start -->
```tsx
import { Board } from "@violetjs/kanban";

interface Task {
	id: string;
	title: string;
}

const tasks: Task[] = [
	{ id: "spec", title: "Write the specification" },
	{ id: "prototype", title: "Build the prototype" },
];

/** 不传 onMove 时，卡片只读且不显示移动入口。 */
export function QuickStart() {
	return (
		<Board
			aria-label="Read-only board"
			columns={[
				{ id: "todo", title: "Planned" },
				{ id: "doing", title: "In progress" },
			]}
			cards={tasks}
			order={{ todo: ["spec"], doing: ["prototype"] }}
			getCardLabel={(task) => task.title}
			renderCard={(task) => <span>{task.title}</span>}
		/>
	);
}
```
<!-- example:quick-start:end -->

`columns` determines left-to-right column order; `cards` is an unordered pool, and `order` maps column ids to top-to-bottom card ids. Cards only need an `id`; your extra fields and column fields pass through to render callbacks. Repeated placements are shown once, missing card ids are skipped, and cards not referenced by `order` are not shown. Without `onMove`, moving is disabled.

## Editable board and history

[examples/editable.tsx](./examples/editable.tsx) applies moves locally, records reversible commands and scopes undo shortcuts to the example. It does not pretend to save to a server.

<!-- example:editable:start -->
```tsx
import { Board, type BoardColumn, HistoryButtons, useHistoryShortcuts } from "@violetjs/kanban";
import {
	applyMove,
	type BoardMove,
	type BoardState,
	createHistory,
	invertMove,
} from "@violetjs/kanban/core";
import { useCallback, useMemo, useRef, useState } from "react";

const columns: BoardColumn[] = [
	{ id: "todo", title: "Planned" },
	{ id: "doing", title: "In progress" },
	{ id: "done", title: "Done", autoSort: "start" },
];
const tasks = [
	{ id: "spec", title: "Write the specification" },
	{ id: "prototype", title: "Build the prototype" },
];

/** 移动和历史都写入本地受控状态，不连接后端。 */
export function EditableBoard() {
	const scope = useRef<HTMLDivElement>(null);
	const history = useMemo(() => createHistory(), []);
	const [state, setState] = useState<BoardState>({
		columns: columns.map((column) => column.id),
		order: { todo: ["spec"], doing: ["prototype"], done: [] },
	});
	useHistoryShortcuts(history, { scope });

	const apply = useCallback((move: BoardMove) => {
		setState((current) => applyMove(current, move));
	}, []);
	const onMove = useCallback(
		(move: BoardMove) => {
			apply(move);
			history.push({
				label: `Move ${move.cardId}`,
				undo: () => apply(invertMove(move)),
				redo: () => apply(move),
			});
		},
		[apply, history],
	);

	return (
		<div ref={scope}>
			<HistoryButtons history={history} />
			<Board
				aria-label="Editable board"
				columns={columns}
				cards={tasks}
				order={state.order}
				renderCard={(task) => <span>{task.title}</span>}
				getCardLabel={(task) => task.title}
				onMove={onMove}
				moveMenu="always"
			/>
		</div>
	);
}
```
<!-- example:editable:end -->

Providing `onMove` enables editing. It receives a `BoardMove` with source/destination positions and neighbouring ids; `to.index` counts the destination without the moved card. The board previews pending moves until the callback settles. On a throw or rejected promise it rolls back its preview and calls `onMoveError`. After completion, `order` is authoritative: update it before returning. The package cannot undo changes you have already persisted or written into your own state; implement that rollback in your application when using optimistic saves.

`canMove` is synchronous and runs on target changes and again at commit. A throw rejects the move. Automatic-sort columns reject manual internal reordering and receive incoming cards at their `autoSort` end. `readOnly` disables moving even with `onMove`; `isDraggable` disables individual cards. A provided `filter` dims nonmatching cards without removing them and disables all moving; pass `undefined` when filtering ends.

History stores already-completed commands, not board snapshots. Push after the operation succeeds. Undo/redo execute your real callbacks; failure permanently discards that command. History is in memory, defaults to 50 commands and does not survive reloads. `HistoryButtons` does not install shortcuts; `useHistoryShortcuts` does.

## Canvas and narrow layouts

[examples/canvas.tsx](./examples/canvas.tsx) uses Canvas on wide containers and a one-column switcher on narrow containers. Order, selection and active column live above the layout so they survive remounting.

<!-- example:canvas:start -->
```tsx
import { Board, type BoardProps, ResponsiveLayout } from "@violetjs/kanban";
import { Canvas } from "@violetjs/kanban/canvas";
import { applyMove, type BoardState } from "@violetjs/kanban/core";
import { useState } from "react";

interface Task {
	id: string;
	title: string;
}

interface CanvasBoardState {
	order: BoardState["order"];
	activeColumn: string;
	selectedCardId: string | null;
}

const columns = [
	{ id: "todo", title: "Planned" },
	{ id: "doing", title: "In progress" },
	{ id: "done", title: "Done" },
];
const tasks: Task[] = [
	{ id: "spec", title: "Write the specification" },
	{ id: "prototype", title: "Build the prototype" },
];

/** 两种布局切换会重新挂载子树；把需要保留的状态放在它们之外。 */
export function CanvasBoard() {
	const [state, setState] = useState<CanvasBoardState>({
		order: { todo: ["spec"], doing: ["prototype"], done: [] },
		activeColumn: "todo",
		selectedCardId: null,
	});
	const board: BoardProps<Task> = {
		columns,
		cards: tasks,
		order: state.order,
		renderCard: (task) => <span>{task.title}</span>,
		getCardLabel: (task) => task.title,
		onMove: (move) => {
			setState((current) => ({
				...current,
				order: applyMove(
					{ columns: columns.map((column) => column.id), order: current.order },
					move,
				).order,
			}));
		},
		activeColumn: state.activeColumn,
		onActiveColumnChange: (activeColumn) =>
			setState((current) => ({ ...current, activeColumn })),
		selectedCardId: state.selectedCardId,
		onSelectedCardChange: (selectedCardId) =>
			setState((current) => ({ ...current, selectedCardId })),
	};

	return (
		<ResponsiveLayout
			narrow={<Board {...board} aria-label="Narrow canvas board" layout="switcher" />}
		>
			<Canvas aria-label="Board canvas" style={{ height: 400 }}>
				<Board {...board} aria-label="Canvas board" />
			</Canvas>
		</ResponsiveLayout>
	);
}
```
<!-- example:canvas:end -->

Canvas pans its background and zooms with Ctrl/⌘+wheel, touch pinch, buttons or keys; ordinary wheel scrolling remains page scrolling. Give it a height (default `32rem`). Its scale defaults to 0.3–2; initial fitting stops at 0.8–1. `defaultViewport` is initial state, not a controlled `viewport` prop. Use its ref and `onViewportChange` to integrate viewport persistence.

ResponsiveLayout measures its container, not the window, with a default breakpoint of 768px. Only one branch is mounted. Server rendering and the first client render use the wide branch, then measurement may switch it. A hidden zero-width container keeps the previous layout; environments without ResizeObserver do not observe later resizes. A stable page scrollbar gutter prevents layout-induced breakpoint oscillation.

In `layout="switcher"`, tabs show one column at a time; pointer dragging cannot cross columns. Keyboard moving and the always-visible move menu can. Column collapse and relation lines do not apply; relation buttons jump to the other card instead.

## Relation graph

[examples/graph.tsx](./examples/graph.tsx) shares data between a Canvas/RelationGraph and its text equivalent, RelationList.

<!-- example:graph:start -->
```tsx
import { RelationList } from "@violetjs/kanban";
import { Canvas } from "@violetjs/kanban/canvas";
import type { Relation } from "@violetjs/kanban/core";
import { RelationGraph } from "@violetjs/kanban/graph";
import { useState } from "react";

const columns = [
	{ id: "todo", title: "Planned" },
	{ id: "doing", title: "In progress" },
	{ id: "done", title: "Done" },
];
const tasks = [
	{ id: "spec", title: "Write the specification" },
	{ id: "prototype", title: "Build the prototype" },
	{ id: "ship", title: "Ship the package" },
];
const relations: Relation[] = [
	{ sourceId: "prototype", targetId: "spec", type: "extends" },
	{ sourceId: "prototype", targetId: "ship", type: "blocks" },
];
const getCardLabel = (task: (typeof tasks)[number]) => task.title;

/** 同一份关系同时呈现为图形和可阅读的列表。 */
export function Graph() {
	const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
	return (
		<div>
			<Canvas aria-label="Relation canvas" style={{ height: 400 }}>
				<RelationGraph
					aria-label="Package relations"
					columns={columns}
					cards={tasks}
					order={{ todo: ["ship"], doing: ["prototype"], done: ["spec"] }}
					relations={relations}
					getCardLabel={getCardLabel}
					renderCard={(task) => <span>{task.title}</span>}
					selectedCardId={selectedCardId}
					onSelectedCardChange={setSelectedCardId}
				/>
			</Canvas>
			<RelationList cards={tasks} relations={relations} getCardLabel={getCardLabel} />
		</div>
	);
}
```
<!-- example:graph:end -->

RelationGraph is read-only. It computes deterministic column-based positions from the data, uses fixed-size cards (220×72px by default), and clips overflowing content. `rootId` and `subgraph` select a related subgraph. The layout tries to reduce crossings; it does not guarantee crossing-free paths, and a relation spanning columns can pass over intervening cards. There is no virtualization or universal card-count/performance guarantee.

Relations are `{ sourceId, targetId, type }`. Built-in presentation types are `extends` (solid arrow), `fixes` (dashed arrow) and `blocks` (bar). `relationTypes` customizes labels, inverse labels and line styles. Unknown types use their name and a solid line. `checkRelation` rejects self-links, duplicates and cycles within one type; rendering supplied data does not automatically validate or persist relations. Hidden/missing endpoints produce no line. Selection is controlled and highlights direct neighbours; `hideRelations` on Board keeps the text descriptions.

## Interaction and accessibility

- Focus an editable card with Tab. Enter/Space picks it up and drops it, arrows preview a move, and Escape cancels. Moving focus away cancels too. `getCardLabel` supplies spoken names; the default is the id. Editable cards select with Alt+Enter; non-draggable selectable cards use Enter/Space. Controls inside a card keep their own interactions.
- The move menu is the single-pointer alternative to dragging. It supports arrows, Enter/Space and Escape. `moveMenu="none"` removes this alternative, so provide an equivalent control if your application needs it.
- Pointer dragging uses a 4px threshold; touch uses a 250ms hold with 8px tolerance by default. Form fields, editable content and `data-kanban-no-drag` regions do not initiate dragging. `dragController` replaces pointer handling only; keep its identity stable. Keyboard moving remains built in.
- Canvas has keyboard pan/zoom/fit and reveals focused content. Its CSS full-screen mode locks page scrolling and makes outside content inert; it is not the browser Fullscreen API. Escape first cancels an active card move, then exits full screen. Do not put a full-screen Canvas under a transformed ancestor.
- Locale defaults to `en`; `zh-CN` and partial `messages` overrides are available. Relation text and live announcements complement visual lines. A custom card still needs meaningful text and accessible controls.
- Reduced-motion preferences disable board position/collapse motion and animated canvas zoom; relation jumps become immediate. This is not a claim of real-device or screen-reader certification. Review the final application with its target assistive technology and devices.

`renderCard` can run twice during pointer dragging because of the inert, assistive-technology-hidden floating copy. Avoid duplicate DOM ids and one-shot side effects in card content. `renderColumnHeader` and `renderEmpty` replace their respective contents; returning `null` suppresses them. When you provide only part of a column's cards (a "show more" list), set `column.total` so the header and switcher tabs show the real count, and put the control in `renderColumnFooter`, which renders after the cards. Quick add (`onAddCard`) and InlineEdit only report saves; they do not own your records. Failed saves retain the draft.

## Styling and server rendering

The default CSS uses `--kanban-*` variables with light/dark defaults. Set `data-theme="light"`/`"dark"` on a component or `.light`/`.dark` on an ancestor to force a scheme. Public tokens include foreground/muted/border, column/card/canvas backgrounds, focus/danger/relation colors, radius, gap, column width, card padding, font family and canvas height; see the [full theme table](./docs/api.md#主题接缝).

The horizontal board scroller and tab strip extend 6px beyond their box to preserve focus outlines. Leave at least 6px of outer space so an edge-to-edge board does not create page overflow. Custom CSS must preserve focus visibility and non-color-only states.

Components can render server markup; DOM measurement, gestures and layout adaptation require a browser after hydration. Core math is React-free; graph coordinates do not require DOM measurement. A raw Node SSR environment should use `/unstyled` (and the CSS-free canvas/graph entries) and load styles through the host bundler rather than ask Node to execute a CSS import. Ensure server/client inputs match; responsive content intentionally begins wide. No data fetching or persistence is performed by the package.

For exact props, types, entry ownership and integration limits, see [API reference](./docs/api.md). For runnable maintenance commands, tarball verification and the publication checklist, see [DEVELOPMENT.md](./DEVELOPMENT.md). No example or maintenance command publishes the package.
