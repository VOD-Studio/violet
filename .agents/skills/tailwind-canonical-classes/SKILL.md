---
name: tailwind-canonical-classes
description: Use whenever writing or editing Tailwind CSS classes in this project (web/). Enforces Tailwind CSS v4 canonical class forms. This includes both the project convention that 4px-multiple spacing values use bare numeric utilities and the canonical forms suggested by Tailwind CSS IntelliSense's suggestCanonicalClasses feature (important suffix, negative zero removal, logical property renames, CSS variable shorthand, deprecated utility names, etc.). Trigger on any JSX/TSX className edit, className review, or when Tailwind IntelliSense shows a canonical form suggestion.
---

# Tailwind: prefer canonical class forms

## The rule

This project uses **Tailwind CSS v4**. When editing `className`, write classes in the canonical form preferred by Tailwind v4.

Canonical forms come from two sources:

1. **Project convention (static)**: spacing/sizing pixel values divisible by 4 must use bare numeric utilities.
2. **Tailwind CSS IntelliSense `suggestCanonicalClasses` (dynamic)**: the extension reads the project's `designSystem` and suggests canonical rewrites on a per-class basis.

**When Tailwind suggests a canonical form, accept it. Do NOT keep the legacy/arbitrary form.**

The `suggestCanonicalClasses` mappings are not hardcoded — they come from `designSystem.canonicalizeCandidates()` and reflect the current project's `@theme` tokens and plugins. The tables below list the common, stable cases; always prefer the live suggestion from IntelliSense when it conflicts with a static rule.

## Spacing/sizing: 4px → numeric utilities

This project uses the default Tailwind v4 spacing scale where **1 spacing unit = 4px** (`--spacing: 0.25rem`).

**When a pixel value is a multiple of 4, use the numeric utility. Do NOT use the arbitrary-value form.**

| ❌ Don't | ✅ Do | math |
|---|---|---|
| `w-[88px]` | `w-22` | 88 / 4 = 22 |
| `h-[120px]` | `h-30` | 120 / 4 = 30 |
| `p-[12px]` | `p-3` | 12 / 4 = 3 |
| `m-[16px]` | `m-4` | 16 / 4 = 4 |
| `gap-[24px]` | `gap-6` | 24 / 4 = 6 |
| `min-w-[200px]` | `min-w-50` | 200 / 4 = 50 |
| `max-w-[400px]` | `max-w-100` | 400 / 4 = 100 |
| `rounded-[8px]` | `rounded-2` (or `rounded-lg`) | 8 / 4 = 2 |
| `inset-[32px]` | `inset-8` | 32 / 4 = 8 |

Prefixes and variants compose the same way: `sm:max-w-[420px]` → `sm:max-w-105`, `hover:w-[200px]` → `hover:w-50`.

### When arbitrary values ARE correct

Keep the `-[...]` form only when the value is **not expressible on the 4px scale**, or isn't a spacing value:

- **Not divisible by 4**: `w-[90px]`, `top-[117px]` — no clean numeric form, keep arbitrary.
- **Non-px units / calc / dynamic**: `h-[calc(100%-1px)]`, `w-[50vw]`, `translate-y-[calc(-50%_-_2px)]`.
- **Color/opacity/content**: `bg-[#1da1f2]`, `text-[clamp(1rem,2vw,1.5rem)]`, `content-['→']`.
- **Non-spacing scales**: `ring-[3px]`, `border-[1px]`, `text-[10px]` belong to their own scales — leave them unless IntelliSense suggests a canonical form.

## Canonical rewrites from `suggestCanonicalClasses`

These are the common rewrites produced by Tailwind CSS IntelliSense. Treat them as a reference; the extension may produce project-specific mappings based on your design system.

### Important modifier placement

In Tailwind v4, the canonical `!important` modifier is appended to the class, not prepended.

| ❌ Don't | ✅ Do |
|---|---|
| `!m-0` | `m-0!` |
| `!bg-transparent` | `bg-transparent!` |
| `!flex` | `flex!` |
| `md:!p-4` | `md:p-4!` |
| `hover:!text-red-500` | `hover:text-red-500!` |

Apply this to every utility in a `className` string that uses the leading `!` form.

### Negative zero removal

Negative zero utilities produce no visual difference. Canonical form drops the leading `-`.

| ❌ Don't | ✅ Do |
|---|---|
| `-m-0` | `m-0` |
| `-mt-0` | `mt-0` |
| `-p-0` | `p-0` |
| `-inset-0` | `inset-0` |

Only apply to `0` values. `-m-4` stays `-m-4`.

### Logical property renames

