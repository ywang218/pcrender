/* eslint-env worker */
/* eslint-disable no-restricted-globals */

/* data_stream.worker.js */



// 预分配一个缓冲区，避免频繁创建对象
let pointBuffer;
let count
self.onmessage = (e) => {
    // const { type, count, sab } = e.data;
    // console.log("sab is: ", sab)
    if (e.data.type === 'init') {
        // 每个点 4 个分量 (x, y, z, a)
        count = e.data.count
        pointBuffer = new Float32Array(e.data.sab);
        // startStreaming(e.data.count);
    }
    if(e.data.type == "frame") {
        const incoming = new Float32Array(e.data.buffer);

    // console.log("count is: ", count,"incoming is: ", incoming, incoming.buffer.byteLength, incoming.length)
    // 模拟 decode 后 → 写 SAB
    for (let i = 0; i < incoming.length / 4; i++) {
      const b = i * 4;
      pointBuffer[b + 0] += incoming[(b + 0)];
      pointBuffer[b + 1] += incoming[(b + 1)];
      pointBuffer[b + 2] += incoming[(b + 2)];
      pointBuffer[b + 3] = 1.0;
    }
    }

};

function startStreaming(count) {
    // 模拟每 100ms (10Hz) 接收一帧后端数据
    setInterval(() => {
        // 假设这里是接收到的原始二进制数据解析过程
        for (let i = 0; i < count; i++) {
            const i4 = i * 4;
            // 模拟动态数据：你可以这里替换为真实的二进制解析逻辑
            // 例如：buffer[i4] = dataView.getFloat32(i * 12); 
            pointBuffer[i4] += (Math.random() - 0.5) * 20;     // X
            pointBuffer[i4 + 1] += (Math.random() - 0.5) * 10; // Y
            pointBuffer[i4 + 2] += (Math.random() - 0.5) * 20; // Z
            pointBuffer[i4 + 3] = 1.0;                          // W (Intensity/Alpha)
        }

        // // 【关键】创建副本并转移所有权
        // // 为了能在下一次循环继续使用 pointBuffer，我们传出一个 Copy
        // const transferBuffer = new Float32Array(pointBuffer);
        
        // self.postMessage({
        //     type: 'update',
        //     buffer: transferBuffer
        // }, [transferBuffer.buffer]); // 第二个参数将 buffer 权限转让，主线程接收后 Worker 端的该 buffer 长度将变为 0
    }, 100);
}