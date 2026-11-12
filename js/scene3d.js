import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const LOOK = {
  aluminio: { color: 0xd5dbe3, metalness: 0.92, roughness: 0.26 },
  laton: { color: 0xd4a017, metalness: 0.86, roughness: 0.3 },
  cobre: { color: 0xb87333, metalness: 0.84, roughness: 0.32 },
  vidrio: { color: 0xd5eef3, glass: true, transmission: 0.72 },
  invar: { color: 0x8b949a, metalness: 0.74, roughness: 0.36 },
  cuarzo: { color: 0x9ec4e4, glass: true, transmission: 0.42 },
  acero: { color: 0x6d757c, metalness: 0.9, roughness: 0.34 },
  etanol: { color: 0x2faf72, liquid: true, metalness: 0.02, roughness: 0.18, opacity: 0.9 },
  disulfuro: { color: 0xe2b423, liquid: true, metalness: 0.04, roughness: 0.2, opacity: 0.92 },
  glicerina: { color: 0xe8a84a, liquid: true, metalness: 0.03, roughness: 0.24, opacity: 0.94 },
  mercurio: { color: 0xd5dbe0, liquid: true, metalness: 1, roughness: 0.08, opacity: 1 },
};

const TITLE = {
  aluminio: { lineal: "Barra de aluminio", superficial: "Chapa de aluminio", volumetrica: "Bloque de aluminio" },
  laton: { lineal: "Varilla de latón", superficial: "Chapa de latón", volumetrica: "Cilindro de latón" },
  cobre: { lineal: "Tubo de cobre", superficial: "Chapa de cobre", volumetrica: "Tubo corto de cobre" },
  vidrio: { lineal: "Varilla de vidrio", superficial: "Placa de vidrio", volumetrica: "Cubo de vidrio" },
  invar: { lineal: "Regla de invar", superficial: "Lámina de invar", volumetrica: "Bloque patrón de invar" },
  cuarzo: { lineal: "Prisma de cuarzo", superficial: "Placa de cuarzo", volumetrica: "Cristal de cuarzo" },
  acero: { lineal: "Riel de acero", superficial: "Placa de acero", volumetrica: "Lingote de acero" },
  etanol: { volumetrica: "Matraz de etanol" },
  disulfuro: { volumetrica: "Frasco de disulfuro de carbono" },
  glicerina: { volumetrica: "Vaso de glicerina" },
  mercurio: { volumetrica: "Termómetro de mercurio" },
};

const views = new Set();
let looping = false;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function isDark() {
  return document.documentElement.dataset.theme === "dark";
}

function allowSpin() {
  return !reducedMotion.matches;
}

function makeMat(id, opts = {}) {
  const look = LOOK[id] || { color: 0x9aa0a6, metalness: 0.65, roughness: 0.4 };
  const glassClear = Boolean(look.glass && opts.glassMode === "clear");
  let material;
  if (look.glass) {
    material = new THREE.MeshPhysicalMaterial({
      color: look.color,
      metalness: 0,
      roughness: 0.06,
      transmission: glassClear ? (look.transmission ?? 0.8) : 0,
      thickness: 0.8,
      attenuationColor: new THREE.Color(look.color),
      attenuationDistance: 0.45,
      ior: 1.5,
      transparent: !glassClear,
      opacity: glassClear ? 1 : 0.34,
      envMapIntensity: 1,
      side: opts.side || THREE.FrontSide,
    });
  } else {
    const opacity = look.opacity ?? 1;
    material = new THREE.MeshStandardMaterial({
      color: look.color,
      metalness: look.metalness ?? 0.4,
      roughness: look.roughness ?? 0.45,
      transparent: opacity < 1,
      opacity,
      envMapIntensity: 1.05,
      side: opts.side || THREE.FrontSide,
    });
  }
  if (opts.flat) material.flatShading = true;
  material.userData.base = material.color.clone();
  material.userData.tint = !look.glass && !opts.noTint;
  return material;
}

function markEdges(object) {
  object.traverse((child) => {
    if (child.isMesh) child.userData.edge = true;
  });
}

function groundCenter(group) {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const dx = (box.min.x + box.max.x) / 2;
  const dy = box.min.y;
  const dz = (box.min.z + box.max.z) / 2;
  group.children.forEach((child) => {
    child.position.x -= dx;
    child.position.y -= dy;
    child.position.z -= dz;
  });
}

function fitNumber(object, target) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  return target / Math.max(size.x, size.y, size.z, 0.001);
}

