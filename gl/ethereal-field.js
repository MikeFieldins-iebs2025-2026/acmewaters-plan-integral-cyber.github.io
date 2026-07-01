/* Native WebGL slow pool-water shadow / caustics background for ACME Waters.
   Uses relative shader files, with inline fallbacks for file:// and restrictive hosts.
*/

(() => {
  "use strict";

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
  float a = 0.52;
  mat2 r = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = r * p * 2.03 + vec2(3.4, 1.7);
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
    sin(p.y * 2.1 + t * 0.85) + sin((p.x + p.y) * 2.7 - t * 0.62),
    cos(p.x * 2.0 - t * 0.72) + sin((p.y - p.x) * 2.4 + t * 0.58)
  ) * 0.035;

  float n1 = fbm(p * 1.6 + flow + vec2(t * 0.20, -t * 0.16));
  float n2 = fbm(p * 3.2 - flow + vec2(-t * 0.12, t * 0.19));
  vec2 q = p + flow + vec2(n1 - 0.5, n2 - 0.5) * 0.12;

  float w1 = q.x * 15.5 + sin(q.y * 6.2 + t * 1.1) * 1.35 + t * 0.85;
  float w2 = (q.x * 0.64 + q.y * 0.92) * 16.2 + cos(q.x * 5.2 - t * 0.9) * 1.10 - t * 0.72;
  float w3 = (-q.x * 0.74 + q.y * 1.08) * 13.0 + sin(q.y * 4.8 + t * 0.7) * 1.00 + t * 0.52;

  float c1 = causticStroke(w1, 18.0);
  float c2 = causticStroke(w2, 20.0);
  float c3 = causticStroke(w3, 16.0);
  float caustics = clamp(c1 * 0.80 + c2 * 0.72 + c3 * 0.58, 0.0, 1.0);
  caustics = smoothstep(0.03, 0.88, caustics);

  float softWaves = sin((p.x * 3.0 + p.y * 1.5) + n2 * 5.0 - t * 0.75) *
                    sin((p.y * 2.8 - p.x * 1.8) + n1 * 4.2 + t * 0.56);
  float shadows = smoothstep(0.14, 0.95, softWaves * 0.5 + 0.5);
  shadows *= 0.20 + 0.46 * fbm(p * 0.95 + vec2(-t * 0.08, t * 0.06));

  float depth = smoothstep(1.42, 0.14, length(p + vec2(0.02, -0.02)));
  float topLight = smoothstep(0.98, 0.15, uv.y) * 0.18;
  float sparkle = pow(smoothstep(0.60, 1.0, fbm(q * 10.5 + vec2(t * 0.70, -t * 0.55))), 5.0);

  vec3 deep = vec3(0.000, 0.055, 0.110);
  vec3 pool = vec3(0.000, 0.360, 0.560);
  vec3 aqua = vec3(0.055, 0.900, 1.000);
  vec3 pearl = vec3(0.940, 1.000, 0.960);

  vec3 color = mix(deep, pool, depth * 0.82 + n1 * 0.22);
  color = mix(color, aqua, 0.10 + n2 * 0.10 + topLight);
  color -= vec3(0.000, 0.100, 0.155) * shadows;
  color += pearl * caustics * 0.88;
  color += aqua * sparkle * 0.18;

  float vignette = smoothstep(1.48, 0.18, length(p));
  color *= mix(0.58, 1.16, vignette);
  color += vec3(0.02, 0.14, 0.16) * (1.0 - vignette);

  float alpha = 0.66 + caustics * 0.26 + sparkle * 0.05;
  alpha *= mix(0.70, 1.0, vignette);
  alpha = clamp(alpha, 0.56, 0.96);

  gl_FragColor = vec4(color, alpha);
}
`;

  async function readText(url, fallback) {
    try {
      const response = await fetch(url, { cache: "force-cache" });
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

  async function initEtherealField(options = {}) {
    const canvas = document.getElementById(options.canvasId || "gl-canvas");
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: "high-performance"
    });

    if (!gl) {
      console.warn("[ACME Waters] WebGL no disponible; se mantiene fondo CSS.");
      return;
    }

    const [vertexSource, fragmentSource] = await Promise.all([
      readText(options.vertexUrl || "./gl/field.vert", FALLBACK_VERTEX),
      readText(options.fragmentUrl || "./gl/field.frag", FALLBACK_FRAGMENT)
    ]);

    const program = createProgram(gl, vertexSource, fragmentSource);
    if (!program) return;

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

    let width = 0;
    let height = 0;
    let running = true;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function resize() {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
      const nextWidth = Math.max(1, Math.floor(canvas.clientWidth * pixelRatio));
      const nextHeight = Math.max(1, Math.floor(canvas.clientHeight * pixelRatio));
      if (nextWidth === width && nextHeight === height) return;

      width = nextWidth;
      height = nextHeight;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }

    function render(now = 0) {
      if (!running) return;

      resize();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform1f(timeLocation, reducedMotion ? 12.0 : now * 0.001);
      gl.uniform2f(resolutionLocation, width, height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      if (!reducedMotion) window.requestAnimationFrame(render);
    }

    document.addEventListener("visibilitychange", () => {
      running = document.visibilityState === "visible";
      if (running && !reducedMotion) window.requestAnimationFrame(render);
    });

    window.addEventListener("resize", resize, { passive: true });
    render(0);
  }

  window.initEtherealField = initEtherealField;
})();
