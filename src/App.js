// import React, { useEffect, useRef } from "react";
// import * as THREE from "three";
// import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

// /* =================== Simple Octree =================== */
// class OctreeNode {
//   constructor(min, max, depth = 0) {
//     this.min = min;
//     this.max = max;
//     this.depth = depth;
//     this.points = [];
//     this.children = null;
//   }

//   insert(p) {
//     if (this.children) {
//       return this._insertChild(p);
//     }

//     this.points.push(p);

//     if (this.points.length > 64 && this.depth < 6) {
//       this.subdivide();
//     }
//   }

//   subdivide() {
//     this.children = [];
//     const { min, max } = this;
//     const mx = (min.x + max.x) * 0.5;
//     const my = (min.y + max.y) * 0.5;
//     const mz = (min.z + max.z) * 0.5;

//     for (let xi = 0; xi < 2; xi++) {
//       for (let yi = 0; yi < 2; yi++) {
//         for (let zi = 0; zi < 2; zi++) {
//           this.children.push(
//             new OctreeNode(
//               new THREE.Vector3(
//                 xi ? mx : min.x,
//                 yi ? my : min.y,
//                 zi ? mz : min.z
//               ),
//               new THREE.Vector3(
//                 xi ? max.x : mx,
//                 yi ? max.y : my,
//                 zi ? max.z : mz
//               ),
//               this.depth + 1
//             )
//           );
//         }
//       }
//     }

//     for (const p of this.points) this._insertChild(p);
//     this.points.length = 0;
//   }

//   _insertChild(p) {
//     for (const c of this.children) {
//       if (
//         p.x >= c.min.x &&
//         p.x <= c.max.x &&
//         p.y >= c.min.y &&
//         p.y <= c.max.y &&
//         p.z >= c.min.z &&
//         p.z <= c.max.z
//       ) {
//         c.insert(p);
//         return;
//       }
//     }
//   }

//   query(frustum, out) {
//     const box = new THREE.Box3(this.min, this.max);
//     if (!frustum.intersectsBox(box)) return;

//     if (this.children) {
//       for (const c of this.children) c.query(frustum, out);
//     } else {
//       for (const p of this.points) out.push(p);
//     }
//   }
// }

// /* =================== React Component =================== */
// export default function PointCloudNearOctreeLOD() {
//   const mountRef = useRef(null);

//   useEffect(() => {
//     const container = mountRef.current;
//     const w = container.clientWidth;
//     const h = container.clientHeight;

//     /* ---------- Scene ---------- */
//     const renderer = new THREE.WebGLRenderer({ antialias: true });
//     renderer.setSize(w, h);
//     container.appendChild(renderer.domElement);

//     const scene = new THREE.Scene();
//     scene.background = new THREE.Color(0x0a0a0a);

//     const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 2000);
//     camera.position.set(0, 80, 200);

//     const controls = new OrbitControls(camera, renderer.domElement);
//     controls.enableDamping = true;

//     /* ---------- Parameters ---------- */
//     const POINT_COUNT = 1000_000; // 👈 改成 500_000 试
//     const WORLD_SIZE = 400;

//     const NEAR_DIST = 80;
//     const MID_DIST = 200;

//     const MID_STEP = 4;
//     const FAR_STEP = 10;

//     /* ---------- Data ---------- */
//     const positions = new Float32Array(POINT_COUNT * 3);
//     const velocities = new Float32Array(POINT_COUNT * 3);

//     for (let i = 0; i < POINT_COUNT; i++) {
//       const i3 = i * 3;
//       positions[i3] = (Math.random() - 0.5) * WORLD_SIZE;
//       positions[i3 + 1] = (Math.random() - 0.5) * WORLD_SIZE * 0.3;
//       positions[i3 + 2] = (Math.random() - 0.5) * WORLD_SIZE;

//       velocities[i3] = (Math.random() - 0.5) * 0.1;
//       velocities[i3 + 1] = (Math.random() - 0.5) * 0.05;
//       velocities[i3 + 2] = (Math.random() - 0.5) * 0.1;
//     }

//     /* ---------- Instanced Meshes ---------- */
//     const geom = new THREE.SphereGeometry(0.5, 6, 6);
//     const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });

