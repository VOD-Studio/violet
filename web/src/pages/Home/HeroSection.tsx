import { ParticleBackground, KineticText } from "@/components/creative"
import { motion } from "motion/react"
import { Link } from "react-router"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative container mx-auto flex flex-col items-center justify-center gap-6 overflow-hidden px-4 py-24 text-center">
      <ParticleBackground
        className="absolute inset-0 h-full w-full"
        particleCount={60}
      />

      <KineticText
        as="h1"
        animation="fadeUp"
        splitMode="char"
        className="relative z-10 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
      >
        你好，我是开发者
      </KineticText>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="relative z-10 max-w-2xl text-lg text-muted-foreground"
      >
        全栈开发者，热爱开源与技术写作。专注于 React、TypeScript 和 Node.js 生态，
        在这里分享我的技术见解和项目经验。
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="relative z-10 flex gap-3"
      >
        <Link to="/blog">
          <Button>
            阅读博客
            <ArrowRight className="size-4" />
          </Button>
        </Link>
        <Link to="/about">
          <Button variant="outline">了解更多</Button>
        </Link>
      </motion.div>
    </section>
  )
}