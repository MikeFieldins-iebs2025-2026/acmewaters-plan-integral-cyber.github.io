/* Native WebGL background for ACME Waters.
   Uses relative shader files, with inline fallback when opened from file://.
*/

(() => {
  "use strict";

  const FALLBACK_VERTEX = `precision mediump float;
attribute vec4 aSeed;
uniform float uTime;
uniform float uPixelRatio;
uniform vec2 uResolution;
varying float vDepth;
varying float vAura;
void main() {
  float id = aSeed.x;
  float orbit = mix(0.16, 0.96, aSeed.y);
  float speed = mix(0.16, 0.62, aSeed.z);
  float tilt = mix(-0.72, 0.72, aSeed.w);
  float t = uTime * speed + id * 6.2831853;
  float z = 0.5 + 0.5 * sin(t * 0.73 + aSeed.w * 9.0);
  vec2 pos;
  pos.x = cos(t * 0.91 + sin(t * 0.17)) * orbit;
  pos.y = sin(t * 1.13 + tilt) * orbit * 0.58;
  pos += vec2(sin(uTime * 0.19 + id * 11.7), cos(uTime * 0.15 + id * 8.1)) * 0.06;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  pos.x /= max(aspect, 0.72);
  float perspective = mix(0.62, 1.46, z);
  gl_Position = vec4(pos * perspective, mix(-0.4, 0.34, z), 1.0);
  gl_PointSize = mix(12.0, 78.0, z) * uPixelRatio;
  vDepth = z;
  vAura = aSeed.y;
}`;

  const FALLBACK_FRAGMENT = `precision mediump float;
varying float vDepth;
varying float vAura;
void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float d = length(uv);
  float body = 1.0 - smoothstep(0.18, 1.0, d);
  float shell = smoothstep(0.74, 0.98, d) * (1.0 - smoothstep(0.98, 1.03, d));
  float highlight = 1.0 - smoothstep(0.0, 0.22, length(uv - vec2(-0.32, -0.38)));
  vec3 aqua = vec3(0.34, 1.0, 0.93);
  vec3 blue = vec3(0.30, 0.54, 1.0);
  vec3 pink = vec3(1.0, 0.42, 0.86);
  vec3 color = mix(mix(aqua, blue, vDepth), pink, smoothstep(0.62, 1.0, vAura));
  float alpha = body * 0.18 + shell * 0.42 + highlight * 0.18;
  alpha *= mix(0.28, 0.78, vDepth);
  if (d > 1.02 || alpha < 0.01) discard;
  gl_FragColor = vec4(color + highlight * 0.22, alpha);
}`;

  async function readText(url, fallback) {
    try {
      const response = await fetch(url, { cache: "force-cache" });
      if (!response.ok) throw new Error("shader");
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
      gl.deleteShader(shader);
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
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  function mulberry32(seed) {
    return function rand() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function createSeeds(count) {
    const rand = mulberry32(24062026);
    const data = new Float32Array(count * 4);
    for (let i = 0; i < count; i += 1) {
      data[i * 4 + 0] = i / Math.max(count - 1, 1);
      data[i * 4 + 1] = rand();
      data[i * 4 + 2] = rand();
      data[i * 4 + 3] = rand();
    }
    return data;
  }

  async function initEtherealField(options = {}) {
    const canvas = document.getElementById(options.canvasId || "gl-canvas");
    if (!canvas) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      depth: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false
    });

    if (!gl) {
      canvas.style.display = "none";
      return;
    }

    const [vertexSource, fragmentSource] = await Promise.all([
      readText(options.vertexUrl || "./gl/field.vert", FALLBACK_VERTEX),
      readText(options.fragmentUrl || "./gl/field.frag", FALLBACK_FRAGMENT)
    ]);

    const program = createProgram(gl, vertexSource, fragmentSource);
    if (!program) {
      canvas.style.display = "none";
      return;
    }

    const aSeed = gl.getAttribLocation(program, "aSeed");
    const uTime = gl.getUniformLocation(program, "uTime");
    const uPixelRatio = gl.getUniformLocation(program, "uPixelRatio");
    const uResolution = gl.getUniformLocation(program, "uResolution");

    const particleCount = reducedMotion ? 90 : 320;
    const seeds = createSeeds(particleCount);
    const buffer = gl.createBuffer();

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(aSeed);
    gl.vertexAttribPointer(aSeed, 4, gl.FLOAT, false, 0, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.disable(gl.DEPTH_TEST);

    let width = 0;
    let height = 0;
    let raf = 0;
    let start = performance.now();

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const nextWidth = Math.floor(window.innerWidth * dpr);
      const nextHeight = Math.floor(window.innerHeight * dpr);
      if (nextWidth === width && nextHeight === height) return;

      width = nextWidth;
      height = nextHeight;
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      gl.viewport(0, 0, width, height);
      gl.uniform1f(uPixelRatio, dpr);
      gl.uniform2f(uResolution, width, height);
    }

    function frame(now) {
      resize();
      const seconds = reducedMotion ? 12.0 : (now - start) * 0.001;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, seconds);
      gl.drawArrays(gl.POINTS, 0, particleCount);

      if (!reducedMotion) {
        raf = requestAnimationFrame(frame);
      }
    }

    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else if (!reducedMotion) {
        start = performance.now() - (performance.now() - start);
        raf = requestAnimationFrame(frame);
      }
    });

    frame(performance.now());
  }

  window.initEtherealField = initEtherealField;
})();
