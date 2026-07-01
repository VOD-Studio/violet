import { cn } from "@shared/lib/utils";
import Empty from "@shared/ui/empty";
import Loader from "@shared/ui/loader";
import { ExternalLink, GitFork, Star } from "lucide-react";

import { useRepos } from "../api/queries";
import type { Repo } from "../model/types";

interface RepoCardProps {
    repo: Repo;
}

const RepoCard = ({ repo }: RepoCardProps) => (
    <a
        href={repo.url}
        target="_blank"
        rel="noreferrer"
        className={cn(
            "group flex flex-col gap-3 rounded-lg border border-edge-hairline bg-background p-5 transition-colors hover:bg-muted/30",
            repo.pinned && "ring-1 ring-primary/20",
        )}
    >
        <div className="flex items-start justify-between gap-3">
            <h3 className="font-mono text-base font-semibold group-hover:text-primary">
                {repo.name}
            </h3>
            {repo.pinned && (
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    Pinned
                </span>
            )}
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{repo.description}</p>
        <div className="mt-auto flex items-center gap-4 text-xs text-muted-foreground font-mono">
            {repo.language && <span>{repo.language}</span>}
            <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5" />
                {repo.stars}
            </span>
            <span className="flex items-center gap-1">
                <GitFork className="h-3.5 w-3.5" />
                {repo.forks}
            </span>
            <ExternalLink className="ml-auto h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
    </a>
);

export interface RepoListProps {
    className?: string;
}

/**
 * RepoList - GitHub 仓库列表组件
 *
 * 封装内容：
 * - 数据获取：使用 useRepos
 * - 加载态：Loader 占位
 * - 错误态 / 空数据态：Empty 提示
 * - 列表：置顶仓库优先展示，卡片带语言、star、fork 信息
 */
const RepoList = ({ className }: RepoListProps) => {
    const { data: repos = [], isLoading, isError, error } = useRepos();

    if (isLoading) {
        return <Loader label="加载仓库…" className={cn("py-20", className)} />;
    }

    if (isError) {
        return (
            <Empty
                title="REPOS UNAVAILABLE"
                description={error instanceof Error ? error.message : "仓库加载失败"}
                className={cn("py-20", className)}
            />
        );
    }

    if (repos.length === 0) {
        return (
            <Empty title="NO REPOS" description="暂无仓库数据" className={cn("py-20", className)} />
        );
    }

    const sorted = [...repos].sort((a, b) => Number(b.pinned) - Number(a.pinned));

    return (
        <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
            {sorted.map((repo) => (
                <RepoCard key={repo.name} repo={repo} />
            ))}
        </div>
    );
};

export default RepoList;
