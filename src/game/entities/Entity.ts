import * as THREE from 'three';

/**
 * Patch a MeshBasicMaterial with a `uFlash` uniform (0..1) that blends the
 * sprite toward pure white while keeping its alpha/silhouette. A material
 * colour multiply can only darken a texture, so a real white hit-flash needs
 * this tiny shader hook. Returns the uniform so callers can drive it.
 */
export function addFlashUniform(mat: THREE.MeshBasicMaterial): { value: number } {
  const uFlash = { value: 0 };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uFlash = uFlash;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float uFlash;\nvoid main() {')
      .replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\n\tgl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0), uFlash);'
      );
  };
  // All flash-patched materials share one compiled program.
  mat.customProgramCacheKey = () => 'flash';
  return uFlash;
}

export abstract class Entity {
  mesh: THREE.Mesh;
  vx: number = 0;
  vy: number = 0;
  hp: number = 1;
  active: boolean = true;
  radius: number = 16;
  /** 0 = normal, 1 = solid white. Drive via setFlash(). */
  protected flashUniform: { value: number };

  constructor(scene: THREE.Scene, texture: THREE.Texture, width: number, height: number) {
    const geo = new THREE.PlaneGeometry(width, height);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false
    });
    this.flashUniform = addFlashUniform(mat);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.renderOrder = 10;
    scene.add(this.mesh);
  }

  setFlash(amount: number) {
    this.flashUniform.value = amount;
  }

  abstract update(dt: number, time: number, cameraX: number): void;

  takeDamage(amount: number) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.active = false;
    }
  }

  destroy(scene: THREE.Scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
