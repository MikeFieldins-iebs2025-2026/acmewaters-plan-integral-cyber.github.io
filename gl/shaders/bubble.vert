varying vec3 vNormal;
varying vec3 vPosition;
uniform float uTime;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  float pulse = sin(uTime * 0.85 + position.y * 5.0 + position.x * 2.0) * 0.022;
  vec3 displaced = position + normal * pulse;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
