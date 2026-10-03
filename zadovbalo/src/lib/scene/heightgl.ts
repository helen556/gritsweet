"use client";

/**
 * WebGL2-рендер поля висот: попіксельне освітлення з білінійною вибіркою висот (без розмитих «пікселів»),
 * альбедо з фото, дрібний рельєф, затінення западин, відблиск і тінь, що падає на стіл.
 * Висоти — у текстурі R32F (лінійна фільтрація вручну в шейдері: працює без розширень).
 * Якщо WebGL2 недоступний або контекст втрачено — повертаємо null, сцена бере спрощений варіант.
 */

export interface HeightGLOptions {
  /** Сітка висот. */
  gw: number;
  gh: number;
  /** Альбедо: фото (пісок) або null — тоді однотонний колір (глина). */
  albedo: TexImageSource | null;
  baseColor?: [number, number, number];
  /** Тайловий дрібний рельєф (сірий, 128 — нуль). */
  detail?: TexImageSource | null;
  detailScale?: number;
  detailStrength?: number;
  /** Маска, де діє рельєф (1) і де лишається фото як є (0). */
  mask?: TexImageSource | null;
  /** Напрям світла (до світла), нормалізований. */
  light: [number, number, number];
  /** Висоти в пікселях альбедо: множник для нахилів. */
  relief: number;
  specular: number;
  shininess: number;
  /** Глина: де висоти > 0 — матеріал, решта прозора, з тінню на стіл. */
  solid: boolean;
  /** Сила затінення западин. */
  ao?: number;
}

const VS = `#version 300 es
in vec2 p;
out vec2 uv;
void main() { uv = p * 0.5 + 0.5; uv.y = 1.0 - uv.y; gl_Position = vec4(p, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 o;
uniform sampler2D H;
uniform sampler2D A;
uniform sampler2D D;
uniform sampler2D M;
uniform vec2 G;          // розмір сітки
uniform vec2 px;         // розмір пікселя полотна в uv
uniform vec3 L;
uniform float relief;
uniform float spec;
uniform float shin;
uniform float detailScale;
uniform float detailStrength;
uniform vec3 baseColor;
uniform int hasAlbedo;
uniform int hasDetail;
uniform int hasMask;
uniform int solid;
uniform float aoK;

float h(vec2 t) {
  vec2 g = t * G - 0.5;
  vec2 i = floor(g);
  vec2 f = g - i;
  vec2 m = G - 1.0;
  float a = texelFetch(H, ivec2(clamp(i, vec2(0.0), m)), 0).r;
  float b = texelFetch(H, ivec2(clamp(i + vec2(1.0, 0.0), vec2(0.0), m)), 0).r;
  float c = texelFetch(H, ivec2(clamp(i + vec2(0.0, 1.0), vec2(0.0), m)), 0).r;
  float d = texelFetch(H, ivec2(clamp(i + vec2(1.0, 1.0), vec2(0.0), m)), 0).r;
  vec2 s = f * f * (3.0 - 2.0 * f); // мʼякша інтерполяція — без «гранчастості»
  return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
}

void main() {
  vec2 e = 1.0 / G;
  float c = h(uv);
  float hl = h(uv - vec2(e.x, 0.0));
  float hr = h(uv + vec2(e.x, 0.0));
  float hu = h(uv - vec2(0.0, e.y));
  float hd = h(uv + vec2(0.0, e.y));
  vec3 n = normalize(vec3((hl - hr) * relief * 0.5, (hu - hd) * relief * 0.5, 1.0));
  vec3 det = vec3(0.0);
  float dAlb = 0.0;
  if (hasDetail == 1) {
    vec2 dt = uv * detailScale * G / 64.0;
    float d0 = texture(D, dt).r;
    float dx = texture(D, dt + vec2(1.0 / 512.0, 0.0)).r - d0;
    float dy = texture(D, dt + vec2(0.0, 1.0 / 512.0)).r - d0;
    det = vec3(-dx, -dy, 0.0) * detailStrength;
    dAlb = (d0 - 0.5);
  }
  float mask = hasMask == 1 ? texture(M, uv).r : 1.0;
  n = normalize(n + det * mask);
  float diff = max(dot(n, L), 0.0) / max(L.z, 0.2);
  // Западини темніші (лапласіан).
  float lap = hl + hr + hu + hd - 4.0 * c;
  float ao = clamp(1.0 - lap * aoK, 0.72, 1.06);
  vec3 Hh = normalize(L + vec3(0.0, 0.0, 1.0));
  float sp = pow(max(dot(n, Hh), 0.0), shin) * spec;
  vec3 alb = hasAlbedo == 1 ? texture(A, uv).rgb : baseColor * (1.0 + dAlb * 0.18);
  float shade = mix(1.0, diff * ao, mask);
  vec3 col = alb * shade + sp * mask;
  if (solid == 1) {
    float presence = smoothstep(0.15, 1.2, c);
    // Тінь на стіл: чи затуляє матеріал світло (кілька кроків у бік світла).
    float sh = 0.0;
    for (int k = 1; k <= 6; k++) {
      vec2 q = uv + L.xy * e * float(k) * 3.0;
      sh = max(sh, smoothstep(0.2, 6.0, h(q) - float(k) * 0.9));
    }
    vec4 table = vec4(0.0, 0.0, 0.0, sh * 0.55);
    o = mix(table, vec4(col, 1.0), presence);
  } else {
    o = vec4(col, 1.0);
  }
}`;

