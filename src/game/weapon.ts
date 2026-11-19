import * as THREE from 'three';
import { WEAPON_BY_ID } from './data';
import { WeaponId } from './types';

interface EnergyBeam {
  mesh: THREE.Object3D;
  mats: THREE.Material[];
  life: number;
  maxLife: number;
  isCylinder: boolean;
}

interface SparkParticle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface ShockRing {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  expandRate: number;
}

/**
 * Dynamic 6-Weapon First-Person Sci-Fi Energy Blaster viewmodel +
 * per-weapon volumetric beams, lightning chain arcs, AoE pulse blasts, frost bursts, and recoil.
 */
export class WeaponAndFX {
  public readonly viewmodelRoot: THREE.Group;
  private readonly blasterPivot: THREE.Group;
  private currentModelGroup: THREE.Group | null = null;
  private currentWeaponId: WeaponId = 'PLASMA';

  private muzzleAnchor: THREE.Object3D;
  private muzzleSprite: THREE.Sprite;
  private muzzleLight: THREE.PointLight;
  private activeCoreMat: THREE.MeshStandardMaterial | null = null;

  private readonly fxGroup: THREE.Group;
  private readonly beams: EnergyBeam[] = [];
  private readonly sparks: SparkParticle[] = [];
  private readonly rings: ShockRing[] = [];

  private readonly sparkGeo: THREE.BoxGeometry;
  private readonly beamGeo: THREE.CylinderGeometry;
  private readonly ringGeo: THREE.RingGeometry;
  private readonly modelGeos: THREE.BufferGeometry[] = [];
  private readonly modelMats: THREE.Material[] = [];
  private readonly permanentGeos: THREE.BufferGeometry[] = [];
  private readonly permanentMats: THREE.Material[] = [];
  private readonly glowSpriteMap: THREE.CanvasTexture;

  private recoilZ = 0;
  private recoilPitch = 0;
  private muzzleFlashTimer = 0;
  private bobPhase = 0;
  private swayX = 0;
  private swayY = 0;
  private swapAnim = 0;
  public heat = 0;

