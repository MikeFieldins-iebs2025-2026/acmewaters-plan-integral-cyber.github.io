precision mediump float;

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
