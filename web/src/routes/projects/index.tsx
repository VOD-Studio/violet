import { projectKeys } from "@features/projects/api/keys";
import { fetchProjects, useProjects } from "@features/projects/api/queries";
import { TiltedCard } from "@shared/ui/tilted-card";
import { createFileRoute } from "@tanstack/react-router";

const ProjectsPage = () => {
    // 列表数据由 loader 预取并脱水合，这里复用缓存
    const { data: projects = [], isLoading, error } = useProjects();

    if (error) {
        return <div className="container mx-auto px-4 py-12 text-muted-foreground">加载失败</div>;
    }

    return (
        <div className="container mx-auto px-4 py-12">
            <header className="mb-10">
                <p className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
                    All Projects
                </p>
                <h1 className="font-mono text-4xl font-bold">项目</h1>
            </header>
            {isLoading ? (
                <div className="text-muted-foreground">加载中…</div>
            ) : projects.length === 0 ? (
                <div className="text-muted-foreground">暂无项目</div>
            ) : (
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                    {projects.map((p) => (
                        <TiltedCard key={p.id} className="h-64">
                            <div className="h-full rounded-3xl border border-edge-hairline p-8 transition-colors hover:bg-muted/50">
                                <h3 className="mb-4 text-2xl font-bold">{p.title}</h3>
                                <p className="text-muted-foreground">{p.description}</p>
                            </div>
                        </TiltedCard>
                    ))}
                </div>
            )}
        </div>
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
