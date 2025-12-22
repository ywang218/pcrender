// /* eslint-disable no-restricted-globals */
// import * as THREE from "three";

// // 这里我们不需要完整的 Octree 结构在 Worker 里每帧重建（非常耗时）
// // 更好的做法是只在 Worker 里做并行计算筛选
// let positions, velocities, POINT_COUNT, WORLD_SIZE;
// let NEAR_DIST_SQ, MID_DIST_SQ, MID_STEP, FAR_STEP;

// self.onmessage = (e) => {
//   const { type, payload } = e.data;

//   if (type === "init") {
//     ({ POINT_COUNT, WORLD_SIZE, NEAR_DIST_SQ, MID_DIST_SQ, MID_STEP, FAR_STEP } = payload);
//     positions = payload.positions;
//     velocities = payload.velocities;
//   }

//   if (type === "update") {
//     const { camPos, projectionMatrixInverse } = payload;
    
//     // 用于视锥体剔除的简易模拟或解析
//     const frustum = new THREE.Frustum();
//     const projScreenMatrix = new THREE.Matrix4().fromArray(payload.projScreenMatrix);
//     frustum.setFromProjectionMatrix(projScreenMatrix);

//     const nearResult = [];
//     const midResult = [];
//     const farResult = [];

//     for (let i = 0; i < POINT_COUNT; i++) {
//       const i3 = i * 3;

//       // 1. 更新位置
//       positions[i3] += velocities[i3];
//       positions[i3 + 1] += velocities[i3 + 1];
//       positions[i3 + 2] += velocities[i3 + 2];

//       // 边界检查 (简单反弹)
//       if (Math.abs(positions[i3]) > WORLD_SIZE / 2) velocities[i3] *= -1;

//       // 2. 距离判断
//       const dx = positions[i3] - camPos.x;
//       const dy = positions[i3 + 1] - camPos.y;
//       const dz = positions[i3 + 2] - camPos.z;
//       const d2 = dx * dx + dy * dy + dz * dz;

//       const p = [positions[i3], positions[i3 + 1], positions[i3 + 2]];

//       // 3. LOD 与 视锥剔除
//       if (d2 < NEAR_DIST_SQ) {
//         // 近处点：进行视锥剔除以减压
//         if (frustum.containsPoint(new THREE.Vector3().fromArray(p))) {
//           nearResult.push(...p);
//         }
//       } else if (d2 < MID_DIST_SQ) {
//         if (i % MID_STEP === 0) midResult.push(...p);
//       } else {
//         if (i % FAR_STEP === 0) farResult.push(...p);
//       }
//     }

//     // 将结果传回主线程
//     const nearArray = new Float32Array(nearResult);
//     const midArray = new Float32Array(midResult);
//     const farArray = new Float32Array(farResult);

//     self.postMessage({
//       type: "render",
//       payload: { nearArray, midArray, farArray }
//     }, [nearArray.buffer, midArray.buffer, farArray.buffer]); // 使用 Transferable 提升性能
//   }
// };