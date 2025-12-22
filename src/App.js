

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
// 必须引入 OrbitControls
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import Stats from "stats.js";

export default function FastPointTextureRender() {
  const mountRef = useRef(null);
  const initedRef = useRef(false);

  useEffect(() => {
    // if (initedRef.current) return;
    // initedRef.current = true;
    console.log('init three');
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

    const size = 1700;             // 2500000->50FPS, 10000000->20FPS         
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
      stats.update();
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
