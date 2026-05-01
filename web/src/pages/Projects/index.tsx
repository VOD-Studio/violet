import { KineticText } from "@/components/creative"
import { ProjectsGrid } from "./ProjectsGrid"
import { SandboxSection } from "./SandboxSection"

export default function Projects() {
  return (
    <div className="container mx-auto px-4 py-12">
      <KineticText
        as="h1"
        animation="fadeUp"
        className="mb-4 text-3xl font-bold"
      >
        项目
      </KineticText>

      <p className="mb-12 text-muted-foreground">
        这里是我参与开发的一些开源和个人项目。
      </p>

      <ProjectsGrid />
      <SandboxSection />
    </div>
  )
}