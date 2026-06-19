/* ──────────────────────────────────────────────────────────────────────────
   Interactive qualitative comparison chart (SimDist-style scrubbing).

   One panel per task with two cumulative-reward curves (Success vs Failure) on a
   shared rollout-index x-axis. Hovering anywhere over the plot snaps to the
   nearest rollout index, moves a translucent dot along each curve, and swaps in
   the exported frame image + cumulative-reward value for that step.

   Self-contained: fetches assets/qualitative/<id>/<id>.json (written by
   Reference-Anchored_RM/scripts/reward_model.py) and renders into
   #qualitative-grid. No external libraries.
   ────────────────────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  // Selectable tasks (dropdown order; first entry is the default). Each id maps
  // to assets/qualitative/<id>/<id>.json with per-rollout-index hover frames
  // under <id>/frames/<series>/NNNN.jpg. `label` shows in the dropdown, `title`
  // above the chart.
  const QUAL_TASKS = [
    {
      id: "lib2",
      label: "Stove + moka pot",
      title: "LIBERO-10 · Turn on the stove and put the moka pot on it",
    },
    {
      id: "lib5",
      label: "Book into caddy",
      title: "LIBERO-10 · Pick up the book and place it in the back compartment of the caddy",
    },
    {
      id: "lib6",
      label: "Mug + pudding",
      title: "LIBERO-10 · Put the white mug on the plate and the chocolate pudding to its right",
    },
    {
      id: "lib9",
      label: "Mug into microwave",
      title: "LIBERO-10 · Put the yellow and white mug in the microwave and close it",
    },
  ];

  const SERIES_COLOR = {
    Success: "#1f77b4",
    Failure: "#ff7f0e",
  };

  const SVG_NS = "http://www.w3.org/2000/svg";

  function el(name, attrs) {
    const node = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (key === "textContent") node.textContent = value;
      else node.setAttribute(key, String(value));
    }
    return node;
  }

  function colorForSeries(name) {
    return SERIES_COLOR[name] || "#6b7280";
  }

  function pickXAxisTicks(cap) {
    // ~6 evenly-spaced integer rollout-index ticks across [0, cap-1].
    const last = cap - 1;
    if (last <= 0) return [0];
    const want = Math.min(6, cap);
    const out = [];
    for (let i = 0; i < want; i += 1) {
      out.push(Math.round((i / (want - 1)) * last));
    }
    return Array.from(new Set(out)).sort((a, b) => a - b);
  }

  /* ── per-task chart ──────────────────────────────────────────────────── */

  function buildChart(task, mount) {
    const seriesEntries = Object.entries(task.series || {});
    const cap = Number(task.cap) || (seriesEntries[0] ? seriesEntries[0][1].y.length : 0);
    if (!cap) return;

    const xMin = 0;
    const xMax = cap - 1;
    const yMin = 0;
    let yMax = Number(task.y_max) || 1;
    if (yMax <= yMin) yMax = yMin + 1;

    const width = 600;
    const height = 382;
    const margin = { top: 18, right: 18, bottom: 52, left: 60 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;

    const scaleX = (x) => margin.left + ((x - xMin) / (xMax - xMin || 1)) * plotW;
    const scaleY = (y) => margin.top + (1 - (y - yMin) / (yMax - yMin || 1)) * plotH;

    const svg = el("svg", {
      class: "qual-chart-svg",
      viewBox: "0 0 " + width + " " + height,
      role: "img",
      "aria-label": task.title + " cumulative reward",
    });

    // plot background
    svg.appendChild(
      el("rect", {
        x: margin.left,
        y: margin.top,
        width: plotW,
        height: plotH,
        fill: "#ffffff",
        stroke: "rgba(16, 23, 34, 0.12)",
        "stroke-width": "1",
        rx: "8",
      })
    );

    // y gridlines + integer ticks
    const yTickCount = Math.min(7, Math.max(2, Math.round(yMax) + 1));
    for (let i = 0; i < yTickCount; i += 1) {
      const t = i / (yTickCount - 1);
      const value = yMin + (1 - t) * (yMax - yMin);
      const y = margin.top + t * plotH;
      svg.appendChild(
        el("line", {
          x1: margin.left,
          y1: y,
          x2: margin.left + plotW,
          y2: y,
          stroke: "rgba(16, 23, 34, 0.12)",
          "stroke-width": i === yTickCount - 1 ? "1.1" : "0.8",
        })
      );
      svg.appendChild(
        el("text", {
          x: margin.left - 9,
          y: y + 4,
          fill: "#49576a",
          "font-size": "14",
          "text-anchor": "end",
          "font-family": "Inter, sans-serif",
          textContent: String(Math.round(value)),
        })
      );
    }

    // x gridlines + ticks
    for (const value of pickXAxisTicks(cap)) {
      const x = scaleX(value);
      svg.appendChild(
        el("line", {
          x1: x,
          y1: margin.top,
          x2: x,
          y2: margin.top + plotH,
          stroke: "rgba(16, 23, 34, 0.07)",
          "stroke-width": "0.8",
        })
      );
      svg.appendChild(
        el("text", {
          x,
          y: margin.top + plotH + 22,
          fill: "#49576a",
          "font-size": "14",
          "text-anchor": "middle",
          "font-family": "Inter, sans-serif",
          textContent: String(value),
        })
      );
    }

    // mean polylines
    for (const [name, series] of seriesEntries) {
      const ys = series.y || [];
      const pts = [];
      for (let i = 0; i < ys.length; i += 1) {
        pts.push(scaleX(i).toFixed(2) + " " + scaleY(ys[i]).toFixed(2));
      }
      if (!pts.length) continue;
      svg.appendChild(
        el("path", {
          d: "M" + pts.join(" L"),
          fill: "none",
          stroke: colorForSeries(name),
          "stroke-width": "2.4",
          "stroke-linejoin": "round",
          "stroke-linecap": "round",
        })
      );
    }

    // axis labels
    svg.appendChild(
      el("text", {
        x: margin.left + plotW / 2,
        y: height - 8,
        fill: "#3a4657",
        "font-size": "15",
        "text-anchor": "middle",
        "font-family": "Inter, sans-serif",
        textContent: task.xlabel || "Rollout Index",
      })
    );
    svg.appendChild(
      el("text", {
        x: 15,
        y: margin.top + plotH / 2,
        fill: "#3a4657",
        "font-size": "15",
        "text-anchor": "middle",
        transform: "rotate(-90 15 " + (margin.top + plotH / 2) + ")",
        "font-family": "Inter, sans-serif",
        textContent: task.ylabel || "Cumulative Reward",
      })
    );

    // ── interactive overlay (guide line + per-series dots) ───────────────
    const guide = el("line", {
      x1: 0,
      y1: margin.top,
      x2: 0,
      y2: margin.top + plotH,
      stroke: "rgba(16, 23, 34, 0.35)",
      "stroke-width": "1",
      "stroke-dasharray": "4 4",
      opacity: "0",
    });
    svg.appendChild(guide);

    const dots = {};
    for (const [name] of seriesEntries) {
      const halo = el("circle", {
        r: "8",
        fill: colorForSeries(name),
        opacity: "0.18",
      });
      const core = el("circle", {
        r: "4.5",
        fill: colorForSeries(name),
        stroke: "#ffffff",
        "stroke-width": "1.6",
      });
      svg.appendChild(halo);
      svg.appendChild(core);
      dots[name] = { halo, core };
    }

    // transparent capture rect on top
    const capture = el("rect", {
      x: margin.left,
      y: margin.top,
      width: plotW,
      height: plotH,
      fill: "transparent",
      style: "cursor: crosshair;",
    });
    svg.appendChild(capture);

    const chartMain = document.createElement("div");
    chartMain.className = "qual-chart-main";
    chartMain.appendChild(svg);
    mount.appendChild(chartMain);

    // ── frame preview column ─────────────────────────────────────────────
    const frames = document.createElement("div");
    frames.className = "qual-frames";
    const frameRefs = {};
    for (const [name, series] of seriesEntries) {
      const card = document.createElement("figure");
      card.className = "qual-frame-card";

      const head = document.createElement("figcaption");
      head.className = "qual-frame-head";
      const dot = document.createElement("span");
      dot.className = "qual-frame-dot";
      dot.style.backgroundColor = colorForSeries(name);
      const label = document.createElement("span");
      label.className = "qual-frame-label";
      label.textContent = name;
      const value = document.createElement("span");
      value.className = "qual-frame-value";
      head.appendChild(dot);
      head.appendChild(label);
      head.appendChild(value);

      const imgWrap = document.createElement("div");
      imgWrap.className = "qual-frame-img";
      imgWrap.style.borderColor = colorForSeries(name);
      const img = document.createElement("img");
      img.alt = name + " rollout frame";
      img.decoding = "async";
      imgWrap.appendChild(img);

      card.appendChild(head);
      card.appendChild(imgWrap);
      frames.appendChild(card);

      frameRefs[name] = { img, value, series };
    }
    mount.appendChild(frames);

    // ── preload frames so scrubbing is instant ───────────────────────────
    const frameUrl = (series, i) =>
      task.base + "/" + series.frames + "/" + String(i).padStart(4, "0") + ".jpg";
    for (const [, ref] of Object.entries(frameRefs)) {
      for (let i = 0; i < cap; i += 1) {
        const pre = new Image();
        pre.src = frameUrl(ref.series, i);
      }
    }

    // ── scrub logic ──────────────────────────────────────────────────────
    let currentIndex = -1;
    function showIndex(index) {
      const i = Math.max(0, Math.min(cap - 1, index));
      if (i === currentIndex) return;
      currentIndex = i;

      guide.setAttribute("x1", scaleX(i));
      guide.setAttribute("x2", scaleX(i));
      guide.setAttribute("opacity", "1");

      for (const [name, series] of seriesEntries) {
        const yVal = series.y[i];
        const cx = scaleX(i);
        const cy = scaleY(yVal);
        dots[name].halo.setAttribute("cx", cx);
        dots[name].halo.setAttribute("cy", cy);
        dots[name].halo.setAttribute("opacity", "0.18");
        dots[name].core.setAttribute("cx", cx);
        dots[name].core.setAttribute("cy", cy);
        dots[name].core.setAttribute("opacity", "1");

        const ref = frameRefs[name];
        ref.img.src = frameUrl(series, i);
        ref.value.textContent = "step " + i;
      }
    }

    function indexFromEvent(event) {
      const rect = svg.getBoundingClientRect();
      // map client x → viewBox x → data index
      const vbX = ((event.clientX - rect.left) / rect.width) * width;
      const frac = (vbX - margin.left) / (plotW || 1);
      return Math.round(frac * (cap - 1));
    }

    capture.addEventListener("pointermove", (event) => {
      showIndex(indexFromEvent(event));
    });
    capture.addEventListener("pointerdown", (event) => {
      showIndex(indexFromEvent(event));
    });

    // Default view: final step (success completed, failure not).
    showIndex(cap - 1);
  }

  /* ── init: dropdown selector + single-task render ────────────────────── */

  const taskJsonCache = new Map(); // id -> task object (or null if it failed)

  async function loadTask(taskCfg) {
    if (taskJsonCache.has(taskCfg.id)) return taskJsonCache.get(taskCfg.id);
    let task = null;
    try {
      const url = "assets/qualitative/" + taskCfg.id + "/" + taskCfg.id + ".json";
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("fetch failed");
      const payload = await response.json();
      task = payload[taskCfg.id] || null;
      if (task) task.base = "assets/qualitative/" + taskCfg.id;
    } catch (error) {
      task = null;
    }
    taskJsonCache.set(taskCfg.id, task);
    return task;
  }

  async function initQualitativeCharts() {
    const grid = document.getElementById("qualitative-grid");
    if (!grid) return;

    const card = document.createElement("article");
    card.className = "qual-card";

    // selector row (before the title)
    const controls = document.createElement("div");
    controls.className = "qual-controls";
    const selLabel = document.createElement("label");
    selLabel.className = "qual-select-label";
    selLabel.setAttribute("for", "qual-task-select");
    selLabel.textContent = "Task";
    const select = document.createElement("select");
    select.className = "qual-select";
    select.id = "qual-task-select";
    for (const taskCfg of QUAL_TASKS) {
      const opt = document.createElement("option");
      opt.value = taskCfg.id;
      opt.textContent = taskCfg.label || taskCfg.id;
      select.appendChild(opt);
    }
    controls.appendChild(selLabel);
    controls.appendChild(select);

    const title = document.createElement("h4");
    title.className = "qual-card-title";

    const layout = document.createElement("div");
    layout.className = "qual-layout";

    card.appendChild(controls);
    card.appendChild(title);
    card.appendChild(layout);
    grid.appendChild(card);

    async function showTask(id) {
      const taskCfg = QUAL_TASKS.find((t) => t.id === id) || QUAL_TASKS[0];
      const task = await loadTask(taskCfg);
      layout.innerHTML = "";
      if (!task) {
        title.textContent = "";
        const panel = grid.closest(".qual-panel");
        if (panel) panel.classList.add("qual-fallback");
        return;
      }
      const panel = grid.closest(".qual-panel");
      if (panel) panel.classList.remove("qual-fallback");
      title.textContent = taskCfg.title || task.title;
      buildChart(task, layout);
    }

    select.addEventListener("change", () => showTask(select.value));

    // Default = first task (lib2), or a #libN hash if it matches a task.
    const hashId = (window.location.hash || "").replace(/^#/, "");
    const defaultId = QUAL_TASKS.some((t) => t.id === hashId)
      ? hashId
      : QUAL_TASKS[0].id;
    select.value = defaultId;
    showTask(defaultId);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initQualitativeCharts);
  } else {
    initQualitativeCharts();
  }
})();
