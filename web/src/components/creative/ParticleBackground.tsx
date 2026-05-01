// 粒子背景组件
// Canvas 2D 绘制粒子和连线，支持鼠标交互，自动暂停不可见区域的动画

import { useRef, useEffect, useCallback } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** 粒子实例 */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface ParticleBackgroundProps {
  /** 粒子数量，默认 80 */
  particleCount?: number;
  /** 粒子颜色，默认 rgba(150, 150, 150, 0.6) */
  color?: string;
  /** 连线颜色，默认 rgba(150, 150, 150, 0.15) */
  lineColor?: string;
  /** 粒子速度倍率，默认 1 */
  speed?: number;
  /** 连线最大距离，默认 120 */
  connectionDistance?: number;
  /** 鼠标排斥半径，默认 100 */
  mouseRepelDistance?: number;
  /** 鼠标排斥力度，默认 0.05 */
  mouseRepelStrength?: number;
  /** 额外的 CSS 类名 */
  className?: string;
}

/**
 * 粒子背景组件
 * 在 Canvas 上绘制浮动粒子及连线，鼠标靠近时粒子会被推开
 */
export function ParticleBackground({
  particleCount = 80,
  color = "rgba(150, 150, 150, 0.6)",
  lineColor = "rgba(150, 150, 150, 0.15)",
  speed = 1,
  connectionDistance = 120,
  mouseRepelDistance = 100,
  mouseRepelStrength = 0.05,
  className,
}: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReduced = useReducedMotion();

  // 存储可变引用，避免 effect 依赖频繁变化
  const configRef = useRef({
    particleCount,
    color,
    lineColor,
    speed,
    connectionDistance,
    mouseRepelDistance,
    mouseRepelStrength,
  });

  // 每次渲染更新配置引用
  useEffect(() => {
    configRef.current = {
      particleCount,
      color,
      lineColor,
      speed,
      connectionDistance,
      mouseRepelDistance,
      mouseRepelStrength,
    };
  });

  /** 创建粒子数组 */
  const createParticles = useCallback(
    (width: number, height: number): Particle[] => {
      return Array.from({ length: configRef.current.particleCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * configRef.current.speed,
        vy: (Math.random() - 0.5) * configRef.current.speed,
        radius: Math.random() * 2 + 1,
      }));
    },
    [],
  );

  useEffect(() => {
    // 减少动画模式下不初始化 Canvas
    if (prefersReduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let isVisible = true;
    let particles: Particle[] = [];
    const mouse = { x: -9999, y: -9999 };

    /** 根据容器尺寸设置 Canvas 大小 */
    function resize() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      canvas!.width = rect.width * devicePixelRatio;
      canvas!.height = rect.height * devicePixelRatio;
      canvas!.style.width = `${rect.width}px`;
      canvas!.style.height = `${rect.height}px`;
      ctx!.scale(devicePixelRatio, devicePixelRatio);
      particles = createParticles(rect.width, rect.height);
    }

    /** 主绘制循环 */
    function draw() {
      if (!isVisible) {
        animId = requestAnimationFrame(draw);
        return;
      }

      const parent = canvas!.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      const {
        color: pColor,
        lineColor: lColor,
        speed: sp,
        connectionDistance: cd,
        mouseRepelDistance: mrd,
        mouseRepelStrength: mrs,
      } = configRef.current;

      ctx!.clearRect(0, 0, width, height);

      // 更新并绘制粒子
      for (const p of particles) {
        p.x += p.vx * sp;
        p.y += p.vy * sp;

        // 边界反弹
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
        p.x = Math.max(0, Math.min(width, p.x));
        p.y = Math.max(0, Math.min(height, p.y));

        // 鼠标排斥
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mrd && dist > 0) {
          const force = ((mrd - dist) / mrd) * mrs;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }

        // 速度衰减，防止粒子飞太快
        p.vx *= 0.99;
        p.vy *= 0.99;

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx!.fillStyle = pColor;
        ctx!.fill();
      }

      // 绘制连线
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < cd) {
            const alpha = 1 - dist / cd;
            ctx!.beginPath();
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.strokeStyle = lColor.replace(/[\d.]+\)$/, `${alpha * 0.3})`);
            ctx!.lineWidth = 0.5;
            ctx!.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    }

    // 鼠标移动
    function handleMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }

    function handleMouseLeave() {
      mouse.x = -9999;
      mouse.y = -9999;
    }

    // IntersectionObserver 控制不可见时暂停动画
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { threshold: 0 },
    );
    observer.observe(canvas);

    window.addEventListener("resize", resize);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    resize();
    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [prefersReduced, createParticles]);

  // 减少动画模式下渲染静态纯色背景
  if (prefersReduced) {
    return (
      <div
        className={className}
        style={{ backgroundColor: "transparent" }}
        aria-hidden
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: "block" }}
      aria-hidden
    />
  );
}
