// figures.js — in-post interactive figures. Loaded on post pages.
const registry = new Map();

export function registerFigure(type, init) {
  registry.set(type, init);
}

let threePromise;
async function three() {
  threePromise ??= import('/assets/js/vendor/three.module.js');
  return threePromise;
}

// --- built-in: tensor-wave (bounded 3D lattice in the .fig box) ---
registerFigure('tensor-wave', async (el, cfg = {}) => {
  const THREE = await three();
  const freq = Number(cfg.freq) || 1;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const N = 7, SPACING = 1.2;

  const scene = new THREE.Scene();
  const w = el.clientWidth || 320, h = el.clientHeight || 320;
  const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
  camera.position.set(0, 0, 11);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h);
  el.appendChild(renderer.domElement);

  const count = N * N * N;
  const positions = new Float32Array(count * 3);
  const base = new Float32Array(count * 3);
  let i = 0; const half = (N - 1) / 2;
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++)
      for (let z = 0; z < N; z++) {
        base[i * 3] = (x - half) * SPACING;
        base[i * 3 + 1] = (y - half) * SPACING;
        base[i * 3 + 2] = (z - half) * SPACING;
        positions.set(base.subarray(i * 3, i * 3 + 3), i * 3);
        i++;
      }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0x22d3ee, size: 0.22, transparent: true, opacity: 0.95 });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);

  function draw(t) {
    if (!reduced) {
      const time = (t * 0.001) * freq;
      for (let n = 0; n < count; n++) {
        const ix = n * 3;
        const r = Math.hypot(base[ix], base[ix + 1], base[ix + 2]);
        const wv = Math.sin(r * 0.9 - time * 2) * 0.4 / (1 + r * 0.2);
        positions[ix + 1] = base[ix + 1] + wv;
      }
      geo.attributes.position.needsUpdate = true;
      pts.rotation.y = time * 0.3;
    }
    renderer.render(scene, camera);
    if (!reduced) requestAnimationFrame(draw);
  }
  reduced ? renderer.render(scene, camera) : requestAnimationFrame(draw);
});

function initAll() {
  document.querySelectorAll('[data-figure]').forEach((el) => {
    const type = el.dataset.figure;
    let cfg = {};
    try { cfg = el.dataset.config ? JSON.parse(el.dataset.config) : {}; } catch {}
    const fn = registry.get(type);
    if (fn) fn(el, cfg);
    else console.warn(`[figures] unknown data-figure type: ${type}`);
  });
}
document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', initAll)
  : initAll();