function makeEdges(source) {
  source.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(source.matrixWorld).invert();
  const material = new THREE.LineBasicMaterial({
    color: isDark() ? 0xd9cfc3 : 0x6e6258,
    transparent: true,
    opacity: 0.9,
  });
  const group = new THREE.Group();
  group.renderOrder = 3;
  source.traverse((child) => {
    if (!child.isMesh || !child.userData.edge) return;
    const lines = new THREE.LineSegments(new THREE.EdgesGeometry(child.geometry, 28), material);
    new THREE.Matrix4().multiplyMatrices(inv, child.matrixWorld).decompose(lines.position, lines.quaternion, lines.scale);
    lines.renderOrder = 3;
    group.add(lines);
  });
  group.visible = false;
  return group;
}

function disposeObject(root) {
  const geos = new Set();
  const mats = new Set();
  root.traverse((child) => {
    if (child.geometry && !geos.has(child.geometry)) {
      geos.add(child.geometry);
      child.geometry.dispose();
    }
    const list = child.material ? [].concat(child.material) : [];
    list.forEach((material) => {
      if (!material || mats.has(material)) return;
      mats.add(material);
      if (material.map) material.map.dispose();
      material.dispose();
    });
  });
}

function tintObject(object, motion) {
  const t = Math.max(-1, Math.min(1, (motion || 0) / 90));
  const hot = new THREE.Color(0xffc2ad);
  const cold = new THREE.Color(0xc5ddf0);
  object.traverse((child) => {
    const material = child.material;
    if (!material || !material.userData || !material.userData.tint || !material.userData.base) return;
    material.color.copy(material.userData.base);
    if (t > 0) material.color.lerp(hot, t * 0.32);
    else if (t < 0) material.color.lerp(cold, -t * 0.32);
  });
}

function growth(kind, motion) {
  const t = Math.tanh((motion || 0) / 62);
  const gain = kind === "lineal" ? 0.2 : kind === "superficial" ? 0.3 : 0.32;
  const k = 1 + t * gain;
  if (kind === "lineal") return { t, x: k, y: 1, z: 1 };
  if (kind === "superficial") return { t, x: k, y: 1, z: k };
  return { t, x: k, y: k, z: k };
}

function shade(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    const material = child.material;
    const glassy = Boolean(material && material.transmission > 0 && child.userData.shell);
    child.castShadow = !(material && material.transparent) && !glassy;
    child.receiveShadow = !glassy;
    if (glassy) {
      material.depthWrite = false;
      material.transparent = true;
      child.renderOrder = 2;
    }
    if (child.userData.role === "liquid" || child.userData.role === "surface") child.renderOrder = 3;
  });
}

function plinth(radius) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 1.05, 0.05, 40),
    new THREE.MeshStandardMaterial({
      color: isDark() ? 0x3c342c : 0xe6d7c6,
      roughness: 0.92,
      metalness: 0,
    }),
  );
  mesh.name = "plinth";
  mesh.position.y = 0.025;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}

function labelTexture(text, dark) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const font = "600 64px Segoe UI, sans-serif";
  ctx.font = font;
  canvas.width = Math.max(160, Math.ceil(ctx.measureText(text).width + 56));
  canvas.height = 96;
  ctx.font = font;
  ctx.fillStyle = dark ? "#f4ece4" : "#241c16";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeLabel(text) {
  const texture = labelTexture(text, isDark());
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  }));
  sprite.name = "label";
  sprite.userData.text = text;
  sprite.center.set(0.5, 0);
  const aspect = texture.image.width / texture.image.height;
  sprite.scale.set(0.34 * aspect, 0.34, 1);
  sprite.renderOrder = 4;
  return sprite;
}

function pretty(id, fallback) {
  if (id === "disulfuro") return "Disulfuro";
  if (id === "cuarzo") return "Cuarzo";
  const text = fallback || id || "Material";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function titleFor(spec) {
  if (!spec || spec.empty) return "";
  if (spec.kind === "comparar") return "Cada material con su forma";
  if (spec.kind === "aparente") return spec.label || "Dilatación aparente";
  if (spec.asDisk) return `Disco de ${spec.label || "material"}`;
  return (TITLE[spec.materialId] || {})[spec.kind] || spec.label || "Material";
}

function ibeam(length, material) {
  const group = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(length, 0.07, 0.36), material);
  top.position.y = 0.16;
  const web = new THREE.Mesh(new THREE.BoxGeometry(length, 0.25, 0.08), material);
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(length, 0.07, 0.36), material);
  bottom.position.y = -0.16;
  group.add(top, web, bottom);
  return group;
}

