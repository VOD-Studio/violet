// 项目详情页
// 展示项目详细信息，包含名称、描述、技术栈、链接等

import { useParams, Link } from "react-router";
import { motion } from "motion/react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProject } from "@/features/projects";
import { ScrollReveal } from "@/components/creative";
import { SEO } from "@/components/shared/SEO";
import { BackToTop } from "@/components/shared/BackToTop";
import { TechStackBadge } from "@/components/blog/TechStackBadge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorFallback } from "@/components/shared/ErrorFallback";
import { SITE_CONFIG } from "@/lib/seo";
import { getUploadUrl } from "@/lib/api";

/**
 * 项目详情页
 */
export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading, error, refetch } = useProject(id);

  /* 加载态 */
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex h-96 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  /* 错误或项目不存在 */
  if (error || !project) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Link to="/projects">
          <Button variant="ghost" className="mb-6 gap-1">
            <ArrowLeft className="size-4" />
            返回项目列表
          </Button>
        </Link>
        <ErrorFallback
          error={error?.message ?? "项目不存在"}
          onRetry={refetch}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      {/* SEO 配置 */}
      <SEO
        title={project.title}
        description={project.description ?? project.title}
        image={project.image_url ? getUploadUrl(project.image_url) : undefined}
        url={`${SITE_CONFIG.url}/projects/${project.id}`}
        type="article"
        appendSiteName={false}
      />

      {/* 返回链接 */}
      <Link to="/projects">
        <Button variant="ghost" className="mb-6 gap-1">
          <ArrowLeft className="size-4" />
          返回项目列表
        </Button>
      </Link>

      {/* 项目内容 */}
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-w-0 flex-1"
      >
        {/* 封面图 */}
        {project.image_url && (
          <ScrollReveal animation="scale" duration={0.6}>
            <div className="mb-8 aspect-video overflow-hidden rounded-lg">
              <img
                src={getUploadUrl(project.image_url)}
                alt={project.title}
                className="size-full object-cover"
              />
            </div>
          </ScrollReveal>
        )}

        {/* 项目名称 */}
        <ScrollReveal animation="fadeUp" duration={0.6}>
          <h1 className="mb-4 text-3xl font-bold tracking-tight">
            {project.title}
          </h1>
        </ScrollReveal>

        {/* 项目描述 */}
        {project.description && (
          <ScrollReveal animation="fadeUp" delay={0.1} duration={0.6}>
            <p className="mb-6 text-lg text-muted-foreground leading-relaxed">
              {project.description}
            </p>
          </ScrollReveal>
        )}

        {/* 技术栈 */}
        {project.tech_stack.length > 0 && (
          <ScrollReveal animation="fadeUp" delay={0.2} duration={0.6}>
            <div className="mb-8">
              <h2 className="mb-3 text-xl font-semibold">技术栈</h2>
              <div className="flex flex-wrap gap-2">
                {project.tech_stack.map((tech) => (
                  <TechStackBadge key={tech} tech={tech} />
                ))}
              </div>
            </div>
          </ScrollReveal>
        )}

        {/* 链接 */}
        <ScrollReveal animation="fadeUp" delay={0.3} duration={0.6}>
          <div className="mb-8 flex flex-wrap gap-4">
            {project.github_url && (
              <a
                href={project.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2"
              >
                <Button variant="outline" className="gap-2">
                  <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                  </svg>
                  GitHub
                  <ExternalLink className="size-3" />
                </Button>
              </a>
            )}
            {project.url && (
              <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2"
              >
                <Button className="gap-2">
                  <ExternalLink className="size-4" />
                  访问网站
                </Button>
              </a>
            )}
          </div>
        </ScrollReveal>
      </motion.article>

      {/* 回到顶部 */}
      <BackToTop threshold={400} variant="rocket" />
    </div>
  );
}