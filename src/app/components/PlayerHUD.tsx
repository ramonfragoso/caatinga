"use client";
import { useEffect, useState } from "react";
import { playerPosition } from "./Player";

export function PlayerHUD() {
  const [pos, setPos] = useState({ x: 0, y: 0, z: 0 });

  useEffect(() => {
    let raf: number;
    const tick = () => {
      setPos({ x: playerPosition.x, y: playerPosition.y, z: playerPosition.z });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="z-50 absolute top-1 left-1/2 -translate-x-1/2 rounded-md bg-black/60 text-white text-xs font-mono px-2 py-1"
    >
      x: {pos.x.toFixed(2)} y: {pos.y.toFixed(2)} z: {pos.z.toFixed(2)}
    </div>
  );
}
