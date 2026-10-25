// Aurelia's scene (MIT, see LICENSE), adapted for SafeSpace's Calm Space:
// it draws into a canvas of a given size instead of the whole window, has no
// camera dragging (the jellyfish sit behind the page), takes the number of
// jellyfish as an option, follows the pointer over its own canvas, and can be
// cleaned up when the page closes. The scene itself (lights, water, plankton,
// light rays, bloom) is Aurelia's.
import * as THREE from "three/webgpu";
import {pass, mrt, output, float, vec4, Fn, clamp, vec3} from "three/tsl";
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

import { Lights } from "./lights";
import { conf } from "./conf";
import { VerletPhysics } from "./physics/verletPhysics";
import { VertexVisualizer } from "./physics/vertexVisualizer";
import {SpringVisualizer} from "./physics/springVisualizer";
import {Medusa} from "./medusa";
import {MedusaVerletBridge} from "./medusaVerletBridge";
import {Background} from "./background";
import {Plankton} from "./plankton";
import {Godrays} from "./godrays";

class App {
    renderer = null;

    camera = null;

    scene = null;

    lights = null;

    physics = null;

    vertexVisualizer = null;

    springVisualizer = null;

    frameNum = 0;

    width = 1;

    height = 1;

    count = 6;

    pointerTarget = null;

    // SafeSpace: moves the camera sideways so the jellyfish swim beside the
    // page's text instead of behind it (0 = centred).
    shift = 0;

    constructor(renderer, { width, height, count = 6, pointerTarget = null, shift = 0 } = {}){
        this.shift = shift;
        this.renderer = renderer;
        this.width = width;
        this.height = height;
        this.count = count;
        this.pointerTarget = pointerTarget;
        this.onPointerMove = this.onPointerMove.bind(this);
    }

    async init(progressCallback = async () => {}) {
        conf.init();
        await this.renderer.init();
        this.camera = new THREE.PerspectiveCamera(65, this.width / this.height, 0.01, 30);
        this.setShift(this.shift);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);

        await progressCallback(0.1);

        this.physics = new VerletPhysics(this.renderer);

        await progressCallback(0.3);

        this.lights = new Lights();
        this.scene.add(this.lights.object);

        this.background = new Background(this.renderer);
        this.scene.environmentNode = Background.envFunction;
        this.scene.environmentIntensity = 0.3;
        this.scene.backgroundNode = Background.fogFunction;

        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        await progressCallback(0.4);

        await Medusa.initStatic(this.physics);

        await progressCallback(0.5);

        this.bridge = new MedusaVerletBridge(this.physics);

        for (let i=0; i<this.count; i++) {
            const medusa = new Medusa(this.renderer, this.physics, this.bridge);
            this.scene.add(medusa.object);
            this.physics.addObject(medusa);
        }
        this.physics.addObject(this.bridge);

        await progressCallback(0.6);

        await this.physics.bake();

        await progressCallback(0.7);

        this.vertexVisualizer = new VertexVisualizer(this.physics);
        this.springVisualizer = new SpringVisualizer(this.physics);
        this.scene.add(this.springVisualizer.object);

        await progressCallback(0.8);

        this.plankton = new Plankton();
        this.scene.add(this.plankton.object);

        await progressCallback(0.9);
        this.godrays = new Godrays(this.bridge);
        this.scene.add(this.godrays.object);

        const scenePass = pass(this.scene, this.camera);
        scenePass.setMRT( mrt( {
            output,
            bloomIntensity: float( 0 ) // default bloom intensity
        } ) );

        const outputPass = scenePass.getTextureNode();
        const bloomIntensityPass = scenePass.getTextureNode( 'bloomIntensity' );

        const bloomPass = bloom(Fn(() => {
            const bloomIntensity = bloomIntensityPass.r;
            const charge = bloomIntensityPass.g;
            const colorMask = vec3(1.0 - charge * 0.5, 1.0 - charge, 1.0);

            return vec4(outputPass.rgb * bloomIntensity * colorMask, 1);
        })());

        const postProcessing = new THREE.PostProcessing(this.renderer);
        postProcessing.outputColorTransform = false;
        postProcessing.outputNode = Fn(() => {
            const bloomIntensity = bloomIntensityPass.r;
            const charge = bloomIntensityPass.g;

            const bloomMask = (1.0 - clamp(bloomIntensity, 0, 1)) + charge;
            const finalBloom = bloomPass.rgb * clamp(bloomMask, 0, 1);
            return vec4(outputPass.rgb + finalBloom.rgb, 1.0).renderOutput();
        })();

        this.postProcessing = postProcessing;
        this.bloomPass = bloomPass;

        this.bloomPass.threshold.value = 0.001;
        this.bloomPass.strength.value = 0.4;
        this.bloomPass.radius.value = 0.8;

        this.raycaster = new THREE.Raycaster();
        // Far away until the pointer moves over the ocean.
        this.raycaster.ray.origin.set(0, 0, 1000);
        this.pointerTarget?.addEventListener("pointermove", this.onPointerMove);

        await progressCallback(1.0);
    }

    onPointerMove(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const pointer = new THREE.Vector2();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(pointer, this.camera);
        this.physics.setMouseRay(this.raycaster.ray.origin, this.raycaster.ray.direction);
    }

    // shift: a number (sideways) or {x, y} (sideways and up/down).
    setShift(shift) {
        this.shift = shift;
        const x = typeof shift === "number" ? shift : shift.x;
        const y = typeof shift === "number" ? 0 : shift.y;
        this.camera.position.set(x, y, 15);
        this.camera.lookAt(x, y, 0);
        this.camera.updateProjectionMatrix();
    }

    resize(width, height) {
        this.width = width;
        this.height = height;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    updatePointer() {
        this.bridge.medusae.forEach(medusa => {
            medusa.updatePointerInteraction(this.raycaster.ray);
        });
    }

    sortMedusae() {
        this.bridge.medusae.forEach(medusa => {
           medusa.distance = this.camera.position.distanceTo(medusa.transformationObject.position);
        });
        const sorted = [...this.bridge.medusae].sort((m1,m2) => m1.distance - m2.distance);
        let z = 10;
        for (let i = 0; i < sorted.length; i++) {
            const m = sorted[i];
            m.bell.geometryInside.object.renderOrder = z++;
            m.arms.object.renderOrder = z++;
            m.tentacles.object.renderOrder = z++;
            m.bell.geometryOutside.object.renderOrder = z++;
        }
    }

    async update(delta, elapsed) {
        conf.begin();
        const { runSimulation, showVerletSprings } = conf;
        this.springVisualizer.object.visible = showVerletSprings;

        conf.update();
        Medusa.updateStatic();

        this.background.update(elapsed);
        this.lights.update(elapsed);

        this.updatePointer();

        if (runSimulation) {
            await this.physics.update(delta, elapsed);
        }
        this.sortMedusae();

        await this.postProcessing.renderAsync();

        this.frameNum++
        conf.end();
    }

    dispose() {
        this.pointerTarget?.removeEventListener("pointermove", this.onPointerMove);
        this.scene?.traverse((obj) => {
            obj.geometry?.dispose?.();
            const materials = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
            materials.forEach((m) => m.dispose?.());
        });
        this.postProcessing?.dispose?.();
    }
}
export default App;
