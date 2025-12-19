import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

export default function App() {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    const w = container.clientWidth;
    const h = container.clientHeight;

    /* ---------- basic ---------- */
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);

    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 2000);
    camera.position.set(0, 80, 200);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    /* ---------- params ---------- */
    const POINT_COUNT = 1000_000; // 先别 500k
    const WORLD = 400;

    const NEAR_DIST = 80;
    const MID_DIST = 200;
    const MID_STEP = 4;
    const FAR_STEP = 10;

    /* ---------- data ---------- */
    const positions = new Float32Array(POINT_COUNT * 3);
    const velocities = new Float32Array(POINT_COUNT * 3);

    for (let i = 0; i < POINT_COUNT; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * WORLD;
      positions[i3 + 1] = (Math.random() - 0.5) * WORLD * 0.3;
      positions[i3 + 2] = (Math.random() - 0.5) * WORLD;

      velocities[i3] = (Math.random() - 0.5) * 0.1;
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.05;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.1;
    }

    /* ---------- meshes ---------- */
    const geom = new THREE.SphereGeometry(0.5, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const nearMesh = new THREE.InstancedMesh(geom, mat, POINT_COUNT);
    const midMesh = new THREE.InstancedMesh(geom, mat, POINT_COUNT / MID_STEP);
    const farMesh = new THREE.InstancedMesh(geom, mat, POINT_COUNT / FAR_STEP);

    [nearMesh, midMesh, farMesh].forEach((m) => {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(m);
    });

    const tmpMat = new THREE.Matrix4();
    const camPos = new THREE.Vector3();

    /* ---------- worker ---------- */
    const worker = new Worker(new URL("./octree.worker.js", import.meta.url));

    let reducedNear = new Float32Array(0);

    worker.onmessage = (e) => {
      reducedNear = new Float32Array(e.data.buffer);
    };

    /* ---------- animate ---------- */
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      camera.getWorldPosition(camPos);

      let nearWrite = 0;
      let midCount = 0;
      let farCount = 0;

      const nearTemp = new Float32Array(POINT_COUNT * 3);

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
          nearTemp[nearWrite++] = positions[i3];
          nearTemp[nearWrite++] = positions[i3 + 1];
          nearTemp[nearWrite++] = positions[i3 + 2];
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

      /* send near to worker (Transferable) */
      worker.postMessage(
        { buffer: nearTemp.buffer, count: nearWrite / 3 },
        [nearTemp.buffer]
      );

      /* draw reduced near */
      let nearCount = 0;
      for (let i = 0; i < reducedNear.length; i += 3) {
        tmpMat.makeTranslation(
          reducedNear[i],
          reducedNear[i + 1],
          reducedNear[i + 2]
        );
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

    return () => worker.terminate();
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100vh" }} />;
}
