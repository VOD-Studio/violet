# Frontend Redesign Phase 1: Minimalist Fluid (Public Facing)

## 1. Project Context & Scope
- **Target**: Public-facing frontend of `mimo-blog` (Home, Posts, About, Projects).
- **Out of Scope**: Admin Dashboard (deferred to Phase 2 to ensure focused implementation and maintainable code quality).
- **Tech Stack**: React 19, Vite, TanStack Router, TanStack Query, Tailwind CSS v4, Framer Motion, and **React Bits** (via MCP).

## 2. Global Aesthetic Vibe: "Minimalist Fluid" (A + E)
The core design language combines extreme minimalism (large whitespace, sharp typography, high contrast) with dreamy, organic fluidity (liquid animations, soft gradients, glowing auroras). 
- **Skeleton**: Strict, clean, and unopinionated (Minimalist & Clean).
- **Soul**: Smooth, organic, and highly interactive (Dreamy Fluid).

### 2.1 Design Tokens
- **Colors**: Pure white (`#FFFFFF`) or deep black (`#0A0A0A`) backgrounds for content areas. All "color" is injected via dynamic, blurred gradients (e.g., React Bits Aurora).
- **Typography**: Modern Sans-Serif (Inter/Geist). Oversized, bold headings contrasting with ultra-clean, slightly muted body text.
- **Borders & Shadows**: `rounded-3xl` for major components. Hairline 1px semi-transparent borders. Zero harsh drop shadows; relies on diffuse lighting and `Glare Hover` effects.

## 3. Structural Layout & Component Design

### 3.1 Global Shell & Navigation
- **Invisible Header**: Sticky, transparent by default. Seamlessly transitions to a glassmorphism (backdrop-blur) panel when scrolling past the hero section.
- **Micro-interactions**: Navigation items use Framer Motion for smooth, spring-based text reveals and fading underlines.
- **Floating Music Player**: Redesigned as a minimal bottom-edge floating capsule. When active, it emits a faint, slow-moving aurora glow matching the fluid theme.

### 3.2 Home Page (The Immersive Canvas)
- **Hero Section (100vh)**:
  - Background: Full-screen React Bits `Aurora` or `Waves`.
  - Content: Center-aligned blog title revealed via React Bits `Blur Text` on mount.
  - Scroll Hint: A subtle, breathing downward arrow at the bottom center.
- **Content Feed (Below the Fold)**:
  - Abrupt background transition to pure white/black to reset the visual palate.
  - **Bento Grid Posts**: Posts arranged in a staggered bento grid. Ample whitespace.
  - **Glare Hover**: Cards utilize React Bits `Glare Hover` or subtle tilt on mouseover.
  - **Github Contributions**: Refactored into a borderless, minimalist heat map with a low-saturation gradient (e.g., icy blue/gray) to fit the theme.

### 3.3 Post Details & Inner Pages
- **Zen Reading Mode**: Header hides/blends entirely. Text max-width is strictly contained for readability.
- **Fluid Progress Indicator**: A ultra-thin, fluid gradient line tracking scroll progress at the top edge.
- **Typography Engine**: Enhanced `prose` (Tailwind Typography) with line-height `1.75`. Code blocks feature glassmorphism backgrounds and macOS-style window dots.
- **Projects Page**: Showcases projects using 3D micro-gravity tilt cards. 

### 3.4 Comments & Interactions
- **Spring UI**: Comments section inputs and emoji pickers use spring physics (Framer Motion) for opening/closing, avoiding stiff popups.
- **Liquid Loaders**: Loading states use fluid merging dots instead of standard spinners.

## 4. Technical Guidelines
- **Integration**: React Bits components must be fetched via the configured MCP server during the implementation phase.
- **File Structure (FSD)**: Ensure new UI components are placed strictly in the `src/shared/ui` or `src/widgets` directories following the existing Feature-Sliced Design patterns.
- **Tailwind v4**: Utilize native CSS variables and arbitrary value syntax where appropriate, avoiding legacy Tailwind v3 plugins where native v4 handles it better.
