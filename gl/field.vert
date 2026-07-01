precision mediump float;

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

  pos += vec2(
    sin(uTime * 0.19 + id * 11.7),
    cos(uTime * 0.15 + id * 8.1)
  ) * 0.06;

  float aspect = uResolution.x / max(uResolution.y, 1.0);
  pos.x /= max(aspect, 0.72);

  float perspective = mix(0.62, 1.46, z);
  gl_Position = vec4(pos * perspective, mix(-0.4, 0.34, z), 1.0);
  gl_PointSize = mix(12.0, 78.0, z) * uPixelRatio;

  vDepth = z;
  vAura = aSeed.y;
}
