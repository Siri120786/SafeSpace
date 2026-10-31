// Settings for the jellyfish (Aurelia, MIT, see LICENSE). SafeSpace keeps the
// original values; the debug panel (tweakpane) is left out.
class Conf {
    roughness = 0.4;
    metalness = 0.2;
    transmission = 0.7;
    color = 0xffffff;
    iridescence = 0.0;
    iridescenceIOR = 2.33;

    runSimulation = true;
    showVerletSprings = false;

    init() { }
    update() { }
    begin() { }
    end() { }
}
export const conf = new Conf();
