import { useMemo, useRef, useState, useEffect } from 'react';

interface VirtualizedDigitsProps {
  piString: string;
}

const CHARS_PER_LINE = 50;
const LINE_HEIGHT = 20; // Slightly taller for better readability

export default function VirtualizedDigits({ piString }: VirtualizedDigitsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setScrollTop(container.scrollTop);
    };

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    container.addEventListener('scroll', handleScroll, { passive: true });
    resizeObserver.observe(container);
    
    // Initial height
    setContainerHeight(container.offsetHeight);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, []);

  const lineCount = useMemo(() => {
    return Math.ceil(piString.length / CHARS_PER_LINE);
  }, [piString]);

  const totalHeight = lineCount * LINE_HEIGHT;

  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - 5);
    const end = Math.min(lineCount, Math.ceil((scrollTop + containerHeight) / LINE_HEIGHT) + 5);
    return { start, end };
  }, [scrollTop, containerHeight, lineCount]);

  const visibleLines = useMemo(() => {
    const lines = [];
    for (let i = visibleRange.start; i < visibleRange.end; i++) {
      const startIdx = i * CHARS_PER_LINE;
      const endIdx = startIdx + CHARS_PER_LINE;
      lines.push({
        index: i,
        content: piString.slice(startIdx, endIdx),
        top: i * LINE_HEIGHT,
        offset: startIdx
      });
    }
    return lines;
  }, [visibleRange, piString]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full overflow-y-auto custom-scrollbar relative"
    >
      <div style={{ height: totalHeight, width: '100%', position: 'relative' }}>
        {visibleLines.map((line) => (
          <div 
            key={line.index}
            style={{ 
              position: 'absolute', 
              top: line.top, 
              height: LINE_HEIGHT, 
              width: '100%',
              display: 'flex',
              alignItems: 'center'
            }}
            className="gap-4 px-2 border-b border-white/5 hover:bg-white/5 transition-colors group"
          >
            <span className="text-neutral-600 w-20 text-right select-none font-mono text-[9px] shrink-0">
              {line.offset.toLocaleString()}
            </span>
            <span className="text-neutral-400 font-mono text-[10px] tracking-wider whitespace-nowrap overflow-hidden">
              {line.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
