export const FACE_W = 640;
export const FACE_H = 520;
const EMBLEM_W = 256;
const EMBLEM_H = 200;
const FACE_MATERIAL = 'face_canvas';
const EMBLEM_MATERIAL = 'logo_canvas';

export function paintFace(g, kind, blink) {
  const dark = '#1b1522';
  const L = [174, 268],
    R = [466, 268];
  g.clearRect(0, 0, FACE_W, FACE_H);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const skin = '#f7cda8';
  const arc = (x, y, rx, ry, up, width = 11) => {
    g.strokeStyle = dark;
    g.lineWidth = width;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, up ? Math.PI : 0, up ? Math.PI * 2 : Math.PI);
    g.stroke();
  };
  const open = (c, o = {}) => {
    const [x, y] = c,
      { sx = 1, sy = 1, lookX = 0, lookY = 0, lid = 0, pupil = 1 } = o;
    g.save();
    g.beginPath();
    g.ellipse(x, y, 60 * sx, 78 * sy, 0, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = '#fbf8f4';
    g.fillRect(x - 90, y - 100, 180, 200);
    const ix = x + lookX,
      iy = y + lookY;
    const iris = g.createLinearGradient(ix, iy - 60, ix, iy + 60);
    iris.addColorStop(0, '#20152f');
    iris.addColorStop(0.62, '#3b2a58');
    iris.addColorStop(1, '#8a6ab8');
    g.fillStyle = iris;
    g.beginPath();
    g.ellipse(ix, iy, 50 * sx, 66 * sy, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#0f0a16';
    g.beginPath();
    g.ellipse(ix, iy - 2, 30 * sx * pupil, 42 * sy * pupil, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(ix + 17, iy - 30, 15, 18, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(ix - 18, iy + 30, 7, 8, 0, 0, Math.PI * 2);
    g.fill();
    if (lid > 0) {
      g.fillStyle = skin;
      g.fillRect(x - 90, y - 100, 180, 22 + 156 * lid);
      g.strokeStyle = dark;
      g.lineWidth = 10;
      g.beginPath();
      g.moveTo(x - 80, y - 78 + 156 * lid);
      g.quadraticCurveTo(x, y - 94 + 156 * lid, x + 80, y - 78 + 156 * lid);
      g.stroke();
    }
    g.restore();
    if (lid === 0) {
      g.strokeStyle = dark;
      g.lineWidth = 11;
      g.beginPath();
      g.ellipse(x, y, 62 * sx, 80 * sy, 0, Math.PI * 1.12, Math.PI * 1.88);
      g.stroke();
    }
  };
  const shut = (c) => {
    arc(c[0], c[1] + 12, 56, 26, false, 11);
  };
  const joy = (c) => {
    arc(c[0], c[1] + 26, 56, 40, true, 12);
  };
  const brow = (c, angle, raise = 0, width = 11, len = 92) => {
    g.save();
    g.translate(c[0], c[1] - 108 - raise);
    g.rotate(angle);
    g.strokeStyle = '#2a2233';
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(-len / 2, 0);
    g.lineTo(len / 2, 0);
    g.stroke();
    g.restore();
  };
  const blush = (a = 0.42) => {
    for (const x of [94, 546]) {
      const f = g.createRadialGradient(x, 380, 2, x, 380, 66);
      f.addColorStop(0, `rgba(255,120,120,${a})`);
      f.addColorStop(1, 'rgba(255,120,120,0)');
      g.fillStyle = f;
      g.fillRect(x - 70, 330, 140, 100);
    }
  };
  const fillMouth = (path) => {
    g.fillStyle = '#7c2a35';
    g.beginPath();
    path();
    g.fill();
  };
  const smile = (w = 44, d = 20) => {
    g.strokeStyle = dark;
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(320 - w, 426);
    g.quadraticCurveTo(320, 426 + d * 2, 320 + w, 426);
    g.stroke();
  };
  const openSmile = (w = 58, h = 56) => {
    const top = 416;
    fillMouth(() => {
      g.moveTo(320 - w, top);
      g.quadraticCurveTo(320, top - 10, 320 + w, top);
      g.quadraticCurveTo(320 + w * 0.8, top + h, 320, top + h);
      g.quadraticCurveTo(320 - w * 0.8, top + h, 320 - w, top);
    });
    g.save();
    g.clip();
    g.fillStyle = '#fff';
    g.fillRect(320 - w, top - 12, w * 2, 22);
    g.fillStyle = '#ee8a84';
    g.beginPath();
    g.ellipse(320, top + h + 2, w * 0.6, h * 0.5, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  const o = (rx = 18, ry = 22, x = 320) => {
    g.fillStyle = '#7c2a35';
    g.beginPath();
    g.ellipse(x, 440, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  };
  const eyes = (ol, or = ol) => {
    if (blink) {
      shut(L);
      shut(R);
      return;
    }
    open(L, ol);
    open(R, or);
  };
  if (kind === 'smile') {
    eyes({});
    brow(L, -0.06);
    brow(R, 0.06);
    openSmile(46, 36);
    blush(0.3);
  }
  if (kind === 'excited') {
    joy(L);
    joy(R);
    brow(L, -0.12, 10);
    brow(R, 0.12, 10);
    openSmile(70, 70);
    blush(0.5);
  }
  if (kind === 'laugh') {
    joy(L);
    joy(R);
    brow(L, -0.14, 6);
    brow(R, 0.14, 6);
    openSmile(74, 78);
    blush(0.5);
  }
  if (kind === 'surprised') {
    eyes({ sx: 1.06, sy: 1.08, pupil: 0.62 });
    brow(L, -0.1, 22);
    brow(R, 0.1, 22);
    o(20, 26);
  }
  if (kind === 'confused') {
    eyes({ lookX: 12, lookY: -10 });
    brow(L, 0.26, 8);
    brow(R, 0.08, 26);
    o(13, 15, 338);
  }
  if (kind === 'focus') {
    eyes({ lid: 0.26 });
    brow(L, 0.3, -8, 13);
    brow(R, -0.3, -8, 13);
    smile(26, -2);
  }
  if (kind === 'sleepy') {
    shut(L);
    shut(R);
    brow(L, 0.18, -6);
    brow(R, -0.18, -6);
    g.fillStyle = '#7c2a35';
    g.beginPath();
    g.ellipse(320, 436, 34, 46, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ee8a84';
    g.beginPath();
    g.ellipse(320, 462, 22, 16, 0, 0, Math.PI * 2);
    g.fill();
  }
  if (kind === 'sad') {
    eyes({ lid: 0.18, lookY: 12 });
    brow(L, 0.34, 8);
    brow(R, -0.34, 8);
    g.strokeStyle = dark;
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(286, 444);
    g.quadraticCurveTo(320, 416, 354, 444);
    g.stroke();
    g.fillStyle = '#9fdcff';
    g.beginPath();
    g.moveTo(520, 322);
    g.quadraticCurveTo(544, 362, 520, 372);
    g.quadraticCurveTo(496, 362, 520, 322);
    g.fill();
  }
  if (kind === 'furious') {
    eyes({ lid: 0.3, pupil: 0.7 });
    brow(L, 0.42, -14, 16);
    brow(R, -0.42, -14, 16);
    fillMouth(() => {
      g.moveTo(262, 412);
      g.lineTo(378, 412);
      g.lineTo(358, 476);
      g.lineTo(282, 476);
      g.closePath();
    });
    g.fillStyle = '#fff';
    g.fillRect(266, 412, 108, 14);
    blush(0.6);
  }
  if (kind === 'nervous') {
    eyes({ sx: 1.04, sy: 1.02, lookX: -14, pupil: 0.78 });
    brow(L, 0.3, 18);
    brow(R, -0.3, 18);
    g.fillStyle = '#fff';
    g.strokeStyle = dark;
    g.lineWidth = 6;
    g.beginPath();
    g.roundRect(262, 418, 116, 42, 14);
    g.fill();
    g.stroke();
    for (let x = 288; x < 372; x += 28) {
      g.beginPath();
      g.moveTo(x, 420);
      g.lineTo(x, 458);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(264, 439);
    g.lineTo(376, 439);
    g.stroke();
  }
  if (kind === 'shy') {
    eyes({ lid: 0.14, lookX: 18, lookY: 8 });
    brow(L, 0.24, 6);
    brow(R, -0.2, 6);
    smile(24, 8);
    blush(0.85);
  }
  if (kind === 'wink') {
    open(L, {});
    g.strokeStyle = dark;
    g.lineWidth = 12;
    g.beginPath();
    g.moveTo(R[0] - 56, R[1] + 18);
    g.quadraticCurveTo(R[0], R[1] - 30, R[0] + 56, R[1] + 18);
    g.stroke();
    brow(L, -0.2, 18);
    brow(R, 0.28, -4);
    g.strokeStyle = dark;
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(270, 438);
    g.quadraticCurveTo(330, 456, 372, 414);
    g.stroke();
    blush(0.3);
  }
  if (kind === 'sip') {
    joy(L);
    joy(R);
    brow(L, -0.06, 6);
    brow(R, 0.06, 6);
    o(11, 11);
    blush(0.42);
  }
}

export function paintEmblem(g) {
  g.shadowColor = '#b48cff';
  g.shadowBlur = 18;
  g.strokeStyle = '#efe6ff';
  g.lineWidth = 10;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  for (let i = 0; i < 2; i += 1) {
    g.beginPath();
    g.moveTo(78, 50);
    g.lineTo(178, 50);
    g.bezierCurveTo(225, 50, 240, 150, 212, 158);
    g.bezierCurveTo(190, 164, 180, 122, 160, 122);
    g.lineTo(96, 122);
    g.bezierCurveTo(76, 122, 66, 164, 44, 158);
    g.bezierCurveTo(16, 150, 31, 50, 78, 50);
    g.closePath();
    g.stroke();
    g.beginPath();
    g.moveTo(80, 76);
    g.lineTo(80, 106);
    g.moveTo(65, 91);
    g.lineTo(95, 91);
    g.stroke();
    g.beginPath();
    g.arc(172, 78, 5, 0, 7);
    g.stroke();
    g.beginPath();
    g.arc(192, 98, 5, 0, 7);
    g.stroke();
  }
}

export function createActorLook(THREE, { createCanvas, toonGradient = null } = {}) {
  const newCanvas = createCanvas ?? (() => globalThis.document.createElement('canvas'));
  const faces = new Map();
  const materials = new Map();
  let emblem = null;

  const canvasTexture = (width, height, paint) => {
    const canvas = newCanvas();
    canvas.width = width;
    canvas.height = height;
    paint(canvas.getContext('2d'));
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    return texture;
  };

  const faceTexture = (kind, blink = false) => {
    const key = kind + (blink ? '_b' : '');
    if (!faces.has(key)) {
      const texture = canvasTexture(FACE_W, FACE_H, (g) => paintFace(g, kind, blink));
      texture.anisotropy = 8;
      faces.set(key, texture);
    }
    return faces.get(key);
  };

  const emblemTexture = () => {
    emblem ??= canvasTexture(EMBLEM_W, EMBLEM_H, paintEmblem);
    return emblem;
  };

  const makeMaterial = (source, soft) => {
    if (source.name === 'hair') {
      return soft
        ? new THREE.MeshPhysicalMaterial({
            color: '#ffffff',
            vertexColors: true,
            roughness: 0.46,
            metalness: 0,
            sheen: 0.2,
            sheenColor: new THREE.Color('#7a5cff'),
            sheenRoughness: 0.5,
            side: THREE.DoubleSide,
          })
        : new THREE.MeshToonMaterial({
            color: '#ffffff',
            vertexColors: true,
            gradientMap: toonGradient,
            side: THREE.DoubleSide,
          });
    }
    if (source.name === EMBLEM_MATERIAL) {
      return new THREE.MeshBasicMaterial({
        map: emblemTexture(),
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      });
    }
    if (source.name === 'shine' || source.name.startsWith('led')) {
      return new THREE.MeshBasicMaterial({ color: source.color, toneMapped: false });
    }
    if (source.name === 'blush') {
      return new THREE.MeshBasicMaterial({ color: source.color, transparent: true, opacity: 0.42 });
    }
    if (soft || source.name.startsWith('prop_')) {
      return new THREE.MeshStandardMaterial({
        color: source.color,
        roughness: source.roughness,
        metalness: source.metalness,
      });
    }
    return new THREE.MeshToonMaterial({ color: source.color, gradientMap: toonGradient });
  };

  const material = (source, soft = true) => {
    const key = source.name + (soft ? 's' : 't');
    if (!materials.has(key)) materials.set(key, makeMaterial(source, soft));
    return materials.get(key);
  };

  const faceMaterial = () =>
    new THREE.MeshStandardMaterial({
      map: faceTexture('smile'),
      transparent: true,
      depthWrite: false,
      roughness: 0.55,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

  const dress = (root, { soft = true } = {}) => {
    root.traverse((node) => {
      if (!node.isMesh) return;
      node.userData.source ??= node.material;
      if (node.userData.source.name === FACE_MATERIAL) {
        node.userData.faceMaterial ??= faceMaterial();
        node.material = node.userData.faceMaterial;
        root.userData.face = node.userData.faceMaterial;
      } else {
        node.material = material(node.userData.source, soft);
      }
      node.frustumCulled = false;
      node.castShadow =
        !(node.material instanceof THREE.MeshBasicMaterial) && !node.material.transparent;
      node.receiveShadow = true;
    });
    return root;
  };

  const showFace = (root, kind, blink = false) => {
    if (!root.userData.face) return false;
    root.userData.face.map = faceTexture(kind, blink);
    root.userData.face.needsUpdate = true;
    return true;
  };

  return { faceTexture, emblemTexture, material, dress, showFace };
}
