import { Suspense, useEffect, useMemo, useRef } from "react";
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitImpl } from "three-stdlib";
type V3 = [number, number, number];
const C = {
  grass: "#a5bd82",
  edge: "#d2c8a3",
  cream: "#fff1d2",
  roof: "#b76f59",
  ink: "#426754",
  pink: "#ecc0cd",
  road: "#e1cc9f",
};
function Box({
  p = [0, 0, 0],
  s = [1, 1, 1],
  c = C.cream,
  r = 0.04,
  glow = false,
  rotation = [0, 0, 0],
}: {
  p?: V3;
  s?: V3;
  c?: string;
  r?: number;
  glow?: boolean;
  rotation?: V3;
}) {
  return (
    <RoundedBox
      position={p}
      args={s}
      radius={Math.min(r, ...s.map((v) => v / 2 - 0.001))}
      smoothness={1}
      rotation={rotation}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial
        color={c}
        roughness={0.85}
        emissive={glow ? c : "#000000"}
        emissiveIntensity={glow ? 0.7 : 0}
      />
    </RoundedBox>
  );
}
function Ball({ p, s = 0.2, c }: { p: V3; s?: number | V3; c: string }) {
  return (
    <mesh position={p} scale={s} castShadow>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color={c} roughness={0.95} />
    </mesh>
  );
}
function Cylinder({
  p,
  r,
  h,
  c,
  r2,
}: {
  p: V3;
  r: number;
  h: number;
  c: string;
  r2?: number;
}) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <cylinderGeometry args={[r2 ?? r, r, h, 16]} />
      <meshStandardMaterial color={c} roughness={0.9} />
    </mesh>
  );
}
function Label({
  text,
  p,
  width = 1.5,
  color = "#47735f",
  bg = "#fff0ce",
  size = 0.26,
}: {
  text: string;
  p: V3;
  width?: number;
  color?: string;
  bg?: string;
  size?: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.strokeRect(10, 10, 492, 108);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 51px sans-serif";
    ctx.fillText(text, 256, 68, 470);
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text, color, bg]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={p}>
      <planeGeometry args={[width, size]} />
      <meshStandardMaterial map={texture} roughness={0.9} />
    </mesh>
  );
}
function Plant({ p, flowers = false }: { p: V3; flowers?: boolean }) {
  return (
    <group position={p}>
      <Cylinder p={[0, 0.09, 0]} r={0.12} r2={0.16} h={0.18} c="#cd9474" />
      <Ball p={[0, 0.26, 0]} s={[0.17, 0.23, 0.16]} c="#618963" />
      {flowers &&
        [0, 1, 2].map((i) => (
          <Ball
            key={i}
            p={[(i - 1) * 0.08, 0.43 + (i % 2) * 0.04, 0]}
            s={0.06}
            c="#f5cf83"
          />
        ))}
    </group>
  );
}
function Tree({
  p,
  pink = false,
  scale = 1,
}: {
  p: V3;
  pink?: boolean;
  scale?: number;
}) {
  const crown = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (crown.current)
      crown.current.rotation.z =
        Math.sin(clock.elapsedTime * 0.8 + p[0]) * 0.025;
  });
  return (
    <group position={p} scale={scale}>
      <Cylinder p={[0, 0.52, 0]} r={0.1} r2={0.07} h={1.04} c="#92795b" />
      <group ref={crown} position={[0, 0.8, 0]}>
        <Box
          p={[0.17, 0.1, 0]}
          s={[0.08, 0.6, 0.08]}
          c="#92795b"
          rotation={[0, 0, -0.6]}
        />
        {[
          [0, 0.65, 0, 0.61],
          [-0.4, 0.39, 0.05, 0.48],
          [0.4, 0.45, 0, 0.5],
          [0.05, 0.4, 0.36, 0.44],
          [0.02, 0.37, -0.34, 0.43],
        ].map(([x, y, z, s], i) => (
          <Ball
            key={i}
            p={[x, y, z]}
            s={[s, s * 0.9, s]}
            c={
              pink
                ? ["#e8aec1", "#f2c6d2", "#edbac9"][i % 3]
                : ["#88a773", "#a2bb80", "#91af79"][i % 3]
            }
          />
        ))}
        {pink &&
          [0, 1, 2, 3].map((i) => (
            <Ball
              key={i}
              p={[(i - 1.5) * 0.18, 0.7, 0.5]}
              s={0.055}
              c="#ffe2dc"
            />
          ))}
      </group>
      <Cylinder p={[0, 0.025, 0]} r={0.43} h={0.045} c="#91aa76" />
    </group>
  );
}
function Pine({ p, scale = 1 }: { p: V3; scale?: number }) {
  return (
    <group position={p} scale={scale}>
      <Cylinder p={[0, 0.45, 0]} r={0.08} h={0.9} c="#94765a" />
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.65 + i * 0.35, 0]} castShadow>
          <coneGeometry args={[0.5 - i * 0.1, 0.85, 7]} />
          <meshStandardMaterial color={["#76967c", "#86a483", "#9ab48f"][i]} />
        </mesh>
      ))}
    </group>
  );
}
function Bench({ p, rotation = 0 }: { p: V3; rotation?: number }) {
  return (
    <group position={p} rotation={[0, rotation, 0]}>
      <Box p={[0, 0.25, 0]} s={[0.8, 0.09, 0.3]} c="#bd9267" />
      <Box p={[0, 0.45, -0.14]} s={[0.8, 0.27, 0.06]} c="#bd9267" />
      {[-0.28, 0.28].map((x) => (
        <Box key={x} p={[x, 0.12, 0]} s={[0.06, 0.25, 0.23]} c="#657d69" />
      ))}
    </group>
  );
}
function Table({ p }: { p: V3 }) {
  return (
    <group position={p}>
      <Cylinder p={[0, 0.36, 0]} r={0.28} h={0.06} c="#f5dfab" />
      <Cylinder p={[0, 0.19, 0]} r={0.04} h={0.38} c="#6c8174" />
      {[-1, 1].map((x) => (
        <group key={x}>
          <Cylinder p={[x * 0.4, 0.22, 0]} r={0.13} h={0.06} c="#bc7a5f" />
          <Cylinder p={[x * 0.4, 0.1, 0]} r={0.035} h={0.22} c="#6c8174" />
        </group>
      ))}
      <Cylinder p={[0, 0.405, 0]} r={0.1} h={0.025} c="#dc9a57" />
      <Cylinder p={[0.12, 0.42, 0.1]} r={0.035} h={0.08} c="#fdf2d1" />
    </group>
  );
}
function Roof({ color = C.roof }: { color?: string }) {
  return (
    <group>
      <Box p={[0, 1.7, 0]} s={[2.65, 0.16, 1.95]} c={color} />
      <Box
        p={[0, 1.94, -0.39]}
        s={[2.65, 0.12, 1.13]}
        c={color}
        rotation={[-0.47, 0, 0]}
      />
      <Box
        p={[0, 1.94, 0.39]}
        s={[2.65, 0.12, 1.13]}
        c={color}
        rotation={[0.47, 0, 0]}
      />
      <Box p={[0, 2.2, 0]} s={[2.72, 0.12, 0.12]} c="#c78d70" />
      {Array.from({ length: 12 }, (_, i) => (
        <group key={i}>
          <Box
            p={[-1.22 + i * 0.22, 1.99, 0.39]}
            s={[0.028, 0.035, 1.05]}
            c="#cf9275"
            rotation={[0.47, 0, 0]}
          />
          <Box
            p={[-1.22 + i * 0.22, 1.99, -0.39]}
            s={[0.028, 0.035, 1.05]}
            c="#c2856b"
            rotation={[-0.47, 0, 0]}
          />
        </group>
      ))}
      <Box p={[0.78, 2.15, -0.4]} s={[0.27, 0.7, 0.27]} c="#efc19b" />
      <Box p={[0.78, 2.51, -0.4]} s={[0.36, 0.09, 0.36]} c={color} />
    </group>
  );
}
function Shop({
  kind = "detroit",
  night = false,
  detail = 1,
}: {
  kind?: "detroit" | "chicago" | "cafe";
  night?: boolean;
  detail?: number;
}) {
  const cafe = kind === "cafe",
    chi = kind === "chicago",
    accent = cafe ? "#729c8f" : chi ? "#6f8fa1" : "#c87458";
  return (
    <group>
      <Box p={[0, 0.055, 0]} s={[3.25, 0.11, 2.8]} c="#ded2af" r={0.12} />
      <Box
        p={[0, 0.79, 0]}
        s={[2.35, 1.5, 1.65]}
        c={cafe ? "#d4e1c8" : chi ? "#efd6af" : "#efc594"}
        r={0.08}
      />
      {[-0.77, 0.77].map((x) => (
        <group key={x}>
          <Box p={[x, 0.83, 0.84]} s={[0.63, 0.72, 0.065]} c="#fff0cc" />
          <Box
            p={[x, 0.83, 0.88]}
            s={[0.48, 0.56, 0.035]}
            c={night ? "#ffc86e" : "#779997"}
            glow={night}
          />
          <Box p={[x, 0.83, 0.91]} s={[0.035, 0.58, 0.03]} c="#f8e3b7" />
          <Box p={[x, 0.56, 0.92]} s={[0.66, 0.07, 0.12]} c={accent} />
          <Box p={[x, 0.36, 0.91]} s={[0.6, 0.25, 0.12]} c={accent} />
          <Ball p={[x, 0.52, 0.98]} s={[0.27, 0.1, 0.12]} c="#8aab70" />
        </group>
      ))}
      <Box p={[0, 0.62, 0.86]} s={[0.43, 1.1, 0.07]} c={accent} />
      <Box
        p={[0, 0.77, 0.91]}
        s={[0.28, 0.56, 0.025]}
        c={night ? "#ffcf84" : "#93b1a5"}
        glow={night}
      />
      <Ball p={[0.13, 0.56, 0.96]} s={0.035} c="#e9cb85" />
      <Box p={[0, 0.13, 1]} s={[0.6, 0.12, 0.35]} c="#f0dfbd" />
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          p={[-1.19, 0.4 + i * 0.22, 0.2]}
          s={[0.04, 0.06, 1.2]}
          c="#deb28c"
        />
      ))}
      {detail > 0 && (
        <group>
          <Roof color={cafe ? "#688b7d" : chi ? "#738897" : C.roof} />
          <Box p={[0, 1.48, 0.95]} s={[1.98, 0.43, 0.16]} c={accent} />
          <Label
            text={
              cafe
                ? "SLOW MORNINGS"
                : chi
                  ? "DEEP DISH CLUB"
                  : "MOTOR CITY PIZZA"
            }
            p={[0, 1.48, 1.04]}
            width={1.86}
            size={0.32}
            color={cafe ? "#4d786b" : "#9b614c"}
          />
          {Array.from({ length: 9 }, (_, i) => (
            <Box
              key={i}
              p={[-1.08 + i * 0.27, 1.15, 1.13]}
              s={[0.27, 0.07, 0.59]}
              rotation={[0.2, 0, 0]}
              c={i % 2 === 0 ? accent : "#fff0cf"}
            />
          ))}
          {Array.from({ length: 9 }, (_, i) => (
            <Box
              key={i}
              p={[-1.08 + i * 0.27, 1.06, 1.41]}
              s={[0.27, 0.17, 0.06]}
              c={i % 2 === 0 ? accent : "#fff0cf"}
            />
          ))}
          <Plant p={[-1.4, 0, 0.9]} flowers />
          <Plant p={[1.4, 0, 0.9]} flowers />
          <Table p={[-0.95, 0, 1.95]} />
          <Table p={[0.85, 0, 1.95]} />
          {!cafe && (
            <group position={[-0.75, 2.42, 0.06]} rotation={[0.3, 0, -0.12]}>
              <Cylinder p={[0, 0, 0]} r={0.35} h={0.1} c="#dca866" />
              <Cylinder p={[0, 0.06, 0]} r={0.29} h={0.035} c="#edc475" />
              {[0, 1, 2, 3, 4].map((i) => (
                <Cylinder
                  key={i}
                  p={[Math.cos(i * 2) * 0.16, 0.09, Math.sin(i * 2) * 0.16]}
                  r={0.065}
                  h={0.025}
                  c="#b9644e"
                />
              ))}
            </group>
          )}
          {cafe && (
            <group position={[-0.65, 2.36, 0]}>
              <Cylinder p={[0, 0, 0]} r={0.22} h={0.3} c="#f6e3bf" />
              <mesh position={[0.24, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.1, 0.035, 6, 12]} />
                <meshStandardMaterial color="#f6e3bf" />
              </mesh>
              <Cylinder p={[0, 0.16, 0]} r={0.18} h={0.02} c="#7b5e45" />
            </group>
          )}
        </group>
      )}
    </group>
  );
}
function Lighthouse({ night }: { night: boolean }) {
  const lamp = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (lamp.current) lamp.current.rotation.y = clock.elapsedTime * 0.25;
  });
  return (
    <group>
      <Cylinder p={[0, 0.12, 0]} r={0.95} h={0.24} c="#d6cbb0" />
      <Cylinder p={[0, 1.28, 0]} r={0.5} r2={0.34} h={2.4} c="#fff0d3" />
      <Cylinder p={[0, 1.36, 0]} r={0.443} r2={0.405} h={0.55} c="#d98570" />
      <Cylinder p={[0, 2.51, 0]} r={0.61} h={0.13} c="#779295" />
      <Cylinder
        p={[0, 2.84, 0]}
        r={0.34}
        h={0.58}
        c={night ? "#ffd385" : "#b4d3cb"}
      />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return (
          <Box
            key={i}
            p={[Math.cos(a) * 0.4, 2.83, Math.sin(a) * 0.4]}
            s={[0.045, 0.55, 0.045]}
            c="#566f70"
          />
        );
      })}
      <mesh position={[0, 3.23, 0]} castShadow>
        <coneGeometry args={[0.68, 0.5, 12]} />
        <meshStandardMaterial color="#d67f68" />
      </mesh>
      <Ball p={[0, 3.5, 0]} s={0.07} c="#e2bd79" />
      <Box p={[0, 0.4, 0.49]} s={[0.26, 0.58, 0.08]} c="#78918c" />
      <group ref={lamp}>
        {night && (
          <pointLight
            position={[0, 2.8, 0.3]}
            intensity={2}
            distance={4}
            color="#ffcf83"
          />
        )}
      </group>
    </group>
  );
}
function Person({
  p,
  color = "#e1a16e",
  walk = false,
}: {
  p: V3;
  color?: string;
  walk?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y =
        p[1] + Math.sin(clock.elapsedTime * 2.5 + p[0]) * 0.018;
      if (walk)
        ref.current.position.x =
          p[0] + Math.sin(clock.elapsedTime * 0.4) * 0.35;
    }
  });
  return (
    <group ref={ref} position={p}>
      <Box p={[-0.065, 0.09, 0]} s={[0.07, 0.18, 0.09]} c="#657581" />
      <Box p={[0.065, 0.09, 0]} s={[0.07, 0.18, 0.09]} c="#657581" />
      <Ball p={[0, 0.27, 0]} s={[0.15, 0.18, 0.12]} c={color} />
      <Ball p={[0, 0.48, 0]} s={0.13} c="#edc39a" />
      <Ball p={[0, 0.55, -0.025]} s={[0.14, 0.095, 0.13]} c="#735e47" />
    </group>
  );
}
const roadPoints = [
  new THREE.Vector3(-6, 0.075, 1.2),
  new THREE.Vector3(-3.5, 0.075, 3.1),
  new THREE.Vector3(-0.7, 0.075, 3.8),
  new THREE.Vector3(1.4, 0.075, 3),
  new THREE.Vector3(3, 0.075, 2.8),
  new THREE.Vector3(5.8, 0.075, 3),
  new THREE.Vector3(6, 0.075, 0.3),
  new THREE.Vector3(4.7, 0.075, -1.2),
  new THREE.Vector3(2, 0.075, -0.65),
  new THREE.Vector3(0.3, 0.075, -1.3),
  new THREE.Vector3(-1.1, 0.075, -2.3),
];
const roadCurve = new THREE.CatmullRomCurve3(roadPoints);
function Road() {
  const geo = useMemo(() => {
    const points = roadCurve.getPoints(100);
    const vertices: number[] = [];
    const indices: number[] = [];
    points.forEach((p, i) => {
      const tangent = roadCurve.getTangent(i / 100);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(
        0.46,
      );
      vertices.push(
        p.x + normal.x,
        p.y,
        p.z + normal.z,
        p.x - normal.x,
        p.y,
        p.z - normal.z,
      );
      if (i < 100) {
        let n = i * 2;
        indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <group>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial color={C.road} side={THREE.DoubleSide} />
      </mesh>
      {Array.from({ length: 42 }, (_, i) => {
        const p = roadCurve.getPoint(i / 43);
        const t = roadCurve.getTangent(i / 43);
        return (
          <Box
            key={i}
            p={[p.x, 0.09, p.z]}
            s={[0.035, 0.012, 0.16]}
            c="#f8eacd"
            r={0.005}
            rotation={[0, Math.atan2(t.x, t.z), 0]}
          />
        );
      })}
    </group>
  );
}
function Car() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime * 0.018 + 0.15) % 0.94;
    const p = roadCurve.getPoint(t);
    const d = roadCurve.getTangent(t);
    if (ref.current) {
      ref.current.position.copy(p);
      ref.current.rotation.y = Math.atan2(d.x, d.z);
    }
  });
  return (
    <group ref={ref} scale={0.8}>
      <Box p={[0, 0.25, 0]} s={[0.43, 0.24, 0.74]} c="#d99b65" r={0.09} />
      <Box p={[0, 0.43, -0.04]} s={[0.35, 0.23, 0.39]} c="#f1dfbc" />
      <Box p={[0, 0.45, 0.17]} s={[0.28, 0.13, 0.025]} c="#719896" />
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <mesh
            key={`${x}${z}`}
            position={[x * 0.22, 0.15, z * 0.24]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.1, 0.1, 0.07, 10]} />
            <meshStandardMaterial color="#5e655c" />
          </mesh>
        )),
      )}
      <Box p={[0, 0.26, 0.38]} s={[0.32, 0.04, 0.03]} c="#ffedb7" />
    </group>
  );
}
function Water() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current)
      ref.current.position.y =
        0.045 + Math.sin(clock.elapsedTime * 0.6) * 0.009;
  });
  return (
    <group>
      <mesh
        ref={ref}
        position={[-4.7, 0.045, -2]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[1, 1.3, 1]}
      >
        <circleGeometry args={[2.75, 48]} />
        <meshStandardMaterial color="#9fc7c3" roughness={0.4} />
      </mesh>
      {Array.from({ length: 13 }, (_, i) => (
        <Box
          key={i}
          p={[-6.7 + (i % 4) * 0.82, 0.065, -3.8 + Math.floor(i / 4) * 0.8]}
          s={[0.38, 0.012, 0.035]}
          r={0.005}
          c="#c6dfd3"
        />
      ))}
      <group position={[-5.6, 0.1, -0.7]} rotation={[0, -0.5, 0]}>
        <Box s={[0.55, 0.16, 0.9]} c="#e9cb9b" r={0.12} />
        <Cylinder p={[0, 0.45, 0]} r={0.025} h={0.9} c="#aa8966" />
        <mesh position={[0.17, 0.56, 0]}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array([0, 0.35, 0, 0, -0.3, 0, 0.38, -0.3, 0]),
                3,
              ]}
            />
          </bufferGeometry>
          <meshStandardMaterial color="#fbebca" side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}
