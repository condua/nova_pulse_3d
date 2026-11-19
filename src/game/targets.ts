import * as THREE from 'three';
import { ArenaCollider, SpawnAnchor } from './arena';
import { EnemyKind, PickupKind } from './types';

export interface ActiveEnemy {
  id: number;
  kind: EnemyKind;
  name: string;
  hp: number;
  maxHp: number;
  shieldHp: number;
  maxShieldHp: number;
  points: number;
  accentHex: number;
  group: THREE.Group;
  hitProxy: THREE.Mesh;
  shieldMesh?: THREE.Mesh;
  hpBarFill?: THREE.Mesh;
  rotors: THREE.Object3D[];
  bodyMeshes: THREE.Mesh[];
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  waypoint: THREE.Vector3;
  aiState: 'PATROL' | 'ENGAGE';
  strafeSign: number;
  strafeTimer: number;
  attackCooldown: number;
  hitFlashTimer: number;
  frostTimer: number;
  bossPhase: number;
  bossShieldTimer: number;
  phaseOffset: number;
  baseSpeed: number;
  radius: number;
  isAerial: boolean;
  isMoving: boolean;
  spawnScale: number;
  alive: boolean;
}

export interface ActivePickup {
  id: number;
  kind: PickupKind;
  label: string;
  colorHex: number;
  group: THREE.Group;
  position: THREE.Vector3;
  phase: number;
  life: number;
}

export interface EnemyOrb {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  damage: number;
  life: number;
}

export interface DamageOutcome {
  hit: boolean;
  killed: boolean;
  shielded: boolean;
  damageApplied: number;
  worldCenter: THREE.Vector3;
  enemyKind: EnemyKind;
  wasMoving: boolean;
  points: number;
  accentHex: number;
}

export interface EnemySpawnOptions {
  kind: EnemyKind;
  speedMultiplier: number;
  hpMultiplier: number;
  canShoot: boolean;
  stationary?: boolean;
}

/**
 * Manages 6 distinct composite 3D enemy robots/drones with real obstacle-avoiding AI,
 * Boss multi-phase combat, enemy energy orbs, and 5 types of glowing 3D collectible pickups.
 */
export class TargetManager {
  private readonly enemyGroup: THREE.Group;
  private readonly pickupGroup: THREE.Group;
  private readonly orbGroup: THREE.Group;
  private readonly anchors: SpawnAnchor[];
  private readonly pickupAnchors: THREE.Vector3[];
  private readonly bossAnchor: THREE.Vector3;
  private readonly arenaRadius: number;

  private readonly enemies: ActiveEnemy[] = [];
  private readonly hitProxies: THREE.Object3D[] = [];
  private readonly pickups: ActivePickup[] = [];
  private readonly orbs: EnemyOrb[] = [];

  private nextEnemyId = 1;
  private nextPickupId = 1;

  private readonly sharedGeos: THREE.BufferGeometry[] = [];
  private readonly sharedMats: THREE.Material[] = [];

  private readonly matDark: THREE.MeshStandardMaterial;
  private readonly matSteel: THREE.MeshStandardMaterial;
  private readonly matHitProxy: THREE.MeshBasicMaterial;
  private readonly matShadow: THREE.MeshBasicMaterial;
  private readonly matHpBg: THREE.MeshBasicMaterial;
  private readonly matHpFill: THREE.MeshBasicMaterial;
  private readonly orbGeo: THREE.SphereGeometry;
  private readonly orbMat: THREE.MeshBasicMaterial;

  // Scratch vectors (zero GC in loop)
  private readonly _toPlayer = new THREE.Vector3();
  private readonly _toWay = new THREE.Vector3();
  private readonly _move = new THREE.Vector3();
  private readonly _lookTarget = new THREE.Vector3();
  private readonly _right = new THREE.Vector3();

