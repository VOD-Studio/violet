import { SEO } from "@/components/shared/SEO";
import { StructuredData } from "@/components/shared/StructuredData";
import { generateWebsiteStructuredData, SITE_CONFIG } from "@/lib/seo";
import { HeroSection } from "./HeroSection";
import { RecentPostsSection } from "./RecentPostsSection";

export default function Home() {
  const websiteData = generateWebsiteStructuredData();

  return (
    <div>
      <SEO
        title="首页"
        description={SITE_CONFIG.description}
        url={SITE_CONFIG.url}
        type="website"
      />
      <StructuredData data={websiteData} />

      <HeroSection />
      <RecentPostsSection />
    </div>
  );
}
