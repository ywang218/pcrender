import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

export default function PointCloudLOD() {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    /* ---------------- Renderer / Scene / Camera ---------------- */
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
    camera.position.set(0, 80, 200);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    /* ---------------- Parameters ---------------- */
    const POINT_COUNT = 500_000; // 👈 改成 500_000 也可以试
    const WORLD_SIZE = 400;

    const NEAR_DIST = 80;
    const MID_DIST = 200;

    const MID_STEP = 4;
    const FAR_STEP = 10;

    /* ---------------- Generate Data ---------------- */
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

    /* ---------------- Shared Geometry & Material ---------------- */
    const baseGeometry = new THREE.SphereGeometry(0.5, 6, 6);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });

    function createInstancedMesh(maxCount) {
      const mesh = new THREE.InstancedMesh(baseGeometry, material, maxCount);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
      return mesh;
    }

    const nearMesh = createInstancedMesh(POINT_COUNT);
    const midMesh = createInstancedMesh(Math.floor(POINT_COUNT / MID_STEP));
    const farMesh = createInstancedMesh(Math.floor(POINT_COUNT / FAR_STEP));

    const tmpMat = new THREE.Matrix4();
    const camPos = new THREE.Vector3();

    /* ---------------- Animation ---------------- */
    function animate() {
      requestAnimationFrame(animate);

      controls.update();
      camera.getWorldPosition(camPos);

      let nearCount = 0;
      let midCount = 0;
      let farCount = 0;

      for (let i = 0; i < POINT_COUNT; i++) {
        const i3 = i * 3;

        // move points
        positions[i3] += velocities[i3];
        positions[i3 + 1] += velocities[i3 + 1];
        positions[i3 + 2] += velocities[i3 + 2];

        const dx = positions[i3] - camPos.x;
        const dy = positions[i3 + 1] - camPos.y;
        const dz = positions[i3 + 2] - camPos.z;
        const dist2 = dx * dx + dy * dy + dz * dz;

        if (dist2 < NEAR_DIST * NEAR_DIST) {
          tmpMat.makeTranslation(
            positions[i3],
            positions[i3 + 1],
            positions[i3 + 2]
          );
          nearMesh.setMatrixAt(nearCount++, tmpMat);
        } else if (
          dist2 < MID_DIST * MID_DIST &&
          i % MID_STEP === 0
        ) {
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
      baseGeometry.dispose();
      material.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100vh" }} />;
}
