"use client";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useRef } from "react";
import { playerPosition, y, z } from "./Player";

const floorVertexShader = /* glsl */ `
uniform float uTime;
varying float height;
uniform vec2 uOffset;
uniform float uRotation;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 44758.2378);
}

vec2 hash2(vec2 p) {
    float angle = hash(p) * 6.2831853;
    return vec2(cos(angle), sin(angle));
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);

  float gridA = dot(hash2(i), f);
  float gridB = dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float gridC = dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float gridD = dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));

  float mixBottomEdge = mix(gridA, gridB, fract(p.x));
  float mixTopEdge = mix(gridC, gridD, fract(p.x));
  return mix(mixBottomEdge, mixTopEdge, fract(p.y));
}

float fbm(vec2 p) {
    float frequency = 1.0; 
    float amplitude = 0.5; 
    float value = 0.0;
    for(int i  = 0; i < 20; i++) {
        value += noise(p * frequency) * amplitude; 
        frequency *= 2.0; 
        amplitude *= 0.5;
    }
    return value;
}

mat2 rotate2D(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}

  void main() {
    vec2 rotatedPos = rotate2D(uRotation) * position.xy;
    vec2 worldPos = rotatedPos + uOffset;
    float regional = fbm(worldPos * 0.001);
    float detail = fbm(worldPos * 0.008);
    float h = regional * detail * 300.0;
    vec3 newPosition = vec3(position.xy, h);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    height = (newPosition.z + 10.0) / 20.0 * 0.8 + 0.05;
  }
`;

const floorFragmentShader = /* glsl */ `
varying float height;
uniform float uTime;
void main() {
  float r = height;
  // gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
  gl_FragColor = vec4(0.1, height, 0.01, height+0.1);
}
`;

export function Floor() {
  const shaderRef = useRef<THREE.ShaderMaterial | null>(null);
  const planeRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (shaderRef.current && planeRef.current) {
      shaderRef.current.uniforms.uTime.value = clock.elapsedTime;

      planeRef.current.position.x = -playerPosition.x;
      planeRef.current.position.z = -playerPosition.z;

      // shaderRef.current.uniforms.uOffset.value.x = playerPosition.x;
      // shaderRef.current.uniforms.uOffset.value.y = playerPosition.z;

      const angle = Math.atan2(z.x, z.z);
      shaderRef.current.uniforms.uRotation.value = angle;
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} ref={planeRef}>
      <planeGeometry args={[1000, 1000, 550, 550]} />
      <shaderMaterial
        ref={shaderRef}
        vertexShader={floorVertexShader}
        fragmentShader={floorFragmentShader}
        side={THREE.DoubleSide}
        // wireframe
        uniforms={{
          uTime: new THREE.Uniform(0),
          uOffset: new THREE.Uniform(new THREE.Vector2(0, 0)),
          uRotation: new THREE.Uniform(0)
        }}
      />
    </mesh>
  );
}
