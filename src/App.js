import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

/* =================== Simple Octree =================== */
class OctreeNode {
  constructor(min, max, depth = 0) {
    this.min = min;
    this.max = max;
    this.depth = depth;
    this.points = [];
    this.children = null;
  }

  insert(p) {
    if (this.children) {
      return this._insertChild(p);
    }

    this.points.push(p);

    if (this.points.length > 64 && this.depth < 6) {
      this.subdivide();
    }
  }

  subdivide() {
    this.children = [];
    const { min, max } = this;
    const mx = (min.x + max.x) * 0.5;
    const my = (min.y + max.y) * 0.5;
    const mz = (min.z + max.z) * 0.5;

    for (let xi = 0; xi < 2; xi++) {
      for (let yi = 0; yi < 2; yi++) {
        for (let zi = 0; zi < 2; zi++) {
          this.children.push(
            new OctreeNode(
              new THREE.Vector3(
                xi ? mx : min.x,
                yi ? my : min.y,
                zi ? mz : min.z
              ),
              new THREE.Vector3(
                xi ? max.x : mx,
                yi ? max.y : my,
                zi ? max.z : mz
              ),
              this.depth + 1
            )
          );
        }
      }
    }

    for (const p of this.points) this._insertChild(p);
    this.points.length = 0;
  }

  _insertChild(p) {
    for (const c of this.children) {
      if (
        p.x >= c.min.x &&
        p.x <= c.max.x &&
        p.y >= c.min.y &&
        p.y <= c.max.y &&
        p.z >= c.min.z &&
        p.z <= c.max.z
      ) {
        c.insert(p);
        return;
      }
    }
  }

  query(frustum, out) {
    const box = new THREE.Box3(this.min, this.max);
    if (!frustum.intersectsBox(box)) return;

    if (this.children) {
      for (const c of this.children) c.query(frustum, out);
    } else {
      for (const p of this.points) out.push(p);
    }
  }
}

/* =================== React Component =================== */
export default function PointCloudNearOctreeLOD() {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    const w = container.clientWidth;
    const h = container.clientHeight;

    /* ---------- Scene ---------- */
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);

    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 2000);
    camera.position.set(0, 80, 200);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    /* ---------- Parameters ---------- */
    const POINT_COUNT = 1000_000; // 👈 改成 500_000 试
    const WORLD_SIZE = 400;

    const NEAR_DIST = 80;
    const MID_DIST = 200;

    const MID_STEP = 4;
    const FAR_STEP = 10;

    /* ---------- Data ---------- */
    const positions = new Float32Array(POINT_COUNT * 3);
    const velocities = new Float32Array(POINT_COUNT * 3);

    for (let i = 0; i < POINT_COUNT; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * WORLD_SIZE;
      positions[i3 + 1] = (Math.random() - 0.5) * WORLD_SIZE * 0.3;
      positions[i3 + 2] = (Math.random() - 0.5) * WORLD_SIZE;

      velocities[i3] = (Math.random() - 0.5) * 0.1;
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.05;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.1;
    }

    /* ---------- Instanced Meshes ---------- */
    const geom = new THREE.SphereGeometry(0.5, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const nearMesh = new THREE.InstancedMesh(geom, mat, POINT_COUNT);
    const midMesh = new THREE.InstancedMesh(
      geom,
      mat,
      Math.floor(POINT_COUNT / MID_STEP)
    );
    const farMesh = new THREE.InstancedMesh(
      geom,
      mat,
      Math.floor(POINT_COUNT / FAR_STEP)
    );

    for (const m of [nearMesh, midMesh, farMesh]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(m);
    }

    const tmpMat = new THREE.Matrix4();
    const camPos = new THREE.Vector3();
    const frustum = new THREE.Frustum();
    const projMat = new THREE.Matrix4();

    /* ---------- Animation ---------- */
    function animate() {
      requestAnimationFrame(animate);

      controls.update();
      camera.getWorldPosition(camPos);

      projMat.multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
      );
      frustum.setFromProjectionMatrix(projMat);

      let nearPoints = [];
      let midCount = 0;
      let farCount = 0;

      /* --------- classify points --------- */
      for (let i = 0; i < POINT_COUNT; i++) {
        const i3 = i * 3;

        positions[i3] += velocities[i3];
        positions[i3 + 1] += velocities[i3 + 1];
        positions[i3 + 2] += velocities[i3 + 2];

        const dx = positions[i3] - camPos.x;
        const dy = positions[i3 + 1] - camPos.y;
        const dz = positions[i3 + 2] - camPos.z;
        const d2 = dx * dx + dy * dy + dz * dz;

        if (d2 < NEAR_DIST * NEAR_DIST) {
          nearPoints.push({
            x: positions[i3],
            y: positions[i3 + 1],
            z: positions[i3 + 2],
          });
        } else if (d2 < MID_DIST * MID_DIST && i % MID_STEP === 0) {
          tmpMat.makeTranslation(
            positions[i3],
            positions[i3 + 1],
            positions[i3 + 2]
          );
          midMesh.setMatrixAt(midCount++, tmpMat);
        } else if (i % FAR_STEP === 0) {
          tmpMat.makeTranslation(
            positions[i3],
            positions[i3 + 1],
            positions[i3 + 2]
          );
          farMesh.setMatrixAt(farCount++, tmpMat);
        }
      }

      /* --------- Near: Octree + Frustum --------- */
      const root = new OctreeNode(
        new THREE.Vector3(-WORLD_SIZE, -WORLD_SIZE, -WORLD_SIZE),
        new THREE.Vector3(WORLD_SIZE, WORLD_SIZE, WORLD_SIZE)
      );

      for (const p of nearPoints) root.insert(p);

      const visibleNear = [];
      root.query(frustum, visibleNear);

      let nearCount = 0;
      for (const p of visibleNear) {
        tmpMat.makeTranslation(p.x, p.y, p.z);
        nearMesh.setMatrixAt(nearCount++, tmpMat);
      }

      nearMesh.count = nearCount;
      midMesh.count = midCount;
      farMesh.count = farCount;

      nearMesh.instanceMatrix.needsUpdate = true;
      midMesh.instanceMatrix.needsUpdate = true;
      farMesh.instanceMatrix.needsUpdate = true;

      renderer.render(scene, camera);
    }

    animate();

    return () => {
      renderer.dispose();
      geom.dispose();
      mat.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100vh" }} />;
}
