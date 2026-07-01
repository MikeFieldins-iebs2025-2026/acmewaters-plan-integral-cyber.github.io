/* ACME Waters · Portal JS
   - PDF.js single viewer with native fallback.
   - Relative asset paths only.
   - Local video download UI mitigation.
   - PDF links open in a new tab with relative URLs.
*/

(() => {
  "use strict";

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
    video: $("#briefing-video")
  };

  function setStatus(message, stateName = "ready") {
    if (!els.status) return;
    els.status.textContent = message;
    els.status.dataset.state = stateName;
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
    console.warn("[ACME Waters] PDF.js no disponible; se activa visor nativo.", { reason });
    const doc = activeDocument();
    if (els.canvas) els.canvas.hidden = true;
    if (els.fallback) {
      els.fallback.hidden = false;
      els.fallback.src = doc.url;
    }
    state.pdfDoc = null;
    els.pageNum.textContent = "—";
    els.pageCount.textContent = "—";
    setStatus(
      `Modo visor nativo activado. PDF.js no está disponible o el navegador bloqueó el acceso local (${reason}).`,
      "error"
    );
  }

  function showPdfCanvas() {
    if (els.canvas) els.canvas.hidden = false;
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
    video.setAttribute("preload", "none");
  }

  function init() {
    updateDocumentUi();
    bindPdfControls();
    bindVideoMitigations();

    // Wait one tick so the deferred PDF.js script has a chance to register.
    window.setTimeout(() => loadPdf("executive"), 0);

    if (typeof window.initEtherealField === "function") {
      window.initEtherealField({
        canvasId: "gl-canvas",
        vertexUrl: "./gl/field.vert",
        fragmentUrl: "./gl/field.frag"
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
