// 技术栈标签组件
// 根据技术名称显示对应颜色和图标，支持常见前后端技术

import { Badge } from "@/components/ui/badge"
import {
  SiReact,
  SiVuedotjs,
  SiTypescript,
  SiPython,
  SiGo,
  SiRust,
  SiDocker,
  SiNodedotjs,
  SiPostgresql,
  SiMongodb,
  SiRedis,
  SiTailwindcss,
  SiNextdotjs,
  SiVite,
  SiWebpack,
  SiGit,
  SiLinux,
  SiNginx,
  SiGraphql,
  SiDeno,
  SiBun,
  SiSvelte,
  SiAngular,
  SiFlutter,
  SiSwift,
  SiKotlin,
  SiCplusplus,
  SiPhp,
  SiRuby,
  SiElixir,
  SiWebassembly,
  SiKubernetes,
  SiFirebase,
  SiSupabase,
  SiPrisma,
  SiDrizzle,
  SiOpenai,
  SiJavascript,
} from "react-icons/si"

/** 技术名称到颜色和图标的映射 */
const TECH_MAP: Record<string, { color: string; icon: React.ComponentType<{ className?: string }> }> = {
  react: { color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300", icon: SiReact },
  vue: { color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", icon: SiVuedotjs },
  typescript: { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: SiTypescript },
  javascript: { color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300", icon: SiJavascript },
  python: { color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300", icon: SiPython },
  go: { color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300", icon: SiGo },
  rust: { color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300", icon: SiRust },
  docker: { color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300", icon: SiDocker },
  node: { color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", icon: SiNodedotjs },
  "node.js": { color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", icon: SiNodedotjs },
  postgresql: { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: SiPostgresql },
  mongodb: { color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", icon: SiMongodb },
  redis: { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: SiRedis },
  tailwind: { color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300", icon: SiTailwindcss },
  "tailwindcss": { color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300", icon: SiTailwindcss },
  nextjs: { color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300", icon: SiNextdotjs },
  "next.js": { color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300", icon: SiNextdotjs },
  vite: { color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", icon: SiVite },
  webpack: { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: SiWebpack },
  git: { color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300", icon: SiGit },
  linux: { color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300", icon: SiLinux },
  nginx: { color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", icon: SiNginx },
  graphql: { color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300", icon: SiGraphql },
  deno: { color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300", icon: SiDeno },
  bun: { color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300", icon: SiBun },
  svelte: { color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300", icon: SiSvelte },
  angular: { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: SiAngular },
  flutter: { color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300", icon: SiFlutter },
  swift: { color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300", icon: SiSwift },
  kotlin: { color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", icon: SiKotlin },
  java: { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: SiJavascript },
  "c++": { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: SiCplusplus },
  php: { color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300", icon: SiPhp },
  ruby: { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", icon: SiRuby },
  elixir: { color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", icon: SiElixir },
  webassembly: { color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", icon: SiWebassembly },
  wasm: { color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", icon: SiWebassembly },
  kubernetes: { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: SiKubernetes },
  k8s: { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: SiKubernetes },
  aws: { color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300", icon: SiDocker },
  firebase: { color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300", icon: SiFirebase },
  supabase: { color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", icon: SiSupabase },
  prisma: { color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300", icon: SiPrisma },
  drizzle: { color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", icon: SiDrizzle },
  openapi: { color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", icon: SiOpenai },
  cli: { color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300", icon: SiLinux },
  "openai": { color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", icon: SiOpenai },
}

/** 标签尺寸 */
type BadgeSize = "sm" | "md" | "lg"

/** 尺寸对应的样式 */
const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: "text-xs px-1.5 py-0.5 gap-0.5",
  md: "text-xs px-2 py-0.5 gap-1",
  lg: "text-sm px-2.5 py-1 gap-1.5",
}

/** 图标尺寸对应的样式 */
const ICON_SIZE: Record<BadgeSize, string> = {
  sm: "size-2.5",
  md: "size-3",
  lg: "size-3.5",
}

interface TechStackBadgeProps {
  /** 技术名称 */
  tech: string
  /** 标签尺寸 */
  size?: BadgeSize
}

/**
 * 技术栈标签组件
 * 根据技术名称自动匹配颜色和图标，未匹配的技术使用默认样式
 */
export function TechStackBadge({ tech, size = "md" }: TechStackBadgeProps) {
  const key = tech.toLowerCase().trim()
  const match = TECH_MAP[key]
  const Icon = match?.icon

  return (
    <Badge
      variant="outline"
      className={`font-medium ${match?.color ?? ""} ${SIZE_CLASSES[size]}`}
    >
      {Icon && <Icon className={ICON_SIZE[size]} />}
      {tech}
    </Badge>
  )
}

export type { BadgeSize }
