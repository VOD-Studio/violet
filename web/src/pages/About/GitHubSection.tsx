import { ScrollReveal } from "@/components/creative";
import { GitHubContributions } from "@/components/blog/GitHubContributions";
import { PinnedRepos } from "@/components/blog/PinnedRepos";

interface GitHubSectionProps {
  username: string;
}

export function GitHubSection({ username }: GitHubSectionProps) {
  if (!username) return null;

  return (
    <>
      <ScrollReveal animation="fadeUp" className="mt-12">
        <GitHubContributions username={username} />
      </ScrollReveal>

      <ScrollReveal animation="fadeUp" className="mt-12">
        <PinnedRepos username={username} />
      </ScrollReveal>
    </>
  );
}
