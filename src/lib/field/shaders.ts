/*
  GLSL ES 3.00. The `#version` directive must be the very first characters
  of the source, so none of these strings may begin with a newline.
*/

/** A single oversized triangle covering the viewport. No buffers needed. */
export const VERT = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

/*
  Pass 1 — the trace.

  A single-channel buffer at quarter resolution holding "where light has
  recently been". Every frame it is multiplied down towards zero and the
  pointer's movement since the last frame is added back in as a soft
  capsule, so a fast gesture leaves a continuous stroke rather than a row
  of dots.

  This buffer is the afterimage.
*/
export const TRACE_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uPrev;
uniform vec2 uFrom;
uniform vec2 uTo;
uniform float uStrength;
uniform float uDecay;
uniform float uAspect;

float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  float previous = texture(uPrev, vUv).r;

  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  vec2 a = vec2(uFrom.x * uAspect, uFrom.y);
  vec2 b = vec2(uTo.x * uAspect, uTo.y);

  float d = segmentDistance(p, a, b);
  // Wide enough that a single pass of the hand uncovers a readable area.
  float stamp = exp(-(d * d) / 0.0065) * uStrength;

  outColor = vec4(min(1.0, previous * uDecay + stamp * 0.30), 0.0, 0.0, 1.0);
}
`;

/*
  Pass 2 — the composite.

  There is an image on the wall, and the room is dark. The lamp wanders
  slowly across it, so a little of the picture is always surfacing
  somewhere; wherever the visitor's hand has passed, the trace buffer opens
  it up almost completely, and then it sinks back as the trace decays.

  So the picture is never "displayed". It is found, and only as much of it
  as you have lit. Until the texture has downloaded, the wall is a neutral
  white surface and the composition is unchanged.

  Two details worth keeping:

  - The grain is quantised to about nine steps a second rather than
    changing every frame. Per-frame noise shimmers and reads as digital;
    held for a few frames it reads as film.

  - Everything is dithered before output. A dark gradient across 8-bit sRGB
    produces visible rings, and this is a site made almost entirely of dark
    gradients. Adding well under one code value of noise breaks the bands
    up completely and is invisible in itself.
*/
export const COMPOSITE_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uTrace;
uniform sampler2D uImage;
uniform vec2 uResolution;
uniform vec2 uLight;
uniform float uTime;
uniform float uPeak;
uniform float uImageAspect;
uniform float uImageReady;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  float aspect = uResolution.x / uResolution.y;

  // The lamp is never quite still, so the picture keeps surfacing in
  // different places instead of the page sitting dead until it is touched.
  vec2 lamp = uLight + vec2(sin(uTime * 0.11) * 0.14, cos(uTime * 0.083) * 0.10);

  vec2 d = (vUv - lamp) * vec2(aspect, 1.0);
  float r = length(d / vec2(1.18, 0.88));
  float spill = uPeak * exp(-r * r * 1.7);

  float trace = texture(uTrace, vUv).r;

  // How much light is actually falling on the wall at this point.
  float light = spill + trace * 0.92;

  // Cover-fit, so the picture fills the viewport at any shape of window.
  vec2 iuv = vUv;
  if (aspect > uImageAspect) {
    iuv.y = (iuv.y - 0.5) * (uImageAspect / aspect) + 0.5;
  } else {
    iuv.x = (iuv.x - 0.5) * (aspect / uImageAspect) + 0.5;
  }

  vec3 picture = texture(uImage, iuv).rgb;
  vec3 surface = mix(vec3(0.84, 0.87, 0.90), picture, uImageReady);

  light += 0.0035 * sin(vUv.y * 3.0 + uTime * 0.07);

  float step = floor(uTime * 9.0);
  float grain = hash(vUv * uResolution * 0.5 + step) - 0.5;
  light += grain * (0.016 + trace * 0.03);

  vec3 colour = vec3(0.0196) + surface * light;

  // Sub-code-value dither. Removes banding without being visible.
  colour += (hash(vUv * uResolution + step * 0.37) - 0.5) / 255.0;

  outColor = vec4(colour, 1.0);
}
`;
