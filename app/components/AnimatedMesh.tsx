"use client";

import { motion } from "framer-motion";

export function AnimatedMesh() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <motion.div
        className="absolute -left-24 top-[-10%] h-[46vh] w-[46vh] rounded-full bg-sky-200/30 blur-3xl"
        animate={{
          x: [0, 40, -20, 0],
          y: [0, 28, 18, 0]
        }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute right-[-8%] top-[10%] h-[52vh] w-[52vh] rounded-full bg-slate-200/35 blur-3xl"
        animate={{
          x: [0, -35, 20, 0],
          y: [0, -18, 25, 0]
        }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-16%] left-[28%] h-[44vh] w-[44vh] rounded-full bg-blue-100/35 blur-3xl"
        animate={{
          x: [0, 22, -24, 0],
          y: [0, -20, 12, 0]
        }}
        transition={{ duration: 34, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.65),rgba(245,248,252,0.9))]" />
    </div>
  );
}
