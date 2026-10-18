# @violetjs/kanban

Controlled kanban board for React with a React-free core. You own the columns, the cards and their order; the package renders them.

This is a workspace package and is **not published to npm**. This README covers what exists today.

## Entries

| Import | Contents |
| --- | --- |
| `@violetjs/kanban` | `Board`, `HistoryButtons`, history hooks, `createHistory`, `createPointerController` and types, with the default stylesheet |
| `@violetjs/kanban/unstyled` | The same exports without any CSS |
| `@violetjs/kanban/core` | React-free board state, moves, drop-target resolution, auto-sort rule, keyboard steps, undo history, viewport math |
| `@violetjs/kanban/canvas` | `Canvas`, a pannable and zoomable viewport for the board (import the stylesheet once) |
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
- Focus the viewport (`Tab`) and use the arrow keys (`Shift` for bigger steps) to pan, `+` `-` to zoom and `0` to fit. Focusing something outside the visible area pans just far enough to show it, so focus rings are never clipped. Every control is a real button, so everything works from the keyboard.
- The full-screen button fills the window with the canvas, locks page scrolling and makes the rest of the page `inert`, so `Tab` and screen readers stay inside the canvas. It is CSS, not the browser Fullscreen API, so `Esc` is handled by the page: it exits full screen unless a drag or a keyboard pick-up already claimed that `Esc`. Don't put the canvas inside an element with a `transform`, which would break the fixed layout. The canvas ignores an inline `height` while full screen.
- Zoom changes animate over 200ms for the buttons, keys and fit, and not at all for the wheel, drag and pinch; both are off under `prefers-reduced-motion: reduce`.
- A `ref` gives `fit()`, `zoomIn()`, `zoomOut()`, `setViewport()` and `getViewport()`; `onViewportChange` reports every change. `@violetjs/kanban/core` has the underlying pure functions (`fitViewport`, `zoomAt`, `pinchViewport`, `revealRect`, …).
- Editing a board inside a canvas is not supported yet: pointer dragging, keyboard moves and the "Move to…" menu all assume an untransformed coordinate space, and the canvas fits at 0.8 by default. Put read-only boards in a canvas for now.
- Viewports passed in (`defaultViewport`, `setViewport`) are corrected: the scale is clamped into the limits and non-finite numbers become 0.

## Slots and messages

- `renderCard(card, { column, index })` renders the card content. The board draws the card surface.
- `renderColumnHeader(column, { count })` replaces the default title and count. `column.title` stays the column group's accessible name.
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

The board scrolls horizontally when columns overflow. Its scroll container keeps 6px of padding, offset by a negative margin, so focus rings of focusable card content are not clipped.

## Server rendering

Markup is deterministic and produces no hydration warnings. Use `@violetjs/kanban/unstyled` with your own CSS, or import the styled entry once so the bundler keeps the stylesheet.

## Development

From the repository root:

```sh
make kanban-check kanban-test kanban-build
make kanban-browser
make kanban-consumer
```

`kanban-browser` runs the drag tests in real Chromium (install it with `pnpm exec playwright install chromium`); touch is simulated there, so touch dragging still needs a check on a real device. `kanban-consumer` packs the package, installs the tarball in a temporary project outside the workspace, and checks the published types, server rendering and entry dependency graph. It never publishes.
