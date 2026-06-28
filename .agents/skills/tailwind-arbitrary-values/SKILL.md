---
name: tailwind-arbitrary-values
description: Use whenever writing or editing Tailwind CSS classes in this project (web/). Forbids the `-[<n>px]` arbitrary-value syntax for spacing/sizing utilities when the value is divisible by 4, and converts it to the bare numeric form (e.g. `max-w-[420px]` → `max-w-105`). Trigger on any JSX/TSX className edit, dialog sizing, layout tweaks, or when reviewing code that contains `className=` with Tailwind. Apply to width, height, max/min-width, padding, margin, gap, inset, border-radius, etc.
---

# Tailwind: prefer numeric utilities over `-[Npx]`

## The rule

This project uses **Tailwind CSS v4** with the default spacing scale, where **1 spacing unit = 4px** (`--spacing: 0.25rem`). Bare numeric utilities like `max-w-50`, `w-88`, `p-3`, `h-7`, `gap-2` are fully supported and are the project convention (see `AGENTS.md`: "支持任意数字值写法")。

**When a value is a multiple of 4px, write the numeric utility. Do NOT write the arbitrary-value form.**

| ❌ Don't (arbitrary px) | ✅ Do (numeric) | math |
|---|---|---|
| `max-w-[420px]` | `max-w-105` | 420 / 4 = 105 |
| `w-[500px]` | `w-125` | 500 / 4 = 125 |
| `h-[88px]` | `h-22` | 88 / 4 = 22 |
| `min-w-[200px]` | `min-w-50` | 200 / 4 = 50 |
| `p-[12px]` | `p-3` | 12 / 4 = 3 |
| `gap-[16px]` | `gap-4` | 16 / 4 = 4 |
| `rounded-[8px]` | `rounded-lg` (or `rounded-2`) | 8 / 4 = 2 |

Prefixes compose the same way: `sm:max-w-[420px]` → `sm:max-w-105`, `md:h-[600px]` → `md:h-150`, `hover:w-[200px]` → `hover:w-50`.

## When arbitrary values ARE correct

Keep the `-[...]` form only when the value is **not** expressible on the 4px scale, or isn't a spacing value at all:

- **Not divisible by 4**: `w-[90px]`, `h-[1.15rem]`, `top-[117px]` — no clean numeric form, keep arbitrary.
- **Non-px units / calc / dynamic**: `h-[calc(100%-1px)]`, `w-[50vw]`, `translate-y-[calc(-50%_-_2px)]`, `ring-[3px]` (ring uses its own scale, not spacing).
- **Color/opacity/content**: `bg-[#1da1f2]`, `text-[clamp(1rem,2vw,2rem)]`, `content-['→']`.
- **Theme tokens already in use**: `rounded-full`, `rounded-lg`, `text-xs`, `text-sm` — these are the design-token scale, leave them.

**Key distinction**: this rule is about *spacing-derived* utilities (w/h/min-w/max-w/p/m/gap/inset/space/translate). Things like `ring-[3px]`, `text-[10px]`, `border-[1px]` belong to their own scales and should stay as they are.

## Conversion procedure

When you write or edit a `className`, and when you see existing `-[<n>px]` on spacing utilities while editing nearby code:

1. Take the pixel value (e.g. `420`).
2. Divide by 4 → `105`.
3. Confirm the result is a clean integer. If yes → use `max-w-105`. If the original was `421px` (not divisible by 4), the arbitrary form was intentional — leave it.
4. Apply the same prefix (`sm:`, `md:`, `hover:`, etc.) as the original.

Watch for **mixed syntax on the same element** — a telltale sign of drift. `min-w-50 max-w-[320px]` should become `min-w-50 max-w-80` (320 / 4 = 80), making the two utilities consistent.

## What to leave alone

- **shadcn/ui primitives** in `shared/ui/` (button, input, select, dialog, etc.) are vendored components with carefully tuned arbitrary values (`h-[1.15rem]`, `ring-[3px]`, `data-[size=default]:h-9`). These are mostly non-4px or non-spacing values — don't mass-rewrite them as part of an unrelated task.
- **Focusing edits**: only convert arbitrary values in the file/element you're actively touching, or that the user points out. Don't open a sweeping refactor PR unless explicitly asked.

## Examples from this codebase

Real before/after that this project should follow:

- `DialogContent className="sm:max-w-[420px]"` → `className="sm:max-w-105"` (login dialog)
- `DialogContent className="sm:max-w-[500px]"` → `className="sm:max-w-125"` (admin dialogs)
- `h-7 w-[88px]` → `h-7 w-22` (data-table footer)
- `min-w-[200px] max-w-[400px]` → `min-w-50 max-w-100` (filter layout)
- `max-h-[200px]` → `max-h-50` (uploader)
- `w-[1px]` → keep as `w-px` (1px is the `px` token, not arbitrary; or `w-[1px]` is fine too since 1 isn't a 4px multiple)

## Quick self-check

Before finalizing any `className` string, scan it for `<utility>-[<digits>px]` on spacing properties. For each, divide by 4. If it divides evenly, you almost certainly should be using the numeric form instead.
