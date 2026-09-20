import * as THREE from '/assets/js/vendor/three.module.js';

const container = document.getElementById('tensor-bg');
if (container) init();

function init() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = matchMedia('(max-width: 768px)').matches;

  const FOV = 50, CAM_Z = 18, SPACING = 1.1;

  // --- Cluster layout ------------------------------------------------------
  // Several lattices instead of one big one centered on the text.
  // Each cluster is anchored to a screen position in NDC coordinates
  // (x: -1 left .. +1 right, y: -1 bottom .. +1 top) chosen to steer
  // clear of the middle text column, and has its own size, color,
  // idle spin, and ripple so they all move independently. Tune to taste.
  const LAYOUT = isMobile
    ? [{
        ndc: [-0.3, 0.20], n: 7, color: 0xf472b6,       // lone tensor: off-center left, smaller
        spinAxis: [0.3, 1, 0.2], spinSpeed: 0.10,
        waveFreq: 0.7, waveAmp: 0.20, waveSpeed: 1.8,
      }]
    : [
        {
          ndc: [-0.70,  0.30], n: 6, color: 0x22d3ee,   // cyan  (--accent)
          spinAxis: [0, 1, 0], spinSpeed: 0.15,
          waveFreq: 0.8, waveAmp: 0.18, waveSpeed: 2.0,
        },
        {
          ndc: [ 0.64, -0.12], n: 7, color: 0xf472b6,   // pink  (--accent-warm)
          spinAxis: [1, 0, 0], spinSpeed: -0.11,
          waveFreq: 1.1, waveAmp: 0.15, waveSpeed: 1.6,
        },
        {
          ndc: [-0.55, -0.48], n: 4, color: 0xa78bfa,   // violet
          spinAxis: [0.4, 0.8, 0.3], spinSpeed: 0.18,
          waveFreq: 0.6, waveAmp: 0.22, waveSpeed: 2.4,
        },
      ];

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight);
  container.appendChild(renderer.domElement);
  container.classList.add('active');

  // Map a screen position (NDC) to a world offset on the z=0 plane.
  const halfH = () => Math.tan((FOV / 2) * Math.PI / 180) * CAM_Z;
  const halfW = () => halfH() * camera.aspect;
  const ndcToWorld = ([nx, ny]) => [nx * halfW(), ny * halfH(), 0];

  const X_AXIS = new THREE.Vector3(1, 0, 0);
  const Y_AXIS = new THREE.Vector3(0, 1, 0);
  const qIdle = new THREE.Quaternion();
  const qTilt = new THREE.Quaternion();
  const qTmp = new THREE.Quaternion();

  const clusters = LAYOUT.map((spec) => {
    const n = spec.n;
    const count = n * n * n;
    const positions = new Float32Array(count * 3);
    const base = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const half = (n - 1) / 2;
    let i = 0;
    for (let x = 0; x < n; x++)
      for (let y = 0; y < n; y++)
        for (let z = 0; z < n; z++) {
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
      color: spec.color, size: 0.18, transparent: true, opacity: 0.9,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.position.set(...ndcToWorld(spec.ndc));
    scene.add(points);
    return {
      points, base, vel, count, n, ndc: spec.ndc,
      axis: new THREE.Vector3(...spec.spinAxis).normalize(),
      spinSpeed: spec.spinSpeed,
      spinAngle: 0,
      waveFreq: spec.waveFreq, waveAmp: spec.waveAmp, waveSpeed: spec.waveSpeed,
      tiltX: 0, tiltY: 0,
      scale: 1, scaleVel: 0,   // hover expand (springs to HOVER_SCALE while hovered)
      cx: 0, cy: 0, hoverR: 0, // screen center + hover radius (see layoutScreen)
    };
  });

  // Pointer in screen pixels (far off-screen initially so nothing is hovered).
  const pointer = { x: -1e4, y: -1e4 };
  addEventListener('pointermove', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  }, { passive: true });

  // Screen-space center + bounding radius for each cluster (hover detection).
  function layoutScreen() {
    const w = innerWidth, h = innerHeight;
    for (const c of clusters) {
      c.cx = (c.ndc[0] + 1) / 2 * w;
      c.cy = (1 - c.ndc[1]) / 2 * h;
      const halfDiag = ((c.n - 1) / 2) * SPACING * Math.sqrt(3);
      c.hoverR = (halfDiag / halfW()) * (w / 2);
    }
  }
  layoutScreen();

  const stiffness = 0.02, damping = 0.9; // spring-damper -> control-system feel
  const HOVER_SCALE = 1.12;                // how much a hovered tensor grows
  const SCALE_STIFF = 0.08, SCALE_DAMP = 0.82; // under-damped -> bounce on release
  let running = !document.hidden;
  let lastT = performance.now();
  document.addEventListener('visibilitychange', () => { running = !document.hidden; });
  new IntersectionObserver(([e]) => { running = e.isIntersecting && !document.hidden; }, { threshold: 0 }).observe(container);

  function step() {
    const now = performance.now();
    const dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;
    if (running) {
      const t = now * 0.001;
      for (const c of clusters) {
        // Idle: every cluster spins slowly around its own axis, at its own speed.
        c.spinAngle += c.spinSpeed * dt;
        // Hover: only the cluster under the pointer tilts, toward the
        // cursor's offset within its bounding circle; others rest.
        const dx = pointer.x - c.cx, dy = pointer.y - c.cy;
        const hovered = Math.hypot(dx, dy) <= c.hoverR;
        const targetY = hovered ? THREE.MathUtils.clamp(dx / c.hoverR, -1, 1) * 0.9 : 0; // yaw
        const targetX = hovered ? -THREE.MathUtils.clamp(dy / c.hoverR, -1, 1) * 0.9 : 0; // pitch
        c.tiltX += (targetX - c.tiltX) * 0.08;
        c.tiltY += (targetY - c.tiltY) * 0.08;
        // Hover expand: spring toward HOVER_SCALE while hovered, 1 at rest;
        // under-damped so releasing bounces a little before settling.
        const targetS = hovered ? HOVER_SCALE : 1;
        c.scaleVel = (c.scaleVel + (targetS - c.scale) * SCALE_STIFF) * SCALE_DAMP;
        c.scale += c.scaleVel;
        const s = c.scale;
        qIdle.setFromAxisAngle(c.axis, c.spinAngle);
        qTilt.setFromAxisAngle(Y_AXIS, c.tiltY).multiply(qTmp.setFromAxisAngle(X_AXIS, c.tiltX));
        c.points.quaternion.copy(qIdle).multiply(qTilt);
        // Ripple: each cluster has its own wave frequency / amplitude / speed.
        const pos = c.points.geometry.attributes.position.array;
        for (let n = 0; n < c.count; n++) {
          const ix = n * 3;
          const bx0 = c.base[ix], by0 = c.base[ix + 1], bz0 = c.base[ix + 2];
          const bx = bx0 * s, by = by0 * s, bz = bz0 * s; // rest position grows with hover scale
          const r = Math.hypot(bx0, by0, bz0);
          const wave = Math.sin(r * c.waveFreq - t * c.waveSpeed) * c.waveAmp / (1 + r * 0.15);
          c.vel[ix] = (c.vel[ix] + (bx + wave - pos[ix]) * stiffness) * damping;
          c.vel[ix + 1] = (c.vel[ix + 1] + (by + wave - pos[ix + 1]) * stiffness) * damping;
          c.vel[ix + 2] = (c.vel[ix + 2] + (bz + wave - pos[ix + 2]) * stiffness) * damping;
          pos[ix] += c.vel[ix];
          pos[ix + 1] += c.vel[ix + 1];
          pos[ix + 2] += c.vel[ix + 2];
        }
        c.points.geometry.attributes.position.needsUpdate = true;
      }
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
    // Re-anchor clusters so they stay in their screen zones.
    for (const c of clusters) c.points.position.set(...ndcToWorld(c.ndc));
    layoutScreen();
  });
}
