# @violetjs/kanban

Controlled kanban board for React with a React-free core. You own the columns, the cards and their order; the package renders them.

This is a workspace package and is **not published to npm**. This README covers what exists today.

## Entries

| Import | Contents |
| --- | --- |
| `@violetjs/kanban` | `Board`, `ResponsiveLayout`, `InlineEdit`, `RelationList`, `HistoryButtons`, history hooks, `createHistory`, `createPointerController` and types, with the default stylesheet |
| `@violetjs/kanban/unstyled` | The same exports without any CSS |
| `@violetjs/kanban/core` | React-free board state, moves, drop-target resolution, auto-sort rule, keyboard steps, undo history, relation rules, graph layout and subgraph, viewport math |
| `@violetjs/kanban/canvas` | `Canvas`, a pannable and zoomable viewport for the board or the graph (import the stylesheet once) |
| `@violetjs/kanban/graph` | `RelationGraph`, a read-only relation graph (import the stylesheet once) |
| `@violetjs/kanban/styles.css` | The default stylesheet on its own |

The package does not depend on `@violet/ui` or any site module. React 19 is a peer dependency.

## Quick start

```tsx
import { Board } from "@violetjs/kanban";

interface Task {
  id: string; // the only field the board requires
  title: string;
}

const tasks: Task[] = [
  { id: "t1", title: "Write the spec" },
  { id: "t2", title: "Build the prototype" },
];

export function Roadmap() {
  return (
    <Board
      columns={[
        { id: "todo", title: "Planned" },
        { id: "doing", title: "In progress" },
      ]}
      cards={tasks}
      order={{ todo: ["t1"], doing: ["t2"] }}
      renderCard={(task) => <span>{task.title}</span>}
    />
  );
}
```

- `columns` is the left-to-right column order. Use your own column type if you need extra fields; the slots receive it as given.
- `cards` is a pool in any order. `order` maps each column id to the card ids shown in it, top to bottom.
- Duplicate ids are shown once, ids missing from `cards` are skipped, and cards no column lists are not rendered.
- Without `onMove` the board is read-only: it renders no controls of its own.

## Moving cards

Pass `onMove` and the board becomes editable: users drag cards within a column or to another one with a mouse, pen or finger. The board never owns the data; it reports each move and you update `order`.

```tsx
<Board
  columns={[
    { id: "todo", title: "Planned" },
    { id: "done", title: "Done", autoSort: "start" },
  ]}
  cards={tasks}
  order={order}
  renderCard={(task) => <span>{task.title}</span>}
  canMove={(move) =>
    move.to.columnId === "done" && !isReleased(move.cardId)
      ? { allowed: false, reason: "Release it first." }
      : { allowed: true }
  }
  onMove={async (move) => {
    setOrder((current) => applyMove({ columns: columnIds, order: current }, move).order); // from "@violetjs/kanban/core"
    await save(move);
  }}
  onMoveError={(error) => report(error)}
/>
```

- A move reports the card, where it came from, where it goes (`to.index` counts the column without the dragged card), and the neighbouring card ids at the destination (`previousId`, `nextId`) and at the origin (`fromPreviousId`, `fromNextId`) so you can store a position by updating one row.
- Dropping a card shows the new order until the `onMove` call finishes. If it throws or its promise rejects, the card goes back, `onMoveError` is called and a notice is shown. Once the call has finished only `order` counts, so update it before then: optimistically inside `onMove`, or after saving and before returning. Moves still pending are applied on top of `order`, in the order they were dropped.
- `canMove` runs when the target changes and again on drop with the final move; a throw counts as a rejection. A rejected target shows a dashed red placeholder; on drop the card returns and the reason is shown (`messages.moveRejected` when you give none).
- `autoSort` marks a column whose order is yours to decide: cards entering from another column appear at that end, and manually reordering inside it is rejected with `messages.autoSorted`.
- `isDraggable(card)` disables dragging per card, `readOnly` disables it for the whole board. Form fields, editable text and elements marked `data-kanban-no-drag` never start a drag.
- While a card is dragged, `renderCard` runs once more for the floating copy (hidden from assistive technology and inert), so don't rely on unique DOM ids or one-shot effects inside it.
- Dragging starts after the pointer moves 4px (before that it is a click) and the click that follows a drag is suppressed. `Esc`, moving the pointer away from the board, or the window losing focus cancels it. On touch screens, press and hold for 250ms; moving earlier scrolls the page.
- Motion is a 200ms position transition (displacement and landing), turned off under `prefers-reduced-motion: reduce`. There is no scaling.

