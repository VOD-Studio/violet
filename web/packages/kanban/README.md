# @violetjs/kanban

Controlled kanban board for React with a React-free core. You own the columns, the cards and their order; the package renders them.

This is a workspace package and is **not published to npm**. This README covers what exists today.

## Entries

| Import | Contents |
| --- | --- |
| `@violetjs/kanban` | `Board` with the default stylesheet |
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
- The board is read-only for now: it renders no controls of its own, and moving cards is not supported yet.

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
| `--kanban-gap`, `--kanban-column-width`, `--kanban-card-padding` | Spacing and column width |
| `--kanban-font-family` | Font; inherits from the host by default |

The board scrolls horizontally when columns overflow. Its scroll container keeps 6px of padding, offset by a negative margin, so focus rings of focusable card content are not clipped.

## Server rendering

Markup is deterministic and produces no hydration warnings. Use `@violetjs/kanban/unstyled` with your own CSS, or import the styled entry once so the bundler keeps the stylesheet.

## Development

From the repository root:

```sh
make kanban-check kanban-test kanban-build
make kanban-consumer
```

`kanban-consumer` packs the package, installs the tarball in a temporary project outside the workspace, and checks the published types, server rendering and entry dependency graph. It never publishes.
