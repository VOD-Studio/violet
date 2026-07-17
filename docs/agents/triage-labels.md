# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker (GitHub Issues).

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

## Label colors (for creation via `gh label create`)

When these labels don't yet exist on the repo, create them with these colors:

| Label            | Color    | Rationale              |
| ---------------- | -------- | ---------------------- |
| `needs-triage`   | `#fbca04` | Yellow — pending       |
| `needs-info`     | `#fef2c0` | Light yellow — blocked |
| `ready-for-agent`| `#0e8a16` | Green — ready          |
| `ready-for-human`| `#1d76db` | Blue — needs human     |
| `wontfix`        | `#ffffff` | White — GitHub default (already exists) |

`wontfix` is a GitHub built-in label; reuse it, do not recreate.
