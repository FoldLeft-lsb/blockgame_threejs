export class DataStore {
  constructor() {
    this.data = {};
  }
  clear() {
    this.data = {};
  }
  /**
   * @param {number} cx 
   * @param {number} cz 
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   * @returns {boolean}
   */
  contains(cx, cz, x, y, z) {
    const key = this.getKey(cx, cz, x, y, z);
    return this.data[key] !== undefined;
  }
  /**
   * @param {number} cx 
   * @param {number} cz 
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   * @returns {number}
   */
  get(cx, cz, x, y, z) {
    const key = this.getKey(cx, cz, x, y, z);
    const blockId = this.data[key];
    return blockId;
  }
  /**
   * @param {number} cx 
   * @param {number} cz 
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   * @param {number} blockId 
   */
  set(cx, cz, x, y, z, blockId) {
    const key = this.getKey(cx, cz, x, y, z);
    this.data[key] = blockId;
  }
  /**
   * @param {number} cx 
   * @param {number} cz 
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   * @returns {string}
   */
  getKey(cx, cz, x, y, z) {
    return `${cx}-${cz}-${x}-${y}-${z}`;
  }
}