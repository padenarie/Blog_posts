import * as THREE from '/assets/js/vendor/three.module.js';

const container = document.getElementById('tensor-bg');
if (container) init();

function init() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = matchMedia('(max-width: 768px)').matches;

  const FOV = 50, CAM_Z = 18, SPACING = 1.1;

  // --- Cluster layout ------------------------------------------------------
  // Anchor the clusters in separate corners of the viewport. NDC coordinates
  // run from -1 to +1 on each axis; the center stays clear for the hero copy.
  const LAYOUT = isMobile
    ? [{
        ndc: [0.98, 0.34], n: 5, color: 0x22d3ee,
        spinAxis: [0.3, 1, 0.2], spinSpeed: 0.10,
        waveFreq: 0.7, waveAmp: 0.20, waveSpeed: 0.55,
      }, {
        ndc: [-0.92, -0.78], n: 3, color: 0xf472b6,
        spinAxis: [1, 0.2, 0], spinSpeed: -0.08,
        waveFreq: 1.1, waveAmp: 0.15, waveSpeed: 0.45,
      }]
    : [
        {
          ndc: [0.63, 0.44], n: 6, color: 0x22d3ee,
          spinAxis: [0, 1, 0], spinSpeed: 0.15,
          waveFreq: 0.8, waveAmp: 0.18, waveSpeed: 0.55,
        },
        {
          ndc: [0.70, -0.62], n: 5, color: 0xf472b6,
          spinAxis: [1, 0, 0], spinSpeed: -0.11,
          waveFreq: 1.1, waveAmp: 0.15, waveSpeed: 0.45,
        },
        {
          ndc: [-0.84, -0.64], n: 4, color: 0x22d3ee,
          spinAxis: [0.4, 0.8, 0.3], spinSpeed: 0.18,
          waveFreq: 0.6, waveAmp: 0.22, waveSpeed: 0.65,
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
    const phases = new Float32Array(count);
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
          phases[i] = (x + y + z) * 0.65;
          i++;
        }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(spec.color) },
        uTime: { value: 0 },
        uHover: { value: 0 },
        uPixelRatio: { value: renderer.getPixelRatio() },
      },
      vertexShader: `
        uniform float uTime, uHover, uPixelRatio;
        attribute float aPhase;
        varying float vOpacity;
        void main() {
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          float depth = clamp((viewPosition.z + 22.0) / 8.0, 0.0, 1.0);
          float pulse = 0.5 + 0.5 * sin(uTime * 0.42 - aPhase);
          vOpacity = mix(0.5, 0.98, depth) * (0.86 + 0.14 * pulse) * (1.0 + 0.25 * uHover);
          gl_PointSize = min(14.0, uPixelRatio * mix(4.8, 7.4, depth)
            * (18.0 / -viewPosition.z) * (1.0 + 0.10 * pulse + 0.12 * uHover));
          gl_Position = projectionMatrix * viewPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vOpacity;
        void main() {
          float radius = length(gl_PointCoord - 0.5);
          float core = 1.0 - smoothstep(0.15, 0.5, radius);
          float halo = (1.0 - smoothstep(0.35, 0.5, radius)) * 0.12;
          gl_FragColor = vec4(uColor, (core + halo) * vOpacity);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    points.renderOrder = 1;

    // Draw only a deterministic sample of neighbor edges, keeping the lattice
    // legible without turning the background into a full wireframe.
    const edgePairs = [];
    const index = (x, y, z) => (x * n + y) * n + z;
    for (let x = 0; x < n; x++)
      for (let y = 0; y < n; y++)
        for (let z = 0; z < n; z++) {
          const start = index(x, y, z);
          if (x + 1 < n && (x * 7 + y * 11 + z * 13) % 3 === 0) edgePairs.push(start, index(x + 1, y, z));
          if (y + 1 < n && (x * 7 + y * 11 + z * 13 + 1) % 3 === 0) edgePairs.push(start, index(x, y + 1, z));
          if (z + 1 < n && (x * 7 + y * 11 + z * 13 + 2) % 3 === 0) edgePairs.push(start, index(x, y, z + 1));
        }
    const linePositions = new Float32Array(edgePairs.length * 3);
    for (let e = 0; e < edgePairs.length; e++) {
      const source = edgePairs[e] * 3;
      const target = e * 3;
      linePositions.set(positions.subarray(source, source + 3), target);
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: spec.color, transparent: true, opacity: isMobile ? 0.13 : 0.2,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    const group = new THREE.Group();
    group.position.set(...ndcToWorld(spec.ndc));
    group.add(lines, points);
    scene.add(group);
    return {
      group, points, lines, edgePairs, base, vel, count, n, ndc: spec.ndc,
      axis: new THREE.Vector3(...spec.spinAxis).normalize(),
      spinSpeed: spec.spinSpeed,
      spinAngle: 0,
      waveFreq: spec.waveFreq, waveAmp: spec.waveAmp, waveSpeed: spec.waveSpeed,
      tiltX: 0, tiltY: 0,
      emphasis: 0,
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
        c.emphasis += ((hovered ? 1 : 0) - c.emphasis) * 0.045;
        c.points.material.uniforms.uHover.value = c.emphasis;
        c.points.material.uniforms.uTime.value = t;
        c.lines.material.opacity = (isMobile ? 0.13 : 0.2) + c.emphasis * 0.18;
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
        c.group.quaternion.copy(qIdle).multiply(qTilt);
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
        const linePos = c.lines.geometry.attributes.position.array;
        for (let e = 0; e < c.edgePairs.length; e++) {
          const source = c.edgePairs[e] * 3;
          const target = e * 3;
          linePos[target] = pos[source];
          linePos[target + 1] = pos[source + 1];
          linePos[target + 2] = pos[source + 2];
        }
        c.lines.geometry.attributes.position.needsUpdate = true;
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
    for (const c of clusters) {
      c.group.position.set(...ndcToWorld(c.ndc));
      c.points.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    }
    layoutScreen();
    if (reduced) renderer.render(scene, camera);
  });
}