`@violetjs/kanban/core` exposes the same logic without React: `createMove`, `applyMove`, `invertMove`, `isNoopMove`, `locateCard`, `resolveDropTarget`, `violatesAutoSort`, `stepTarget` and `createHistory`.

### Keyboard and the "Move to…" menu

Editable cards are focusable (`Tab`). Press `Space` or `Enter` on the card itself to pick it up, `↑ ↓` to move it within its column, `← →` to move it to the neighbouring column, `Space` or `Enter` to drop it, `Esc` to cancel. Moving focus off the card (`Tab`, clicking elsewhere) also cancels. Each step is announced through an `aria-live` region in English or Simplified Chinese; `getCardLabel(card)` supplies the card's spoken name (its `id` by default). While a card is held, the arrow keys, `Space`, `Enter` and `Esc` do not reach page-level shortcuts.

- The card stays in its column and shows at the previewed position; nothing is committed until you drop it, and `Esc` restores it. `canMove` is checked on every step and again on drop, and rejected steps show the reason in the notice instead of moving.
- Inside an auto-sort column `↑ ↓` is always rejected, including right after entering it: the position is yours to decide.
- Each draggable card also carries a "Move to…" menu button (`aria-haspopup="menu"`) listing the other columns; choosing one moves the card to that column's entry end (or its end). It is the single-pointer alternative to dragging (WCAG 2.2, 2.5.7). It opens with a click or `↓`, arrow keys move between items, `Enter` or `Space` selects, `Esc` closes. `moveMenu` is `"hover"` (shown on hover or focus, and always on devices without hover; the default), `"always"` or `"none"`.
- `Enter` on a focused editable card picks it up, so a detail view should be opened from a control inside the card (a button or link keeps its own `Enter`). Key repeat, modifier combinations (such as `Alt+←`) and IME composition are ignored while moving.
- A step moves one column or one place at a time, so a column that `canMove` rejects blocks the way; use the menu to jump over it.
- Keyboard moving does not go through `DragController`, which only handles pointer input.

### Replacing the drag controller

`dragController` takes any `DragController` (keep its identity stable, for example at module level: a new one re-attaches and cancels a drag in progress): an object with `attach(host)` that turns input into `host.start`, `host.move`, `host.drop` and `host.cancel` calls and returns a cleanup function. The default is `createPointerController({ threshold, touchHoldDelay, touchTolerance })`.

## Column shell and filtering

Everything here is opt-in; saving and validation stay with you.

```tsx
<Board
  /* … */
  collapsible
  onAddCard={async ({ columnId, title }) => { await api.addCard(columnId, title); }}
  filter={query ? (task) => task.title.includes(query) : undefined}
  renderCard={(task) => (
    <InlineEdit label="Card title" value={task.title} onSave={(title) => api.rename(task.id, title)} />
  )}
/>
```

- **Collapse and counts.** `collapsible` adds a toggle to each column header (opt a column out with `column.collapsible: false`). A collapsed column keeps its header and count; its cards and add form become `inert`, so `Tab` and screen readers skip them. State is uncontrolled (`defaultCollapsedColumns`) or controlled (`collapsedColumns`), and `onCollapsedColumnsChange` always reports the full list. Moving a card into a collapsed column (menu or keyboard) expands it, while a pointer drop onto a collapsed column has no target — expand it first, because the card and its placeholder would be invisible. The collapsed list only applies to columns that can collapse. The height animates over 200ms and is instant under `prefers-reduced-motion`.
- **Quick add.** `onAddCard({ columnId, title })` shows an "Add card" button at the bottom of every column (`column.quickAdd: false` opts one out; read-only boards show none). It opens a title field: `Enter` saves and keeps the field open for the next one, `Esc` closes it. A rejected or throwing `onAddCard` keeps the typed title, shows an error and calls `onAddCardError`.
- **Inline title editing.** `InlineEdit` renders the text as a button; clicking it turns it into an input. `Enter` or leaving the field saves, `Esc` discards, an unchanged value never calls `onSave`, and an empty value is refused unless `allowEmpty`. Failure stays in the editor with the text intact. Render it inside `renderCard` — it uses the board's tokens, and typing or pressing in the input never lifts or drags the card. Dragging from the text itself still drags the card; a plain click edits.
- **Filter.** Pass `filter` (a predicate) while a filter is on and `undefined` otherwise. Non-matching cards fade but keep their place and stay reachable; the column count reads "matched/total". While the filter is on, the whole board stops moving cards (pointer, keyboard and the "Move to…" menu) and says so, so nobody reorders cards they can't see. A throwing predicate counts as a match.

