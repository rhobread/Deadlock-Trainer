import * as THREE from "three";

export type RangeTargetKind = "trooper" | "secure" | "deny";
export type RangeProjection = {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
};
export type RangeFrame = {
  now: number;
  delta: number;
  running: boolean;
  actions: ReadonlySet<string>;
  cue: "none" | "enemy-melee" | "player-melee" | "parry" | "movement";
  progress: number;
  reducedMotion: boolean;
};

type Figure = { root: THREE.Group; arm: THREE.Group };
const clamp = THREE.MathUtils.clamp;

export class PracticeRange {
  private occluders: THREE.Object3D[] = [];
  readonly available: boolean;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(64, 1, 0.08, 120);
  private geometries = new Set<THREE.BufferGeometry>();
  private materials = new Set<THREE.MeshStandardMaterial>();
  private raycaster = new THREE.Raycaster();
  private target = new THREE.Group();
  private trooper!: Figure;
  private opponent!: Figure;
  private shoulder!: THREE.Group;
  private fist!: THREE.Mesh;
  private telegraph!: THREE.Mesh;
  private parry!: THREE.Mesh;
  private soul!: THREE.Mesh;
  private charge!: THREE.MeshStandardMaterial;
  private targetMeshes: THREE.Mesh[] = [];
  private kind: RangeTargetKind | null = null;
  private player = new THREE.Vector3(0, 0, 7);
  private dashDirection = new THREE.Vector3();
  private soulOrigin = new THREE.Vector3();
  private lastTrooper: THREE.Vector3 | null = null;
  private held = new Set<string>();
  private yaw = 0;
  private pitch = -0.055;
  private dashTime = 0;
  private jumpVelocity = 0;
  private crouch = 0;
  private targetAge = 0;
  private running = false;
  private disposed = false;
  private width = 1;
  private height = 1;
  private projection: RangeProjection | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.25;
      this.buildScene();
      this.reset();
      this.resize();
      this.available = true;
    } catch {
      this.dispose();
      this.available = false;
    }
  }

  private material(color: number, emissive = 0): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.82,
      emissive,
    });
    this.materials.add(material);
    return material;
  }

  private mesh(
    geometry: THREE.BufferGeometry,
    material: THREE.MeshStandardMaterial,
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
  ): THREE.Mesh {
    this.geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  private box(
    parent: THREE.Object3D,
    material: THREE.MeshStandardMaterial,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ): THREE.Mesh {
    return this.mesh(new THREE.BoxGeometry(w, h, d), material, parent, x, y, z);
  }

  private figure(material: THREE.MeshStandardMaterial): Figure {
    const root = new THREE.Group();
    const boots = this.material(0x242d31);
    const face = this.material(0xb6a184);
    this.box(root, material, 0, 1.28, 0, 0.8, 0.85, 0.5);
    this.mesh(new THREE.SphereGeometry(0.27, 12, 10), face, root, 0, 1.99, 0);
    this.mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.17, 12),
      material,
      root,
      0,
      2.17,
      0,
    );
    for (const side of [-1, 1]) {
      this.box(root, boots, side * 0.23, 0.45, 0, 0.29, 0.9, 0.36);
      if (side === -1)
        this.box(root, material, -0.54, 1.22, 0, 0.26, 0.8, 0.29);
    }
    const arm = new THREE.Group();
    arm.position.set(0.52, 1.64, 0);
    root.add(arm);
    this.box(arm, material, 0, -0.35, 0, 0.29, 0.75, 0.3);
    this.box(arm, face, 0, -0.77, 0, 0.33, 0.26, 0.34);
    return { root, arm };
  }

  private buildScene(): void {
    this.scene.background = new THREE.Color(0x526268);
    this.scene.fog = new THREE.Fog(0x526268, 24, 76);
    this.scene.add(new THREE.HemisphereLight(0xd4e4de, 0x343039, 2.1));
    const sun = new THREE.DirectionalLight(0xffd3a0, 3.1);
    sun.position.set(-9, 16, 8);
    this.scene.add(sun);
    const stone = this.material(0x777c75);
    const asphalt = this.material(0x363f42);
    const iron = this.material(0x263e41);
    const brick = this.material(0x77564a);
    const trim = this.material(0xaaa08b);
    const window = this.material(0x223d43, 0x112b2b);
    const lamp = this.material(0xf6d79d, 0xf4bc65);
    this.box(this.scene, asphalt, 0, -0.18, -20, 16, 0.35, 90);
    for (const side of [-1, 1]) {
      this.box(this.scene, stone, side * 7, 0, -20, 2.7, 0.22, 90);
      this.box(this.scene, trim, side * 5.6, 0.04, -20, 0.16, 0.3, 90);
      for (let block = 0; block < 6; block++) {
        const z = 6 - block * 11;
        const height = 8 + (block % 3) * 2;
        this.box(
          this.scene,
          block % 2 ? brick : stone,
          side * 10,
          height / 2,
          z,
          6,
          height,
          10.4,
        );
        this.box(this.scene, trim, side * 9.9, height, z, 6.4, 0.4, 10.8);
        this.box(this.scene, iron, side * 6.88, 2.3, z, 0.18, 3.6, 2.5);
        this.box(this.scene, trim, side * 6.7, 4.35, z, 0.55, 0.3, 3.1);
        for (let floor = 0; floor < 2; floor++) {
          for (const offset of [-3.2, 0, 3.2]) {
            this.box(
              this.scene,
              trim,
              side * 6.94,
              5.7 + floor * 2.7,
              z + offset,
              0.2,
              1.85,
              1.5,
            );
            this.box(
              this.scene,
              window,
              side * 6.8,
              5.7 + floor * 2.7,
              z + offset,
              0.12,
              1.5,
              1.14,
            );
          }
        }
        this.mesh(
          new THREE.CylinderGeometry(0.1, 0.1, 4.5, 8),
          iron,
          this.scene,
          side * 5.15,
          2.25,
          z - 4,
        );
        this.box(this.scene, lamp, side * 5.15, 4.45, z - 4, 0.48, 0.65, 0.48);
      }
    }
    // Repeated paving seams, rail lines, and cover give translation useful depth cues.
    for (let z = 9; z > -58; z -= 3) {
      this.box(this.scene, stone, -6.8, 0.12, z, 2.4, 0.015, 0.035);
      this.box(this.scene, stone, 6.8, 0.12, z, 2.4, 0.015, 0.035);
    }
    for (const x of [-1.8, 1.8])
      this.box(this.scene, iron, x, 0.005, -20, 0.06, 0.02, 85);
    for (const [x, z] of [
      [-4, 2],
      [4, -4],
      [-4.1, -15],
      [3.9, -23],
    ]) {
      this.box(this.scene, iron, x, 0.65, z, 1.7, 1.3, 2.4);
      this.box(this.scene, trim, x, 1.31, z, 1.85, 0.12, 2.55);
    }
    this.box(this.scene, brick, 0, 4, -57, 20, 8, 2);
    this.box(this.scene, iron, 0, 2.8, -55.9, 5, 5.6, 0.25);
    for (const x of [-3.7, 3.7]) {
      const dummy = this.figure(this.material(0x605d50));
      dummy.root.position.set(x, 0, -24);
      this.scene.add(dummy.root);
    }
    this.occluders = [...this.scene.children];
    this.trooper = this.figure(this.material(0x627b65));
    this.box(
      this.trooper.root,
      this.material(0x3c2522),
      0,
      2.65,
      0,
      1.1,
      0.09,
      0.07,
    );
    this.box(
      this.trooper.root,
      this.material(0xf57955, 0xa62e12),
      -0.43,
      2.65,
      0.04,
      0.23,
      0.09,
      0.07,
    );
    this.soul = this.mesh(
      new THREE.SphereGeometry(0.39, 24, 18),
      this.material(0x73ddff, 0x279fd3),
      this.target,
      0,
      0,
      0,
    );
    this.target.add(this.trooper.root);
    this.scene.add(this.target);
    this.opponent = this.figure(this.material(0xa56e5d));
    this.scene.add(this.opponent.root);
    this.telegraph = this.mesh(
      new THREE.TorusGeometry(0.8, 0.055, 8, 40),
      this.material(0xff745c, 0xd83c23),
      this.opponent.root,
      0,
      0.05,
      0,
    );
    this.telegraph.rotation.x = -Math.PI / 2;
    this.shoulder = new THREE.Group();
    this.shoulder.position.set(-0.66, -1.06, -1.8);
    const coat = this.material(0x293b40);
    this.box(this.shoulder, coat, 0, 0, 0, 0.64, 0.95, 0.45);
    this.mesh(
      new THREE.SphereGeometry(0.23, 14, 12),
      coat,
      this.shoulder,
      -0.06,
      0.68,
      0,
    );
    this.box(this.shoulder, iron, 0.38, 0.05, -0.53, 0.15, 0.17, 0.85);
    this.charge = this.material(0xd8b78b);
    this.fist = this.box(
      this.shoulder,
      this.charge,
      0.4,
      -0.02,
      -0.2,
      0.26,
      0.27,
      0.3,
    );
    this.parry = this.mesh(
      new THREE.TorusGeometry(0.42, 0.025, 8, 36),
      this.material(0x9de9ed, 0x4bcbdf),
      this.shoulder,
      0.48,
      0.2,
      -0.7,
    );
    this.camera.add(this.shoulder);
    this.scene.add(this.camera);
  }

  reset(): void {
    this.player.set(0, 0, 7);
    this.yaw = 0;
    this.pitch = -0.055;
    this.dashTime = this.jumpVelocity = this.crouch = this.targetAge = 0;
    this.held.clear();
    this.running = false;
    this.projection = null;
    this.camera.fov = 64;
    this.camera.updateProjectionMatrix();
    this.setTarget(null);
    this.lastTrooper = null;
  }

  setTarget(
    kind: RangeTargetKind | null,
    radiusScale = 1,
    fromLastHit = false,
  ): void {
    if (!this.renderer || this.disposed) return;
    if (this.kind === "trooper")
      this.lastTrooper = this.target.position.clone();
    this.kind = kind;
    this.targetAge = 0;
    this.projection = null;
    this.target.visible = kind !== null;
    this.trooper.root.visible = kind === "trooper";
    this.soul.visible = kind !== null && kind !== "trooper";
    this.target.scale.setScalar(
      clamp(Number.isFinite(radiusScale) ? radiusScale : 1, 0.45, 1.7),
    );
    if (kind && kind !== "trooper" && fromLastHit && this.lastTrooper) {
      this.target.position.copy(this.lastTrooper).setY(2.8);
    } else {
      this.target.position.set(
        (Math.random() - 0.5) * 4.5,
        kind === "trooper" ? 0 : 2,
        -7 - Math.random() * 5,
      );
    }
    this.soulOrigin.copy(this.target.position);
    const material = this.soul.material as THREE.MeshStandardMaterial;
    material.color.setHex(kind === "deny" ? 0xffb45e : 0x73ddff);
    material.emissive.setHex(kind === "deny" ? 0xcf5918 : 0x279fd3);
    this.targetMeshes = [];
    const body = kind === "trooper" ? this.trooper.root : this.soul;
    if (kind)
      body.traverse((object) => {
        if (object instanceof THREE.Mesh) this.targetMeshes.push(object);
      });
  }

  look(dx: number, dy: number): void {
    if (
      !this.running ||
      this.disposed ||
      !Number.isFinite(dx) ||
      !Number.isFinite(dy)
    )
      return;
    this.yaw = clamp(this.yaw - dx * 0.002, -1.2, 1.2);
    this.pitch = clamp(this.pitch - dy * 0.002, -0.65, 0.5);
  }

  render(frame: RangeFrame): RangeProjection | null {
    if (!this.available || !this.renderer || this.disposed) return null;
    this.running = frame.running;
    const dt =
      frame.running && Number.isFinite(frame.delta)
        ? clamp(frame.delta, 0, 0.05)
        : 0;
    const down = (id: string) => frame.actions.has(id);
    const edge = (id: string) => down(id) && !this.held.has(id);
    const forward = new THREE.Vector3(
      -Math.sin(this.yaw),
      0,
      -Math.cos(this.yaw),
    );
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const direction = forward
      .clone()
      .multiplyScalar(
        Number(down("MoveForward")) - Number(down("MoveBackwards")),
      )
      .addScaledVector(
        right,
        Number(down("MoveRight")) - Number(down("MoveLeft")),
      )
      .normalize();
    if (frame.running) {
      if (edge("Roll")) {
        this.dashTime = 0.19;
        this.dashDirection.copy(direction.lengthSq() ? direction : forward);
      }
      if (edge("Mantle") && this.player.y === 0) this.jumpVelocity = 5;
      this.crouch = THREE.MathUtils.damp(
        this.crouch,
        down("Crouch") ? 0.65 : 0,
        16,
        dt,
      );
      this.player.addScaledVector(direction, dt * (down("Crouch") ? 1.8 : 3.8));
      if (this.dashTime > 0)
        this.player.addScaledVector(
          this.dashDirection,
          12 * Math.min(dt, this.dashTime),
        );
      this.dashTime = Math.max(0, this.dashTime - dt);
      this.jumpVelocity -= 13 * dt;
      this.player.y = Math.max(0, this.player.y + this.jumpVelocity * dt);
      if (this.player.y === 0) this.jumpVelocity = 0;
      this.player.x = clamp(this.player.x, -4.6, 4.6);
      this.player.z = clamp(this.player.z, 1.5, 12);
      this.targetAge += dt;
      this.camera.fov = THREE.MathUtils.damp(
        this.camera.fov,
        down("ADS") ? 46 : 64,
        14,
        dt,
      );
    }
    this.held = new Set(frame.actions);
    const bob =
      !frame.reducedMotion && direction.lengthSq() && frame.running
        ? Math.sin(frame.now * 0.011) * 0.028
        : 0;
    this.camera.position.copy(this.player).addScaledVector(right, 0.48);
    this.camera.position.y += 2.25 - this.crouch + bob;
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    this.camera.updateProjectionMatrix();
    if (this.kind && this.kind !== "trooper") {
      this.target.position.copy(this.soulOrigin);
      if (!frame.reducedMotion) {
        this.target.position.y += Math.min(1.65, this.targetAge * 0.65);
        this.target.position.x += Math.sin(this.targetAge * 1.8) * 0.18;
      }
    }
    const melee =
      frame.cue === "enemy-melee" ||
      frame.cue === "parry" ||
      frame.cue === "player-melee";
    const progress = clamp(
      Number.isFinite(frame.progress) ? frame.progress : 0,
      0,
      1,
    );
    this.opponent.root.visible = melee;
    this.opponent.root.position
      .copy(this.player)
      .addScaledVector(forward, 4.2)
      .addScaledVector(right, 0.7);
    this.opponent.root.position.y = 0;
    this.opponent.root.rotation.y = this.yaw;
    this.opponent.arm.rotation.x = melee ? -0.65 - progress * 1.8 : 0;
    this.opponent.arm.rotation.z = melee ? -0.65 * progress : 0;
    this.telegraph.visible =
      frame.cue === "enemy-melee" || frame.cue === "parry";
    this.telegraph.scale.setScalar(1 + progress * 0.55);
    const charging = frame.cue === "player-melee" || down("AbilityMelee");
    this.charge.emissive.setHex(charging ? 0xffaa43 : 0);
    this.charge.emissiveIntensity = charging ? 0.5 + progress * 2 : 0;
    this.fist.position.z = charging ? -0.2 + progress * 0.25 : -0.2;
    this.parry.visible = frame.cue === "parry" || down("HeldItem");
    this.scene.updateMatrixWorld(true);
    this.renderer.render(this.scene, this.camera);
    this.projection = this.projectTarget();
    return this.projection;
  }

  private projectTarget(): RangeProjection | null {
    if (!this.kind) return null;
    const bounds = new THREE.Box3().setFromObject(
      this.kind === "trooper" ? this.trooper.root : this.soul,
    );
    const center = new THREE.Vector3(
      0,
      this.kind === "trooper" ? 1.3 : 0,
      0,
    ).applyMatrix4(this.target.matrixWorld);
    const local = center.clone().applyMatrix4(this.camera.matrixWorldInverse);
    const point = center.project(this.camera);
    const x = ((point.x + 1) * this.width) / 2;
    const y = ((1 - point.y) * this.height) / 2;
    let halfWidth = 0,
      halfHeight = 0;
    for (const bx of [bounds.min.x, bounds.max.x]) {
      for (const by of [bounds.min.y, bounds.max.y]) {
        for (const bz of [bounds.min.z, bounds.max.z]) {
          const corner = new THREE.Vector3(bx, by, bz).project(this.camera);
          halfWidth = Math.max(
            halfWidth,
            Math.abs(((corner.x + 1) * this.width) / 2 - x),
          );
          halfHeight = Math.max(
            halfHeight,
            Math.abs(((1 - corner.y) * this.height) / 2 - y),
          );
        }
      }
    }
    return {
      x,
      y,
      width: halfWidth * 2,
      height: halfHeight * 2,
      visible:
        local.z < -this.camera.near &&
        point.z >= -1 &&
        point.z <= 1 &&
        x + halfWidth > 0 &&
        x - halfWidth < this.width &&
        y + halfHeight > 0 &&
        y - halfHeight < this.height,
    };
  }

  hitTest(x: number, y: number): boolean {
    if (
      !this.available ||
      this.disposed ||
      !this.projection?.visible ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      x < 0 ||
      y < 0 ||
      x > this.width ||
      y > this.height
    )
      return false;
    this.raycaster.setFromCamera(
      new THREE.Vector2((x / this.width) * 2 - 1, 1 - (y / this.height) * 2),
      this.camera,
    );
    const target = this.raycaster.intersectObjects(this.targetMeshes, false)[0];
    if (!target) return false;
    const obstruction = this.raycaster.intersectObjects(
      this.occluders,
      true,
    )[0];
    return !obstruction || target.distance <= obstruction.distance + 0.001;
  }

  resize(): void {
    if (!this.renderer || this.disposed) return;
    const bounds = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, bounds.width);
    this.height = Math.max(1, bounds.height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.shoulder.position.x = -Math.min(0.66, this.camera.aspect * 0.5);
    this.shoulder.scale.setScalar(Math.min(1, this.camera.aspect / 0.8));
    this.renderer.setSize(this.width, this.height, false);
    this.projection = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.running = false;
    this.projection = null;
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.geometries.clear();
    this.materials.clear();
    this.scene.clear();
    this.renderer?.dispose();
    this.renderer = null;
  }
}
