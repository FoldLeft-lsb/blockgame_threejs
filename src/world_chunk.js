import * as THREE from "three";
import { SimplexNoise } from "three/examples/jsm/math/SimplexNoise.js";
import { Custom_Random } from "./custom_random.js";

import { blocks, resources } from "./blocks.js";
import { DataStore } from "./data_store.js";

const instance_box_geometry = new THREE.BoxGeometry();

const axis_geometry = new THREE.BoxGeometry();
const axis_material = new THREE.MeshLambertMaterial({ color: 0x559020 });

export class WorldChunk extends THREE.Group {
  /**
  * @type {{
  * id: number,
  * instanceId: number 
  * }[]}
  */
  data_array = []; // 1d array
  /**
   * @param {*} size 
   * @param {*} params 
   * @param {DataStore} dataStore 
   */
  constructor(size, params, dataStore) {
    super();
    this.loaded = false;
    this.size = size;
    this.data_array_len = size.width * size.width * size.height;
    this.params = params;
    this.dataStore = dataStore;
  }
  generate() {
    const rng = new Custom_Random(this.params.seed);
    this.initializeTerrain();
    this.generateResources(rng);
    this.generateTerrain(rng);
    this.generateTrees();
    this.generateClouds(rng);
    this.loadPlayerChanges();
    this.generateMeshes();

    this.loaded = true;
  }
  /**
   * @param {number} b 
   * @returns {{x: number, y: number, z: number}}
   */
  index_to_3d_coord(b) {
    return {
      x: Math.floor(b % this.size.width),
      y: Math.floor(b / (this.size.width * this.size.width)),
      z: Math.floor((b / this.size.width) % this.size.width)
    };
  }
  _3d_coord_to_index(x, y, z) {
    return (this.size.width * this.size.height * z) + (this.size.width * y) + x;
  }
  initializeTerrain() {
    this.data_array = [];
    for (let b = 0; b < this.data_array_len; b++) {
      this.data_array.push({
        id: blocks.empty.id,
        instanceId: null
      });
    }
  }
  /**
   * @param {Custom_Random} rng 
   */
  generateResources(rng) {
    const simplex = new SimplexNoise(rng);
    resources.forEach(resource => {
      for (let b = 0; b < this.data_array_len; b++) {
        const { x, y, z } = this.index_to_3d_coord(b);
        const noise_sample = simplex.noise3d(
          (this.position.x + x) / resource.scale.x,
          (this.position.y + y) / resource.scale.y,
          (this.position.z + z) / resource.scale.z
        );
        if (noise_sample > resource.scarcity) {
          this.setBlockId(x, y, z, resource.id)
        }
      }
    });
  }
  /**
   * @param {Custom_Random} rng 
   */
  generateTerrain(rng) {
    const simplex = new SimplexNoise(rng);
    for (let x = 0; x < this.size.width; x++) {
      for (let z = 0; z < this.size.width; z++) {
        const noise_sample = simplex.noise(
          (this.position.x + x) / this.params.terrain.scale,
          (this.position.z + z) / this.params.terrain.scale
        );
        const scaled_noise =
          this.params.terrain.offset +
          this.params.terrain.magnitude *
          noise_sample;
        let height = Math.floor(scaled_noise);
        height = Math.max(0, Math.min(height, this.size.height));
        for (let y = 0; y < this.size.height; y++) {
          if (y === height) {
            if (y <= this.params.terrain.waterHeight) {
              this.setBlockId(x, y, z, blocks.sand.id);
            } else {
              this.setBlockId(x, y, z, blocks.grass.id);
            }
          } else if (y < height && this.getBlock(x, y, z).id === blocks.empty.id) {
            this.setBlockId(x, y, z, blocks.dirt.id)
          } else if (y > height) {
            this.setBlockId(x, y, z, blocks.empty.id)
          }
        }
      }
    }
  }
  generateTrees() {
    const generateTreeTrunk = (x, z, rng) => {
      const min_h = this.params.trees.trunk.min_height;
      const max_h = this.params.trees.trunk.max_height;
      const h = Math.round(min_h + (max_h - min_h) * rng.random());

      for (let y = 0; y < this.size.height; y++) {
        const block = this.getBlock(x, y, z);
        if (block && block.id === blocks.grass.id) {
          for (let tree_y = y + 1; tree_y <= y + h; tree_y++) {
            this.setBlockId(x, tree_y, z, blocks.tree.id);
          }
          generateTreeCanopy(x, y + h, z, rng);
          break;
        }
      }
    }
    const generateTreeCanopy = (ox, oy, oz, rng) => {
      const min_r = this.params.trees.canopy.min_radius;
      const max_r = this.params.trees.canopy.max_radius;
      const r = Math.round(min_r + (max_r - min_r) * rng.random());

      for (let x = -r; x <= r; x++) {
        for (let y = -r; y <= r; y++) {
          for (let z = -r; z <= r; z++) {
            const rand_val = rng.random();
            if (x * x + y * y + z * z > r * r) continue;
            const block = this.getBlock(ox + x, oy + y, oz + z);
            if (block && block.id !== blocks.empty.id) continue;
            if (rand_val < this.params.trees.canopy.density) {
              this.setBlockId(ox + x, oy + y, oz + z, blocks.leaves.id);
            }
          }
        }
      }
    }
    let rng = new Custom_Random(this.params.seed);
    let offset = this.params.trees.canopy.max_radius;
    for (let x = offset; x < this.size.width - offset; x++) {
      for (let z = offset; z < this.size.width - offset; z++) {
        if (rng.random() < this.params.trees.frequency) {
          generateTreeTrunk(x, z, rng)
        }

      }
    }
  }
  /**
   * @param {Custom_Random} rng 
   */
  generateClouds(rng) {
    const simplex = new SimplexNoise(rng);
    for (let x = 0; x < this.size.width; x++) {
      for (let z = 0; z < this.size.width; z++) {
        const noise_sample = (simplex.noise(
          (this.position.x + x) / this.params.clouds.scale,
          (this.position.z + z) / this.params.clouds.scale
        ) + 1) * 0.5;
        if (noise_sample < this.params.clouds.density) {
          this.setBlockId(x, this.size.height - 1, z, blocks.cloud.id);
        }
      }
    }
  }
  loadPlayerChanges() {
    for (let b = 0; b < this.data_array_len; b++) {
      const { x, y, z } = this.index_to_3d_coord(b);
      if (this.dataStore.contains(
        this.position.x, this.position.z, x, y, z
      )) {
        const blockId = this.dataStore.get(
          this.position.x, this.position.z, x, y, z
        );
        this.setBlockId(x, y, z, blockId);
      }
    }
  }
  generateWater() {
    const material = new THREE.MeshLambertMaterial({
      color: 0x9090e0,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    const waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(), material);
    waterMesh.rotateX(-Math.PI / 2.0);
    waterMesh.position.set(
      this.size.width / 2,
      this.params.terrain.waterHeight + 0.4,
      this.size.width / 2
    );
    waterMesh.scale.set(this.size.width, this.size.width, 1);
    waterMesh.layers.set(1);

    this.add(waterMesh);
  }
  generateMeshes() {
    this.clear();

    this.generateWater();

    const max_count = this.size.width * this.size.width * this.size.height;
    const meshes = {};

    Object.values(blocks)
      .filter((blockType) => { return blockType.id !== blocks.empty.id; })
      .forEach((blockType) => {
        const mesh = new THREE.InstancedMesh(
          instance_box_geometry,
          blockType.material,
          max_count
        );
        mesh.name = blockType.id;
        mesh.count = 0;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        meshes[blockType.id] = mesh;
      })
    // Not my code, and I don't know how it works 
    const matrix = new THREE.Matrix4();
    for (let b = 0; b < this.data_array_len; b++) {
      const { x, y, z } = this.index_to_3d_coord(b);
      const block = this.getBlock(x, y, z);
      const blockId = block.id;
      if (blockId === blocks.empty.id) continue;
      const mesh = meshes[blockId];
      const instanceId = mesh.count;
      if (!this.isBlockObscured(x, y, z)) {
        matrix.setPosition(x, y, z);
        mesh.setMatrixAt(instanceId, matrix);
        this.setBlockInstanceId(x, y, z, instanceId);
        mesh.count++;
      }
    }

    this.add(...Object.values(meshes));


    // const chunk_mesh = this.get_chunk_mesh();
    // chunk_mesh.castShadow = true;
    // chunk_mesh.receiveShadow = true;

    // this.add(...chunk_mesh);

  }
  /**
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   * @returns {{id: number, instanceId: number} | null}
   */
  getBlock(x, y, z) {
    if (this.inBounds(x, y, z)) {
      const b = this._3d_coord_to_index(x, y, z);
      return this.data_array[b];
    } else {
      return null;
    }
  }
  /**
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   * @param {number} id 
   */
  setBlockId(x, y, z, id) {
    if (this.inBounds(x, y, z)) {
      const b = this._3d_coord_to_index(x, y, z);
      this.data_array[b].id = id;
    }
  }
  /**
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   * @param {number} instanceId 
   */
  setBlockInstanceId(x, y, z, instanceId) {
    if (this.inBounds(x, y, z)) {
      const b = this._3d_coord_to_index(x, y, z);
      this.data_array[b].instanceId = instanceId;
    }
  }
  /**
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   * @returns {boolean}
   */
  inBounds(x, y, z) {
    return (
      x >= 0 && x < this.size.width &&
      y >= 0 && y < this.size.height &&
      z >= 0 && z < this.size.width
    );
  }
  /**
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   * @returns 
   */
  isBlockObscured(x, y, z) {
    const up = this.getBlock(x, y + 1, z)?.id ?? blocks.empty.id;
    const down = this.getBlock(x, y - 1, z)?.id ?? blocks.empty.id;
    const left = this.getBlock(x + 1, y, z)?.id ?? blocks.empty.id;
    const right = this.getBlock(x - 1, y, z)?.id ?? blocks.empty.id;
    const forward = this.getBlock(x, y, z + 1)?.id ?? blocks.empty.id;
    const back = this.getBlock(x, y, z - 1)?.id ?? blocks.empty.id;
    if (
      up == blocks.empty.id ||
      down == blocks.empty.id ||
      left == blocks.empty.id ||
      right == blocks.empty.id ||
      forward == blocks.empty.id ||
      back == blocks.empty.id
    ) {
      return false;
    } else {
      return true;
    };
  }
  /**
  * @param {number} x 
  * @param {number} y 
  * @param {number} z 
  * @param {number} blockId
  */
  addBlock(x, y, z, blockId) {
    const block = this.getBlock(x, y, z);
    if (block && block.id === blocks.empty.id) {
      this.setBlockId(x, y, z, blockId);
      this.addBlockInstance(x, y, z);
      this.dataStore.set(
        this.position.x, this.position.z,
        x, y, z, blockId
      );
    }
  }
  /**
  * @param {number} x 
  * @param {number} y 
  * @param {number} z 
  */
  removeBlock(x, y, z) {
    const block = this.getBlock(x, y, z);
    if (block && block.id !== blocks.empty.id) {
      this.removeBlockInstance(x, y, z);
      this.setBlockId(x, y, z, blocks.empty.id);
      this.dataStore.set(
        this.position.x, this.position.z,
        x, y, z, blocks.empty.id
      );
    }
  }
  /**
  * @param {number} x 
  * @param {number} y 
  * @param {number} z 
  */
  removeBlockInstance(x, y, z) {
    const block = this.getBlock(x, y, z);
    if (block.id === blocks.empty.id || block.instanceId === null) return;
    const mesh = this.children
      .find((instanceMesh) => { return instanceMesh.name === block.id; });
    const lastMatrix = new THREE.Matrix4();
    mesh.getMatrixAt(mesh.count - 1, lastMatrix);

    const v = new THREE.Vector3();
    v.setFromMatrixPosition(lastMatrix);
    this.setBlockInstanceId(v.x, v.y, v.z, block.instanceId);

    mesh.setMatrixAt(block.instanceId, lastMatrix);
    mesh.count--;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();

    this.setBlockInstanceId(x, y, z, null);
  }
  /**
  * @param {number} x 
  * @param {number} y 
  * @param {number} z 
  */
  addBlockInstance(x, y, z) {
    const block = this.getBlock(x, y, z);
    if (block && block.id !== blocks.empty.id && block.instanceId === null) {
      const mesh = this.children
        .find((instanceMesh) => { return instanceMesh.name === block.id; });
      const instanceId = mesh.count++;
      this.setBlockInstanceId(x, y, z, instanceId);

      const matrix = new THREE.Matrix4();
      matrix.setPosition(x, y, z);
      mesh.setMatrixAt(instanceId, matrix);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();

    }
  }
  disposeInstances() {
    this.traverse((obj) => {
      if (obj.dispose) { obj.dispose(); }
    });
    this.clear();
  }

  // This is my attempt to generate a mesh using Buffer Geometry
  // without instancing, as opposed to generating lots of meshes
  // with Box Geometry and merging them into an instance 

  // My mapping the 1d index to 3d coords isn't working the 
  // same way here that it does when interrogating the chunk 
  // data, I think the mesh vertices don't map to world-space

  // I was working with Raylib in C when I worked the v's out,
  // there I think the vertex coords map to world-space, but 
  // with three perhaps it's not the same 

  // For now it's not called, see the 
  // generateMeshes method above 

  get_chunk_mesh() {
    const chunkSize = this.size.width;
    const vertices = [];
    const v_normals = []; // not face normals 

    const temp_meshes = [];
    // const uvs = new Float32Array();
    // const indices = new Float32Array(); 
    // let n_triangles;

    for (let b = 0; b < this.data_array_len; b++) {
      if (this.data_array[b] && this.data_array[b].id === 0) continue;

      // const { x, y, z } = this.index_to_3d_coord(b);
      const { x, y, z } = {
        x: Math.floor(b % this.size.width),
        y: Math.floor(b / (this.size.width * this.size.width)),
        z: Math.floor((b / this.size.width) % this.size.width)
      };



      const test_block_mesh = new THREE.Mesh(axis_geometry, axis_material);
      // my coords work here, 
      test_block_mesh.position.set(x, y, z);
      test_block_mesh.castShadow = true;
      test_block_mesh.receiveShadow = true;
      temp_meshes.push(test_block_mesh);
      continue;

      // const behind = this.data_array[b - 1] || null;
      const behind = this.getBlock(x - 1, y, z);
      const ahead = this.getBlock(x + 1, y, z);
      const left = this.getBlock(x, y, z - 1);
      const right = this.getBlock(x, y, z + 1);
      const below = this.getBlock(x, y - 1, z);
      const above = this.getBlock(x, y + 1, z);

      if (false && behind && behind.id === 0) {
        // v1 x, y+1, z
        // v2 x, y, z
        // v3 x, y, z+1
        // v4 x, y+1, z+1
        vertices.push(x); // v1
        vertices.push(y + 1.0);
        vertices.push(z);

        vertices.push(x); // v2
        vertices.push(y);
        vertices.push(z);

        vertices.push(x); // v3
        vertices.push(y);
        vertices.push(z + 1.0);

        vertices.push(x); // v1
        vertices.push(y + 1.0);
        vertices.push(z);

        vertices.push(x); // v3
        vertices.push(y);
        vertices.push(z + 1.0);

        vertices.push(x); // v4
        vertices.push(y + 1.0);
        vertices.push(z + 1.0);

        v_normals.push(1);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(1);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(1);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(1);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(1);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(1);
        v_normals.push(0);
        v_normals.push(0);

      }
      if (false && right && right.id === 0) {
        // v1 x, y+1, z+1
        // v2 x, y, z+1
        // v3 x+1, y, z+1
        // v4 x+1, y+1, z+1
        vertices.push(x); // v1
        vertices.push(y);
        vertices.push(z);

        vertices.push(x); // v2
        vertices.push(y);
        vertices.push(z);

        vertices.push(x); // v3
        vertices.push(y);
        vertices.push(z);

        vertices.push(x); // v1
        vertices.push(y);
        vertices.push(z);

        vertices.push(x); // v3
        vertices.push(y);
        vertices.push(z);

        vertices.push(x); // v4
        vertices.push(y);
        vertices.push(z);

        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);

      }
      if (false && ahead && ahead.id === 0) {
        // v1 x+1, y, z
        // v2 x+1, y+1, z
        // v3 x+1, y+1, z+1
        // v4 x+1, y, z+1
        vertices.push(x + 1.0); // v1
        vertices.push(y);
        vertices.push(z);

        vertices.push(x + 1.0); // v2
        vertices.push(y + 1.0);
        vertices.push(z);

        vertices.push(x + 1.0); // v3
        vertices.push(y + 1.0);
        vertices.push(z + 1.0);

        vertices.push(x + 1.0); // v1
        vertices.push(y);
        vertices.push(z);

        vertices.push(x + 1.0); // v3
        vertices.push(y + 1.0);
        vertices.push(z + 1.0);

        vertices.push(x + 1.0); // v4
        vertices.push(y);
        vertices.push(z + 1.0);

        v_normals.push(-1);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(-1);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(-1);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(-1);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(-1);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(-1);
        v_normals.push(0);
        v_normals.push(0);

      }
      if (false && below && below.id === 0) {
        // v1 x, y, z
        // v2 x, y, z+1
        // v3 x+1, y, z+1
        // v4 x+1, y, z
        vertices.push(x); // v1
        vertices.push(y);
        vertices.push(z);

        vertices.push(x); // v2
        vertices.push(y);
        vertices.push(z);

        vertices.push(x); // v3
        vertices.push(y);
        vertices.push(z);

        vertices.push(x); // v1
        vertices.push(y);
        vertices.push(z);

        vertices.push(x); // v3
        vertices.push(y);
        vertices.push(z);

        vertices.push(x); // v4
        vertices.push(y);
        vertices.push(z);

        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);

      }
      if (false && left && left.id === 0) {
        // v1 x, y, z
        // v2 x, y+1, z
        // v3 x+1, y+1, z
        // v4 x+1, y, z
        vertices.push(x); // v1
        vertices.push(y);
        vertices.push(z);

        vertices.push(x); // v2
        vertices.push(y);
        vertices.push(z);

        vertices.push(x); // v3
        vertices.push(y);
        vertices.push(z);

        vertices.push(x); // v1
        vertices.push(y);
        vertices.push(z);

        vertices.push(x); // v3
        vertices.push(y);
        vertices.push(z);

        vertices.push(x); // v4
        vertices.push(y);
        vertices.push(z);

        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(0);

      }
      if (false && above && above.id === 0) {
        // v1 x, y+1, z
        // v2 x, y+1, z+1
        // v3 x+1, y+1, z+1
        // v4 x+1, y+1, z
        vertices.push(x); // v1
        vertices.push(y + 1.0);
        vertices.push(z);

        vertices.push(x); // v2
        vertices.push(y + 1.0);
        vertices.push(z + 1.0);

        vertices.push(x + 1.0); // v3
        vertices.push(y + 1.0);
        vertices.push(z + 1.0);

        vertices.push(x); // v1
        vertices.push(y + 1.0);
        vertices.push(z);

        vertices.push(x + 1.0); // v3
        vertices.push(y + 1.0);
        vertices.push(z + 1.0);

        vertices.push(x + 1.0); // v4
        vertices.push(y + 1.0);
        vertices.push(z);

        v_normals.push(0);
        v_normals.push(1);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(1);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(1);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(1);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(1);
        v_normals.push(0);
        v_normals.push(0);
        v_normals.push(1);
        v_normals.push(0);

      }

    }

    // let chunk_geometry = new THREE.BufferGeometry();
    // chunk_geometry.setAttribute('position',
    //   new THREE.BufferAttribute(new Float32Array(vertices), 3) // n * 3 v 
    // );
    // chunk_geometry.setAttribute('normal',
    //   new THREE.BufferAttribute(new Float32Array(v_normals), 3)
    // );
    // // instance_box_.setAttribute('uv',
    // //   new THREE.BufferAttribute(uvs, n_triangles) // n?
    // // );
    // // instance_box_.setIndex(indices);
    // let chunk_mesh = new THREE.Mesh(
    //   chunk_geometry,
    //   new THREE.MeshLambertMaterial({ color: 0x559020 })
    // );
    // return chunk_mesh;
    return temp_meshes;
  };
}

