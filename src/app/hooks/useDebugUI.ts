import { useControls } from "leva";

export const useDebugUI = () => {
  const lightingControls = useControls("Lighting", {
    ambientIntensity: { value: 5.3, min: 0, max: 20, step: 0.1 },
    directionalIntensity: { value: 0.8, min: 0, max: 10, step: 0.1 },
    directionalPosition: { value: [0, 10, 8], step: 0.5 },
    directionalColor: "#ffffff",
    pointIntensity: { value: 8, min: 0, max: 20, step: 0.1 },
    pointPosition: { value: [-3.38, 3.25, 0.69], step: 0.01 },
    pointColor: "#ef0707",
    showHelpers: true,
  });

  const modelControls = useControls("Model", {
    position: { value: [0, 0, 0], step: 0.1 },
    scale: { value: [1, 1, 1], min: 0.1, max: 3, step: 0.1 },
    rotation: { value: [0, 0, 0], step: 0.1 },
    autoRotate: false,
    rotationSpeed: { value: 0.005, min: 0, max: 0.02, step: 0.001 },
  });

  return {
    lighting: lightingControls,
    model: modelControls,
  };
};