Focus rings are never clipped: the collapsing body clips overflow, so it keeps 12px of padding offset by a negative margin (and ignores pointer events itself), the same trick the horizontal scroller uses. `InlineEdit` follows the board's `locale` unless you pass its own.

## Relations

A relation is `{ sourceId, targetId, type }`, read as "source *type* target" (for example "A extends B"). The board draws them and describes them in text; the rules live in `/core`.

```tsx
<Board
  /* … */
  relations={[{ sourceId: "a", targetId: "d", type: "extends" }]}
  selectedCardId={selected}
  onSelectedCardChange={setSelected}
  hideRelations={hidden}
/>
```

- **Line styles tell types apart, not colour.** The built-in types are `extends` (solid with an arrowhead), `fixes` (dashed with an arrowhead) and `blocks` (solid with a bar at the end). `relationTypes` adds your own or overrides these: `{ label, inverseLabel, line: "solid" | "dashed" | "blocker" }`. A type with no mapping draws solid and uses its name as the text. Colours are `--kanban-relation` and `--kanban-relation-blocker`.
- **Lines stay attached.** Cards in different columns connect side to side; two cards in the same column connect around the right edge so the line never crosses the cards between them. Lines follow dragging (they attach to the floating card), the reorder animation, horizontal scrolling and canvas pan and zoom. A relation whose card is missing or inside a collapsed column is not drawn. `hideRelations` removes the lines and keeps the text.
- **Selection.** With `onSelectedCardChange`, clicking a card selects it (again to clear; the empty board clears too). Clicks on buttons, links and inputs inside a card don't count. Non-draggable cards become focusable and use `Enter` or `Space`; draggable cards keep `Enter` and `Space` for picking up and use `Alt+Enter`. The selected card and its direct neighbours stay clear, everything else and the unrelated lines fade, and the selected card has `aria-current`.
- **Text equivalent.** Every card with relations gets a screen-reader sentence ("Relations: extends Delta; is blocked by Epsilon"). `RelationList` renders the same as a list ("Alpha extends Delta"), for the whole graph or one card (`cardId`, both directions), for a narrow layout that doesn't draw lines.
- **Rules.** `@violetjs/kanban/core` has `checkRelation(existing, candidate)` — refuses a relation to itself, a duplicate, and a cycle *within one type* (it returns the path that would close). Cycles are checked per type because the directions mean opposite things ("A extends B" puts A after B, "A blocks B" puts A before B), so mixing types would give false alarms. `createAdjacency(relations)` answers `outgoing`, `incoming`, `of` and `neighbors`; `routeEdge`, `arrowHead` and `blockerBar` are the geometry the board uses.

## Undo and redo

`createHistory()` (also in `@violetjs/kanban/core`) is a plain command history that lives for the current session. It does not know what a command does: each command carries its own forward and backward actions, so moves, additions, deletions and edits all fit.

```tsx
const history = useMemo(() => createHistory(), []);

<Board
  onMove={async (move) => {
    await save(move);
    history.push({
      label: `Move ${move.cardId}`,
      undo: () => save(invertMove(move)), // from "@violetjs/kanban/core"
      redo: () => save(move),
    });
  }}
  /* … */
/>
```

