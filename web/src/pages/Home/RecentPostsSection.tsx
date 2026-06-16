import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { usePosts } from "@/features/posts/api";
import { PostCard } from "@/features/posts/components/PostCard";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

/**
 * 首页「近期文章」区
 * 2.0：保留 usePosts 数据逻辑与 PostCard 业务组件，
 * 入场动画从 creative/ScrollReveal 改为 motion whileInView。
 */
export function RecentPostsSection() {
  const { data, isLoading, error } = usePosts({ page: 1, limit: 3 });

  return (
    <section className="container mx-auto px-4 py-20">
      <motion.h2
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={fadeUp}
        transition={{ duration: 0.5 }}
        className="mb-10 text-center text-3xl font-bold tracking-tight sm:text-4xl"
      >
        近期文章
      </motion.h2>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((n) => (
            <div
              key={n}
              className="h-64 animate-pulse rounded-lg border bg-muted"
            />
          ))}
        </div>
      ) : error ? (
        <p className="py-12 text-center text-muted-foreground">
          加载文章失败，请稍后重试
        </p>
      ) : data?.posts?.length ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.posts.map((post, index) => (
            <motion.div
              key={post.id}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-60px" }}
              variants={fadeUp}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <PostCard post={post} />
            </motion.div>
          ))}
        </div>
      ) : (
        <p className="py-12 text-center text-muted-foreground">暂无文章</p>
      )}

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeUp}
        transition={{ duration: 0.5 }}
        className="mt-12 flex justify-center"
      >
        <Link
          to="/blog"
          className="group inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
        >
          查看全部文章
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </motion.div>
    </section>
  );
}
