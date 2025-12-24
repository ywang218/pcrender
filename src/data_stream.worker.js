/* eslint-env worker */
/* eslint-disable no-restricted-globals */

// 预分配一个缓冲区，避免频繁创建对象
let pointBuffer;

self.onmessage = (e) => {
    const { type, count } = e.data;

    if (type === 'init') {
        // 每个点 4 个分量 (x, y, z, a)
        pointBuffer = new Float32Array(count * 4);
        startStreaming(count);
    }
};

function startStreaming(count) {
    // 模拟每 50ms (20Hz) 接收一帧后端数据
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

        // 【关键】创建副本并转移所有权
        // 为了能在下一次循环继续使用 pointBuffer，我们传出一个 Copy
        const transferBuffer = new Float32Array(pointBuffer);
        
        self.postMessage({
            type: 'update',
            buffer: transferBuffer
        }, [transferBuffer.buffer]); // 第二个参数将 buffer 权限转让，主线程接收后 Worker 端的该 buffer 长度将变为 0
    }, 50);
}