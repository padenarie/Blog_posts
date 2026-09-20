import * as THREE from '/assets/js/vendor/three.module.js';

const container = document.getElementById('tensor-bg');
if (container) init();

function init() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = matchMedia('(max-width: 768px)').matches;
  const N = isMobile ? 6 : 9;         // lattice nodes per axis
  const SPACING = 1.5;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 0, 18);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight);
  container.appendChild(renderer.domElement);
  container.classList.add('active');

  const count = N * N * N;
  const positions = new Float32Array(count * 3);
  const base = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  let i = 0;
  const half = (N - 1) / 2;
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++)
      for (let z = 0; z < N; z++) {
        base[i * 3] = (x - half) * SPACING;
        base[i * 3 + 1] = (y - half) * SPACING;
        base[i * 3 + 2] = (z - half) * SPACING;
        positions[i * 3] = base[i * 3];
        positions[i * 3 + 1] = base[i * 3 + 1];
        positions[i * 3 + 2] = base[i * 3 + 2];
        i++;
      }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x22d3ee, size: 0.18, transparent: true, opacity: 0.9,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  const stiffness = 0.02, damping = 0.9; // spring-damper -> control-system feel
  let running = !document.hidden;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; });
  new IntersectionObserver(([e]) => { running = e.isIntersecting && !document.hidden; }, { threshold: 0 }).observe(container);

  function step() {
    if (running) {
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      points.rotation.y += (mouse.x * 0.6 - points.rotation.y) * 0.04;
      points.rotation.x += (-mouse.y * 0.6 - points.rotation.x) * 0.04;
      const t = performance.now() * 0.001;
      for (let n = 0; n < count; n++) {
        const ix = n * 3;
        const bx = base[ix], by = base[ix + 1], bz = base[ix + 2];
        const r = Math.hypot(bx, by, bz);
        const wave = Math.sin(r * 0.8 - t * 2) * 0.18 / (1 + r * 0.15);
        vel[ix] = (vel[ix] + (bx + wave - positions[ix]) * stiffness) * damping;
        vel[ix + 1] = (vel[ix + 1] + (by + wave - positions[ix + 1]) * stiffness) * damping;
        vel[ix + 2] = (vel[ix + 2] + (bz + wave - positions[ix + 2]) * stiffness) * damping;
        positions[ix] += vel[ix];
        positions[ix + 1] += vel[ix + 1];
        positions[ix + 2] += vel[ix + 2];
      }
      geo.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
    }
    requestAnimationFrame(step);
  }

  if (reduced) {
    renderer.render(scene, camera); // single static frame
  } else {
    requestAnimationFrame(step);
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}