function Fence({ p }: { p: V3 }) {
  return (
    <group position={p}>
      {[-0.6, -0.2, 0.2, 0.6].map((x) => (
        <Box key={x} p={[x, 0.23, 0]} s={[0.09, 0.46, 0.08]} c="#f2e7c7" />
      ))}
      <Box p={[0, 0.17, 0]} s={[1.45, 0.065, 0.06]} c="#f2e7c7" />
      <Box p={[0, 0.34, 0]} s={[1.45, 0.065, 0.06]} c="#f2e7c7" />
    </group>
  );
}
const plot: V3 = [3.55, 0.06, 0.45];
function spring(t: number) {
  return t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.exp(-6 * t) * Math.cos(t * 9);
}
// Details arrive in their own little beats, rather than scaling the complete asset at once.
function PopIn({
  collecting,
  start,
  delay,
  children,
}: {
  collecting: boolean;
  start: number;
  delay: number;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const t = collecting ? (performance.now() - start) / 1000 : 10;
    const k = spring(THREE.MathUtils.clamp((t - delay) / 0.85, 0, 1));
    ref.current.scale.setScalar(k);
  });
  return <group ref={ref}>{children}</group>;
}
function NewShop({
  collecting,
  start,
  night,
}: {
  collecting: boolean;
  start: number;
  night: boolean;
}) {
  const foundation = useRef<THREE.Group>(null),
    body = useRef<THREE.Group>(null),
    visitors = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = collecting ? (performance.now() - start) / 1000 : 10;
    if (foundation.current)
      foundation.current.scale.setScalar(
        spring(Math.min(1, Math.max(0, (t - 0.6) / 0.8))),
      );
    if (body.current) {
      const k = spring(Math.min(1, Math.max(0, (t - 1.3) / 2)));
      body.current.scale.set(
        1 - Math.sin(k * Math.PI) * 0.05,
        k,
        1 - Math.sin(k * Math.PI) * 0.05,
      );
      body.current.position.y = (1 - k) * -0.18;
    }
    if (visitors.current) {
      const k = THREE.MathUtils.smoothstep(t, 4.3, 6);
      visitors.current.scale.setScalar(k);
      visitors.current.position.z = 1.1 * (1 - k);
    }
  });
  return (
    <group position={plot} rotation={[0, -0.12, 0]} scale={0.8}>
      <group ref={foundation}>
        <Box p={[0, 0.025, 0]} s={[3.3, 0.05, 2.85]} c="#dfd2af" r={0.12} />
      </group>
      <group ref={body}>
        <Shop kind="chicago" night={night} detail={0} />
      </group>
      <PopIn collecting={collecting} start={start} delay={2.8}>
        <Roof color="#738897" />
        <Cylinder p={[-0.65, 2.45, 0.1]} r={0.34} h={0.16} c="#a77757" />
        <Cylinder p={[-0.65, 2.54, 0.1]} r={0.28} h={0.055} c="#e8ba61" />
      </PopIn>
      <PopIn collecting={collecting} start={start} delay={3.2}>
        <Box p={[0, 1.48, 0.95]} s={[1.98, 0.43, 0.16]} c="#6f8fa1" />
        <Label
          text="DEEP DISH CLUB"
          p={[0, 1.48, 1.04]}
          width={1.86}
          size={0.32}
        />
      </PopIn>
      <PopIn collecting={collecting} start={start} delay={3.55}>
        {Array.from({ length: 9 }, (_, i) => (
          <Box
            key={i}
            p={[-1.08 + i * 0.27, 1.15, 1.13]}
            s={[0.27, 0.07, 0.59]}
            rotation={[0.2, 0, 0]}
            c={i % 2 === 0 ? "#6f8fa1" : "#fff0cf"}
          />
        ))}
      </PopIn>
      <PopIn collecting={collecting} start={start} delay={3.9}>
        <Table p={[-0.9, 0, 1.9]} />
        <Table p={[0.85, 0, 1.9]} />
      </PopIn>
      <PopIn collecting={collecting} start={start} delay={4.2}>
        <Plant p={[-1.4, 0, 0.9]} flowers />
        <Plant p={[1.4, 0, 0.9]} flowers />
      </PopIn>
      <group ref={visitors}>
        <Person p={[-0.5, 0, 2.7]} walk color="#bd8aab" />
        <Person p={[0.5, 0, 2.7]} walk />
      </group>
    </group>
  );
}
function EmptyPlot({
  onClick,
  collecting,
}: {
  onClick: () => void;
  collecting: boolean;
}) {
  const glow = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (glow.current) {
      const material = glow.current.material as THREE.MeshStandardMaterial;
      material.opacity = collecting
        ? 0.3 + Math.sin(clock.elapsedTime * 4) * 0.12
        : 0.15 + Math.sin(clock.elapsedTime * 1.5) * 0.04;
    }
  });
  return (
    <group
      position={plot}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <Box p={[0, 0.025, 0]} s={[2.6, 0.05, 2.2]} c="#c6bb92" r={0.15} />
      <mesh ref={glow} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.65, 2.25]} />
        <meshStandardMaterial
          color="#ffedac"
          transparent
          opacity={0.3}
          emissive="#f5cc67"
          emissiveIntensity={collecting ? 1 : 0.1}
        />
      </mesh>
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <Cylinder
            key={`${x}${z}`}
            p={[x * 1.2, 0.2, z * 0.98]}
            r={0.045}
            h={0.4}
            c="#c39a70"
          />
        )),
      )}
      {!collecting && (
        <group position={[0, 0, 0.4]}>
          <Box p={[0, 0.45, 0]} s={[0.06, 0.9, 0.06]} c="#ae8864" />
          <Box p={[0, 0.7, 0.02]} s={[1.25, 0.52, 0.1]} c="#f5e8c8" />
          <Label
            text="ROOM TO GROW"
            p={[0, 0.7, 0.079]}
            width={1.15}
            size={0.32}
          />
        </group>
      )}
    </group>
  );
}
function Flowers() {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (!ref.current) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 100; i++) {
      const a = i * 2.399;
      const r = 5.5 + Math.sin(i * 8) * 0.6;
      dummy.position.set(Math.cos(a) * r, 0.12, Math.sin(a) * r * 0.72);
      dummy.scale.set(0.035, 0.08, 0.035);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
      ref.current.setColorAt(
        i,
        new THREE.Color(["#f4e3a5", "#f1d7bf", "#e8bdc5"][i % 3]),
      );
    }
    ref.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 100]}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial />
    </instancedMesh>
  );
}
function CameraRig({
  collecting,
  start,
  resetToken,
  zoom,
  selected,
}: {
  collecting: boolean;
  start: number;
  resetToken: number;
  zoom: number;
  selected: string | null;
}) {
  const { width, height } = useThree((state) => state.size);
  const wide = width / height > 2.1;
  const elevation = wide ? 10 : 13;
  const baseZoom = Math.max(
    18,
    Math.min((width - 24) / 15.8, (height - 18) / (wide ? 10.2 : 10.5)),
  );
  const minZoom = baseZoom * 0.65,
    maxZoom = baseZoom * 1.65;
  const controls = useRef<OrbitImpl>(null),
    transition = useRef(true),
    prev = useRef(zoom);
  const targetPosition = useMemo(() => new THREE.Vector3(), []),
    cameraPosition = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    transition.current = true;
  }, [resetToken, selected, baseZoom]);
  useFrame(({ camera }, delta) => {
    if (!controls.current) return;
    if (prev.current !== zoom) {
      camera.zoom = THREE.MathUtils.clamp(
        camera.zoom + (zoom - prev.current) * 4,
        minZoom,
        maxZoom,
      );
      camera.updateProjectionMatrix();
      prev.current = zoom;
    }
    if (collecting || transition.current) {
      const t = (performance.now() - start) / 1000,
        focus = collecting && t < 5.2;
      const chosen = !collecting && selected;
      const position: V3 = focus
        ? [2.6, 0.7, 0.6]
        : chosen === "detroit"
          ? [-1, 0.3, 0.7]
          : chosen === "cafe"
            ? [0.6, 0.3, -1.5]
            : chosen === "chicago"
              ? [2.2, 0.4, 0.4]
              : chosen === "lighthouse"
                ? [-2.2, 0.5, -1.7]
                : [0, 0, 0];
      targetPosition.set(...position);
      controls.current.target.lerp(targetPosition, 1 - Math.exp(-delta * 2.5));
      cameraPosition.set(
        14 + position[0],
        elevation + position[1],
        17 + position[2],
      );
      camera.position.lerp(cameraPosition, 1 - Math.exp(-delta * 2.5));
      const desiredZoom = focus
        ? baseZoom * 1.13
        : THREE.MathUtils.clamp(baseZoom + zoom * 4, minZoom, maxZoom);
      camera.zoom = THREE.MathUtils.lerp(
        camera.zoom,
        desiredZoom,
        1 - Math.exp(-delta * 2),
      );
      camera.updateProjectionMatrix();
      if (!collecting && camera.position.distanceTo(cameraPosition) < 0.03)
        transition.current = false;
      controls.current.update();
    }
    controls.current.target.x = THREE.MathUtils.clamp(
      controls.current.target.x,
      -3.5,
      3.5,
    );
    controls.current.target.y = THREE.MathUtils.clamp(
      controls.current.target.y,
      -0.4,
      1.6,
    );
    controls.current.target.z = THREE.MathUtils.clamp(
      controls.current.target.z,
      -2.5,
      2.5,
    );
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={!collecting}
      enablePan
      minPolarAngle={0.5}
      maxPolarAngle={1.18}
      minAzimuthAngle={-0.5}
      maxAzimuthAngle={1.4}
      minZoom={minZoom}
      maxZoom={maxZoom}
      zoomSpeed={0.65}
      panSpeed={0.45}
      target={[0, 0, 0]}
    />
  );
}
export interface WorldProps {
  collected: boolean;
  collecting: boolean;
  start: number;
  night: boolean;
  selected: string | null;
  onSelect: (id: string) => void;
  resetToken: number;
  zoom: number;
}
function Scene(props: WorldProps) {
  // Ambient motion renders continuously; small decorative shadows only need 15 Hz.
  const lastShadow = useRef(-Infinity);
  useFrame(({ gl, clock }) => {
    if (clock.elapsedTime - lastShadow.current >= 1 / 15) {
      gl.shadowMap.needsUpdate = true;
      lastShadow.current = clock.elapsedTime;
    }
  });
  const { collected, collecting, start, night, selected, onSelect } = props;
  function selectable(id: string) {
    return (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onSelect(id);
    };
  }
  return (
    <>
      <color attach="background" args={[night ? "#657b85" : "#edf0df"]} />
      <fog attach="fog" args={[night ? "#657b85" : "#edf0df", 35, 65]} />
      <ambientLight
        intensity={night ? 0.45 : 0.65}
        color={night ? "#b9cadc" : "#fff1d3"}
      />
      <hemisphereLight args={["#eaf3e1", "#a8aa83", 0.9]} />
      <directionalLight
        castShadow
        position={[-7, 12, 6]}
        intensity={night ? 0.5 : 2.1}
        color="#ffe6bf"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0004}
        shadow-radius={4}
      />
      <group position={[0, -0.15, 0]}>
        <Cylinder p={[0, -0.58, 0]} r={7.75} r2={7.8} h={0.9} c="#c3b593" />
        <mesh position={[0, -0.075, 0]} receiveShadow>
          <cylinderGeometry args={[7.82, 7.8, 0.18, 96]} />
          <meshStandardMaterial color={C.grass} />
        </mesh>
        <Cylinder p={[0, -0.97, 0]} r={7.45} h={0.1} c="#b2a78b" />
        <Water />
        <Road />
        <group
          position={[-2, 0.06, 0.7]}
          rotation={[0, 0.1, 0]}
          scale={0.88}
          onClick={selectable("detroit")}
        >
          <Shop night={night} />
        </group>
        <group
          position={[1.1, 0.06, -2.7]}
          rotation={[0, 0.15, 0]}
          scale={0.78}
          onClick={selectable("cafe")}
        >
          <Shop kind="cafe" night={night} />
        </group>
        <group position={[-4.2, 0.06, -3.3]} onClick={selectable("lighthouse")}>
          <Lighthouse night={night} />
        </group>
        <group onClick={selectable("cherry")}>
          <Tree p={[0.25, 0.06, 1.35]} pink scale={1.25} />
        </group>
        {(collected || collecting) && (
          <group onClick={selectable("chicago")}>
            <NewShop collecting={collecting} start={start} night={night} />
          </group>
        )}
        {(!collected || collecting) && (
          <EmptyPlot onClick={() => onSelect("plot")} collecting={collecting} />
        )}
        {selected && selected !== "plot" && (
          <mesh
            position={
              selected === "detroit"
                ? [-2, 0.13, 0.7]
                : selected === "chicago"
                  ? plot
                  : selected === "cafe"
                    ? [1.1, 0.13, -2.7]
                    : selected === "lighthouse"
                      ? [-4.2, 0.13, -3.3]
                      : [0.25, 0.13, 1.35]
            }
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[1.55, 1.6, 64]} />
            <meshBasicMaterial color="#fff0b6" transparent opacity={0.8} />
          </mesh>
        )}
        {[
          [-6, 0, 2.7],
          [-4.7, 0, 4.3],
          [-1.8, 0, -3.5],
          [3.6, 0, -3.9],
          [5.5, 0, -2.9],
          [5.9, 0, 1],
          [2.3, 0, 5],
          [-2, 0, 5],
        ].map((p, i) => (
          <Tree key={i} p={p as V3} scale={0.7 + (i % 3) * 0.16} />
        ))}
        {[
          [-2.6, 0, -4.5],
          [2.4, 0, -4.4],
          [4.6, 0, -3.8],
          [-5.4, 0, 3.4],
          [-0.6, 0, -4.9],
        ].map((p, i) => (
          <Pine key={i} p={p as V3} scale={0.8 + (i % 2) * 0.3} />
        ))}
        <Bench p={[1.3, 0.06, 1.7]} rotation={-0.4} />
        <Bench p={[-3, 0.06, -1.5]} rotation={0.3} />
        <Fence p={[2.7, 0.06, -3.65]} />
        <Fence p={[-2.4, 0.06, -2.1]} />
        <Fence p={[5.3, 0.06, 1.7]} />
        <Person p={[-1.2, 0.09, 2.9]} walk />
        <Person p={[0.65, 0.09, 2.2]} color="#7a9daf" />
        <Person p={[-3.4, 0.09, -1.1]} color="#d2a1ac" />
        <Person p={[2, 0.09, -0.7]} color="#b7a270" walk />
        <Car />
        <Flowers />
        {[
          [-3.2, 0.06, -2.4],
          [-6, 0.06, -3.6],
          [-6.3, 0.06, -3.3],
          [-5.7, 0.06, -4.2],
          [6, 0.06, -1.7],
        ].map((p, i) => (
          <Ball key={i} p={p as V3} s={[0.27, 0.2, 0.3]} c="#b8bd9f" />
        ))}
        <group position={[-0.1, 0, 4.7]}>
          <Cylinder p={[0, 0.45, 0]} r={0.04} h={0.9} c="#a98a64" />
          <Box p={[0, 0.73, 0]} s={[1.45, 0.38, 0.1]} c="#f0e3bd" />
          <Label
            text="LITTLE WORLD"
            p={[0, 0.73, 0.06]}
            width={1.35}
            size={0.3}
          />
          <Plant p={[-0.85, 0, 0]} />
        </group>
      </group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -1.23, 0]}
        receiveShadow
      >
        <planeGeometry args={[200, 200]} />
        <shadowMaterial transparent opacity={0.12} />
      </mesh>
      <CameraRig {...props} />
    </>
  );
}
export default function World(props: WorldProps) {
  return (
    <Canvas
      shadows
      orthographic
      camera={{ position: [14, 13, 17], zoom: 43, near: 0.1, far: 100 }}
      dpr={[1, 1.25]}
      onCreated={({ gl }) => {
        gl.shadowMap.autoUpdate = false;
        gl.shadowMap.needsUpdate = true;
      }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      }}
      onPointerMissed={() => props.onSelect("")}
    >
      <Suspense fallback={null}>
        <Scene {...props} />
      </Suspense>
    </Canvas>
  );
}
export function ShopPreview() {
  return (
    <Canvas
      orthographic
      camera={{ position: [4, 3.2, 5], zoom: 58 }}
      dpr={[1, 1.25]}
      onCreated={({ gl }) => {
        gl.shadowMap.autoUpdate = false;
        gl.shadowMap.needsUpdate = true;
      }}
    >
      <ambientLight intensity={2} />
      <directionalLight position={[-3, 5, 4]} intensity={2} />
      <group position={[0, -1.1, 0]} rotation={[0, -0.2, 0]} scale={0.85}>
        <Shop kind="chicago" />
      </group>
    </Canvas>
  );
}
