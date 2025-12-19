/* eslint-env worker */
/* eslint-disable no-restricted-globals */


/* eslint-env worker */
/* eslint-env worker */

const WORLD_SIZE = 600;
const OCTREE_CAPACITY = 512;
const MAX_DEPTH = 8;

let positions;
let velocities;
let POINT_COUNT;

/* ---------- math ---------- */
function aabbIntersectsFrustum(min, max, planes) {
  for (let p = 0; p < 6; p++) {
    const [a, b, c, d] = planes[p];
    const x = a > 0 ? max[0] : min[0];
    const y = b > 0 ? max[1] : min[1];
    const z = c > 0 ? max[2] : min[2];
    if (a * x + b * y + c * z + d < 0) return false;
  }
  return true;
}

/* ---------- Octree ---------- */
class OctreeNode {
  constructor(min, max, depth = 0) {
    this.min = min;
    this.max = max;
    this.depth = depth;
    this.indices = [];
    this.children = null;
  }

  insert(i) {
    if (this.children) return this._insertChild(i);
    this.indices.push(i);
    if (this.indices.length > OCTREE_CAPACITY && this.depth < MAX_DEPTH) {
      this.subdivide();
    }
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
            new OctreeNode(
              [
                xi ? mx : this.min[0],
                yi ? my : this.min[1],
                zi ? mz : this.min[2]
              ],
              [
                xi ? this.max[0] : mx,
                yi ? this.max[1] : my,
                zi ? this.max[2] : mz
              ],
              this.depth + 1
            )
          );
        }

    for (const i of this.indices) this._insertChild(i);
    this.indices.length = 0;
  }

  _insertChild(i) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    for (const c of this.children) {
      if (
        x >= c.min[0] &&
        x <= c.max[0] &&
        y >= c.min[1] &&
        y <= c.max[1] &&
        z >= c.min[2] &&
        z <= c.max[2]
      ) {
        c.insert(i);
        return;
      }
    }
  }

  query(planes, out) {
    if (!aabbIntersectsFrustum(this.min, this.max, planes)) return;

    if (this.children) {
      for (const c of this.children) c.query(planes, out);
    } else {
      for (const i of this.indices) out.push(i);
    }
  }
}

/* ---------- worker loop ---------- */
self.onmessage = (e) => {
  if (e.data.init) {
    positions = e.data.positions;
    velocities = e.data.velocities;
    POINT_COUNT = positions.length / 3;
    return;
  }

  const { frustumPlanes } = e.data;

  for (let i = 0; i < POINT_COUNT; i++) {
    const i3 = i * 3;
    positions[i3] += velocities[i3];
    positions[i3 + 1] += velocities[i3 + 1];
    positions[i3 + 2] += velocities[i3 + 2];
  }

  const root = new OctreeNode(
    [-WORLD_SIZE, -WORLD_SIZE, -WORLD_SIZE],
    [WORLD_SIZE, WORLD_SIZE, WORLD_SIZE]
  );

  for (let i = 0; i < POINT_COUNT; i++) root.insert(i);

  const visible = [];
  root.query(frustumPlanes, visible);

  self.postMessage(
    { visible, positions },
    [positions.buffer]
  );
};
