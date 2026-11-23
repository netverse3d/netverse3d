import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import {
  EMISSIVE_SCALE,
  LIGHT_BUDGET,
  STANDARD_BLOOM,
  isWithinEmissiveScale,
} from './lighting.mjs';
import * as lighting from './lighting.mjs';
import { shopMaterials } from './three-shop.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const CONFIG = readJson(join(ROOT, 'assets.config.json'));
const ROWS = [
  'body',
  'metal',
  'soft',
  'top',
  'floor',
  'wall',
  'ceiling',
  'trim',
  'strip',
  'keycap',
  'screen',
  'accent',
];
const RECIPE = {
  palette: {
    body: ['#1a1428'],
    metal: ['#3a3a46'],
    soft: ['#14101d'],
    top: ['#221d38'],
    floor: ['#1b1530'],
    wall: ['#282042'],
    ceiling: ['#161224'],
    trim: ['#00e5ff'],
    strip: ['#a835ff'],
    keycap: ['#0aa0c8', '#c0189a'],
    screen: ['#ffe082'],
    accent: ['#ff007f'],
  },
};
const PRESET_IDS = [
  'studio',
  'shop-neon',
  'shop-dim',
  'shop-warm',
  'shop-daylight',
  'street-night',
  'showcase-baked',
];
const SHOP_LOOK_SCHEMA = readJson(join(ROOT, '../contracts/world/v1/shop-look.schema.json'));

function fakeThree() {
  class Color {
    constructor(value) {
      this.value = value;
    }

    set(value) {
      this.value = value;
    }
  }

  class Fog {
    constructor(color, near, far) {
      this.color = new Color(color);
      this.near = near;
      this.far = far;
    }
  }

  class Light {
    constructor(color, intensity, distance, decay) {
      this.color = color;
      this.intensity = intensity;
      this.distance = distance;
      this.decay = decay;
      this.position = {
        set: (x, y, z) => Object.assign(this.position, { x, y, z }),
      };
    }
  }

  class HemisphereLight extends Light {
    constructor(sky, ground, intensity) {
      super(sky, intensity);
      this.ground = ground;
    }
  }

  class DirectionalLight extends Light {}

  class PointLight extends Light {}

  class CanvasTexture {
    constructor(canvas) {
      this.canvas = canvas;
    }
  }

  class PMREMGenerator {
    constructor() {
      this.targets = [];
    }

    fromScene() {
      const target = {
        texture: { isEnvironment: true },
        disposed: false,
        dispose() {
          this.disposed = true;
        },
      };
      this.targets.push(target);
      return target;
    }

    fromEquirectangular() {
      return this.fromScene();
    }

    dispose() {
      this.disposed = true;
    }
  }

  return {
    ACESFilmicToneMapping: 'aces',
    EquirectangularReflectionMapping: 'equirectangular',
    PMREMGenerator,
    SRGBColorSpace: 'srgb',
    CanvasTexture,
    Color,
    DirectionalLight,
    Fog,
    HemisphereLight,
    PointLight,
  };
}

function fakeCanvas() {
  return {
    getContext: () => ({
      createLinearGradient: () => ({ addColorStop: () => {} }),
      fillRect: () => {},
      fillStyle: null,
    }),
  };
}

function fakeScene() {
  return {
    children: [],
    add(...objects) {
      this.children.push(...objects);
    },
    remove(object) {
      this.children = this.children.filter((child) => child !== object);
    },
  };
}