function barStock(length, material) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(length, 0.22, 0.42), material);
  const groove = new THREE.Mesh(
    new THREE.BoxGeometry(length * 0.98, 0.06, 0.16),
    material,
  );
  groove.position.y = 0.1;
  group.add(body, groove);
  return group;
}

function alongX(mesh) {
  mesh.rotation.z = Math.PI / 2;
  return mesh;
}

function rod(length, radius, material, horizontal) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 32), material);
  return horizontal ? alongX(mesh) : mesh;
}

function pipe(length, radius, material, horizontal) {
  const group = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 28, 1, true), material);
  const innerMat = makeMat(material.userData.sourceId || "cobre");
  innerMat.color.multiplyScalar(0.42);
  innerMat.userData.base = innerMat.color.clone();
  innerMat.side = THREE.BackSide;
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, length + 0.02, 28, 1, true), innerMat);
  const ring = new THREE.RingGeometry(radius * 0.72, radius, 28);
  const capA = new THREE.Mesh(ring, material);
  const capB = new THREE.Mesh(ring, material);
  if (horizontal) {
    outer.rotation.z = Math.PI / 2;
    inner.rotation.z = Math.PI / 2;
    capA.rotation.y = Math.PI / 2;
    capB.rotation.y = Math.PI / 2;
    capA.position.x = -length / 2;
    capB.position.x = length / 2;
  } else {
    capA.rotation.x = -Math.PI / 2;
    capB.rotation.x = -Math.PI / 2;
    capA.position.y = length / 2;
    capB.position.y = -length / 2;
  }
  group.add(outer, inner, capA, capB);
  return group;
}

function ruler(length, material) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(length, 0.055, 0.24), material);
  group.add(body);
  const tickMat = makeMat("invar", { noTint: true });
  tickMat.color.set(0xf3efe8);
  tickMat.userData.base = tickMat.color.clone();
  tickMat.metalness = 0.05;
  tickMat.roughness = 0.6;
  const steps = 9;
  for (let i = 1; i < steps; i += 1) {
    const major = i % 4 === 0;
    const depth = major ? 0.12 : 0.07;
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, depth), tickMat);
    tick.position.set(-length / 2 + (i * length) / steps, 0.032, 0.12 - depth / 2);
    group.add(tick);
  }
  return group;
}

function crystal(material) {
  const group = new THREE.Group();
  const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.62, 6), material);
  mid.position.y = 0.52;
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.5, 6), material);
  top.position.y = 1.05;
  const bottom = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.32, 6), material);
  bottom.rotation.x = Math.PI;
  bottom.position.y = 0.16;
  group.add(mid, top, bottom);
  return group;
}

function linearPiece(id, glassMode) {
  const material = makeMat(id, { glassMode, flat: id === "cuarzo" });
  material.userData.sourceId = id;
  const length = 1.25;
  if (id === "acero") return ibeam(length, material);
  if (id === "laton") return rod(length, 0.16, material, true);
  if (id === "cobre") return pipe(length, 0.18, material, true);
  if (id === "cuarzo") return alongX(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, length, 6), material));
  if (id === "vidrio") return rod(length, 0.14, material, true);
  if (id === "invar") return ruler(length, material);
  return barStock(length, material);
}

function chunkMesh(id, kind, asDisk, glassMode) {
  if (kind === "lineal") return linearPiece(id, glassMode);
  const faceted = id === "cuarzo" || (id === "acero" && kind === "volumetrica");
  const material = makeMat(id, { glassMode, flat: faceted });
  material.userData.sourceId = id;
  if (kind === "superficial") {
    if (asDisk) {
      const sides = id === "cuarzo" ? 6 : 48;
      return new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.07, sides), material);
    }
    if (id === "cuarzo") return new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.06, 6), material);
    if (id === "vidrio") return new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.045, 0.92), material);
    if (id === "invar") return new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.04, 0.32), material);
    if (id === "acero") return new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.1, 1.15), material);
    return new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.055, 0.9), material);
  }
  if (id === "cuarzo") return crystal(material);
  if (id === "acero") {
    const ingot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.58, 0.4, 4), material);
    ingot.rotation.y = Math.PI / 4;
    return ingot;
  }
  if (id === "laton") return rod(0.95, 0.38, material, false);
  if (id === "cobre") return pipe(0.7, 0.32, material, false);
  if (id === "vidrio") return new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.85), material);
  if (id === "invar") return new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.42, 0.55), material);
  return new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.7, 0.8), material);
}

