import { useRef } from 'react';
import { Mesh } from 'three';
import { useFrame } from '@react-three/fiber';

const CouncilTable = () => {
  const ringRef = useRef<Mesh>(null);

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 0.05;
    }
  });

  return (
    <group position={[0, 0.3, 0]}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <torusGeometry args={[0.9, 0.025, 16, 64]} />
        <meshBasicMaterial color="#3b82f6" />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <torusGeometry args={[0.6, 0.015, 16, 64]} />
        <meshBasicMaterial color="#1e40af" transparent opacity={0.7} />
      </mesh>

      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.25, 0.35, 0.3, 16]} />
        <meshStandardMaterial 
          color="#0a0a0c"
          roughness={0.5}
          metalness={0.7}
        />
      </mesh>

      <mesh position={[0, -0.29, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.34, 0.01, 8, 32]} />
        <meshBasicMaterial color="#1e40af" />
      </mesh>
    </group>
  );
};

export default CouncilTable;
