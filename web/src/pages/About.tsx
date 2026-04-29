// 关于页
// 个人简介使用 TextReveal 逐行显示动画
// 技术栈展示使用 ScrollReveal fadeUp 滚动显示动画
// GitHub 活动集成：贡献热力图和置顶仓库

import { TextReveal, ScrollReveal } from "@/components/creative";
import { GitHubContributions } from "@/components/blog/GitHubContributions";
import { PinnedRepos } from "@/components/blog/PinnedRepos";
import { SEO } from "@/components/shared/SEO";
import { StructuredData } from "@/components/shared/StructuredData";
import {
  generatePersonStructuredData,
  generateBreadcrumbStructuredData,
  SITE_CONFIG,
} from "@/lib/seo";

/** 配置你的 GitHub 用户名 */
const GITHUB_USERNAME = "promise";

/** 技术栈分类结构 */
interface TechCategory {
  /** 分类名称 */
  name: string;
  /** 该分类下的技术列表 */
  items: string[];
}

/** 个人技术栈数据 */
const TECH_STACK: TechCategory[] = [
  {
    name: "前端",
    items: ["React", "TypeScript", "Next.js", "Tailwind CSS", "Vue.js"],
  },
  {
    name: "后端",
    items: ["Node.js", "NestJS", "Express", "Go", "Python"],
  },
  {
    name: "数据库",
    items: ["PostgreSQL", "MongoDB", "Redis", "Prisma"],
  },
  {
    name: "DevOps",
    items: ["Docker", "Kubernetes", "GitHub Actions", "Nginx"],
  },
  {
    name: "工具",
    items: ["Git", "VS Code", "Figma", "Vim"],
  },
];

/**
 * 关于页
 * 展示个人介绍和技术栈
 */
export default function About() {
  /* 作者和面包屑结构化数据 */
  const personData = generatePersonStructuredData();
  const breadcrumbData = generateBreadcrumbStructuredData([
    { name: "首页", url: SITE_CONFIG.url },
    { name: "关于我", url: `${SITE_CONFIG.url}/about` },
  ]);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      {/* 关于页 SEO 配置 */}
      <SEO
        title="关于我"
        description="全栈开发者，热爱技术与开源。专注于 React、TypeScript 和 Node.js 生态，擅长构建高质量的 Web 应用。"
        url={`${SITE_CONFIG.url}/about`}
      />
      <StructuredData data={[personData, breadcrumbData]} />

      {/* 页面标题 */}
      <h1 className="mb-8 text-3xl font-bold">关于我</h1>

      {/* 个人简介，使用 TextReveal 逐行显示 */}
      <TextReveal className="mb-12">
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <p className="text-lg leading-relaxed text-muted-foreground">
            你好！我是一名全栈开发者，热爱技术与开源。目前专注于 Web 开发领域，
            擅长使用 React、TypeScript 和 Node.js 构建高质量的 Web 应用。
          </p>
          <p className="text-lg leading-relaxed text-muted-foreground">
            我相信技术的价值在于解决实际问题，因此我热衷于分享技术经验，
            帮助更多开发者成长。这个博客记录了我的学习历程和技术思考。
          </p>
          <p className="text-lg leading-relaxed text-muted-foreground">
            工作之余，我喜欢探索新技术、阅读技术书籍，偶尔也会参与开源项目。
            如果你对我的文章或项目感兴趣，欢迎通过社交链接与我联系。
          </p>
        </div>
      </TextReveal>

      {/* 技术栈展示，使用 ScrollReveal fadeUp 动画 */}
      <ScrollReveal animation="fadeUp">
        <h2 className="mb-6 text-2xl font-bold">技术栈</h2>

        <div className="space-y-6">
          {TECH_STACK.map((category, index) => (
            <ScrollReveal
              key={category.name}
              animation="fadeUp"
              delay={index * 0.1}
            >
              {/* 技术分类名称 */}
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                {category.name}
              </h3>

              {/* 技术标签列表 */}
              <div className="flex flex-wrap gap-2">
                {category.items.map((tech) => (
                  <span
                    key={tech}
                    className="rounded-lg border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </ScrollReveal>
          ))}
        </div>
      </ScrollReveal>

      {/* GitHub 贡献热力图 */}
      <ScrollReveal animation="fadeUp" className="mt-12">
        <GitHubContributions username={GITHUB_USERNAME} />
      </ScrollReveal>

      {/* GitHub 置顶仓库 */}
      <ScrollReveal animation="fadeUp" className="mt-12">
        <PinnedRepos username={GITHUB_USERNAME} />
      </ScrollReveal>
    </div>
  );
}