//     const nearMesh = new THREE.InstancedMesh(geom, mat, POINT_COUNT);
//     const midMesh = new THREE.InstancedMesh(
//       geom,
//       mat,
//       Math.floor(POINT_COUNT / MID_STEP)
//     );
//     const farMesh = new THREE.InstancedMesh(
//       geom,
//       mat,
//       Math.floor(POINT_COUNT / FAR_STEP)
//     );

//     for (const m of [nearMesh, midMesh, farMesh]) {
//       m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
//       scene.add(m);
//     }

//     const tmpMat = new THREE.Matrix4();
//     const camPos = new THREE.Vector3();
//     const frustum = new THREE.Frustum();
//     const projMat = new THREE.Matrix4();

//     /* ---------- Animation ---------- */
//     function animate() {
//       requestAnimationFrame(animate);

//       controls.update();
//       camera.getWorldPosition(camPos);

//       projMat.multiplyMatrices(
//         camera.projectionMatrix,
//         camera.matrixWorldInverse
//       );
//       frustum.setFromProjectionMatrix(projMat);

//       let nearPoints = [];
//       let midCount = 0;
//       let farCount = 0;

//       /* --------- classify points --------- */
//       for (let i = 0; i < POINT_COUNT; i++) {
//         const i3 = i * 3;

//         positions[i3] += velocities[i3];
//         positions[i3 + 1] += velocities[i3 + 1];
//         positions[i3 + 2] += velocities[i3 + 2];

//         const dx = positions[i3] - camPos.x;
//         const dy = positions[i3 + 1] - camPos.y;
//         const dz = positions[i3 + 2] - camPos.z;
//         const d2 = dx * dx + dy * dy + dz * dz;

//         if (d2 < NEAR_DIST * NEAR_DIST) {
//           nearPoints.push({
//             x: positions[i3],
//             y: positions[i3 + 1],
//             z: positions[i3 + 2],
//           });
//         } else if (d2 < MID_DIST * MID_DIST && i % MID_STEP === 0) {
//           tmpMat.makeTranslation(
//             positions[i3],
//             positions[i3 + 1],
//             positions[i3 + 2]
//           );
//           midMesh.setMatrixAt(midCount++, tmpMat);
//         } else if (i % FAR_STEP === 0) {
//           tmpMat.makeTranslation(
//             positions[i3],
//             positions[i3 + 1],
//             positions[i3 + 2]
//           );
//           farMesh.setMatrixAt(farCount++, tmpMat);
//         }
//       }

//       /* --------- Near: Octree + Frustum --------- */
//       const root = new OctreeNode(
//         new THREE.Vector3(-WORLD_SIZE, -WORLD_SIZE, -WORLD_SIZE),
//         new THREE.Vector3(WORLD_SIZE, WORLD_SIZE, WORLD_SIZE)
//       );

//       for (const p of nearPoints) root.insert(p);

//       const visibleNear = [];
//       root.query(frustum, visibleNear);

//       let nearCount = 0;
//       for (const p of visibleNear) {
//         tmpMat.makeTranslation(p.x, p.y, p.z);
//         nearMesh.setMatrixAt(nearCount++, tmpMat);
//       }

//       nearMesh.count = nearCount;
//       midMesh.count = midCount;
//       farMesh.count = farCount;

//       nearMesh.instanceMatrix.needsUpdate = true;
//       midMesh.instanceMatrix.needsUpdate = true;
//       farMesh.instanceMatrix.needsUpdate = true;

//       renderer.render(scene, camera);
//     }

//     animate();

//     return () => {
//       renderer.dispose();
//       geom.dispose();
//       mat.dispose();
//       container.removeChild(renderer.domElement);
//     };
//   }, []);

//   return <div ref={mountRef} style={{ width: "100%", height: "100vh" }} />;
// }


// import React, { useEffect, useRef } from "react";
// import * as THREE from "three";
// import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer";

// /**
//  * 针对 1000 万个点的策略：
//  * 1. 使用 GPUComputationRenderer 更新位置（完全不经过 CPU）
//  * 2. 使用 Shader 里的丢弃逻辑（Discard）
//  * 3. 如果必须用 InstancedMesh（渲染球体而非点），使用极低面数的几何体
//  */

