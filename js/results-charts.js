/* ──────────────────────────────────────────────────────────────────────────
   Interactive success-rate curve grid (mean ± std bands).
   Self-contained: fetches assets/data/results.json and renders one SVG panel
   per task into #results-grid, with a hover/toggle legend. Adapted from the
   SimDist raw-SVG renderer, plus translucent ±std bands behind each mean line.
   ────────────────────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  const TASK_ORDER = [
    "mw_coffee_pull",
    "mw_soccer",
    "mw_drawer_open",
    "mw_button_press_wall",
    "libero_stove_moka",
    "libero_bowl_drawer",
    "libero_book_caddy",
    "libero_mug_pudding",
    "libero_mug_microwave",
  ];

  // RARM (ours) first / most prominent; baselines distinct + muted.
  const METHOD_COLOR_MAP = {
    "RARM (ours)": "#1f77b4",
    RoboCLIP: "#d62728",
    TemporalOT: "#2ca02c",
    GVL: "#9467bd",
    RoboMeter: "#e377c2",
    RoboDopamine: "#ff7f0e",
    AblationSim: "#9f6559",
  };

  const RESULTS_METHOD_PRIORITY = [
    "RARM (ours)",
    "RoboCLIP",
    "TemporalOT",
    "GVL",
    "RoboMeter",
    "RoboDopamine",
    "AblationSim",
  ];

  const OURS_KEY = "RARM (ours)";

  const resultsState = {
    data: null,
    methods: [],
    hidden: new Set(),
    hovered: null,
  };

  /* ── helpers ─────────────────────────────────────────────────────────── */

  function createSvgElement(name, attrs) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === "textContent") node.textContent = value;
      else node.setAttribute(key, String(value));
    }
    return node;
  }

  function colorForMethod(name) {
    if (METHOD_COLOR_MAP[name]) return METHOD_COLOR_MAP[name];
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) {
      hash = (hash << 5) - hash + name.charCodeAt(i);
      hash |= 0;
    }
    return "hsl(" + (Math.abs(hash) % 360) + " 58% 42%)";
  }

  function formatTick(value) {
    return value.toFixed(2);
  }

  function formatStep(value) {
    if (Math.abs(value) >= 1e6) {
      const v = value / 1e6;
      return (Number.isInteger(v) ? v : v.toFixed(1)) + "M";
    }
    if (Math.abs(value) >= 1e3) {
      const v = value / 1e3;
      return (Number.isInteger(v) ? v : Math.round(v)) + "k";
    }
    return String(Math.round(value));
  }

  function pickXAxisTicks(values) {
    if (!values.length) return [0];
    if (values.length <= 6) return values.slice();
    const last = values.length - 1;
    const picks = [
      values[0],
      values[Math.floor(last / 4)],
      values[Math.floor(last / 2)],
      values[Math.floor((last * 3) / 4)],
      values[last],
    ];
    return Array.from(new Set(picks)).sort((a, b) => a - b);
  }

  /* ── chart panel ─────────────────────────────────────────────────────── */

  function buildTaskChartSvg(task) {
    const width = 560;
    const height = 340;
    const margin = { top: 16, right: 14, bottom: 58, left: 64 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    const allDataSeries = Object.entries(task.data || {});
    const visibleDataSeries = allDataSeries.filter(([name]) => !resultsState.hidden.has(name));

    const xValues = (task.x || []).slice();
    const xMin = Math.min.apply(null, xValues);
    const xMax = Math.max.apply(null, xValues);

    // Success rate lives in [0, 1]; lock the axis there (y_max pins the top).
    let yMin = 0;
    let yMax = Number(task.y_max ?? 1) || 1;
    if (yMax <= yMin) yMax = yMin + 1;

    const scaleX = (x) => margin.left + ((x - xMin) / (xMax - xMin || 1)) * plotWidth;
    const scaleY = (y) => margin.top + (1 - (y - yMin) / (yMax - yMin || 1)) * plotHeight;
    const clampY = (v) => Math.max(yMin, Math.min(yMax, v));

    const svg = createSvgElement("svg", {
      class: "chart-svg",
      viewBox: "0 0 " + width + " " + height,
      role: "img",
      "aria-label": task.title,
    });

    svg.appendChild(
      createSvgElement("rect", {
        x: margin.left,
        y: margin.top,
        width: plotWidth,
        height: plotHeight,
        fill: "#ffffff",
        stroke: "rgba(16, 23, 34, 0.12)",
        "stroke-width": "1",
        rx: "8",
      })
    );

    // y gridlines + ticks
    const yTicks = 5;
    for (let i = 0; i < yTicks; i += 1) {
      const t = i / (yTicks - 1);
      const value = yMin + (1 - t) * (yMax - yMin);
      const y = margin.top + t * plotHeight;
      svg.appendChild(
        createSvgElement("line", {
          x1: margin.left,
          y1: y,
          x2: margin.left + plotWidth,
          y2: y,
          stroke: "rgba(16, 23, 34, 0.13)",
          "stroke-width": i === yTicks - 1 ? "1.1" : "0.8",
        })
      );
      svg.appendChild(
        createSvgElement("text", {
          x: margin.left - 8,
          y: y + 4,
          fill: "#49576a",
          "font-size": "14",
          "text-anchor": "end",
          "font-family": "Inter, sans-serif",
          textContent: formatTick(value),
        })
      );
    }

    // x gridlines + ticks
    for (const value of pickXAxisTicks(xValues)) {
      const x = scaleX(value);
      svg.appendChild(
        createSvgElement("line", {
          x1: x,
          y1: margin.top,
          x2: x,
          y2: margin.top + plotHeight,
          stroke: "rgba(16, 23, 34, 0.08)",
          "stroke-width": "0.8",
        })
      );
      svg.appendChild(
        createSvgElement("text", {
          x: x,
          y: margin.top + plotHeight + 22,
          fill: "#49576a",
          "font-size": "14",
          "text-anchor": "middle",
          "font-family": "Inter, sans-serif",
          textContent: formatStep(value),
        })
      );
    }

    // Draw order: baselines first, ours above them, hovered on top (mirrors
    // plot_seeds.py zorder where ours sits over the baselines).
    const drawRank = (name) =>
      resultsState.hovered === name ? 2 : name === OURS_KEY ? 1 : 0;
    const orderedSeries = visibleDataSeries
      .slice()
      .sort((a, b) => drawRank(a[0]) - drawRank(b[0]));

    // ── std bands (drawn first so mean lines render on top) ──────────────
    for (const [name, mean] of orderedSeries) {
      const std = (task.std && task.std[name]) || [];
      if (!std.length) continue;
      const len = Math.min(mean.length, std.length, xValues.length);
      if (len < 2) continue;

      const upper = [];
      const lower = [];
      for (let i = 0; i < len; i += 1) {
        upper.push([scaleX(xValues[i]), scaleY(clampY(mean[i] + std[i]))]);
        lower.push([scaleX(xValues[i]), scaleY(clampY(mean[i] - std[i]))]);
      }

      const dUp = upper
        .map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(2) + " " + p[1].toFixed(2))
        .join(" ");
      const dDown = lower
        .reverse()
        .map((p) => "L" + p[0].toFixed(2) + " " + p[1].toFixed(2))
        .join(" ");

      const isHovered = resultsState.hovered === name;
      const isMuted = Boolean(resultsState.hovered && !isHovered);
      const isOurs = name === OURS_KEY;
      // Ours: prominent/darker band; baselines: faint (matches plot_seeds.py
      // alpha 0.28 vs 0.10). Hover lifts the band; non-hovered fade right back.
      let bandOpacity;
      if (isMuted) bandOpacity = 0.05;
      else if (isHovered) bandOpacity = isOurs ? 0.32 : 0.22;
      else bandOpacity = isOurs ? 0.3 : 0.1;
      svg.appendChild(
        createSvgElement("path", {
          d: dUp + " " + dDown + " Z",
          fill: colorForMethod(name),
          stroke: "none",
          opacity: bandOpacity,
        })
      );
    }

    // ── mean polylines (markers gated off: training curves have many points) ──
    for (const [name, values] of orderedSeries) {
      const points = [];
      const len = Math.min(values.length, xValues.length);
      for (let i = 0; i < len; i += 1) {
        points.push([scaleX(xValues[i]), scaleY(clampY(values[i]))]);
      }
      if (!points.length) continue;

      const isOurs = name === OURS_KEY;
      const isHovered = resultsState.hovered === name;
      const isMuted = Boolean(resultsState.hovered && !isHovered);
      const lineOpacity = isMuted ? 0.22 : 1;
      // Ours thick, baselines thinner (plot_seeds.py lw 2.6 vs 1.3); hover bolds.
      const strokeWidth = isHovered ? 4.4 : isOurs ? 3.4 : 1.9;

      const d = points
        .map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(2) + " " + p[1].toFixed(2))
        .join(" ");

      svg.appendChild(
        createSvgElement("path", {
          d,
          fill: "none",
          stroke: colorForMethod(name),
          "stroke-width": String(strokeWidth),
          "stroke-linejoin": "round",
          "stroke-linecap": "round",
          opacity: String(lineOpacity),
        })
      );

      if (points.length <= 12) {
        for (const p of points) {
          svg.appendChild(
            createSvgElement("circle", {
              cx: p[0],
              cy: p[1],
              r: isHovered ? "5.8" : "4.8",
              fill: colorForMethod(name),
              opacity: String(lineOpacity),
            })
          );
        }
      }
    }

    // axis labels
    svg.appendChild(
      createSvgElement("text", {
        x: margin.left + plotWidth / 2,
        y: height - 10,
        fill: "#3a4657",
        "font-size": "16",
        "text-anchor": "middle",
        "font-family": "Inter, sans-serif",
        textContent: task.xlabel,
      })
    );
    svg.appendChild(
      createSvgElement("text", {
        x: 16,
        y: margin.top + plotHeight / 2,
        fill: "#3a4657",
        "font-size": "16",
        "text-anchor": "middle",
        transform: "rotate(-90 16 " + (margin.top + plotHeight / 2) + ")",
        "font-family": "Inter, sans-serif",
        textContent: task.ylabel,
      })
    );

    return svg;
  }

  /* ── legend ──────────────────────────────────────────────────────────── */

  function collectMethodNames(data) {
    const names = new Set();
    for (const key of TASK_ORDER) {
      const task = data[key];
      if (!task) continue;
      for (const name of Object.keys(task.data || {})) names.add(name);
    }
    const ordered = [];
    for (const item of RESULTS_METHOD_PRIORITY) {
      if (names.has(item)) {
        ordered.push(item);
        names.delete(item);
      }
    }
    for (const item of names) ordered.push(item);
    return ordered;
  }

  function setHovered(method) {
    const next = resultsState.hidden.has(method) ? null : method;
    if (resultsState.hovered === next) return;
    resultsState.hovered = next;
    refreshLegendUI();
    renderResultsCharts();
  }

  function clearHovered(method) {
    if (resultsState.hovered === method) {
      resultsState.hovered = null;
      refreshLegendUI();
      renderResultsCharts();
    }
  }

  function buildLegend(root, methods) {
    root.innerHTML = "";
    for (const method of methods) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "legend-item";
      button.dataset.method = method;

      const swatch = document.createElement("span");
      swatch.className = "legend-swatch";
      swatch.style.backgroundColor = colorForMethod(method);

      const label = document.createElement("span");
      label.textContent = method;

      button.appendChild(swatch);
      button.appendChild(label);

      button.addEventListener("mouseenter", () => setHovered(method));
      button.addEventListener("mouseleave", () => clearHovered(method));
      button.addEventListener("focus", () => setHovered(method));
      button.addEventListener("blur", () => clearHovered(method));
      button.addEventListener("click", () => {
        if (resultsState.hidden.has(method)) resultsState.hidden.delete(method);
        else resultsState.hidden.add(method);
        refreshLegendUI();
        renderResultsCharts();
      });

      root.appendChild(button);
    }

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.id = "legend-reset";
    resetButton.className = "legend-item legend-item-reset";
    resetButton.textContent = "Reset";
    resetButton.addEventListener("click", () => {
      resultsState.hidden.clear();
      resultsState.hovered = null;
      refreshLegendUI();
      renderResultsCharts();
    });
    root.appendChild(resetButton);
  }

  function refreshLegendUI() {
    for (const button of document.querySelectorAll(".legend-item[data-method]")) {
      const method = button.dataset.method;
      button.classList.toggle("hidden", resultsState.hidden.has(method));
      button.classList.toggle("hovered", resultsState.hovered === method);
      button.setAttribute("aria-pressed", resultsState.hidden.has(method) ? "true" : "false");
    }
    const resetButton = document.getElementById("legend-reset");
    if (resetButton) {
      const show = resultsState.hidden.size > 0;
      resetButton.classList.toggle("is-visible", show);
      resetButton.setAttribute("aria-hidden", show ? "false" : "true");
      resetButton.tabIndex = show ? 0 : -1;
    }
  }

  /* ── render ──────────────────────────────────────────────────────────── */

  function renderResultsCharts() {
    const grid = document.getElementById("results-grid");
    if (!grid || !resultsState.data) return;
    grid.innerHTML = "";

    for (const key of TASK_ORDER) {
      const task = resultsState.data[key];
      if (!task) continue;

      const card = document.createElement("article");
      card.className = "chart-card";
      card.dataset.task = key;

      const title = document.createElement("h4");
      title.textContent = task.title;

      const wrap = document.createElement("div");
      wrap.className = "chart-wrap";
      wrap.appendChild(buildTaskChartSvg(task));

      card.appendChild(title);
      card.appendChild(wrap);
      grid.appendChild(card);
    }
  }

  async function initResultsCharts() {
    const grid = document.getElementById("results-grid");
    const legendRoot = document.getElementById("results-legend");
    if (!grid || !legendRoot) return;

    let payload = null;
    try {
      const response = await fetch("assets/data/results.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load results.json");
      payload = await response.json();
    } catch (error) {
      // Leave the static fallback image in place.
      const panel = grid.closest(".results-panel");
      if (panel) panel.classList.add("results-fallback");
      return;
    }

    resultsState.data = payload;
    resultsState.methods = collectMethodNames(payload);

    const panel = grid.closest(".results-panel");
    if (panel) panel.classList.remove("results-fallback");

    buildLegend(legendRoot, resultsState.methods);
    renderResultsCharts();
    refreshLegendUI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initResultsCharts);
  } else {
    initResultsCharts();
  }
})();
