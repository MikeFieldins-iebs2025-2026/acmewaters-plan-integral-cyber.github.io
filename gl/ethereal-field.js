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
  mat2 r = mat2(0.82, -0.57, 0.57, 0.82);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = r * p * 2.06 + vec2(2.7, 3.9);
    a *= 0.50;
  }
  return v;
}

float causticLine(float value, float width, float glow) {
  float d = abs(fract(value) - 0.5);
  float core = smoothstep(width, 0.0, d);
  float halo = smoothstep(glow, 0.0, d) * 0.42;
  return core + halo;
}

void main() {
  vec2 uv = vUv;
  vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  vec2 p = (uv - 0.5) * aspect;

  float t = uTime * 0.075;

  vec2 slowSwell = vec2(
    sin(p.y * 2.6 + t * 3.1),
    cos(p.x * 2.2 - t * 2.4)
  ) * 0.055;

  float surfaceA = fbm(p * 1.7 + vec2(t * 0.55, -t * 0.34));
  float surfaceB = fbm(p * 3.1 + vec2(-t * 0.26, t * 0.45) + surfaceA * 0.72);
  vec2 q = p + slowSwell + vec2(surfaceA - 0.5, surfaceB - 0.5) * 0.18;

  float c1 = causticLine(q.x * 2.15 + sin(q.y * 5.3 + t * 2.2) * 0.18 + t * 0.42, 0.030, 0.105);
  float c2 = causticLine((q.x * 0.72 + q.y * 1.72) + sin(q.x * 4.4 - t * 2.0) * 0.17 - t * 0.35, 0.026, 0.098);
  float c3 = causticLine((-q.x * 1.28 + q.y * 1.22) + cos(q.y * 4.0 + t * 1.7) * 0.18 + t * 0.28, 0.024, 0.092);

  float caustics = (c1 * 0.42 + c2 * 0.38 + c3 * 0.34);
  caustics = pow(clamp(caustics, 0.0, 1.0), 2.25);

  float shadowBands =
    sin((p.x * 3.0 + p.y * 1.1) + surfaceB * 3.4 - t * 1.1) *
    sin((p.y * 2.2 - p.x * 1.7) + surfaceA * 2.8 + t * 0.92);
  float softShadow = smoothstep(0.10, 0.88, shadowBands * 0.5 + 0.5);
  softShadow *= 0.18 + 0.38 * fbm(p * 1.05 + vec2(-t * 0.33, t * 0.18));

  float poolDepth = smoothstep(1.42, 0.18, length(p + vec2(0.04, -0.02)));
  float surfaceGlow = smoothstep(0.10, 0.95, uv.y) * smoothstep(1.18, 0.18, length(p));
  float sparkle = pow(smoothstep(0.56, 1.0, fbm(q * 11.0 + vec2(t * 1.5, -t))), 6.0);

  vec3 deep = vec3(0.012, 0.090, 0.165);
  vec3 lagoon = vec3(0.000, 0.370, 0.560);
  vec3 crystal = vec3(0.060, 0.950, 1.000);
  vec3 pearl = vec3(0.935, 1.000, 0.960);

  vec3 color = mix(deep, lagoon, poolDepth * 0.88 + surfaceB * 0.18);
  color = mix(color, crystal, surfaceGlow * 0.20 + caustics * 0.34);
  color -= vec3(0.020, 0.085, 0.115) * softShadow;
  color += pearl * caustics * 0.58;
  color += crystal * sparkle * 0.16;

  float vignette = smoothstep(1.55, 0.20, length(p));
  float alpha = 0.18 + caustics * 0.48 + sparkle * 0.08;
  alpha += surfaceGlow * 0.10;
  alpha *= mix(0.50, 1.0, vignette);
  alpha = clamp(alpha, 0.0, 0.82);

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
