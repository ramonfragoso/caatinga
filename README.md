# Three.js Simple Project

A minimal Three.js application built with Next.js 15, React 19, and TypeScript. This project features a simple cube that you can rotate around using orbit controls.

## Features

- 🎮 Interactive cube with orbit controls (rotate, zoom, pan)
- 🎛️ Leva debug panel (ready for customization)
- 🎨 Modern styling with Tailwind CSS
- ⚡ Fast development with Next.js 15 and Turbopack
- 🔧 TypeScript support with proper Three.js types
- 🎪 Same canvas configuration as the full threejs-game project

## Getting Started

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the project in your browser.

### Build

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app/
│   ├── components/          # Ready for future components
│   ├── constants/          # Ready for constants
│   ├── hooks/
│   │   └── useDebugUI.ts   # Empty debug UI hook
│   ├── utils/              # Ready for utilities
│   ├── globals.css         # Global styles
│   ├── layout.tsx          # App layout
│   └── page.tsx            # Main page with cube
├── types/
│   └── glsl.d.ts           # GLSL type definitions
└── ...
```

## Controls

- **Mouse**: Rotate the camera around the cube
- **Mouse Wheel**: Zoom in/out
- **Right Click + Drag**: Pan the camera

## Debug Panel

The project includes an empty Leva debug panel in the top-right corner, ready for you to add your custom controls in `src/app/hooks/useDebugUI.ts`.

## Technologies

- **Next.js 15** - React framework with App Router
- **React 19** - UI library
- **Three.js** - 3D graphics library
- **@react-three/fiber** - React renderer for Three.js
- **@react-three/drei** - Useful helpers for React Three Fiber
- **Leva** - Debug UI controls
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework
