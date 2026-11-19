import * as THREE from 'three';
import { MapId } from './types';

export interface MapTextures {
  floorMap: THREE.CanvasTexture;
  floorRoughnessMap: THREE.CanvasTexture;
  wallMap: THREE.CanvasTexture;
  crateMap: THREE.CanvasTexture;
  skyMap: THREE.CanvasTexture;
  billboardMap?: THREE.CanvasTexture;
  waterMap?: THREE.CanvasTexture;
  glowSpriteMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  dispose: () => void;
}

export function createMapTextures(
  mapId: MapId,
  maxAnisotropy: number
): MapTextures {
  const floorMap = createFloorTexture(mapId, maxAnisotropy);
  const floorRoughnessMap = createRoughnessTexture(mapId, maxAnisotropy);
  const wallMap = createWallTexture(mapId, maxAnisotropy);
  const crateMap = createCrateTexture(mapId, maxAnisotropy);
  const skyMap = createSkyTexture(mapId);
  const glowSpriteMap = createRadialGlowTexture();
  const contactShadowMap = createContactShadowTexture();
  const billboardMap =
    mapId === 'FUTURE_CITY' || mapId === 'CYBER_ARENA'
      ? createBillboardTexture(mapId, maxAnisotropy)
      : undefined;
  const waterMap =
    mapId === 'JUNGLE_FACILITY' ? createWaterTexture(maxAnisotropy) : undefined;

  return {
    floorMap,
    floorRoughnessMap,
    wallMap,
    crateMap,
    skyMap,
    billboardMap,
    waterMap,
    glowSpriteMap,
    contactShadowMap,
    dispose: () => {
      floorMap.dispose();
      floorRoughnessMap.dispose();
      wallMap.dispose();
      crateMap.dispose();
      skyMap.dispose();
      billboardMap?.dispose();
      waterMap?.dispose();
      glowSpriteMap.dispose();
      contactShadowMap.dispose();
    },
  };
}

