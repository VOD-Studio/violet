// GitHub 贡献热力图组件
// 展示用户最近 365 天的 GitHub 贡献活动
// 使用 CSS Grid 布局，颜色深浅表示贡献数量

import { motion } from "motion/react"
import { useGitHubContributions } from "@/hooks/useGitHub"
import type { ContributionDay } from "@/lib/github"

/** 各等级贡献方块的背景色 */
const LEVEL_COLORS = [
  "bg-muted",
  "bg-emerald-200 dark:bg-emerald-900",
  "bg-emerald-400 dark:bg-emerald-700",
  "bg-emerald-600 dark:bg-emerald-500",
  "bg-emerald-800 dark:bg-emerald-300",
]

/** 星期标签，用于热力图左侧 */
const WEEKDAY_LABELS = ["", "一", "", "三", "", "五", ""]

/** 月份缩写，用于热力图顶部 */
const MONTH_LABELS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
]

interface GitHubContributionsProps {
  /** GitHub 用户名 */
  username: string
}

/**
 * 加载状态骨架屏
 * 模拟热力图的网格布局
 */
function ContributionSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-4 h-5 w-48 rounded bg-muted" />
      <div className="flex gap-0.5">
        {/* 左侧星期标签占位 */}
        <div className="flex flex-col gap-0.5 pr-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-3 w-3 rounded-sm bg-muted" />
          ))}
        </div>
        {/* 网格方块占位 */}
        <div className="grid grid-rows-7 grid-flow-col gap-0.5">
          {Array.from({ length: 364 }).map((_, i) => (
            <div key={i} className="h-3 w-3 rounded-sm bg-muted" />
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * 日期格式化，将 YYYY-MM-DD 转为中文可读格式
 * @param dateStr - 日期字符串
 * @returns 中文日期格式
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00")
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

/**
 * 获取某一天是星期几（0=周日，6=周六）
 * @param dateStr - 日期字符串
 * @returns 星期索引
 */
function getDayOfWeek(dateStr: string): number {
  const date = new Date(dateStr + "T00:00:00")
  return date.getDay()
}

/**
 * 生成月份标签的位置信息
 * @param days - 贡献数据数组
 * @returns 每个标签的位置和文本
 */
function getMonthLabels(
  days: ContributionDay[],
): Array<{ label: string; weekIndex: number }> {
  const labels: Array<{ label: string; weekIndex: number }> = []
  let lastMonth = -1

  /* 按周遍历，找到每个月第一周的位置 */
  for (let i = 0; i < days.length; i += 7) {
    const day = days[i]
    if (!day) continue
    const month = new Date(day.date + "T00:00:00").getMonth()
    if (month !== lastMonth) {
      labels.push({ label: MONTH_LABELS[month], weekIndex: Math.floor(i / 7) })
      lastMonth = month
    }
  }

  return labels
}

/**
 * GitHub 贡献热力图组件
 * 类似 GitHub 个人主页的绿色方块贡献图
 */
export function GitHubContributions({ username }: GitHubContributionsProps) {
  const { data, isLoading, error } = useGitHubContributions(username)

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <ContributionSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          无法加载贡献数据: {String(error)}
        </p>
      </div>
    )
  }

  if (!data) return null

  /* 将贡献数据按周分组（每列 7 天） */
  const weeks: ContributionDay[][] = []
  let currentWeek: ContributionDay[] = []

  /* 补齐第一周前面的空白天 */
  const firstDayOfWeek = getDayOfWeek(data.days[0]?.date ?? "")
  for (let i = 0; i < firstDayOfWeek; i++) {
    currentWeek.push({ date: "", count: -1, level: -1 })
  }

  for (const day of data.days) {
    currentWeek.push(day)
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }

  /* 补齐最后一周后面的空白天 */
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({ date: "", count: -1, level: -1 })
    }
    weeks.push(currentWeek)
  }

  const monthLabels = getMonthLabels(data.days)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="rounded-xl border bg-card p-6"
    >
      {/* 标题和总贡献数 */}
      <div className="mb-4 flex items-baseline gap-2">
        <h3 className="text-lg font-semibold">GitHub 贡献</h3>
        <span className="text-sm text-muted-foreground">
          过去一年共 {data.totalContributions} 次贡献
        </span>
      </div>

      {/* 热力图容器 */}
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          {/* 月份标签行 */}
          <div className="relative ml-8 mb-1 h-4">
            {monthLabels.map((item) => (
              <span
                key={`${item.label}-${item.weekIndex}`}
                className="absolute text-xs text-muted-foreground"
                style={{ left: `${item.weekIndex * 14}px` }}
              >
                {item.label}
              </span>
            ))}
          </div>

          <div className="flex">
            {/* 左侧星期标签 */}
            <div className="mr-2 flex flex-col gap-0.5">
              {WEEKDAY_LABELS.map((label, i) => (
                <div
                  key={i}
                  className="flex h-3 w-6 items-center text-xs text-muted-foreground"
                >
                  {label}
                </div>
              ))}
            </div>

            {/* 贡献方块网格 */}
            <div className="flex gap-0.5">
              {weeks.map((week, weekIdx) => (
                <div key={weekIdx} className="flex flex-col gap-0.5">
                  {week.map((day, dayIdx) => {
                    /* 空白填充格 */
                    if (day.count === -1) {
                      return (
                        <div
                          key={dayIdx}
                          className="h-3 w-3 rounded-sm"
                        />
                      )
                    }

                    return (
                      <div
                        key={day.date}
                        className={`h-3 w-3 rounded-sm transition-colors ${LEVEL_COLORS[day.level]}`}
                        title={`${formatDate(day.date)}: ${day.count} 次贡献`}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* 图例 */}
          <div className="mt-3 flex items-center justify-end gap-1">
            <span className="mr-1 text-xs text-muted-foreground">少</span>
            {LEVEL_COLORS.map((color, i) => (
              <div
                key={i}
                className={`h-3 w-3 rounded-sm ${color}`}
              />
            ))}
            <span className="ml-1 text-xs text-muted-foreground">多</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