  private readonly _start = new THREE.Vector3();
  private readonly _mid = new THREE.Vector3();
  private readonly _dir = new THREE.Vector3();
  private readonly _up = new THREE.Vector3(0, 1, 0);

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    glowSpriteMap: THREE.CanvasTexture
  ) {
    this.glowSpriteMap = glowSpriteMap;
    this.viewmodelRoot = new THREE.Group();
    this.blasterPivot = new THREE.Group();
    this.viewmodelRoot.add(this.blasterPivot);
    camera.add(this.viewmodelRoot);

    this.fxGroup = new THREE.Group();
    scene.add(this.fxGroup);

    this.muzzleAnchor = new THREE.Object3D();
    this.muzzleAnchor.position.set(0, 0.01, -0.78);
    this.blasterPivot.add(this.muzzleAnchor);

    const spriteMat = new THREE.SpriteMaterial({
      map: glowSpriteMap,
      color: 0x38bdf8,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.permanentMats.push(spriteMat);
    this.muzzleSprite = new THREE.Sprite(spriteMat);
    this.muzzleSprite.scale.set(0.32, 0.32, 1);
    this.muzzleAnchor.add(this.muzzleSprite);

    this.muzzleLight = new THREE.PointLight(0x38bdf8, 0, 7, 2);
    this.muzzleAnchor.add(this.muzzleLight);

    this.viewmodelRoot.position.set(0.3, -0.26, -0.44);

    this.beamGeo = new THREE.CylinderGeometry(0.024, 0.024, 1, 8, 1, true);
    this.sparkGeo = new THREE.BoxGeometry(0.11, 0.11, 0.11);
    this.ringGeo = new THREE.RingGeometry(0.28, 0.44, 24);
    this.permanentGeos.push(this.beamGeo, this.sparkGeo, this.ringGeo);

    this.setWeapon('PLASMA');
  }

  public setWeapon(weaponId: WeaponId): void {
    this.currentWeaponId = weaponId;
    this.swapAnim = 0.26;
    this.clearCurrentModel();

    const def = WEAPON_BY_ID[weaponId];
    const group = new THREE.Group();

    const trackG = <T extends THREE.BufferGeometry>(g: T): T => {
      this.modelGeos.push(g);
      return g;
    };
    const trackM = <T extends THREE.Material>(m: T): T => {
      this.modelMats.push(m);
      return m;
    };

    const bodyWhite = trackM(
      new THREE.MeshStandardMaterial({
        color: weaponId === 'PULSE' ? 0xf1f5f9 : weaponId === 'FROST' ? 0xe0f2fe : 0xe2e8f0,
        roughness: 0.25,
        metalness: 0.38,
      })
    );
    const carbon = trackM(
      new THREE.MeshStandardMaterial({ color: 0x162032, roughness: 0.54, metalness: 0.68 })
    );
    const steel = trackM(
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.24, metalness: 0.88 })
    );
    const core = trackM(
      new THREE.MeshStandardMaterial({
        color: def.accentHex,
        emissive: def.accentHex,
        emissiveIntensity: 2.8,
        roughness: 0.14,
      })
    );
    this.activeCoreMat = core;
    this.muzzleSprite.material.color.setHex(def.accentHex);
    this.muzzleLight.color.setHex(def.accentHex);

    // Base handle shared across all blasters
    const grip = new THREE.Mesh(trackG(new THREE.BoxGeometry(0.072, 0.18, 0.1)), carbon);
    grip.position.set(0, -0.15, 0.06);
    grip.rotation.x = 0.25;
    group.add(grip);

    if (weaponId === 'LASER') {
      // Long sleek sniper-style emitter rail with holographic scope
      const receiver = new THREE.Mesh(trackG(new THREE.BoxGeometry(0.095, 0.11, 0.62)), carbon);
      receiver.position.set(0, 0, -0.16);
      const longBarrel = new THREE.Mesh(trackG(new THREE.CylinderGeometry(0.022, 0.028, 0.72, 10)), steel);
      longBarrel.rotation.x = Math.PI / 2;
      longBarrel.position.set(0, 0.015, -0.58);
      const laserCoil = new THREE.Mesh(trackG(new THREE.BoxGeometry(0.11, 0.022, 0.48)), core);
      laserCoil.position.set(0, 0.02, -0.35);
      const scope = new THREE.Mesh(trackG(new THREE.CylinderGeometry(0.026, 0.026, 0.24, 10)), bodyWhite);
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.095, -0.12);
      const scopeLens = new THREE.Mesh(trackG(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 10)), core);
      scopeLens.rotation.x = Math.PI / 2;
      scopeLens.position.set(0, 0.095, -0.24);
      group.add(receiver, longBarrel, laserCoil, scope, scopeLens);
      this.muzzleAnchor.position.set(0, 0.015, -0.96);
    } else if (weaponId === 'PULSE') {
      // Heavy wide-bore shockwave cannon with concentric accelerator rings
      const chassis = new THREE.Mesh(trackG(new THREE.BoxGeometry(0.16, 0.16, 0.56)), bodyWhite);
      chassis.position.set(0, 0, -0.14);
      const drum = new THREE.Mesh(trackG(new THREE.CylinderGeometry(0.072, 0.082, 0.42, 12)), carbon);
      drum.rotation.x = Math.PI / 2;
      drum.position.set(0, 0.01, -0.48);
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(trackG(new THREE.TorusGeometry(0.085, 0.014, 8, 18)), core);
        ring.position.set(0, 0.01, -0.36 - i * 0.13);
        group.add(ring);
      }
      group.add(chassis, drum);
      this.muzzleAnchor.position.set(0, 0.01, -0.74);
    } else if (weaponId === 'RAPID') {
      // Compact twin-barrel high-rate repeater
      const body = new THREE.Mesh(trackG(new THREE.BoxGeometry(0.12, 0.12, 0.44)), carbon);
      body.position.set(0, 0, -0.1);
      const barrelL = new THREE.Mesh(trackG(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 8)), steel);
      barrelL.rotation.x = Math.PI / 2;
      barrelL.position.set(-0.036, 0.02, -0.45);
      const barrelR = barrelL.clone();
      barrelR.position.x = 0.036;
      const cell = new THREE.Mesh(trackG(new THREE.BoxGeometry(0.13, 0.03, 0.24)), core);
      cell.position.set(0, 0.065, -0.14);
      group.add(body, barrelL, barrelR, cell);
      this.muzzleAnchor.position.set(0, 0.02, -0.7);
    } else if (weaponId === 'FROST') {
      // Cryo-chamber emitter with glowing crystalline side tanks
      const body = new THREE.Mesh(trackG(new THREE.BoxGeometry(0.12, 0.13, 0.52)), bodyWhite);
      body.position.set(0, 0, -0.14);
      const tankL = new THREE.Mesh(trackG(new THREE.CylinderGeometry(0.026, 0.026, 0.34, 10)), core);
      tankL.rotation.x = Math.PI / 2;
      tankL.position.set(-0.072, 0.01, -0.22);
      const tankR = tankL.clone();
      tankR.position.x = 0.072;
      const nozzle = new THREE.Mesh(trackG(new THREE.ConeGeometry(0.062, 0.26, 6)), steel);
      nozzle.rotation.x = -Math.PI / 2;
      nozzle.position.set(0, 0.01, -0.52);
      group.add(body, tankL, tankR, nozzle);
      this.muzzleAnchor.position.set(0, 0.01, -0.7);
    } else if (weaponId === 'ELECTRIC') {
      // Tesla arc prong cannon with twin forward copper/steel electrodes
      const body = new THREE.Mesh(trackG(new THREE.BoxGeometry(0.12, 0.13, 0.5)), carbon);
      body.position.set(0, 0, -0.14);
      const coil = new THREE.Mesh(trackG(new THREE.CylinderGeometry(0.048, 0.048, 0.26, 12)), core);
      coil.rotation.x = Math.PI / 2;
      coil.position.set(0, 0.02, -0.4);
      const prongL = new THREE.Mesh(trackG(new THREE.BoxGeometry(0.018, 0.024, 0.34)), steel);
      prongL.position.set(-0.055, 0.02, -0.56);
      const prongR = prongL.clone();
      prongR.position.x = 0.055;
      const arcTip = new THREE.Mesh(trackG(new THREE.SphereGeometry(0.026, 8, 8)), core);
      arcTip.position.set(0, 0.02, -0.68);
      group.add(body, coil, prongL, prongR, arcTip);
      this.muzzleAnchor.position.set(0, 0.02, -0.74);
    } else {
      // Default PLASMA BLASTER
      const receiver = new THREE.Mesh(trackG(new THREE.BoxGeometry(0.115, 0.13, 0.54)), bodyWhite);
      receiver.position.set(0, 0, -0.14);
      const lower = new THREE.Mesh(trackG(new THREE.BoxGeometry(0.092, 0.075, 0.42)), carbon);
      lower.position.set(0, -0.075, -0.08);
      const upperRail = new THREE.Mesh(trackG(new THREE.BoxGeometry(0.032, 0.034, 0.42)), steel);
      upperRail.position.set(0, 0.036, -0.5);
      const lowerRail = upperRail.clone();
      lowerRail.position.y = -0.032;
      const rod = new THREE.Mesh(trackG(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 10)), core);
      rod.rotation.x = Math.PI / 2;
      rod.position.set(0, 0.002, -0.46);
      group.add(receiver, lower, upperRail, lowerRail, rod);
      this.muzzleAnchor.position.set(0, 0.004, -0.74);
    }

    this.currentModelGroup = group;
    this.blasterPivot.add(group);
  }

  private clearCurrentModel(): void {
    if (this.currentModelGroup) {
      this.blasterPivot.remove(this.currentModelGroup);
      this.currentModelGroup = null;
    }
    this.modelGeos.forEach((g) => g.dispose());
    this.modelGeos.length = 0;
    this.modelMats.forEach((m) => m.dispose());
    this.modelMats.length = 0;
  }

  public addLookSway(dx: number, dy: number): void {
    this.swayX = THREE.MathUtils.clamp(this.swayX - dx * 0.00018, -0.045, 0.045);
    this.swayY = THREE.MathUtils.clamp(this.swayY + dy * 0.00018, -0.035, 0.035);
  }

  public fireEffect(
    hitPoint: THREE.Vector3,
    isTargetHit: boolean,
    weaponId: WeaponId,
    impactAccentHex: number,
    particleBudget: number,
    chainTargets: THREE.Vector3[] = []
  ): void {
    const def = WEAPON_BY_ID[weaponId];

    // Recoil kick calibrated per weapon
    const kickScale = weaponId === 'PULSE' ? 1.55 : weaponId === 'RAPID' ? 0.55 : weaponId === 'LASER' ? 1.2 : 1.0;
    this.recoilZ = 0.095 * kickScale;
    this.recoilPitch = 0.11 * kickScale;
    this.muzzleFlashTimer = weaponId === 'RAPID' ? 0.04 : 0.065;
    this.heat = Math.min(1, this.heat + (weaponId === 'RAPID' ? 0.12 : 0.24));

    this.muzzleSprite.material.opacity = 1;
    const flashScale = (0.28 + Math.random() * 0.14) * kickScale;
    this.muzzleSprite.scale.set(flashScale, flashScale, 1);
    this.muzzleLight.intensity = 6.5;

    this.muzzleAnchor.getWorldPosition(this._start);

    if (weaponId === 'ELECTRIC') {
      // Jagged electric lightning bolt from muzzle to hitPoint + chain arcs!
      this.spawnLightningArc(this._start, hitPoint, def.accentHex, 0.16);
      for (const ct of chainTargets) {
        this.spawnLightningArc(hitPoint, ct, 0xe879f9, 0.22);
        this.spawnImpactRing(ct, 0xc084fc, 0.28, 3.6);
      }
    } else {
      // Volumetric beam cylinder
      this._dir.subVectors(hitPoint, this._start);
      const length = Math.max(0.4, this._dir.length());
      this._mid.addVectors(this._start, hitPoint).multiplyScalar(0.5);
      this._dir.normalize();

      const thickness =
        weaponId === 'PULSE'
          ? 2.4
          : weaponId === 'LASER'
          ? 0.72
          : weaponId === 'FROST'
          ? 1.5
          : 1.1;

      const beamMat = new THREE.MeshBasicMaterial({
        color: def.accentHex,
        transparent: true,
        opacity: 0.96,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const beamMesh = new THREE.Mesh(this.beamGeo, beamMat);
      beamMesh.position.copy(this._mid);
      beamMesh.scale.set(thickness, length, thickness);
      beamMesh.quaternion.setFromUnitVectors(this._up, this._dir);
      this.fxGroup.add(beamMesh);

      const dur = weaponId === 'LASER' ? 0.18 : weaponId === 'PULSE' ? 0.15 : 0.1;
      this.beams.push({
        mesh: beamMesh,
        mats: [beamMat],
        life: dur,
        maxLife: dur,
        isCylinder: true,
      });
    }

    // Impact VFX tailored per weapon
    if (weaponId === 'PULSE') {
      this.spawnImpactRing(hitPoint, 0xfbbf24, 0.42, 11.5);
      this.spawnSparks(hitPoint, 0xfbbf24, Math.max(8, particleBudget));
    } else if (weaponId === 'FROST') {
      this.spawnImpactRing(hitPoint, 0x7dd3fc, 0.36, 5.2);
      this.spawnSparks(hitPoint, 0xbae6fd, Math.max(6, Math.floor(particleBudget * 0.85)));
    } else if (isTargetHit) {
      this.spawnImpactRing(hitPoint, impactAccentHex, 0.34, 4.8);
      this.spawnSparks(hitPoint, impactAccentHex, particleBudget);
    } else {
      this.spawnSparks(hitPoint, def.accentHex, Math.max(3, Math.floor(particleBudget * 0.35)));
    }
  }

  public spawnDestructionBurst(origin: THREE.Vector3, colorHex: number, isBoss: boolean, budget: number): void {
    this.spawnImpactRing(origin, colorHex, isBoss ? 0.7 : 0.38, isBoss ? 14 : 6.2);
    this.spawnSparks(origin, colorHex, isBoss ? budget * 2 : budget);
  }

  private spawnLightningArc(
    from: THREE.Vector3,
    to: THREE.Vector3,
    colorHex: number,
    duration: number
  ): void {
    const segments = 7;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const p = new THREE.Vector3().lerpVectors(from, to, t);
      if (i > 0 && i < segments) {
        p.x += (Math.random() - 0.5) * 0.55;
        p.y += (Math.random() - 0.5) * 0.55;
        p.z += (Math.random() - 0.5) * 0.55;
      }
      pts.push(p);
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(geo, mat);
    this.fxGroup.add(line);
    this.beams.push({
      mesh: line,
      mats: [mat],
      life: duration,
      maxLife: duration,
      isCylinder: false,
    });
  }

  private spawnImpactRing(
    origin: THREE.Vector3,
    colorHex: number,
    maxLife: number,
    expandRate: number
  ): void {
    const ringMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(this.ringGeo, ringMat);
    ringMesh.position.copy(origin);
    ringMesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    this.fxGroup.add(ringMesh);
    this.rings.push({
      mesh: ringMesh,
      mat: ringMat,
      life: maxLife,
      maxLife,
      expandRate,
    });
  }

  private spawnSparks(origin: THREE.Vector3, colorHex: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? 0xffffff : colorHex,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.sparkGeo, mat);
      mesh.position.copy(origin);
      mesh.scale.setScalar(0.65 + Math.random() * 1.1);
      this.fxGroup.add(mesh);

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 4.2 + Math.random() * 8.5;
      const vel = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.abs(Math.cos(phi)) * speed * 0.9 + 1.4,
        Math.sin(phi) * Math.sin(theta) * speed
      );

      this.sparks.push({
        mesh,
        vel,
        life: 0.34 + Math.random() * 0.24,
        maxLife: 0.58,
      });
    }
  }

  public update(
    dt: number,
    elapsed: number,
    moveSpeedRatio: number,
    isSprinting: boolean,
    isGrounded: boolean
  ): void {
    this.recoilZ = THREE.MathUtils.damp(this.recoilZ, 0, 16, dt);
    this.recoilPitch = THREE.MathUtils.damp(this.recoilPitch, 0, 15, dt);
    this.swayX = THREE.MathUtils.damp(this.swayX, 0, 10, dt);
    this.swayY = THREE.MathUtils.damp(this.swayY, 0, 10, dt);
    this.swapAnim = THREE.MathUtils.damp(this.swapAnim, 0, 12, dt);
    this.heat = Math.max(0, this.heat - dt * 0.58);

    if (this.activeCoreMat) {
      this.activeCoreMat.emissiveIntensity =
        2.3 + this.heat * 2.5 + Math.sin(elapsed * 4.5) * 0.22;
    }

    const bobRate = isSprinting ? 13.5 : 9.2;
    if (isGrounded && moveSpeedRatio > 0.08) {
      this.bobPhase += dt * bobRate * moveSpeedRatio;
    }
    const bobAmp = isGrounded ? (isSprinting ? 0.02 : 0.012) * moveSpeedRatio : 0.002;
    const idleX = Math.sin(elapsed * 1.7) * 0.004;
    const idleY = Math.cos(elapsed * 2.3) * 0.004;

    const bobX = Math.cos(this.bobPhase) * bobAmp;
    const bobY = Math.abs(Math.sin(this.bobPhase)) * bobAmp * 1.1;

    this.blasterPivot.position.set(
      idleX + bobX + this.swayX,
      idleY - bobY + this.swayY - this.swapAnim * 0.75,
      this.recoilZ
    );
    this.blasterPivot.rotation.set(
      this.recoilPitch + this.swayY * 1.2 - this.swapAnim * 0.9,
      this.swayX * 1.4,
      -bobX * 1.6
    );

    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= dt;
      const ratio = Math.max(0, this.muzzleFlashTimer / 0.065);
      this.muzzleSprite.material.opacity = ratio;
      this.muzzleLight.intensity = ratio * 6.5;
    } else {
      this.muzzleSprite.material.opacity = 0;
      this.muzzleLight.intensity = 0;
    }

    // Update beams & lightning arcs
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.fxGroup.remove(b.mesh);
        if (!b.isCylinder && (b.mesh as THREE.Line).geometry) {
          (b.mesh as THREE.Line).geometry.dispose();
        }
        b.mats.forEach((m) => m.dispose());
        this.beams.splice(i, 1);
      } else {
        const t = b.life / b.maxLife;
        b.mats.forEach((m) => {
          (m as THREE.MeshBasicMaterial).opacity = t;
        });
        if (b.isCylinder) {
          b.mesh.scale.x *= 0.94;
          b.mesh.scale.z *= 0.94;
        }
      }
    }

    // Update expanding shock rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) {
        this.fxGroup.remove(r.mesh);
        r.mat.dispose();
        this.rings.splice(i, 1);
      } else {
        const progress = 1 - r.life / r.maxLife;
        r.mesh.scale.setScalar(1 + progress * r.expandRate);
        r.mat.opacity = (1 - progress) * 0.9;
      }
    }

    // Update sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.fxGroup.remove(s.mesh);
        (s.mesh.material as THREE.Material).dispose();
        this.sparks.splice(i, 1);
      } else {
        s.vel.y -= 14 * dt;
        s.mesh.position.addScaledVector(s.vel, dt);
        s.mesh.rotation.x += dt * 9;
        s.mesh.rotation.y += dt * 7;
        const t = Math.max(0, s.life / s.maxLife);
        s.mesh.scale.setScalar(t * 0.95);
        (s.mesh.material as THREE.MeshBasicMaterial).opacity = t;
      }
    }
  }

  public clearEffects(): void {
    for (const b of this.beams) {
      this.fxGroup.remove(b.mesh);
      if (!b.isCylinder && (b.mesh as THREE.Line).geometry) {
        (b.mesh as THREE.Line).geometry.dispose();
      }
      b.mats.forEach((m) => m.dispose());
    }
    this.beams.length = 0;

    for (const r of this.rings) {
      this.fxGroup.remove(r.mesh);
      r.mat.dispose();
    }
    this.rings.length = 0;

    for (const s of this.sparks) {
      this.fxGroup.remove(s.mesh);
      (s.mesh.material as THREE.Material).dispose();
    }
    this.sparks.length = 0;
    this.heat = 0;
    this.recoilZ = 0;
    this.recoilPitch = 0;
  }

  public getWeaponId(): WeaponId {
    return this.currentWeaponId;
  }

  public dispose(): void {
    this.clearEffects();
    this.clearCurrentModel();
    this.permanentGeos.forEach((g) => g.dispose());
    this.permanentMats.forEach((m) => m.dispose());
    this.glowSpriteMap.dispose();
  }
}
