// 技术栈标签组件
// 根据技术名称显示对应颜色，使用彩色圆点替代图标

import { Badge } from "@/components/ui/badge";

/** 技术名称到颜色的映射 */
const TECH_COLORS: Record<string, string> = {
  react: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  vue: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  typescript:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  javascript:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  python:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  go: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  rust: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  docker: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  node: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  "node.js":
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  postgresql:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  mongodb:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  redis: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  tailwind: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  tailwindcss:
    "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  nextjs: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  "next.js": "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  vite: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  webpack: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  git: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  linux: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  nginx: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  graphql: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  deno: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  bun: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  svelte:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  angular: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  flutter: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  swift:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  kotlin:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  java: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  "c++": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  php: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  ruby: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  elixir:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  webassembly:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  wasm: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  kubernetes:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  k8s: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  aws: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  firebase:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  supabase:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  prisma:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  drizzle:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  openapi:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  cli: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  openai:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

/** 标签尺寸 */
type BadgeSize = "sm" | "md" | "lg";

/** 尺寸对应的样式 */
const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: "text-xs px-1.5 py-0.5 gap-0.5",
  md: "text-xs px-2 py-0.5 gap-1",
  lg: "text-sm px-2.5 py-1 gap-1.5",
};

/** 圆点尺寸 */
const DOT_SIZE: Record<BadgeSize, string> = {
  sm: "size-1.5",
  md: "size-2",
  lg: "size-2.5",
};

interface TechStackBadgeProps {
  /** 技术名称 */
  tech: string;
  /** 标签尺寸 */
  size?: BadgeSize;
}

/**
 * 技术栈标签组件
 * 根据技术名称自动匹配颜色，未匹配的技术使用默认样式
 */
export function TechStackBadge({ tech, size = "md" }: TechStackBadgeProps) {
  const key = tech.toLowerCase().trim();
  const colorClass = TECH_COLORS[key];

  return (
    <Badge
      variant="outline"
      className={`font-medium ${colorClass ?? ""} ${SIZE_CLASSES[size]}`}
    >
      <span
        className={`rounded-full bg-current opacity-60 ${DOT_SIZE[size]}`}
      />
      {tech}
    </Badge>
  );
}

export type { BadgeSize };
