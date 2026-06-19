import { useMemo } from "react";
import { motion } from "motion/react";

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
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <h2 className="mb-6 text-2xl font-bold">技术栈</h2>

      <div className="space-y-6">
        {categories.map((category, catIndex) => (
          <motion.div
            key={category.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-30px" }}
            transition={{ duration: 0.4, delay: catIndex * 0.1, ease: "easeOut" }}
          >
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
              {category.name}
            </h3>

            <div className="flex flex-wrap gap-2">
              {category.items.map((tech, itemIndex) => (
                <motion.span
                  key={tech}
                  initial={{ opacity: 0, scale: 0.85 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.3,
                    delay: catIndex * 0.1 + itemIndex * 0.05,
                    ease: "easeOut",
                  }}
                  whileHover={{ scale: 1.08, y: -2 }}
                  className="rounded-lg border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted cursor-default"
                >
                  {tech}
                </motion.span>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
