import { useRef } from 'react';
import { Group, BackSide } from 'three';
import { useFrame } from '@react-three/fiber';

interface StickFigureProps {
  position: [number, number, number];
  rotation?: number;
  color?: string;
}

const OutlinedSphere = ({ position, radius, color }: { position: [number, number, number]; radius: number; color: string }) => (
  <group position={position}>
    <mesh scale={1.08}>
      <sphereGeometry args={[radius, 16, 16]} />
      <meshBasicMaterial color="#ffffff" side={BackSide} />
    </mesh>
    <mesh>
      <sphereGeometry args={[radius, 16, 16]} />
      <meshBasicMaterial color={color} />
    </mesh>
  </group>
);

const OutlinedCapsule = ({ position, radius, length, color }: { position: [number, number, number]; radius: number; length: number; color: string }) => (
  <group position={position}>
    <mesh scale={1.15}>
      <capsuleGeometry args={[radius, length, 4, 8]} />
      <meshBasicMaterial color="#ffffff" side={BackSide} />
    </mesh>
    <mesh>
      <capsuleGeometry args={[radius, length, 4, 8]} />
      <meshBasicMaterial color={color} />
    </mesh>
  </group>
);

const StickFigure = ({ position, rotation = 0, color = "#ffffff" }: StickFigureProps) => {
  const groupRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.8 + rotation) * 0.01;
    }
    
    const swing = (Math.sin(state.clock.elapsedTime * 1.2 + rotation) + 1) * 0.15;
    
    if (leftArmRef.current) {
      leftArmRef.current.rotation.z = -swing;
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.z = swing;
    }
  });

  const scale = 0.4;

  return (
    <group ref={groupRef} position={position} rotation={[0, rotation, 0]} scale={scale}>
      {/* Head */}
      <OutlinedSphere position={[0, 1.25, 0]} radius={0.28} color={color} />

      {/* Body */}
      <OutlinedCapsule position={[0, 0.75, 0]} radius={0.12} length={0.22} color={color} />

      {/* Left arm */}
      <group ref={leftArmRef} position={[-0.18, 0.88, 0]}>
        <OutlinedCapsule position={[0, -0.18, 0]} radius={0.04} length={0.35} color={color} />
      </group>

      {/* Right arm */}
      <group ref={rightArmRef} position={[0.18, 0.88, 0]}>
        <OutlinedCapsule position={[0, -0.18, 0]} radius={0.04} length={0.35} color={color} />
      </group>

      {/* Left leg */}
      <OutlinedCapsule position={[-0.08, 0.3, 0]} radius={0.05} length={0.4} color={color} />

      {/* Right leg */}
      <OutlinedCapsule position={[0.08, 0.3, 0]} radius={0.05} length={0.4} color={color} />
    </group>
  );
};

export default StickFigure;