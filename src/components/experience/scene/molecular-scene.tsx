"use client";

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Float, Lightformer } from "@react-three/drei";
import * as THREE from "three";

function DnaHelix() {
  const group = useRef<THREE.Group>(null);
  const rungs = useMemo(() => {
    const items: { y: number; angle: number }[] = [];
    for (let i = 0; i < 26; i++) {
      items.push({ y: (i - 13) * 0.24, angle: i * 0.42 });
    }
    return items;
  }, []);

  useFrame((state) => {
    if (group.current) group.current.rotation.y = state.clock.elapsedTime * 0.28;
  });

  const strand = new THREE.MeshStandardMaterial({
    color: "#c9c9c9",
    roughness: 0.25,
    metalness: 0.7
  });
  const rung = new THREE.MeshStandardMaterial({
    color: "#a9c9de",
    roughness: 0.3,
    metalness: 0.2
  });

  return (
    <group ref={group} position={[0, 0, 0]} rotation={[0, 0, 0.18]} scale={0.92}>
      {rungs.map(({ y, angle }, i) => {
        const x1 = Math.cos(angle) * 0.95;
        const z1 = Math.sin(angle) * 0.95;
        const x2 = Math.cos(angle + Math.PI) * 0.95;
        const z2 = Math.sin(angle + Math.PI) * 0.95;
        return (
          <group key={i}>
            <mesh position={[x1, y, z1]} material={strand}>
              <sphereGeometry args={[0.085, 20, 20]} />
            </mesh>
            <mesh position={[x2, y, z2]} material={strand}>
              <sphereGeometry args={[0.085, 20, 20]} />
            </mesh>
            <mesh position={[0, y, 0]} rotation={[0, angle, Math.PI / 2]} material={rung}>
              <cylinderGeometry args={[0.018, 0.018, 1.9, 8]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function GlassMolecules() {
  const group = useRef<THREE.Group>(null);
  const seeds = useMemo(
    () =>
      Array.from({ length: 7 }, () => ({
        position: [
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 4.4,
          (Math.random() - 0.5) * 2.5
        ] as [number, number, number],
        scale: 0.32 + Math.random() * 0.4,
        speed: 0.4 + Math.random() * 0.6
      })),
    []
  );

  const glass = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        transmission: 0.9,
        thickness: 0.6,
        roughness: 0.06,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
        ior: 1.35,
        transparent: true,
        opacity: 0.92
      }),
    []
  );

  useFrame((state) => {
    if (!group.current) return;
    group.current.children.forEach((child, i) => {
      child.position.y += Math.sin(state.clock.elapsedTime * seeds[i].speed + i) * 0.0016;
      child.rotation.x += 0.002;
      child.rotation.y += 0.003;
    });
  });

  return (
    <group ref={group}>
      {seeds.map((seed, i) => (
        <mesh key={i} position={seed.position} scale={seed.scale} material={glass}>
          <icosahedronGeometry args={[1, 1]} />
        </mesh>
      ))}
    </group>
  );
}

function Particles() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 320;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < arr.length; i++) arr[i] = (Math.random() - 0.5) * 22;
    return arr;
  }, []);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.03;
      ref.current.rotation.x = state.clock.elapsedTime * 0.012;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.035} color="#6fa8ce" transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

function Rig() {
  const { camera, pointer } = useThree();
  const target = useRef(new THREE.Vector2());
  useFrame(() => {
    target.current.lerp(pointer, 0.04);
    camera.position.x = target.current.x * 0.9;
    camera.position.y = target.current.y * 0.6;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/** The floating molecular apparatus behind the hero — glass, DNA, dust. */
export default function MolecularScene() {
  return (
    <Canvas
      className="h-full w-full"
      dpr={[1, 1.8]}
      camera={{ position: [0, 0, 9], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 6, 5]} intensity={1.1} />
      <pointLight position={[-4, 2, 4]} intensity={1.2} color="#a9c9de" />
      <pointLight position={[3, -2, 3]} intensity={0.6} color="#d1b88c" />

      <Suspense fallback={null}>
        <Float speed={1.1} rotationIntensity={0.3} floatIntensity={0.6}>
          <DnaHelix />
        </Float>
        <GlassMolecules />
        <Particles />
        <Rig />
        {/* Local, network-free studio environment for glass reflections. */}
        <Environment resolution={256}>
          <Lightformer intensity={2.4} position={[0, 3, 4]} scale={[8, 3, 1]} color="#ffffff" />
          <Lightformer intensity={1.2} position={[-4, 1, 2]} scale={[3, 3, 1]} color="#a9c9de" />
          <Lightformer intensity={0.9} position={[4, -1, 2]} scale={[3, 3, 1]} color="#d1b88c" />
        </Environment>
      </Suspense>
    </Canvas>
  );
}
