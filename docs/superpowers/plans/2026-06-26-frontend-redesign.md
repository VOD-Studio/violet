# Frontend Redesign Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the public-facing frontend of mimo-blog to a "Minimalist Fluid" aesthetic combining clean layouts with React Bits fluid animations.

**Architecture:** We will update Tailwind CSS v4 variables for a high-contrast minimalist look, implement global UI shells (Header, MusicPlayer) using Framer Motion and Glassmorphism, and rebuild the Home page using a full-viewport React Bits Aurora Hero and a Bento Grid post feed.

**Tech Stack:** React 19, Vite, TanStack Router, Tailwind CSS v4, Framer Motion, React Bits (via MCP).

## Global Constraints

- Must use Tailwind v4 arbitrary values and CSS variables; avoid v3 plugins.
- Must fetch React Bits components via the MCP server (`reactbits-dev-mcp-server`) instead of manual copy-pasting if possible, or use standard Shadcn/Framer motion if MCP fetch fails.
- All new UI components go to `web/src/shared/ui` or `web/src/widgets` following FSD.
- All code changes must pass `npx biome check .` and `npx tsc --noEmit` in the `web/` directory.

---

### Task 1: Base Design Tokens & Global CSS

**Files:**
- Modify: `web/src/styles.css`

**Interfaces:**
- Consumes: Tailwind v4 defaults
- Produces: Global CSS variables for background, foreground, border-edge-hairline, and typography base overrides.

- [ ] **Step 1: Write the failing test / Verify biome check**

```bash
cd web && npx biome check .
```
Expected: PASS (Baseline)

- [ ] **Step 2: Update CSS variables**

```css
/* web/src/styles.css */
@import "tailwindcss";

@theme {
  --color-background: #ffffff;
  --color-foreground: #0a0a0a;
  --color-edge-hairline: rgba(0, 0, 0, 0.05);
  
  /* Dark mode overrides */
  @media (prefers-color-scheme: dark) {
    --color-background: #0a0a0a;
    --color-foreground: #ffffff;
    --color-edge-hairline: rgba(255, 255, 255, 0.1);
  }
}

body {
  background-color: var(--color-background);
  color: var(--color-foreground);
  font-family: 'Inter', 'Geist', sans-serif;
  transition: background-color 0.3s ease, color 0.3s ease;
}
```

- [ ] **Step 3: Run linter to verify formatting**

```bash
cd web && npx biome check --apply .
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd web
git add src/styles.css
git commit -m "style: define minimalist fluid design tokens in styles.css"
```

### Task 2: Global Shell - Navigation & Header

**Files:**
- Modify: `web/src/widgets/Header.tsx`

**Interfaces:**
- Consumes: Navigation links from routing
- Produces: A sticky header that transitions to glassmorphism on scroll

- [ ] **Step 1: Implement Header Scroll Logic & Glassmorphism**

```tsx
// web/src/widgets/Header.tsx
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function Header({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled 
          ? "bg-background/70 backdrop-blur-md border-b border-edge-hairline py-2" 
          : "bg-transparent py-4"
      }`}
    >
      <div className="container mx-auto px-6 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold tracking-tighter">MIMO</Link>
        <nav className="flex gap-6 text-sm">
          <Link to="/blog" className="hover:opacity-70 transition-opacity">Blog</Link>
          <Link to="/projects" className="hover:opacity-70 transition-opacity">Projects</Link>
          <Link to="/about" className="hover:opacity-70 transition-opacity">About</Link>
        </nav>
      </div>
    </motion.header>
  );
}
```

- [ ] **Step 2: Run tests/typecheck**

```bash
cd web && npx tsc --noEmit && npx biome check --apply .
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd web
git add src/widgets/Header.tsx
git commit -m "feat: redesign header with glassmorphism and scroll transitions"
```

### Task 3: Global Shell - Floating Music Player Capsule

**Files:**
- Modify: `web/src/widgets/MusicPlayer.tsx`

**Interfaces:**
- Consumes: Audio state (playing, track info)
- Produces: Floating capsule player at the bottom edge

- [ ] **Step 1: Implement Minimalist Capsule Player**

```tsx
// web/src/widgets/MusicPlayer.tsx
import { motion } from "framer-motion";
import { useState } from "react";

export default function MusicPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <motion.div 
      className="fixed bottom-6 right-6 z-50"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <button 
        onClick={() => setIsPlaying(!isPlaying)}
        className={`flex items-center gap-2 px-4 py-2 rounded-full border border-edge-hairline backdrop-blur-md transition-all ${
          isPlaying ? "bg-foreground/10" : "bg-background/80"
        }`}
      >
        <div className="w-3 h-3 rounded-full bg-foreground flex items-center justify-center overflow-hidden">
           {isPlaying && <motion.div className="w-full h-full bg-blue-500 blur-[2px] animate-pulse" />}
        </div>
        <span className="text-xs font-medium">{isPlaying ? "Playing..." : "Play"}</span>
      </button>
    </motion.div>
  );
}
```

- [ ] **Step 2: Typecheck & lint**

```bash
cd web && npx tsc --noEmit && npx biome check --apply src/widgets/MusicPlayer.tsx
```

- [ ] **Step 3: Commit**

```bash
cd web
git add src/widgets/MusicPlayer.tsx
git commit -m "feat: redesign music player to floating capsule"
```

### Task 4: Home Page - Immersive Aurora Hero Section

**Files:**
- Modify: `web/src/widgets/Hero.tsx`
- Modify: `web/src/routes/index.tsx`

**Interfaces:**
- Consumes: React Bits Aurora (simulated here via CSS/motion if MCP fetch not executed yet, but we will mock a basic fluid background), and Blur Text.
- Produces: Full screen 100vh hero.

- [ ] **Step 1: Refactor Hero for 100vh and Fluidity**

```tsx
// web/src/widgets/Hero.tsx
import { motion } from "framer-motion";

export default function Hero() {
  return (
    <div className="relative w-full h-[100vh] flex items-center justify-center overflow-hidden bg-background">
      {/* Mock Aurora Background (to be replaced by actual React Bits component) */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/30 rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-400/30 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000" />
      </div>
      
      <div className="z-10 text-center flex flex-col items-center">
        <motion.h1 
          initial={{ filter: "blur(10px)", opacity: 0, y: 20 }}
          animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="text-6xl md:text-8xl font-black tracking-tighter mb-4"
        >
          MIMO BLOG
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 1 }}
          className="text-lg text-foreground/60 tracking-widest uppercase font-mono"
        >
          Building the new way
        </motion.p>
      </div>

      <motion.div 
        animate={{ y: [0, 10, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="absolute bottom-10 flex flex-col items-center opacity-50"
      >
        <span className="text-xs mb-2">Scroll</span>
        <div className="w-[1px] h-8 bg-foreground" />
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Update Home Page Layout (index.tsx)**

```tsx
// web/src/routes/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import Hero from "@widgets/Hero";
import Contributions from "@features/github/ui/Contributions";
// ... preserve loader logic ...

function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Hero />
      <section className="container mx-auto px-6 py-24 bg-background">
         {/* Bento Grid Posts will go here in next task */}
         <div className="mt-24 border border-edge-hairline rounded-3xl p-8">
            <Contributions />
         </div>
      </section>
    </div>
  );
}
// ... preserve route config ...
```

- [ ] **Step 3: Lint and Check**

```bash
cd web && npx tsc --noEmit && npx biome check --apply .
```

- [ ] **Step 4: Commit**

```bash
cd web
git add src/widgets/Hero.tsx src/routes/index.tsx
git commit -m "feat: implement immersive fluid hero section for home page"
```
