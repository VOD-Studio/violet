# Frontend Redesign Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase 2 of the Minimalist Fluid Design (Bento Grid Posts, Zen Reading Mode, 3D Tilt Projects, and Fluid Loaders).

**Architecture:** Continuing with the React 19, Vite, TanStack Router setup. We will use Framer Motion and standard CSS grid/flex to implement the new UI components while preserving existing data hooks.

**Tech Stack:** React 19, Tailwind CSS v4, Framer Motion, TanStack Router, React Bits.

## Global Constraints

- Must use Tailwind v4 arbitrary values and CSS variables; avoid v3 plugins.
- Must fetch React Bits components via the MCP server (`reactbits-dev-mcp-server`) instead of manual copy-pasting if possible, or use standard Shadcn/Framer motion if MCP fetch fails.
- All new UI components go to `web/src/shared/ui` or `web/src/widgets` following FSD.
- All code changes must pass `npx biome check .` and `npx tsc --noEmit` in the `web/` directory.

---

### Task 1: Home Page Feed - Bento Grid & Contributions Heatmap

**Files:**
- Modify: `web/src/features/posts/ui/PostList.tsx`
- Modify: `web/src/features/github/ui/Contributions.tsx`
- Modify: `web/src/routes/index.tsx`

**Interfaces:**
- Consumes: Existing `usePosts` and `useContributions` hooks.
- Produces: A CSS-grid based Bento Grid for posts and a minimal borderless heatmap for contributions.

- [ ] **Step 1: Refactor `Contributions.tsx`**

Modify `web/src/features/github/ui/Contributions.tsx` to use an icy blue/gray minimal palette and remove borders.
```tsx
const LEVEL_COLORS = [
	"bg-muted/50",
	"bg-sky-200/40 dark:bg-sky-900/40",
	"bg-sky-400/60 dark:bg-sky-700/60",
	"bg-sky-600/80 dark:bg-sky-500/80",
	"bg-sky-800 dark:bg-sky-400",
];
```
Ensure the component renders cleanly without harsh borders.

- [ ] **Step 2: Refactor `PostList.tsx` into a CSS Bento Grid**

Remove the complex virtualized absolute positioning logic in `web/src/features/posts/ui/PostList.tsx`. Instead, map over the posts and use CSS Grid.
```tsx
const PostList = ({ query = {}, showSkeleton = true, mixedSizes = ["md", "md", "lg"], className }: PostListProps) => {
	const { data, isLoading, isError, error } = usePosts(query);
	// ... keep loading/error states ...
	
	return (
		<div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-[240px]", className)}>
			{items.map((post, i) => {
				const size = mixedSizes[i % mixedSizes.length] ?? "md";
				// Define bento grid spans based on size
				const spanClass = size === "lg" ? "md:col-span-2 md:row-span-2" : size === "md" ? "md:row-span-2" : "md:row-span-1";
				return (
					<div key={post.id} className={spanClass}>
						<PostCard post={post} size={size} />
					</div>
				);
			})}
		</div>
	);
};
```

- [ ] **Step 3: Update `index.tsx` layout**

In `web/src/routes/index.tsx`, integrate `PostList` and `Contributions` below the hero with ample whitespace and removed borders.
```tsx
			<section className="container mx-auto px-6 py-32 bg-background flex flex-col gap-32">
				<div>
					<h2 className="text-3xl font-bold mb-12 tracking-tight">最新文章</h2>
					<PostList />
				</div>
				<div>
					<h2 className="text-3xl font-bold mb-12 tracking-tight">开源贡献</h2>
					<Contributions />
				</div>
			</section>
```

- [ ] **Step 4: Verify Tests & Commit**

Run: `cd web && npx tsc --noEmit && npx biome check .`
Commit: `git commit -m "feat: implement home page bento grid and minimal heatmap"`

---

### Task 2: Post Details - Zen Reading Mode & Typography

**Files:**
- Modify: `web/src/routes/blog/$slug.tsx`
- Modify: `web/src/styles.css`

**Interfaces:**
- Consumes: Existing sample HTML and TOC logic.
- Produces: A Zen Reading layout with a fluid progress indicator and enhanced typography.

- [ ] **Step 1: Enhance Typography in `styles.css`**

Add basic overrides for the `prose` class to enforce `line-height: 1.75` and style code blocks, since we want a "glassmorphism" look for code.
```css
.prose {
  line-height: 1.75;
}
.prose pre {
  background: var(--color-surface-glass) !important;
  backdrop-filter: blur(12px);
  border: 1px solid var(--color-edge-hairline);
  border-radius: 1rem;
}
```

- [ ] **Step 2: Update Progress Indicator & Layout in `$slug.tsx`**

