import { useState, useEffect, Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Loader2, Settings2, Info, Activity, Monitor } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PiCircuit from './components/PiCircuit';
import VirtualizedDigits from './components/VirtualizedDigits';
import PiWorker from './workers/piWorker?worker';

const DIGIT_OPTIONS = [100, 1000, 10000, 100000, 1000000, 10000000, 100000000];

function FPSCounter() {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let frames = 0;
    let lastTime = performance.now();
    let animationFrameId: number;

    const update = () => {
      frames++;
      const now = performance.now();
      if (now >= lastTime + 1000) {
        setFps(Math.round((frames * 1000) / (now - lastTime)));
        frames = 0;
        lastTime = now;
      }
      animationFrameId = requestAnimationFrame(update);
    };

    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-2 text-[10px] text-neutral-500 uppercase tracking-[0.2em] font-medium mb-2 ml-1"
    >
      <div className={`w-1.5 h-1.5 rounded-full ${fps > 30 ? 'bg-emerald-500' : 'bg-orange-500'} animate-pulse`} />
      <span>{fps} FPS</span>
    </motion.div>
  );
}

export default function App() {
  const [digits, setDigits] = useState<number>(100);
  const [piString, setPiString] = useState<string>('');
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [calcProgress, setCalcProgress] = useState<number>(0);
  const [calcTime, setCalcTime] = useState<number | null>(null);
  const [plotProgress, setPlotProgress] = useState<number>(0);

  useEffect(() => {
    setIsCalculating(true);
    setCalcProgress(0);
    setCalcTime(null);
    setPlotProgress(0);
    const startTime = performance.now();
    const worker = new PiWorker();
    
    worker.onmessage = (e) => {
      if (e.data.type === 'progress') {
        setCalcProgress(e.data.progress);
      } else if (e.data.type === 'complete') {
        setPiString(e.data.piString);
        setCalcTime(performance.now() - startTime);
        setIsCalculating(false);
        setCalcProgress(1);
      }
    };
    
    worker.postMessage({ digits });
    
    return () => {
      worker.terminate();
    };
  }, [digits]);

  return (
    <div className="w-full h-screen bg-[#050505] text-white font-sans overflow-hidden flex flex-col selection:bg-white/20">
      {/* Header / UI */}
      <header className="absolute top-0 left-0 w-full p-6 md:p-10 z-10 flex flex-col md:flex-row justify-between items-start pointer-events-none gap-6">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="text-4xl md:text-5xl font-light tracking-tighter mb-2 flex items-center gap-3">
            <span className="font-serif italic text-5xl md:text-6xl text-white/90">π</span>
            <span className="text-orange-500">Visualization</span>
          </h1>
          <p className="text-neutral-400 text-xs md:text-sm tracking-[0.1em] uppercase font-medium">
            Pi digits forming the Pi Symbol
          </p>
        </motion.div>
        
        <div className="flex flex-col gap-4 h-[calc(100vh-5rem)] pointer-events-none w-full md:w-80">
          <div className="flex flex-col">
            <FPSCounter />
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto bg-black/20 backdrop-blur-md border border-white/5 rounded-2xl p-5 flex flex-col gap-4 w-full shadow-2xl shrink-0"
            >
          <div className="flex items-center justify-between text-xs text-neutral-400 uppercase tracking-widest border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <Settings2 size={14} />
              <span>Parameters</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold">Resolution (Digits)</label>
            <div className="relative">
              <select 
                value={digits}
                onChange={(e) => setDigits(Number(e.target.value))}
                disabled={isCalculating || (plotProgress > 0 && plotProgress < 1)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/20 transition-all disabled:opacity-50 appearance-none cursor-pointer hover:bg-black/80"
              >
                {DIGIT_OPTIONS.map(opt => (
                  <option key={opt} value={opt} className="bg-neutral-950">
                    {opt.toLocaleString()} Digits
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
                ▼
              </div>
            </div>
            {digits >= 100000 && (
              <div className="flex items-start gap-2 text-[10px] text-orange-500 mt-1 bg-orange-500/5 p-2 rounded-lg">
                <Info size={12} className="shrink-0 mt-0.5" />
                <p>
                  {digits >= 10000000 
                    ? "Extreme resolution: This will take several minutes and significant memory." 
                    : "High resolution may take a few moments to compute."}
                </p>
              </div>
            )}
          </div>
          
          <div className="h-10 flex flex-col justify-center">
            <AnimatePresence mode="wait">
              {isCalculating ? (
                <motion.div 
                  key="calculating"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex flex-col gap-2 w-full"
                >
                  <div className="flex items-center justify-between text-[10px] text-neutral-400 tracking-widest uppercase">
                    <div className="flex items-center gap-1.5">
                      <Loader2 size={12} className="animate-spin text-white" />
                      <span>Computing π</span>
                    </div>
                    <span>{Math.round(calcProgress * 100)}%</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-orange-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${calcProgress * 100}%` }}
                      transition={{ duration: 0.1 }}
                    />
                  </div>
                </motion.div>
              ) : plotProgress < 1 ? (
                <motion.div 
                  key="plotting"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex flex-col gap-2 w-full"
                >
                  <div className="flex items-center justify-between text-[10px] text-neutral-400 tracking-widest uppercase">
                    <div className="flex items-center gap-1.5">
                      <Activity size={12} className="text-orange-500 animate-pulse" />
                      <span>Tracing Path</span>
                    </div>
                    <span>{Math.round(plotProgress * 100)}%</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-orange-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${plotProgress * 100}%` }}
                      transition={{ duration: 0.1 }}
                    />
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="done"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-[10px] text-neutral-500 tracking-widest uppercase"
                >
                  Computed in {calcTime ? (calcTime / 1000).toFixed(2) : 0}s
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

        {/* Digits Display Panel */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-auto bg-black/20 backdrop-blur-md border border-white/5 rounded-2xl p-5 flex flex-col gap-4 w-full shadow-2xl flex-1 overflow-hidden"
        >
          <div className="flex items-center justify-between text-xs text-neutral-400 uppercase tracking-widest border-b border-white/5 pb-3 shrink-0">
            <div className="flex items-center gap-2">
              <Activity size={14} />
              <span>Computed Sequence</span>
            </div>
            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full">{piString.length.toLocaleString()}</span>
          </div>
          <div className="flex-1 overflow-hidden pr-2 text-neutral-400 font-mono text-[10px] leading-relaxed tracking-wider opacity-80">
            {piString ? (
              <VirtualizedDigits piString={piString} />
            ) : (
              <div className="p-4">Computing...</div>
            )}
          </div>
        </motion.div>
      </div>
      </header>

      {/* Footer */}
      <footer className="absolute bottom-6 left-6 md:bottom-10 md:left-10 z-10 pointer-events-none">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ duration: 1, delay: 1 }}
          className="text-[10px] uppercase tracking-[0.3em] font-medium text-white"
        >
          Concept by Shahnab
        </motion.div>
      </footer>

      {/* 3D Canvas */}
      <div className="flex-1 w-full h-full">
        <Canvas camera={{ position: [0, 0, 20], fov: 45, near: 0.001, far: 2000 }} dpr={[1, 2]}>
          <color attach="background" args={['#020202']} />
          
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} color="#ff8822" />
          
          <Suspense fallback={null}>
            {piString && <PiCircuit piString={piString} onPlotProgress={setPlotProgress} />}
            <Environment preset="night" />
            <EffectComposer>
              <Bloom 
                luminanceThreshold={0.8} 
                mipmapBlur 
                intensity={0.4} 
                radius={0.3}
              />
            </EffectComposer>
          </Suspense>
          
          <OrbitControls 
            makeDefault 
            enableRotate={true}
            enablePan={true}
            enableZoom={true}
            minDistance={0.01}
            maxDistance={1000}
            zoomSpeed={1.5}
          />
        </Canvas>
      </div>
    </div>
  );
}
