"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export function StudySectionNav({
  hasAnalysisGroups,
}: {
  hasAnalysisGroups: boolean;
}) {
  const sections = useMemo(
    () => [
      { id: "overview", label: "Overview" },
      { id: "arms", label: "Arms" },
      ...(hasAnalysisGroups
        ? [{ id: "analysis-groups", label: "Analysis groups" }]
        : []),
      { id: "endpoints", label: "Endpoints" },
      { id: "sources", label: "Sources" },
    ],
    [hasAnalysisGroups],
  );
  const sectionIds = useMemo(
    () => sections.map((section) => section.id),
    [sections],
  );
  const [activeId, setActiveId] = useState("overview");
  const linkRefs = useRef(new Map<string, HTMLAnchorElement>());
  const initializedRef = useRef(false);
  const navigationTargetRef = useRef<{
    id: string;
    expiresAt: number;
  } | null>(null);

  useEffect(() => {
    const hashId = window.location.hash.slice(1);
    const initialId = sectionIds.includes(hashId) ? hashId : "overview";
    const initializeFrame = window.requestAnimationFrame(() => {
      initializedRef.current = true;
      setActiveId(initialId);
      const url = new URL(window.location.href);
      if (url.hash !== `#${initialId}`) {
        url.hash = initialId;
        window.history.replaceState(null, "", url);
      }
    });

    let scrollFrame: number | null = null;
    const updateActiveFromScroll = () => {
      if (scrollFrame !== null) return;
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = null;
        const atPageEnd =
          window.scrollY + window.innerHeight >=
          document.documentElement.scrollHeight - 2;
        const navigationTarget = navigationTargetRef.current;
        if (
          navigationTarget &&
          window.performance.now() < navigationTarget.expiresAt
        ) {
          const target = document.getElementById(navigationTarget.id);
          const reachedTarget =
            (atPageEnd && navigationTarget.id === sectionIds.at(-1)) ||
            Boolean(target && target.getBoundingClientRect().top <= 96);
          if (!reachedTarget) return;
          navigationTargetRef.current = null;
        }
        navigationTargetRef.current = null;
        if (atPageEnd) {
          setActiveId(sectionIds.at(-1) ?? "overview");
          return;
        }

        let nextId = sectionIds[0] ?? "overview";
        for (const id of sectionIds) {
          const element = document.getElementById(id);
          if (!element || element.getBoundingClientRect().top > 96) break;
          nextId = id;
        }
        setActiveId(nextId);
      });
    };

    const restoreHash = () => {
      const nextId = window.location.hash.slice(1);
      if (!sectionIds.includes(nextId)) return;
      navigationTargetRef.current = {
        id: nextId,
        expiresAt: window.performance.now() + 1_500,
      };
      setActiveId(nextId);
      document.getElementById(nextId)?.scrollIntoView({ block: "start" });
    };
    window.addEventListener("scroll", updateActiveFromScroll, { passive: true });
    window.addEventListener("popstate", restoreHash);
    return () => {
      window.cancelAnimationFrame(initializeFrame);
      if (scrollFrame !== null) window.cancelAnimationFrame(scrollFrame);
      window.removeEventListener("scroll", updateActiveFromScroll);
      window.removeEventListener("popstate", restoreHash);
    };
  }, [sectionIds]);

  useEffect(() => {
    if (!initializedRef.current) return;
    const url = new URL(window.location.href);
    if (url.hash !== `#${activeId}`) {
      url.hash = activeId;
      window.history.replaceState(null, "", url);
    }
    linkRefs.current.get(activeId)?.scrollIntoView({
      block: "nearest",
      inline: "center",
    });
  }, [activeId]);

  const navigateTo = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    navigationTargetRef.current = {
      id,
      expiresAt: window.performance.now() + 1_500,
    };
    document.getElementById(id)?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
    const url = new URL(window.location.href);
    url.hash = id;
    window.history.pushState(null, "", url);
    setActiveId(id);
  };

  return (
    <nav
      aria-label="Study sections"
      className="sticky top-0 z-20 -mx-5 overflow-x-auto border-b border-border bg-background/95 px-5 backdrop-blur-sm sm:-mx-8 sm:px-8"
    >
      <ul className="flex min-w-max gap-6">
        {sections.map((section) => {
          const active = activeId === section.id;
          return (
            <li key={section.id}>
              <a
                ref={(node) => {
                  if (node) linkRefs.current.set(section.id, node);
                  else linkRefs.current.delete(section.id);
                }}
                href={`#${section.id}`}
                aria-current={active ? "location" : undefined}
                onClick={(event) => navigateTo(event, section.id)}
                className={`inline-flex whitespace-nowrap border-b-2 px-0 py-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                {section.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
