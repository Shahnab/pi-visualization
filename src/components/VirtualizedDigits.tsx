import { useMemo, useRef, useState, useEffect } from 'react';

interface VirtualizedDigitsProps {
  piString: string;
}

const CHARS_PER_LINE = 50;
const LINE_HEIGHT = 20;
const BUFFER = 5;

// Browsers silently cap the height of a DOM element at ~16–33 million px
// depending on browser/OS. For 100M digits we need 40M px which exceeds the cap,
// making the last ~38M digits unreachable by scrolling.
// MAX_SCROLL_PX is the safe upper bound we use for the physical container height.
// We map physical scrollTop → virtual line index via a scale factor, and anchor
// rendered rows to the current viewport position so they are always correct.
const MAX_SCROLL_PX = 10_000_000;

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
    setContainerHeight(container.offsetHeight);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
    };
  }, []);

  const lineCount = useMemo(() => Math.ceil(piString.length / CHARS_PER_LINE), [piString]);

  // Physical height of the scrollable container — capped so the browser never
  // silently truncates it. When the ideal height exceeds MAX_SCROLL_PX we scale
  // down: each physical pixel of scrolling represents `scale` virtual pixels.
  const idealHeight = lineCount * LINE_HEIGHT;
  const totalHeight = Math.min(idealHeight, MAX_SCROLL_PX);
  const scale = idealHeight > MAX_SCROLL_PX ? idealHeight / MAX_SCROLL_PX : 1;

  const visibleLines = useMemo(() => {
    // Map physical scrollTop to the virtual scroll position (in un-scaled pixels)
    const virtualScrollTop = scrollTop * scale;

    // First visible line index, with a buffer above for smooth scrolling
    const firstVisible = Math.floor(virtualScrollTop / LINE_HEIGHT);
    const startLine = Math.max(0, firstVisible - BUFFER);
    const endLine = Math.min(lineCount, Math.ceil((virtualScrollTop + containerHeight) / LINE_HEIGHT) + BUFFER);

    // Physical top of the first rendered row, anchored to current scrollTop so
    // items are always in the right visual position regardless of scale.
    // bufferAbove: how many buffer rows are actually above the viewport
    const bufferAbove = firstVisible - startLine; // = min(firstVisible, BUFFER)
    const topAnchor = scrollTop - bufferAbove * LINE_HEIGHT;

    const lines = [];
    for (let i = startLine; i < endLine; i++) {
      const startIdx = i * CHARS_PER_LINE;
      // Digit number (1-based): the '.' at char position 1 is not a digit.
      // For charOffset 0 → digit 1. For charOffset >= 2 → digit == charOffset
      // (the dot shifts all positions by 0 since it sits between pos 0 and pos 2).
      const digitNum = startIdx === 0 ? 1 : startIdx;
      lines.push({
        index: i,
        content: piString.slice(startIdx, startIdx + CHARS_PER_LINE),
        // Each item is placed LINE_HEIGHT px below the previous, starting at topAnchor
        top: topAnchor + (i - startLine) * LINE_HEIGHT,
        offset: digitNum,
      });
    }
    return lines;
  }, [scrollTop, containerHeight, lineCount, scale, piString]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-y-auto custom-scrollbar relative"
    >
      {/* Spacer that gives the scrollbar its full range */}
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
              alignItems: 'center',
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