test('thang phát sáng định nghĩa đủ các loại nguồn phát sáng theo chuẩn ADR-0019', () => {
  const expectedTypes = [
    'neon',
    'screen',
    'streetLamp',
    'trafficSignal',
    'window',
    'vehicleHeadlight',
    'vehicleTaillight',
  ];
  for (const type of expectedTypes) {
    const scale = EMISSIVE_SCALE[type];
    assert.ok(scale, `Thiếu thang phát sáng cho loại ${type}`);
    assert.ok(typeof scale.min === 'number', `min của ${type} phải là số`);
    assert.ok(typeof scale.max === 'number', `max của ${type} phải là số`);
    assert.ok(typeof scale.default === 'number', `default của ${type} phải là số`);
    assert.ok(scale.min <= scale.default, `min của ${type} phải nhỏ hơn hoặc bằng default`);
    assert.ok(scale.default <= scale.max, `default của ${type} phải nhỏ hơn hoặc bằng max`);
  }
  assert.ok(EMISSIVE_SCALE.neon.min >= 1.8 && EMISSIVE_SCALE.neon.max <= 2.8);
  assert.ok(EMISSIVE_SCALE.screen.min >= 0.8 && EMISSIVE_SCALE.screen.max <= 1.4);
  assert.ok(EMISSIVE_SCALE.streetLamp.min >= 2.5 && EMISSIVE_SCALE.streetLamp.max <= 3.5);
  assert.ok(EMISSIVE_SCALE.trafficSignal.min >= 2.0 && EMISSIVE_SCALE.trafficSignal.max <= 3.0);
  assert.ok(EMISSIVE_SCALE.window.min >= 0.6 && EMISSIVE_SCALE.window.max <= 1.3);
  assert.ok(
    EMISSIVE_SCALE.vehicleHeadlight.min >= 3.0 && EMISSIVE_SCALE.vehicleHeadlight.max <= 4.5,
  );
  assert.ok(
    EMISSIVE_SCALE.vehicleTaillight.min >= 1.5 && EMISSIVE_SCALE.vehicleTaillight.max <= 2.5,
  );
});

test('hàm isWithinEmissiveScale kiểm tra độ sáng có thuộc khoảng của loại nguồn', () => {
  assert.equal(isWithinEmissiveScale('neon', 2.2), true);
  assert.equal(isWithinEmissiveScale('neon', 1.5), false);
  assert.equal(isWithinEmissiveScale('neon', 3.5), false);
  assert.equal(isWithinEmissiveScale('unknown', 1.0), false);
});

test('thông số bloom chuẩn thống nhất cho toàn bộ dự án', () => {
  assert.equal(STANDARD_BLOOM.threshold, 0.85);
  assert.ok(STANDARD_BLOOM.strength >= 0.25 && STANDARD_BLOOM.strength <= 0.45);
  assert.ok(STANDARD_BLOOM.radius >= 0.3 && STANDARD_BLOOM.radius <= 0.6);
});

test('ngân sách ánh sáng giới hạn số đèn động và quy định nướng ánh sáng hắt', () => {
  assert.ok(LIGHT_BUDGET.maxDynamicLightsPerBlock <= 6);
  assert.equal(LIGHT_BUDGET.bakeBouncedLight, true);
});

test('cấu hình assets.config.json đăng ký thang phát sáng và mức bloom theo ADR-0019', () => {
  assert.ok(CONFIG.lighting, 'assets.config.json phải có mục lighting');
  assert.ok(CONFIG.lighting.bloom, 'lighting phải có mục bloom');
  assert.equal(CONFIG.lighting.bloom.threshold, STANDARD_BLOOM.threshold);
  assert.equal(CONFIG.lighting.bloom.strength, STANDARD_BLOOM.strength);
  assert.equal(CONFIG.lighting.bloom.radius, STANDARD_BLOOM.radius);
  assert.ok(CONFIG.lighting.emissiveScale, 'lighting phải có mục emissiveScale');
  for (const [type, scale] of Object.entries(EMISSIVE_SCALE)) {
    assert.deepEqual(CONFIG.lighting.emissiveScale[type], scale);
  }
  assert.ok(CONFIG.lighting.budget, 'lighting phải có mục budget');
  assert.equal(
    CONFIG.lighting.budget.maxDynamicLightsPerBlock,
    LIGHT_BUDGET.maxDynamicLightsPerBlock,
  );
  assert.equal(CONFIG.lighting.budget.bakeBouncedLight, LIGHT_BUDGET.bakeBouncedLight);
});

