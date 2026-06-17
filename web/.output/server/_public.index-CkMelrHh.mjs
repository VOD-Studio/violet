import { j as jsxRuntimeExports, r as reactExports } from "./_libs/react.mjs";
import { e as env, a as api, g as getUploadUrl } from "./_ssr/router-BNo7MsOr.mjs";
import { L as Link } from "./_libs/tanstack__react-router.mjs";
import { c as cva } from "./_libs/class-variance-authority.mjs";
import { c as clsx } from "./_libs/clsx.mjs";
import { t as twMerge } from "./_libs/tailwind-merge.mjs";
import { u as useQuery } from "./_libs/tanstack__react-query.mjs";
import "./_libs/next-themes.mjs";
import "./_libs/sonner.mjs";
import { m as motion, u as useMotionValue, a as useAnimationFrame, b as useTransform } from "./_libs/framer-motion.mjs";
import { A as ArrowRight, a as Calendar, E as Eye } from "./_libs/lucide-react.mjs";
import { S as Slot } from "./_libs/radix-ui__react-slot.mjs";
import "./_libs/tanstack__router-core.mjs";
import "./_libs/tanstack__history.mjs";
import "node:stream/web";
import "node:stream";
import "./_libs/@tanstack/react-router-ssr-query+[...].mjs";
import "./_libs/@tanstack/router-ssr-query-core+[...].mjs";
import "./_libs/tanstack__query-core.mjs";
import "./_libs/axios.mjs";
import "./_libs/form-data.mjs";
import "fs";
import "./_libs/combined-stream.mjs";
import "util";
import "stream";
import "./_libs/delayed-stream.mjs";
import "path";
import "http";
import "https";
import "url";
import "crypto";
import "./_libs/mime-types.mjs";
import "./_libs/mime-db.mjs";
import "./_libs/asynckit.mjs";
import "./_libs/es-set-tostringtag.mjs";
import "./_libs/get-intrinsic.mjs";
import "./_libs/es-object-atoms.mjs";
import "./_libs/es-errors.mjs";
import "./_libs/math-intrinsics.mjs";
import "./_libs/gopd.mjs";
import "./_libs/es-define-property.mjs";
import "./_libs/has-symbols.mjs";
import "./_libs/get-proto.mjs";
import "./_libs/dunder-proto.mjs";
import "./_libs/call-bind-apply-helpers.mjs";
import "./_libs/function-bind.mjs";
import "./_libs/hasown.mjs";
import "./_libs/has-tostringtag.mjs";
import "./_libs/proxy-from-env.mjs";
import "./_libs/https-proxy-agent.mjs";
import "net";
import "tls";
import "assert";
import "./_libs/debug.mjs";
import "tty";
import "./_libs/ms.mjs";
import "./_libs/supports-color.mjs";
import "node:process";
import "node:os";
import "node:tty";
import "./_libs/agent-base.mjs";
import "events";
import "http2";
import "./_libs/follow-redirects.mjs";
import "zlib";
import "./_libs/zustand.mjs";
import "./_libs/react-dom.mjs";
import "async_hooks";
import "./_libs/isbot.mjs";
import "./_libs/motion-dom.mjs";
import "./_libs/motion-utils.mjs";
import "./_libs/radix-ui__react-compose-refs.mjs";
const SITE_CONFIG = {
  name: "开发者博客",
  description: "全栈开发者的技术博客，分享 React、TypeScript、Node.js 等技术经验与项目实践。",
  url: env.siteUrl,
  author: "开发者",
  image: "/og-default.png"
};
function generateTitle(title, appendSiteName = true) {
  if (!appendSiteName) return title;
  return `${title} | ${SITE_CONFIG.name}`;
}
function generateWebsiteStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_CONFIG.name,
    url: SITE_CONFIG.url,
    description: SITE_CONFIG.description,
    author: {
      "@type": "Person",
      name: SITE_CONFIG.author
    }
  };
}
function generateMetaTags(config) {
  const tags = [];
  tags.push({
    name: "description",
    content: config.description
  });
  if (config.keywords?.length) {
    tags.push({
      name: "keywords",
      content: config.keywords.join(", ")
    });
  }
  if (config.author) {
    tags.push({
      name: "author",
      content: config.author
    });
  }
  tags.push({ property: "og:title", content: config.title });
  tags.push({ property: "og:description", content: config.description });
  tags.push({ property: "og:type", content: config.type ?? "website" });
  if (config.url) {
    tags.push({ property: "og:url", content: config.url });
  }
  if (config.image) {
    tags.push({ property: "og:image", content: config.image });
  }
  tags.push({ name: "twitter:card", content: "summary_large_image" });
  tags.push({ name: "twitter:title", content: config.title });
  tags.push({ name: "twitter:description", content: config.description });
  if (config.image) {
    tags.push({ name: "twitter:image", content: config.image });
  }
  return tags;
}
function applyMetaTags(tags) {
  for (const tag of tags) {
    const meta = document.createElement("meta");
    meta.setAttribute("data-seo", "true");
    if (tag.name) {
      meta.setAttribute("name", tag.name);
    }
    if (tag.property) {
      meta.setAttribute("property", tag.property);
    }
    meta.setAttribute("content", tag.content);
    document.head.appendChild(meta);
  }
}
function cleanupSEOTags() {
  const elements = document.head.querySelectorAll("[data-seo]");
  for (const el of elements) {
    el.remove();
  }
}
function SEO({
  title,
  description,
  keywords,
  author,
  image,
  url,
  type = "website",
  appendSiteName = true
}) {
  reactExports.useEffect(() => {
    document.title = generateTitle(title, appendSiteName);
    const config = {
      title: appendSiteName ? generateTitle(title) : title,
      description,
      keywords,
      author: author ?? SITE_CONFIG.author,
      image: image ?? SITE_CONFIG.image,
      url,
      type
    };
    const tags = generateMetaTags(config);
    applyMetaTags(tags);
    if (url) {
      const link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      link.setAttribute("href", url);
      link.setAttribute("data-seo", "true");
      document.head.appendChild(link);
    }
    return () => {
      cleanupSEOTags();
    };
  }, [title, description, keywords, author, image, url, type, appendSiteName]);
  return null;
}
function StructuredData({ data }) {
  reactExports.useEffect(() => {
    const script = document.createElement("script");
    script.setAttribute("type", "application/ld+json");
    script.setAttribute("data-structured-data", "true");
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [data]);
  return null;
}
function DecryptedText({
  text,
  speed = 50,
  maxIterations = 10,
  sequential = false,
  revealDirection = "start",
  useOriginalCharsOnly = false,
  characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+",
  className = "",
  parentClassName = "",
  encryptedClassName = "",
  animateOn = "hover",
  clickMode = "once",
  ...props
}) {
  const [displayText, setDisplayText] = reactExports.useState(text);
  const [isAnimating, setIsAnimating] = reactExports.useState(false);
  const [revealedIndices, setRevealedIndices] = reactExports.useState(
    /* @__PURE__ */ new Set()
  );
  const [hasAnimated, setHasAnimated] = reactExports.useState(false);
  const [isDecrypted, setIsDecrypted] = reactExports.useState(
    animateOn !== "click"
  );
  const [direction, setDirection] = reactExports.useState("forward");
  const containerRef = reactExports.useRef(null);
  const orderRef = reactExports.useRef([]);
  const pointerRef = reactExports.useRef(0);
  const intervalRef = reactExports.useRef(null);
  const availableChars = reactExports.useMemo(() => {
    return useOriginalCharsOnly ? Array.from(new Set(text.split(""))).filter((char) => char !== " ") : characters.split("");
  }, [useOriginalCharsOnly, text, characters]);
  const shuffleText = reactExports.useCallback(
    (originalText, currentRevealed) => {
      return originalText.split("").map((char, i) => {
        if (char === " ") return " ";
        if (currentRevealed.has(i)) return originalText[i];
        return availableChars[Math.floor(Math.random() * availableChars.length)];
      }).join("");
    },
    [availableChars]
  );
  const computeOrder = reactExports.useCallback(
    (len) => {
      const order = [];
      if (len <= 0) return order;
      if (revealDirection === "start") {
        for (let i = 0; i < len; i++) order.push(i);
        return order;
      }
      if (revealDirection === "end") {
        for (let i = len - 1; i >= 0; i--) order.push(i);
        return order;
      }
      const middle = Math.floor(len / 2);
      let offset = 0;
      while (order.length < len) {
        if (offset % 2 === 0) {
          const idx = middle + offset / 2;
          if (idx >= 0 && idx < len) order.push(idx);
        } else {
          const idx = middle - Math.ceil(offset / 2);
          if (idx >= 0 && idx < len) order.push(idx);
        }
        offset++;
      }
      return order.slice(0, len);
    },
    [revealDirection]
  );
  const fillAllIndices = reactExports.useCallback(() => {
    const s = /* @__PURE__ */ new Set();
    for (let i = 0; i < text.length; i++) s.add(i);
    return s;
  }, [text]);
  const removeRandomIndices = reactExports.useCallback(
    (set, count) => {
      const arr = Array.from(set);
      for (let i = 0; i < count && arr.length > 0; i++) {
        const idx = Math.floor(Math.random() * arr.length);
        arr.splice(idx, 1);
      }
      return new Set(arr);
    },
    []
  );
  const encryptInstantly = reactExports.useCallback(() => {
    const emptySet = /* @__PURE__ */ new Set();
    setRevealedIndices(emptySet);
    setDisplayText(shuffleText(text, emptySet));
    setIsDecrypted(false);
  }, [text, shuffleText]);
  const triggerDecrypt = reactExports.useCallback(() => {
    if (sequential) {
      orderRef.current = computeOrder(text.length);
      pointerRef.current = 0;
      setRevealedIndices(/* @__PURE__ */ new Set());
    } else {
      setRevealedIndices(/* @__PURE__ */ new Set());
    }
    setDirection("forward");
    setIsAnimating(true);
  }, [sequential, computeOrder, text.length]);
  const triggerReverse = reactExports.useCallback(() => {
    if (sequential) {
      orderRef.current = computeOrder(text.length).slice().reverse();
      pointerRef.current = 0;
      setRevealedIndices(fillAllIndices());
      setDisplayText(shuffleText(text, fillAllIndices()));
    } else {
      setRevealedIndices(fillAllIndices());
      setDisplayText(shuffleText(text, fillAllIndices()));
    }
    setDirection("reverse");
    setIsAnimating(true);
  }, [sequential, computeOrder, fillAllIndices, shuffleText, text]);
  reactExports.useEffect(() => {
    if (!isAnimating) return;
    let currentIteration = 0;
    const getNextIndex = (revealedSet) => {
      const textLength = text.length;
      switch (revealDirection) {
        case "start":
          return revealedSet.size;
        case "end":
          return textLength - 1 - revealedSet.size;
        case "center": {
          const middle = Math.floor(textLength / 2);
          const offset = Math.floor(revealedSet.size / 2);
          const nextIndex = revealedSet.size % 2 === 0 ? middle + offset : middle - offset - 1;
          if (nextIndex >= 0 && nextIndex < textLength && !revealedSet.has(nextIndex)) {
            return nextIndex;
          }
          for (let i = 0; i < textLength; i++) {
            if (!revealedSet.has(i)) return i;
          }
          return 0;
        }
        default:
          return revealedSet.size;
      }
    };
    intervalRef.current = setInterval(() => {
      setRevealedIndices((prevRevealed) => {
        if (sequential) {
          if (direction === "forward") {
            if (prevRevealed.size < text.length) {
              const nextIndex = getNextIndex(prevRevealed);
              const newRevealed = new Set(prevRevealed);
              newRevealed.add(nextIndex);
              setDisplayText(shuffleText(text, newRevealed));
              return newRevealed;
            }
            clearInterval(intervalRef.current ?? void 0);
            setIsAnimating(false);
            setIsDecrypted(true);
            return prevRevealed;
          }
          if (direction === "reverse") {
            if (pointerRef.current < orderRef.current.length) {
              const idxToRemove = orderRef.current[pointerRef.current++];
              const newRevealed = new Set(prevRevealed);
              newRevealed.delete(idxToRemove);
              setDisplayText(shuffleText(text, newRevealed));
              if (newRevealed.size === 0) {
                clearInterval(intervalRef.current ?? void 0);
                setIsAnimating(false);
                setIsDecrypted(false);
              }
              return newRevealed;
            }
            clearInterval(intervalRef.current ?? void 0);
            setIsAnimating(false);
            setIsDecrypted(false);
            return prevRevealed;
          }
        } else {
          if (direction === "forward") {
            setDisplayText(shuffleText(text, prevRevealed));
            currentIteration++;
            if (currentIteration >= maxIterations) {
              clearInterval(intervalRef.current ?? void 0);
              setIsAnimating(false);
              setDisplayText(text);
              setIsDecrypted(true);
            }
            return prevRevealed;
          }
          if (direction === "reverse") {
            let currentSet = prevRevealed;
            if (currentSet.size === 0) {
              currentSet = fillAllIndices();
            }
            const removeCount = Math.max(
              1,
              Math.ceil(text.length / Math.max(1, maxIterations))
            );
            const nextSet = removeRandomIndices(currentSet, removeCount);
            setDisplayText(shuffleText(text, nextSet));
            currentIteration++;
            if (nextSet.size === 0 || currentIteration >= maxIterations) {
              clearInterval(intervalRef.current ?? void 0);
              setIsAnimating(false);
              setIsDecrypted(false);
              setDisplayText(shuffleText(text, /* @__PURE__ */ new Set()));
              return /* @__PURE__ */ new Set();
            }
            return nextSet;
          }
        }
        return prevRevealed;
      });
    }, speed);
    return () => clearInterval(intervalRef.current ?? void 0);
  }, [
    isAnimating,
    text,
    speed,
    maxIterations,
    sequential,
    revealDirection,
    shuffleText,
    direction,
    fillAllIndices,
    removeRandomIndices,
    characters,
    useOriginalCharsOnly
  ]);
  const handleClick = () => {
    if (animateOn !== "click") return;
    if (clickMode === "once") {
      if (isDecrypted) return;
      setDirection("forward");
      triggerDecrypt();
    }
    if (clickMode === "toggle") {
      if (isDecrypted) {
        triggerReverse();
      } else {
        setDirection("forward");
        triggerDecrypt();
      }
    }
  };
  const triggerHoverDecrypt = reactExports.useCallback(() => {
    if (isAnimating) return;
    setRevealedIndices(/* @__PURE__ */ new Set());
    setIsDecrypted(false);
    setDisplayText(text);
    setDirection("forward");
    setIsAnimating(true);
  }, [isAnimating, text]);
  const resetToPlainText = reactExports.useCallback(() => {
    clearInterval(intervalRef.current ?? void 0);
    setIsAnimating(false);
    setRevealedIndices(/* @__PURE__ */ new Set());
    setDisplayText(text);
    setIsDecrypted(true);
    setDirection("forward");
  }, [text]);
  reactExports.useEffect(() => {
    if (animateOn !== "view" && animateOn !== "inViewHover") return;
    const observerCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !hasAnimated) {
          triggerDecrypt();
          setHasAnimated(true);
        }
      });
    };
    const observerOptions = {
      root: null,
      rootMargin: "0px",
      threshold: 0.1
    };
    const observer = new IntersectionObserver(
      observerCallback,
      observerOptions
    );
    const currentRef = containerRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }
    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, [animateOn, hasAnimated, triggerDecrypt]);
  reactExports.useEffect(() => {
    if (animateOn === "click") {
      encryptInstantly();
    } else {
      setDisplayText(text);
      setIsDecrypted(true);
    }
    setRevealedIndices(/* @__PURE__ */ new Set());
    setDirection("forward");
  }, [animateOn, text, encryptInstantly]);
  const animateProps = animateOn === "hover" || animateOn === "inViewHover" ? {
    onMouseEnter: triggerHoverDecrypt,
    onMouseLeave: resetToPlainText
  } : animateOn === "click" ? { onClick: handleClick } : {};
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    motion.span,
    {
      ref: containerRef,
      className: `inline-block whitespace-pre-wrap ${parentClassName}`,
      ...animateProps,
      ...props,
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "sr-only", children: displayText }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { "aria-hidden": "true", children: displayText.split("").map((char, index) => {
          const isRevealedOrDone = revealedIndices.has(index) || !isAnimating && isDecrypted;
          return /* @__PURE__ */ jsxRuntimeExports.jsx(
            "span",
            {
              className: isRevealedOrDone ? className : encryptedClassName,
              children: char
            },
            `${char}-${index}`
          );
        }) })
      ]
    }
  );
}
function GradientText({
  children,
  className = "",
  colors = ["#5227FF", "#FF9FFC", "#B497CF"],
  animationSpeed = 8,
  showBorder = false,
  direction = "horizontal",
  pauseOnHover = false,
  yoyo = true
}) {
  const [isPaused, setIsPaused] = reactExports.useState(false);
  const progress = useMotionValue(0);
  const elapsedRef = reactExports.useRef(0);
  const lastTimeRef = reactExports.useRef(null);
  const animationDuration = animationSpeed * 1e3;
  useAnimationFrame((time) => {
    if (isPaused) {
      lastTimeRef.current = null;
      return;
    }
    if (lastTimeRef.current === null) {
      lastTimeRef.current = time;
      return;
    }
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;
    elapsedRef.current += deltaTime;
    if (yoyo) {
      const fullCycle = animationDuration * 2;
      const cycleTime = elapsedRef.current % fullCycle;
      if (cycleTime < animationDuration) {
        progress.set(cycleTime / animationDuration * 100);
      } else {
        progress.set(
          100 - (cycleTime - animationDuration) / animationDuration * 100
        );
      }
    } else {
      progress.set(elapsedRef.current / animationDuration * 100);
    }
  });
  reactExports.useEffect(() => {
    elapsedRef.current = 0;
    progress.set(0);
  }, [animationSpeed, yoyo]);
  const backgroundPosition = useTransform(progress, (p) => {
    if (direction === "horizontal") {
      return `${p}% 50%`;
    }
    if (direction === "vertical") {
      return `50% ${p}%`;
    }
    return `${p}% 50%`;
  });
  const handleMouseEnter = reactExports.useCallback(() => {
    if (pauseOnHover) setIsPaused(true);
  }, [pauseOnHover]);
  const handleMouseLeave = reactExports.useCallback(() => {
    if (pauseOnHover) setIsPaused(false);
  }, [pauseOnHover]);
  const gradientAngle = direction === "horizontal" ? "to right" : direction === "vertical" ? "to bottom" : "to bottom right";
  const gradientColors = [...colors, colors[0]].join(", ");
  const gradientStyle = {
    backgroundImage: `linear-gradient(${gradientAngle}, ${gradientColors})`,
    backgroundSize: direction === "horizontal" ? "300% 100%" : direction === "vertical" ? "100% 300%" : "300% 300%",
    backgroundRepeat: "repeat"
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    motion.div,
    {
      className: `relative mx-auto flex max-w-fit flex-row items-center justify-center rounded-[1.25rem] font-medium backdrop-blur transition-shadow duration-500 overflow-hidden cursor-pointer ${showBorder ? "py-1 px-2" : ""} ${className}`,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      children: [
        showBorder && /* @__PURE__ */ jsxRuntimeExports.jsx(
          motion.div,
          {
            className: "absolute inset-0 z-0 pointer-events-none rounded-[1.25rem]",
            style: { ...gradientStyle, backgroundPosition },
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(
              "div",
              {
                className: "absolute bg-black rounded-[1.25rem] z-[-1]",
                style: {
                  width: "calc(100% - 2px)",
                  height: "calc(100% - 2px)",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)"
                }
              }
            )
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          motion.div,
          {
            className: "inline-block relative z-2 text-transparent bg-clip-text",
            style: {
              ...gradientStyle,
              backgroundPosition,
              WebkitBackgroundClip: "text"
            },
            children
          }
        )
      ]
    }
  );
}
function cn(...inputs) {
  return twMerge(clsx(inputs));
}
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        outline: "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost: "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs": "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);
function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot : "button";
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Comp,
    {
      "data-slot": "button",
      "data-variant": variant,
      "data-size": size,
      className: cn(buttonVariants({ variant, size, className })),
      ...props
    }
  );
}
const Aurora = reactExports.lazy(() => import("./_ssr/Aurora-D_kLzvKc.mjs"));
function HeroSection() {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "relative flex min-h-[90vh] flex-col items-center justify-center gap-8 overflow-hidden px-4 text-center", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pointer-events-none absolute inset-0 -z-10", children: /* @__PURE__ */ jsxRuntimeExports.jsx(reactExports.Suspense, { fallback: null, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      Aurora,
      {
        colorStops: ["#5227FF", "#7CFF67", "#5227FF"],
        amplitude: 1,
        blend: 0.5
      }
    ) }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      GradientText,
      {
        colors: ["#5227FF", "#FF9FFC", "#B497CF", "#5227FF"],
        animationSpeed: 6,
        className: "text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl",
        children: "你好，我是开发者"
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      motion.p,
      {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.6, delay: 0.3 },
        className: "max-w-2xl text-lg text-muted-foreground",
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          DecryptedText,
          {
            text: "全栈开发者，热爱开源与技术写作。专注于 React、TypeScript 和 Node.js 生态",
            animateOn: "view",
            speed: 50,
            maxIterations: 8,
            sequential: true,
            revealDirection: "start"
          }
        )
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      motion.div,
      {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.6, delay: 0.5 },
        className: "flex gap-3",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/blog", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { size: "lg", children: [
            "阅读博客",
            /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowRight, { className: "size-4" })
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/about", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { variant: "outline", size: "lg", children: "了解更多" }) })
        ]
      }
    )
  ] });
}
function usePosts(params = {}) {
  const { page = 1, limit = 6, tag, search } = params;
  return useQuery({
    queryKey: ["posts", { page, limit, tag, search }],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      searchParams.set("page", String(page));
      searchParams.set("limit", String(limit));
      if (tag) searchParams.set("tag", tag);
      if (search) searchParams.set("search", search);
      return api.get(`/posts?${searchParams.toString()}`);
    }
  });
}
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}
function PostCard({ post, delay = 0 }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    motion.article,
    {
      initial: { opacity: 0, y: 20 },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: true },
      transition: { duration: 0.4, delay },
      whileHover: { y: -4 },
      className: "group overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-lg",
      children: [
        post.coverImage && /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/blog/$slug", params: { slug: post.slug }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "aspect-video overflow-hidden", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          "img",
          {
            src: getUploadUrl(post.coverImage),
            alt: post.title,
            className: "size-full object-cover transition-transform duration-300 group-hover:scale-105"
          }
        ) }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "p-6", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mb-3 flex flex-wrap gap-2", children: post.tags?.map((tag) => /* @__PURE__ */ jsxRuntimeExports.jsx(
            "span",
            {
              className: "rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground",
              children: tag.name
            },
            tag.id
          )) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/blog/$slug", params: { slug: post.slug }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "mb-2 text-lg font-semibold transition-colors group-hover:text-primary", children: post.title }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mb-4 text-sm text-muted-foreground line-clamp-2", children: post.excerpt }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-4 text-xs text-muted-foreground", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex items-center gap-1", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Calendar, { className: "size-3.5" }),
              formatDate(post.createdAt)
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex items-center gap-1", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Eye, { className: "size-3.5" }),
              (post.viewCount ?? 0).toLocaleString()
            ] })
          ] })
        ] })
      ]
    }
  );
}
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 }
};
function RecentPostsSection() {
  const { data, isLoading, error } = usePosts({ page: 1, limit: 3 });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "container mx-auto px-4 py-20", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      motion.h2,
      {
        initial: "hidden",
        whileInView: "visible",
        viewport: { once: true, margin: "-80px" },
        variants: fadeUp,
        transition: { duration: 0.5 },
        className: "mb-10 text-center text-3xl font-bold tracking-tight sm:text-4xl",
        children: "近期文章"
      }
    ),
    isLoading ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid gap-6 sm:grid-cols-2 lg:grid-cols-3", children: [0, 1, 2].map((n) => /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        className: "h-64 animate-pulse rounded-lg border bg-muted"
      },
      n
    )) }) : error ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "py-12 text-center text-muted-foreground", children: "加载文章失败，请稍后重试" }) : data?.posts?.length ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid gap-6 sm:grid-cols-2 lg:grid-cols-3", children: data.posts.map((post, index) => /* @__PURE__ */ jsxRuntimeExports.jsx(
      motion.div,
      {
        initial: "hidden",
        whileInView: "visible",
        viewport: { once: true, margin: "-60px" },
        variants: fadeUp,
        transition: { duration: 0.5, delay: index * 0.1 },
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(PostCard, { post })
      },
      post.id
    )) }) : /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "py-12 text-center text-muted-foreground", children: "暂无文章" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      motion.div,
      {
        initial: "hidden",
        whileInView: "visible",
        viewport: { once: true },
        variants: fadeUp,
        transition: { duration: 0.5 },
        className: "mt-12 flex justify-center",
        children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
          Link,
          {
            to: "/blog",
            className: "group inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-medium transition-colors hover:bg-accent",
            children: [
              "查看全部文章",
              /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowRight, { className: "size-4 transition-transform group-hover:translate-x-1" })
            ]
          }
        )
      }
    )
  ] });
}
function Home() {
  const websiteData = generateWebsiteStructuredData();
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      SEO,
      {
        title: "首页",
        description: SITE_CONFIG.description,
        url: SITE_CONFIG.url,
        type: "website"
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(StructuredData, { data: websiteData }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(HeroSection, {}),
    /* @__PURE__ */ jsxRuntimeExports.jsx(RecentPostsSection, {})
  ] });
}
function HomePage() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Home, {});
}
export {
  HomePage as component
};