  constructor(
    scene: THREE.Scene,
    anchors: SpawnAnchor[],
    pickupAnchors: THREE.Vector3[],
    bossAnchor: THREE.Vector3,
    arenaRadius: number,
    contactShadowMap: THREE.CanvasTexture
  ) {
    this.enemyGroup = new THREE.Group();
    this.pickupGroup = new THREE.Group();
    this.orbGroup = new THREE.Group();
    scene.add(this.enemyGroup, this.pickupGroup, this.orbGroup);

    this.anchors = anchors;
    this.pickupAnchors = pickupAnchors;
    this.bossAnchor = bossAnchor;
    this.arenaRadius = arenaRadius;

    const regMat = <T extends THREE.Material>(m: T): T => {
      this.sharedMats.push(m);
      return m;
    };

    this.matDark = regMat(
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.54, metalness: 0.72 })
    );
    this.matSteel = regMat(
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.3, metalness: 0.84 })
    );
    this.matHitProxy = regMat(new THREE.MeshBasicMaterial({ visible: false }));
    this.matShadow = regMat(
      new THREE.MeshBasicMaterial({
        map: contactShadowMap,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
      })
    );
    this.matHpBg = regMat(
      new THREE.MeshBasicMaterial({ color: 0x0f172a, side: THREE.DoubleSide })
    );
    this.matHpFill = regMat(
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide })
    );
    this.orbGeo = this.regGeo(new THREE.SphereGeometry(0.28, 10, 10));
    this.orbMat = regMat(
      new THREE.MeshBasicMaterial({
        color: 0xfb7185,
      })
    );
  }

  private regGeo<T extends THREE.BufferGeometry>(g: T): T {
    this.sharedGeos.push(g);
    return g;
  }

  public getHitProxies(): THREE.Object3D[] {
    return this.hitProxies;
  }

  public getActiveEnemies(): readonly ActiveEnemy[] {
    return this.enemies;
  }

  public getBoss(): ActiveEnemy | undefined {
    return this.enemies.find((e) => e.kind === 'BOSS' && e.alive);
  }

  public getActiveCount(excludeBoss = false): number {
    return this.enemies.filter((e) => e.alive && (!excludeBoss || e.kind !== 'BOSS')).length;
  }

  public getPickupCount(): number {
    return this.pickups.length;
  }

  public clearAll(): void {
    for (const e of this.enemies) {
      this.enemyGroup.remove(e.group);
    }
    this.enemies.length = 0;
    this.hitProxies.length = 0;

    for (const p of this.pickups) {
      this.pickupGroup.remove(p.group);
    }
    this.pickups.length = 0;

    for (const o of this.orbs) {
      this.orbGroup.remove(o.mesh);
    }
    this.orbs.length = 0;
  }

  public findByProxy(obj: THREE.Object3D): ActiveEnemy | undefined {
    const id = obj.userData?.enemyId as number | undefined;
    if (!id) return undefined;
    return this.enemies.find((e) => e.id === id && e.alive);
  }

  public spawnEnemy(
    options: EnemySpawnOptions,
    playerPos: THREE.Vector3
  ): ActiveEnemy {
    const id = this.nextEnemyId++;
    const kind = options.kind;
    const isAerial = kind === 'DRONE';

    let spawnPos: THREE.Vector3;
    if (kind === 'BOSS') {
      spawnPos = this.bossAnchor.clone();
    } else {
      const anchor = this.pickBestAnchor(isAerial, playerPos);
      spawnPos = anchor.position.clone();
      spawnPos.x += (Math.random() - 0.5) * 2.2;
      spawnPos.z += (Math.random() - 0.5) * 2.2;
    }

    const built = this.buildEnemyModel(id, kind);
    built.group.position.copy(spawnPos);
    built.group.scale.setScalar(0.01);
    this.enemyGroup.add(built.group);
    this.hitProxies.push(built.hitProxy);

    const maxHp = Math.round(built.baseHp * options.hpMultiplier);
    const maxShield = Math.round(built.baseShield * options.hpMultiplier);
    const baseSpeed = options.stationary ? 0 : built.baseSpeed * options.speedMultiplier;

    const enemy: ActiveEnemy = {
      id,
      kind,
      name: built.name,
      hp: maxHp,
      maxHp,
      shieldHp: maxShield,
      maxShieldHp: maxShield,
      points: built.points,
      accentHex: built.accentHex,
      group: built.group,
      hitProxy: built.hitProxy,
      shieldMesh: built.shieldMesh,
      hpBarFill: built.hpBarFill,
      rotors: built.rotors,
      bodyMeshes: built.bodyMeshes,
      position: spawnPos.clone(),
      velocity: new THREE.Vector3(),
      waypoint: this.pickPatrolPoint(spawnPos, isAerial),
      aiState: 'PATROL',
      strafeSign: Math.random() < 0.5 ? 1 : -1,
      strafeTimer: 1.5 + Math.random() * 2.0,
      attackCooldown: options.canShoot ? 1.8 + Math.random() * 2.2 : 99999,
      hitFlashTimer: 0,
      frostTimer: 0,
      bossPhase: 1,
      bossShieldTimer: 0,
      phaseOffset: Math.random() * Math.PI * 2,
      baseSpeed,
      radius: built.radius,
      isAerial,
      isMoving: baseSpeed > 0.1,
      spawnScale: 0.01,
      alive: true,
    };

    this.enemies.push(enemy);
    return enemy;
  }

  public applyDamage(
    enemy: ActiveEnemy,
    rawDamage: number,
    options: {
      frost?: boolean;
      shieldBreaker?: boolean;
      pierceShield?: boolean;
    } = {}
  ): DamageOutcome {
    // STRICT DOUBLE-SCORE / DEAD-ENEMY GUARD
    if (!enemy.alive) {
      return {
        hit: false,
        killed: false,
        shielded: false,
        damageApplied: 0,
        worldCenter: enemy.position.clone(),
        enemyKind: enemy.kind,
        wasMoving: enemy.isMoving,
        points: 0,
        accentHex: enemy.accentHex,
      };
    }

    const worldCenter = new THREE.Vector3();
    enemy.hitProxy.getWorldPosition(worldCenter);

    let damage = rawDamage;
    let shielded = false;

    // Boss temporary phase shield reduces incoming damage
    if (enemy.kind === 'BOSS' && enemy.bossShieldTimer > 0 && !options.pierceShield) {
      damage = Math.round(damage * 0.45);
      shielded = true;
    }

    // Shield Robot energy barrier absorbs first
    if (enemy.shieldHp > 0 && !options.pierceShield) {
      shielded = true;
      const shieldDmg = options.shieldBreaker ? damage * 1.9 : damage;
      if (enemy.shieldHp >= shieldDmg) {
        enemy.shieldHp -= shieldDmg;
        damage = Math.round(rawDamage * 0.25); // Small bleed-through so player sees progress
      } else {
        const overflow = shieldDmg - enemy.shieldHp;
        enemy.shieldHp = 0;
        if (enemy.shieldMesh) enemy.shieldMesh.visible = false;
        damage = Math.max(12, Math.round(overflow));
      }
    }

    enemy.hp = Math.max(0, enemy.hp - damage);
    enemy.hitFlashTimer = 0.12;
    if (options.frost) {
      enemy.frostTimer = enemy.kind === 'BOSS' ? 1.8 : 3.4;
    }

    // Update Boss phase transitions (Phase 2 at 66%, Phase 3 at 33%)
    if (enemy.kind === 'BOSS' && enemy.hp > 0) {
      const ratio = enemy.hp / enemy.maxHp;
      if (ratio <= 0.34 && enemy.bossPhase < 3) {
        enemy.bossPhase = 3;
        enemy.bossShieldTimer = 3.0;
      } else if (ratio <= 0.67 && enemy.bossPhase < 2) {
        enemy.bossPhase = 2;
        enemy.bossShieldTimer = 2.5;
      }
    }

    // Update 3D overhead HP bar
    if (enemy.hpBarFill) {
      const ratio = Math.max(0.001, enemy.hp / enemy.maxHp);
      enemy.hpBarFill.scale.x = ratio;
      enemy.hpBarFill.position.x = -(1 - ratio) * 0.55;
    }

    // Knockback/alert reaction
    enemy.aiState = 'ENGAGE';

    if (enemy.hp <= 0) {
      enemy.alive = false;
      this.enemyGroup.remove(enemy.group);
      const idx = this.enemies.indexOf(enemy);
      if (idx >= 0) this.enemies.splice(idx, 1);
      const pIdx = this.hitProxies.indexOf(enemy.hitProxy);
      if (pIdx >= 0) this.hitProxies.splice(pIdx, 1);

      return {
        hit: true,
        killed: true,
        shielded: false,
        damageApplied: damage,
        worldCenter,
        enemyKind: enemy.kind,
        wasMoving: enemy.isMoving,
        points: enemy.points,
        accentHex: enemy.accentHex,
      };
    }

    return {
      hit: true,
      killed: false,
      shielded,
      damageApplied: damage,
      worldCenter,
      enemyKind: enemy.kind,
      wasMoving: enemy.isMoving,
      points: 0,
      accentHex: enemy.accentHex,
    };
  }

  public findNearbyEnemies(
    origin: THREE.Vector3,
    radius: number,
    excludeId: number
  ): ActiveEnemy[] {
    const rSq = radius * radius;
    const found: ActiveEnemy[] = [];
    for (const e of this.enemies) {
      if (!e.alive || e.id === excludeId) continue;
      if (e.position.distanceToSquared(origin) <= rSq) {
        found.push(e);
      }
    }
    return found;
  }

  public spawnPickup(forcedKind?: PickupKind): ActivePickup | null {
    if (this.pickups.length >= 4 || this.pickupAnchors.length === 0) return null;

    // Pick an unoccupied anchor
    const candidates = this.pickupAnchors.filter(
      (a) => !this.pickups.some((p) => p.position.distanceToSquared(a) < 9)
    );
    const anchor =
      candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : this.pickupAnchors[Math.floor(Math.random() * this.pickupAnchors.length)];

    const kinds: PickupKind[] = [
      'ENERGY_PACK',
      'SCORE_BONUS',
      'SPEED_BOOST',
      'SHIELD',
      'DOUBLE_SCORE',
    ];
    const kind = forcedKind ?? kinds[Math.floor(Math.random() * kinds.length)];

    const meta: Record<PickupKind, { label: string; color: number }> = {
      ENERGY_PACK: { label: 'ENERGY PACK (+35 Năng lượng)', color: 0x10b981 },
      SCORE_BONUS: { label: 'SCORE BONUS (+350 Điểm)', color: 0xf59e0b },
      SPEED_BOOST: { label: 'SPEED BOOST (10s Tăng tốc)', color: 0x22d3ee },
      SHIELD: { label: 'SHIELD (+45 Lá chắn)', color: 0x3b82f6 },
      DOUBLE_SCORE: { label: 'DOUBLE SCORE (12s x2 Điểm)', color: 0xe879f9 },
    };
    const info = meta[kind];

    const group = new THREE.Group();
    const glowMat = new THREE.MeshStandardMaterial({
      color: info.color,
      emissive: info.color,
      emissiveIntensity: 2.2,
      roughness: 0.15,
      metalness: 0.2,
    });
    this.sharedMats.push(glowMat);

    // Composite 3D Pickup Geometry per kind
    if (kind === 'ENERGY_PACK') {
      const vBar = new THREE.Mesh(this.regGeo(new THREE.BoxGeometry(0.24, 0.72, 0.24)), glowMat);
      const hBar = new THREE.Mesh(this.regGeo(new THREE.BoxGeometry(0.72, 0.24, 0.24)), glowMat);
      group.add(vBar, hBar);
    } else if (kind === 'SHIELD') {
      const hex = new THREE.Mesh(this.regGeo(new THREE.CylinderGeometry(0.44, 0.44, 0.16, 6)), glowMat);
      hex.rotation.x = Math.PI / 2;
      group.add(hex);
    } else if (kind === 'SPEED_BOOST') {
      const cone = new THREE.Mesh(this.regGeo(new THREE.ConeGeometry(0.36, 0.82, 6)), glowMat);
      cone.rotation.z = -Math.PI / 2;
      group.add(cone);
    } else if (kind === 'DOUBLE_SCORE') {
      const starA = new THREE.Mesh(this.regGeo(new THREE.OctahedronGeometry(0.42, 0)), glowMat);
      const starB = new THREE.Mesh(this.regGeo(new THREE.OctahedronGeometry(0.42, 0)), glowMat);
      starB.rotation.set(Math.PI / 4, Math.PI / 4, 0);
      group.add(starA, starB);
    } else {
      const gem = new THREE.Mesh(this.regGeo(new THREE.OctahedronGeometry(0.45, 0)), glowMat);
      group.add(gem);
    }

    // Orbiting outer holographic ring around every pickup
    const ring = new THREE.Mesh(
      this.regGeo(new THREE.TorusGeometry(0.66, 0.045, 8, 22)),
      glowMat
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    // Soft ground shadow ring
    const haloMat = new THREE.MeshBasicMaterial({
      color: info.color,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.sharedMats.push(haloMat);
    const baseHalo = new THREE.Mesh(
      this.regGeo(new THREE.RingGeometry(0.5, 0.75, 18)),
      haloMat
    );
    baseHalo.rotation.x = -Math.PI / 2;
    baseHalo.position.y = -0.92;
    group.add(baseHalo);

    group.position.copy(anchor);
    this.pickupGroup.add(group);

    const pickup: ActivePickup = {
      id: this.nextPickupId++,
      kind,
      label: info.label,
      colorHex: info.color,
      group,
      position: anchor.clone(),
      phase: Math.random() * Math.PI * 2,
      life: 28,
    };
    this.pickups.push(pickup);
    return pickup;
  }

  public update(
    dt: number,
    elapsed: number,
    playerPos: THREE.Vector3,
    colliders: ArenaCollider[],
    allowEnemyAttacks: boolean,
    onPlayerOrbHit: (damage: number) => void,
    onPickupCollected: (pickup: ActivePickup) => void
  ): void {
    // 1. Update Enemies & Real AI Navigation
    for (const e of this.enemies) {
      if (!e.alive) continue;

      // Spawn scale-in
      if (e.spawnScale < 1) {
        e.spawnScale = Math.min(1, e.spawnScale + dt * 4.2);
        const eased = 1 - Math.pow(1 - e.spawnScale, 3);
        e.group.scale.setScalar(eased);
      }

      // Spin rotors & rings
      for (const r of e.rotors) {
        r.rotation.y += dt * (e.kind === 'BOSS' ? 3.5 : 10);
      }

      // Hit flash & frost visual state
      if (e.hitFlashTimer > 0) {
        e.hitFlashTimer -= dt;
      }
      if (e.frostTimer > 0) {
        e.frostTimer = Math.max(0, e.frostTimer - dt);
      }
      if (e.bossShieldTimer > 0) {
        e.bossShieldTimer = Math.max(0, e.bossShieldTimer - dt);
        if (e.shieldMesh) e.shieldMesh.visible = e.bossShieldTimer > 0;
      }

      const speedFactor = e.frostTimer > 0 ? 0.42 : 1.0;
      const phaseBoost = e.kind === 'BOSS' ? 1 + (e.bossPhase - 1) * 0.28 : 1;
      const moveSpeed = e.baseSpeed * speedFactor * phaseBoost;

      // Apply frost tint cleanly on primary meshes
      for (const m of e.bodyMeshes) {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (e.hitFlashTimer > 0) {
          mat.emissive.setHex(0xffffff);
          mat.emissiveIntensity = 0.85;
        } else if (e.frostTimer > 0) {
          mat.emissive.setHex(0x38bdf8);
          mat.emissiveIntensity = 0.65;
        } else {
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
        }
      }

      // Distance & Player Detection AI
      this._toPlayer.subVectors(playerPos, e.position);
      const flatDist = Math.hypot(this._toPlayer.x, this._toPlayer.z);
      const detectRange = e.kind === 'BOSS' ? 60 : e.kind === 'SCOUT' ? 30 : 25;

      if (flatDist < detectRange) {
        e.aiState = 'ENGAGE';
      } else if (flatDist > detectRange + 10) {
        e.aiState = 'PATROL';
      }

      e.strafeTimer -= dt;
      if (e.strafeTimer <= 0) {
        e.strafeTimer = 1.6 + Math.random() * 2.2;
        e.strafeSign *= -1;
      }

      if (moveSpeed > 0.05) {
        if (e.isAerial) {
          // Aerial Drone AI: weave around waypoint or orbit player at safe height
          const targetX = e.aiState === 'ENGAGE' ? playerPos.x + Math.cos(elapsed * 0.8 + e.phaseOffset) * 14 : e.waypoint.x;
          const targetZ = e.aiState === 'ENGAGE' ? playerPos.z + Math.sin(elapsed * 0.8 + e.phaseOffset) * 14 : e.waypoint.z;
          const targetY = 4.6 + Math.sin(elapsed * 2.1 + e.phaseOffset) * 1.6;
          this._move.set(targetX - e.position.x, targetY - e.position.y, targetZ - e.position.z);
          if (this._move.lengthSq() > 0.25) {
            this._move.normalize().multiplyScalar(moveSpeed * dt);
            e.position.add(this._move);
          }
          e.position.x = THREE.MathUtils.clamp(e.position.x, -this.arenaRadius + 3, this.arenaRadius - 3);
          e.position.z = THREE.MathUtils.clamp(e.position.z, -this.arenaRadius + 3, this.arenaRadius - 3);
          e.position.y = THREE.MathUtils.clamp(e.position.y, 3.0, 9.5);
        } else {
          // Ground Robot AI with Obstacle Avoidance
          this._move.set(0, 0, 0);
          if (e.aiState === 'ENGAGE') {
            const preferredDist =
              e.kind === 'SCOUT'
                ? 9
                : e.kind === 'HEAVY'
                ? 11
                : e.kind === 'BOSS'
                ? 17
                : 14;
            const nx = this._toPlayer.x / Math.max(0.01, flatDist);
            const nz = this._toPlayer.z / Math.max(0.01, flatDist);
            this._right.set(-nz, 0, nx);

            if (flatDist > preferredDist + 3) {
              this._move.x += nx;
              this._move.z += nz;
            } else if (flatDist < preferredDist - 3) {
              this._move.x -= nx * 0.7;
              this._move.z -= nz * 0.7;
            }
            // Tactical lateral strafing
            const strafeWeight = e.kind === 'SCOUT' ? 1.1 : e.kind === 'HEAVY' ? 0.35 : 0.72;
            this._move.addScaledVector(this._right, e.strafeSign * strafeWeight);
          } else {
            // Patrol toward waypoint
            this._toWay.subVectors(e.waypoint, e.position);
            this._toWay.y = 0;
            if (this._toWay.lengthSq() < 4.5) {
              e.waypoint.copy(this.pickPatrolPoint(e.position, false));
            } else {
              this._toWay.normalize();
              this._move.copy(this._toWay);
            }
          }

          if (this._move.lengthSq() > 0.001) {
            this._move.normalize().multiplyScalar(moveSpeed * dt);
            this.moveGroundEnemySafely(e, this._move.x, this._move.z, colliders);
          }
        }
      }

      // Sync group transform & face player smoothly
      e.group.position.copy(e.position);
      if (e.kind === 'BOSS') {
        e.group.position.y = e.position.y + Math.sin(elapsed * 2.2) * 0.16;
      }
      this._lookTarget.set(playerPos.x, e.group.position.y, playerPos.z);
      e.group.lookAt(this._lookTarget);

      // Telegraphed non-violent energy orbs from combat robots & Boss
      if (allowEnemyAttacks && e.aiState === 'ENGAGE' && flatDist < 34) {
        e.attackCooldown -= dt * (e.frostTimer > 0 ? 0.5 : 1);
        if (e.attackCooldown <= 0) {
          const baseCd =
            e.kind === 'BOSS'
              ? Math.max(1.0, 2.2 - (e.bossPhase - 1) * 0.45)
              : e.kind === 'HEAVY'
              ? 3.1
              : e.kind === 'DRONE'
              ? 3.4
              : 4.0;
          e.attackCooldown = baseCd + Math.random() * 1.1;
          this.fireEnemyOrb(e, playerPos);
        }
      }
    }

    // 2. Update Enemy Energy Orbs
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const orb = this.orbs[i];
      orb.life -= dt;
      orb.mesh.position.addScaledVector(orb.velocity, dt);
      const hitPlayer = orb.mesh.position.distanceTo(playerPos) < 1.1;

      if (hitPlayer) {
        onPlayerOrbHit(orb.damage);
        this.orbGroup.remove(orb.mesh);
        this.orbs.splice(i, 1);
      } else if (
        orb.life <= 0 ||
        this.pointHitsCollider(orb.mesh.position, colliders)
      ) {
        this.orbGroup.remove(orb.mesh);
        this.orbs.splice(i, 1);
      }
    }

    // 3. Update Rotating 3D Pickups & Player Collection
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.life -= dt;
      p.group.rotation.y += dt * 2.1;
      p.group.position.y = p.position.y + Math.sin(elapsed * 3.0 + p.phase) * 0.22;

      const distXZ = Math.hypot(
        playerPos.x - p.position.x,
        playerPos.z - p.position.z
      );
      if (distXZ < 1.95 && Math.abs(playerPos.y - p.position.y) < 2.2) {
        onPickupCollected(p);
        this.pickupGroup.remove(p.group);
        this.pickups.splice(i, 1);
      } else if (p.life <= 0) {
        this.pickupGroup.remove(p.group);
        this.pickups.splice(i, 1);
      }
    }
  }

  private fireEnemyOrb(enemy: ActiveEnemy, playerPos: THREE.Vector3): void {
    const start = enemy.position.clone();
    start.y += enemy.kind === 'BOSS' ? 3.2 : enemy.isAerial ? 0 : 1.45;
    const dir = new THREE.Vector3().subVectors(playerPos, start).normalize();

    const speed = enemy.kind === 'BOSS' ? 19 : 14;
    const damage = enemy.kind === 'BOSS' ? 14 : enemy.kind === 'HEAVY' ? 11 : 7;

    const mesh = new THREE.Mesh(this.orbGeo, this.orbMat);
    mesh.position.copy(start);
    if (enemy.kind === 'BOSS') mesh.scale.setScalar(1.55);
    this.orbGroup.add(mesh);

    this.orbs.push({
      mesh,
      velocity: dir.multiplyScalar(speed),
      damage,
      life: 3.4,
    });
  }

  private pointHitsCollider(pt: THREE.Vector3, colliders: ArenaCollider[]): boolean {
    for (const c of colliders) {
      if (
        pt.x >= c.minX &&
        pt.x <= c.maxX &&
        pt.y >= c.minY &&
        pt.y <= c.maxY &&
        pt.z >= c.minZ &&
        pt.z <= c.maxZ
      ) {
        return true;
      }
    }
    return false;
  }

  private moveGroundEnemySafely(
    enemy: ActiveEnemy,
    dx: number,
    dz: number,
    colliders: ArenaCollider[]
  ): void {
    const r = enemy.radius;
    const bound = this.arenaRadius - r;
    const prevX = enemy.position.x;
    const prevZ = enemy.position.z;

    // Test X axis
    const nextX = THREE.MathUtils.clamp(prevX + dx, -bound, bound);
    if (!this.overlapsObstacle(nextX, prevZ, enemy.position.y, r, colliders)) {
      enemy.position.x = nextX;
    } else {
      // Blocked -> pick fresh flank direction & waypoint so robot never gets stuck
      enemy.strafeSign *= -1;
      if (enemy.aiState === 'PATROL') {
        enemy.waypoint.copy(this.pickPatrolPoint(enemy.position, false));
      }
    }

    // Test Z axis
    const nextZ = THREE.MathUtils.clamp(prevZ + dz, -bound, bound);
    if (!this.overlapsObstacle(enemy.position.x, nextZ, enemy.position.y, r, colliders)) {
      enemy.position.z = nextZ;
    } else {
      enemy.strafeSign *= -1;
      if (enemy.aiState === 'PATROL') {
        enemy.waypoint.copy(this.pickPatrolPoint(enemy.position, false));
      }
    }
  }

  private overlapsObstacle(
    x: number,
    z: number,
    yBottom: number,
    r: number,
    colliders: ArenaCollider[]
  ): boolean {
    const yTop = yBottom + 2.2;
    for (const c of colliders) {
      if (c.maxY <= yBottom + 0.5 || c.minY >= yTop) continue;
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) {
        return true;
      }
    }
    return false;
  }

  private pickBestAnchor(isAerial: boolean, playerPos: THREE.Vector3): SpawnAnchor {
    const pool = this.anchors.filter((a) =>
      isAerial ? a.kind === 'AERIAL' : a.kind !== 'AERIAL'
    );
    const farEnough = pool.filter(
      (a) => a.position.distanceToSquared(playerPos) > 130
    );
    const list = farEnough.length > 0 ? farEnough : pool.length > 0 ? pool : this.anchors;
    return list[Math.floor(Math.random() * list.length)];
  }

  private pickPatrolPoint(from: THREE.Vector3, isAerial: boolean): THREE.Vector3 {
    const pool = this.anchors.filter((a) =>
      isAerial ? a.kind === 'AERIAL' : a.kind === 'GROUND'
    );
    if (pool.length > 0) {
      const choice = pool[Math.floor(Math.random() * pool.length)];
      if (choice.position.distanceToSquared(from) > 25) {
        return choice.position.clone();
      }
    }
    return new THREE.Vector3(
      (Math.random() - 0.5) * (this.arenaRadius * 1.4),
      isAerial ? 5.5 : 0,
      (Math.random() - 0.5) * (this.arenaRadius * 1.4)
    );
  }

  private createHpBar(width: number, yPos: number): {
    barGroup: THREE.Group;
    fill: THREE.Mesh;
  } {
    const barGroup = new THREE.Group();
    barGroup.position.set(0, yPos, 0);
    const bg = new THREE.Mesh(
      this.regGeo(new THREE.PlaneGeometry(width, 0.14)),
      this.matHpBg
    );
    const fill = new THREE.Mesh(
      this.regGeo(new THREE.PlaneGeometry(width - 0.06, 0.09)),
      this.matHpFill
    );
    fill.position.z = 0.01;
    barGroup.add(bg, fill);
    return { barGroup, fill };
  }

  private buildEnemyModel(id: number, kind: EnemyKind) {
    const group = new THREE.Group();
    const rotors: THREE.Object3D[] = [];
    const bodyMeshes: THREE.Mesh[] = [];

    const makeBodyMat = (hex: number, rough = 0.34, metal = 0.42) => {
      const m = new THREE.MeshStandardMaterial({
        color: hex,
        roughness: rough,
        metalness: metal,
      });
      this.sharedMats.push(m);
      return m;
    };

    const makeGlowMat = (hex: number, intensity = 2.6) => {
      const m = new THREE.MeshStandardMaterial({
        color: hex,
        emissive: hex,
        emissiveIntensity: intensity,
        roughness: 0.15,
      });
      this.sharedMats.push(m);
      return m;
    };

    if (kind === 'SCOUT') {
      // Nimble agile hover-scout (emerald-cyan trim)
      const bodyMat = makeBodyMat(0xdbeafe, 0.28, 0.35);
      const glow = makeGlowMat(0x2dd4bf, 2.7);
      const shadow = new THREE.Mesh(this.regGeo(new THREE.PlaneGeometry(1.5, 1.5)), this.matShadow);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.03;
      group.add(shadow);

      const pod = new THREE.Mesh(this.regGeo(new THREE.ConeGeometry(0.45, 0.9, 6)), this.matDark);
      pod.rotation.x = Math.PI;
      pod.position.y = 0.55;
      const chassis = new THREE.Mesh(this.regGeo(new THREE.BoxGeometry(0.75, 0.62, 0.52)), bodyMat);
      chassis.position.y = 1.15;
      chassis.castShadow = true;
      bodyMeshes.push(chassis);

      const visor = new THREE.Mesh(this.regGeo(new THREE.BoxGeometry(0.62, 0.16, 0.12)), glow);
      visor.position.set(0, 1.24, 0.25);

      const finL = new THREE.Mesh(this.regGeo(new THREE.BoxGeometry(0.1, 0.52, 0.32)), glow);
      finL.position.set(-0.46, 1.28, -0.05);
      const finR = finL.clone();
      finR.position.x = 0.46;

      const hoverRing = new THREE.Mesh(this.regGeo(new THREE.TorusGeometry(0.46, 0.045, 8, 16)), glow);
      hoverRing.rotation.x = Math.PI / 2;
      hoverRing.position.y = 0.24;
      rotors.push(hoverRing);

      group.add(pod, chassis, visor, finL, finR, hoverRing);

      const hitProxy = new THREE.Mesh(this.regGeo(new THREE.BoxGeometry(1.35, 1.75, 1.15)), this.matHitProxy);
      hitProxy.position.y = 0.95;
      hitProxy.userData = { enemyId: id };
      group.add(hitProxy);

      return {
        name: 'Scout Robot',
        baseHp: 44,
        baseShield: 0,
        baseSpeed: 6.4,
        radius: 0.75,
        points: 120,
        accentHex: 0x2dd4bf,
        group,
        hitProxy,
        rotors,
        bodyMeshes,
        shieldMesh: undefined,
        hpBarFill: undefined,
      };
    }

    if (kind === 'GUARD') {
      // Standard armored patrol robot (blue-cyan visor)
      const bodyMat = makeBodyMat(0xe2e8f0, 0.3, 0.38);
      const glow = makeGlowMat(0x06b6d4, 2.5);
      const shadow = new THREE.Mesh(this.regGeo(new THREE.PlaneGeometry(1.85, 1.85)), this.matShadow);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.03;
      group.add(shadow);

      const base = new THREE.Mesh(this.regGeo(new THREE.CylinderGeometry(0.54, 0.7, 0.35, 8)), this.matDark);
      base.position.y = 0.18;
      const spine = new THREE.Mesh(this.regGeo(new THREE.CylinderGeometry(0.22, 0.28, 0.55, 8)), this.matSteel);
      spine.position.y = 0.58;
      const torso = new THREE.Mesh(this.regGeo(new THREE.BoxGeometry(0.94, 0.78, 0.56)), bodyMat);
      torso.position.y = 1.14;
      torso.castShadow = true;
      bodyMeshes.push(torso);

      const core = new THREE.Mesh(this.regGeo(new THREE.OctahedronGeometry(0.2, 0)), glow);
      core.position.set(0, 1.14, 0.3);
      rotors.push(core);

      const head = new THREE.Mesh(this.regGeo(new THREE.BoxGeometry(0.56, 0.36, 0.46)), bodyMat);
      head.position.y = 1.72;
      bodyMeshes.push(head);
      const visor = new THREE.Mesh(this.regGeo(new THREE.BoxGeometry(0.48, 0.14, 0.1)), glow);
      visor.position.set(0, 1.73, 0.22);

      const pL = new THREE.Mesh(this.regGeo(new THREE.BoxGeometry(0.3, 0.5, 0.42)), this.matDark);
      pL.position.set(-0.62, 1.24, 0);
      const pR = pL.clone();
      pR.position.x = 0.62;

      group.add(base, spine, torso, core, head, visor, pL, pR);

      const hitProxy = new THREE.Mesh(this.regGeo(new THREE.BoxGeometry(1.55, 2.05, 1.25)), this.matHitProxy);
      hitProxy.position.y = 1.05;
      hitProxy.userData = { enemyId: id };
      group.add(hitProxy);

      return {
        name: 'Guard Robot',
        baseHp: 68,
        baseShield: 0,
        baseSpeed: 4.0,
        radius: 0.9,
        points: 140,
        accentHex: 0x06b6d4,
        group,
        hitProxy,
        rotors,
        bodyMeshes,
        shieldMesh: undefined,
        hpBarFill: undefined,
      };
    }

    if (kind === 'DRONE') {
      // Hovering Quad-Rotor Drone (amber glow)
      const bodyMat = makeBodyMat(0xe2e8f0, 0.26, 0.42);
      const glow = makeGlowMat(0xf59e0b, 2.7);

      const hull = new THREE.Mesh(this.regGeo(new THREE.OctahedronGeometry(0.56, 1)), bodyMat);
      hull.scale.set(1.15, 0.72, 1.15);
      hull.castShadow = true;
      bodyMeshes.push(hull);

      const belt = new THREE.Mesh(this.regGeo(new THREE.TorusGeometry(0.6, 0.08, 8, 18)), this.matDark);
      belt.rotation.x = Math.PI / 2;
      const eye = new THREE.Mesh(this.regGeo(new THREE.SphereGeometry(0.24, 10, 10)), glow);
      eye.position.set(0, 0, 0.54);
      group.add(hull, belt, eye);

      const armGeo = this.regGeo(new THREE.BoxGeometry(0.14, 0.1, 0.85));
      const ductGeo = this.regGeo(new THREE.TorusGeometry(0.3, 0.045, 8, 14));
      for (let i = 0; i < 4; i++) {
        const pivot = new THREE.Group();
        pivot.rotation.y = (i * Math.PI) / 2 + Math.PI / 4;
        const arm = new THREE.Mesh(armGeo, this.matSteel);
        arm.position.set(0, 0.08, 0.66);
        const duct = new THREE.Mesh(ductGeo, glow);
        duct.rotation.x = Math.PI / 2;
        duct.position.set(0, 0.14, 1.02);
        rotors.push(duct);
        pivot.add(arm, duct);
        group.add(pivot);
      }

      const hitProxy = new THREE.Mesh(this.regGeo(new THREE.SphereGeometry(1.18, 10, 8)), this.matHitProxy);
      hitProxy.userData = { enemyId: id };
      group.add(hitProxy);

      return {
        name: 'Flying Drone',
        baseHp: 56,
        baseShield: 0,
        baseSpeed: 5.4,
        radius: 1.0,
        points: 160,
        accentHex: 0xf59e0b,
        group,
        hitProxy,
        rotors,
        bodyMeshes,
        shieldMesh: undefined,
        hpBarFill: undefined,
      };
    }

    if (kind === 'HEAVY') {
      // Bulky High-Armor Heavy Mech (deep crimson/orange core)
      const bodyMat = makeBodyMat(0x475569, 0.42, 0.62);
      const glow = makeGlowMat(0xf97316, 2.8);
      const shadow = new THREE.Mesh(this.regGeo(new THREE.PlaneGeometry(2.7, 2.7)), this.matShadow);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.03;
      group.add(shadow);

      const legs = new THREE.Mesh(this.regGeo(new THREE.CylinderGeometry(0.85, 1.05, 0.65, 8)), this.matDark);
      legs.position.y = 0.34;
      const chest = new THREE.Mesh(this.regGeo(new THREE.BoxGeometry(1.55, 1.25, 1.05)), bodyMat);
      chest.position.y = 1.4;
      chest.castShadow = true;
      bodyMeshes.push(chest);

      const core = new THREE.Mesh(this.regGeo(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 12)), glow);
      core.rotation.x = Math.PI / 2;
      core.position.set(0, 1.45, 0.52);

      const shL = new THREE.Mesh(this.regGeo(new THREE.BoxGeometry(0.55, 0.85, 0.85)), this.matDark);
      shL.position.set(-1.05, 1.65, 0);
      const shR = shL.clone();
      shR.position.x = 1.05;

      const head = new THREE.Mesh(this.regGeo(new THREE.BoxGeometry(0.75, 0.45, 0.62)), bodyMat);
      head.position.y = 2.24;
      bodyMeshes.push(head);
      const visor = new THREE.Mesh(this.regGeo(new THREE.BoxGeometry(0.62, 0.16, 0.1)), glow);
      visor.position.set(0, 2.26, 0.32);

      const { barGroup, fill } = this.createHpBar(1.3, 2.8);
      group.add(legs, chest, core, shL, shR, head, visor, barGroup);

      const hitProxy = new THREE.Mesh(this.regGeo(new THREE.BoxGeometry(2.25, 2.65, 1.6)), this.matHitProxy);
      hitProxy.position.y = 1.35;
      hitProxy.userData = { enemyId: id };
      group.add(hitProxy);

      return {
        name: 'Heavy Robot',
        baseHp: 165,
        baseShield: 0,
        baseSpeed: 2.5,
        radius: 1.25,
        points: 280,
        accentHex: 0xf97316,
        group,
        hitProxy,
        rotors,
        bodyMeshes,
        shieldMesh: undefined,
        hpBarFill: fill,
      };
    }

    if (kind === 'SHIELD') {
      // Tactical Shield Robot with Glowing Translucent Front Energy Barrier
      const bodyMat = makeBodyMat(0xcbd5e1, 0.3, 0.45);
      const glow = makeGlowMat(0x60a5fa, 2.6);
      const shadow = new THREE.Mesh(this.regGeo(new THREE.PlaneGeometry(2.1, 2.1)), this.matShadow);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.03;
      group.add(shadow);

      const base = new THREE.Mesh(this.regGeo(new THREE.CylinderGeometry(0.62, 0.78, 0.38, 8)), this.matDark);
      base.position.y = 0.2;
      const torso = new THREE.Mesh(this.regGeo(new THREE.BoxGeometry(1.05, 0.95, 0.66)), bodyMat);
      torso.position.y = 1.05;
      torso.castShadow = true;
      bodyMeshes.push(torso);

      const head = new THREE.Mesh(this.regGeo(new THREE.BoxGeometry(0.58, 0.38, 0.5)), bodyMat);
      head.position.y = 1.78;
      bodyMeshes.push(head);
      const visor = new THREE.Mesh(this.regGeo(new THREE.BoxGeometry(0.46, 0.14, 0.1)), glow);
      visor.position.set(0, 1.8, 0.26);

      // Front holographic hexagonal energy shield
      const shieldMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x2563eb,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.sharedMats.push(shieldMat);
      const shieldMesh = new THREE.Mesh(
        this.regGeo(new THREE.CylinderGeometry(1.15, 1.15, 1.9, 6, 1, true, -Math.PI * 0.38, Math.PI * 0.76)),
        shieldMat
      );
      shieldMesh.position.set(0, 1.12, 0.15);
      group.add(shieldMesh);

      const { barGroup, fill } = this.createHpBar(1.2, 2.35);
      group.add(base, torso, head, visor, barGroup);

      const hitProxy = new THREE.Mesh(this.regGeo(new THREE.BoxGeometry(1.85, 2.15, 1.5)), this.matHitProxy);
      hitProxy.position.y = 1.1;
      hitProxy.userData = { enemyId: id };
      group.add(hitProxy);

      return {
        name: 'Shield Robot',
        baseHp: 95,
        baseShield: 85,
        baseSpeed: 3.2,
        radius: 1.05,
        points: 240,
        accentHex: 0x60a5fa,
        group,
        hitProxy,
        rotors,
        bodyMeshes,
        shieldMesh,
        hpBarFill: fill,
      };
    }

    // BOSS: TITAN CORE MK-IX (Colossal 12-part sci-fi boss mech!)
    const bossBodyMat = makeBodyMat(0x1e293b, 0.36, 0.72);
    const bossPlateMat = makeBodyMat(0xe2e8f0, 0.28, 0.46);
    const bossGlow = makeGlowMat(0xf43f5e, 3.2);

    const shadow = new THREE.Mesh(this.regGeo(new THREE.PlaneGeometry(6.2, 6.2)), this.matShadow);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.04;
    group.add(shadow);

    const lowerHull = new THREE.Mesh(this.regGeo(new THREE.CylinderGeometry(1.7, 2.3, 1.3, 8)), bossBodyMat);
    lowerHull.position.y = 0.7;
    lowerHull.castShadow = true;

    const hoverThruster = new THREE.Mesh(this.regGeo(new THREE.TorusGeometry(2.1, 0.16, 10, 24)), bossGlow);
    hoverThruster.rotation.x = Math.PI / 2;
    hoverThruster.position.y = 0.35;
    rotors.push(hoverThruster);

    const mainCoreBody = new THREE.Mesh(this.regGeo(new THREE.BoxGeometry(3.2, 2.5, 2.1)), bossPlateMat);
    mainCoreBody.position.y = 2.65;
    mainCoreBody.castShadow = true;
    bodyMeshes.push(mainCoreBody);

    const reactorHeart = new THREE.Mesh(this.regGeo(new THREE.OctahedronGeometry(0.85, 0)), bossGlow);
    reactorHeart.position.set(0, 2.65, 1.08);
    rotors.push(reactorHeart);

    const podL = new THREE.Mesh(this.regGeo(new THREE.BoxGeometry(1.2, 1.8, 1.5)), bossBodyMat);
    podL.position.set(-2.35, 3.15, 0.1);
    podL.castShadow = true;
    bodyMeshes.push(podL);
    const podR = podL.clone();
    podR.position.x = 2.35;
    bodyMeshes.push(podR);

    const cannonL = new THREE.Mesh(this.regGeo(new THREE.CylinderGeometry(0.28, 0.34, 1.8, 10)), this.matSteel);
    cannonL.rotation.x = Math.PI / 2;
    cannonL.position.set(-2.35, 3.15, 1.15);
    const cannonR = cannonL.clone();
    cannonR.position.x = 2.35;

    const crownHead = new THREE.Mesh(this.regGeo(new THREE.BoxGeometry(1.5, 0.95, 1.25)), bossPlateMat);
    crownHead.position.y = 4.45;
    bodyMeshes.push(crownHead);
    const bossVisor = new THREE.Mesh(this.regGeo(new THREE.BoxGeometry(1.28, 0.32, 0.2)), bossGlow);
    bossVisor.position.set(0, 4.48, 0.62);

    const orbitalRing = new THREE.Mesh(this.regGeo(new THREE.TorusGeometry(2.85, 0.12, 10, 32)), bossGlow);
    orbitalRing.position.set(0, 3.1, 0);
    orbitalRing.rotation.x = Math.PI / 3;
    rotors.push(orbitalRing);

    const bossShieldMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xf43f5e,
      emissiveIntensity: 1.6,
      transparent: true,
      opacity: 0.28,
      wireframe: true,
    });
    this.sharedMats.push(bossShieldMat);
    const bossShieldMesh = new THREE.Mesh(this.regGeo(new THREE.IcosahedronGeometry(3.6, 1)), bossShieldMat);
    bossShieldMesh.position.y = 2.6;
    bossShieldMesh.visible = false;

    group.add(
      lowerHull,
      hoverThruster,
      mainCoreBody,
      reactorHeart,
      podL,
      podR,
      cannonL,
      cannonR,
      crownHead,
      bossVisor,
      orbitalRing,
      bossShieldMesh
    );

    const hitProxy = new THREE.Mesh(this.regGeo(new THREE.BoxGeometry(4.8, 5.1, 3.2)), this.matHitProxy);
    hitProxy.position.y = 2.6;
    hitProxy.userData = { enemyId: id };
    group.add(hitProxy);

    return {
      name: 'TITAN CORE MK-IX',
      baseHp: 1100,
      baseShield: 0,
      baseSpeed: 2.9,
      radius: 2.6,
      points: 2500,
      accentHex: 0xf43f5e,
      group,
      hitProxy,
      rotors,
      bodyMeshes,
      shieldMesh: bossShieldMesh,
      hpBarFill: undefined,
    };
  }

  public dispose(): void {
    this.clearAll();
    this.sharedGeos.forEach((g) => g.dispose());
    this.sharedMats.forEach((m) => m.dispose());
  }
}
