import { useState } from "react";
import { motion } from "motion/react";
import { useTags } from "@/hooks/useTags";
import { TagFilter } from "@/components/blog/TagFilter";
import { SEO } from "@/components/shared/SEO";
import { StructuredData } from "@/components/shared/StructuredData";
import { generateBreadcrumbStructuredData, SITE_CONFIG } from "@/lib/seo";
import { SearchBar } from "./components/SearchBar";
import { PostGrid } from "./components/PostGrid";
import { Pagination } from "./components/Pagination";
import { usePosts } from "@/hooks/usePosts";

const PAGE_SIZE = 6;

export default function BlogList() {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: tags, isLoading: tagsLoading } = useTags();
  const { data } = usePosts({
    page: currentPage,
    limit: PAGE_SIZE,
    tag: selectedTag ?? undefined,
    search: search || undefined,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function handleTagChange(tag: string | null) {
    setSelectedTag(tag);
    setCurrentPage(1);
  }

  function handleSearch(keyword: string) {
    setSearch(keyword);
    setCurrentPage(1);
  }

  const breadcrumbData = generateBreadcrumbStructuredData([
    { name: "首页", url: SITE_CONFIG.url },
    { name: "博客文章", url: `${SITE_CONFIG.url}/blog` },
  ]);

  return (
    <div className="container mx-auto px-4 py-12">
      <SEO
        title="博客文章"
        description="浏览所有技术文章，涵盖前端开发、后端架构、数据库、DevOps 等领域。"
        url={`${SITE_CONFIG.url}/blog`}
      />
      <StructuredData data={breadcrumbData} />

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-3xl font-bold"
      >
        博客文章
      </motion.h1>

      <SearchBar onSearch={handleSearch} />

      <TagFilter
        tags={tags ?? []}
        selectedTag={selectedTag}
        onTagChange={handleTagChange}
        isLoading={tagsLoading}
      />

      <PostGrid
        page={currentPage}
        tag={selectedTag ?? undefined}
        search={search || undefined}
      />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
