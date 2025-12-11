import { useRef, useEffect, useState } from 'react';
import { Group, BackSide, VideoTexture, Mesh, LinearFilter, Material } from 'three';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';

interface StickFigureProps {
  position: [number, number, number];
  rotation?: number;
  color?: string;
  videoElementId?: string;
  name?: string;
}


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

const VideoHead = ({ position, radius, color, videoElementId }: { position: [number, number, number]; radius: number; color: string; videoElementId?: string }) => {
  const meshRef = useRef<Mesh>(null);
  const [videoTexture, setVideoTexture] = useState<VideoTexture | null>(null);
  const textureRef = useRef<VideoTexture | null>(null);

  useEffect(() => {
    if (!videoElementId) {
      console.log('No videoElementId provided');
      return;
    }

    console.log(`Setting up video texture for: ${videoElementId}`);

    const setupTexture = () => {
      const videoElement = document.getElementById(videoElementId) as HTMLVideoElement;
      
      if (!videoElement) {
        console.log(`Video element not found: ${videoElementId}`);
        return false;
      }

      console.log(`Video element found:`, {
        id: videoElementId,
        readyState: videoElement.readyState,
        videoWidth: videoElement.videoWidth,
        videoHeight: videoElement.videoHeight,
        srcObject: videoElement.srcObject,
      });

      if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
        console.log(`Creating video texture for ${videoElementId}`);
        
        // Dispose old texture if it exists
        if (textureRef.current) {
          textureRef.current.dispose();
        }
        
        const texture = new VideoTexture(videoElement);
        texture.minFilter = LinearFilter;
        texture.magFilter = LinearFilter;
        texture.format = 1023; // RGBAFormat
        texture.needsUpdate = true;
        
        textureRef.current = texture;
        setVideoTexture(texture);
        
        console.log(`Video texture created successfully for ${videoElementId}`, {
          texture,
          image: texture.image,
          needsUpdate: texture.needsUpdate
        });
        return true;
      }
      
      return false;
    };

    // Try immediately
    if (setupTexture()) return;

    // Poll for video readiness
    const checkVideo = setInterval(() => {
      if (setupTexture()) {
        clearInterval(checkVideo);
      }
    }, 300);

    // Also listen for video events
    const videoElement = document.getElementById(videoElementId) as HTMLVideoElement;
    if (videoElement) {
      const handleLoadedData = () => {
        console.log(`Video loadeddata event for ${videoElementId}`);
        setupTexture();
      };
      
      const handleCanPlay = () => {
        console.log(`Video canplay event for ${videoElementId}`);
        setupTexture();
      };

      videoElement.addEventListener('loadeddata', handleLoadedData);
      videoElement.addEventListener('canplay', handleCanPlay);

      return () => {
        clearInterval(checkVideo);
        videoElement.removeEventListener('loadeddata', handleLoadedData);
        videoElement.removeEventListener('canplay', handleCanPlay);
        if (textureRef.current) {
          textureRef.current.dispose();
        }
      };
    }

    return () => {
      clearInterval(checkVideo);
      if (textureRef.current) {
        textureRef.current.dispose();
      }
    };
  }, [videoElementId]);

  useFrame(() => {
    if (textureRef.current) {
      textureRef.current.needsUpdate = true;
    }
    
    // Force material update
    if (meshRef.current && videoTexture) {
      const material = meshRef.current.material;
      if (material && !Array.isArray(material)) {
        const singleMaterial = material as Material;
        if ('map' in singleMaterial && singleMaterial.map) {
          singleMaterial.needsUpdate = true;
        }
      }
    }
  });

  return (
    <group position={position}>
      {/* Outline */}
      <mesh scale={1.08}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial color="#ffffff" side={BackSide} />
      </mesh>
      {/* Head with video or color - rotated -90 degrees to face table */}
      <mesh ref={meshRef} rotation={[0, -Math.PI / 2, 0]}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial 
          key={videoTexture ? `video-${videoElementId}` : `color-${color}`}
          color={videoTexture ? undefined : color}
          toneMapped={false}
        >
          {videoTexture && <primitive object={videoTexture} attach="map" />}
        </meshBasicMaterial>
      </mesh>
    </group>
  );
};

const StickFigure = ({ position, rotation = 0, color = "#ffffff", videoElementId, name }: StickFigureProps) => {
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
      {/* Floating Name Label */}
      {name && (
        <group position={[0, 1.7, 0]}>
          {/* Background */}
          <mesh>
            <planeGeometry args={[1.5, 0.3]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.7} />
          </mesh>
          {/* Text */}
          <Text
            position={[0, 0, 0.01]}
            fontSize={0.15}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            {name}
          </Text>
        </group>
      )}

      {/* Head with video texture */}
      <VideoHead position={[0, 1.25, 0]} radius={0.28} color={color} videoElementId={videoElementId} />

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