import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { blocks } from "./blocks";
import { Tool } from "./tool";

const CENTER_SCREEN = new THREE.Vector2();

export class Player {
  radius = 0.4;
  height = 1.75;
  jumpSpeed = 10;
  onGround = false;

  maxSpeed = 8;
  input = new THREE.Vector3();
  velocity = new THREE.Vector3();
  #worldVelocity = new THREE.Vector3();

  camera =
    new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
  controls = new PointerLockControls(this.camera, document.body);
  cameraHelper = new THREE.CameraHelper(this.camera);

  raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(), 0, 3);
  selectedCoords = null;
  activeBlockId = blocks.empty.id;

  tool = new Tool();

  /**
   * @param {THREE.Scene} scene 
   */
  constructor(scene) {
    this.position.set(32, 16, 32);
    this.camera.layers.enable(1);
    this.camera.add(this.tool);
    scene.add(this.camera);
    this.cameraHelper.visible = false;
    scene.add(this.cameraHelper);

    this.boundsHelper = new THREE.Mesh(
      new THREE.CylinderGeometry(this.radius, this.radius, this.height, 16),
      new THREE.MeshBasicMaterial({ wireframe: true })
    );
    // scene.add(this.boundsHelper);

    const selectionMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.3,
      color: 0xffffaa
    });
    const selectionGeometry = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    this.selectionHelper = new THREE.Mesh(selectionGeometry, selectionMaterial);
    scene.add(this.selectionHelper);

    this.raycaster.layers.set(0);

    document.addEventListener("keydown", this.onKeyDown.bind(this));
    document.addEventListener("keyup", this.onKeyUp.bind(this));
  }
  update(world) {
    // this.updateBoundsHelper();
    this.updateRaycaster(world);
    this.tool.update();
  }
  updateRaycaster(world) {
    this.raycaster.setFromCamera(CENTER_SCREEN, this.camera);
    const intersections = this.raycaster.intersectObject(world, true);
    if (intersections.length > 0 && intersections[0].point) {
      // This was written for the instance mesh by the author,
      // I've approximated without the instance and it's not 
      // accurate, TODO
      const target_point = intersections[0].point;
      const target = new THREE.Vector3(
        Math.floor(target_point.x),
        Math.floor(target_point.y),
        Math.floor(target_point.z)
      );
      this.selectedCoords = target.clone();
      this.selectionHelper.position.copy(this.selectedCoords);
      this.selectionHelper.visible = true;
    } else {
      this.selectedCoords = null;
      this.selectionHelper.visible = false;
    }
  }
  /**
   * @type {THREE.Vector3}
   */
  get worldVelocity() {
    this.#worldVelocity.copy(this.velocity);
    this.#worldVelocity.applyEuler(new THREE.Euler(0, this.camera.rotation.y, 0));
    return this.#worldVelocity;
  };
  /**
   * @param {THREE.Vector3} dv 
   */
  applyWorldDeltaVelocity(dv) {
    dv.applyEuler(new THREE.Euler(0, -this.camera.rotation.y, 0));
    this.velocity.add(dv);
  }
  /**
   * @param {number} delta 
   */
  applyInputs(delta) {
    if (this.controls.isLocked) {
      this.velocity.x = this.input.x;
      this.velocity.z = this.input.z;
      this.controls.moveRight(this.velocity.x * delta);
      this.controls.moveForward(this.velocity.z * delta);
      this.position.y += this.velocity.y * delta;

      document.getElementById("player-position").innerHTML = this.toString();
    }
  }
  updateBoundsHelper() {
    this.boundsHelper.position.copy(this.position);
    this.boundsHelper.position.y -= this.height / 2;
  }
  /**
   * @type {THREE.Vector3}
   */
  get position() {
    return this.camera.position;
  }
  /**
   * @param {KeyboardEvent} event 
   */
  onKeyDown(event) {
    if (!this.controls.isLocked) {
      this.controls.lock();
      console.log("Controls Locked");
    }
    // These switches aren't really good enough, should look at
    // alternatives, or making my own input controller 
    switch (event.code) {
      case "Digit0":
      case "Digit1":
      case "Digit2":
      case "Digit3":
      case "Digit4":
      case "Digit5":
      case 'Digit6':
      case 'Digit7':
      case 'Digit8':
        document.getElementById(`toolbar-${this.activeBlockId}`)
          .classList.remove("selected");
        this.activeBlockId = Number(event.key);
        document.getElementById(`toolbar-${this.activeBlockId}`)
          .classList.add("selected");
        this.tool.visible = this.activeBlockId === 0;
        break;
      case "KeyW":
        this.input.z = this.maxSpeed;
        break;
      case "KeyA":
        this.input.x = -this.maxSpeed;
        break;
      case "KeyS":
        this.input.z = -this.maxSpeed;
        break;
      case "KeyD":
        this.input.x = this.maxSpeed;
        break;
      case "KeyR":
        if (this.repeat) break;
        this.position.y = 32;
        this.velocity.set(0, 0, 0);
        break;
      case "Space":
        if (this.onGround) {
          this.velocity.y += this.jumpSpeed;
        }
        break;
    }
  }
  /**
   * @param {KeyboardEvent} event 
   */
  onKeyUp(event) {
    switch (event.code) {
      case "KeyW":
        this.input.z = 0;
        break;
      case "KeyA":
        this.input.x = 0;
        break;
      case "KeyS":
        this.input.z = 0;
        break;
      case "KeyD":
        this.input.x = 0;
        break;
    }
  }
  /**
   * @returns {string}
   */
  toString() {
    return `(${this.position.x.toFixed(3)
      }, ${this.position.y.toFixed(3)
      }, ${this.position.z.toFixed(3)})`;
  }
}