export interface HeightGL {
  upload(data: Float32Array): void;
  /** Оновити лише рядки y0..y1 (дешевше). */
  uploadRows(data: Float32Array, y0: number, y1: number): void;
  render(): void;
  resize(w: number, h: number): void;
  dispose(): void;
  lost(): boolean;
}

function tex(gl: WebGL2RenderingContext, unit: number, src: TexImageSource, repeat: boolean, single = false) {
  const t = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, single ? gl.R8 : gl.RGBA, single ? gl.RED : gl.RGBA, gl.UNSIGNED_BYTE, src);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  return t;
}

export function createHeightGL(canvas: HTMLCanvasElement, opt: HeightGLOptions): HeightGL | null {
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext("webgl2", { premultipliedAlpha: false, alpha: true, antialias: false, preserveDrawingBuffer: false });
  } catch {
    gl = null;
  }
  if (!gl) return null;
  const sh = (type: number, src: string) => {
    const s = gl!.createShader(type)!;
    gl!.shaderSource(s, src);
    gl!.compileShader(s);
    if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) throw new Error(gl!.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  let prog: WebGLProgram;
  try {
    prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link");
  } catch {
    return null;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const hTex = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, hTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, opt.gw, opt.gh, 0, gl.RED, gl.FLOAT, new Float32Array(opt.gw * opt.gh));
  const textures = [hTex];
  if (opt.albedo) textures.push(tex(gl, 1, opt.albedo, false));
  if (opt.detail) textures.push(tex(gl, 2, opt.detail, true));
  if (opt.mask) textures.push(tex(gl, 3, opt.mask, false));

  const u = (n: string) => gl!.getUniformLocation(prog, n);
  gl.uniform1i(u("H"), 0);
  gl.uniform1i(u("A"), 1);
  gl.uniform1i(u("D"), 2);
  gl.uniform1i(u("M"), 3);
  gl.uniform2f(u("G"), opt.gw, opt.gh);
  gl.uniform3f(u("L"), ...opt.light);
  gl.uniform1f(u("relief"), opt.relief);
  gl.uniform1f(u("spec"), opt.specular);
  gl.uniform1f(u("shin"), opt.shininess);
  gl.uniform1f(u("detailScale"), opt.detailScale ?? 1);
  gl.uniform1f(u("detailStrength"), opt.detailStrength ?? 0);
  gl.uniform3f(u("baseColor"), ...(opt.baseColor ?? [0.7, 0.7, 0.7]));
  gl.uniform1i(u("hasAlbedo"), opt.albedo ? 1 : 0);
  gl.uniform1i(u("hasDetail"), opt.detail ? 1 : 0);
  gl.uniform1i(u("hasMask"), opt.mask ? 1 : 0);
  gl.uniform1i(u("solid"), opt.solid ? 1 : 0);
  gl.uniform1f(u("aoK"), opt.ao ?? 0.02);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  let isLost = false;
  const onLost = (e: Event) => {
    e.preventDefault();
    isLost = true;
  };
  canvas.addEventListener("webglcontextlost", onLost);

  return {
    upload(data) {
      if (isLost) return;
      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, hTex);
      gl!.texSubImage2D(gl!.TEXTURE_2D, 0, 0, 0, opt.gw, opt.gh, gl!.RED, gl!.FLOAT, data);
    },
    uploadRows(data, y0, y1) {
      if (isLost) return;
      const a = Math.max(0, Math.floor(y0));
      const b = Math.min(opt.gh - 1, Math.ceil(y1));
      if (b < a) return;
      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, hTex);
      gl!.texSubImage2D(gl!.TEXTURE_2D, 0, 0, a, opt.gw, b - a + 1, gl!.RED, gl!.FLOAT, data.subarray(a * opt.gw, (b + 1) * opt.gw));
    },
    render() {
      if (isLost) return;
      gl!.viewport(0, 0, canvas.width, canvas.height);
      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
    },
    resize(w, h) {
      canvas.width = w;
      canvas.height = h;
    },
    dispose() {
      canvas.removeEventListener("webglcontextlost", onLost);
      if (isLost) return;
      for (const t of textures) gl!.deleteTexture(t);
      gl!.deleteBuffer(buf);
      gl!.deleteProgram(prog);
      gl!.getExtension("WEBGL_lose_context")?.loseContext();
    },
    lost: () => isLost || gl!.isContextLost(),
  };
}
