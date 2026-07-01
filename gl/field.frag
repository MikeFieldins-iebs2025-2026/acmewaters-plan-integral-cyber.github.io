precision mediump float;

uniform float uTime;
uniform vec2 uResolution;

varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
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
  float a = 0.5;
  mat2 r = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = r * p * 2.02 + 3.7;
    a *= 0.52;
  }
  return v;
}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);

  float t = uTime * 0.18;
  vec2 flowA = vec2(sin(t * 1.7), cos(t * 1.1)) * 0.16;
  vec2 flowB = vec2(cos(t * 0.9), sin(t * 1.4)) * 0.12;

  float n1 = fbm(p * 3.0 + flowA);
  float n2 = fbm(p * 5.6 - flowB + n1 * 0.65);
  float waveA = sin((p.x * 7.5 + n1 * 3.2 + uTime * 0.46));
  float waveB = sin((p.y * 8.4 - n2 * 2.7 - uTime * 0.38));
  float waveC = sin((p.x + p.y) * 9.6 + n2 * 3.1 + uTime * 0.22);

  float caustic = pow(max(0.0, (waveA + waveB + waveC) / 3.0), 7.0);
  caustic += pow(max(0.0, 1.0 - abs(waveA * waveB)), 5.5) * 0.14;
  caustic *= smoothstep(0.02, 0.58, uv.y) * (1.0 - smoothstep(1.02, 0.60, length(p)));

  float pool = smoothstep(0.92, 0.20, length(p + vec2(0.05, -0.03)));
  float shimmer = smoothstep(0.48, 1.0, fbm(p * 12.0 + vec2(uTime * 0.12, -uTime * 0.06)));

  vec3 aqua = vec3(0.14, 0.95, 1.00);
  vec3 cyan = vec3(0.52, 1.00, 0.96);
  vec3 pearl = vec3(0.94, 1.00, 0.96);
  vec3 blue = vec3(0.02, 0.36, 0.72);

  vec3 color = mix(blue, aqua, pool * 0.72 + n2 * 0.22);
  color = mix(color, cyan, caustic * 0.58);
  color += pearl * caustic * 0.72 + cyan * shimmer * 0.035;

  float vignette = smoothstep(1.20, 0.18, length(p));
  float alpha = 0.16 + caustic * 0.54 + shimmer * 0.035;
  alpha *= mix(0.56, 1.0, vignette);
  alpha *= smoothstep(0.0, 0.18, uv.y);

  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.72));
}
