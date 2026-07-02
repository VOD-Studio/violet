import type { Project } from "@features/projects/model/types";
import { Badge } from "@shared/ui/badge";
import { Button } from "@shared/ui/button";
import { Code, ExternalLink } from "lucide-react";

interface ProjectCardProps {
    project: Project;
}

/**
 * ProjectCard - 项目展示卡片
 *
 * 按接口完整字段排版：封面图、标题、描述、技术栈标签、演示链接、GitHub 链接。
 */
export function ProjectCard({ project }: ProjectCardProps) {
    return (
        <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-edge-hairline bg-background transition-colors hover:bg-muted/50">
            {/* 封面图 */}
            <div className="relative aspect-video overflow-hidden">
                {project.image_url ? (
                    <img
                        src={project.image_url}
                        alt={project.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                        <Code className="size-12 text-muted-foreground/40" />
                    </div>
                )}
            </div>

            {/* 内容区 */}
            <div className="flex flex-1 flex-col p-6">
                <h3 className="mb-2 text-xl font-bold">{project.title}</h3>
                <p className="mb-4 line-clamp-2 flex-1 text-sm text-muted-foreground">
                    {project.description}
                </p>

                {/* 技术栈标签 */}
                {project.tech_stack && project.tech_stack.length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-1.5">
                        {project.tech_stack.map((tech) => (
                            <Badge key={tech} variant="secondary" className="text-xs">
                                {tech}
                            </Badge>
                        ))}
                    </div>
                )}

                {/* 链接按钮 */}
                <div className="flex items-center gap-2">
                    {project.url && (
                        <Button variant="outline" size="sm" className="gap-1.5" asChild>
                            <a href={project.url} target="_blank" rel="noreferrer">
                                <ExternalLink className="size-3.5" />
                                演示
                            </a>
                        </Button>
                    )}
                    {project.github_url && (
                        <Button variant="outline" size="sm" className="gap-1.5" asChild>
                            <a href={project.github_url} target="_blank" rel="noreferrer">
                                <Code className="size-3.5" />
                                源码
                            </a>
                        </Button>
                    )}
                </div>
            </div>
        </article>
    );
}
