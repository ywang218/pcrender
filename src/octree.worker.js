/* eslint-env worker */
/* eslint-disable no-restricted-globals */


/* eslint-env worker */
/* eslint-env worker */

class Octree {
    constructor(min, max, depth = 0) {
      this.min = min;
      this.max = max;
      this.depth = depth;
      this.points = [];
      this.children = null;
    }
  
    insert(p) {
      if (this.children) return this._insertChild(p);
      this.points.push(p);
      if (this.points.length > 32 && this.depth < 6) this.subdivide();
    }
  
    subdivide() {
      this.children = [];
      const mx = (this.min[0] + this.max[0]) * 0.5;
      const my = (this.min[1] + this.max[1]) * 0.5;
      const mz = (this.min[2] + this.max[2]) * 0.5;
  
      for (let xi = 0; xi < 2; xi++)
        for (let yi = 0; yi < 2; yi++)
          for (let zi = 0; zi < 2; zi++) {
            this.children.push(
              new Octree(
                [
                  xi ? mx : this.min[0],
                  yi ? my : this.min[1],
                  zi ? mz : this.min[2],
                ],
                [
                  xi ? this.max[0] : mx,
                  yi ? this.max[1] : my,
                  zi ? this.max[2] : mz,
                ],
                this.depth + 1
              )
            );
          }
  
      for (const p of this.points) this._insertChild(p);
      this.points.length = 0;
    }
  
    _insertChild(p) {
      for (const c of this.children) {
        if (
          p[0] >= c.min[0] &&
          p[0] <= c.max[0] &&
          p[1] >= c.min[1] &&
          p[1] <= c.max[1] &&
          p[2] >= c.min[2] &&
          p[2] <= c.max[2]
        ) {
          c.insert(p);
          return;
        }
      }
    }
  
    collect(out) {
      if (this.children) {
        for (const c of this.children) c.collect(out);
      } else if (this.points.length) {
        // voxel representative
        out.push(this.points[0]);
      }
    }
  }
  
  self.onmessage = (e) => {
    const { buffer, count } = e.data;
    const input = new Float32Array(buffer);
  
    const root = new Octree([-100, -100, -100], [100, 100, 100]);
  
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      root.insert([input[i3], input[i3 + 1], input[i3 + 2]]);
    }
  
    const reduced = [];
    root.collect(reduced);
  
    const out = new Float32Array(reduced.length * 3);
    for (let i = 0; i < reduced.length; i++) {
      out.set(reduced[i], i * 3);
    }
  
    self.postMessage({ buffer: out.buffer }, [out.buffer]);
  };
  