function addLevelMark(group, y, radius) {
  const material = new THREE.MeshBasicMaterial({ color: isDark() ? 0xf0b198 : 0xa34b28 });
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.018, 0.018), material);
  mark.position.set(radius * 0.92, y, 0);
  mark.name = "mark";
  group.add(mark);
}

function bindLiquid(group) {
  let liquid = null;
  let surface = null;
  group.traverse((child) => {
    if (child.userData.role === "liquid") liquid = child;
    if (child.userData.role === "surface") surface = child;
  });
  if (!liquid) return { liquid: null, surface: null };
  const geomH = liquid.geometry.parameters.height;
  liquid.userData.level = {
    bottom: liquid.position.y - geomH / 2,
    minH: liquid.userData.minH,
    maxH: liquid.userData.maxH,
    geomH,
  };
  return { liquid, surface };
}

function setLevel(liquid, surface, motion) {
  if (!liquid || !liquid.userData.level) return;
  const info = liquid.userData.level;
  const t = 0.5 + 0.5 * Math.tanh((motion || 0) / 68);
  const h = info.minH + (info.maxH - info.minH) * t;
  liquid.scale.y = h / info.geomH;
  liquid.position.y = info.bottom + h / 2;
  if (surface) surface.position.y = info.bottom + h + 0.004;
}

function liquidBody(id, radiusTop, radiusBottom, restH, bottom) {
  const material = makeMat(id);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, restH, 32), material);
  mesh.position.y = bottom + restH / 2;
  mesh.userData.role = "liquid";
  mesh.userData.minH = restH * 0.45;
  mesh.userData.maxH = restH * 1.55;
  const surface = new THREE.Mesh(new THREE.CircleGeometry((radiusTop + radiusBottom) / 2 * 0.72, 32), makeMat(id));
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = bottom + restH;
  surface.userData.role = "surface";
  return { mesh, surface, restTop: bottom + restH };
}

function buildVessel(kind, wallId, liquidId, glassMode) {
  const group = new THREE.Group();
  const wall = makeMat(wallId, { glassMode, side: THREE.DoubleSide });
  let markY = 0.6;
  let markR = 0.55;

  if (kind === "thermometer") {
    const tubeMat = wall.clone();
    tubeMat.opacity = 0.42;
    tubeMat.transparent = true;
    tubeMat.depthWrite = false;
    const bulbGlass = new THREE.Mesh(new THREE.SphereGeometry(0.4, 28, 20), tubeMat);
    bulbGlass.position.y = 0.38;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.65, 24, 1, true), tubeMat);
    tube.position.y = 1.22;
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 20), tubeMat);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 2.02;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 18), makeMat(liquidId));
    bulb.position.y = 0.36;
    const restH = 0.7;
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, restH, 16), makeMat(liquidId));
    column.position.y = 0.55 + restH / 2;
    column.userData.role = "liquid";
    column.userData.minH = 0.15;
    column.userData.maxH = 1.25;
    group.add(bulbGlass, tube, lip, bulb, column);
    markY = 0.55 + restH;
    markR = 0.28;
  } else if (kind === "flask") {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.58, 1.12, 36), wall);
    body.position.y = 0.56;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.48, 24), wall);
    neck.position.y = 1.32;
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.028, 8, 24), wall);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 1.56;
    const drink = liquidBody(liquidId, 0.36, 0.48, 0.62, 0.1);
    group.add(body, neck, lip, drink.mesh, drink.surface);
    markY = drink.restTop;
    markR = 0.64;
  } else if (kind === "bottle") {
    const glass = makeMat("vidrio", { glassMode, side: THREE.DoubleSide });
    glass.color.set(0xf3e6c4);
    glass.userData.base = glass.color.clone();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.4, 0.95, 32), glass);
    body.position.y = 0.48;
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.38, 0.28, 28), glass);
    shoulder.position.y = 1.05;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.28, 20), glass);
    neck.position.y = 1.3;
    const capMat = makeMat("acero", { noTint: true });
    capMat.color.set(0x2c3338);
    capMat.userData.base = capMat.color.clone();
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.16, 20), capMat);
    cap.position.y = 1.5;
    const drink = liquidBody(liquidId, 0.32, 0.34, 0.62, 0.12);
    group.add(body, shoulder, neck, cap, drink.mesh, drink.surface);
    markY = drink.restTop;
    markR = 0.5;
  } else {
    const cut = wallId !== "vidrio" && wallId !== "cuarzo";
    const thetaStart = cut ? 0.35 : 0;
    const thetaLength = cut ? Math.PI * 1.5 : Math.PI * 2;
    const wallMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.46, 1.15, 40, 1, true, thetaStart, thetaLength),
      wall,
    );
    wallMesh.position.y = 0.62;
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 32), wall);
    floor.position.y = 0.05;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 8, 32), wall);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.18;
    const drink = liquidBody(liquidId, 0.4, 0.38, 0.7, 0.12);
    group.add(wallMesh, floor, rim, drink.mesh, drink.surface);
    markY = drink.restTop;
    markR = 0.62;
    group.userData.cut = cut;
  }

  group.traverse((child) => {
    if (child.isMesh && child.material && child.material.transmission > 0 && !child.userData.role) {
      child.userData.shell = true;
    }
  });
  groundCenter(group);
  if (group.userData.cut) group.rotation.y = -0.4;
  const bound = bindLiquid(group);
  if (bound.liquid && bound.liquid.userData.level) {
    markY = bound.liquid.userData.level.bottom + bound.liquid.geometry.parameters.height;
  }
  addLevelMark(group, markY, markR);
  return { group, liquid: bound.liquid, surface: bound.surface };
}