test('bảy bộ ánh sáng có đủ trường của chuẩn dựng hình', () => {
  const presets = lighting.LIGHTING_PRESETS ?? {};
  assert.deepEqual(Object.keys(presets).sort(), [...PRESET_IDS].sort());
  for (const [id, preset] of Object.entries(presets)) {
    assert.equal(preset.id, id);
    assert.ok(['indoor', 'outdoor', 'studio', 'baked'].includes(preset.kind));
    assert.equal(preset.toneMapping, 'aces');
    assert.equal(typeof preset.exposure, 'number');
    assert.ok(preset.background === 'night-sky' || /^#[0-9a-f]{6}$/i.test(preset.background));
    assert.ok(['room', 'night-sky', 'none'].includes(preset.environment?.source));
    assert.equal(typeof preset.environment.intensity, 'number');
    assert.equal(typeof preset.environment.blur, 'number');
    assert.ok(
      preset.fog === null ||
        (typeof preset.fog.color === 'string' &&
          typeof preset.fog.near === 'number' &&
          typeof preset.fog.far === 'number'),
    );
    assert.ok(
      preset.hemisphere === null ||
        (typeof preset.hemisphere.sky === 'string' &&
          typeof preset.hemisphere.ground === 'string' &&
          typeof preset.hemisphere.intensity === 'number'),
    );
    assert.ok(Array.isArray(preset.directional));
    assert.ok(Array.isArray(preset.points));
    assert.ok(
      preset.directional.every(
        (light) =>
          typeof light.color === 'string' &&
          typeof light.intensity === 'number' &&
          Array.isArray(light.position) &&
          light.position.length === 3,
      ),
    );
    assert.ok(
      preset.points.every(
        (light) =>
          typeof light.color === 'string' &&
          typeof light.intensity === 'number' &&
          typeof light.distance === 'number' &&
          typeof light.decay === 'number' &&
          (light.placement === 'room-corners' || Array.isArray(light.placement)),
      ),
    );
    assert.equal(typeof preset.bloom.strength, 'number');
    assert.equal(typeof preset.bloom.radius, 'number');
    assert.equal(typeof preset.bloom.threshold, 'number');
  }
});

test('lightingFor ánh xạ enum tiệm và báo lỗi với bộ không biết', () => {
  assert.equal(typeof lighting.lightingFor, 'function');
  assert.equal(lighting.lightingFor('neon').id, 'shop-neon');
  assert.throws(
    () => lighting.lightingFor('unknown'),
    (error) => {
      assert.ok(error instanceof RangeError);
      assert.match(error.message, /unknown/);
      return true;
    },
  );
});

test('mọi giá trị enum lighting của hợp đồng tiệm ánh xạ được', () => {
  assert.equal(typeof lighting.lightingFor, 'function');
  for (const value of SHOP_LOOK_SCHEMA.properties.lighting.enum) {
    assert.ok(lighting.lightingFor(value), `Thiếu preset cho enum ${value}`);
  }
});

test('ngưỡng bloom của mọi preset khớp chuẩn chung', () => {
  const presets = lighting.LIGHTING_PRESETS ?? {};
  for (const preset of Object.values(presets)) {
    assert.equal(preset.bloom.threshold, STANDARD_BLOOM.threshold, preset.id);
  }
});

test('applyLighting đặt hai đèn shop-neon ở góc phòng và giữ đúng chiều cao', () => {
  const THREE = fakeThree();
  const scene = fakeScene();
  const renderer = {};
  const bloomPass = {};
  const handle = lighting.applyLighting(THREE, {
    scene,
    renderer,
    bloomPass,
    preset: 'shop-neon',
    room: { width: 8, depth: 6 },
    RoomEnvironment: class {},
  });
  const hemisphere = scene.children.filter((light) => light instanceof THREE.HemisphereLight);
  const points = scene.children.filter((light) => light instanceof THREE.PointLight);
  assert.equal(hemisphere.length, 1);
  assert.equal(points.length, 2);
  assert.deepEqual(
    points.map(({ position }) => [position.x, position.y, position.z]),
    [
      [-7.5, 2.6, 5.5],
      [7.5, 2.6, -5.5],
    ],
  );
  assert.equal(renderer.toneMapping, THREE.ACESFilmicToneMapping);
  assert.equal(renderer.outputColorSpace, THREE.SRGBColorSpace);
  assert.equal(bloomPass.strength, lighting.LIGHTING_PRESETS['shop-neon'].bloom.strength);
  assert.equal(bloomPass.radius, lighting.LIGHTING_PRESETS['shop-neon'].bloom.radius);
  assert.equal(bloomPass.threshold, STANDARD_BLOOM.threshold);
  assert.ok(scene.environment.isEnvironment);
  assert.equal(handle.preset.id, 'shop-neon');
});

test('applyLighting đổi bộ ánh sáng mà không nhân đôi đèn trong cảnh', () => {
  const THREE = fakeThree();
  const scene = fakeScene();
  const renderer = {};
  const handle = lighting.applyLighting(THREE, {
    scene,
    renderer,
    preset: 'shop-neon',
    room: { width: 8, depth: 6 },
    RoomEnvironment: class {},
  });
  handle.update('shop-dim');
  const points = scene.children.filter((light) => light instanceof THREE.PointLight);
  assert.equal(scene.children.length, 3);
  assert.equal(points.length, 2);
  assert.deepEqual(
    points.map((light) => light.intensity),
    [5, 5],
  );
  assert.equal(handle.preset.id, 'shop-dim');
  assert.equal(renderer.toneMappingExposure, 0.9);
  handle.update({ environment: { intensity: 0.2 } });
  assert.equal(scene.environmentIntensity, 0.2);
  handle.setExposure(0.75);
  assert.equal(renderer.toneMappingExposure, 0.75);
});

test('applyLighting dispose gỡ đèn và giải phóng mục tiêu PMREM', () => {
  const THREE = fakeThree();
  const scene = fakeScene();
  const pmrem = new THREE.PMREMGenerator();
  const handle = lighting.applyLighting(THREE, {
    scene,
    renderer: {},
    preset: 'shop-neon',
    room: { width: 8, depth: 6 },
    RoomEnvironment: class {},
    pmrem,
  });
  const target = pmrem.targets[0];
  handle.dispose();
  assert.equal(scene.children.length, 0);
  assert.equal(target.disposed, true);
  assert.equal(pmrem.disposed, undefined);
});

test('applyLighting dựng sương và đèn trăng cho street-night', () => {
  const THREE = fakeThree();
  const scene = fakeScene();
  const handle = lighting.applyLighting(THREE, {
    scene,
    renderer: {},
    preset: 'street-night',
    canvas: fakeCanvas(),
  });
  assert.equal(scene.fog.color.value, '#24193d');
  assert.equal(scene.fog.near, 16);
  assert.equal(scene.fog.far, 90);
  assert.equal(handle.lights.filter((light) => light instanceof THREE.DirectionalLight).length, 1);
  assert.equal(
    handle.lights.find((light) => light instanceof THREE.DirectionalLight).intensity,
    1.1,
  );
});

test('shopMaterials tạo vật liệu phát sáng neon nằm trong thang EMISSIVE_SCALE.neon', () => {
  const materials = shopMaterials(THREE, RECIPE, ROWS);
  assert.ok(materials.glow);
  assert.ok(
    isWithinEmissiveScale('neon', materials.glow.color.r),
    `Cường độ màu glow ${materials.glow.color.r} phải nằm trong khoảng neon (${EMISSIVE_SCALE.neon.min} - ${EMISSIVE_SCALE.neon.max})`,
  );
});
