const THREE_CDN = "https://unpkg.com/three@0.160.0/build/three.module.js";

const fallbackVertex = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  uniform float uTime;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    vec3 displaced = position + normal * sin(uTime + position.y * 4.0) * 0.018;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const fallbackFragment = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  uniform float uTime;
  uniform float uHue;
  uniform float uAlpha;

  vec3 palette(float t) {
    vec3 a = vec3(0.48, 0.72, 0.92);
    vec3 b = vec3(0.42, 0.30, 0.52);
    vec3 c = vec3(1.00, 1.00, 1.00);
    vec3 d = vec3(0.06, 0.42, 0.78);
    return a + b * cos(6.28318 * (c * t + d));
  }

  void main() {
    float rim = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.2);
    float swirl = sin((vPosition.x + vPosition.y) * 4.0 + uTime * 0.7) * 0.5 + 0.5;
    vec3 color = mix(palette(uHue + swirl * 0.18), vec3(1.0), rim * 0.48);
    gl_FragColor = vec4(color, uAlpha * (0.38 + rim * 0.62));
  }
`;

async function loadShader(path, fallback) {
  try {
    const response = await fetch(path, { cache: "force-cache" });
    if (!response.ok) throw new Error("shader unavailable");
    return await response.text();
  } catch (_) {
    return fallback;
  }
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export async function initAeroScene(canvas, options = {}) {
  if (!canvas) return;

  const [{ default: THREE }, vertexShader, fragmentShader] = await Promise.all([
    import(THREE_CDN),
    loadShader(`${options.shaderPath || "./gl/shaders/"}bubble.vert`, fallbackVertex),
    loadShader(`${options.shaderPath || "./gl/shaders/"}bubble.frag`, fallbackFragment)
  ]).catch(() => [null, fallbackVertex, fallbackFragment]);

  if (!THREE) return;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance"
  });

  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uHue: { value: 0.1 },
      uAlpha: { value: 0.45 }
    }
  });

  const bubbles = [];
  const geometry = new THREE.SphereGeometry(1, 48, 32);

  for (let i = 0; i < 16; i += 1) {
    const mesh = new THREE.Mesh(geometry, material.clone());
    const scale = randomBetween(0.12, 0.46);
    mesh.scale.setScalar(scale);
    mesh.position.set(randomBetween(-4.5, 4.8), randomBetween(-2.8, 3.2), randomBetween(-2.4, 1.2));
    mesh.material.uniforms.uHue.value = randomBetween(0, 1);
    mesh.material.uniforms.uAlpha.value = randomBetween(0.22, 0.5);
    mesh.userData = {
      baseY: mesh.position.y,
      drift: randomBetween(0.3, 0.9),
      speed: randomBetween(0.18, 0.42),
      phase: randomBetween(0, Math.PI * 2)
    };
    scene.add(mesh);
    bubbles.push(mesh);
  }

  const chrome = new THREE.Mesh(
    new THREE.TorusKnotGeometry(1.05, 0.08, 120, 12),
    new THREE.MeshBasicMaterial({
      color: 0x87fff3,
      transparent: true,
      opacity: 0.24,
      wireframe: true
    })
  );
  chrome.position.set(2.6, -0.4, -1.1);
  chrome.scale.set(1.35, 1.35, 1.35);
  scene.add(chrome);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(1.65, 0.018, 12, 140),
    new THREE.MeshBasicMaterial({
      color: 0xff7ce4,
      transparent: true,
      opacity: 0.22
    })
  );
  halo.position.set(-2.3, 1.2, -1.6);
  halo.rotation.x = 1.1;
  halo.rotation.y = -0.2;
  scene.add(halo);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  let running = true;
  const clock = new THREE.Clock();

  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
  });

  window.addEventListener("resize", resize, { passive: true });
  resize();

  function render() {
    const t = clock.getElapsedTime();

    bubbles.forEach((bubble, index) => {
      bubble.material.uniforms.uTime.value = t;
      bubble.position.y = bubble.userData.baseY + Math.sin(t * bubble.userData.speed + bubble.userData.phase) * bubble.userData.drift;
      bubble.position.x += Math.sin(t * 0.2 + index) * 0.0008;
      bubble.rotation.y = t * 0.13 + index;
    });

    chrome.rotation.x = t * 0.12;
    chrome.rotation.y = t * 0.18;
    halo.rotation.z = t * 0.08;

    renderer.render(scene, camera);
  }

  if (options.reducedMotion) {
    render();
    return;
  }

  renderer.setAnimationLoop(() => {
    if (running) render();
  });
}
