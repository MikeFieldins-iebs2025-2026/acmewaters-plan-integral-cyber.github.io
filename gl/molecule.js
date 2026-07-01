/* ACME Waters · WebGL H2O molecule v8
   Renders the hero molecule as actual SDF 3D primitives:
   3 spheres + 2 finite cylinders, with dynamic/static modes controlled from main.js.
*/

(() => {
  "use strict";

  const STATIC_TIME = 8.0;
  let instance = null;

  const VERTEX = `precision mediump float;
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

  const FRAGMENT = `precision highp float;

uniform float uTime;
uniform vec2 uResolution;

varying vec2 vUv;

#define MAX_STEPS 88
#define MAX_DIST 10.0
#define SURF_DIST 0.0017

mat3 rotX(float a) {
  float s = sin(a), c = cos(a);
  return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
}

mat3 rotY(float a) {
  float s = sin(a), c = cos(a);
  return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
}

mat3 rotZ(float a) {
  float s = sin(a), c = cos(a);
  return mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0);
}

float sdSphere(vec3 p, vec3 c, float r) {
  return length(p - c) - r;
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

vec2 opU(vec2 a, vec2 b) {
  return (a.x < b.x) ? a : b;
}

vec2 moleculeMap(vec3 p) {
  float t = uTime;
  float y = sin(t * 0.72) * 0.045;
  vec3 o = vec3(0.0, 0.38 + y, 0.0);
  vec3 h1 = vec3(-0.98, -0.50 - y * 0.35, 0.22);
  vec3 h2 = vec3(0.98, -0.50 + y * 0.20, -0.16);

  vec2 d = vec2(1000.0, 0.0);
  d = opU(d, vec2(sdCapsule(p, o * 0.88 + h1 * 0.12, h1 * 0.78 + o * 0.22, 0.105), 3.0));
  d = opU(d, vec2(sdCapsule(p, o * 0.88 + h2 * 0.12, h2 * 0.78 + o * 0.22, 0.105), 3.0));
  d = opU(d, vec2(sdSphere(p, o, 0.58), 1.0));
  d = opU(d, vec2(sdSphere(p, h1, 0.335), 2.0));
  d = opU(d, vec2(sdSphere(p, h2, 0.335), 2.0));
  return d;
}

vec2 sceneMap(vec3 p) {
  float t = uTime;
  mat3 r = rotY(-t * 0.55) * rotX(-0.30 - sin(t * 0.37) * 0.18) * rotZ(-sin(t * 0.22) * 0.10);
  return moleculeMap(r * p);
}

vec3 getNormal(vec3 p) {
  vec2 e = vec2(0.0025, 0.0);
  return normalize(vec3(
    sceneMap(p + e.xyy).x - sceneMap(p - e.xyy).x,
    sceneMap(p + e.yxy).x - sceneMap(p - e.yxy).x,
    sceneMap(p + e.yyx).x - sceneMap(p - e.yyx).x
  ));
}

float rayMarch(vec3 ro, vec3 rd, out float matId) {
  float dO = 0.0;
  matId = 0.0;
  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * dO;
    vec2 hit = sceneMap(p);
    dO += hit.x;
    matId = hit.y;
    if (abs(hit.x) < SURF_DIST || dO > MAX_DIST) break;
  }
  return dO;
}

vec3 materialColor(float id) {
  if (id < 1.5) {
    return vec3(0.38, 0.48, 1.00); /* oxygen: blue/violet */
  }
  if (id < 2.5) {
    return vec3(1.00, 0.05, 0.08); /* hydrogen: glossy red */
  }
  return vec3(0.86, 0.90, 0.91);   /* cylinder bonds: pearly white */
}

float materialSpec(float id) {
  if (id < 1.5) return 0.82;
  if (id < 2.5) return 0.88;
  return 0.62;
}

void main() {
  vec2 uv = (vUv - 0.5) * 2.0;
  uv.x *= uResolution.x / max(uResolution.y, 1.0);

  vec3 ro = vec3(0.0, 0.0, 4.2);
  vec3 rd = normalize(vec3(uv, -2.48));

  float matId;
  float dist = rayMarch(ro, rd, matId);

  if (dist > MAX_DIST) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec3 p = ro + rd * dist;
  vec3 n = getNormal(p);

  vec3 lightDir = normalize(vec3(-0.45, 0.70, 0.62));
  vec3 fillDir = normalize(vec3(0.80, 0.24, 0.35));
  vec3 viewDir = normalize(ro - p);
  vec3 halfDir = normalize(lightDir + viewDir);

  float diff = max(dot(n, lightDir), 0.0);
  float fill = max(dot(n, fillDir), 0.0) * 0.28;
  float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
  float spec = pow(max(dot(n, halfDir), 0.0), 64.0) * materialSpec(matId);
  float tightSpec = pow(max(dot(reflect(-lightDir, n), viewDir), 0.0), 150.0) * 0.55;

  vec3 base = materialColor(matId);
  vec3 color = base * (0.22 + diff * 0.82 + fill);
  color += vec3(1.0, 1.0, 0.96) * (spec + tightSpec);
  color += vec3(0.60, 1.0, 0.96) * rim * 0.28;

  /* soft grounding/reflection under the molecule */
  float lowerGlow = smoothstep(-0.95, 0.45, -p.y) * smoothstep(1.35, 0.12, length(p.xz));
  color += vec3(0.20, 0.85, 1.0) * lowerGlow * 0.05;

  float edge = smoothstep(0.0, 0.020, SURF_DIST / max(0.0001, sceneMap(p).x + SURF_DIST));
  float alpha = 0.98;
  gl_FragColor = vec4(color, alpha * edge);
}`;

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn("[ACME Waters] No se pudo compilar el shader de molécula.", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(gl) {
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vertex || !fragment) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);

    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("[ACME Waters] No se pudo enlazar el programa WebGL de molécula.", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  function showFallback() {
    const fallback = document.getElementById("molecule-fallback");
    if (fallback) fallback.classList.add("is-visible");
    const canvas = document.getElementById("molecule-canvas");
    if (canvas) canvas.hidden = true;
  }

  function initMolecule(options = {}) {
    if (instance) {
      instance.setActive(Boolean(options.active));
      return instance;
    }

    const canvas = document.getElementById("molecule-canvas");
    if (!canvas) return { supported: false, setActive() {} };

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: "high-performance"
    });

    if (!gl) {
      console.warn("[ACME Waters] WebGL no disponible para la molécula; se activa fallback CSS.");
      showFallback();
      instance = { supported: false, setActive() {} };
      return instance;
    }

    const program = createProgram(gl);
    if (!program) {
      showFallback();
      instance = { supported: false, setActive() {} };
      return instance;
    }

    const posLoc = gl.getAttribLocation(program, "aPosition");
    const timeLoc = gl.getUniformLocation(program, "uTime");
    const resolutionLoc = gl.getUniformLocation(program, "uResolution");

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ]), gl.STATIC_DRAW);

    gl.useProgram(program);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let width = 0;
    let height = 0;
    let active = Boolean(options.active);
    let frameId = 0;
    let visible = document.visibilityState !== "hidden";

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.8);
      const nextWidth = Math.max(1, Math.floor(canvas.clientWidth * ratio));
      const nextHeight = Math.max(1, Math.floor(canvas.clientHeight * ratio));
      if (nextWidth === width && nextHeight === height) return;

      width = nextWidth;
      height = nextHeight;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }

    function draw(timeSeconds) {
      resize();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform1f(timeLoc, timeSeconds);
      gl.uniform2f(resolutionLoc, width, height);
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
      draw(now * 0.001);
      if (active) frameId = window.requestAnimationFrame(animate);
    }

    function renderStatic() {
      cancelFrame();
      draw(STATIC_TIME);
    }

    function setActive(nextActive) {
      active = Boolean(nextActive);
      cancelFrame();
      if (!visible) return;
      if (active) {
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
      if (active) return;
      renderStatic();
    }, { passive: true });

    instance = {
      supported: true,
      get active() {
        return active;
      },
      setActive
    };

    setActive(active);
    return instance;
  }

  window.initMolecule = initMolecule;
})();