function vesselKind(options) {
  if (options.kind === "aparente") {
    if (options.liquidId === "mercurio" && (options.containerId === "vidrio" || options.containerId === "cuarzo")) {
      return "thermometer";
    }
    return "beaker";
  }
  if (options.kind === "volumetrica" && LOOK[options.materialId] && LOOK[options.materialId].liquid) {
    if (options.materialId === "mercurio") return "thermometer";
    if (options.materialId === "etanol") return "flask";
    if (options.materialId === "disulfuro") return "bottle";
    return "beaker";
  }
  return "";
}

function halfX(object) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  return (box.max.x - box.min.x) / 2;
}

function buildPair(id, glassMode) {
  const assembly = new THREE.Group();
  const left = linearPiece(id, glassMode);
  const right = linearPiece(id, glassMode);
  markEdges(left);
  markEdges(right);
  const gap = 0.34;
  const reach = 0.64;
  left.position.x = -(gap / 2 + reach);
  right.position.x = gap / 2 + reach;
  if (id === "acero") {
    const wood = new THREE.MeshStandardMaterial({ color: 0xb08968, roughness: 0.9, metalness: 0 });
    [-1.15, -0.45, 0.45, 1.15].forEach((x) => {
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.95), wood);
      tie.position.set(x, 0.04, 0);
      tie.castShadow = true;
      tie.receiveShadow = true;
      assembly.add(tie);
    });
    left.position.y = 0.28;
    right.position.y = 0.28;
  }
  assembly.add(left, right);
  groundCenter(assembly);
  const ghost = makeEdges(assembly);
  return {
    assembly,
    ghost,
    left,
    right,
    restLeft: left.position.x,
    restRight: right.position.x,
    halfL: halfX(left),
    halfR: halfX(right),
    sleepers: id === "acero",
  };
}

function measureScale(size) {
  const value = Number.isFinite(size) ? size : 1;
  return Math.min(1.42, Math.max(0.72, 0.58 + value * 0.42));
}

