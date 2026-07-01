precision mediump float;

varying vec3 vNormal;
varying vec3 vPosition;
uniform float uTime;
uniform float uHue;
uniform float uAlpha;

vec3 palette(float t) {
  vec3 a = vec3(0.56, 0.78, 0.96);
  vec3 b = vec3(0.42, 0.32, 0.55);
  vec3 c = vec3(1.00, 1.00, 1.00);
  vec3 d = vec3(0.00, 0.36, 0.70);
  return a + b * cos(6.28318 * (c * t + d));
}

void main() {
  vec3 n = normalize(vNormal);
  float rim = pow(1.0 - abs(dot(n, vec3(0.0, 0.0, 1.0))), 2.35);
  float oil = sin((vPosition.x * 4.0 + vPosition.y * 6.0) + uTime * 0.65) * 0.5 + 0.5;
  vec3 aero = mix(palette(uHue + oil * 0.20), vec3(1.0, 0.96, 0.88), rim * 0.54);
  float alpha = uAlpha * (0.34 + rim * 0.66);
  gl_FragColor = vec4(aero, alpha);
}