- `push` records a step that has already happened, so push after the save succeeded. It clears the redo stack. Only the most recent steps are kept (`limit`); a reload starts empty.
- Undo and redo are real operations: `undo()` / `redo()` run your action and wait for it. If it throws or rejects, that step is discarded for good (`onError` is called) and the rest of the history stays usable. Only one step runs at a time; calls made meanwhile are ignored.
- A step whose forward action changed fields on the server (for example clearing a completion date) can capture them in its closure and restore them in `undo`.
- `invertMove(move)` returns the move that puts the card back. A move records the cards next to its origin, so the inverse needs no board state and stays correct when other moves happened in between.
- An error thrown by a subscriber or by `onError` never corrupts the history; it is rethrown asynchronously so it still reaches your error reporting.
- `HistoryButtons` names the buttons by their visible text, puts the next step's name in `title`, marks unavailable buttons `aria-disabled` (so focus stays put after the last undo) and announces results. `useHistoryState(history)` and `useHistoryAnnouncement(history)` expose the same state and announcement text for your own UI.
- `useHistoryShortcuts(history, { scope, enabled })` binds Ctrl/⌘+Z to undo and Ctrl/⌘+Shift+Z or Ctrl+Y to redo. It ignores inputs, textareas, selects and editable text (also inside shadow roots), combinations with `Alt`, and IME composition.

## Canvas

`Canvas` from `@violetjs/kanban/canvas` is a pannable, zoomable, full-screen-able viewport. Put a whole board (or anything else) inside it; it needs the stylesheet (`@violetjs/kanban/styles.css`, or the root entry).

```tsx
import { Canvas } from "@violetjs/kanban/canvas";

<Canvas style={{ height: 480 }}>
  <Board /* … */ />
</Canvas>
```

- Drag the background to pan. With a mouse, buttons, links, form fields and draggable cards never start a pan, so dragging a card still moves the card; read-only cards are part of the background. On touch screens there is no other way to scroll, so a finger can also start on a button or a read-only card (form fields and draggable cards still keep their own touch handling).
- `Ctrl` or `⌘` with the mouse wheel zooms around the pointer, anywhere on the canvas including the control bar (and stops the browser from zooming the page). A plain wheel is never intercepted, so the page keeps scrolling. A trackpad pinch in Safari zooms the canvas too. On touch screens two fingers zoom and pan; one finger on the canvas pans it instead of scrolling the page (`touch-action: none` on everything inside).
- The scale stays between 0.3 and 2 (`scaleLimits`). The buttons, `+` and `-` zoom in steps of 1.25 around the centre.
- It fits the window on mount and when the window or content resizes, until you pan or zoom. Fitting never goes below 0.8 (`fit.minScale`) or above 1: content that is still too large is placed at the top left and reached by panning.
- Focus the viewport (`Tab`) and use the arrow keys (`Shift` for bigger steps) to pan, `+` `-` to zoom and `0` to fit. Focusing something outside the visible area pans just far enough to show it, so focus rings are never clipped, and the page doesn't jump (a browser would otherwise scroll the page to where the clipped element sits). Every control is a real button, so everything works from the keyboard.
- The full-screen button fills the window with the canvas, locks page scrolling and makes the rest of the page `inert`, so `Tab` and screen readers stay inside the canvas. It is CSS, not the browser Fullscreen API, so `Esc` is handled by the page: it exits full screen unless a drag or a keyboard pick-up already claimed that `Esc`. Don't put the canvas inside an element with a `transform`, which would break the fixed layout. The canvas ignores an inline `height` while full screen.
- Zoom changes animate over 200ms for the buttons, keys and fit, and not at all for the wheel, drag and pinch; both are off under `prefers-reduced-motion: reduce`.
- A `ref` gives `fit()`, `zoomIn()`, `zoomOut()`, `setViewport()` and `getViewport()`; `onViewportChange` reports every change. `@violetjs/kanban/core` has the underlying pure functions (`fitViewport`, `zoomAt`, `pinchViewport`, `revealRect`, …).
- An editable board works inside a canvas at any zoom or pan: the card drops where the pointer is on screen, the floating card is scaled with the canvas, and the "Move to…" menu follows the zoom. Dropping with the pointer outside the canvas viewport has no target, so the card stays where it was.
- Dragging within 48px of the viewport edge pans the canvas each frame (faster closer to the edge, up to 1000px/s) until the content's edge is 24px from the viewport; the placeholder keeps following the column under the pointer while it pans. `Esc` during a drag or a keyboard pick-up cancels that first, so full screen stays; `Esc` with nothing picked up exits full screen. On touch screens a quick swipe starting on a card pans the canvas; hold for 250ms and the card is dragged instead.
- Viewports passed in (`defaultViewport`, `setViewport`) are corrected: the scale is clamped into the limits and non-finite numbers become 0.

