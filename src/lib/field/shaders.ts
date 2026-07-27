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
uniform sampler2D uImageNext;
uniform vec2 uResolution;
uniform vec2 uLight;
uniform float uTime;
uniform float uPeak;
uniform float uImageAspect;
uniform float uNextAspect;
uniform float uImageReady;
/** Overall strength of the light, 0–1. Reading pages turn it down. */
uniform float uIntensity;
/** 0 while idle. Rises to 1 across a navigation, driving the write head. */
uniform float uSwap;
/**
 * When the idle loop last restarted, in seconds. Reset at the end of every
 * pass so the bar always picks up from the bottom rather than snapping to
 * wherever a free-running clock happened to put it.
 */
uniform float uLoopStart;

/** Cover-fit, so a picture fills the viewport at any shape of window. */
vec2 coverUv(vec2 uv, float screenAspect, float imageAspect) {
  if (screenAspect > imageAspect) {
    uv.y = (uv.y - 0.5) * (imageAspect / screenAspect) + 0.5;
  } else {
    uv.x = (uv.x - 0.5) * (screenAspect / imageAspect) + 0.5;
  }
  return uv;
}

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

  /*
    The scan bar: a horizontal line the full width of the wall, lighting the
    picture as it passes — the same reveal the pointer makes, on rails. A
    hard core with a short falloff either side, because a scanner's lamp is a
    line rather than a glow.

    The preview pass. A flatbed makes one deliberate sweep before it settles,
    so for the first few seconds the bar travels once from the top edge to the
    bottom, eased at both ends, and only then picks up its loop.

    The handoff is silent because the loop is phase-shifted to start exactly
    where the preview finished — at the bottom, moving back up, from a
    standstill.
  */
  const float PREVIEW = 5.0;
  bool previewing = uTime < PREVIEW;
  float bar;
  if (previewing) {
    float k = uTime / PREVIEW;
    bar = 1.0 - k * k * (3.0 - 2.0 * k);
  } else {
    /*
      Phase 0.5 puts the bar at the bottom, moving back up. Because
      uLoopStart is set to the moment each pass ends, the loop always
      resumes from exactly where the head stopped.
    */
    float phase = fract((uTime - uLoopStart) * 0.055 + 0.5);
    bar = abs(phase * 2.0 - 1.0);
    bar = bar * bar * (3.0 - 2.0 * bar);
  }

  /*
    During a navigation the head is driven by uSwap instead, running top to
    bottom once. That single pass is the transition.
  */
  float swapping = step(0.0001, uSwap);
  float head = 1.0 - uSwap;
  bar = mix(bar, head, swapping);

  float dist = vUv.y - bar;
  float scan = exp(-dist * dist / 0.00035) * 0.5 + exp(-dist * dist / 0.007) * 0.13;

  // How much light is actually falling on the wall at this point.
  float light = (spill + trace * 0.92 + scan) * uIntensity;

  vec3 current = texture(uImage, coverUv(vUv, aspect, uImageAspect)).rgb;
  vec3 incoming = texture(uImageNext, coverUv(vUv, aspect, uNextAspect)).rgb;

  /*
    Everything the head has already crossed shows the new page; everything
    ahead of it still shows the old one. So the picture is not cross-faded,
    it is rewritten line by line behind the bar — which is what a scanner
    does, and the only honest way to change the image on this site.
  */
  float written = step(bar, vUv.y) * swapping;
  vec3 picture = mix(current, incoming, written);

  vec3 surface = mix(vec3(0.84, 0.87, 0.90), picture, uImageReady);

  light += 0.0035 * sin(vUv.y * 3.0 + uTime * 0.07);

  float step = floor(uTime * 9.0);
  float grain = hash(vUv * uResolution * 0.5 + step) - 0.5;
  light += grain * (0.016 + trace * 0.03);

  vec3 colour = vec3(0.0196) + surface * light;

  /*
    On the very first pass, and only then, everything the head has not yet
    reached is held under an extra layer of dark that the bar wipes off as it
    descends. It resolves to exactly the normal ground by the time the pass
    ends, so nothing is left brighter or darker than it would otherwise be —
    and because it is keyed to the machine's own clock rather than to the
    page, coming back to the entry later never replays it.
  */
  float intro = previewing ? 1.0 - swapping : 0.0;
  float unscanned = (1.0 - smoothstep(bar - 0.004, bar + 0.004, vUv.y)) * intro;
  colour *= mix(1.0, 0.16, unscanned);

  // Sub-code-value dither. Removes banding without being visible.
  colour += (hash(vUv * uResolution + step * 0.37) - 0.5) / 255.0;

  outColor = vec4(colour, 1.0);
}
`;
