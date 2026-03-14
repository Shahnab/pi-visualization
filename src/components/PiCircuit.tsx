import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Grid, RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';

const digitTexture = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = 4096;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'transparent';
    ctx.fillRect(0, 0, 4096, 512);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 360px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 10; i++) {
      ctx.fillText(i.toString(), i * 409.6 + 204.8, 256);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
})();

const piShaderMaterial = new THREE.ShaderMaterial({
  uniforms: {
    digitMap: { value: digitTexture },
    uTime: { value: 0 }
  },
  vertexShader: `
    attribute vec2 instanceUVOffset;
    attribute float instanceOpacity;
    attribute vec3 instanceColor;
    
    varying vec2 vUv;
    varying float vOpacity;
    varying vec3 vColor;
    varying vec3 vInstancePos;
    
    void main() {
      vUv = uv * vec2(0.1, 1.0) + instanceUVOffset;
      vOpacity = instanceOpacity;
      vColor = instanceColor;
      vInstancePos = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      
      vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform sampler2D digitMap;
    
    varying vec2 vUv;
    varying float vOpacity;
    varying vec3 vColor;
    varying vec3 vInstancePos;
    
    void main() {
      vec4 texColor = texture2D(digitMap, vUv);
      if (texColor.a < 0.1) discard;
      
      // Clean, static 3D depth shading - significantly dimmed for legibility at high density
      float depth = (vInstancePos.z + 0.75) / 1.5; 
      vec3 baseColor = vColor * texColor.rgb;
      // Use a much lower multiplier to prevent "white-out" in dense areas
      vec3 finalColor = baseColor * (0.5 + depth * 0.5); 
      
      gl_FragColor = vec4(finalColor, texColor.a * vOpacity);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.NormalBlending,
});

const getPiPoints = (numPoints: number) => {
  const canvas = document.createElement('canvas');
  const size = 1024; 
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'white';
  ctx.font = `bold ${size * 0.9}px "Times New Roman", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('π', size / 2, size / 2);
  
  const imageData = ctx.getImageData(0, 0, size, size).data;
  const validPixels = [];
  
  // Collect all valid pixels
  for (let y = 0; y < size; y += 2) {
    for (let x = 0; x < size; x += 2) {
      const i = (y * size + x) * 4;
      if (imageData[i] > 128) {
        validPixels.push({ x, y });
      }
    }
  }
  
  if (validPixels.length === 0) return [];

  // Sort pixels for sequential arrangement (top-to-bottom, left-to-right)
  validPixels.sort((a, b) => a.y - b.y || a.x - b.x);

  const points = [];
  const scaleFactor = 18; 
  
  for (let i = 0; i < numPoints; i++) {
    // Map digit index to pixel index sequentially
    const pixelIndex = Math.floor((i / numPoints) * validPixels.length);
    const pixel = validPixels[pixelIndex];
    
    // Add micro-jitter to avoid perfect overlap when many digits map to same pixel
    const jitterX = (Math.random() - 0.5) * 0.4;
    const jitterY = (Math.random() - 0.5) * 0.4;
    
    const px = ((pixel.x + jitterX) - size / 2) / size * scaleFactor;
    const py = -((pixel.y + jitterY) - size / 2) / size * scaleFactor;
    
    // Slight Z variation based on sequence to add depth
    const pz = (Math.random() - 0.5) * 0.2 + (i / numPoints) * 0.1;
    
    points.push(new THREE.Vector3(px, py, pz));
  }
  
  return points;
};

export default function PiCircuit({ piString, onPlotProgress }: { piString: string, onPlotProgress: (progress: number) => void }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const targetCountRef = useRef(0);
  const currentCountRef = useRef(0);
  
  const { points, uvOffsets, colors } = useMemo(() => {
    if (!piString) return { points: [], uvOffsets: new Float32Array(0), colors: new Float32Array(0) };
    
    // Optimization: If the string is massive (e.g. 100M digits), don't process the whole thing.
    // We only visualize up to 1,000,000 digits anyway.
    const maxVisualize = 1000000;
    const truncatedPi = piString.length > maxVisualize + 1000 
      ? piString.slice(0, maxVisualize + 1000) 
      : piString;

    // Filter out non-digits (like the decimal point) for the 3D visualization
    const digitsOnly = truncatedPi.replace(/[^0-9]/g, '');
    const numDigits = Math.min(digitsOnly.length, maxVisualize);
    
    const pts = getPiPoints(numDigits);
    const uvs = new Float32Array(numDigits * 2);
    const cols = new Float32Array(numDigits * 3);

    const orangeColor = new THREE.Color(0xff8822); // Slightly warmer orange/amber

    for (let i = 0; i < numDigits; i++) {
      const digit = parseInt(digitsOnly[i], 10);
      
      uvs[i * 2] = digit * 0.1;
      uvs[i * 2 + 1] = 0;
      
      cols[i * 3] = orangeColor.r;
      cols[i * 3 + 1] = orangeColor.g;
      cols[i * 3 + 2] = orangeColor.b;
    }
    
    return { points: pts, uvOffsets: uvs, colors: cols };
  }, [piString]);

  useEffect(() => {
    if (!meshRef.current || points.length === 0) return;
    
    const mesh = meshRef.current;
    const dummy = new THREE.Object3D();
    
    // Improved scaling: larger digits for lower counts to match the "clean" look
    const scale = Math.max(0.04, 4.5 / Math.sqrt(points.length + 50));
    
    for (let i = 0; i < points.length; i++) {
      dummy.position.copy(points[i]);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    
    mesh.instanceMatrix.needsUpdate = true;
    
    mesh.geometry.setAttribute('instanceUVOffset', new THREE.InstancedBufferAttribute(uvOffsets, 2));
    mesh.geometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(colors, 3));
    
    const opacities = new Float32Array(points.length).fill(0);
    mesh.geometry.setAttribute('instanceOpacity', new THREE.InstancedBufferAttribute(opacities, 1));
    
    currentCountRef.current = 0;
    targetCountRef.current = points.length;
  }, [points, uvOffsets, colors]);

  useFrame((state, delta) => {
    if (!meshRef.current || targetCountRef.current === 0) return;
    
    const mesh = meshRef.current;
    const opacities = mesh.geometry.attributes.instanceOpacity.array as Float32Array;
    
    // Reveal speed: finish in ~3 seconds, but cap for performance
    const speed = Math.max(20, Math.min(targetCountRef.current * delta * 0.33, 5000)); 
    
    if (currentCountRef.current < targetCountRef.current) {
      const start = Math.floor(currentCountRef.current);
      const nextCount = Math.min(currentCountRef.current + speed, targetCountRef.current);
      const end = Math.floor(nextCount);
      
      for (let i = start; i < end; i++) {
        opacities[i] = 1.0;
      }
      
      currentCountRef.current = nextCount;
      onPlotProgress(currentCountRef.current / targetCountRef.current);
      mesh.geometry.attributes.instanceOpacity.needsUpdate = true;
    }
  });

  return (
    <group rotation={[-0.02, 0.05, 0]}> {/* Very subtle dynamic tilt */}
      {points.length > 0 && (
        <instancedMesh ref={meshRef} args={[undefined as any, piShaderMaterial, points.length]} position={[0, -0.5, -0.5]}>
          <planeGeometry args={[1, 1]} />
        </instancedMesh>
      )}
    </group>
  );
}
