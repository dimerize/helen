import { prefersReducedMotion, prefersLessData, underpowered, whenIdle } from '../motion';
import { VERT, TRACE_FRAG, COMPOSITE_FRAG } from './shaders';

/*
  The live light field.

  This module is allowed to give up at any point. The CSS still underneath
  it is a complete composition on its own, so failing to start — or
  starting and then deciding the device cannot hold frame rate — costs the
  visitor nothing but the afterimage.

  Order of events:
    1. wait until after load, then until the browser is idle
    2. refuse outright on a data-saving connection or a weak device
    3. refuse if WebGL2 is unavailable
    4. draw, sample frame times, and drop resolution once before giving up
*/

const MAX_DPR = 1.5;
const TRACE_MAX = 512;
const TRACE_DIVISOR = 4;

/** Half-life of the afterimage, in seconds. */
const DECAY_HALF_LIFE = 2.4;

const SAMPLE_SKIP = 12; // frames ignored while everything warms up
const SAMPLE_SIZE = 40;
const SLOW_MS = 22;

const canvas = document.querySelector<HTMLCanvasElement>('[data-field]');
if (canvas) whenIdle(() => start(canvas));

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function link(gl: WebGL2RenderingContext, fragSource: string): WebGLProgram | null {
  const vert = compile(gl, gl.VERTEX_SHADER, VERT);
  const frag = compile(gl, gl.FRAGMENT_SHADER, fragSource);
  if (!vert || !frag) return null;

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  gl.deleteShader(vert);
  gl.deleteShader(frag);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function makeTraceTarget(gl: WebGL2RenderingContext, width: number, height: number) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, height, 0, gl.RED, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return complete ? { texture, framebuffer } : null;
}

