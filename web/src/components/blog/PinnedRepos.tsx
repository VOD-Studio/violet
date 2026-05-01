// GitHub Pinned Repos 组件
// 展示用户的置顶仓库卡片，包含仓库名、描述、语言、star 和 fork 数
// 加载时显示骨架屏

import { motion } from "motion/react";
import { Star, GitFork, ExternalLink } from "lucide-react";
import { useGitHubRepos } from "@/hooks/useGitHub";
import type { RepoData } from "@/lib/github";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

interface PinnedReposProps {
  /** GitHub 用户名 */
  username: string;
}

/**
 * 仓库卡片骨架屏
 * 在数据加载期间显示占位动画
 */
function RepoCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader>
        <div className="h-5 w-32 rounded bg-muted" />
        <div className="mt-1 h-4 w-full rounded bg-muted" />
        <div className="mt-1 h-4 w-2/3 rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          <div className="h-4 w-16 rounded bg-muted" />
          <div className="h-4 w-12 rounded bg-muted" />
          <div className="h-4 w-12 rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 单个仓库卡片
 * @param repo - 仓库数据
 */
function RepoCard({ repo }: { repo: RepoData }) {
  return (
    <motion.a
      href={repo.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -4 }}
      className="group block"
    >
      <Card className="h-full transition-shadow hover:shadow-lg">
        <CardHeader>
          {/* 仓库名称和外部链接图标 */}
          <CardTitle className="flex items-center gap-2">
            <span className="truncate text-base group-hover:text-primary transition-colors">
              {repo.name}
            </span>
            <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
          </CardTitle>

          {/* 仓库描述 */}
          {repo.description && (
            <CardDescription className="line-clamp-2">
              {repo.description}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent>
          {/* 底部元信息：语言、Star、Fork */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {/* 主要语言 */}
            {repo.language && (
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: repo.languageColor ?? "#999" }}
                />
                {repo.language}
              </span>
            )}

            {/* Star 数量 */}
            <span className="flex items-center gap-1">
              <Star className="size-3.5" />
              {repo.stargazerCount}
            </span>

            {/* Fork 数量 */}
            <span className="flex items-center gap-1">
              <GitFork className="size-3.5" />
              {repo.forkCount}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.a>
  );
}

/**
 * GitHub Pinned Repos 组件
 * 展示用户的置顶仓库列表，支持加载骨架屏和错误状态
 */
export function PinnedRepos({ username }: PinnedReposProps) {
  const { data: repos, isLoading, error } = useGitHubRepos(username);

  if (isLoading) {
    return (
      <div>
        <h3 className="mb-4 text-lg font-semibold">开源项目</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <RepoCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <h3 className="mb-2 text-lg font-semibold">开源项目</h3>
        <p className="text-sm text-muted-foreground">
          无法加载仓库数据: {String(error)}
        </p>
      </div>
    );
  }

  if (!repos || repos.length === 0) return null;

  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold">开源项目</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {repos.map((repo) => (
          <RepoCard key={repo.name} repo={repo} />
        ))}
      </div>
    </div>
  );
}