// export default function HighPerformancePointCloud() {
//   const mountRef = useRef(null);

//   useEffect(() => {
//     const container = mountRef.current;
//     const width = container.clientWidth;
//     const height = container.clientHeight;

//     const scene = new THREE.Scene();
//     const camera = new THREE.PerspectiveCamera(60, width / height, 1, 5000);
//     camera.position.z = 1000;

//     const renderer = new THREE.WebGLRenderer({ antialias: false });
//     renderer.setSize(width, height);
//     // 必须开启 WebGL 2
//     container.appendChild(renderer.domElement);

//     // 1. 设置 GPGPU (处理 1024x1024 级别的计算块，可叠加多个块达到千万级)
//     // 为演示方便，这里展示 400 万个点的处理（2048x2048）
//     const COMPUTE_SIZE = 2048; 
//     const gpuCompute = new GPUComputationRenderer(COMPUTE_SIZE, COMPUTE_SIZE, renderer);

//     // 初始位置纹理
//     const dtPosition = gpuCompute.createTexture();
//     const posData = dtPosition.image.data;
//     for (let i = 0; i < posData.length; i += 4) {
//       posData[i] = (Math.random() - 0.5) * 1000;
//       posData[i + 1] = (Math.random() - 0.5) * 1000;
//       posData[i + 2] = (Math.random() - 0.5) * 1000;
//       posData[i + 3] = 1.0;
//     }

//     // 计算位置的 Shader (模拟后端或物理更新)
//     const positionVariable = gpuCompute.addVariable("texturePosition", `
//       void main() {
//         vec2 uv = gl_FragCoord.xy / resolution.xy;
//         vec4 pos = texture2D(texturePosition, uv);
//         // 在这里进行无规律位移计算，完全在 GPU 内部完成
//         pos.xyz += (fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.5;
//         gl_FragColor = pos;
//       }
//     `, dtPosition);

//     gpuCompute.init();

//     // 2. 渲染部分：使用 InstancedMesh 渲染 1000 万个点的代理
//     // 注意：1000 万个 InstancedMesh 的矩阵更新在 CPU 依然会卡死
//     // 技巧：在顶点着色器中通过 gl_InstanceID 直接读取 GPGPU 的纹理
//     const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5); // 极简几何体
//     const material = new THREE.ShaderMaterial({
//       uniforms: {
//         uPosTexture: { value: null },
//         uCameraPos: { value: camera.position }
//       },
//       vertexShader: `
//         uniform sampler2D uPosTexture;
//         uniform vec3 uCameraPos;
        
//         void main() {
//           // 根据实例 ID 计算纹理坐标
//           float size = ${COMPUTE_SIZE}.0;
//           vec2 uv = vec2(
//             mod(float(gl_InstanceID), size) / size,
//             floor(float(gl_InstanceID) / size) / size
//           );
          
//           vec4 worldPos = texture2D(uPosTexture, uv);
          
//           // GPU 端的 LOD/剔除逻辑
//           float dist = distance(worldPos.xyz, uCameraPos);
//           float scale = 1.0;
          
//           // 距离越远，不仅是变小，而是直接把顶点坐标压缩到一点，触发 GPU 快速剔除
//           if (dist > 500.0 && mod(float(gl_InstanceID), 10.0) > 0.5) scale = 0.0;
//           if (dist > 1000.0 && mod(float(gl_InstanceID), 100.0) > 0.5) scale = 0.0;

//           vec3 transformed = position * scale + worldPos.xyz;
//           gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
//         }
//       `,
//       fragmentShader: `
//         void main() {
//           gl_FragColor = vec4(0.0, 1.0, 1.0, 1.0);
//         }
//       `
//     });

//     const mesh = new THREE.InstancedMesh(geometry, material, COMPUTE_SIZE * COMPUTE_SIZE);
//     scene.add(mesh);

//     function animate() {
//       requestAnimationFrame(animate);

//       // 1. 执行 GPU 计算 (千万级位置更新)
//       gpuCompute.compute();
      
//       // 2. 将计算结果传给渲染材质
//       material.uniforms.uPosTexture.value = gpuCompute.getCurrentRenderTarget(positionVariable).texture;
//       material.uniforms.uCameraPos.value.copy(camera.position);

