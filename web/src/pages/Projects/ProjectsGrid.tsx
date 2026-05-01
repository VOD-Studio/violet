import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { ProjectCard, type ProjectData } from "@/components/blog/ProjectCard"
import { ScrollReveal } from "@/components/creative"
import { ErrorFallback } from "@/components/shared/ErrorFallback"
import { EmptyState } from "@/components/shared/EmptyState"

function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      try {
        return await api.get<ProjectData[]>("/projects")
      } catch {
        return []
      }
    },
    placeholderData: [],
  })
}

export function ProjectsGrid() {
  const { data: projects, isLoading, error, refetch } = useProjects()

  if (isLoading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-80 animate-pulse rounded-lg border bg-muted" />
        ))}
      </div>
    )
  }

  if (error) {
    return <ErrorFallback error={error.message} onRetry={refetch} />
  }

  if (!projects || projects.length === 0) {
    return (
      <EmptyState
        title="暂无项目数据"
        description="项目数据即将上线，敬请期待"
        icon={
          <svg className="size-12" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        }
      />
    )
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project, index) => (
        <ScrollReveal
          key={project.id}
          animation="scale"
          delay={index * 0.1}
        >
          <ProjectCard project={project} />
        </ScrollReveal>
      ))}
    </div>
  )
}