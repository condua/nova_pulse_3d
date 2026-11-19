import * as THREE from 'three';
import { MapId } from './types';
import { MapTextures } from './textures';

export interface ArenaCollider {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  isDynamic?: boolean;
}

export interface SpawnAnchor {
  position: THREE.Vector3;
  kind: 'GROUND' | 'PLATFORM' | 'AERIAL';
  patrolAxis?: 'x' | 'z';
  patrolRange?: number;
}

interface DynamicSlidingDoor {
  leftPanel: THREE.Mesh;
  rightPanel: THREE.Mesh;
  center: THREE.Vector3;
  axis: 'x' | 'z';
  openAmount: number;
  collider: ArenaCollider;
  closedBounds: ArenaCollider;
}

interface MovingBarrier {
  mesh: THREE.Mesh;
  collider: ArenaCollider;
  origin: THREE.Vector3;
  axis: 'x' | 'z';
  range: number;
  speed: number;
  phase: number;
  halfW: number;
  halfD: number;
}

export interface ArenaBuildResult {
  mapId: MapId;
  group: THREE.Group;
  colliders: ArenaCollider[];
  raycastObstacles: THREE.Object3D[];
  spawnAnchors: SpawnAnchor[];
  pickupAnchors: THREE.Vector3[];
  bossAnchor: THREE.Vector3;
  playerSpawn: THREE.Vector3;
  arenaRadius: number;
  lightingConfig: {
    hemiSky: number;
    hemiGround: number;
    hemiIntensity: number;
    keyColor: number;
    keyIntensity: number;
    keyPos: [number, number, number];
    rimColor: number;
    rimIntensity: number;
  };
  update: (dt: number, elapsed: number, playerPos: THREE.Vector3) => void;
  dispose: () => void;
}

