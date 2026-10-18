# @violetjs/kanban

Controlled kanban board for React with a React-free core. You own the columns, the cards and their order; the package renders them.

This is a workspace package and is **not published to npm**. This README covers what exists today.

## Entries

| Import | Contents |
| --- | --- |
| `@violetjs/kanban` | `Board`, `createPointerController` and types, with the default stylesheet |
| `@violetjs/kanban/unstyled` | `Board` without any CSS |
| `@violetjs/kanban/core` | React-free board state, move creation and application, drop-target resolution, auto-sort rule |
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

- A move reports the card, where it came from, where it goes (`to.index` counts the column without the dragged card), and the neighbouring card ids (`previousId`, `nextId`) so you can store a position by updating one row.
- Dropping a card shows the new order until the `onMove` call finishes. If it throws or its promise rejects, the card goes back, `onMoveError` is called and a notice is shown. Once the call has finished only `order` counts, so update it before then: optimistically inside `onMove`, or after saving and before returning. Moves still pending are applied on top of `order`, in the order they were dropped.
- `canMove` runs when the target changes and again on drop with the final move; a throw counts as a rejection. A rejected target shows a dashed red placeholder; on drop the card returns and the reason is shown (`messages.moveRejected` when you give none).
- `autoSort` marks a column whose order is yours to decide: cards entering from another column appear at that end, and manually reordering inside it is rejected with `messages.autoSorted`.
- `isDraggable(card)` disables dragging per card, `readOnly` disables it for the whole board. Form fields, editable text and elements marked `data-kanban-no-drag` never start a drag.
- While a card is dragged, `renderCard` runs once more for the floating copy (hidden from assistive technology and inert), so don't rely on unique DOM ids or one-shot effects inside it.
- Dragging starts after the pointer moves 4px (before that it is a click) and the click that follows a drag is suppressed. `Esc`, moving the pointer away from the board, or the window losing focus cancels it. On touch screens, press and hold for 250ms; moving earlier scrolls the page.
- Motion is a 200ms position transition (displacement and landing), turned off under `prefers-reduced-motion: reduce`. There is no scaling.
- Undo is not available yet.

`@violetjs/kanban/core` exposes the same logic without React: `createMove`, `applyMove`, `isNoopMove`, `locateCard`, `resolveDropTarget` and `violatesAutoSort`.

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