Tailwind v4 renames logical properties to use `s` (start) / `e` (end) instead of `start` / `end` as the utility prefix.

| ❌ Don't | ✅ Do |
|---|---|
| `start-4` | `inset-s-4` |
| `end-4` | `inset-e-4` |
| `ms-4` | `ml-4` or `me-4` — follow project convention; IntelliSense suggests the canonical physical or logical form |

`ml-4` / `mr-4` are physical, not logical — leave them alone unless the extension suggests otherwise.

### CSS variable and theme shorthand

Tailwind v4 prefers CSS variable shorthand over `var()` and `theme()`.

| ❌ Don't | ✅ Do |
|---|---|
| `text-[var(--color-text)]/90` | `text-(--color-text)/90` |
| `bg-[theme(colors.red.500)]` | `bg-red-500` when possible, or `bg-(color:red-500)` |
| `[--w-padding:theme(spacing.1)]` | `[--w-padding:--spacing(1)]` |
| `text-[theme(fontSize.xl)]` | `text-xl` when possible |

When you see `theme(...)` or `var(--...)` inside arbitrary values, prefer the v4 `--*` CSS variable function shorthand if IntelliSense offers it.

### Deprecated named utilities

A few utility names have canonical replacements:

| ❌ Don't | ✅ Do |
|---|---|
| `order-none` | `order-0` |
| `break-words` | `wrap-break-word` |
| `overflow-ellipsis` | `text-ellipsis` |
| `flex-grow` | `grow` |
| `flex-grow-0` | `grow-0` |
| `flex-shrink` | `shrink` |
| `flex-shrink-0` | `shrink-0` |

### Arbitrary value simplifications

Tailwind may suggest replacing an arbitrary value with a named scale value:

| ❌ Don't | ✅ Do |
|---|---|
| `p-[2px]` | `p-0.5` |
| `rounded-[9999px]` | `rounded-full` |
| `opacity-[0.5]` | `opacity-50` |
| `z-[10]` | `z-10` |

These overlap with the 4px rule above; prefer the named utility whenever it exists.

## What to leave alone

- **shadcn/ui primitives** in `shared/ui/` (button, input, select, dialog, etc.) are vendored components with carefully tuned arbitrary values (`h-[1.15rem]`, `ring-[3px]`, `data-[size=default]:h-9`). These are mostly non-4px or non-spacing values — don't mass-rewrite them as part of an unrelated task.
- **Focusing edits**: only convert classes in the file/element you're actively touching, or that the user points out. Don't open a sweeping refactor unless explicitly asked.
- **Non-utility strings**: `data-[state=open]` variants, arbitrary selectors, custom CSS class names — these are not Tailwind utilities.

## Conversion procedure

When you write or edit a `className`:

1. Scan the string for:
   - `-[<n>px]` arbitrary values on spacing utilities → divide by 4, use numeric form if integer.
   - Leading `!` on utilities → move to suffix.
   - `-0` utilities → drop the minus.
   - `start-` / `end-` on inset utilities → use `inset-s-` / `inset-e-`.
   - `theme(...)` or `var(--...)` inside `[...]` arbitrary values → prefer `--*` shorthand when offered.
   - Deprecated utility names (`flex-grow`, `order-none`, etc.).
2. For each non-canonical form, apply the rewrite from the tables above.
3. Preserve all prefixes (`sm:`, `md:`, `hover:`, `dark:`, etc.) and combine order.
4. If Tailwind IntelliSense shows a `suggestCanonicalClasses` quick fix, prefer its suggestion over the static tables.
5. Run the same check on the whole file or component if the user asked for a className cleanup.

## Examples

- `className="!m-0 !bg-transparent"` → `className="m-0! bg-transparent!"`
- `className="-m-0 -p-0"` → `className="m-0 p-0"`
- `className="start-4 end-4"` → `className="inset-s-4 inset-e-4"`
- `className="max-w-[400px] !p-[2px]"` → `className="max-w-100 p-0.5!"`
- `className="text-[var(--color-text)]/90"` → `className="text-(--color-text)/90"`
- `className="flex-grow order-none"` → `className="grow order-0"`

## Quick self-check

Before finalizing any `className` string, look for:

- `<utility>-[<digits>px]` on spacing properties → divide by 4, use numeric if integer.
- Leading `!` on utilities → move to suffix.
- `-0` utilities → drop the minus.
- `start-` / `end-` on inset utilities → use `inset-s-` / `inset-e-`.
- `theme(...)` or `var(--...)` inside `[...]` arbitrary values → prefer `--*` shorthand when offered.
- Deprecated utility names → use canonical replacement.
