precision mediump float;

varying float vDepth;
varying float vAura;

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float d = length(uv);

  float body = 1.0 - smoothstep(0.16, 1.0, d);
  float shell = smoothstep(0.70, 0.98, d) * (1.0 - smoothstep(0.98, 1.03, d));
  float highlight = 1.0 - smoothstep(0.0, 0.24, length(uv - vec2(-0.34, -0.40)));

  vec3 crystal = vec3(0.78, 1.0, 0.98);
  vec3 aqua = vec3(0.42, 1.0, 0.94);
  vec3 lagoon = vec3(0.10, 0.74, 0.96);
  vec3 depthBlue = vec3(0.02, 0.30, 0.56);
  vec3 color = mix(mix(crystal, aqua, vAura), mix(lagoon, depthBlue, vDepth), smoothstep(0.34, 1.0, vDepth));

  float alpha = body * 0.15 + shell * 0.48 + highlight * 0.22;
  alpha *= mix(0.22, 0.70, vDepth);

  if (d > 1.02 || alpha < 0.01) discard;

  gl_FragColor = vec4(color + highlight * 0.28, alpha);
}
