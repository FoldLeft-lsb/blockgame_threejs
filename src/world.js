import * as THREE from "three";
import { WorldChunk } from "./world_chunk";
import { DataStore } from "./data_store";

export class World extends THREE.Group {
  async_loading = true;

  draw_distance = 0;
  chunk_size = {
    width: 16,
    height: 4
  };
  params = {
    seed: 0,
    terrain: {
      scale: 20,
      magnitude: 10,
      offset: 4,
      waterHeight: 3,
    },
    trees: {
      trunk: {
        min_height: 4,
        max_height: 7
      },
      canopy: {
        min_radius: 2,
        max_radius: 3,
        density: 0.8
      },
      frequency: 0.001
    },
    clouds: {
      scale: 30,
      density: 0.2
    }
  };

  dataStore = new DataStore();

  constructor(seed = 0) {
    super();
    this.seed = seed;

    document.addEventListener("keydown", (event) => {
      switch (event.code) {
        case "F1":
          this.save();
          break;
        case "F2":
          this.load();
          break;
      }
    });
  }
  save() {
    localStorage.setItem("minecraft_params", JSON.stringify(this.params));
    localStorage.setItem("minecraft_data", JSON.stringify(this.dataStore.data));
    document.getElementById("status").innerHTML = "Game Saved";
    setTimeout(() => document.getElementById("status").innerHTML = "", 3000);
  }
  load() {
    this.params = JSON.parse(localStorage.getItem("minecraft_params"));
    this.dataStore.data = JSON.parse(localStorage.getItem("minecraft_data"));
    document.getElementById("status").innerHTML = "Game Loaded";
    setTimeout(() => document.getElementById("status").innerHTML = "", 3000);
    this.generate();
  }
  /**
   * @param {THREE.Vector3} player_pos 
   */
  update(player_pos) {
    const visibleChunks = this.getVisibleChunks(player_pos);
    const chunksToAdd = this.getChunksToAdd(visibleChunks);
    this.removeUnusedChunks(visibleChunks);
    for (const chunk of chunksToAdd) {
      this.generateChunk(chunk.x, chunk.z);
    }
  }
  /**
   * @param {THREE.Vector3} player_pos 
   * @returns {{x: number, z: number}[]}
   */
  getVisibleChunks(player_pos) {
    const visibleChunks = [];
    const coords = this.worldToChunkCoords(
      player_pos.x, 0, player_pos.z
    );
    const cx = coords.chunk.x;
    const cz = coords.chunk.z;

    for (let x = cx - this.draw_distance; x <= cx + this.draw_distance; x++) {
      for (let z = cz - this.draw_distance; z <= cz + this.draw_distance; z++) {
        visibleChunks.push({ x, z });
      }
    }

    return visibleChunks;
  }
  /**
   * @param {{x: number, z: number}[]} visibleChunks 
   * @returns {{x: number, z: number}[]}
   */
  getChunksToAdd(visibleChunks) {
    return visibleChunks.filter((chunk) => {
      const chunkExists = this.children
        .find((obj) => {
          return chunk.x === obj.userData.x && chunk.z === obj.userData.z;
        });
      return !chunkExists;
    });
  }
  /**
   * @param {{x: number, z: number}[]} visibleChunks 
   */
  removeUnusedChunks(visibleChunks) {
    const chunksToRemove = this.children.filter((obj) => {
      const { x, z } = obj.userData;
      const chunkExists = visibleChunks.find((visibleChunk) => {
        return visibleChunk.x === x && visibleChunk.z === z;
      });

      return !chunkExists;
    });
    for (const chunk of chunksToRemove) {
      chunk.disposeInstances();
      this.remove(chunk);
    }
  }
  generate(clearCache = false) {
    if (clearCache) this.dataStore.clear();
    this.disposeChunks();
    for (let x = -this.draw_distance; x <= this.draw_distance; x++) {
      for (let z = -this.draw_distance; z <= this.draw_distance; z++) {
        const chunk = new WorldChunk(this.chunk_size, this.params, this.dataStore);
        chunk.position.set(
          x * this.chunk_size.width, 0,
          z * this.chunk_size.width
        );
        chunk.generate();
        chunk.userData = { x, z };
        this.add(chunk);
      }
    }
  }
  /**
   * @param {number} x 
   * @param {number} z 
   */
  generateChunk(x, z) {
    const chunk = new WorldChunk(this.chunk_size, this.params, this.dataStore);
    chunk.position.set(
      x * this.chunk_size.width, 0,
      z * this.chunk_size.width
    );
    if (this.async_loading) {
      requestIdleCallback(chunk.generate.bind(chunk), { timeout: 1000 });
    } else {
      chunk.generate();
    }
    chunk.userData = { x, z };
    this.add(chunk);
  }
  /**
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   * @returns {{id: number, instanceId: number} | null}
   */
  getBlock(x, y, z) {
    const coords = this.worldToChunkCoords(x, y, z);
    const chunk = this.getChunk(coords.chunk.x, coords.chunk.z);
    if (chunk && chunk.loaded) {
      return chunk.getBlock(coords.block.x, coords.block.y, coords.block.z);
    } else {
      return null;
    }
  }
  /**
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   * @returns {{
   *  chunk: {x: number, z: number},
   *  block: {x: number, y: number, z: number}
   * }}
   */
  worldToChunkCoords(x, y, z) {
    const chunkCoords = {
      x: Math.floor(x / this.chunk_size.width),
      z: Math.floor(z / this.chunk_size.width)
    };
    const blockCoords = {
      x: x - this.chunk_size.width * chunkCoords.x,
      y,
      z: z - this.chunk_size.width * chunkCoords.z,
    };
    return {
      chunk: chunkCoords,
      block: blockCoords
    };
  }
  /**
   * @param {number} cx 
   * @param {number} cz 
   * @returns {WorldChunk | null}
   */
  getChunk(cx, cz) {
    return this.children.find((chunk) => {
      return chunk.userData.x === cx &&
        chunk.userData.z === cz
    });
  }
  /**
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   */
  removeBlock(x, y, z) {
    const coords = this.worldToChunkCoords(x, y, z);
    const chunk = this.getChunk(coords.chunk.x, coords.chunk.z);

    if (chunk) {
      chunk.removeBlock(
        coords.block.x, coords.block.y, coords.block.z
      );
      this.revealBlock(x - 1, y, z);
      this.revealBlock(x + 1, y, z);
      this.revealBlock(x, y - 1, z);
      this.revealBlock(x, y + 1, z);
      this.revealBlock(x, y, z - 1);
      this.revealBlock(x, y, z + 1);
    };
  }
  /**
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   */
  revealBlock(x, y, z) {
    const coords = this.worldToChunkCoords(x, y, z);
    const chunk = this.getChunk(coords.chunk.x, coords.chunk.z);

    if (chunk) {
      chunk.addBlockInstance(
        coords.block.x, coords.block.y, coords.block.z
      );
    };
  }
  /**
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   */
  hideBlockIfNeeded(x, y, z) {
    const coords = this.worldToChunkCoords(x, y, z);
    const chunk = this.getChunk(coords.chunk.x, coords.chunk.z);

    if (chunk && chunk.isBlockObscured(coords.block.x, coords.block.y, coords.block.z)) {
      chunk.removeBlockInstance(
        coords.block.x, coords.block.y, coords.block.z
      );
    };
  }
  /**
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   * @param {number} blockId
   */
  addBlock(x, y, z, blockId) {
    const coords = this.worldToChunkCoords(x, y, z);
    const chunk = this.getChunk(coords.chunk.x, coords.chunk.z);

    if (chunk) {
      chunk.addBlock(
        coords.block.x, coords.block.y, coords.block.z, blockId
      );

      this.hideBlockIfNeeded(x - 1, y, z);
      this.hideBlockIfNeeded(x + 1, y, z);
      this.hideBlockIfNeeded(x, y - 1, z);
      this.hideBlockIfNeeded(x, y + 1, z);
      this.hideBlockIfNeeded(x, y, z - 1);
      this.hideBlockIfNeeded(x, y, z + 1);
    };
  }

  disposeChunks() {
    this.traverse((chunk) => {
      if (chunk.disposeInstances) { chunk.disposeInstances(); }
    });
    this.clear();
  }
}