function buildWrapped(options, glassMode) {
  const target = options.compareItem ? 1.15 : 1.78;
  const vessel = vesselKind(options);
  const scaler = new THREE.Group();
  const lift = new THREE.Group();
  let ghost = null;
  let apply = () => {};

  if (options.pair) {
    const pair = buildPair(options.materialId, glassMode);
    const fit = fitNumber(pair.assembly, target);
    pair.assembly.scale.setScalar(fit);
    pair.ghost.scale.setScalar(fit);
    lift.add(pair.ghost, pair.assembly);
    ghost = pair.ghost;
    if (!pair.sleepers) scaler.add(plinth(target * 0.62));
    lift.position.y = pair.sleepers ? 0 : 0.06;
    apply = (motion) => {
      const t = Math.tanh((motion || 0) / 110);
      const k = 1 + t * 0.1;
      const gap = (pair.restRight - pair.halfR) - (pair.restLeft + pair.halfL);
      const extra = (pair.halfL + pair.halfR) * (k - 1);
      const targetGap = Math.max(0.05, gap * (1 - t * 0.72));
      const close = (gap - extra - targetGap) / 2;
      pair.left.scale.x = k;
      pair.right.scale.x = k;
      pair.left.position.x = pair.restLeft + close;
      pair.right.position.x = pair.restRight - close;
      if (ghost) ghost.visible = (motion || 0) < -8;
      tintObject(pair.assembly, motion);
    };
  } else if (vessel) {
    const wallId = options.kind === "aparente" ? options.containerId : "vidrio";
    const liquidId = options.kind === "aparente" ? options.liquidId : options.materialId;
    const built = buildVessel(vessel, wallId, liquidId, glassMode);
    const fit = fitNumber(built.group, target);
    built.group.scale.setScalar(fit);
    lift.add(built.group);
    scaler.add(plinth(target * 0.58));
    lift.position.y = 0.06;
    apply = (motion) => {
      setLevel(built.liquid, built.surface, motion);
      tintObject(built.group, motion);
    };
  } else {
    const piece = chunkMesh(options.materialId, options.expansion || options.kind, options.asDisk, glassMode);
    const holder = new THREE.Group();
    holder.add(piece);
    markEdges(holder);
    groundCenter(holder);
    const edges = makeEdges(holder);
    const fit = fitNumber(holder, target);
    ghost = edges;
    apply = (motion) => {
      const factor = growth(options.expansion || options.kind, motion);
      holder.scale.set(fit * factor.x, fit * factor.y, fit * factor.z);
      edges.visible = (motion || 0) < -8;
      tintObject(holder, motion);
    };
    holder.scale.setScalar(fit);
    edges.scale.setScalar(fit);
    lift.add(edges, holder);
    scaler.add(plinth(target * 0.62));
    lift.position.y = 0.06;
    apply(0);
  }

  shade(lift);
  scaler.add(lift);
  return { scaler, apply, ghost };
}

function topOf(object) {
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object).max.y;
}

function buildContent(spec, glassMode) {
  const content = new THREE.Group();
  const parts = [];

  if (spec.kind === "comparar") {
    const items = spec.items || [];
    const spacing = 2.25;
    items.forEach((item, index) => {
      const holder = new THREE.Group();
      const wrapped = buildWrapped({
        materialId: item.materialId,
        kind: spec.expansion,
        expansion: spec.expansion,
        compareItem: true,
        asDisk: false,
        pair: false,
      }, glassMode);
      holder.add(wrapped.scaler);
      const label = makeLabel(pretty(item.materialId, item.label));
      holder.add(label);
      holder.position.x = (index - (items.length - 1) / 2) * spacing;
      content.add(holder);
      parts.push({
        apply: wrapped.apply,
        placeLabel: () => {
          label.position.y = topOf(wrapped.scaler) + 0.16;
        },
        setSize: (size) => {
          wrapped.scaler.scale.setScalar(measureScale(size));
        },
      });
    });
  } else if (!spec.empty) {
    const wrapped = buildWrapped({
      materialId: spec.materialId,
      kind: spec.kind,
      expansion: spec.kind,
      asDisk: Boolean(spec.asDisk),
      pair: spec.kind === "lineal",
      liquidId: spec.liquidId,
      containerId: spec.containerId,
    }, glassMode);
    content.add(wrapped.scaler);
    parts.push({
      apply: wrapped.apply,
      placeLabel: () => {},
      setSize: (size) => {
        wrapped.scaler.scale.setScalar(measureScale(size));
      },
    });
  } else {
    content.add(plinth(0.9));
  }

  return { content, parts };
}

function specKey(spec) {
  if (!spec || spec.empty) return "empty";
  if (spec.kind === "comparar") {
    const ids = (spec.items || []).map((item) => item.materialId).join(",");
    return `comparar|${spec.expansion}|${ids}`;
  }
  return [spec.kind, spec.materialId || "", spec.asDisk ? "disk" : "", spec.liquidId || "", spec.containerId || ""].join("|");
}

function applySpec(view) {
  const spec = view.spec;
  if (!spec || !view.parts) return;
  if (spec.kind === "comparar") {
    (spec.items || []).forEach((item, index) => {
      const part = view.parts[index];
      if (!part) return;
      part.setSize(item.size);
      part.apply(item.motion);
      part.placeLabel();
    });
    return;
  }
  const part = view.parts[0];
  if (!part) return;
  part.setSize(spec.size);
  part.apply(spec.motion);
  part.placeLabel();
}

