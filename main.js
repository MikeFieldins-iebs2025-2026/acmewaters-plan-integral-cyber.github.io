/* ACME Waters · Portal JS v9
   - PDF.js single viewer with native fallback.
   - Relative asset paths only.
   - Local video compatibility sources + download UI mitigation.
   - OpenGL effects toggle: dynamic when enabled, static when disabled.
   - Adaptive WebGL quality profile: DPR caps, throttled FPS and idle-friendly init.
*/

(() => {
  "use strict";

  window.ACME_MAIN_WILL_INIT_EFFECTS = true;

  const DOCUMENTS = {
    executive: {
      title: "Resumen ejecutivo",
      url: "./assets/docs/ACME_Waters_Resumen_Ejecutivo.pdf",
      download: "ACME_Waters_Resumen_Ejecutivo.pdf"
    },
    annexes: {
      title: "Anexos técnicos",
      url: "./assets/docs/ACME_Waters_Anexos_Tecnicos.pdf",
      download: "ACME_Waters_Anexos_Tecnicos.pdf"
    }
  };

  const state = {
    pdfDoc: null,
    pageNum: 1,
    pageRendering: false,
    pendingPage: null,
    scale: 1.15,
    activeDocKey: "executive",
    resizeTimer: null
  };

  const effectsState = {
    compatible: true,
    active: true,
    reason: "",
    field: null,
    molecule: null
  };

  const $ = (selector) => document.querySelector(selector);

  const els = {
    select: $("#document-select"),
    download: $("#download-current"),
    prev: $("#prev-page"),
    next: $("#next-page"),
    zoomIn: $("#zoom-in"),
    zoomOut: $("#zoom-out"),
    pageNum: $("#page-num"),
    pageCount: $("#page-count"),
    status: $("#pdf-status"),
    canvas: $("#pdf-canvas"),
    fallback: $("#pdf-fallback"),
    title: $("#pdf-current-title"),
    stage: $("#pdf-stage"),
    video: $("#briefing-video"),
    videoFallback: $("#video-fallback"),
    videoShell: $(".video-shell"),
    effectsToggle: $("#effects-toggle"),
    effectsToggleLabel: $("#effects-toggle-label")
  };

  function setStatus(message, stateName = "ready") {
    // Estado interno sin salida visual: la interfaz usa el visor nativo como fallback silencioso.
    if (!els.status) return;
    els.status.textContent = message;
    els.status.dataset.state = stateName;
  }

  function traceViewerFallback(reason) {
    if (window.console && typeof window.console.warn === "function") {
      window.console.warn("[ACME Waters] PDF.js no disponible; visor nativo activado.", reason);
    }
  }

  function activeDocument() {
    return DOCUMENTS[state.activeDocKey] || DOCUMENTS.executive;
  }

  function updateDocumentUi() {
    const doc = activeDocument();
    if (els.download) {
      els.download.href = doc.url;
      els.download.removeAttribute("download");
      els.download.setAttribute("target", "_blank");
      els.download.setAttribute("rel", "noopener noreferrer");
      els.download.textContent = `Abrir ${state.activeDocKey === "executive" ? "resumen" : "anexos"}`;
    }
    if (els.title) els.title.textContent = doc.title;
  }

  function showNativePdfFallback(reason) {
    const doc = activeDocument();
    traceViewerFallback(reason);
    if (els.canvas) {
      els.canvas.hidden = true;
      els.canvas.removeAttribute("aria-label");
      els.canvas.width = 0;
      els.canvas.height = 0;
      els.canvas.style.width = "";
      els.canvas.style.height = "";
    }
    if (els.fallback) {
      els.fallback.hidden = false;
      els.fallback.src = doc.url;
    }
    state.pdfDoc = null;
    if (els.pageNum) els.pageNum.textContent = "—";
    if (els.pageCount) els.pageCount.textContent = "—";
    setStatus("Visor nativo activado.", "error");
  }

  function showPdfCanvas() {
    if (els.canvas) {
      els.canvas.hidden = false;
      els.canvas.setAttribute("aria-label", "Página renderizada del documento PDF");
    }
    if (els.fallback) els.fallback.hidden = true;
  }

  function getFitScale(pageViewportWidth) {
    const stageWidth = Math.max(320, els.stage.clientWidth - 32);
    const fit = stageWidth / pageViewportWidth;
    return Math.min(Math.max(fit, 0.55), 2.2) * state.scale;
  }

  async function renderPage(num) {
    if (!state.pdfDoc || state.pageRendering) return;
    state.pageRendering = true;

    try {
      const page = await state.pdfDoc.getPage(num);
      const baseViewport = page.getViewport({ scale: 1 });
      const fitScale = getFitScale(baseViewport.width);
      const viewport = page.getViewport({ scale: fitScale });

      const outputScale = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = els.canvas;
      const context = canvas.getContext("2d", { alpha: false });

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const transform = outputScale !== 1
        ? [outputScale, 0, 0, outputScale, 0, 0]
        : null;

      await page.render({ canvasContext: context, viewport, transform }).promise;

      state.pageNum = num;
      els.pageNum.textContent = String(num);
      els.pageCount.textContent = String(state.pdfDoc.numPages);
      setStatus(`${activeDocument().title} cargado con PDF.js.`, "ready");
    } catch (error) {
      showNativePdfFallback(error && error.message ? error.message : "error de renderizado");
    } finally {
      state.pageRendering = false;
      if (state.pendingPage !== null) {
        const pending = state.pendingPage;
        state.pendingPage = null;
        renderPage(pending);
      }
    }
  }

  function queueRenderPage(num) {
    if (!state.pdfDoc) return;
    const safeNum = Math.min(Math.max(num, 1), state.pdfDoc.numPages);
    if (state.pageRendering) {
      state.pendingPage = safeNum;
    } else {
      renderPage(safeNum);
    }
  }

  async function loadPdf(docKey) {
    state.activeDocKey = docKey in DOCUMENTS ? docKey : "executive";
    state.pageNum = 1;
    updateDocumentUi();

    const doc = activeDocument();
    if (els.fallback) els.fallback.src = doc.url;

    if (!window.pdfjsLib) {
      showNativePdfFallback("biblioteca PDF.js no cargada");
      return;
    }

    try {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      setStatus(`Cargando ${doc.title}…`, "ready");

      const loadingTask = window.pdfjsLib.getDocument({
        url: doc.url,
        disableAutoFetch: false,
        disableStream: false,
        useSystemFonts: true
      });

      state.pdfDoc = await loadingTask.promise;
      showPdfCanvas();
      els.pageCount.textContent = String(state.pdfDoc.numPages);
      await renderPage(1);
    } catch (error) {
      showNativePdfFallback(error && error.message ? error.message : "error de carga");
    }
  }

  function bindPdfControls() {
    els.select?.addEventListener("change", (event) => loadPdf(event.target.value));

    els.prev?.addEventListener("click", () => {
      if (!state.pdfDoc || state.pageNum <= 1) return;
      queueRenderPage(state.pageNum - 1);
    });

    els.next?.addEventListener("click", () => {
      if (!state.pdfDoc || state.pageNum >= state.pdfDoc.numPages) return;
      queueRenderPage(state.pageNum + 1);
    });

    els.zoomOut?.addEventListener("click", () => {
      state.scale = Math.max(0.65, state.scale - 0.12);
      queueRenderPage(state.pageNum);
    });

    els.zoomIn?.addEventListener("click", () => {
      state.scale = Math.min(2.4, state.scale + 0.12);
      queueRenderPage(state.pageNum);
    });

    window.addEventListener("resize", () => {
      if (!state.pdfDoc) return;
      window.clearTimeout(state.resizeTimer);
      state.resizeTimer = window.setTimeout(() => queueRenderPage(state.pageNum), 180);
    });

    document.addEventListener("keydown", (event) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;
      if (event.key === "ArrowLeft") els.prev?.click();
      if (event.key === "ArrowRight") els.next?.click();
    });
  }

  function bindVideoMitigations() {
    const video = els.video;
    if (!video) return;

    video.addEventListener("contextmenu", (event) => event.preventDefault());

    // Reinforce attributes after browser hydration.
    video.setAttribute("controlsList", "nodownload noplaybackrate");
    video.setAttribute("disablePictureInPicture", "");
    video.setAttribute("preload", "metadata");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    const canMp4 = video.canPlayType("video/mp4");
    const canWebm = video.canPlayType("video/webm");
    if (!canMp4 && !canWebm) {
      els.videoFallback.hidden = false;
      els.videoShell?.classList.add("is-error");
      console.warn("[ACME Waters] El navegador no anuncia soporte para MP4 ni WebM.");
    }

    video.addEventListener("error", () => {
      if (els.videoFallback) els.videoFallback.hidden = false;
      els.videoShell?.classList.add("is-error");
      console.warn("[ACME Waters] Error de reproducción de vídeo local.", video.error);
    });

    video.addEventListener("loadedmetadata", () => {
      if (els.videoFallback) els.videoFallback.hidden = true;
      els.videoShell?.classList.remove("is-error");
    });
  }

  function resolveEffectsConfig() {
    const config = window.ACME_EFFECTS_CONFIG || {};
    const compatible = typeof config.compatible === "boolean" ? config.compatible : true;
    const defaultActive = typeof config.defaultActive === "boolean" ? config.defaultActive : compatible;
    effectsState.compatible = compatible;
    effectsState.active = compatible && defaultActive;
    effectsState.reason = config.reason || "";
  }

  function getEffectsPerformanceProfile() {
    const config = window.ACME_EFFECTS_CONFIG || {};
    const dpr = window.devicePixelRatio || 1;
    const compactViewport = Math.min(window.innerWidth || 1024, window.innerHeight || 768) < 680;
    const constrained =
      Boolean(config.saveData) ||
      Boolean(config.lowCores) ||
      Boolean(config.lowMemory) ||
      Boolean(config.reducedMotion) ||
      (compactViewport && dpr > 1.75);

    return {
      constrained,
      field: {
        maxDpr: constrained ? 0.9 : 1.15,
        targetFPS: constrained ? 20 : 30,
        maxEdge: constrained ? 1280 : 1920
      },
      molecule: {
        maxDpr: constrained ? 1.0 : 1.35,
        targetFPS: constrained ? 24 : 42,
        maxEdge: constrained ? 540 : 780,
        pauseWhenOutsideViewport: true
      }
    };
  }

  function whenIdle(callback, timeout = 700) {
    if ("requestIdleCallback" in window) {
      return window.requestIdleCallback(callback, { timeout });
    }
    return window.setTimeout(callback, Math.min(timeout, 180));
  }

  function updateEffectsUi() {
    document.body.classList.toggle("effects-on", effectsState.active && effectsState.compatible);
    document.body.classList.toggle("effects-off", !effectsState.active || !effectsState.compatible);

    const toggle = els.effectsToggle;
    if (!toggle) return;

    toggle.disabled = !effectsState.compatible;
    toggle.setAttribute("aria-pressed", String(effectsState.active && effectsState.compatible));

    if (!effectsState.compatible) {
      toggle.title = effectsState.reason || "WebGL no disponible en este navegador.";
      toggle.setAttribute("aria-label", "Efectos OpenGL no disponibles");
      if (els.effectsToggleLabel) els.effectsToggleLabel.textContent = "Efectos no disponibles";
      return;
    }

    toggle.title = effectsState.active
      ? "Desactivar animaciones OpenGL"
      : "Activar animaciones OpenGL";
    toggle.setAttribute(
      "aria-label",
      effectsState.active ? "Desactivar efectos OpenGL" : "Activar efectos OpenGL"
    );
    if (els.effectsToggleLabel) {
      els.effectsToggleLabel.textContent = effectsState.active ? "Efectos ON" : "Efectos OFF";
    }
  }

  function setEffectsActive(nextActive) {
    if (!effectsState.compatible) return;
    effectsState.active = Boolean(nextActive);

    effectsState.field?.setActive?.(effectsState.active);
    effectsState.molecule?.setActive?.(effectsState.active);
    updateEffectsUi();
  }

  async function initEffectsControls() {
    resolveEffectsConfig();
    updateEffectsUi();

    const performanceProfile = getEffectsPerformanceProfile();

    els.effectsToggle?.addEventListener("click", () => {
      setEffectsActive(!effectsState.active);
    });

    if (typeof window.initMolecule === "function") {
      effectsState.molecule = window.initMolecule({
        active: effectsState.active,
        ...performanceProfile.molecule
      });
    }

    const startField = async () => {
      if (effectsState.compatible && typeof window.initEtherealField === "function") {
        effectsState.field = await window.initEtherealField({
          canvasId: "gl-canvas",
          vertexUrl: "./gl/field.vert",
          fragmentUrl: "./gl/field.frag",
          active: effectsState.active,
          ...performanceProfile.field
        });

        if (effectsState.field && effectsState.field.supported === false) {
          effectsState.compatible = false;
          effectsState.active = false;
          effectsState.reason = "WebGL no disponible para el fondo.";
          effectsState.molecule?.setActive?.(false);
        }

        updateEffectsUi();
        if (effectsState.compatible) {
          setEffectsActive(effectsState.active);
        }
      } else {
        updateEffectsUi();
      }
    };

    whenIdle(startField);
  }

  function init() {
    updateDocumentUi();
    bindPdfControls();
    bindVideoMitigations();
    initEffectsControls();

    // Wait one tick so the deferred PDF.js script has a chance to register.
    window.setTimeout(() => loadPdf("executive"), 0);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
