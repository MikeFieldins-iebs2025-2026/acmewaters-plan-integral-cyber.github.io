precision mediump float;

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
}
