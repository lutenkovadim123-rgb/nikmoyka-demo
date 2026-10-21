/* Медь + частицы: частицы слетаются точно в контур логотипа, затем проявляется сам логотип в полном качестве.
   Курсор «стирает» логотип в точке — под ним снова видны частицы, которые расходятся. Прокрутка рассыпает их. */
import * as THREE from 'three';

const NIK = window.NIK || { reduced: false, coarse: false, onScroll() {} };
const stage = document.querySelector('.hero__stage');
const mark = document.querySelector('.mark');
const img = mark.querySelector('.mark__img');

function showStatic() { mark.classList.add('ready'); }

function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

async function main() {
  if (NIK.reduced) { showStatic(); return; }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, premultipliedAlpha: false, powerPreference: 'high-performance' });
  } catch (e) { showStatic(); return; }
  const dpr = Math.min(window.devicePixelRatio || 1, NIK.coarse ? 1.5 : 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = 'dust';
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10); // в пикселях экрана, y вниз со знаком минус

  // Точки берутся из логотипа в исходном размере: одна частица ≈ один пиксель контура.
  const src = await loadImage('logo.webp');
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(src, 0, 0);
  const data = cx.getImageData(0, 0, cv.width, cv.height).data;
  const cand = [];
  for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
    const i = (y * cv.width + x) * 4;
    if (data[i + 3] > 120) cand.push(x, y, i);
  }
  const total = cand.length / 3;
  const N = Math.min(NIK.coarse ? 18000 : 42000, total);
  const uv = new Float32Array(N * 2), start = new Float32Array(N * 2), color = new Float32Array(N * 3), seed = new Float32Array(N * 4);
  const step = total / N;
  for (let k = 0; k < N; k++) {
    const j = Math.floor(k * step + Math.random() * step) * 3;
    const x = cand[j], y = cand[j + 1], i = cand[j + 2];
    uv[k * 2] = (x + Math.random()) / cv.width;
    uv[k * 2 + 1] = (y + Math.random()) / cv.height;
    // старт: облако справа за кадром и сверху — как пыль в луче прожектора
    start[k * 2] = 0.55 + Math.random() * 0.9;
    start[k * 2 + 1] = -0.3 + Math.random() * 1.1;
    const b = 1.12;
    color[k * 3] = Math.min(1, data[i] / 255 * b * 1.05);
    color[k * 3 + 1] = Math.min(1, data[i + 1] / 255 * b);
    color[k * 3 + 2] = Math.min(1, data[i + 2] / 255 * b * 0.95);
    seed[k * 4] = Math.random(); seed[k * 4 + 1] = Math.random(); seed[k * 4 + 2] = Math.random();
    seed[k * 4 + 3] = x / cv.width; // порядок сборки слева направо, как у линии крыши
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute('aUV', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('aStart', new THREE.BufferAttribute(start, 2));
  geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));

  const uniforms = {
    uT: { value: 0 }, uP: { value: 0 }, uRect: { value: new THREE.Vector4() }, uView: { value: new THREE.Vector2(1, 1) },
    uMouse: { value: new THREE.Vector2(-9999, -9999) }, uR: { value: 90 }, uScatter: { value: 0 },
    uSize: { value: 1.6 * dpr }, uAlpha: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthTest: false, depthWrite: false,
    vertexShader: `
      attribute vec2 aUV; attribute vec2 aStart; attribute vec3 aColor; attribute vec4 aSeed;
      uniform float uT, uP, uR, uScatter, uSize; uniform vec4 uRect; uniform vec2 uView, uMouse;
      varying vec3 vC; varying float vA, vK;
      float ease(float x){ return 1. - pow(1. - x, 4.); }
      void main(){
        vec2 tgt = uRect.xy + aUV * uRect.zw;
        vec2 st = aStart * uView;
        float d = aSeed.w * .6 + aSeed.x * .3;
        float k = ease(clamp((uP - d) / 1.1, 0., 1.));
        // дуга полёта: частицы заходят сверху, а не по прямой
        vec2 p = mix(st, tgt, k);
        p.y -= sin(k * 3.14159) * 120. * (aSeed.y - .3);
        // курсор раздвигает
        vec2 dm = p - uMouse; float dl = length(dm);
        float f = exp(-(dl * dl) / (uR * uR));
        p += normalize(dm + 1e-3) * f * uR * .75 * k;
        // прокрутка рассыпает вверх и в стороны
        vec2 dir = normalize(vec2(aSeed.x - .5, -(aSeed.y * .9 + .25)));
        p += dir * uScatter * (180. + aSeed.z * 520.);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p.x, -p.y, 0., 1.);
        gl_PointSize = uSize * (1. + (1. - k) * 1.2 + f * .6);
        float tw = .8 + .2 * sin(uT * 2.4 + aSeed.x * 50.);
        vC = aColor * tw * (1. + f * .5);
        vA = mix(.25, 1., k) * (1. - uScatter * .7);
        vK = k;
      }`,
    fragmentShader: `
      uniform float uAlpha; varying vec3 vC; varying float vA, vK;
      void main(){
        vec2 c = gl_PointCoord - .5; float r = dot(c, c);
        if (r > .25) discard;
        gl_FragColor = vec4(vC, vA * uAlpha * smoothstep(.25, .06, r));
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  function layout() {
    const s = stage.getBoundingClientRect();
    const r = img.getBoundingClientRect();
    renderer.setSize(s.width, s.height, false);
    camera.left = 0; camera.right = s.width; camera.top = 0; camera.bottom = -s.height;
    camera.updateProjectionMatrix();
    uniforms.uRect.value.set(r.left - s.left, r.top - s.top, r.width, r.height);
    uniforms.uView.value.set(s.width, s.height);
    uniforms.uR.value = Math.max(60, r.width * 0.13);
  }
  layout();
  window.addEventListener('resize', layout);
  if (img.complete) layout(); else img.addEventListener('load', layout);

  // Курсор: двигаем «окно» в настоящем логотипе и центр расталкивания частиц
  const mT = new THREE.Vector2(-9999, -9999), mC = new THREE.Vector2(-9999, -9999);
  const move = (x, y) => {
    const s = stage.getBoundingClientRect(); mT.set(x - s.left, y - s.top);
  };
  window.addEventListener('pointermove', (e) => move(e.clientX, e.clientY), { passive: true });
  window.addEventListener('pointerleave', () => mT.set(-9999, -9999));
  window.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') mT.set(-9999, -9999); });

  let scrollK = 0;
  NIK.onScroll((y) => {
    scrollK = Math.min(1, Math.max(0, y / (window.innerHeight * 0.85)));
    uniforms.uScatter.value = scrollK;
    mark.style.setProperty('--fade', String(Math.max(0, 1 - scrollK * 3)));
  });

  let visible = true; new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(stage);
  const t0 = performance.now();
  let revealed = false, dirty = true, lastKey = '';
  window.addEventListener('resize', () => { dirty = 8; });
  // после того как частицы сели, кадр рисуется только при движении мыши или прокрутке
  renderer.setAnimationLoop((now) => {
    if (!visible || document.hidden) return;
    const key = mT.x.toFixed(0) + ',' + mT.y.toFixed(0) + ',' + scrollK.toFixed(3);
    if (key !== lastKey) { lastKey = key; dirty = 8; }
    if ((now - t0) / 1000 > 3.6 && mC.distanceTo(mT) < 0.5 && !dirty) return;
    if (dirty) dirty--;
    const t = (now - t0) / 1000;
    uniforms.uT.value = t;
    uniforms.uP.value = Math.min(2.2, Math.max(0, t - 0.35) * 1.15);
    // логотип в полном качестве проявляется, когда частицы почти сели
    if (!revealed && t > 2.3) { revealed = true; mark.classList.add('ready'); }
    if (mC.distanceTo(mT) > 400) mC.copy(mT); else mC.lerp(mT, 0.18);
    uniforms.uMouse.value.copy(mC);
    const r = uniforms.uRect.value;
    mark.style.setProperty('--mx', (mC.x - r.x) + 'px');
    mark.style.setProperty('--my', (mC.y - r.y) + 'px');
    mark.style.setProperty('--mr', (uniforms.uR.value * 1.1) + 'px');
    renderer.render(scene, camera);
  });
}

main().catch(showStatic);
