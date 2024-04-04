import * as THREE from "three";
import { blocks } from "./blocks.js";
import { Player } from "./player.js";
import { WorldChunk } from "./world_chunk.js";

const collisionMaterial = new THREE.MeshBasicMaterial({
  color: 0xff0000,
  transparent: true,
  opacity: 0.2
});

const collisionGeometry = new THREE.BoxGeometry(1.001, 1.001, 1.001);

const contactMaterial = new THREE.MeshBasicMaterial({
  color: 0xff0000,
  wireframe: true
});

const contactGeometry = new THREE.SphereGeometry(0.05, 6, 6);

export class Physics {
  simulationRate = 200;
  timestep = 1 / this.simulationRate;
  time_accumulator = 0;

  gravity = 32;

  constructor(scene) {
    this.helpers = new THREE.Group();
    scene.add(this.helpers);
  }
  /**
   * @param {number} delta 
   * @param {Player} player 
   * @param {WorldChunk} world 
   */
  update(delta, player, world) {
    this.time_accumulator += delta;

    while (this.time_accumulator >= this.timestep) {
      this.helpers.children = [];
      player.velocity.y -= this.gravity * this.timestep;
      player.applyInputs(this.timestep);
      this.detectCollisions(player, world);
      this.time_accumulator -= this.timestep;
    }
  }
  /**
   * @param {Player} player 
   * @param {WorldChunk} world 
   */
  detectCollisions(player, world) {
    player.onGround = false;
    const candidates = this.broadPhase(player, world);
    const collisions = this.narrowPhase(candidates, player);

    if (collisions.length > 0) {
      this.resolveCollision(collisions, player);
    }
  }
  /**
   * @param {Player} player 
   * @param {WorldChunk} world 
   * @returns {{x: number, y: number, z: number}[]}
   */
  broadPhase(player, world) {
    const candidates = [];

    const x_min = Math.floor(player.position.x - player.radius);
    const x_max = Math.ceil(player.position.x + player.radius);
    const y_min = Math.floor(player.position.y - player.height);
    const y_max = Math.ceil(player.position.y);
    const z_min = Math.floor(player.position.z - player.radius);
    const z_max = Math.ceil(player.position.z + player.radius);

    for (let x = x_min; x <= x_max; x++) {
      for (let y = y_min; y <= y_max; y++) {
        for (let z = z_min; z <= z_max; z++) {
          const block = world.getBlock(x, y, z);
          if (block && block.id !== blocks.empty.id) {
            const blockPos = { x, y, z };
            candidates.push(blockPos);
            // this.addCollisionHelper(blockPos);
          }
        }
      }
    }
    return candidates;
  }
  /**
   * @param {{x: number, y: number, z: number}[]} candidates 
   * @param {Player} player 
   * @returns {{
   *  block: {
   *    x: number;
   *    y: number;
   *    z: number;
   *  };
   *  contactPoint: {
   *    x: number;
   *    y: number;
   *    z: number;
   *  };
   *  normal: THREE.Vector3;
   *  overlap: number;
   * }[]}
   */
  narrowPhase(candidates, player) {
    const collisions = [];
    for (const block of candidates) {
      const closestPoint = {
        x: Math.max(block.x - 0.5, Math.min(player.position.x, block.x + 0.5)),
        y: Math.max(block.y - 0.5, Math.min(player.position.y - (player.height / 2), block.y + 0.5)),
        z: Math.max(block.z - 0.5, Math.min(player.position.z, block.z + 0.5))
      };
      const dx = closestPoint.x - player.position.x;
      const dy = closestPoint.y - (player.position.y - (player.height / 2));
      const dz = closestPoint.z - player.position.z;
      if (this.pointInPlayerBoundingCylinder(closestPoint, player)) {
        const overlapY = (player.height / 2) - Math.abs(dy);
        const overlapXZ = player.radius - Math.sqrt(dx * dx + dz * dz);
        let normal, overlap;
        if (overlapY < overlapXZ) {
          normal = new THREE.Vector3(0, -Math.sign(dy), 0);
          overlap = overlapY;
          player.onGround = true;
        } else {
          normal = new THREE.Vector3(-dx, 0, -dz).normalize();
          overlap = overlapXZ;
        }
        collisions.push({
          block,
          contactPoint: closestPoint,
          normal,
          overlap
        });
        // this.addContactPointHelper(closestPoint);
      }
    }
    return collisions;
  }
  /**
   * @param {{x: number, y: number, z: number}[]} collisions 
   * @param {Player} player 
   */
  resolveCollision(collisions, player) {
    collisions.sort((a, b) => { return a.overlap < b.overlap });
    for (const collision of collisions) {

      if (!this.pointInPlayerBoundingCylinder(collision.contactPoint, player))
        continue;

      let d_pos = collision.normal.clone();
      d_pos.multiplyScalar(collision.overlap);
      player.position.add(d_pos);

      let magnitude = player.worldVelocity.dot(collision.normal);
      let velocityAdjustment = collision.normal.clone().multiplyScalar(magnitude);
      player.applyWorldDeltaVelocity(velocityAdjustment.negate());
    }
  }
  /**
   * @param {{x: number, y: number, z: number}} blockPos 
   */
  addCollisionHelper(blockPos) {
    const blockMesh = new THREE.Mesh(collisionGeometry, collisionMaterial);
    blockMesh.position.copy(blockPos);
    this.helpers.add(blockMesh);
  }
  /**
  * @param {{x: number, y: number, z: number}} blockPos 
  */
  addContactPointHelper(blockPos) {
    const blockMesh = new THREE.Mesh(contactGeometry, contactMaterial);
    blockMesh.position.copy(blockPos);
    this.helpers.add(blockMesh);
  }
  /**
   * @param {{x: number, y: number, z: number}} point 
   * @param {Player} player 
   * @returns {boolean}
   */
  pointInPlayerBoundingCylinder(point, player) {
    const dx = point.x - player.position.x;
    const dy = point.y - (player.position.y - (player.height / 2));
    const dz = point.z - player.position.z;
    const r_sq = dx * dx + dz * dz;

    return (Math.abs(dy) < player.height / 2) && (r_sq < player.radius * player.radius);
  }
}