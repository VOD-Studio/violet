# Admin Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the new Admin Frontend inside the existing `web/` React application, featuring a reusable DataTable and modules for Users and Emojis.

**Architecture:** We will create an `admin.tsx` layout for the `/admin` path, containing a Sidebar and Header. We will install `@tanstack/react-table` and wrap Shadcn UI table primitives into a generic `DataTable` component. Finally, we will implement the `/admin/users` and `/admin/emojis` routes using this table.

**Tech Stack:** `@tanstack/react-router`, `@tanstack/react-query`, `@tanstack/react-table`, Tailwind CSS (v4), Biome

## Global Constraints

- Run all commands inside the `web` directory.
- Use `pnpm` for package management.
- Code style: Use `npx biome check .` for linting.
- UI Components are located in `@/shared/ui` (which resolves to `web/src/shared/ui`).

---

### Task 1: Install Dependencies & Setup Admin Layout

**Files:**
- Modify: `web/package.json`
- Create: `web/src/routes/admin.tsx`
- Create: `web/src/routes/admin.index.tsx`

**Interfaces:**
- Produces: `admin.tsx` layout providing a standard left sidebar and top header for all `/admin/*` routes.

- [ ] **Step 1: Install @tanstack/react-table**

```bash
cd web
pnpm add @tanstack/react-table
```

- [ ] **Step 2: Create Admin Layout**

Create `web/src/routes/admin.tsx`:
```tsx
import { createFileRoute, Outlet, Link } from '@tanstack/react-router'
import { Users, Smile, Home } from 'lucide-react'

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
})

function AdminLayout() {
  return (
    <div className="flex h-screen w-full bg-neutral-100 dark:bg-neutral-900">
      <aside className="w-64 flex-shrink-0 border-r bg-white dark:bg-neutral-950 p-4 flex flex-col gap-2">
        <h2 className="text-xl font-bold mb-4 px-2">Admin Panel</h2>
        <Link to="/admin" className="flex items-center gap-2 p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 [&.active]:bg-neutral-200 dark:[&.active]:bg-neutral-700">
          <Home className="w-4 h-4" /> Dashboard
        </Link>
        <Link to="/admin/users" className="flex items-center gap-2 p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 [&.active]:bg-neutral-200 dark:[&.active]:bg-neutral-700">
          <Users className="w-4 h-4" /> Users
        </Link>
        <Link to="/admin/emojis" className="flex items-center gap-2 p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 [&.active]:bg-neutral-200 dark:[&.active]:bg-neutral-700">
          <Smile className="w-4 h-4" /> Emojis
        </Link>
      </aside>
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 border-b bg-white dark:bg-neutral-950 flex items-center px-4 shrink-0">
          <h1 className="font-semibold">Management</h1>
        </header>
        <div className="flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Create Admin Index Route**

Create `web/src/routes/admin.index.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/')({
  component: AdminIndex,
})

function AdminIndex() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Welcome to Admin Dashboard</h2>
      <p className="text-neutral-500">Select a module from the sidebar to manage.</p>
    </div>
  )
}
```

- [ ] **Step 4: Generate Routes**

```bash
cd web
pnpm generate-routes
```

- [ ] **Step 5: Commit**

```bash
git add web/package.json web/pnpm-lock.yaml web/src/routes/admin.tsx web/src/routes/admin.index.tsx web/src/routeTree.gen.ts
git commit -m "feat(admin): initialize admin layout and add react-table dependency"
```

### Task 2: Build the Reusable DataTable Component

**Files:**
- Create: `web/src/shared/ui/data-table.tsx`

**Interfaces:**
- Consumes: `@tanstack/react-table` and `web/src/shared/ui/table.tsx`
- Produces: `DataTable<TData, TValue>` React component.

- [ ] **Step 1: Create the DataTable Component**

Create `web/src/shared/ui/data-table.tsx`:
```tsx
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  SortingState,
  getSortedRowModel,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table"
