import { motion } from "motion/react";
import { GitHubContributions } from "@/components/blog/GitHubContributions";
import { PinnedRepos } from "@/components/blog/PinnedRepos";

interface GitHubSectionProps {
  username: string;
}

export function GitHubSection({ username }: GitHubSectionProps) {
  if (!username) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <GitHubContributions username={username} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
        className="mt-12"
      >
        <PinnedRepos username={username} />
      </motion.div>
    </>
  );
}
