import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const digitColors = [
  '#1a1a1a', // 0: Dark Grey
  '#ffffff', // 1: White
  '#ff2a2a', // 2: Red
  '#ff7f00', // 3: Orange
  '#ffd700', // 4: Yellow
  '#00ff00', // 5: Green
  '#00ffff', // 6: Cyan
  '#007fff', // 7: Blue
  '#7f00ff', // 8: Purple
  '#ff00ff', // 9: Magenta
];

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uTexture;
  uniform sampler2D uPalette;
  uniform float uGridSize;
  uniform float uTime;
  
  varying vec2 vUv;

  void main() {
    // Determine the grid cell
    vec2 gridUv = floor(vUv * uGridSize) / uGridSize;
    
    // Sample the texture at the grid cell
    vec4 texColor = texture2D(uTexture, gridUv);
    
    // The digit is stored in the red channel (0.0 to 1.0)
    float digitFloat = texColor.r * 255.0;
    int digit = int(floor(digitFloat + 0.5));
    
    // If it's a padding cell (value 255), make it metallic dark
    if (digit > 9) {
      gl_FragColor = vec4(0.05, 0.05, 0.05, 1.0);
      return;
    }
    
    // Sample the palette texture (10 pixels wide)
    // Add 0.5 to sample the center of the pixel
    float paletteUv = (float(digit) + 0.5) / 10.0;
    vec4 color = texture2D(uPalette, vec2(paletteUv, 0.5));
    
    // Create a slight border/gap effect
    vec2 cellUv = fract(vUv * uGridSize);
    float border = 0.05;
    if (cellUv.x < border || cellUv.x > 1.0 - border || cellUv.y < border || cellUv.y > 1.0 - border) {
      color.rgb *= 0.2; // Darken the border
    }
    
    // Add a subtle glowing pulse based on the digit and time
    float pulse = sin(uTime * 2.0 + float(digit)) * 0.1 + 0.9;
    color.rgb *= pulse;
    
    gl_FragColor = color;
  }
`;

export default function PiPlate({ piString }: { piString: string }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  
  const { texture, paletteTexture, gridSize } = useMemo(() => {
    const numDigits = piString.length;
    const size = Math.ceil(Math.sqrt(numDigits));
    const data = new Uint8Array(size * size * 4);
    
    for (let i = 0; i < size * size; i++) {
      const stride = i * 4;
      if (i < numDigits) {
        const digit = parseInt(piString[i], 10);
        data[stride] = digit;     // R
        data[stride + 1] = digit; // G
        data[stride + 2] = digit; // B
        data[stride + 3] = 255;   // A
      } else {
        // Padding
        data[stride] = 255;
        data[stride + 1] = 255;
        data[stride + 2] = 255;
        data[stride + 3] = 255;
      }
    }
    
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.needsUpdate = true;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    
    // Create palette texture
    const paletteData = new Uint8Array(10 * 4);
    digitColors.forEach((hex, i) => {
      const color = new THREE.Color(hex);
      paletteData[i * 4] = Math.round(color.r * 255);
      paletteData[i * 4 + 1] = Math.round(color.g * 255);
      paletteData[i * 4 + 2] = Math.round(color.b * 255);
      paletteData[i * 4 + 3] = 255;
    });
    const palTex = new THREE.DataTexture(paletteData, 10, 1, THREE.RGBAFormat);
    palTex.needsUpdate = true;
    palTex.magFilter = THREE.NearestFilter;
    palTex.minFilter = THREE.NearestFilter;
    
    return { texture: tex, paletteTexture: palTex, gridSize: size };
  }, [piString]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <group>
      {/* The metallic base plate */}
      <mesh position={[0, -0.1, 0]} receiveShadow castShadow>
        <boxGeometry args={[10.2, 0.2, 10.2]} />
        <meshStandardMaterial color="#111" metalness={0.9} roughness={0.2} />
      </mesh>
      
      {/* The visualization surface */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 10]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={{
            uTexture: { value: texture },
            uPalette: { value: paletteTexture },
            uGridSize: { value: gridSize },
            uTime: { value: 0 },
          }}
        />
      </mesh>
    </group>
  );
}
