import * as THREE from "three";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { Player } from "./player";
import { World } from "./world";
import { createUI } from "./dev_ui";
import { Physics } from "./physics";
import { blocks } from "./blocks";
import { ModelLoader } from "./model_loader";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x80a0e0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const orbitCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight);
orbitCamera.position.set(-32, 32, 32);
orbitCamera.layers.enable(1);

const orbitControls = new OrbitControls(orbitCamera, renderer.domElement);
orbitControls.target.set(32, 0, 32);
orbitControls.update();

const scene = new THREE.Scene();
const world = new World();
world.generate();
scene.add(world);

const axis_geometry = new THREE.BoxGeometry();
const axis_material = new THREE.MeshLambertMaterial({ color: 0x559020 });

// const pos_mesh_o = new THREE.Mesh(axis_geometry, axis_material);
// pos_mesh_o.position.set(0, 0, 0);
// pos_mesh_o.castShadow = true;
// pos_mesh_o.receiveShadow = true;
// const pos_mesh_x = new THREE.Mesh(axis_geometry, axis_material);
// pos_mesh_x.position.set(2, 0, 0);
// pos_mesh_x.castShadow = true;
// pos_mesh_x.receiveShadow = true;
// // const pos_mesh_z = new THREE.Mesh(axis_geometry, axis_material);
// // pos_mesh_z.position.set(0, 0, 2);
// // pos_mesh_z.castShadow = true;
// // pos_mesh_z.receiveShadow = true;
// const pos_mesh_y = new THREE.Mesh(axis_geometry, axis_material);
// pos_mesh_y.position.set(0, 2, 0);
// pos_mesh_y.castShadow = true;
// pos_mesh_y.receiveShadow = true;

// scene.add(pos_mesh_o);
// scene.add(pos_mesh_x);
// // scene.add(pos_mesh_z);
// scene.add(pos_mesh_y);

const sun = new THREE.DirectionalLight();
scene.fog = new THREE.Fog(0x80a0e0, 50, 100);

sun.position.set(50, 50, 50);
sun.castShadow = true;
sun.shadow.camera.left = -100;
sun.shadow.camera.right = 100;
sun.shadow.camera.bottom = -100;
sun.shadow.camera.top = 100;
sun.shadow.camera.near = 0.1;
sun.shadow.camera.far = 200;
sun.shadow.bias = -0.0005;
sun.shadow.mapSize = new THREE.Vector2(1024, 1024);
scene.add(sun);
scene.add(sun.target);

const light_ambient = new THREE.AmbientLight();
light_ambient.intensity = 0.2;

scene.add(light_ambient);

const player = new Player(scene);
const physics = new Physics(scene);

const modelLoader = new ModelLoader();
modelLoader.loadModels((models) => {
  player.tool.setMesh(models.pickaxe);
});

const stats = new Stats();
document.body.append(stats.dom);

document.addEventListener("mousedown", (_event) => {
  if (player.controls.isLocked && player.selectedCoords) {
    if (player.activeBlockId === blocks.empty.id) {
      world.removeBlock(
        player.selectedCoords.x,
        player.selectedCoords.y,
        player.selectedCoords.z
      );
      player.tool.startAnimation();
    } else {
      world.addBlock(
        player.selectedCoords.x,
        player.selectedCoords.y,
        player.selectedCoords.z,
        player.activeBlockId
      );
    }
  }
});

let previousTime = performance.now();
let animate = () => {
  let currentTime = performance.now();
  let delta = (currentTime - previousTime) / 1000;
  setTimeout(() => {
    requestAnimationFrame(animate);
  }, 1000 / 60);

  sun.position.copy(player.camera.position);
  sun.position.add(new THREE.Vector3(50, 50, 50));
  sun.target.position.copy(player.camera.position);

  if (player.controls.isLocked) {
    player.update(world);
    physics.update(delta, player, world);
  }

  world.update(player.camera.position);
  renderer.render(scene, player.controls.isLocked ? player.camera : orbitCamera);
  stats.update();

  previousTime = currentTime;
};

window.addEventListener("resize", () => {
  player.camera.aspect = window.innerWidth / window.innerHeight;
  player.camera.updateProjectionMatrix();
  orbitCamera.aspect = window.innerWidth / window.innerHeight;
  orbitCamera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

createUI(scene, world, player);
animate();