## Narrow screens

On a phone a canvas makes text too small to read. `ResponsiveLayout` picks between two layouts by the width of its own container: the board in a canvas when there is room, and a switcher showing one column at a time when there isn't.

```tsx
import { Board, ResponsiveLayout } from "@violetjs/kanban";
import { Canvas } from "@violetjs/kanban/canvas";

const board = { columns, cards, order, renderCard, onMove, relations /* … */ };

<ResponsiveLayout narrow={<Board {...board} layout="switcher" />}>
  <Canvas style={{ height: 480 }}>
    <Board {...board} />
  </Canvas>
</ResponsiveLayout>
```

- **`ResponsiveLayout`** measures the container, not the window, so it is right inside a sidebar or a dialog too. Narrow means narrower than `breakpoint` (default 768px, also exported as `DEFAULT_NARROW_BREAKPOINT`). Only one of the two is ever mounted, so switching remounts the content: keep state you want to survive (the selected card, the visible column) in the page and pass it back as controlled props. `onLayoutChange` reports the change. A container with no width (`display: none`) keeps the current layout. Server rendering and the first client render use the wide content, then switch as soon as the width is known. If a page scrollbar that appears or disappears with the layout pushes the width across the breakpoint, the layout would flip back and forth; `scrollbar-gutter: stable` on the page prevents it.
- **`layout="switcher"`** puts a tab strip above the board and renders only the active column. It is a real tablist: the arrow keys move focus and switch at once (wrapping), `Home` and `End` jump to the ends, only the selected tab is in the `Tab` order, and the column is the tab panel named by its tab. The tab shows the column title and count ("matched/total" while filtering). A strip that doesn't fit scrolls sideways and keeps the selected tab in view. `activeColumn` (controlled), `defaultActiveColumn` and `onActiveColumnChange` choose the column; an unknown id falls back to the first column.
- **Moving cards.** Only one column is on screen, so a pointer drag reorders within the column and cannot cross columns; the "Move to…" menu is shown on every card (`moveMenu: "none"` still turns it off) and the arrow keys still move a picked-up card across columns. The visible column follows the card, so focus goes with it; cancelling a pick-up or a failed save brings the visible column back to where the card came from.
- **Relation markers.** There are no lines. Each card with relations gets a button per relation, read from the card's side: "extends Delta", "is blocked by Epsilon" (the other card's `getCardLabel`; long text is cut with an ellipsis and kept whole in `title`). A blocked marker is tinted with `--kanban-danger`, but the words already say it. The button's name is "{text}, go to that card"; the screen-reader summary is dropped because the buttons replace it. Pressing one switches to the other card's column, focuses it, scrolls it to the middle of the screen (instantly under `prefers-reduced-motion`) and tints its border for about 1.8 seconds so the eye finds it. The other card has the inverse marker, so the way back is one press. Cards with markers can be focused by script (`tabindex="-1"`) but stay out of the `Tab` order. `hideRelations` only hides lines, so markers stay. Markers are not drag handles and don't select the card.
- Collapsing columns and relation lines do not apply in this layout. Filtering, the quick-add row and inline editing work as usual. Texts: `switcherLabel` and `relationJump` in `messages`.

## Relation graph

