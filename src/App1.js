import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

export default function PointCloudWorkerLOD() {
  const mountRef = useRef(null);
  const workerRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: false }); // 减少性能开销
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 2000);
    camera.position.set(0, 100, 300);

    const controls = new OrbitControls(camera, renderer.domElement);
    
    // 参数准备
    const POINT_COUNT = 1000_000;
    const WORLD_SIZE = 500;
    
    const positions = new Float32Array(POINT_COUNT * 3);
    const velocities = new Float32Array(POINT_COUNT * 3);
    for (let i = 0; i < POINT_COUNT * 3; i++) {
      positions[i] = (Math.random() - 0.5) * WORLD_SIZE;
      velocities[i] = (Math.random() - 0.5) * 0.1;
    }

    // 初始化 InstancedMesh
    const geom = new THREE.BoxGeometry(0.5, 0.5, 0.5); // Box 比 Sphere 渲染更快
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
    const nearMesh = new THREE.InstancedMesh(geom, mat, POINT_COUNT);
    const midMesh = new THREE.InstancedMesh(geom, mat, POINT_COUNT);
    const farMesh = new THREE.InstancedMesh(geom, mat, POINT_COUNT);
    scene.add(nearMesh, midMesh, farMesh);

    // 初始化 Worker
    const worker = new Worker(new URL("./pointcloud.worker.js", import.meta.url));
    workerRef.current = worker;

    worker.postMessage({
      type: "init",
      payload: {
        POINT_COUNT, WORLD_SIZE,
        positions, velocities,
        NEAR_DIST_SQ: 100 * 100,
        MID_DIST_SQ: 300 * 300,
        MID_STEP: 5,
        FAR_STEP: 20
      }
    });

    const tmpMat = new THREE.Matrix4();
    const projScreenMatrix = new THREE.Matrix4();

    worker.onmessage = (e) => {
      if (e.data.type === "render") {
        const { nearArray, midArray, farArray } = e.data.payload;

        const updateMesh = (mesh, data) => {
          let count = data.length / 3;
          for (let i = 0; i < count; i++) {
            tmpMat.makeTranslation(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
            mesh.setMatrixAt(i, tmpMat);
          }
          mesh.count = count;
          mesh.instanceMatrix.needsUpdate = true;
        };

        updateMesh(nearMesh, nearArray);
        updateMesh(midMesh, midArray);
        updateMesh(farMesh, farArray);
      }
    };

    function animate() {
      requestAnimationFrame(animate);
      controls.update();

      // 发送相机数据触发 Worker 计算
      projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      
      worker.postMessage({
        type: "update",
        payload: {
          camPos: camera.position.toArray(),
          projScreenMatrix: projScreenMatrix.toArray()
        }
      });

      renderer.render(scene, camera);
    }

    animate();

    return () => {
      worker.terminate();
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100vh" }} />;
}