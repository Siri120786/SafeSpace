// Smooth noise for the jellyfish's drift. SafeSpace uses three.js's own
// ImprovedNoise instead of the simplex-noise package; like simplex noise it
// returns values in about -1..1. Each page load gets its own random offset.
import { ImprovedNoise } from "three/addons/math/ImprovedNoise.js";

const perlin = new ImprovedNoise();
const offset = Math.random() * 100;

export const noise3D = (x, y, z) => perlin.noise(x + offset, y + offset * 0.5, z);
export const noise2D = (x, y) => perlin.noise(x + offset, y + offset * 0.5, 0.5);
