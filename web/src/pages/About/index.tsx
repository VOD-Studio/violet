import { usePublicSettings } from "@/hooks/useAdmin";
import { SEO } from "@/components/shared/SEO";
import { StructuredData } from "@/components/shared/StructuredData";
import {
  generatePersonStructuredData,
  generateBreadcrumbStructuredData,
  SITE_CONFIG,
} from "@/lib/seo";
import { BioSection } from "./BioSection";
import { TechStackSection } from "./TechStackSection";
import { GitHubSection } from "./GitHubSection";

export default function About() {
  const { data: settings } = usePublicSettings();
  const githubUsername = settings?.github_username ?? "";

  const personData = generatePersonStructuredData();
  const breadcrumbData = generateBreadcrumbStructuredData([
    { name: "首页", url: SITE_CONFIG.url },
    { name: "关于我", url: `${SITE_CONFIG.url}/about` },
  ]);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <SEO
        title="关于我"
        description="全栈开发者，热爱技术与开源。专注于 React、TypeScript 和 Node.js 生态，擅长构建高质量的 Web 应用。"
        url={`${SITE_CONFIG.url}/about`}
      />
      <StructuredData data={[personData, breadcrumbData]} />

      <h1 className="mb-8 text-3xl font-bold">关于我</h1>

      <BioSection />
      <TechStackSection />
      <GitHubSection username={githubUsername} />
    </div>
  );
}
