"use client";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useRef } from "react";
import { playerPosition } from "./Player";

const CHUNK_SIZE = 200;
const CHUNK_COUNT = 9;

const floorVertexShader = /* glsl */ `
  uniform float uTime;
  varying float height;
  uniform vec2 uOffset;
  uniform float uRotation;
  uniform vec2 uChunkOffset;

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
    vec2 worldPos = vec2(position.x, -position.y) + uChunkOffset;

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
    gl_FragColor = vec4(0.1, height, 0.01, height+0.1);
  }
`;

function getChunkPositions(pos: THREE.Vector3) {
  const chunks: { chunkX: number; chunkZ: number }[] = [];
  const currentChunkX = Math.floor(pos.x / CHUNK_SIZE)
  const currentChunkZ = Math.floor(pos.z / CHUNK_SIZE)

  for (let cx = -1; cx <= 1; cx++) {
    for (let cz = -1; cz <= 1; cz++) {
      chunks.push({
        chunkX: (currentChunkX + cx) * CHUNK_SIZE,
        chunkZ: (currentChunkZ + cz) * CHUNK_SIZE
      })
    }
  }
  return chunks
}

export function TestFloor() {
  const meshRefs = useRef<(THREE.Mesh | null)[]>(Array.from({ length: CHUNK_COUNT }, () => null));
  const shaderRefs = useRef<(THREE.ShaderMaterial | null)[]>(
    Array.from({ length: CHUNK_COUNT }, () => null)
  );

  useFrame(({ clock }) => {
    const chunkPositions = getChunkPositions(playerPosition);

    meshRefs.current.forEach((mesh, i) => {
      if (mesh) {
        const pos = chunkPositions[i];
        // mesh.position.set(pos.chunkX, 0, pos.chunkZ);
        mesh.position.x = pos.chunkX;
        mesh.position.y = 0;
        mesh.position.z = pos.chunkZ;
        shaderRefs.current[i]!.uniforms.uChunkOffset.value.set(pos.chunkX, pos.chunkZ);
      }
    });

    shaderRefs.current.forEach((shader) => {
      if (shader) {
        shader.uniforms.uTime.value = clock.elapsedTime;
      }
    });
  });

  return (
    <>
      {Array.from({ length: CHUNK_COUNT }, (_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
        >
          <planeGeometry args={[200, 200, 100, 100]} />
          <shaderMaterial
            ref={(el) => {
              shaderRefs.current[i] = el;
            }}
            vertexShader={floorVertexShader}
            fragmentShader={floorFragmentShader}
            side={THREE.DoubleSide}
            wireframe
            uniforms={{
              uTime: new THREE.Uniform(0),
              uChunkOffset: new THREE.Uniform(new THREE.Vector2(0, 0)),

            }}
          />
        </mesh>
      ))}
    </>
  );
}
