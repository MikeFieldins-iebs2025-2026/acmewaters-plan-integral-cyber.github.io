/* Native WebGL slow pool-water shadow / caustics background for ACME Waters v10.
   Optimized with capped DPR, maximum render edge, throttled FPS and paused animation
   when the tab is hidden. Uses relative shader files with inline fallbacks.
*/

(() => {
  "use strict";

  const STATIC_TIME = 18.0;
  const ACME_BUILD = window.ACME_BUILD || "v10-20260701-cache-bust";

  function versionedResource(url) {
    if (!url || /^data:/i.test(url)) return url;
    if (/[?&]v=/.test(url)) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}v=${encodeURIComponent(ACME_BUILD)}`;
  }

  const FALLBACK_VERTEX = `precision mediump float;
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

  const FALLBACK_FRAGMENT = `precision mediump float;

uniform float uTime;
uniform vec2 uResolution;

varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.54;
  mat2 r = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = r * p * 2.02 + vec2(3.4, 1.7);
    a *= 0.50;
  }
  return v;
}

float causticStroke(float x, float sharpness) {
  float v = abs(sin(x));
  return pow(1.0 - v, sharpness);
}

void main() {
  vec2 uv = vUv;
  vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  vec2 p = (uv - 0.5) * aspect;
  float t = uTime * 0.22;

  vec2 flow = vec2(
    sin(p.y * 2.0 + t * 0.82) + sin((p.x + p.y) * 2.5 - t * 0.58),
    cos(p.x * 1.9 - t * 0.70) + sin((p.y - p.x) * 2.3 + t * 0.54)
  ) * 0.035;

  float n1 = fbm(p * 1.55 + flow + vec2(t * 0.18, -t * 0.14));
  float n2 = fbm(p * 3.05 - flow + vec2(-t * 0.11, t * 0.17));
  vec2 q = p + flow + vec2(n1 - 0.5, n2 - 0.5) * 0.12;

  float w1 = q.x * 15.0 + sin(q.y * 5.9 + t * 1.05) * 1.30 + t * 0.82;
  float w2 = (q.x * 0.64 + q.y * 0.92) * 15.7 + cos(q.x * 5.0 - t * 0.84) * 1.05 - t * 0.69;
  float w3 = (-q.x * 0.74 + q.y * 1.08) * 12.6 + sin(q.y * 4.6 + t * 0.66) * 0.96 + t * 0.49;

  float c1 = causticStroke(w1, 17.0);
  float c2 = causticStroke(w2, 19.0);
  float c3 = causticStroke(w3, 15.0);
  float caustics = clamp(c1 * 0.78 + c2 * 0.70 + c3 * 0.54, 0.0, 1.0);
  caustics = smoothstep(0.035, 0.86, caustics);

  float softWaves = sin((p.x * 2.9 + p.y * 1.45) + n2 * 4.6 - t * 0.72) *
                    sin((p.y * 2.65 - p.x * 1.72) + n1 * 3.9 + t * 0.52);
  float shadows = smoothstep(0.14, 0.94, softWaves * 0.5 + 0.5);
  shadows *= 0.21 + 0.40 * noise(p * 1.15 + vec2(-t * 0.09, t * 0.07));

  float depth = smoothstep(1.42, 0.14, length(p + vec2(0.02, -0.02)));
  float topLight = smoothstep(0.98, 0.15, uv.y) * 0.18;
  float sparkle = pow(smoothstep(0.58, 1.0, noise(q * 12.0 + vec2(t * 0.65, -t * 0.50))), 5.0);

  vec3 deep = vec3(0.000, 0.055, 0.110);
  vec3 pool = vec3(0.000, 0.360, 0.560);
  vec3 aqua = vec3(0.055, 0.900, 1.000);
  vec3 pearl = vec3(0.940, 1.000, 0.960);

  vec3 color = mix(deep, pool, depth * 0.82 + n1 * 0.22);
  color = mix(color, aqua, 0.10 + n2 * 0.10 + topLight);
  color -= vec3(0.000, 0.100, 0.155) * shadows;
  color += pearl * caustics * 0.86;
  color += aqua * sparkle * 0.15;

  float vignette = smoothstep(1.48, 0.18, length(p));
  color *= mix(0.58, 1.16, vignette);
  color += vec3(0.02, 0.14, 0.16) * (1.0 - vignette);

  float alpha = 0.64 + caustics * 0.25 + sparkle * 0.04;
  alpha *= mix(0.70, 1.0, vignette);
  alpha = clamp(alpha, 0.54, 0.94);

  gl_FragColor = vec4(color, alpha);
}
`;

  async function readText(url, fallback) {
    try {
      const response = await fetch(versionedResource(url), { cache: "no-cache" });
      if (!response.ok) throw new Error("shader request failed");
      return await response.text();
    } catch (_) {
      return fallback;
    }
  }

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      console.warn("[ACME Waters] Shader WebGL no compilado.", message);
      return null;
    }
    return shader;
  }

  function createProgram(gl, vertexSource, fragmentSource) {
    const vertex = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);

    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      console.warn("[ACME Waters] Programa WebGL no enlazado.", message);
      return null;
    }
    return program;
  }

  function resolveRenderSize(canvas, maxDpr, maxEdge) {
    let pixelRatio = Math.min(window.devicePixelRatio || 1, maxDpr);
    let nextWidth = Math.max(1, Math.floor(canvas.clientWidth * pixelRatio));
    let nextHeight = Math.max(1, Math.floor(canvas.clientHeight * pixelRatio));
    const longest = Math.max(nextWidth, nextHeight);

    if (longest > maxEdge) {
      const scale = maxEdge / longest;
      nextWidth = Math.max(1, Math.floor(nextWidth * scale));
      nextHeight = Math.max(1, Math.floor(nextHeight * scale));
    }

    return { width: nextWidth, height: nextHeight };
  }

  async function initEtherealField(options = {}) {
    const canvas = document.getElementById(options.canvasId || "gl-canvas");
    if (!canvas) return { supported: false, setActive() {} };

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      premultipliedAlpha: true,
      powerPreference: "high-performance"
    });

    if (!gl) {
      console.warn("[ACME Waters] WebGL no disponible; se mantiene fondo CSS.");
      canvas.hidden = true;
      return { supported: false, setActive() {} };
    }

    const [vertexSource, fragmentSource] = await Promise.all([
      readText(options.vertexUrl || "./gl/field.vert", FALLBACK_VERTEX),
      readText(options.fragmentUrl || "./gl/field.frag", FALLBACK_FRAGMENT)
    ]);

    const program = createProgram(gl, vertexSource, fragmentSource);
    if (!program) {
      canvas.hidden = true;
      return { supported: false, setActive() {} };
    }

    const positionLocation = gl.getAttribLocation(program, "aPosition");
    const timeLocation = gl.getUniformLocation(program, "uTime");
    const resolutionLocation = gl.getUniformLocation(program, "uResolution");

    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ]);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    gl.useProgram(program);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const maxDpr = Math.max(0.75, Math.min(Number(options.maxDpr) || 1.15, 1.5));
    const maxEdge = Math.max(640, Math.min(Number(options.maxEdge) || 1920, 2200));
    const targetFPS = Math.max(16, Math.min(Number(options.targetFPS) || 30, 60));
    const frameInterval = 1000 / targetFPS;

    let width = 0;
    let height = 0;
    let active = Boolean(options.active);
    let frameId = 0;
    let visible = document.visibilityState !== "hidden";
    let lastDrawTime = -Infinity;

    function resize() {
      const size = resolveRenderSize(canvas, maxDpr, maxEdge);
      if (size.width === width && size.height === height) return;

      width = size.width;
      height = size.height;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }

    function draw(timeSeconds) {
      resize();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform1f(timeLocation, timeSeconds);
      gl.uniform2f(resolutionLocation, width, height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function cancelFrame() {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      }
    }

    function animate(now = 0) {
      frameId = 0;
      if (!visible) return;

      if (now - lastDrawTime >= frameInterval) {
        draw(now * 0.001);
        lastDrawTime = now;
      }

      if (active) frameId = window.requestAnimationFrame(animate);
    }

    function renderStatic() {
      cancelFrame();
      lastDrawTime = -Infinity;
      draw(STATIC_TIME);
    }

    function setActive(nextActive) {
      active = Boolean(nextActive);
      cancelFrame();
      if (!visible) return;
      if (active) {
        lastDrawTime = -Infinity;
        frameId = window.requestAnimationFrame(animate);
      } else {
        renderStatic();
      }
    }

    document.addEventListener("visibilitychange", () => {
      visible = document.visibilityState === "visible";
      cancelFrame();
      if (!visible) return;
      setActive(active);
    });

    window.addEventListener("resize", () => {
      if (active) {
        width = 0;
        height = 0;
        return;
      }
      renderStatic();
    }, { passive: true });

    setActive(active);

    return {
      supported: true,
      get active() {
        return active;
      },
      setActive
    };
  }

  window.initEtherealField = initEtherealField;
})();
