import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

/**
 * React Component
 * Three.js + Instancing + Octree + Dynamic PointCloud
 */

export default function App() {
  const mountRef = useRef(null);

  useEffect(() => {
    /* ==================== BASIC ==================== */
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 3000);
    camera.position.set(0, 200, 500);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    /* ==================== PARAMS ==================== */
    const POINT_COUNT = 200_000;
    const OCTREE_CAPACITY = 512;
    const WORLD_SIZE = 600;

    /* ==================== DATA ==================== */
    const positions = new Float32Array(POINT_COUNT * 3);
    const velocities = new Float32Array(POINT_COUNT * 3);

    for (let i = 0; i < POINT_COUNT; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * WORLD_SIZE;
      positions[i * 3 + 1] = (Math.random() - 0.5) * WORLD_SIZE;
      positions[i * 3 + 2] = (Math.random() - 0.5) * WORLD_SIZE;

      velocities[i * 3 + 0] = (Math.random() - 0.5) * 0.5;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }

    /* ==================== OCTREE ==================== */
    class OctreeNode {
      constructor(box, depth = 0) {
        this.box = box;
        this.depth = depth;
        this.indices = [];
        this.children = null;
      }

      insert(index) {
        if (this.children) {
          this._insertToChildren(index);
          return;
        }

        this.indices.push(index);

        if (this.indices.length > OCTREE_CAPACITY && this.depth < 8) {
          this.subdivide();
        }
      }

      subdivide() {
        this.children = [];
        const { min, max } = this.box;
        const mid = new THREE.Vector3()
          .addVectors(min, max)
          .multiplyScalar(0.5);

        for (let xi = 0; xi < 2; xi++) {
          for (let yi = 0; yi < 2; yi++) {
            for (let zi = 0; zi < 2; zi++) {
              const childMin = new THREE.Vector3(
                xi === 0 ? min.x : mid.x,
                yi === 0 ? min.y : mid.y,
                zi === 0 ? min.z : mid.z
              );
              const childMax = new THREE.Vector3(
                xi === 0 ? mid.x : max.x,
                yi === 0 ? mid.y : max.y,
                zi === 0 ? mid.z : max.z
              );
              this.children.push(
                new OctreeNode(new THREE.Box3(childMin, childMax), this.depth + 1)
              );
            }
          }
        }

        for (const idx of this.indices) {
          this._insertToChildren(idx);
        }
        this.indices.length = 0;
      }

      _insertToChildren(index) {
        const x = positions[index * 3];
        const y = positions[index * 3 + 1];
        const z = positions[index * 3 + 2];
        for (const child of this.children) {
          if (child.box.containsPoint({ x, y, z })) {
            child.insert(index);
            return;
          }
        }
      }

      queryFrustum(frustum, out) {
        if (!frustum.intersectsBox(this.box)) return;

        if (this.children) {
          for (const c of this.children) c.queryFrustum(frustum, out);
        } else {
          for (const i of this.indices) out.push(i);
        }
      }
    }

    /* ==================== INSTANCING ==================== */
    const geometry = new THREE.SphereGeometry(0.6, 6, 6);
    const material = new THREE.MeshBasicMaterial({ color: 0xffcc88 });
    const mesh = new THREE.InstancedMesh(geometry, material, POINT_COUNT);
    mesh.frustumCulled = false;
    scene.add(mesh);

    const dummy = new THREE.Object3D();

    /* ==================== ANIMATE ==================== */
    const frustum = new THREE.Frustum();
    const projMatrix = new THREE.Matrix4();
    let raf;

    function animate() {
      raf = requestAnimationFrame(animate);

      /* --- move points --- */
      for (let i = 0; i < POINT_COUNT; i++) {
        const i3 = i * 3;
        positions[i3] += velocities[i3];
        positions[i3 + 1] += velocities[i3 + 1];
        positions[i3 + 2] += velocities[i3 + 2];
      }

      /* --- rebuild octree --- */
      const root = new OctreeNode(
        new THREE.Box3(
          new THREE.Vector3(-WORLD_SIZE, -WORLD_SIZE, -WORLD_SIZE),
          new THREE.Vector3(WORLD_SIZE, WORLD_SIZE, WORLD_SIZE)
        )
      );
      for (let i = 0; i < POINT_COUNT; i++) root.insert(i);

      /* --- frustum culling --- */
      camera.updateMatrixWorld();
      projMatrix.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
      );
      frustum.setFromProjectionMatrix(projMatrix);

      const visible = [];
      root.queryFrustum(frustum, visible);

      /* --- update instances --- */
      let count = 0;
      for (const i of visible) {
        const i3 = i * 3;
        dummy.position.set(
          positions[i3],
          positions[i3 + 1],
          positions[i3 + 2]
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(count++, dummy.matrix);
      }

      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;

      controls.update();
      renderer.render(scene, camera);
    }

    animate();

    /* ==================== CLEANUP ==================== */
    return () => {
      cancelAnimationFrame(raf);
      controls.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100vh" }} />;
}