export function buildMapArena(
  mapId: MapId,
  textures: MapTextures
): ArenaBuildResult {
  const group = new THREE.Group();
  const colliders: ArenaCollider[] = [];
  const raycastObstacles: THREE.Object3D[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const spinningObjects: { obj: THREE.Object3D; axis: 'x' | 'y' | 'z'; speed: number }[] = [];
  const doors: DynamicSlidingDoor[] = [];
  const movingBarriers: MovingBarrier[] = [];
  const pulsingLights: { mat: THREE.MeshStandardMaterial; base: number; speed: number }[] = [];
  let ambientParticles: THREE.Points | null = null;
  let waterTexture: THREE.CanvasTexture | undefined = textures.waterMap;

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  const addSolidBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    yBottom: number,
    z: number,
    mat: THREE.Material,
    castShadow = true,
    registerCollider = true
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(w, h, d)), mat);
    mesh.position.set(x, yBottom + h / 2, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    group.add(mesh);
    raycastObstacles.push(mesh);
    if (registerCollider) {
      colliders.push({
        minX: x - w / 2,
        maxX: x + w / 2,
        minY: yBottom,
        maxY: yBottom + h,
        minZ: z - d / 2,
        maxZ: z + d / 2,
      });
    }
    return mesh;
  };

  // Sky Dome
  const skyDome = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(280, 32, 20)),
    trackMat(
      new THREE.MeshBasicMaterial({
        map: textures.skyMap,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      })
    )
  );
  group.add(skyDome);

  // Common PBR Materials
  const floorMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.floorMap,
      roughnessMap: textures.floorRoughnessMap,
      roughness: mapId === 'DESERT_BASE' ? 0.88 : mapId === 'CYBER_ARENA' ? 0.42 : 0.62,
      metalness: mapId === 'DESERT_BASE' || mapId === 'JUNGLE_FACILITY' ? 0.1 : 0.35,
    })
  );
  const wallMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.wallMap,
      roughness: 0.45,
      metalness: mapId === 'DESERT_BASE' ? 0.2 : 0.38,
    })
  );
  const crateMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.crateMap,
      roughness: 0.52,
      metalness: 0.36,
    })
  );
  const lightMetalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdbe5f2,
      roughness: 0.32,
      metalness: 0.34,
    })
  );
  const darkMetalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.5,
      metalness: 0.72,
    })
  );
  const cyanGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 2.2,
      roughness: 0.2,
    })
  );
  const amberGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.0,
      roughness: 0.2,
    })
  );
  const pinkGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfb7185,
      emissive: 0xf43f5e,
      emissiveIntensity: 2.3,
      roughness: 0.18,
    })
  );
  const emeraldGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: 0x10b981,
      emissiveIntensity: 2.0,
      roughness: 0.2,
    })
  );

  const arenaHalf = 40;
  // Extended outer ground so world never looks like a floating box
  const outerGroundColor =
    mapId === 'DESERT_BASE'
      ? 0xb58652
      : mapId === 'JUNGLE_FACILITY'
      ? 0x1f3824
      : mapId === 'SPACE_STATION'
      ? 0x070d1c
      : mapId === 'CYBER_ARENA'
      ? 0x0e0a20
      : 0x111a2c;
  const outerFloor = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(460, 460)),
    trackMat(
      new THREE.MeshStandardMaterial({
        color: outerGroundColor,
        roughness: 0.9,
        metalness: 0.1,
      })
    )
  );
  outerFloor.rotation.x = -Math.PI / 2;
  outerFloor.position.y = -0.08;
  outerFloor.receiveShadow = true;
  group.add(outerFloor);

  // Main Arena Playable Floor
  const mainFloor = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(arenaHalf * 2, arenaHalf * 2)),
    floorMat
  );
  mainFloor.rotation.x = -Math.PI / 2;
  mainFloor.receiveShadow = true;
  group.add(mainFloor);
  raycastObstacles.push(mainFloor);

  // Ambient floating atmospheric particles (dust / embers / energy motes / fireflies)
  const particleCount = 180;
  const pPositions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    pPositions[i * 3] = (Math.random() - 0.5) * 74;
    pPositions[i * 3 + 1] = 1.2 + Math.random() * 14;
    pPositions[i * 3 + 2] = (Math.random() - 0.5) * 74;
  }
  const pGeo = trackGeo(new THREE.BufferGeometry());
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
  const pColor =
    mapId === 'DESERT_BASE'
      ? 0xfde68a
      : mapId === 'JUNGLE_FACILITY'
      ? 0x6ee7b7
      : mapId === 'CYBER_ARENA'
      ? 0xf472b6
      : 0x7dd3fc;
  const pMat = trackMat(
    new THREE.PointsMaterial({
      color: pColor,
      size: mapId === 'DESERT_BASE' ? 0.24 : 0.2,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  ambientParticles = new THREE.Points(pGeo, pMat);
  group.add(ambientParticles);

  // Map-specific lighting defaults
  let lightingConfig: ArenaBuildResult['lightingConfig'] = {
    hemiSky: 0x8ec5fc,
    hemiGround: 0x1e293b,
    hemiIntensity: 0.95,
    keyColor: 0xffe7c2,
    keyIntensity: 1.8,
    keyPos: [38, 56, 26],
    rimColor: 0x38bdf8,
    rimIntensity: 0.65,
  };

  const spawnAnchors: SpawnAnchor[] = [];
  const pickupAnchors: THREE.Vector3[] = [];
  const bossAnchor = new THREE.Vector3(0, 0, -14);
  const playerSpawn = new THREE.Vector3(0, 1.72, 29);

  // Shared perimeter barrier helper
  const buildPerimeter = (height: number, glowMat: THREE.Material) => {
    const t = 2.0;
    const len = arenaHalf * 2 + t;
    addSolidBox(len, height, t, 0, 0, -arenaHalf, darkMetalMat, false);
    addSolidBox(len, height, t, 0, 0, arenaHalf, darkMetalMat, false);
    addSolidBox(t, height, len, -arenaHalf, 0, 0, darkMetalMat, false);
    addSolidBox(t, height, len, arenaHalf, 0, 0, darkMetalMat, false);

    const railGeo = trackGeo(new THREE.BoxGeometry(arenaHalf * 2, 0.16, 0.22));
    const n = new THREE.Mesh(railGeo, glowMat);
    n.position.set(0, height + 0.08, -arenaHalf + 0.9);
    const s = n.clone();
    s.position.z = arenaHalf - 0.9;
    const w = n.clone();
    w.rotation.y = Math.PI / 2;
    w.position.set(-arenaHalf + 0.9, height + 0.08, 0);
    const e = w.clone();
    e.position.x = arenaHalf - 0.9;
    group.add(n, s, w, e);
  };

  /* ======================================================================== */
  /*  MAP 1: FUTURE CITY                                                      */
  /* ======================================================================== */
  if (mapId === 'FUTURE_CITY') {
    buildPerimeter(3.2, cyanGlowMat);

    // Wide neon avenue strips
    const roadLineGeo = trackGeo(new THREE.BoxGeometry(0.45, 0.04, 74));
    const roadL = new THREE.Mesh(roadLineGeo, cyanGlowMat);
    roadL.position.set(-7.5, 0.02, 0);
    const roadR = new THREE.Mesh(roadLineGeo, cyanGlowMat);
    roadR.position.set(7.5, 0.02, 0);
    group.add(roadL, roadR);

    // 4 Urban High-Rise Buildings inside corners with illuminated windows + rooftop billboards
    const bldgMat = wallMat;
    const billboardMat = trackMat(
      new THREE.MeshBasicMaterial({
        map: textures.billboardMap,
        side: THREE.DoubleSide,
      })
    );

    const towers: [number, number, number][] = [
      [-28, -28, 22],
      [28, -28, 26],
      [-28, 26, 20],
      [28, 26, 24],
    ];
    towers.forEach(([tx, tz, th], idx) => {
      addSolidBox(12, th, 12, tx, 0, tz, bldgMat);
      const cap = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(12.4, 0.6, 12.4)),
        idx % 2 === 0 ? cyanGlowMat : amberGlowMat
      );
      cap.position.set(tx, th + 0.3, tz);
      group.add(cap);

      // Glowing electronic billboard mounted facing the plaza
      const board = new THREE.Mesh(
        trackGeo(new THREE.PlaneGeometry(11, 5.2)),
        billboardMat
      );
      const towardX = tx < 0 ? 6.25 : -6.25;
      board.position.set(tx + towardX, 11.5, tz);
      board.rotation.y = tx < 0 ? Math.PI / 2 : -Math.PI / 2;
      group.add(board);
    });

    // Overhead futuristic skybridge crossing the main boulevard
    addSolidBox(2.4, 7.2, 3.0, -10.5, 0, -4, lightMetalMat);
    addSolidBox(2.4, 7.2, 3.0, 10.5, 0, -4, lightMetalMat);
    addSolidBox(23.5, 1.4, 3.4, 0, 7.2, -4, darkMetalMat);
    const bridgeNeon = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(20, 0.24, 3.55)),
      cyanGlowMat
    );
    bridgeNeon.position.set(0, 7.9, -4);
    group.add(bridgeNeon);

    // Central raised plaza island & futuristic street cover (hover cars + bus shelters)
    addSolidBox(8.5, 0.5, 8.5, 0, 0, 10, darkMetalMat);
    addSolidBox(2.2, 2.2, 2.2, 0, 0.5, 10, lightMetalMat);
    const holoCrystal = new THREE.Mesh(
      trackGeo(new THREE.OctahedronGeometry(0.95, 0)),
      cyanGlowMat
    );
    holoCrystal.position.set(0, 4.1, 10);
    group.add(holoCrystal);
    spinningObjects.push({ obj: holoCrystal, axis: 'y', speed: 1.4 });

    // Street cover vehicles & urban planters
    const covers: [number, number, number, number, number][] = [
      [5.2, 1.5, 2.4, -14, -12],
      [5.2, 1.5, 2.4, 14, -12],
      [2.4, 1.6, 5.6, -15, 6],
      [2.4, 1.6, 5.6, 15, 6],
      [4.5, 1.35, 1.2, -5.5, -18],
      [4.5, 1.35, 1.2, 5.5, -18],
      [3.0, 2.0, 3.0, -24, 0],
      [3.0, 2.0, 3.0, 24, 0],
    ];
    covers.forEach(([w, h, d, cx, cz], i) => {
      addSolidBox(w, h, d, cx, 0, cz, i % 2 === 0 ? crateMat : lightMetalMat);
    });

    // Distant futuristic cityscape skyline
    const skyInst = new THREE.InstancedMesh(
      trackGeo(new THREE.BoxGeometry(1, 1, 1)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0x16243d, roughness: 0.65, metalness: 0.5 })),
      40
    );
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const dist = 66 + (i % 4) * 16;
      const bh = 24 + ((i * 19) % 58);
      dummy.position.set(Math.cos(a) * dist, bh / 2 - 0.5, Math.sin(a) * dist);
      dummy.scale.set(9 + (i % 3) * 4, bh, 9 + ((i + 1) % 3) * 4);
      dummy.updateMatrix();
      skyInst.setMatrixAt(i, dummy.matrix);
    }
    skyInst.instanceMatrix.needsUpdate = true;
    skyInst.computeBoundingSphere();
    group.add(skyInst);

    spawnAnchors.push(
      { position: new THREE.Vector3(-12, 0, -26), kind: 'GROUND', patrolAxis: 'x', patrolRange: 8 },
      { position: new THREE.Vector3(12, 0, -26), kind: 'GROUND', patrolAxis: 'x', patrolRange: 8 },
      { position: new THREE.Vector3(-26, 0, -10), kind: 'GROUND', patrolAxis: 'z', patrolRange: 9 },
      { position: new THREE.Vector3(26, 0, -10), kind: 'GROUND', patrolAxis: 'z', patrolRange: 9 },
      { position: new THREE.Vector3(-19, 0, 14), kind: 'GROUND', patrolAxis: 'x', patrolRange: 6 },
      { position: new THREE.Vector3(19, 0, 14), kind: 'GROUND', patrolAxis: 'x', patrolRange: 6 },
      { position: new THREE.Vector3(0, 0, -13), kind: 'GROUND', patrolAxis: 'x', patrolRange: 7 },
      { position: new THREE.Vector3(0, 6.2, -16), kind: 'AERIAL', patrolAxis: 'x', patrolRange: 14 },
      { position: new THREE.Vector3(-15, 5.5, 0), kind: 'AERIAL', patrolAxis: 'z', patrolRange: 12 },
      { position: new THREE.Vector3(15, 5.5, 0), kind: 'AERIAL', patrolAxis: 'z', patrolRange: 12 },
      { position: new THREE.Vector3(0, 8.8, 2), kind: 'AERIAL', patrolAxis: 'x', patrolRange: 12 },
      { position: new THREE.Vector3(-22, 6.6, -20), kind: 'AERIAL', patrolAxis: 'x', patrolRange: 8 },
      { position: new THREE.Vector3(22, 6.6, -20), kind: 'AERIAL', patrolAxis: 'z', patrolRange: 8 }
    );
  }

  /* ======================================================================== */
  /*  MAP 2: DESERT BASE                                                      */
  /* ======================================================================== */
  else if (mapId === 'DESERT_BASE') {
    lightingConfig = {
      hemiSky: 0xffe4b5,
      hemiGround: 0x8f6236,
      hemiIntensity: 1.05,
      keyColor: 0xfff0cc,
      keyIntensity: 2.3,
      keyPos: [44, 62, 22],
      rimColor: 0xf59e0b,
      rimIntensity: 0.55,
    };

    const sandConcreteMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xc2a882, roughness: 0.82, metalness: 0.12 })
    );
    const rustSteelMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x6b4c35, roughness: 0.62, metalness: 0.55 })
    );
    const desertRedContainer = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x9e3e2d, roughness: 0.58, metalness: 0.35 })
    );
    const desertTealContainer = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x2d666e, roughness: 0.58, metalness: 0.35 })
    );

    buildPerimeter(3.4, amberGlowMat);

    // Large Military Hangar Warehouse on North-West side (walk-through arch shelter)
    addSolidBox(1.8, 6.5, 16, -24, 0, -16, wallMat);
    addSolidBox(1.8, 6.5, 16, -10, 0, -16, wallMat);
    addSolidBox(16, 1.4, 16.5, -17, 6.5, -16, rustSteelMat);

    // 3 Tall Steel Watchtowers with Rotating Radar Dishes
    const towerCoords: [number, number][] = [
      [28, -26],
      [-28, 24],
      [28, 24],
    ];
    towerCoords.forEach(([tx, tz]) => {
      addSolidBox(5.5, 3.6, 5.5, tx, 0, tz, sandConcreteMat);
      addSolidBox(4.2, 6.4, 4.2, tx, 3.6, tz, rustSteelMat);
      addSolidBox(6.2, 1.2, 6.2, tx, 10.0, tz, sandConcreteMat);

      const radarPivot = new THREE.Group();
      radarPivot.position.set(tx, 12.2, tz);
      const pole = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.18, 0.25, 2.2, 8)),
        darkMetalMat
      );
      const dish = new THREE.Mesh(
        trackGeo(new THREE.ConeGeometry(1.8, 0.9, 12, 1, true)),
        lightMetalMat
      );
      dish.rotation.x = Math.PI * 0.35;
      dish.position.set(0, 1.2, 0.4);
      radarPivot.add(pole, dish);
      group.add(radarPivot);
      spinningObjects.push({ obj: radarPivot, axis: 'y', speed: 1.1 });
    });

    // Stacked Shipping Containers & Sandbag Bunkers across yard
    addSolidBox(7.2, 2.6, 2.8, 12, 0, -14, desertRedContainer);
    addSolidBox(7.2, 2.6, 2.8, 12, 2.6, -14, desertTealContainer);
    addSolidBox(2.8, 2.6, 7.2, 16, 0, 4, desertTealContainer);
    addSolidBox(7.2, 2.6, 2.8, -12, 0, 10, desertRedContainer);
    addSolidBox(3.4, 1.6, 3.4, 0, 0, -2, crateMat);
    addSolidBox(2.4, 1.4, 2.4, 3.2, 0, -2, crateMat);
    addSolidBox(5.5, 1.45, 1.3, 0, 0, 14, sandConcreteMat);
    addSolidBox(5.5, 1.45, 1.3, -16, 0, -2, sandConcreteMat);

    // Surrounding Desert Canyon Mesas & Dunes outside perimeter
    const mesaMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x9c663d, roughness: 0.92, metalness: 0.05 })
    );
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const dist = 68 + (i % 3) * 18;
      const h = 10 + (i % 5) * 6;
      const mesa = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(8 + (i % 4) * 3, 16 + (i % 4) * 4, h, 7)),
        mesaMat
      );
      mesa.position.set(Math.cos(a) * dist, h / 2 - 0.5, Math.sin(a) * dist);
      group.add(mesa);
    }

    spawnAnchors.push(
      { position: new THREE.Vector3(-17, 0, -16), kind: 'GROUND', patrolAxis: 'z', patrolRange: 6 },
      { position: new THREE.Vector3(6, 0, -26), kind: 'GROUND', patrolAxis: 'x', patrolRange: 11 },
      { position: new THREE.Vector3(24, 0, -6), kind: 'GROUND', patrolAxis: 'z', patrolRange: 9 },
      { position: new THREE.Vector3(-24, 0, 6), kind: 'GROUND', patrolAxis: 'z', patrolRange: 8 },
      { position: new THREE.Vector3(0, 0, 6), kind: 'GROUND', patrolAxis: 'x', patrolRange: 9 },
      { position: new THREE.Vector3(-6, 0, -12), kind: 'GROUND', patrolAxis: 'x', patrolRange: 6 },
      { position: new THREE.Vector3(12, 5.2, -14), kind: 'PLATFORM' },
      { position: new THREE.Vector3(0, 6.2, -14), kind: 'AERIAL', patrolAxis: 'x', patrolRange: 14 },
      { position: new THREE.Vector3(-16, 6.8, 0), kind: 'AERIAL', patrolAxis: 'z', patrolRange: 12 },
      { position: new THREE.Vector3(18, 6.0, 8), kind: 'AERIAL', patrolAxis: 'z', patrolRange: 10 },
      { position: new THREE.Vector3(0, 8.4, 8), kind: 'AERIAL', patrolAxis: 'x', patrolRange: 13 }
    );
  }

  /* ======================================================================== */
  /*  MAP 3: SPACE STATION                                                    */
  /* ======================================================================== */
  else if (mapId === 'SPACE_STATION') {
    lightingConfig = {
      hemiSky: 0x7dd3fc,
      hemiGround: 0x0f172a,
      hemiIntensity: 0.85,
      keyColor: 0xe0f2fe,
      keyIntensity: 1.65,
      keyPos: [25, 48, 25],
      rimColor: 0x06b6d4,
      rimIntensity: 0.95,
    };

    buildPerimeter(5.2, cyanGlowMat);

    // Distant Planet & Orbital Ring visible in deep space above station
    const planet = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(42, 28, 22)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x1d4ed8,
          emissive: 0x0c4a6e,
          emissiveIntensity: 0.45,
          roughness: 0.7,
          fog: false,
        })
      )
    );
    planet.position.set(-85, 62, -145);
    group.add(planet);

    const ring = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(62, 1.8, 8, 64)),
      trackMat(
        new THREE.MeshBasicMaterial({
          color: 0x7dd3fc,
          transparent: true,
          opacity: 0.42,
          fog: false,
        })
      )
    );
    ring.position.copy(planet.position);
    ring.rotation.set(Math.PI * 0.42, 0.35, 0.2);
    group.add(ring);
    spinningObjects.push({ obj: ring, axis: 'z', speed: 0.05 });

    // Central High-Tech Fusion Reactor Core
    addSolidBox(8, 0.6, 8, 0, 0, 0, darkMetalMat);
    const reactorBase = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(2.1, 2.6, 1.4, 12)),
      lightMetalMat
    );
    reactorBase.position.set(0, 1.3, 0);
    group.add(reactorBase);
    colliders.push({ minX: -2.4, maxX: 2.4, minY: 0, maxY: 7, minZ: -2.4, maxZ: 2.4 });

    const reactorTube = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(1.15, 1.15, 7.2, 16)),
      cyanGlowMat
    );
    reactorTube.position.set(0, 5.2, 0);
    group.add(reactorTube);
    raycastObstacles.push(reactorTube);

    const reactorGyro = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(2.3, 0.14, 10, 28)),
      amberGlowMat
    );
    reactorGyro.position.set(0, 4.8, 0);
    group.add(reactorGyro);
    spinningObjects.push({ obj: reactorGyro, axis: 'y', speed: 1.8 });
    spinningObjects.push({ obj: reactorGyro, axis: 'x', speed: 0.9 });

    // Overhead Station Structural Ribs (high-tech corridor canopy)
    for (let z = -26; z <= 26; z += 13) {
      addSolidBox(1.6, 9.5, 1.6, -34, 0, z, wallMat);
      addSolidBox(1.6, 9.5, 1.6, 34, 0, z, wallMat);
      const beam = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(70, 0.9, 1.2)),
        darkMetalMat
      );
      beam.position.set(0, 9.6, z);
      group.add(beam);
    }

    // Pressurized Bulkhead Partitions with AUTOMATIC SLIDING DOORS!
    const doorMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.35,
        metalness: 0.78,
      })
    );
    const warningMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 2.5,
      })
    );
    pulsingLights.push({ mat: warningMat, base: 2.2, speed: 5.0 });

    const addBulkheadWithDoor = (cx: number, cz: number, axis: 'x' | 'z') => {
      if (axis === 'x') {
        addSolidBox(9, 4.8, 1.4, cx - 8.2, 0, cz, wallMat);
        addSolidBox(9, 4.8, 1.4, cx + 8.2, 0, cz, wallMat);
        addSolidBox(7.4, 1.1, 1.6, cx, 4.1, cz, darkMetalMat);
        // Warning beacon above door
        const lamp = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.4, 0.25, 1.7)), warningMat);
        lamp.position.set(cx, 4.7, cz);
        group.add(lamp);

        const leftPanel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.6, 4.0, 0.55)), doorMat);
        leftPanel.position.set(cx - 1.8, 2.0, cz);
        const rightPanel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.6, 4.0, 0.55)), doorMat);
        rightPanel.position.set(cx + 1.8, 2.0, cz);
        group.add(leftPanel, rightPanel);
        raycastObstacles.push(leftPanel, rightPanel);

        const closedBounds: ArenaCollider = {
          minX: cx - 3.6,
          maxX: cx + 3.6,
          minY: 0,
          maxY: 4.0,
          minZ: cz - 0.5,
          maxZ: cz + 0.5,
          isDynamic: true,
        };
        const collider: ArenaCollider = { ...closedBounds };
        colliders.push(collider);
        doors.push({
          leftPanel,
          rightPanel,
          center: new THREE.Vector3(cx, 2, cz),
          axis,
          openAmount: 0,
          collider,
          closedBounds,
        });
      } else {
        addSolidBox(1.4, 4.8, 9, cx, 0, cz - 8.2, wallMat);
        addSolidBox(1.4, 4.8, 9, cx, 0, cz + 8.2, wallMat);
        addSolidBox(1.6, 1.1, 7.4, cx, 4.1, cz, darkMetalMat);
        const lamp = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.7, 0.25, 1.4)), warningMat);
        lamp.position.set(cx, 4.7, cz);
        group.add(lamp);

        const leftPanel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.55, 4.0, 3.6)), doorMat);
        leftPanel.position.set(cx, 2.0, cz - 1.8);
        const rightPanel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.55, 4.0, 3.6)), doorMat);
        rightPanel.position.set(cx, 2.0, cz + 1.8);
        group.add(leftPanel, rightPanel);
        raycastObstacles.push(leftPanel, rightPanel);

        const closedBounds: ArenaCollider = {
          minX: cx - 0.5,
          maxX: cx + 0.5,
          minY: 0,
          maxY: 4.0,
          minZ: cz - 3.6,
          maxZ: cz + 3.6,
          isDynamic: true,
        };
        const collider: ArenaCollider = { ...closedBounds };
        colliders.push(collider);
        doors.push({
          leftPanel,
          rightPanel,
          center: new THREE.Vector3(cx, 2, cz),
          axis,
          openAmount: 0,
          collider,
          closedBounds,
        });
      }
    };

    addBulkheadWithDoor(0, -16, 'x');
    addBulkheadWithDoor(0, 16, 'x');
    addBulkheadWithDoor(-16, 0, 'z');
    addBulkheadWithDoor(16, 0, 'z');

    // Tech energy crates inside quadrants
    addSolidBox(2.2, 1.5, 2.2, -24, 0, -24, crateMat);
    addSolidBox(2.2, 1.5, 2.2, 24, 0, -24, crateMat);
    addSolidBox(2.2, 1.5, 2.2, -24, 0, 24, crateMat);
    addSolidBox(2.2, 1.5, 2.2, 24, 0, 24, crateMat);

    bossAnchor.set(0, 0, -24);

    spawnAnchors.push(
      { position: new THREE.Vector3(0, 0, -28), kind: 'GROUND', patrolAxis: 'x', patrolRange: 10 },
      { position: new THREE.Vector3(-26, 0, -10), kind: 'GROUND', patrolAxis: 'z', patrolRange: 8 },
      { position: new THREE.Vector3(26, 0, -10), kind: 'GROUND', patrolAxis: 'z', patrolRange: 8 },
      { position: new THREE.Vector3(-26, 0, 12), kind: 'GROUND', patrolAxis: 'z', patrolRange: 8 },
      { position: new THREE.Vector3(26, 0, 12), kind: 'GROUND', patrolAxis: 'z', patrolRange: 8 },
      { position: new THREE.Vector3(-9, 0, -8), kind: 'GROUND', patrolAxis: 'x', patrolRange: 4 },
      { position: new THREE.Vector3(9, 0, -8), kind: 'GROUND', patrolAxis: 'x', patrolRange: 4 },
      { position: new THREE.Vector3(0, 5.8, -9), kind: 'AERIAL', patrolAxis: 'x', patrolRange: 10 },
      { position: new THREE.Vector3(-10, 6.2, 8), kind: 'AERIAL', patrolAxis: 'z', patrolRange: 7 },
      { position: new THREE.Vector3(10, 6.2, 8), kind: 'AERIAL', patrolAxis: 'z', patrolRange: 7 },
      { position: new THREE.Vector3(0, 7.2, -25), kind: 'AERIAL', patrolAxis: 'x', patrolRange: 12 }
    );
  }

  /* ======================================================================== */
  /*  MAP 4: JUNGLE FACILITY                                                  */
  /* ======================================================================== */
  else if (mapId === 'JUNGLE_FACILITY') {
    lightingConfig = {
      hemiSky: 0xa7f3d0,
      hemiGround: 0x1e3a28,
      hemiIntensity: 1.05,
      keyColor: 0xfff5d6,
      keyIntensity: 2.05,
      keyPos: [32, 58, 30],
      rimColor: 0x34d399,
      rimIntensity: 0.6,
    };

    const rockMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x4b5553, roughness: 0.9, metalness: 0.08 })
    );
    const trunkMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x5c4028, roughness: 0.92, metalness: 0.04 })
    );
    const leafMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x1e6b3a, roughness: 0.78, metalness: 0.05 })
    );
    const leafBrightMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x2f8f4e, roughness: 0.74, metalness: 0.05 })
    );
    const waterMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.waterMap,
        color: 0x38bdf8,
        emissive: 0x0369a1,
        emissiveIntensity: 0.45,
        roughness: 0.16,
        metalness: 0.25,
        transparent: true,
        opacity: 0.88,
      })
    );

    // Flowing River Channel cutting East-West across center-north of map (with 2 walkable bridges!)
    const riverPlane = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(78, 8.2)),
      waterMat
    );
    riverPlane.rotation.x = -Math.PI / 2;
    riverPlane.position.set(0, 0.05, -4);
    group.add(riverPlane);

    // Two sleek Research Footbridges over the river
    addSolidBox(6.2, 0.35, 10.5, -12, 0, -4, lightMetalMat);
    addSolidBox(6.2, 0.35, 10.5, 12, 0, -4, lightMetalMat);

    // Towering Mossy Cliff & Cascading Waterfall on North Edge
    addSolidBox(24, 15, 7, 0, 0, -37, rockMat);
    addSolidBox(18, 11, 6, -24, 0, -37, rockMat);
    addSolidBox(18, 11, 6, 24, 0, -37, rockMat);

    const waterfall = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(7.2, 14.5)),
      waterMat
    );
    waterfall.position.set(0, 7.25, -33.4);
    group.add(waterfall);

    // Misty splash pool under waterfall
    const splashPool = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(6.5, 6.8, 0.16, 20)),
      waterMat
    );
    splashPool.position.set(0, 0.08, -29);
    group.add(splashPool);

    // Modern White-and-Teal Bio-Research Laboratories (2 composite domed labs)
    const buildResearchLab = (lx: number, lz: number) => {
      addSolidBox(10.5, 4.2, 9.0, lx, 0, lz, wallMat);
      const dome = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(4.4, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2)),
        lightMetalMat
      );
      dome.position.set(lx, 4.2, lz);
      dome.castShadow = true;
      group.add(dome);
      const glowBand = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(10.8, 0.35, 9.3)),
        emeraldGlowMat
      );
      glowBand.position.set(lx, 3.6, lz);
      group.add(glowBand);
    };
    buildResearchLab(-24, 14);
    buildResearchLab(24, -19);

    // Research Cargo Crates & Cover Stones
    addSolidBox(3.0, 1.7, 2.4, -12, 0, 12, crateMat);
    addSolidBox(3.0, 1.7, 2.4, 14, 0, 10, crateMat);
    addSolidBox(3.2, 1.8, 3.0, 0, 0, 12, rockMat);
    addSolidBox(2.8, 1.5, 2.6, -24, 0, -16, rockMat);

    // Multi-part Procedural Jungle Trees inside & ringing the perimeter
    const treePositions: [number, number, number][] = [
      [-32, -26, 1.2], [-34, -8, 1.0], [-33, 6, 1.15], [-33, 28, 1.25],
      [33, -28, 1.15], [34, -4, 1.2], [33, 14, 1.1], [32, 29, 1.2],
      [-16, 31, 1.05], [16, 31, 1.1], [0, 34, 1.2],
      [-22, -26, 0.95], [10, -24, 0.9], [22, 4, 0.95], [-6, 19, 0.85],
    ];
    treePositions.forEach(([tx, tz, sc]) => {
      const tree = new THREE.Group();
      tree.position.set(tx, 0, tz);
      const trunk = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.32 * sc, 0.56 * sc, 5.4 * sc, 7)),
        trunkMat
      );
      trunk.position.y = 2.7 * sc;
      trunk.castShadow = true;
      tree.add(trunk);

      const canopy1 = new THREE.Mesh(
        trackGeo(new THREE.DodecahedronGeometry(2.6 * sc, 0)),
        leafMat
      );
      canopy1.position.set(0, 5.8 * sc, 0);
      canopy1.scale.set(1.3, 0.72, 1.3);
      canopy1.castShadow = true;
      tree.add(canopy1);

      const canopy2 = new THREE.Mesh(
        trackGeo(new THREE.DodecahedronGeometry(1.9 * sc, 0)),
        leafBrightMat
      );
      canopy2.position.set(0.7 * sc, 7.1 * sc, -0.5 * sc);
      canopy2.scale.set(1.2, 0.65, 1.2);
      tree.add(canopy2);

      group.add(tree);
      raycastObstacles.push(trunk);
      colliders.push({
        minX: tx - 0.75 * sc,
        maxX: tx + 0.75 * sc,
        minY: 0,
        maxY: 5.4 * sc,
        minZ: tz - 0.75 * sc,
        maxZ: tz + 0.75 * sc,
      });
    });

    // Outer jungle grove treeline
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const dist = 56 + (i % 3) * 12;
      const bush = new THREE.Mesh(
        trackGeo(new THREE.ConeGeometry(8 + (i % 3) * 3, 18 + (i % 4) * 5, 7)),
        i % 2 === 0 ? leafMat : leafBrightMat
      );
      bush.position.set(Math.cos(a) * dist, 8, Math.sin(a) * dist);
      group.add(bush);
    }

    spawnAnchors.push(
      { position: new THREE.Vector3(-12, 0, -16), kind: 'GROUND', patrolAxis: 'x', patrolRange: 8 },
      { position: new THREE.Vector3(10, 0, -16), kind: 'GROUND', patrolAxis: 'x', patrolRange: 7 },
      { position: new THREE.Vector3(-12, 0.35, -4), kind: 'GROUND', patrolAxis: 'z', patrolRange: 4 },
      { position: new THREE.Vector3(12, 0.35, -4), kind: 'GROUND', patrolAxis: 'z', patrolRange: 4 },
      { position: new THREE.Vector3(-24, 0, -2), kind: 'GROUND', patrolAxis: 'z', patrolRange: 6 },
      { position: new THREE.Vector3(24, 0, 14), kind: 'GROUND', patrolAxis: 'x', patrolRange: 6 },
      { position: new THREE.Vector3(0, 0, 4), kind: 'GROUND', patrolAxis: 'x', patrolRange: 10 },
      { position: new THREE.Vector3(0, 6.2, -16), kind: 'AERIAL', patrolAxis: 'x', patrolRange: 13 },
      { position: new THREE.Vector3(-16, 6.8, 2), kind: 'AERIAL', patrolAxis: 'z', patrolRange: 11 },
      { position: new THREE.Vector3(16, 6.8, 2), kind: 'AERIAL', patrolAxis: 'z', patrolRange: 11 },
      { position: new THREE.Vector3(0, 8.2, 10), kind: 'AERIAL', patrolAxis: 'x', patrolRange: 12 }
    );
  }

  /* ======================================================================== */
  /*  MAP 5: CYBER ARENA (Illuminated Grid + Moving Obstacles!)               */
  /* ======================================================================== */
  else {
    lightingConfig = {
      hemiSky: 0xc084fc,
      hemiGround: 0x0f172a,
      hemiIntensity: 0.9,
      keyColor: 0xe0f2fe,
      keyIntensity: 1.55,
      keyPos: [30, 54, 24],
      rimColor: 0xf43f5e,
      rimIntensity: 0.95,
    };

    buildPerimeter(3.8, pinkGlowMat);

    // Overhead Rotating Neon Stadium Halo Rings
    const halo1 = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(28, 0.42, 10, 64)),
      cyanGlowMat
    );
    halo1.rotation.x = Math.PI / 2;
    halo1.position.set(0, 18, 0);
    group.add(halo1);
    spinningObjects.push({ obj: halo1, axis: 'z', speed: 0.25 });

    const halo2 = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(18, 0.32, 10, 48)),
      pinkGlowMat
    );
    halo2.rotation.x = Math.PI / 2;
    halo2.position.set(0, 22, 0);
    group.add(halo2);
    spinningObjects.push({ obj: halo2, axis: 'z', speed: -0.4 });

    // Glowing Illuminated Center Stage with Step Pads
    addSolidBox(11, 0.65, 11, 0, 0, 0, darkMetalMat);
    const stageRim = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(11.3, 0.16, 11.3)),
      pinkGlowMat
    );
    stageRim.position.set(0, 0.62, 0);
    group.add(stageRim);
    addSolidBox(4, 0.34, 1.4, 0, 0, 6.2, darkMetalMat);
    addSolidBox(4, 0.34, 1.4, 0, 0, -6.2, darkMetalMat);

    // 4 Neon Corner Monolith Pillars + Scoreboard Billboards
    const cyberBoardMat = trackMat(
      new THREE.MeshBasicMaterial({ map: textures.billboardMap, side: THREE.DoubleSide })
    );
    const pillarCoords: [number, number][] = [
      [-28, -28],
      [28, -28],
      [-28, 28],
      [28, 28],
    ];
    pillarCoords.forEach(([px, pz], idx) => {
      addSolidBox(5, 14, 5, px, 0, pz, wallMat);
      const strip = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(5.25, 12, 0.35)),
        idx % 2 === 0 ? cyanGlowMat : pinkGlowMat
      );
      strip.position.set(px, 7, pz);
      group.add(strip);
    });
    const bigBoard = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(18, 8)),
      cyberBoardMat
    );
    bigBoard.position.set(0, 11.5, -38.5);
    group.add(bigBoard);

    // 4 MOVING CYBER COVER OBSTACLES (Smoothly glide back & forth with live colliders!)
    const movingSpecs: {
      w: number;
      h: number;
      d: number;
      x: number;
      z: number;
      axis: 'x' | 'z';
      range: number;
      speed: number;
      phase: number;
      glow: THREE.Material;
    }[] = [
      { w: 5.6, h: 2.6, d: 1.2, x: 0, z: -13, axis: 'x', range: 11, speed: 1.35, phase: 0, glow: cyanGlowMat },
      { w: 5.6, h: 2.6, d: 1.2, x: 0, z: 13, axis: 'x', range: 11, speed: 1.35, phase: Math.PI, glow: pinkGlowMat },
      { w: 1.2, h: 2.6, d: 5.6, x: -16, z: 0, axis: 'z', range: 10, speed: 1.15, phase: 0.8, glow: cyanGlowMat },
      { w: 1.2, h: 2.6, d: 5.6, x: 16, z: 0, axis: 'z', range: 10, speed: 1.15, phase: 3.9, glow: pinkGlowMat },
    ];

    movingSpecs.forEach((spec) => {
      const barrier = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(spec.w, spec.h, spec.d)),
        darkMetalMat
      );
      barrier.position.set(spec.x, spec.h / 2, spec.z);
      barrier.castShadow = true;
      barrier.receiveShadow = true;

      const neonCap = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(spec.w + 0.14, 0.22, spec.d + 0.14)),
        spec.glow
      );
      neonCap.position.y = spec.h / 2 - 0.25;
      barrier.add(neonCap);

      group.add(barrier);
      raycastObstacles.push(barrier);

      const collider: ArenaCollider = {
        minX: spec.x - spec.w / 2,
        maxX: spec.x + spec.w / 2,
        minY: 0,
        maxY: spec.h,
        minZ: spec.z - spec.d / 2,
        maxZ: spec.z + spec.d / 2,
        isDynamic: true,
      };
      colliders.push(collider);
      movingBarriers.push({
        mesh: barrier,
        collider,
        origin: new THREE.Vector3(spec.x, spec.h / 2, spec.z),
        axis: spec.axis,
        range: spec.range,
        speed: spec.speed,
        phase: spec.phase,
        halfW: spec.w / 2,
        halfD: spec.d / 2,
      });
    });

    // Static outer flanking energy blocks
    addSolidBox(3.4, 2.0, 3.4, -24, 0, -14, crateMat);
    addSolidBox(3.4, 2.0, 3.4, 24, 0, -14, crateMat);
    addSolidBox(3.4, 2.0, 3.4, -24, 0, 14, crateMat);
    addSolidBox(3.4, 2.0, 3.4, 24, 0, 14, crateMat);

    bossAnchor.set(0, 0, -22);

    spawnAnchors.push(
      { position: new THREE.Vector3(0, 0, -26), kind: 'GROUND', patrolAxis: 'x', patrolRange: 14 },
      { position: new THREE.Vector3(-25, 0, 0), kind: 'GROUND', patrolAxis: 'z', patrolRange: 10 },
      { position: new THREE.Vector3(25, 0, 0), kind: 'GROUND', patrolAxis: 'z', patrolRange: 10 },
      { position: new THREE.Vector3(-14, 0, -22), kind: 'GROUND', patrolAxis: 'x', patrolRange: 7 },
      { position: new THREE.Vector3(14, 0, -22), kind: 'GROUND', patrolAxis: 'x', patrolRange: 7 },
      { position: new THREE.Vector3(-18, 0, 20), kind: 'GROUND', patrolAxis: 'x', patrolRange: 6 },
      { position: new THREE.Vector3(18, 0, 20), kind: 'GROUND', patrolAxis: 'x', patrolRange: 6 },
      { position: new THREE.Vector3(0, 6.0, -18), kind: 'AERIAL', patrolAxis: 'x', patrolRange: 15 },
      { position: new THREE.Vector3(-16, 6.4, 0), kind: 'AERIAL', patrolAxis: 'z', patrolRange: 12 },
      { position: new THREE.Vector3(16, 6.4, 0), kind: 'AERIAL', patrolAxis: 'z', patrolRange: 12 },
      { position: new THREE.Vector3(0, 8.6, 4), kind: 'AERIAL', patrolAxis: 'x', patrolRange: 14 }
    );
  }

  // Curated Pickup Spawn Locations (accessible & open across all maps)
  pickupAnchors.push(
    new THREE.Vector3(-9, 1.0, 18),
    new THREE.Vector3(9, 1.0, 18),
    new THREE.Vector3(-22, 1.0, -4),
    new THREE.Vector3(22, 1.0, -4),
    new THREE.Vector3(0, 1.0, -24),
    new THREE.Vector3(-14, 1.0, -22),
    new THREE.Vector3(14, 1.0, -22),
    new THREE.Vector3(0, 1.0, 22)
  );

  // Per-frame live map animation handler
  const update = (dt: number, elapsed: number, playerPos: THREE.Vector3) => {
    for (const s of spinningObjects) {
      s.obj.rotation[s.axis] += dt * s.speed;
    }

    for (const p of pulsingLights) {
      p.mat.emissiveIntensity = p.base + Math.sin(elapsed * p.speed) * 1.1;
    }

    // Animated waterfall & river scroll on Jungle Facility
    if (waterTexture) {
      waterTexture.offset.y -= dt * 0.65;
    }

    // Automatic Space Station sliding doors (open when player is within 8.5m)
    for (const d of doors) {
      const dist = d.center.distanceTo(playerPos);
      const targetOpen = dist < 8.8 ? 1 : 0;
      d.openAmount = THREE.MathUtils.damp(d.openAmount, targetOpen, 7, dt);
      const slide = d.openAmount * 3.2;

      if (d.axis === 'x') {
        d.leftPanel.position.x = d.center.x - 1.8 - slide;
        d.rightPanel.position.x = d.center.x + 1.8 + slide;
      } else {
        d.leftPanel.position.z = d.center.z - 1.8 - slide;
        d.rightPanel.position.z = d.center.z + 1.8 + slide;
      }

      // Disable collision cleanly once door opens past 55%
      if (d.openAmount > 0.55) {
        d.collider.maxY = -10;
      } else {
        d.collider.maxY = d.closedBounds.maxY;
      }
    }

    // Moving Cyber Arena Barriers with live AABB updates
    for (const mb of movingBarriers) {
      const offset = Math.sin(elapsed * mb.speed + mb.phase) * mb.range;
      if (mb.axis === 'x') {
        const nx = mb.origin.x + offset;
        mb.mesh.position.x = nx;
        mb.collider.minX = nx - mb.halfW;
        mb.collider.maxX = nx + mb.halfW;
      } else {
        const nz = mb.origin.z + offset;
        mb.mesh.position.z = nz;
        mb.collider.minZ = nz - mb.halfD;
        mb.collider.maxZ = nz + mb.halfD;
      }
    }

    // Subtle atmospheric particle drift
    if (ambientParticles) {
      ambientParticles.rotation.y = elapsed * 0.02;
      ambientParticles.position.y = Math.sin(elapsed * 0.6) * 0.45;
    }
  };

  return {
    mapId,
    group,
    colliders,
    raycastObstacles,
    spawnAnchors,
    pickupAnchors,
    bossAnchor,
    playerSpawn,
    arenaRadius: arenaHalf - 1.6,
    lightingConfig,
    update,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
