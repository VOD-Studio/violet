import { useMemo } from "react";
import { ScrollReveal } from "@/components/creative";

interface TechCategory {
  name: string;
  items: string[];
}

const DEFAULT_TECH_STACK: TechCategory[] = [
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

interface TechStackSectionProps {
  techStack?: string;
}

export function TechStackSection({ techStack }: TechStackSectionProps) {
  const categories = useMemo<TechCategory[]>(() => {
    if (!techStack) return DEFAULT_TECH_STACK;
    try {
      const parsed = JSON.parse(techStack);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      return DEFAULT_TECH_STACK;
    } catch {
      return DEFAULT_TECH_STACK;
    }
  }, [techStack]);

  return (
    <ScrollReveal animation="fadeUp">
      <h2 className="mb-6 text-2xl font-bold">技术栈</h2>

      <div className="space-y-6">
        {categories.map((category, index) => (
          <ScrollReveal
            key={category.name}
            animation="fadeUp"
            delay={index * 0.1}
          >
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
              {category.name}
            </h3>

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
  );
}