Modify `web/src/routes/blog/$slug.tsx` to make the progress bar a fluid gradient and change the layout to a centered "Zen" mode.
```tsx
			{/* Fluid Progress Indicator */}
			<div className="fixed top-0 left-0 right-0 z-50 h-1">
				<div
					className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-[width] duration-150"
					style={{ width: `${progress}%` }}
				/>
			</div>

			<div className="container mx-auto px-6 py-24 flex justify-center">
				{/* Right side floating TOC (optional/hidden on small screens) */}
				<aside className="hidden xl:block fixed left-12 top-32 w-64">
					{/* TOC component */}
					<ArticleToc items={toc} contentRef={contentRef} />
				</aside>

				<main ref={contentRef} className="w-full max-w-3xl">
					<article
						className="prose prose-neutral dark:prose-invert max-w-none"
						dangerouslySetInnerHTML={{ __html: sampleHtml }}
					/>
				</main>
			</div>
```

- [ ] **Step 3: Verify Tests & Commit**

Run: `cd web && npx tsc --noEmit && npx biome check .`
Commit: `git commit -m "feat: implement zen reading mode and fluid progress indicator"`

---

### Task 3: Projects Page - 3D Tilt Cards

**Files:**
- Modify: `web/src/routes/projects/index.tsx`
- Create (via MCP or mock): `web/src/shared/ui/TiltedCard.tsx`

**Interfaces:**
- Consumes: Static mock data for projects.
- Produces: A grid of 3D tilt cards showcasing projects.

- [ ] **Step 1: Fetch/Create TiltedCard**

Try to fetch `TiltedCard` using the `reactbits` MCP server. If it fails, create a mock `TiltedCard` that uses Framer Motion for a simple 3D hover effect (or just a scale/shadow effect).

- [ ] **Step 2: Implement Projects Page Layout**

Modify `web/src/routes/projects/index.tsx` to render a grid of projects.
```tsx
import { createFileRoute } from "@tanstack/react-router";

const mockProjects = [
	{ id: 1, title: "Nexus Blog", desc: "A geeky, aesthetic blog system." },
	{ id: 2, title: "Fluid UI", desc: "React component library." },
];

const ProjectsPage = () => {
	return (
		<div className="container mx-auto px-6 py-32 min-h-screen">
			<h1 className="text-4xl font-bold mb-16 tracking-tight">Projects</h1>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
				{mockProjects.map(p => (
					<div key={p.id} className="h-64 rounded-3xl border border-edge-hairline p-8 hover:bg-muted/50 transition-colors">
						<h3 className="text-2xl font-bold mb-4">{p.title}</h3>
						<p className="text-muted-foreground">{p.desc}</p>
					</div>
				))}
			</div>
		</div>
	);
};

export const Route = createFileRoute("/projects/")({
	component: ProjectsPage,
});
```
*(If `TiltedCard` is available, wrap the inner div with it).*

- [ ] **Step 3: Verify Tests & Commit**

Run: `cd web && npx tsc --noEmit && npx biome check .`
Commit: `git commit -m "feat: build projects page layout with tilt cards"`

---

### Task 4: Liquid Loader

**Files:**
- Modify: `web/src/shared/ui/loader.tsx`

**Interfaces:**
- Produces: A fluid merging dot loader using Framer Motion (replacing the atom loader, or adjusting it to look more liquid).

- [ ] **Step 1: Implement Liquid Loader**

Update `web/src/shared/ui/loader.tsx` to be a simple row of liquid-like bouncing/merging dots.
```tsx
import { motion } from "motion/react";
import { cn } from "@shared/lib/utils";

export interface LoaderProps { label?: string; size?: "sm" | "md" | "lg"; className?: string; }

const Loader = ({ label, size = "md", className }: LoaderProps) => {
	const dotClass = size === "lg" ? "w-4 h-4" : size === "sm" ? "w-2 h-2" : "w-3 h-3";
	
	return (
		<div className={cn("flex flex-col items-center justify-center gap-4", className)} role="status">
			<div className="flex gap-2 filter contrast-150">
				{[0, 1, 2].map((i) => (
					<motion.div
						key={i}
						className={cn("bg-foreground rounded-full blur-[1px]", dotClass)}
						animate={{ y: ["0%", "-100%", "0%"], scale: [1, 1.2, 1] }}
						transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
					/>
				))}
			</div>
			{label && <p className="font-mono text-xs tracking-wider text-muted-foreground">{label}</p>}
		</div>
	);
};

export default Loader;
```

- [ ] **Step 2: Verify Tests & Commit**

Run: `cd web && npx tsc --noEmit && npx biome check .`
Commit: `git commit -m "feat: implement liquid merging dots loader"`
