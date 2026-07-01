import { initAeroScene } from "./gl/aero-scene.js";

const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const docs = {
  main: {
    label: "Resumen ejecutivo",
    url: "assets/ACME_Waters_Resumen_Ejecutivo.pdf"
  },
  annex: {
    label: "Anexos técnicos",
    url: "assets/ACME_Waters_Anexos_Técnicos.pdf"
  }
};

const state = {
  pdfDoc: null,
  pageNum: 1,
  zoom: 1,
  currentDoc: "main",
  rendering: false,
  pendingPage: null,
  renderTask: null,
  pdfLoadedOnce: false
};

const els = {
  canvas: document.getElementById("pdfCanvas"),
  stage: document.getElementById("pdfViewer"),
  loading: document.getElementById("pdfLoading"),
  pageStatus: document.getElementById("pageStatus"),
  prev: document.getElementById("prevPage"),
  next: document.getElementById("nextPage"),
  zoomIn: document.getElementById("zoomIn"),
  zoomOut: document.getElementById("zoomOut"),
  download: document.getElementById("downloadPdf"),
  textExtract: document.getElementById("pdfTextExtract"),
  tabs: Array.from(document.querySelectorAll("[data-doc]")),
  frame: document.getElementById("driveFrame")
};

initAeroScene(document.getElementById("aeroScene"), {
  shaderPath: "./gl/shaders/",
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches
});

function showLoading(message = "Cargando documento…") {
  els.loading.hidden = false;
  els.loading.lastChild.nodeValue = ` ${message}`;
}

function hideLoading() {
  els.loading.hidden = true;
}

function setViewerError(message) {
  els.pageStatus.textContent = "No disponible";
  els.textExtract.textContent = message;
  showLoading(message);
}

function ensurePdfJs() {
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    return Promise.resolve(window.pdfjsLib);
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PDFJS_CDN;
    script.async = true;
    script.onload = () => {
      if (!window.pdfjsLib) {
        reject(new Error("PDF.js no está disponible."));
        return;
      }
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      resolve(window.pdfjsLib);
    };
    script.onerror = () => reject(new Error("No se pudo cargar PDF.js desde el CDN."));
    document.head.appendChild(script);
  });
}

async function loadDocument(docKey) {
  const doc = docs[docKey];
  if (!doc) return;

  state.currentDoc = docKey;
  state.pageNum = 1;
  state.zoom = 1;
  state.pdfDoc = null;
  state.pendingPage = null;

  els.download.href = doc.url;
  els.download.setAttribute("download", doc.url.split("/").pop());
  els.stage.setAttribute("aria-label", `Lienzo del visor PDF: ${doc.label}`);

  els.tabs.forEach((tab) => {
    const active = tab.dataset.doc === docKey;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });

  showLoading(`Cargando ${doc.label}…`);

  try {
    const pdfjsLib = await ensurePdfJs();
    const loadingTask = pdfjsLib.getDocument({
      url: doc.url,
      disableAutoFetch: false,
      disableStream: false
    });
    state.pdfDoc = await loadingTask.promise;
    await queueRenderPage(1);
  } catch (error) {
    setViewerError("No se ha podido cargar el PDF. Sirve la carpeta desde un servidor estático local o revisa la conexión al CDN de PDF.js.");
  }
}

async function queueRenderPage(num) {
  if (!state.pdfDoc) return;

  if (state.rendering) {
    state.pendingPage = num;
    if (state.renderTask) {
      try { state.renderTask.cancel(); } catch (_) { /* cancelación segura */ }
    }
    return;
  }

  state.rendering = true;
  showLoading("Renderizando página…");

  try {
    const page = await state.pdfDoc.getPage(num);
    const baseViewport = page.getViewport({ scale: 1 });
    const availableWidth = Math.max(280, els.stage.clientWidth - 24);
    const responsiveScale = availableWidth / baseViewport.width;
    const viewport = page.getViewport({ scale: responsiveScale * state.zoom });
    const ratio = Math.min(window.devicePixelRatio || 1, 2);

    els.canvas.width = Math.floor(viewport.width * ratio);
    els.canvas.height = Math.floor(viewport.height * ratio);
    els.canvas.style.width = `${Math.floor(viewport.width)}px`;
    els.canvas.style.height = `${Math.floor(viewport.height)}px`;

    const context = els.canvas.getContext("2d", { alpha: false });
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, viewport.width, viewport.height);

    state.renderTask = page.render({ canvasContext: context, viewport });
    await state.renderTask.promise;

    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => item.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    els.textExtract.textContent = pageText || "Esta página no contiene texto extraíble.";
    state.pageNum = num;
    updatePageStatus();
    hideLoading();
  } catch (error) {
    if (error?.name !== "RenderingCancelledException") {
      setViewerError("Se produjo un error al renderizar la página del PDF.");
    }
  } finally {
    state.rendering = false;
    state.renderTask = null;
    if (state.pendingPage !== null) {
      const next = state.pendingPage;
      state.pendingPage = null;
      queueRenderPage(next);
    }
  }
}

function updatePageStatus() {
  const total = state.pdfDoc?.numPages || "—";
  els.pageStatus.textContent = `Página ${state.pageNum} / ${total}`;
  els.prev.disabled = state.pageNum <= 1;
  els.next.disabled = state.pdfDoc ? state.pageNum >= state.pdfDoc.numPages : true;
  els.zoomOut.disabled = state.zoom <= 0.75;
  els.zoomIn.disabled = state.zoom >= 1.8;
}

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => loadDocument(tab.dataset.doc));
});

els.prev.addEventListener("click", () => {
  if (state.pdfDoc && state.pageNum > 1) queueRenderPage(state.pageNum - 1);
});

els.next.addEventListener("click", () => {
  if (state.pdfDoc && state.pageNum < state.pdfDoc.numPages) queueRenderPage(state.pageNum + 1);
});

els.zoomIn.addEventListener("click", () => {
  state.zoom = Math.min(1.8, Math.round((state.zoom + 0.15) * 100) / 100);
  queueRenderPage(state.pageNum);
});

els.zoomOut.addEventListener("click", () => {
  state.zoom = Math.max(0.75, Math.round((state.zoom - 0.15) * 100) / 100);
  queueRenderPage(state.pageNum);
});

let resizeTimer = 0;
window.addEventListener("resize", () => {
  if (!state.pdfDoc) return;
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => queueRenderPage(state.pageNum), 180);
}, { passive: true });

const pdfObserver = new IntersectionObserver((entries, observer) => {
  if (entries.some((entry) => entry.isIntersecting) && !state.pdfLoadedOnce) {
    state.pdfLoadedOnce = true;
    loadDocument("main");
    observer.disconnect();
  }
}, { rootMargin: "220px" });

pdfObserver.observe(els.stage);

const frameObserver = new IntersectionObserver((entries, observer) => {
  if (entries.some((entry) => entry.isIntersecting) && els.frame.dataset.src) {
    els.frame.src = els.frame.dataset.src;
    delete els.frame.dataset.src;
    observer.disconnect();
  }
}, { rootMargin: "280px" });

frameObserver.observe(els.frame);

updatePageStatus();