//       renderer.render(scene, camera);
//     }

//     animate();

//     return () => {
//       renderer.dispose();
//       gpuCompute.dispose();
//     };
//   }, []);

//   return <div ref={mountRef} style={{ width: "100%", height: "100vh" }} />;
// }

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
// 必须引入 OrbitControls
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Stats from "stats.js";

export default function FastPointTextureRender() {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;

    const stats = new Stats();
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    // 设置样式使其位于左上角
    stats.dom.style.position = 'absolute';
    stats.dom.style.top = '0px';
    stats.dom.style.left = '0px';
    container.appendChild(stats.dom);

    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // 自动驾驶场景通常范围较大，建议 far 设大一点 (如 10000)
    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 10000);
    camera.position.set(0, 500, 800);

    // --- 关键：添加控制器 ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // 增加平滑感
    controls.zoomSpeed = 1.2;

    const size = 3400;
    const POINT_COUNT = size * size;

    const data = new Float32Array(POINT_COUNT * 4);
    // 填充初始数据，防止黑屏
    for(let i=0; i<data.length; i++) data[i] = (Math.random()-0.5) * 500;
    
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
    texture.needsUpdate = true;

    const geometry = new THREE.BufferGeometry();
    const indices = new Float32Array(POINT_COUNT * 2);
    for (let i = 0; i < POINT_COUNT; i++) {
      indices[i * 2] = (i % size) / size;
      indices[i * 2 + 1] = Math.floor(i / size) / size;
    }
    geometry.setAttribute('reference', new THREE.BufferAttribute(indices, 2));
    geometry.setDrawRange(0, POINT_COUNT);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: texture },
        uPointSize: { value: 2.0 }, // 基础点大小
        uScale: { value: 1.0 }      // 预留全局缩放倍率
      },
      vertexShader: `
        attribute vec2 reference;
        uniform sampler2D uTexture;
        uniform float uPointSize;
        uniform float uScale;

        void main() {
          vec4 pos = texture2D(uTexture, reference);
          
          // 计算视图空间位置
          vec4 mvPosition = modelViewMatrix * vec4(pos.xyz * uScale, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          
          /** * 优化后的点大小计算公式：
           * 1. 使用基础大小 uPointSize
           * 2. 根据距离 -mvPosition.z 衰减
           * 3. 乘以 300.0 是为了在视野距离 300 时保持原始大小
           */
          gl_PointSize = uPointSize * (300.0 / -mvPosition.z);
          
          // 限制点的最大和最小像素尺寸，防止离太近时点变得巨大
          gl_PointSize = clamp(gl_PointSize, 1.0, 50.0);
        }
      `,
      fragmentShader: `
        void main() {
          float dist = distance(gl_PointCoord, vec2(0.5));
          if (dist > 0.5) discard;
          gl_FragColor = vec4(0.0, 1.0, 0.9, 1.0);
        }
      `
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const worker = new Worker(new URL('./data_stream.worker.js', import.meta.url));
        
    worker.postMessage({ type: 'init', POINT_COUNT });

    worker.onmessage = (e) => {
        if (e.data.type === 'update') {
            // 直接替换 Texture 的数据引用，这是最快的更新方式
            texture.image.data = e.data.buffer;
            texture.needsUpdate = true;
        }
    };  
    
    // // 模拟数据更新
    // const updateBackendData = () => {
    //   // 仅演示波动效果
    //   for (let i = 0; i < 10000; i++) { // 局部更新以保证性能演示
    //     const idx = Math.floor(Math.random() * POINT_COUNT) * 4;
    //     data[idx] += (Math.random() - 0.5) * 0.5;
    //   }
    //   texture.needsUpdate = true;
    // };

    function animate() {
      requestAnimationFrame(animate);
      
      // 更新控制器（必须）
      controls.update();
      
      // updateBackendData(); 
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      controls.dispose();
      renderer.dispose();
      texture.dispose();
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100vh" }} />;
}

// import React, { useEffect, useRef } from "react";
// import * as THREE from "three";
// import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

// export default function DynamicGpuPointCloud() {
//   const mountRef = useRef(null);

//   useEffect(() => {
//     const container = mountRef.current;
//     const scene = new THREE.Scene();
//     const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 1, 2000);
//     camera.position.z = 500;