`RelationGraph` from `@violetjs/kanban/graph` shows the relations between cards as a read-only graph. It takes the same data as a board, lays the cards out in columns (a roadmap's stages) and joins them with the board's relation lines. Put it in a `Canvas` to pan, zoom and go full screen; it needs the stylesheet (`@violetjs/kanban/styles.css`, or the root entry).

```tsx
import { Canvas } from "@violetjs/kanban/canvas";
import { RelationGraph } from "@violetjs/kanban/graph";

<Canvas style={{ height: 480 }}>
  <RelationGraph columns={columns} cards={cards} order={order} relations={relations}
    renderCard={(card) => card.title} />
</Canvas>
```

- **Same props as `Board`** for `columns`, `cards`, `order`, `relations`, `relationTypes`, `getCardLabel`, `selectedCardId` / `onSelectedCardChange`, `locale` and `messages`, so one set of data feeds both. `order` says which column each card belongs to and the order they start in. There is no editing: nothing is draggable and there are no `onMove` or menus.
- **The layout is computed from the input, never stored.** `layoutGraph` (in `/core`) lays columns out left to right at equal height and cards top to bottom at a fixed size (`cardSize`, default 220×72; the card body clips what doesn't fit, so limit your own lines). The same input, in the same order, always gives the same layout, and it never measures the DOM, so it also renders on the server. Within a column the order starts from `order`, then a few sweeps move each card toward the middle of its neighbours in other columns to cut crossings. Cards with no relation to another column keep their place, and relations inside one column don't affect the order. `DEFAULT_GRAPH_LAYOUT` lists the spacing options.
- **Lines.** The same lines as the board (see Relations), drawn on top of the cards. A line between columns that aren't next to each other passes over the cards in between; select a card to follow its lines.
- **Subgraph.** `rootId` shows only the cards connected to that card, and the root gets `data-root`. `subgraph` narrows it: `{ direction: "in" }` follows relations that point at the root (what extends it), `"out"` follows what it points at, the default `"both"` takes everything connected; `depth` limits the steps; `types` limits the relation types. A root that isn't in the graph shows the empty message. `relatedSubgraph` in `/core` does the same without React.
- **Selecting and reading.** Same as the board: with `onSelectedCardChange`, a click or `Enter` / `Space` on a focused card selects it, the neighbours stay clear and the rest fades; clicks on buttons and links inside a card don't count. Each column is a labelled group, each card a list item in it, and a card with relations carries the screen-reader sentence. Empty data shows `graphEmpty`.
- **Size.** 600 cards with 900 relations open, pan, zoom and select smoothly in Chromium (the browser tests record the timings), and laying out 1200 cards takes well under a second.

## Slots and messages

- `renderCard(card, { column, index })` renders the card content. The board draws the card surface.
- `renderColumnHeader(column, { count, matched })` replaces the default title and count (`matched` is the number of cards passing `filter`, or `null` without one; returning `null` shows no header). `column.title` stays the column group's accessible name.
- `renderEmpty(column)` replaces the default empty-column text; return `null` to show nothing.
- `locale` is `"en"` (default) or `"zh-CN"`. `messages` overrides any built-in text; `{count}` is replaced with plain text, never HTML.

## Theming

The default stylesheet reads only `--kanban-*` variables, with light and dark defaults that follow `prefers-color-scheme`. Map your own tokens onto them (for example `--kanban-border: var(--my-border)`). Set `data-theme="light"` or `"dark"` on the board, or put the `dark` / `light` class on an ancestor, to force a scheme.

| Variable | Controls |
| --- | --- |
| `--kanban-foreground`, `--kanban-muted`, `--kanban-border` | Text and border colors |
| `--kanban-column-background`, `--kanban-card-background` | Surfaces |
| `--kanban-radius` | Corner radius, capped at 16px |
| `--kanban-danger` | Rejected-drop placeholder and notices |
| `--kanban-gap`, `--kanban-column-width`, `--kanban-card-padding` | Spacing and column width |
| `--kanban-font-family` | Font; inherits from the host by default |

The board scrolls horizontally when columns overflow. Its scroll container keeps 6px of padding, offset by a negative margin, so focus rings of focusable card content are not clipped. The switcher's tab strip does the same. Both therefore reach 6px past the board's box: keep at least 6px of page margin on each side, or a board flush with the window edge makes the page scroll sideways.

## Server rendering

Markup is deterministic and produces no hydration warnings. Use `@violetjs/kanban/unstyled` with your own CSS, or import the styled entry once so the bundler keeps the stylesheet.

## Development

From the repository root:

```sh
make kanban-check kanban-test kanban-build
make kanban-browser
make kanban-consumer
```

`kanban-browser` runs the drag tests, the narrow-screen tests (390px and desktop width) and the relation graph tests in real Chromium (install it with `pnpm exec playwright install chromium`); touch is simulated there, so touch dragging, long press and tapping the switcher still need a check on a real device. `kanban-consumer` packs the package, installs the tarball in a temporary project outside the workspace, and checks the published types, server rendering and entry dependency graph. It never publishes.
