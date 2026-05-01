import { motion } from "motion/react";
import { ScrollReveal, MagneticButton } from "@/components/creative";
import { usePosts } from "@/hooks/usePosts";
import { PostCard } from "@/components/blog/PostCard";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function RecentPostsSection() {
  const { data, isLoading, error } = usePosts({ page: 1, limit: 3 });
  const posts = data?.posts ?? [];

  return (
    <section className="container mx-auto px-4 pb-24">
      <motion.h2
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="mb-8 text-2xl font-bold"
      >
        最新文章
      </motion.h2>

      {isLoading && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-lg border bg-muted"
            />
          ))}
        </div>
      )}

      {error && (
        <div className="py-12 text-center text-muted-foreground">
          {String(error)}
        </div>
      )}

      {!isLoading && !error && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, index) => (
            <ScrollReveal key={post.id} animation="fadeUp" delay={index * 0.1}>
              <PostCard post={post} delay={0} />
            </ScrollReveal>
          ))}
        </div>
      )}

      {!isLoading && !error && posts.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">暂无文章</div>
      )}

      <div className="mt-8 text-center">
        <MagneticButton className="inline-block">
          <Link to="/blog">
            <Button variant="outline">
              查看全部文章
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </MagneticButton>
      </div>
    </section>
  );
}