function createFloorTexture(
  mapId: MapId,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  if (mapId === 'DESERT_BASE') {
    // Sun-baked compacted desert sand with wind ripples and grit
    ctx.fillStyle = '#c89e6d';
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 16) {
      ctx.fillStyle = y % 32 === 0 ? 'rgba(166, 118, 66, 0.22)' : 'rgba(244, 214, 168, 0.16)';
      ctx.fillRect(0, y, size, 8);
    }
    for (let i = 0; i < 2400; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(120, 82, 42, 0.25)' : 'rgba(255, 232, 195, 0.2)';
      ctx.fillRect(x, y, 2, 2);
    }
    // Subtle tactical concrete landing pad lines
    ctx.strokeStyle = 'rgba(92, 68, 42, 0.22)';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, size - 8, size - 8);
  } else if (mapId === 'JUNGLE_FACILITY') {
    // Rich tropical moss, soil, and weathered research stone tiles
    ctx.fillStyle = '#2d4732';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 1800; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 2 + Math.random() * 6;
      ctx.fillStyle =
        i % 3 === 0
          ? 'rgba(56, 102, 58, 0.35)'
          : i % 3 === 1
          ? 'rgba(34, 58, 36, 0.4)'
          : 'rgba(84, 118, 66, 0.25)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Weathered walkway stone seams
    ctx.strokeStyle = 'rgba(20, 34, 22, 0.35)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= size; i += 128) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }
  } else if (mapId === 'CYBER_ARENA') {
    // High-contrast glowing cybernetic arena circuit floor
    ctx.fillStyle = '#121024';
    ctx.fillRect(0, 0, size, size);
    const tile = 128;
    for (let y = 0; y < size; y += tile) {
      for (let x = 0; x < size; x += tile) {
        ctx.fillStyle = (x / tile + y / tile) % 2 === 0 ? '#181430' : '#131028';
        ctx.fillRect(x + 3, y + 3, tile - 6, tile - 6);
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.42)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 6, y + 6, tile - 12, tile - 12);
      }
    }
    // Glowing magenta & cyan neon cross lines
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.stroke();
    ctx.strokeStyle = '#06b6d4';
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.stroke();
  } else if (mapId === 'SPACE_STATION') {
    // High-tech titanium starship deck plating with safety rivets
    ctx.fillStyle = '#222c3c';
    ctx.fillRect(0, 0, size, size);
    const tile = 128;
    for (let y = 0; y < size; y += tile) {
      for (let x = 0; x < size; x += tile) {
        ctx.fillStyle = (x / tile + y / tile) % 2 === 0 ? '#2b374a' : '#243042';
        ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 8, y + 8, tile - 16, tile - 16);
        // Deck tread ribs
        ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
        for (let r = 20; r < tile - 20; r += 16) {
          ctx.fillRect(x + 20, y + r, tile - 40, 4);
        }
      }
    }
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, size - 4, size - 4);
  } else {
    // FUTURE_CITY: Sleek futuristic dark asphalt & luminous lane tiles
    ctx.fillStyle = '#1e2736';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 1200; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.12)';
      ctx.fillRect(Math.random() * size, Math.random() * size, 3, 3);
    }
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 4;
    for (let i = 0; i <= size; i += 128) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }
    // Crisp glowing city road guide accent
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, size / 2);
    ctx.lineTo(size, size / 2);
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createRoughnessTexture(
  mapId: MapId,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const base =
    mapId === 'DESERT_BASE' || mapId === 'JUNGLE_FACILITY'
      ? '#c8c8c8'
      : mapId === 'CYBER_ARENA'
      ? '#555555'
      : '#7d7d7d';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  const tile = 64;
  for (let y = 0; y < size; y += tile) {
    for (let x = 0; x < size; x += tile) {
      ctx.fillStyle = (x / tile + y / tile) % 2 === 0 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)';
      ctx.fillRect(x + 3, y + 3, tile - 6, tile - 6);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createWallTexture(
  mapId: MapId,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  if (mapId === 'DESERT_BASE') {
    ctx.fillStyle = '#b9976b';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#785e40';
    ctx.fillRect(0, size * 0.72, size, size * 0.28);
    // Corrugated steel bunker seams
    ctx.strokeStyle = '#624b31';
    ctx.lineWidth = 4;
    for (let x = 0; x <= size; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    // Caution stripe
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, size * 0.7, size, 10);
  } else if (mapId === 'SPACE_STATION') {
    ctx.fillStyle = '#d3dfed';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, size * 0.68, size, size * 0.32);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 4;
    for (let x = 0; x <= size; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(0, size * 0.66, size, 8);
  } else if (mapId === 'JUNGLE_FACILITY') {
    ctx.fillStyle = '#d4e2dd';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#2d4f43';
    ctx.fillRect(0, size * 0.72, size, size * 0.28);
    ctx.fillStyle = '#10b981';
    ctx.fillRect(0, size * 0.7, size, 7);
    ctx.strokeStyle = '#6c877c';
    ctx.lineWidth = 3;
    for (let x = 0; x <= size; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
  } else if (mapId === 'CYBER_ARENA') {
    ctx.fillStyle = '#1e1b38';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, size - 20, size - 20);
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(0, size * 0.5 - 6, size, 12);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 2;
    for (let x = 64; x < size; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
  } else {
    // FUTURE_CITY skyscraper glass & illuminated windows
    ctx.fillStyle = '#1b2b44';
    ctx.fillRect(0, 0, size, size);
    for (let y = 16; y < size - 16; y += 36) {
      for (let x = 16; x < size - 16; x += 48) {
        const lit = (x * 7 + y * 13) % 5 !== 0;
        ctx.fillStyle = lit
          ? (x + y) % 3 === 0
            ? '#38bdf8'
            : '#bae6fd'
          : '#0f172a';
        ctx.fillRect(x, y, 32, 20);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createCrateTexture(
  mapId: MapId,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const base =
    mapId === 'DESERT_BASE'
      ? '#6b5a42'
      : mapId === 'JUNGLE_FACILITY'
      ? '#355446'
      : mapId === 'CYBER_ARENA'
      ? '#241b40'
      : '#334155';
  const accent =
    mapId === 'DESERT_BASE'
      ? '#f59e0b'
      : mapId === 'JUNGLE_FACILITY'
      ? '#10b981'
      : mapId === 'CYBER_ARENA'
      ? '#f43f5e'
      : '#38bdf8';

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(20, 20, size - 40, size - 40);
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.75)';
  ctx.lineWidth = 6;
  ctx.strokeRect(20, 20, size - 40, size - 40);

  // Hazard / energy band
  ctx.fillStyle = accent;
  ctx.fillRect(28, size - 64, size - 56, 22);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  for (let i = 28; i < size - 28; i += 28) {
    ctx.fillRect(i, size - 64, 10, 22);
  }

  // Top emblem bar
  ctx.fillStyle = accent;
  ctx.fillRect(size / 2 - 28, 42, 56, 8);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createBillboardTexture(
  mapId: MapId,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, w, h);
  if (mapId === 'CYBER_ARENA') {
    grad.addColorStop(0, '#3b0764');
    grad.addColorStop(0.5, '#be123c');
    grad.addColorStop(1, '#0e7490');
  } else {
    grad.addColorStop(0, '#082f49');
    grad.addColorStop(0.5, '#0284c7');
    grad.addColorStop(1, '#0f172a');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Clean futuristic geometric lines
  ctx.strokeStyle = 'rgba(224, 242, 254, 0.5)';
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, w - 28, h - 28);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 54px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(mapId === 'CYBER_ARENA' ? 'CYBER ARENA' : 'NOVA CITY', w / 2, 118);

  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(
    mapId === 'CYBER_ARENA' ? 'HYPER PULSE CHAMPIONSHIP' : 'CLEAN ENERGY DISTRICT 09',
    w / 2,
    172
  );

  // Horizontal scan lines
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = 0; y < h; y += 8) {
    ctx.fillRect(0, y, w, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createWaterTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#0284c7');
  grad.addColorStop(0.5, '#0ea5e9');
  grad.addColorStop(1, '#0369a1');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(224, 242, 254, 0.45)';
  ctx.lineWidth = 3;
  for (let y = 16; y < size; y += 28) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.quadraticCurveTo(size * 0.25, y - 8, size * 0.5, y);
    ctx.quadraticCurveTo(size * 0.75, y + 8, size, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 6);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createSkyTexture(mapId: MapId): THREE.CanvasTexture {
  const w = 512;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  if (mapId === 'DESERT_BASE') {
    grad.addColorStop(0.0, '#1e5b96');
    grad.addColorStop(0.35, '#5998c5');
    grad.addColorStop(0.58, '#f0c48b');
    grad.addColorStop(0.7, '#d9985b');
    grad.addColorStop(1.0, '#9e683b');
  } else if (mapId === 'SPACE_STATION') {
    grad.addColorStop(0.0, '#02040a');
    grad.addColorStop(0.4, '#081226');
    grad.addColorStop(0.65, '#132445');
    grad.addColorStop(1.0, '#040814');
  } else if (mapId === 'JUNGLE_FACILITY') {
    grad.addColorStop(0.0, '#134e6f');
    grad.addColorStop(0.35, '#3b9ab2');
    grad.addColorStop(0.6, '#9fd5c2');
    grad.addColorStop(0.74, '#4b7c68');
    grad.addColorStop(1.0, '#1e382b');
  } else if (mapId === 'CYBER_ARENA') {
    grad.addColorStop(0.0, '#090517');
    grad.addColorStop(0.38, '#1e1042');
    grad.addColorStop(0.58, '#581c5c');
    grad.addColorStop(0.68, '#0e4c6e');
    grad.addColorStop(1.0, '#0d091f');
  } else {
    // FUTURE_CITY twilight skyline
    grad.addColorStop(0.0, '#07142b');
    grad.addColorStop(0.28, '#122f5e');
    grad.addColorStop(0.52, '#2d689c');
    grad.addColorStop(0.64, '#d98a5b');
    grad.addColorStop(0.74, '#243a59');
    grad.addColorStop(1.0, '#0f172a');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  if (mapId === 'SPACE_STATION') {
    // Rich starfield + glowing blue-violet nebula band
    const neb = ctx.createRadialGradient(w * 0.65, h * 0.38, 12, w * 0.65, h * 0.38, 175);
    neb.addColorStop(0, 'rgba(56, 189, 248, 0.42)');
    neb.addColorStop(0.5, 'rgba(139, 92, 246, 0.2)');
    neb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 420; i++) {
      const sx = Math.random() * w;
      const sy = Math.random() * h * 0.85;
      const r = Math.random() * 1.4 + 0.3;
      ctx.fillStyle = `rgba(224, 242, 254, ${(0.3 + Math.random() * 0.7).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (mapId === 'DESERT_BASE' || mapId === 'JUNGLE_FACILITY' || mapId === 'FUTURE_CITY') {
    // Warm sun disc glow
    const sunY = mapId === 'DESERT_BASE' ? h * 0.44 : h * 0.56;
    const sun = ctx.createRadialGradient(w * 0.28, sunY, 6, w * 0.28, sunY, 130);
    sun.addColorStop(0, 'rgba(255, 250, 232, 0.96)');
    sun.addColorStop(0.28, 'rgba(255, 214, 145, 0.48)');
    sun.addColorStop(1, 'rgba(255, 190, 100, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createRadialGlowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.28, 'rgba(186, 230, 253, 0.85)');
  grad.addColorStop(0.58, 'rgba(56, 189, 248, 0.3)');
  grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(2, 6, 23, 0.65)');
  grad.addColorStop(0.55, 'rgba(2, 6, 23, 0.28)');
  grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
