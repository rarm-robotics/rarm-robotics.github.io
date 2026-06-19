(function () {
  "use strict";

  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── Scroll-reveal ──────────────────────────────────────────────────── */

  function initRevealAnimations() {
    const nodes = document.querySelectorAll("[data-reveal]");
    if (!nodes.length) return;

    if (REDUCED_MOTION || !("IntersectionObserver" in window)) {
      for (const node of nodes) node.classList.add("is-visible");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.2 }
    );

    for (const node of nodes) observer.observe(node);
  }

  /* ── Progress sidebar + section spy ────────────────────────────────── */

  function initSectionSpy() {
    const navEntries = [];

    for (const item of document.querySelectorAll(".progress-item[data-section]")) {
      const link = item.querySelector("a");
      const id = item.dataset.section || (link ? link.dataset.nav : "");
      if (!link || !id) continue;
      navEntries.push({ id, link, progressItem: item });
    }

    if (!navEntries.length) return;

    const sections = [];
    const sectionById = new Map();
    const navOrder = [];
    const entryGroups = new Map();
    const progressTrack = document.querySelector(".progress-track");
    const progressFill = progressTrack ? progressTrack.querySelector(".progress-line-fill") : null;

    for (const entry of navEntries) {
      const id = entry.id;
      const section = document.getElementById(id);
      if (!section) continue;

      if (!sectionById.has(id)) {
        sections.push(section);
        sectionById.set(id, section);
        navOrder.push(id);
      }

      if (!entryGroups.has(id)) entryGroups.set(id, []);
      entryGroups.get(id).push(entry);
    }

    if (!sections.length) return;

    const updateProgressFill = (activeIndex) => {
      if (!progressTrack || !progressFill) return;

      const progressItems = navOrder
        .map((id) => {
          const group = entryGroups.get(id) || [];
          return group.find((e) => e.progressItem)?.progressItem || null;
        })
        .filter(Boolean);

      if (!progressItems.length || activeIndex < 0) {
        progressFill.style.height = "0px";
        return;
      }

      const firstDot = progressItems[0].querySelector(".progress-dot");
      const activeItem = progressItems[Math.min(activeIndex, progressItems.length - 1)];
      const activeDot = activeItem ? activeItem.querySelector(".progress-dot") : null;
      if (!firstDot || !activeDot) {
        progressFill.style.height = "0px";
        return;
      }

      const trackRect = progressTrack.getBoundingClientRect();
      const start = firstDot.getBoundingClientRect().top + firstDot.offsetHeight / 2 - trackRect.top;
      const end = activeDot.getBoundingClientRect().top + activeDot.offsetHeight / 2 - trackRect.top;

      progressFill.style.top = start + "px";
      progressFill.style.height = Math.max(0, end - start) + "px";
    };

    const setActive = (id) => {
      const activeIndex = navOrder.indexOf(id);

      for (const [entryId, group] of entryGroups.entries()) {
        const isActive = entryId === id;
        const isPassed = activeIndex >= 0 && navOrder.indexOf(entryId) < activeIndex;

        for (const entry of group) {
          if (isActive) {
            entry.link.setAttribute("aria-current", "true");
          } else {
            entry.link.removeAttribute("aria-current");
          }
          if (entry.progressItem) {
            entry.progressItem.classList.toggle("active", isActive);
            entry.progressItem.classList.toggle("passed", isPassed);
          }
        }
      }

      updateProgressFill(activeIndex);
    };

    const getScrollTargetForSection = (section) => {
      if (!section) return null;
      const heading = section.previousElementSibling;
      if (heading && heading.classList.contains("tagline")) return heading;
      return section;
    };

    let updateRaf = 0;

    const syncActiveSection = () => {
      const probeY = Math.min(window.innerHeight * 0.22, 160);
      let activeId = sections[0].id;

      for (const section of sections) {
        if (section.getBoundingClientRect().top <= probeY) {
          activeId = section.id;
        } else {
          break;
        }
      }

      setActive(activeId);
    };

    const queueSyncActiveSection = () => {
      if (updateRaf) return;
      updateRaf = window.requestAnimationFrame(() => {
        updateRaf = 0;
        syncActiveSection();
      });
    };

    for (const entry of navEntries) {
      entry.link.addEventListener("click", (event) => {
        const id = entry.id;
        if (!id) return;

        setActive(id);

        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) return;

        const targetSection = sectionById.get(id);
        const scrollTarget = getScrollTargetForSection(targetSection);
        if (!scrollTarget) return;

        event.preventDefault();

        const targetTop = window.scrollY + scrollTarget.getBoundingClientRect().top;
        const nextY = Math.max(0, targetTop - 10);

        window.scrollTo({ top: nextY, behavior: REDUCED_MOTION ? "auto" : "smooth" });

        if (window.history && typeof window.history.pushState === "function") {
          window.history.pushState(null, "", "#" + id);
        } else {
          window.location.hash = id;
        }
      });
    }

    queueSyncActiveSection();
    window.addEventListener("scroll", queueSyncActiveSection, { passive: true });
    window.addEventListener("resize", queueSyncActiveSection, { passive: true });
  }

  /* ── Lazy video loader (for data-src videos added in future) ────────── */

  function initLazyVideos() {
    const videos = Array.from(document.querySelectorAll("video[data-src]"));
    if (!videos.length || !("IntersectionObserver" in window)) {
      for (const v of videos) {
        v.src = v.dataset.src;
        v.load();
      }
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const video = entry.target;
          observer.unobserve(video);
          video.src = video.dataset.src;
          video.load();
        }
      },
      { rootMargin: "200px", threshold: 0.01 }
    );

    for (const v of videos) observer.observe(v);
  }

  /* ── Init ───────────────────────────────────────────────────────────── */

  function init() {
    initRevealAnimations();
    initSectionSpy();
    initLazyVideos();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
