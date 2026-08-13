/* ──────────────────────────────────────────────────────────────────────────
   Error-recovery rollout viewer.
   Mirrors the qualitative-comparison section: a task dropdown that swaps the
   media below it. Each clip is a successful episode in which the target object
   was teleported mid-rollout to a random position within 4 cm of its start
   (orange overlay marks the reset), so the footage shows recovery rather than
   undisturbed execution. Source: rarm_reset_footage_20260812.
   ────────────────────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  // Dropdown order mirrors QUAL_TASKS in qualitative-chart.js so the two
  // sections read consistently. `stat` values are the per-episode facts recorded
  // in the footage manifest (videos/video_manifest.json).
  const ER_TASKS = [
    {
      id: "lib9",
      label: "Mug into microwave",
      title: "LIBERO-10 · Put the yellow and white mug in the microwave and close it",
      stat: "Object reset at step 69 · 3.89 cm displacement · policy seed 1",
    },
    {
      id: "lib2",
      label: "Stove + moka pot",
      title: "LIBERO-10 · Turn on the stove and put the moka pot on it",
      stat: "Object reset at step 160 · 3.79 cm displacement · policy seed 4",
    },
    {
      id: "lib3",
      label: "Bowl into drawer",
      title: "LIBERO-10 · Put the black bowl in the bottom drawer and close it",
      stat: "Object reset at step 31 · 3.89 cm displacement · policy seed 2",
    },
    {
      id: "lib5",
      label: "Book into caddy",
      title: "LIBERO-10 · Pick up the book and place it in the back compartment of the caddy",
      stat: "Object reset at step 125 · 3.77 cm displacement · policy seed 3",
    },
    {
      id: "lib6",
      label: "Mug + pudding",
      title: "LIBERO-10 · Put the white mug on the plate and the chocolate pudding to its right",
      stat: "Object reset at step 90 · 3.92 cm displacement · policy seed 1",
    },
  ];

  const VIDEO_BASE = "assets/video/error_recovery/";

  function initErrorRecovery() {
    const grid = document.getElementById("error-recovery-grid");
    if (!grid) return;

    const card = document.createElement("article");
    card.className = "qual-card";

    // selector row (before the title) — same markup as the qualitative section
    const controls = document.createElement("div");
    controls.className = "qual-controls";
    const selLabel = document.createElement("label");
    selLabel.className = "qual-select-label";
    selLabel.setAttribute("for", "er-task-select");
    selLabel.textContent = "Task";
    const select = document.createElement("select");
    select.className = "qual-select";
    select.id = "er-task-select";
    for (const taskCfg of ER_TASKS) {
      const opt = document.createElement("option");
      opt.value = taskCfg.id;
      opt.textContent = taskCfg.label || taskCfg.id;
      select.appendChild(opt);
    }
    controls.appendChild(selLabel);
    controls.appendChild(select);

    const title = document.createElement("h4");
    title.className = "qual-card-title";

    const stage = document.createElement("div");
    stage.className = "er-stage";

    const video = document.createElement("video");
    video.className = "er-video";
    video.setAttribute("autoplay", "");
    video.setAttribute("muted", "");
    video.setAttribute("loop", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("controls", "");
    video.muted = true; // property form: required for autoplay in Chrome/Safari
    stage.appendChild(video);

    const stat = document.createElement("p");
    stat.className = "er-stat";

    card.appendChild(controls);
    card.appendChild(title);
    card.appendChild(stage);
    card.appendChild(stat);
    grid.appendChild(card);

    const panel = grid.closest(".er-panel");

    // A missing/undecodable file flips the whole panel to the fallback message,
    // matching how the qualitative and results sections degrade.
    video.addEventListener("error", () => {
      if (panel) panel.classList.add("er-fallback");
    });

    function showTask(id) {
      const taskCfg = ER_TASKS.find((t) => t.id === id) || ER_TASKS[0];
      if (panel) panel.classList.remove("er-fallback");
      title.textContent = taskCfg.title;
      stat.textContent = taskCfg.stat || "";
      video.src = VIDEO_BASE + taskCfg.id + ".mp4";
      video.load();
      const played = video.play();
      if (played && typeof played.catch === "function") played.catch(() => {});
    }

    select.addEventListener("change", () => showTask(select.value));
    showTask(ER_TASKS[0].id);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initErrorRecovery);
  } else {
    initErrorRecovery();
  }
})();
