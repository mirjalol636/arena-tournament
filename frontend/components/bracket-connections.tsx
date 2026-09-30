"use client";
import { useEffect, useRef, useState } from "react";
export function BracketConnections({
  children,
  signature,
}: {
  children: React.ReactNode;
  signature: string;
}) {
  const root = useRef<HTMLDivElement>(null),
    [paths, setPaths] = useState<string[]>([]),
    [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const draw = () => {
      const bounds = el.getBoundingClientRect(),
        next: string[] = [];
      el.querySelectorAll<HTMLElement>("[data-bracket-id]").forEach(
        (source) => {
          const target = el.querySelector<HTMLElement>(
            `[data-bracket-id="${source.dataset.nextId}"]`,
          );
          if (!target) return;
          const a = source.getBoundingClientRect(),
            b = target.getBoundingClientRect();
          if (b.left <= a.left) return;
          const x = a.right - bounds.left,
            y = a.top + a.height / 2 - bounds.top,
            tx = b.left - bounds.left,
            ty = b.top + b.height / 2 - bounds.top,
            mx = (x + tx) / 2;
          next.push(`M ${x} ${y} H ${mx} V ${ty} H ${tx}`);
        },
      );
      setPaths(next);
      setSize({ width: el.scrollWidth, height: el.scrollHeight });
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(el);
    return () => observer.disconnect();
  }, [signature]);
  return (
    <div ref={root} className="bracket-connections">
      <svg
        aria-hidden="true"
        width={size.width}
        height={size.height}
        className="bracket-lines"
      >
        {paths.map((d, i) => (
          <path d={d} key={i} fill="none" stroke="#5c4678" strokeWidth="1.2" />
        ))}
      </svg>
      {children}
    </div>
  );
}