function frame(view) {
  view.content.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(view.content);
  if (box.isEmpty()) {
    view.controls.target.set(0, 0.4, 0);
    view.camera.position.set(1.8, 1.3, 2.4);
  } else {
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const fov = (view.camera.fov * Math.PI) / 180;
  const aspect = Math.max(view.camera.aspect || 1.5, 0.8);
  const distH = (Math.max(size.y, 0.25) * 0.5) / Math.tan(fov / 2);
  const distW = (Math.max(size.x, size.z, 0.25) * 0.5) / (Math.tan(fov / 2) * aspect);
  const dist = Math.max(distH, distW) * 1.7;
  const offset = new THREE.Vector3().setFromSpherical(new THREE.Spherical(dist, 1.12, 0.72));
    view.controls.target.copy(center);
    view.camera.position.copy(center).add(offset);
  view.controls.minDistance = dist * 0.4;
  view.controls.maxDistance = dist * 6;
  }
  view.controls.update();
  view.home = {
    position: view.camera.position.clone(),
    target: view.controls.target.clone(),
  };
  view.controls.autoRotate = allowSpin();
}

function paintTheme(view) {
  const dark = isDark();
  view.renderer.setClearColor(dark ? 0x221c18 : 0xf7f1e8, 1);
  if (view.ground) view.ground.material.color.set(dark ? 0x2a241f : 0xe7dccb);
  if (view.hemi) {
    view.hemi.color.set(dark ? 0xd9cbb8 : 0xfff7f0);
    view.hemi.groundColor.set(dark ? 0x3a332e : 0xdccdb8);
  }
  view.scene.traverse((child) => {
    if (child.name === "plinth" && child.material && child.material.color) {
      child.material.color.set(dark ? 0x3c342c : 0xe6d7c6);
    }
    if (child.name === "mark" && child.material && child.material.color) {
      child.material.color.set(dark ? 0xf0b198 : 0xa34b28);
    }
    if (child.material && child.material.isLineBasicMaterial) {
      child.material.color.set(dark ? 0xd9cfc3 : 0x6e6258);
    }
    if (child.name === "label" && child.userData.text) {
      const next = labelTexture(child.userData.text, dark);
      const previous = child.material.map;
      child.material.map = next;
      if (previous) previous.dispose();
    }
  });
}

function resize(view) {
  const width = view.el.clientWidth;
  const height = view.el.clientHeight;
  if (width < 2 || height < 2) return;
  if (view.w === width && view.h === height) return;
  view.w = width;
  view.h = height;
  view.renderer.setSize(width, height, false);
  view.camera.aspect = width / height;
  view.camera.updateProjectionMatrix();
  if (view.needsReframe) {
    view.needsReframe = false;
    frame(view);
  }
}

function renderView(view) {
  if (!view.renderer || view.host.closest("[hidden]")) return;
  resize(view);
  if (!view.w) return;
  view.controls.update();
  view.renderer.render(view.scene, view.camera);
}

function loop() {
  requestAnimationFrame(loop);
  views.forEach(renderView);
}

function makeEnvironment(renderer) {
  const room = new THREE.Scene();
  room.add(new THREE.HemisphereLight(0xfff4ec, 0xc5d0de, 1));
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(6, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xe7eef5, side: THREE.BackSide }),
  );
  const warm = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 4),
    new THREE.MeshBasicMaterial({ color: 0xffc8aa }),
  );
  warm.position.set(2.5, 2, -3);
  warm.lookAt(0, 1, 0);
  const cool = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 3),
    new THREE.MeshBasicMaterial({ color: 0xc9daf8 }),
  );
  cool.position.set(-3, 1.4, 2.5);
  cool.lookAt(0, 1, 0);
  room.add(shell, warm, cool);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(room, 0.04).texture;
  pmrem.dispose();
  shell.geometry.dispose();
  shell.material.dispose();
  warm.geometry.dispose();
  warm.material.dispose();
  cool.geometry.dispose();
  cool.material.dispose();
  return texture;
}

