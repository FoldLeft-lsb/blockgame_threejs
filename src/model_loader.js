import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export class ModelLoader {
  loader = new GLTFLoader();
  models = {
    pickaxe: undefined
  };

  loadModels(onload) {
    this.loader.load("/models/pickaxe.glb",
      (model) => {
        const mesh = model.scene;
        this.models.pickaxe = mesh;
        onload(this.models);
      }
    );
  }
}