//     const renderer = new THREE.WebGLRenderer({ antialias: false });
//     renderer.setSize(container.clientWidth, container.clientHeight);
//     container.appendChild(renderer.domElement);

//     const controls = new OrbitControls(camera, renderer.domElement);

//     // 1. 点云参数 (1024 * 1024 = 1,048,576 个点)
//     const size = 1.5*1024;
//     const POINT_COUNT = size * size;

//     // 2. 创建 DataTexture 用于存储位置
//     // RGBA 格式：R=x, G=y, B=z, A=unused
//     const data = new Float32Array(POINT_COUNT * 4);
//     const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);

//     // 3. 创建几何体 (使用 BufferGeometry 配合 gl_VertexID)
//     const geometry = new THREE.BufferGeometry();
//     const positions = new Float32Array(POINT_COUNT * 3); // 这里的坐标只作为索引占位
//     for (let i = 0; i < POINT_COUNT; i++) {
//         // 我们利用顶点的索引来查找纹理，所以 position 本身不重要，给个 0 即可
//         positions[i * 3] = (i % size) / size; // u 坐标
//         positions[i * 3 + 1] = Math.floor(i / size) / size; // v 坐标
//     }
//     geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

//     // 4. 自定义 ShaderMaterial
//     const material = new THREE.ShaderMaterial({
//       uniforms: {
//         uTexture: { value: texture },
//         uTime: { value: 0 },
//         uCameraPos: { value: new THREE.Vector3() },
//         uNearLOD: { value: 150.0 },
//         uFarLOD: { value: 400.0 }
//       },
//       vertexShader: `
//         uniform sampler2D uTexture;
//         uniform vec3 uCameraPos;
//         uniform float uNearLOD;
//         uniform float uFarLOD;
        
//         void main() {
//           // 1. 从纹理中根据当前顶点的 UV 坐标读取位置
//           // position 存储的是我们预设的 UV 占位符
//           vec4 texData = texture2D(uTexture, position.xy);
//           vec3 dynamicPos = texData.xyz;

//           // 2. 计算距离用于 LOD
//           float dist = distance(dynamicPos, uCameraPos);
          
//           // 3. LOD 抽稀逻辑
//           float size = 1.5;
//           int id = gl_VertexID;
          
//           // 如果距离大于中等距离，每 4 个点显示 1 个
//           if (dist > uNearLOD && mod(float(id), 4.0) > 0.1) {
//             size = 0.0;
//           }
//           // 如果距离非常远，每 16 个点显示 1 个
//           if (dist > uFarLOD && mod(float(id), 16.0) > 0.1) {
//             size = 0.0;
//           }

//           gl_PointSize = size;
//           gl_Position = projectionMatrix * modelViewMatrix * vec4(dynamicPos, 1.0);
//         }
//       `,
//       fragmentShader: `
//         void main() {
//           gl_FragColor = vec4(0.0, 1.0, 0.8, 1.0);
//         }
//       `
//     });

//     const points = new THREE.Points(geometry, material);
//     scene.add(points);

//     // 5. 模拟后端数据更新
//     // 实际项目中，这里应该是你的 WebSocket 或 Worker 的回调
//     const updateBackendData = () => {
//       for (let i = 0; i < POINT_COUNT; i++) {
//         const i4 = i * 4;
//         // 模拟无规律动态更新
//         data[i4] += (Math.random() - 0.5) * 2.0;     // x
//         data[i4 + 1] += (Math.random() - 0.5) * 2.0; // y
//         data[i4 + 2] += (Math.random() - 0.5) * 2.0; // z
//       }
//       // 关键：通知 GPU 更新纹理
//       texture.needsUpdate = true;
//     };

//     function animate() {
//       requestAnimationFrame(animate);
      
//       updateBackendData(); // 模拟数据流入
      
//       material.uniforms.uCameraPos.value.copy(camera.position);
//       renderer.render(scene, camera);
//     }

//     animate();

//     return () => {
//       renderer.dispose();
//       geometry.dispose();
//       material.dispose();
//       texture.dispose();
//     };
//   }, []);

//   return <div ref={mountRef} style={{ width: "100%", height: "100vh" }} />;
// }