function start(canvas: HTMLCanvasElement): void {
  if (prefersLessData() || underpowered()) return;

  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: 'low-power',
  });
  if (!gl) return;

  const traceProgram = link(gl, TRACE_FRAG);
  const compositeProgram = link(gl, COMPOSITE_FRAG);
  if (!traceProgram || !compositeProgram) return;

  const u = {
    trace: {
      prev: gl.getUniformLocation(traceProgram, 'uPrev'),
      from: gl.getUniformLocation(traceProgram, 'uFrom'),
      to: gl.getUniformLocation(traceProgram, 'uTo'),
      strength: gl.getUniformLocation(traceProgram, 'uStrength'),
      decay: gl.getUniformLocation(traceProgram, 'uDecay'),
      aspect: gl.getUniformLocation(traceProgram, 'uAspect'),
    },
    composite: {
      trace: gl.getUniformLocation(compositeProgram, 'uTrace'),
      image: gl.getUniformLocation(compositeProgram, 'uImage'),
      imageNext: gl.getUniformLocation(compositeProgram, 'uImageNext'),
      resolution: gl.getUniformLocation(compositeProgram, 'uResolution'),
      light: gl.getUniformLocation(compositeProgram, 'uLight'),
      time: gl.getUniformLocation(compositeProgram, 'uTime'),
      peak: gl.getUniformLocation(compositeProgram, 'uPeak'),
      imageAspect: gl.getUniformLocation(compositeProgram, 'uImageAspect'),
      nextAspect: gl.getUniformLocation(compositeProgram, 'uNextAspect'),
      imageReady: gl.getUniformLocation(compositeProgram, 'uImageReady'),
      swap: gl.getUniformLocation(compositeProgram, 'uSwap'),
      intensity: gl.getUniformLocation(compositeProgram, 'uIntensity'),
    },
  };

  /*
    Two pictures: the one on the glass, and the one being written in behind
    the head during a navigation. They swap roles when a pass completes, so
    neither is ever reallocated.

    Loaded after the field is already running, so nothing here delays first
    paint — until a picture arrives the wall is a neutral surface and the
    composition is exactly as it was.
  */
  function makePicture(): WebGLTexture {
    const t = gl!.createTexture()!;
    gl!.bindTexture(gl!.TEXTURE_2D, t);
    gl!.texImage2D(
      gl!.TEXTURE_2D, 0, gl!.RGB, 1, 1, 0, gl!.RGB, gl!.UNSIGNED_BYTE,
      new Uint8Array([214, 222, 230]),
    );
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    return t;
  }

  let pictures = [makePicture(), makePicture()];
  let aspects = [1, 1];
  let imageReady = 0;
  let loadedUrl = '';
  let intensity = Number(canvas.dataset.intensity ?? 1) || 1;

  /** Decode a picture into the given slot. Resolves false if it never arrives. */
  async function loadPicture(url: string, slot: number): Promise<boolean> {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    try {
      await image.decode();
      if (!alive) return false;
      gl!.bindTexture(gl!.TEXTURE_2D, pictures[slot]);
      gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, true);
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGB, gl!.RGB, gl!.UNSIGNED_BYTE, image);
      aspects[slot] = image.naturalWidth / image.naturalHeight;
      return true;
    } catch {
      // No picture. The neutral wall is a complete composition already.
      return false;
    }
  }

  const firstUrl = canvas.dataset.texture;
  if (firstUrl) {
    loadedUrl = firstUrl;
    loadPicture(firstUrl, 0).then((ok) => {
      if (ok) imageReady = 1;
    });
  }

  /*
    A navigation. The head runs once from the top edge to the bottom and the
    new picture is written in behind it, then the two slots swap roles.
    `swap` is the head's progress; 0 means idle.
  */
  const SWAP_MS = 1150;
  /**
   * Where the still frame parks the head when motion is reduced: partway
   * down its preview travel, so the bar is a composed element of the
   * picture rather than clipped against the top edge.
   */
  const STILL_TIME = 2.2;

  let swap = 0;
  let swapStart = 0;
  let swapping = false;
  const reduced = prefersReducedMotion();

  /** The pass is over: the incoming picture becomes the one on the glass. */
  function finishSwap() {
    pictures = [pictures[1], pictures[0]];
    aspects = [aspects[1], aspects[0]];
    swap = 0;
    swapping = false;
  }

  async function scanTo(url: string) {
    if (!alive || !url || url === loadedUrl || swapping) return;
    const ok = await loadPicture(url, 1);
    if (!ok || !alive) return;

    loadedUrl = url;
    if (!imageReady) imageReady = 1;

    // No pass to watch when motion is reduced — just change what is there.
    if (reduced) {
      finishSwap();
      drawComposite(STILL_TIME);
      return;
    }

    swapping = true;
    swapStart = performance.now();
  }

  /* The router asks for a pass; the field decides how to run it. */
  document.addEventListener('field:scan', (event) => {
    const url = (event as CustomEvent<{ texture?: string }>).detail?.texture;
    if (url) void scanTo(url);
  });

  /*
    Every navigation, including the first. The field persists across swaps,
    so its own attributes are stale by definition — the document carries the
    current values in <meta> and this reads them from there.

    On the first load the URL already matches and scanTo returns immediately,
    so arriving on a page never costs a pass.
  */
  const meta = (name: string) =>
    document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content ?? '';

  document.addEventListener('astro:page-load', () => {
    const next = Number(meta('scan-intensity'));
    if (Number.isFinite(next) && next > 0) intensity = next;

    // Keep the CSS still in step too, for the case where WebGL never started.
    const texture = meta('scan-texture');
    const plate = document.querySelector<HTMLElement>('[data-plate]');
    if (plate && texture) plate.style.backgroundImage = `url(${texture})`;

    if (texture) void scanTo(texture);
  });

  // Some drivers require a bound vertex array even when drawing without
  // attributes, which is what gl_VertexID lets us do.
  gl.bindVertexArray(gl.createVertexArray());

  let alive = true;
  let targets: Array<{ texture: WebGLTexture; framebuffer: WebGLFramebuffer }> = [];
  let traceWidth = 0;
  let traceHeight = 0;
  let scale = 1;

  const pointer = { x: 0.5, y: 0.62 };
  const previousPointer = { x: 0.5, y: 0.62 };
  let moved = false;
  let seen = false;

  function releaseTargets() {
    for (const target of targets) {
      gl!.deleteTexture(target.texture);
      gl!.deleteFramebuffer(target.framebuffer);
    }
    targets = [];
  }

  function resize(): boolean {
    const dpr = Math.min(devicePixelRatio || 1, MAX_DPR) * scale;
    const width = Math.max(1, Math.round(innerWidth * dpr));
    const height = Math.max(1, Math.round(innerHeight * dpr));

    canvas.width = width;
    canvas.height = height;

    traceWidth = Math.max(2, Math.min(TRACE_MAX, Math.round(width / TRACE_DIVISOR)));
    traceHeight = Math.max(2, Math.min(TRACE_MAX, Math.round(height / TRACE_DIVISOR)));

    releaseTargets();
    const a = makeTraceTarget(gl!, traceWidth, traceHeight);
    const b = makeTraceTarget(gl!, traceWidth, traceHeight);
    if (!a || !b) return false;
    targets = [a, b];
    return true;
  }

  if (!resize()) return;

  /** Draw one composite frame to the canvas. */
  function drawComposite(seconds: number) {
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
    gl!.viewport(0, 0, canvas.width, canvas.height);
    gl!.useProgram(compositeProgram);

    gl!.activeTexture(gl!.TEXTURE0);
    gl!.bindTexture(gl!.TEXTURE_2D, targets[0].texture);
    gl!.uniform1i(u.composite.trace, 0);

    gl!.activeTexture(gl!.TEXTURE1);
    gl!.bindTexture(gl!.TEXTURE_2D, pictures[0]);
    gl!.uniform1i(u.composite.image, 1);

    gl!.activeTexture(gl!.TEXTURE2);
    gl!.bindTexture(gl!.TEXTURE_2D, pictures[1]);
    gl!.uniform1i(u.composite.imageNext, 2);

    gl!.uniform2f(u.composite.resolution, canvas.width, canvas.height);
    gl!.uniform2f(u.composite.light, 0.63, 1 - 0.33);
    gl!.uniform1f(u.composite.time, seconds);
    /*
      Enough ambient light that the picture is legible where the lamp falls,
      and no more. Everything past that has to be uncovered by hand.
    */
    gl!.uniform1f(u.composite.peak, 0.2);
    gl!.uniform1f(u.composite.imageAspect, aspects[0]);
    gl!.uniform1f(u.composite.nextAspect, aspects[1]);
    gl!.uniform1f(u.composite.imageReady, imageReady);
    gl!.uniform1f(u.composite.swap, swap);
    gl!.uniform1f(u.composite.intensity, intensity);

    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
  }

  function ready() {
    canvas.dataset.ready = '';
  }

  /*
    Reduced motion: draw exactly one frame and stop. The visitor still gets
    the light, the grain and the dither — just none of the movement, and no
    animation frame loop running behind the page.
  */
  if (reduced) {
    drawComposite(STILL_TIME);
    ready();
    return;
  }

  let raf = 0;
  let last = performance.now();
  let elapsed = 0;
  let frames = 0;
  let sampled = 0;
  let sampleTotal = 0;
  let downscaled = false;

  function teardown() {
    alive = false;
    cancelAnimationFrame(raf);
    delete canvas.dataset.ready;
    releaseTargets();
    gl!.deleteProgram(traceProgram);
    gl!.deleteProgram(compositeProgram);
    removeEventListener('pointermove', onPointerMove);
    removeEventListener('touchmove', onTouchMove);
    removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    // The CSS still underneath is untouched, so the page simply keeps it.
    canvas.remove();
  }

  function frame(now: number) {
    if (!alive) return;

    const dt = Math.min(now - last, 50);
    last = now;
    elapsed += dt;
    frames += 1;

    // ── Trace pass ───────────────────────────────────────────────────────
    const decay = Math.pow(0.5, dt / 1000 / DECAY_HALF_LIFE);

    gl!.bindFramebuffer(gl!.FRAMEBUFFER, targets[1].framebuffer);
    gl!.viewport(0, 0, traceWidth, traceHeight);
    gl!.useProgram(traceProgram);

    gl!.activeTexture(gl!.TEXTURE0);
    gl!.bindTexture(gl!.TEXTURE_2D, targets[0].texture);
    gl!.uniform1i(u.trace.prev, 0);
    gl!.uniform2f(u.trace.from, previousPointer.x, previousPointer.y);
    gl!.uniform2f(u.trace.to, pointer.x, pointer.y);
    gl!.uniform1f(u.trace.strength, moved && seen ? 1 : 0);
    gl!.uniform1f(u.trace.decay, decay);
    gl!.uniform1f(u.trace.aspect, traceWidth / traceHeight);

    gl!.drawArrays(gl!.TRIANGLES, 0, 3);

    previousPointer.x = pointer.x;
    previousPointer.y = pointer.y;
    moved = false;

    targets.reverse();

    /*
      Drive the write head across a navigation. Easing at both ends so the
      pass starts and stops like a mechanism rather than a wipe.
    */
    if (swapping) {
      const k = Math.min(1, (now - swapStart) / SWAP_MS);
      swap = k * k * (3 - 2 * k);
      if (k >= 1) finishSwap();
    }

    // ── Composite pass ───────────────────────────────────────────────────
    drawComposite(elapsed / 1000);

    if (frames === 1) ready();

    /*
      Frame-time sampling. If the device cannot hold this comfortably we
      drop resolution once, and if that is still not enough we hand the
      page back to the CSS still rather than letting it stutter.
    */
    if (frames > SAMPLE_SKIP && sampled < SAMPLE_SIZE) {
      sampleTotal += dt;
      sampled += 1;

      if (sampled === SAMPLE_SIZE) {
        const mean = sampleTotal / SAMPLE_SIZE;
        if (mean > SLOW_MS) {
          if (downscaled) {
            teardown();
            return;
          }
          downscaled = true;
          scale = 0.7;
          if (!resize()) {
            teardown();
            return;
          }
          sampled = 0;
          sampleTotal = 0;
        }
      }
    }

    raf = requestAnimationFrame(frame);
  }

  // ── Input ──────────────────────────────────────────────────────────────
  // Listened for on the window rather than the canvas, so the trace follows
  // the pointer over text too and the canvas can stay pointer-events: none.

  function setPointer(clientX: number, clientY: number) {
    const x = clientX / innerWidth;
    const y = 1 - clientY / innerHeight;

    if (!seen) {
      // Start the stroke where the pointer is, not from the centre.
      previousPointer.x = x;
      previousPointer.y = y;
      seen = true;
    }

    pointer.x = x;
    pointer.y = y;
    moved = true;
  }

  function onPointerMove(event: PointerEvent) {
    setPointer(event.clientX, event.clientY);
  }

  function onTouchMove(event: TouchEvent) {
    const touch = event.touches[0];
    if (touch) setPointer(touch.clientX, touch.clientY);
  }

  let resizeTimer = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (alive && !resize()) teardown();
    }, 150);
  }

  function onVisibility() {
    if (!alive) return;
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  addEventListener('pointermove', onPointerMove, { passive: true });
  addEventListener('touchmove', onTouchMove, { passive: true });
  addEventListener('resize', onResize, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);

  // A lost context is not recoverable here; fall back rather than freeze.
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    teardown();
  });

  raf = requestAnimationFrame(frame);
}