import { Button } from "@/shared/ui/button"
import { useState } from "react"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
}

export function DataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState({})

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      rowSelection,
    },
  })

  return (
    <div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run linter on the file**

```bash
cd web && npx biome check src/shared/ui/data-table.tsx --write
```
(It is expected that it might format the file or complain about any unused imports if there are any).

- [ ] **Step 3: Commit**

```bash
git add web/src/shared/ui/data-table.tsx
git commit -m "feat(ui): add reusable DataTable component"
```

### Task 3: Implement Users Management Route

**Files:**
- Create: `web/src/routes/admin.users.tsx`

**Interfaces:**
- Consumes: `DataTable` from `web/src/shared/ui/data-table.tsx`
- Produces: `/admin/users` page displaying a mock user list with checkboxes, sorting, and pagination.

- [ ] **Step 1: Create the Users page with Table Columns**

Create `web/src/routes/admin.users.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router'
import { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/shared/ui/data-table'
import { Checkbox } from '@/shared/ui/checkbox'
import { Button } from '@/shared/ui/button'
import { ArrowUpDown } from 'lucide-react'

export const Route = createFileRoute('/admin/users')({
  component: AdminUsers,
})

type User = {
  id: string
  nickname: string
  email: string
  role: string
}

const data: User[] = [
  { id: "1", nickname: "Admin", email: "admin@example.com", role: "SuperAdmin" },
  { id: "2", nickname: "User", email: "user@example.com", role: "User" },
  { id: "3", nickname: "Alice", email: "alice@example.com", role: "User" },
]

const columns: ColumnDef<User>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "nickname",
    header: "Nickname",
  },
  {
    accessorKey: "email",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Email
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
  },
  {
    accessorKey: "role",
    header: "Role",
  },
]

function AdminUsers() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight">Users</h2>
      <DataTable columns={columns} data={data} />
    </div>
  )
}
```

- [ ] **Step 2: Generate routes**

```bash
cd web && pnpm generate-routes
```

- [ ] **Step 3: Commit**

```bash
git add web/src/routes/admin.users.tsx web/src/routeTree.gen.ts
git commit -m "feat(admin): add users management page with DataTable"
```

### Task 4: Implement Emojis Management Route

**Files:**
- Create: `web/src/routes/admin.emojis.tsx`

**Interfaces:**
- Consumes: `DataTable` from `web/src/shared/ui/data-table.tsx`
- Produces: `/admin/emojis` page displaying a mock emoji list.

- [ ] **Step 1: Create the Emojis page**

Create `web/src/routes/admin.emojis.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router'
import { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/shared/ui/data-table'
import { Checkbox } from '@/shared/ui/checkbox'
import { Button } from '@/shared/ui/button'

export const Route = createFileRoute('/admin/emojis')({
  component: AdminEmojis,
})

type Emoji = {
  id: string
  code: string
  url: string
}

const data: Emoji[] = [
  { id: "1", code: ":smile:", url: "😀" },
  { id: "2", code: ":cry:", url: "😢" },
  { id: "3", code: ":rocket:", url: "🚀" },
]

const columns: ColumnDef<Emoji>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "url",
    header: "Preview",
    cell: ({ row }) => <span className="text-2xl">{row.getValue("url")}</span>,
  },
  {
    accessorKey: "code",
    header: "Code",
  },
  {
    id: "actions",
    cell: () => {
      return (
        <Button variant="destructive" size="sm">
          Delete
        </Button>
      )
    },
  },
]

function AdminEmojis() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Emojis</h2>
        <Button>Upload Emoji</Button>
      </div>
      <DataTable columns={columns} data={data} />
    </div>
  )
}
```

- [ ] **Step 2: Generate routes**

```bash
cd web && pnpm generate-routes
```

- [ ] **Step 3: Commit**

```bash
git add web/src/routes/admin.emojis.tsx web/src/routeTree.gen.ts
git commit -m "feat(admin): add emojis management page with DataTable"
```
