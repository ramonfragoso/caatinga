import { useControls } from "leva";

export const useDebugUI = () => {
  const lightingControls = useControls("Lighting", {
    ambientIntensity: { value: 0.35, min: 0, max: 2, step: 0.01 },
    directionalIntensity: { value: 3.0, min: 0, max: 3, step: 0.01 },
    directionalPosition: { value: [0, 3, 8], step: 0.5 },
    directionalColor: "#ffffff4b",
    pointIntensity: { value: 185, min: 0, max: 500, step: 0.1 },
    pointPosition: { value: [2, 2, -1], step: 0.01 },
    pointColor: "#626262",
    showHelpers: false,
  }, { collapsed: true });

  const spotlightControls = useControls("Spotlight", {
    enabled: true,
    intensity: { value: 329, min: 0, max: 500, step: 1 },
    color: "#ffffff",
    distance: { value: 33, min: 0, max: 100, step: 0.5 },
    angle: { value: 0.37, min: 0.05, max: Math.PI / 3, step: 0.01 },
    penumbra: { value: 1, min: 0, max: 1, step: 0.01 },
    decay: { value: 1.9, min: 1, max: 2, step: 0.01 },
    orbitRadius: { value: 10.4, min: 0, max: 20, step: 0.1 },
    height: { value: 15, min: 0, max: 30, step: 0.1 },
    orbitSpeed: { value: 0.74, min: 0, max: 2, step: 0.01 },
    orbitEnabled: true,
    targetY: { value: -2, min: -5, max: 5, step: 0.1 },
    shadowFocus: { value: 1, min: 0, max: 1, step: 0.01 },
    shadowBias: { value: 0.01, min: -0.01, max: 0.01, step: 0.0001 },
    shadowIntensity: { value: 1, min: 0, max: 1, step: 0.01 },
  }, { collapsed: true });

  const playerControls = useControls("Player", {
    eyeHeight: { value: 1.8, min: 0, max: 10, step: 0.1 },
  }, { collapsed: true });

  // Skeleton landmark with three cows gathered around it. Cow x/z are world
  // coords (y follows the terrain); the full euler lets each cow be tilted onto
  // the local slope.
  const skeletonSceneControls = useControls("Skeleton Scene", {
    // The skeleton's XZ, scale and rotation are dialed in and baked into
    // SkeletonScene. Only its height stays adjustable: the model floats slightly
    // above the terrain, and the correction is smaller than one scatter step.
    skeletonY: { value: -0.1, min: -1, max: 1, step: 0.001 },

    cow1Position: { value: [84, 0, 110] as [number, number, number], step: 0.5 },
    cow1Rotation: { value: [0, 3.1, 0] as [number, number, number], step: 0.05 },

    cow2Position: { value: [72, 0, 123] as [number, number, number], step: 0.5 },
    cow2Rotation: { value: [0, -0.8, 0] as [number, number, number], step: 0.05 },

    cow3Position: { value: [92.7, 0, 126] as [number, number, number], step: 0.5 },
    cow3Rotation: { value: [0, 2.4, 0] as [number, number, number], step: 0.05 },
  }, { collapsed: true });

  // tree2 + 2 perched vultures, plus 3 standing on the ground nearby. The
  // perched v1-v2 offsets are relative to the tree's base; the ground g1-g3 are
  // world coords whose y is an offset above the terrain.
  const vultureSceneControls = useControls("Vultures Scene", {
    scenePosition: { value: [-173, 0, -122] as [number, number, number], step: 1 },
    treeScale: { value: 1.75, min: 0.1, max: 5, step: 0.05 },
    treeYaw: { value: 0, min: -Math.PI, max: Math.PI, step: 0.01 },

    v1Position: { value: [6.5, 39, 1.5] as [number, number, number], step: 0.25 },
    v1Rotation: { value: [0, 1.5, 0] as [number, number, number], step: 0.05 },
    v1Scale: { value: 3.1, min: 0.05, max: 10, step: 0.05 },

    v2Position: { value: [2, 68, -70] as [number, number, number], step: 0.25 },
    v2Rotation: { value: [0, 1.5, 0] as [number, number, number], step: 0.05 },
    v2Scale: { value: 5.5, min: 0.05, max: 10, step: 0.05 },

    g1Position: { value: [-121.9, 0, -117.4] as [number, number, number], step: 0.5 },
    g1Rotation: { value: [0, 0.3, 0] as [number, number, number], step: 0.05 },
    g1Scale: { value: 0.95, min: 0.05, max: 5, step: 0.05 },

    g2Position: { value: [-81.9, 9.1, -74.2] as [number, number, number], step: 0.5 },
    g2Rotation: { value: [0, -3.5, 0] as [number, number, number], step: 0.05 },
    g2Scale: { value: 1.25, min: 0.05, max: 5, step: 0.05 },

    g3Position: { value: [-46, 14, -39] as [number, number, number], step: 0.5 },
    g3Rotation: { value: [0, 1.6, 0] as [number, number, number], step: 0.05 },
    g3Scale: { value: 2.1, min: 0.05, max: 5, step: 0.05 },
  }, { collapsed: true });

  // Scattered scenery. The GLBs are authored at wildly different sizes, so each
  // family gets its own base scale.
  const propControls = useControls("Props", {
    tree1Scale: { value: 1, min: 0.1, max: 3, step: 0.05 },
    tree1Count: { value: 50, min: 0, max: 200, step: 1 },

    miniSceneScale: { value: 1, min: 0.1, max: 3, step: 0.05 },
    miniSceneCount: { value: 48, min: 0, max: 200, step: 1 },
    miniScene004Scale: { value: 1, min: 0.1, max: 5, step: 0.05 },
    miniScene004Position: { value: [-90, 0, 70] as [number, number, number], step: 1 },

    cactusScale: { value: 0.45, min: 0.05, max: 2, step: 0.05 },
    cactusCount: { value: 60, min: 0, max: 200, step: 1 },

    groundRockScale: { value: 0.2, min: 0.02, max: 3, step: 0.01 },
    groundRockCount: { value: 720, min: 0, max: 1500, step: 1 },
    rockSceneScale: { value: 1, min: 0.1, max: 5, step: 0.05 },
    rockScenePosition: { value: [-55, 0, -20] as [number, number, number], step: 1 },
  }, { collapsed: true });

  // Brightness cutoffs that pick which hatch texture (h0=sparse..h5=dense) to
  // sample in the crosshatch post-process pass. Each threshold is the lower
  // bound of brightness for the tier above it — e.g. below threshold1 but
  // above threshold2 uses h1.
  const hatchingControls = useControls("Hatching", {
    threshold0: { value: 0.56, min: 0, max: 1, step: 0.01, label: "none / h0" },
    threshold1: { value: 0.37, min: 0, max: 1, step: 0.01, label: "h0 / h1" },
    threshold2: { value: 0.31, min: 0, max: 1, step: 0.01, label: "h1 / h2" },
    threshold3: { value: 0.2, min: 0, max: 1, step: 0.01, label: "h2 / h3" },
    threshold4: { value: 0.17, min: 0, max: 1, step: 0.01, label: "h3 / h4" },
    threshold5: { value: 0.11, min: 0, max: 1, step: 0.01, label: "h4 / h5" },
    threshold6: { value: 0.05, min: 0, max: 1, step: 0.01, label: "h5 / h6" },
  }, { collapsed: true });

  return {
    lighting: lightingControls,
    spotlight: spotlightControls,
    player: playerControls,
    skeletonScene: skeletonSceneControls,
    vultureScene: vultureSceneControls,
    props: propControls,
    hatching: hatchingControls,
  };
};
