"use client";

import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Text } from '@react-three/drei';
import { Points, BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import StickFigure from './stick-figure';
import CouncilTable from './council-table';

const figureColors = [
  '#ff4444',
  '#4488ff',
  '#44ff88',
  '#ffcc00',
  '#ff44ff',
];

const Particles = ({ count = 500 }) => {
  const pointsRef = useRef<Points>(null);
  
  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 15;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    return geometry;
  }, [count]);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.02;
    }
  });

  return (
    <points ref={pointsRef} geometry={particles}>
      <pointsMaterial
        size={0.02}
        color="#ffffff"
        transparent
        opacity={0.4}
        sizeAttenuation
      />
    </points>
  );
};

const HoverArrow = ({ position }: { position: [number, number, number] }) => {
  const groupRef = useRef<any>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 3) * 0.05;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.05, 0.12, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.06, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
};

interface CameraControllerProps {
  focusIndex: number | null;
  figures: Array<{ position: [number, number, number]; rotation: number; color: string }>;
}

const CameraController = ({ focusIndex, figures }: CameraControllerProps) => {
  const { camera } = useThree();
  const targetPosition = useRef(new Vector3(0, 2.7, 4.5));
  const targetLookAt = useRef(new Vector3(0, 0.5, 0));
  
  useEffect(() => {
    if (focusIndex !== null && focusIndex < figures.length && figures[focusIndex]) {
      const fig = figures[focusIndex];
      const headY = fig.position[1] + 0.5;
      const distance = 1.2;
      const angle = fig.rotation;
      const camX = fig.position[0] + Math.sin(angle) * distance;
      const camZ = fig.position[2] + Math.cos(angle) * distance;
      
      targetPosition.current.set(camX, headY, camZ);
      targetLookAt.current.set(fig.position[0], headY, fig.position[2]);
    } else {
      targetPosition.current.set(0, 2.7, 4.5);
      targetLookAt.current.set(0, 0.5, 0);
    }
  }, [focusIndex, figures]);

  useFrame(() => {
    if (focusIndex !== null) {
      camera.position.lerp(targetPosition.current, 0.03);
      camera.lookAt(targetLookAt.current);
    }
  });

  return null;
};

const CameraBreathing = ({ enabled }: { enabled: boolean }) => {
  const baseY = useRef(2.7);
  
  useFrame((state) => {
    if (enabled) {
      const breathe = Math.sin(state.clock.elapsedTime * 0.4) * 0.3;
      state.camera.position.y = baseY.current + breathe;
    }
  });
  
  return null;
};

interface CircleSceneProps {
  focusIndex: number | null;
  arrowIndex: number | null;
  figureCount?: number;
  figureColors?: string[];
  videoElementIds?: string[];
  figureNames?: string[];
}

const CircleScene = ({ focusIndex = null, arrowIndex = null, figureCount = 5, figureColors: customColors, videoElementIds = [], figureNames = [] }: CircleSceneProps) => {
  const circleRadius = 1.1;
  const colors = customColors || figureColors;
  
  const figures = useMemo(() => Array.from({ length: figureCount }, (_, i) => {
    const angle = (i / figureCount) * Math.PI * 2 - Math.PI / 2;
    
    const x = Math.cos(angle) * circleRadius;
    const z = Math.sin(angle) * circleRadius;
    
    const figureRotation = Math.atan2(-x, -z);
    
    return {
      position: [x, 0, z] as [number, number, number],
      rotation: figureRotation,
      color: colors[i] || colors[0],
      videoElementId: videoElementIds[i],
      name: figureNames[i],
    };
  }), [figureCount, colors, videoElementIds, figureNames]);

  const isFocused = focusIndex !== null;

  return (
    <Canvas
      shadows
      className="scene-container absolute inset-0 h-full w-full"
      style={{ background: 'transparent' }}
    >
      <PerspectiveCamera
        makeDefault
        position={[0, 2.7, 4.5]}
        fov={50}
        near={0.1}
        far={100}
      />

      <CameraController focusIndex={focusIndex} figures={figures} />
      <CameraBreathing enabled={!isFocused} />

      <ambientLight intensity={0.15} color="#404060" />

      <Particles count={400} />

      <CouncilTable />

      {figures.map((figure, index) => (
        <group key={index}>
          <StickFigure
            position={figure.position}
            rotation={figure.rotation}
            color={figure.color}
            videoElementId={figure.videoElementId}
            name={figure.name}
          />
          {arrowIndex === index && (
            <HoverArrow position={[figure.position[0], figure.position[1] + 0.85, figure.position[2]]} />
          )}
        </group>
      ))}

      <fog attach="fog" args={['#020204', 8, 25]} />

      {!isFocused && (
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          autoRotate
          autoRotateSpeed={0.5}
          minDistance={3}
          maxDistance={12}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.2}
          target={[0, 0.5, 0]}
          zoomSpeed={0.3}
          enableDamping
          dampingFactor={0.05}
        />
      )}
    </Canvas>
  );
};

export default CircleScene;