function ensure(host) {
  if (host._stage) return host._stage;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  } catch (error) {
    host._stage = { failed: true };
    return host._stage;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = "stage-canvas";
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute("role", "img");

  host.classList.add("stage");
  host.replaceChildren();
  const el = document.createElement("div");
  el.className = "stage-view";
  const title = document.createElement("p");
  title.className = "stage-title";
  const hint = document.createElement("p");
  hint.className = "stage-hint";
  hint.textContent = "Arrastrá para girar · la rueda acerca";
  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "stage-reset";
  reset.textContent = "Vista inicial";
  const caption = document.createElement("figcaption");
  el.append(renderer.domElement, title, hint, reset);
  host.append(el, caption);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.zoomToCursor = true;
  controls.autoRotate = allowSpin();
  controls.autoRotateSpeed = 0.7;
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  controls.minPolarAngle = 0.2;
  controls.target.set(0, 0.7, 0);
  camera.position.set(2.5, 1.6, 3.2);

  const hemi = new THREE.HemisphereLight(0xfff7f0, 0xdccdb8, 0.9);
  const ambient = new THREE.AmbientLight(0xffffff, 0.28);
  const key = new THREE.DirectionalLight(0xfff8f2, 2.6);
  key.position.set(4.5, 7.5, 3.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.4;
  key.shadow.camera.far = 18;
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -6;
  key.shadow.bias = -0.0004;
  const fill = new THREE.DirectionalLight(0xd7e4f8, 0.85);
  fill.position.set(-4, 2.5, -2);
  scene.add(hemi, ambient, key, fill);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(8, 48),
    new THREE.MeshStandardMaterial({ color: 0xe7dccb, roughness: 1, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.001;
  ground.receiveShadow = true;
  ground.name = "ground";
  scene.add(ground);

  let glassMode = "soft";
  try {
    scene.environment = makeEnvironment(renderer);
    glassMode = "clear";
  } catch (error) {
    glassMode = "soft";
  }

  const view = {
    host,
    el,
    title,
    caption,
    renderer,
    scene,
    camera,
    controls,
    hemi,
    ground,
    glassMode,
    content: null,
    parts: [],
    spec: null,
    key: "",
    home: null,
    w: 0,
    h: 0,
    failed: false,
  };
  host._stage = view;
  views.add(view);

  renderer.domElement.addEventListener("pointerdown", () => {
    controls.autoRotate = false;
  });
  renderer.domElement.addEventListener("contextmenu", (event) => event.preventDefault());
  renderer.domElement.addEventListener("keydown", (event) => {
    const turn = { ArrowLeft: -0.12, ArrowRight: 0.12 };
    const lift = { ArrowUp: -0.08, ArrowDown: 0.08 };
    if (turn[event.key] == null && lift[event.key] == null) return;
    event.preventDefault();
    controls.autoRotate = false;
    const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    if (turn[event.key] != null) spherical.theta += turn[event.key];
    if (lift[event.key] != null) {
      spherical.phi = Math.min(controls.maxPolarAngle, Math.max(controls.minPolarAngle, spherical.phi + lift[event.key]));
    }
    offset.setFromSpherical(spherical);
    camera.position.copy(controls.target).add(offset);
    controls.update();
  });
  reset.addEventListener("click", () => {
    if (!view.home) return;
    camera.position.copy(view.home.position);
    controls.target.copy(view.home.target);
    controls.autoRotate = allowSpin();
    controls.update();
  });

  const observer = new ResizeObserver(() => resize(view));
  observer.observe(el);
  paintTheme(view);
  if (!looping) {
    looping = true;
    loop();
  }
  return view;
}

function show(host, spec, caption) {
  const view = ensure(host);
  if (!view || view.failed) return false;
  const next = spec || { empty: true };
  const key = specKey(next);
  view.spec = next;
  if (view.key !== key) {
    if (view.content) {
      view.scene.remove(view.content);
      disposeObject(view.content);
    }
    const built = buildContent(next, view.glassMode);
    view.content = built.content;
    view.parts = built.parts;
    view.scene.add(view.content);
    view.key = key;
    applySpec(view);
    paintTheme(view);
      resize(view);
    frame(view);
    view.needsReframe = !view.w;
  } else {
    applySpec(view);
  }
  const title = titleFor(next);
  view.title.textContent = title;
  view.title.hidden = !title;
  if (view.caption.textContent !== (caption || "")) view.caption.textContent = caption || "";
  const aria = title
    ? `${title}. Figura 3D: arrastrá para girar, la rueda acerca y las flechas giran si la figura está enfocada.`
    : "Figura 3D vacía.";
  if (view.aria !== aria) {
    view.renderer.domElement.setAttribute("aria-label", aria);
    view.aria = aria;
  }
  return true;
}

function syncTheme() {
  views.forEach(paintTheme);
}

function resizeAll() {
  views.forEach(resize);
}

window.Scene3D = { show, syncTheme, resizeAll };
