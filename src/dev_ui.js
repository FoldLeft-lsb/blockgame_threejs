import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { resources } from "./blocks.js";

export function createUI(scene, world, player) {
  const gui = new GUI();

  const sceneFolder = gui.addFolder("Scene").close();
  sceneFolder.add(scene.fog, "near", 1, 300, 1).name("Fog Near");
  sceneFolder.add(scene.fog, "far", 1, 300, 1).name("Fog Far");

  const playerFolder = gui.addFolder("Player").close();
  playerFolder.add(player, "maxSpeed", 1, 20).name("Max speed");
  playerFolder.add(player.cameraHelper, "visible", 1, 20).name("Show Camera Helper");

  const terrainFolder = gui.addFolder("Terrain").close();
  terrainFolder.add(world, "async_loading").name("Async Chunk Loading");
  terrainFolder.add(world, "draw_distance", 0, 5, 1).name("Draw Distance");
  terrainFolder.add(world.params, "seed", 10, 10000).name("Seed");
  terrainFolder.add(world.params.terrain, "scale", 10, 100).name("Scale");
  terrainFolder.add(world.params.terrain, "magnitude", 0, 32, 1).name("Magnitude");
  terrainFolder.add(world.params.terrain, "offset", 0, 32, 1).name("Offset");
  terrainFolder.add(world.params.terrain, "waterHeight", 0, 16).name("Water Offset");

  const resourcesFolder = terrainFolder.addFolder("Resources").close();
  resources.forEach(resource => {
    const aResourceFolder = resourcesFolder.addFolder(resource.name).close();
    aResourceFolder.add(resource, "scarcity", 0, 1).name("Scarcity");

    const scaleFolder = aResourceFolder.addFolder("Scale");
    scaleFolder.add(resource.scale, "x", 10, 100).name("X Scale");
    scaleFolder.add(resource.scale, "y", 10, 100).name("Y Scale");
    scaleFolder.add(resource.scale, "z", 10, 100).name("Z Scale");
  });

  const treesFolder = terrainFolder.addFolder("Trees").close();
  treesFolder.add(world.params.trees, "frequency", 0, 0.1).name("Frequency");
  treesFolder.add(world.params.trees.trunk, "min_height", 0, 10, 1).name("Min Trunk Height");
  treesFolder.add(world.params.trees.trunk, "max_height", 0, 10, 1).name("Max Trunk Height");
  treesFolder.add(world.params.trees.canopy, "min_radius", 0, 10, 1).name("Min Canopy Size");
  treesFolder.add(world.params.trees.canopy, "max_radius", 0, 10, 1).name("Max Canopy Size");
  treesFolder.add(world.params.trees.canopy, "density", 0, 1).name("Canopy Density");

  const cloudsFolder = terrainFolder.addFolder("Clouds").close();
  cloudsFolder.add(world.params.clouds, "density", 0, 1).name("Density");
  cloudsFolder.add(world.params.clouds, "scale", 1, 100, 1).name("Scale");

  gui.onChange(() => {
    world.generate(true);
  });
}