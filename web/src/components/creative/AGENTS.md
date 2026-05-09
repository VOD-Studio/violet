<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-09 | Updated: 2026-05-09 -->

# components/creative

## Purpose
创意视觉效果组件，提供动态交互和动画效果。用于增强用户体验的装饰性组件。

## Key Files
| File | Description |
|------|-------------|
| `CursorEffect.tsx` | 鼠标光标跟随效果 |
| `KineticText.tsx` | 动态文字动画效果 |
| `MagneticButton.tsx` | 磁性吸附按钮效果 |
| `ParticleBackground.tsx` | 粒子背景效果 |
| `ScrollReveal.tsx` | 滚动显示动画 |
| `TextReveal.tsx` | 文字揭示动画 |
| `index.ts` | 桶式导出 |

## For AI Agents

### Working In This Directory
- 这些组件主要用于首页和展示页面
- 动画效果使用 CSS 动画或 Framer Motion
- 使用 `../../hooks/useReducedMotion.ts` 尊重用户动画偏好

### Common Patterns
- 所有创意组件支持 `prefers-reduced-motion`
- 通过 index.ts 统一导出

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
