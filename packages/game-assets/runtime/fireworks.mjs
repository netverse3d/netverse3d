export const HOLIDAY_SCHEDULE = {
  solar: [
    {
      id: 'new-years-eve',
      name: 'Giao thừa Tết Dương Lịch',
      pattern: '12-31',
      burstRate: 1.2,
    },
    {
      id: 'new-year',
      name: 'Tết Dương Lịch',
      pattern: '01-01',
      burstRate: 1.0,
    },
    {
      id: 'reunification-day',
      name: 'Giải phóng miền Nam (30/4)',
      pattern: '04-30',
      burstRate: 1.0,
    },
    {
      id: 'labor-day',
      name: 'Quốc tế Lao động (1/5)',
      pattern: '05-01',
      burstRate: 0.8,
    },
    {
      id: 'national-day-eve',
      name: 'Đêm trước Quốc khánh (1/9)',
      pattern: '09-01',
      burstRate: 0.9,
    },
    {
      id: 'national-day',
      name: 'Quốc khánh (2/9)',
      pattern: '09-02',
      burstRate: 1.2,
    },
  ],
  lunar: {
    2025: {
      range: ['2025-01-28', '2025-02-02'],
      name: 'Tết Nguyên Đán Ất Tỵ',
    },
    2026: {
      range: ['2026-02-16', '2026-02-20'],
      name: 'Tết Nguyên Đán Bính Ngọ',
    },
    2027: {
      range: ['2027-02-05', '2027-02-09'],
      name: 'Tết Nguyên Đán Đinh Mùi',
    },
    2028: {
      range: ['2028-01-25', '2028-01-30'],
      name: 'Tết Nguyên Đán Mậu Thân',
    },
    2029: {
      range: ['2029-02-12', '2029-02-16'],
      name: 'Tết Nguyên Đán Kỷ Dậu',
    },
    2030: {
      range: ['2030-02-02', '2030-02-06'],
      name: 'Tết Nguyên Đán Canh Tuất',
    },
  },
};

export const FIREWORK_COLORS = [
  [1.0, 0.82, 0.2],
  [1.0, 0.18, 0.38],
  [0.0, 0.9, 1.0],
  [0.85, 0.25, 1.0],
  [0.1, 1.0, 0.45],
  [1.0, 0.52, 0.05],
  [1.0, 0.95, 0.8],
];

function parseDate(input) {
  if (input instanceof Date) return input;
  if (typeof input === 'number') return new Date(input);
  if (typeof input === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      const [year, month, day] = input.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    }
    return new Date(input);
  }
  return new Date();
}

function formatDateISO(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getHolidayEvent(dateInput) {
  const date = parseDate(dateInput);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getUTCFullYear();
  const monthDay = `${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  const iso = formatDateISO(date);

  const solarMatch = HOLIDAY_SCHEDULE.solar.find((item) => item.pattern === monthDay);
  if (solarMatch) {
    return {
      id: solarMatch.id,
      name: solarMatch.name,
      category: 'solar',
      burstRate: solarMatch.burstRate,
    };
  }

  const lunarYear = HOLIDAY_SCHEDULE.lunar[year];
  if (lunarYear) {
    const [start, end] = lunarYear.range;
    if (iso >= start && iso <= end) {
      const isEve = iso === start;
      return {
        id: isEve ? 'tet-giao-thua' : 'tet-nguyen-dan',
        name: isEve ? `Đêm giao thừa ${lunarYear.name}` : lunarYear.name,
        category: 'lunar',
        burstRate: isEve ? 1.5 : 1.1,
      };
    }
  }

  return null;
}

export function isHolidayFireworks(dateInput) {
  return getHolidayEvent(dateInput) !== null;
}

export function createFireworksSystem(THREE, options = {}) {
  const maxParticles = options.maxParticles ?? 2400;
  const gravity = options.gravity ?? 3.8;
  const drag = options.drag ?? 0.965;
  const bloomBoost = options.bloomBoost ?? 2.2;
  const particleSize = options.size ?? 0.45;

  const positions = new Float32Array(maxParticles * 3);
  const colors = new Float32Array(maxParticles * 3);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setDrawRange(0, 0);

  const material = new THREE.PointsMaterial({
    size: particleSize,
    vertexColors: true,
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  const mesh = new THREE.Points(geometry, material);
  mesh.frustumCulled = false;

  const particles = [];
  let enabled = options.enabled ?? true;
  let timeUntilNextBurst = 0.4;

  function launchBurst(burst = {}) {
    const origin = burst.origin ?? [
      (Math.random() - 0.5) * 16,
      18 + Math.random() * 8,
      2 + (Math.random() - 0.5) * 10,
    ];
    const count = burst.count ?? 70 + Math.floor(Math.random() * 50);
    const paletteIndex = Math.floor(Math.random() * FIREWORK_COLORS.length);
    const color = burst.color ?? FIREWORK_COLORS[paletteIndex];
    const speed = burst.speed ?? 6.5 + Math.random() * 4.0;
    const maxAge = burst.lifespan ?? 1.5 + Math.random() * 0.7;

    for (let i = 0; i < count; i += 1) {
      if (particles.length >= maxParticles) break;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const velocityMag = speed * (0.65 + Math.random() * 0.5);

      const vx = Math.sin(phi) * Math.cos(theta) * velocityMag;
      const vy = Math.cos(phi) * velocityMag * 0.9 + 1.2;
      const vz = Math.sin(phi) * Math.sin(theta) * velocityMag;

      particles.push({
        x: origin[0],
        y: origin[1],
        z: origin[2],
        vx,
        vy,
        vz,
        r: color[0],
        g: color[1],
        b: color[2],
        age: 0,
        maxAge,
      });
    }
  }

  function update(delta) {
    if (enabled) {
      timeUntilNextBurst -= delta;
      if (timeUntilNextBurst <= 0) {
        launchBurst();
        timeUntilNextBurst = 0.8 + Math.random() * 1.4;
      }
    }

    const posArray = geometry.attributes.position.array;
    const colArray = geometry.attributes.color.array;
    const dragFactor = Math.pow(drag, delta * 60);

    let writeIndex = 0;
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      p.age += delta;
      if (p.age >= p.maxAge) continue;

      p.vx *= dragFactor;
      p.vy = (p.vy - gravity * delta) * dragFactor;
      p.vz *= dragFactor;

      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.z += p.vz * delta;

      const progress = p.age / p.maxAge;
      const fade = Math.max(0, 1.0 - progress);
      const intensity = fade * bloomBoost;

      const idx = writeIndex * 3;
      posArray[idx] = p.x;
      posArray[idx + 1] = p.y;
      posArray[idx + 2] = p.z;

      colArray[idx] = p.r * intensity;
      colArray[idx + 1] = p.g * intensity;
      colArray[idx + 2] = p.b * intensity;

      particles[writeIndex] = p;
      writeIndex += 1;
    }

    particles.length = writeIndex;

    geometry.setDrawRange(0, writeIndex);
    if (writeIndex > 0 || particles.length > 0) {
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
    }
  }

  function setEnabled(value) {
    enabled = Boolean(value);
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
    particles.length = 0;
  }

  return {
    mesh,
    update,
    launchBurst,
    setEnabled,
    dispose,
    get activeParticles() {
      return particles.length;
    },
    get isEnabled() {
      return enabled;
    },
  };
}
