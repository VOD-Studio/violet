import { projectKeys } from "@features/projects/api/keys";
import { fetchProjects, useProjects } from "@features/projects/api/queries";
import { ProjectCard } from "@features/projects/ui/ProjectCard";
import ProjectsSkeleton from "@features/projects/ui/ProjectsSkeleton";
import { PageShell } from "@shared/ui/page-shell";
import { TiltedCard } from "@shared/ui/tilted-card";
import { createFileRoute } from "@tanstack/react-router";

const ProjectsPage = () => {
    // 列表数据由 loader 预取并脱水合，这里复用缓存
    const { data: projects = [], isLoading, error } = useProjects();

    if (error) {
        return <PageShell className="text-muted-foreground">加载失败</PageShell>;
    }

    return (
        <PageShell>
            <header className="mb-10">
                <p className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    All Projects
                </p>
                <h1 className="font-mono text-4xl font-bold">项目</h1>
            </header>
            {isLoading ? (
                <ProjectsSkeleton />
            ) : projects.length === 0 ? (
                <div className="text-muted-foreground">暂无项目</div>
            ) : (
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                    {projects.map((p) => (
                        <TiltedCard key={p.id}>
                            <ProjectCard project={p} />
                        </TiltedCard>
                    ))}
                </div>
            )}
        </PageShell>
    );
};

export const Route = createFileRoute("/projects/")({
    // SSR 预取项目列表，脱水合后首屏直出
    loader: async ({ context }) => {
        await context.queryClient.ensureQueryData({
            queryKey: projectKeys.list({}),
            queryFn: () => fetchProjects({}),
        });
    },
    component: ProjectsPage,
});
