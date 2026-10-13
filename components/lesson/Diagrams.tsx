import type { ReactNode } from "react";
import type { DiagramId } from "@/content/lessons";

/**
 * Illustrated lesson diagrams, drawn as pixel art in SVG: shaded blocks with
 * a dark outline, a highlight row and a shadow row, pixel arrows and the
 * pixel font. Every diagram uses a 180×112 grid scaled with crisp edges.
 */
const W = 180;
const H = 112;
const INK = "#1a1430";

type Ramp = readonly [dark: string, mid: string, light: string];
const CREAM: Ramp = ["#b9b0a0", "#f8f4e6", "#ffffff"];
const BLUE: Ramp = ["#1f3f6e", "#2f68a8", "#5a9ad8"];
const PURPLE: Ramp = ["#2a1a58", "#4a2f8e", "#7a5ac8"];
const STONE: Ramp = ["#3a3850", "#5e5a78", "#8a86a8"];
const GOLD: Ramp = ["#8a5a10", "#e0a030", "#ffe27a"];
const TEAL: Ramp = ["#0f5a55", "#178f84", "#5eead4"];
const RED: Ramp = ["#7a1a2a", "#c83a4a", "#f87a8a"];
const GREEN: Ramp = ["#1f5a2c", "#3a8a3a", "#7cc24f"];

/** A shaded pixel block: outline, fill, top highlight and bottom shadow. */
function Block({ x, y, w, h, ramp, children }: { x: number; y: number; w: number; h: number; ramp: Ramp; children?: ReactNode }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={INK} />
      <rect x={x + 1} y={y + 1} width={w - 2} height={h - 2} fill={ramp[1]} />
      <rect x={x + 1} y={y + 1} width={w - 2} height={1} fill={ramp[2]} />
      <rect x={x + 1} y={y + 1} width={1} height={h - 3} fill={ramp[2]} />
      <rect x={x + 1} y={y + h - 2} width={w - 2} height={1} fill={ramp[0]} />
      {children}
    </g>
  );
}

/** Pixel-font text. Sizes are grid units (one pixel-font glyph is ~`size` wide). */
function Text({ x, y, children, size = 5, fill = INK, anchor = "start" }: { x: number; y: number; children: ReactNode; size?: number; fill?: string; anchor?: "start" | "middle" | "end" }) {
  return (
    <text x={x} y={y} fontSize={size} fill={fill} textAnchor={anchor} style={{ fontFamily: "var(--font-pixel)" }}>
      {children}
    </text>
  );
}

/** A labelled block with centred text (one or two lines). */
function Card({ x, y, w, h, ramp = CREAM, lines, size = 5, ink = INK }: { x: number; y: number; w: number; h: number; ramp?: Ramp; lines: string[]; size?: number; ink?: string }) {
  const top = y + h / 2 - ((lines.length - 1) * (size + 2)) / 2 + size / 2;
  return (
    <Block x={x} y={y} w={w} h={h} ramp={ramp}>
      {lines.map((l, i) => (
        <Text key={i} x={x + w / 2} y={top + i * (size + 2)} size={size} fill={ink} anchor="middle">
          {l}
        </Text>
      ))}
    </Block>
  );
}

/** A 2-unit-thick axis-aligned pixel arrow with a stepped head. */
function Arrow({ x1, y1, x2, y2, color = "#ffe27a" }: { x1: number; y1: number; x2: number; y2: number; color?: string }) {
  const horiz = y1 === y2;
  const dir = Math.sign(horiz ? x2 - x1 : y2 - y1);
  const len = Math.abs(horiz ? x2 - x1 : y2 - y1);
  const rects: [number, number, number, number][] = [];
  // shaft, stopping short of the head
  if (horiz) rects.push([Math.min(x1, x2 - dir * 3), y1 - 1, len - 3, 2]);
  else rects.push([x1 - 1, Math.min(y1, y2 - dir * 3), 2, len - 3]);
  // head: three steps narrowing towards the tip
  for (let s = 0; s < 3; s++) {
    const half = 3 - s;
    if (horiz) rects.push([x2 - dir * (3 - s) - (dir < 0 ? 0 : 1), y1 - half, 1, half * 2]);
    else rects.push([x1 - half, y2 - dir * (3 - s) - (dir < 0 ? 0 : 1), half * 2, 1]);
  }
  return (
    <g>
      {rects.map(([x, y, w, h], i) => (
        <rect key={`s${i}`} x={x - 0.5} y={y - 0.5} width={w + 1} height={h + 1} fill={INK} />
      ))}
      {rects.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={color} />
      ))}
    </g>
  );
}

/** A band of background with a title tag in its top-left corner. */
function Band({ y, h, ramp, title, tag }: { y: number; h: number; ramp: Ramp; title: string; tag?: string }) {
  return (
    <g>
      <rect x={0} y={y} width={W} height={h} fill={ramp[1]} />
      <rect x={0} y={y} width={W} height={1} fill={ramp[2]} />
      {/* dither row for a little texture */}
      {Array.from({ length: W / 4 }, (_, i) => (
        <rect key={i} x={i * 4 + ((y / 2) % 2) * 2} y={y + h - 2} width={1} height={1} fill={ramp[0]} />
      ))}
      <Text x={3} y={y + 7} size={5} fill="#f8f4e6">
        {title}
      </Text>
      {tag && (
        <g>
          <rect x={W - 30} y={y + 2} width={27} height={7} fill={INK} />
          <Text x={W - 16.5} y={y + 7.5} size={4} fill="#ffe27a" anchor="middle">
            {tag}
          </Text>
        </g>
      )}
    </g>
  );
}

/** User mode above, kernel mode below, a gate in the wall between them. */
function Modes() {
  return (
    <>
      <Band y={0} h={50} ramp={BLUE} title="USER MODE" tag="BIT 1" />
      {["APP", "SHELL", "GAME"].map((l, i) => (
        <Card key={l} x={12 + i * 56} y={14} w={44} h={18} lines={[l]} />
      ))}
      <Text x={3} y={45} size={4} fill="#cfe4ff">
        NO PRIVILEGED OPS
      </Text>
      {/* the wall between the modes, with a gate */}
      <rect x={0} y={50} width={W} height={10} fill={INK} />
      {Array.from({ length: 18 }, (_, i) => (
        <rect key={i} x={i * 10 + (i % 2) * 0} y={51} width={9} height={4} fill={STONE[1]} />
      ))}
      {Array.from({ length: 18 }, (_, i) => (
        <rect key={i} x={i * 10 + 5} y={55} width={9} height={4} fill={STONE[0]} />
      ))}
      <rect x={78} y={49} width={24} height={12} fill={INK} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={80 + i * 5} y={50} width={1} height={10} fill={GOLD[1]} />
      ))}
      <rect x={79} y={54} width={22} height={1} fill={GOLD[1]} />
      <Band y={60} h={36} ramp={PURPLE} title="KERNEL MODE" tag="BIT 0" />
      <Arrow x1={84} y1={36} x2={84} y2={76} color="#ffe27a" />
      <Text x={80} y={73} size={4} fill="#ffe27a" anchor="end">
        TRAP
      </Text>
      <Arrow x1={96} y1={76} x2={96} y2={36} color="#7cf0c8" />
      <Text x={100} y={73} size={4} fill="#7cf0c8">
        RETURN
      </Text>
      {["SCHED", "MEMORY", "DRIVERS"].map((l, i) => (
        <Card key={l} x={8 + i * 60} y={78} w={44} h={14} lines={[l]} ramp={GOLD} />
      ))}
      <rect x={0} y={96} width={W} height={16} fill={STONE[0]} />
      <rect x={0} y={96} width={W} height={1} fill={STONE[2]} />
      <Text x={90} y={107} size={5} fill="#f8f4e6" anchor="middle">
        HARDWARE · CPU RAM DISK
      </Text>
    </>
  );
}

/** read(): wrapper → trap → system-call table → handler → return. */
function Syscall() {
  const rows = ["0 read", "1 write", "2 open", "3 close"];
  return (
    <>
      <Band y={0} h={46} ramp={BLUE} title="USER SPACE" />
      <Card x={6} y={14} w={66} h={26} lines={["PROGRAM", "read(fd,buf,n)"]} size={4} />
      <Card x={100} y={14} w={74} h={26} lines={["C LIBRARY", "rax=0, args", "in registers"]} size={4} />
      <Arrow x1={73} y1={27} x2={99} y2={27} />
      <rect x={0} y={46} width={W} height={2} fill={INK} />
      {Array.from({ length: 30 }, (_, i) => (
        <rect key={i} x={i * 6} y={46} width={3} height={2} fill="#ffe27a" />
      ))}
      <Band y={48} h={64} ramp={PURPLE} title="KERNEL" />
      {/* the trap */}
      <Arrow x1={150} y1={41} x2={150} y2={62} />
      <rect x={152} y={46} width={28} height={8} fill={INK} />
      <Text x={166} y={52} size={4} fill="#ffe27a" anchor="middle">
        syscall
      </Text>
      {/* the system-call table */}
      <Block x={108} y={62} w={66} h={46} ramp={CREAM}>
        <Text x={141} y={69} size={4} anchor="middle">
          SYSCALL TABLE
        </Text>
        {rows.map((r, i) => (
          <g key={r}>
            <rect x={111} y={72 + i * 9} width={60} height={8} fill={i === 0 ? "#ffe27a" : "#e8e0cc"} />
            <Text x={114} y={78 + i * 9} size={4}>
              {r}
            </Text>
          </g>
        ))}
      </Block>
      <Arrow x1={107} y1={76} x2={76} y2={76} />
      <Card x={8} y={64} w={66} h={22} lines={["sys_read()", "HANDLER"]} size={4} ramp={GOLD} />
      {/* return from the trap */}
      <Arrow x1={40} y1={63} x2={40} y2={41} color="#7cf0c8" />
      <Text x={44} y={58} size={4} fill="#7cf0c8">
        RETURN
      </Text>
      <Text x={44} y={64} size={3.5} fill="#cfe4ff">
        result in rax
      </Text>
    </>
  );
}

/** Devices raise IRQs; the CPU saves state and jumps through the vector. */
function Interrupt() {
  const devices: [string, Ramp][] = [
    ["DISK", STONE],
    ["KEYBOARD", TEAL],
    ["TIMER", RED],
  ];
  const vec = ["0 DIVIDE ERROR", "14 PAGE FAULT", "· · ·", "n KEYBOARD"];
  return (
    <>
      <rect x={0} y={0} width={W} height={H} fill="#22184a" />
      {Array.from({ length: 40 }, (_, i) => (
        <rect key={i} x={(i * 37) % W} y={(i * 23) % H} width={1} height={1} fill="#3a2c6e" />
      ))}
      {devices.map(([d, r], i) => (
        <g key={d}>
          <Card x={4} y={8 + i * 22} w={44} h={16} lines={[d]} size={4} ramp={r} ink="#f8f4e6" />
          <rect x={48} y={15 + i * 22} width={8} height={2} fill="#ffe27a" />
        </g>
      ))}
      <rect x={55} y={15} width={2} height={46} fill="#ffe27a" />
      <Arrow x1={56} y1={39} x2={63} y2={39} />
      <Text x={56} y={9} size={4} fill="#ffe27a" anchor="middle">
        IRQ
      </Text>
      {/* the CPU chip */}
      <Block x={64} y={24} w={34} h={30} ramp={GREEN}>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x={68 + i * 7} y={21} width={3} height={3} fill={STONE[2]} />
            <rect x={68 + i * 7} y={54} width={3} height={3} fill={STONE[2]} />
          </g>
        ))}
        <Text x={81} y={38} size={5} fill="#f8f4e6" anchor="middle">
          CPU
        </Text>
        <Text x={81} y={46} size={3.5} fill="#e8ffe0" anchor="middle">
          save PC
        </Text>
      </Block>
      {/* interrupt vector */}
      <Block x={110} y={4} w={66} h={52} ramp={CREAM}>
        <Text x={143} y={11} size={4} anchor="middle">
          VECTOR TABLE
        </Text>
        {vec.map((v, i) => (
          <g key={v}>
            <rect x={113} y={14 + i * 9} width={60} height={8} fill={i === 3 ? "#ffe27a" : "#e8e0cc"} />
            <Text x={115} y={20 + i * 9} size={3.5}>
              {v}
            </Text>
          </g>
        ))}
      </Block>
      <Arrow x1={99} y1={39} x2={109} y2={39} />
      <Arrow x1={143} y1={57} x2={143} y2={72} />
      <Card x={110} y={73} w={66} h={18} lines={["KERNEL HANDLER"]} size={4} ramp={GOLD} />
      <Arrow x1={109} y1={82} x2={82} y2={82} color="#7cf0c8" />
      <Card x={6} y={73} w={74} h={18} lines={["RESTORE + RESUME"]} size={4} ramp={TEAL} ink="#f8f4e6" />
      <Text x={90} y={104} size={4} fill="#cfc4ff" anchor="middle">
        TRAPS USE THE SAME TABLE
      </Text>
    </>
  );
}

/** Three kernel designs side by side. */
function Kernels() {
  const col = (x: number, title: string, user: string[], kernel: string[], kh: number) => (
    <g>
      <Text x={x + 28} y={8} size={4.5} fill="#ffe27a" anchor="middle">
        {title}
      </Text>
      <Block x={x} y={12} w={56} h={84 - kh} ramp={BLUE}>
        <Text x={x + 3} y={19} size={3.5} fill="#cfe4ff">
          USER
        </Text>
        {user.map((u, i) => (
          <Card key={u} x={x + 4} y={22 + i * 11} w={48} h={10} lines={[u]} size={3.5} ramp={u === "APPS" ? CREAM : TEAL} ink={u === "APPS" ? INK : "#f8f4e6"} />
        ))}
      </Block>
      <Block x={x} y={96 - kh} w={56} h={kh} ramp={PURPLE}>
        <Text x={x + 3} y={103 - kh} size={3.5} fill="#e0d4ff">
          KERNEL
        </Text>
        {kernel.map((k, i) => (
          <rect key={k} x={x + 4 + (i % 2) * 25} y={105 - kh + Math.floor(i / 2) * 9} width={23} height={8} fill={GOLD[1]} />
        ))}
        {kernel.map((k, i) => (
          <Text key={`t${k}`} x={x + 15.5 + (i % 2) * 25} y={111 - kh + Math.floor(i / 2) * 9} size={3.5} anchor="middle">
            {k}
          </Text>
        ))}
      </Block>
    </g>
  );
  return (
    <>
      <rect x={0} y={0} width={W} height={H} fill="#22184a" />
      {col(2, "MONOLITHIC", ["APPS"], ["SCHED", "MEM", "FS", "DRV", "NET", "IPC"], 40)}
      {col(62, "MICRO", ["APPS", "FS", "DRIVERS", "NET"], ["IPC", "SCHED", "MEM"], 29)}
      {col(122, "HYBRID", ["APPS", "SERVERS"], ["IPC", "SCHED", "MEM", "FS", "DRV"], 37)}
      <rect x={0} y={98} width={W} height={14} fill={STONE[0]} />
      <rect x={0} y={98} width={W} height={1} fill={STONE[2]} />
      <Text x={90} y={107} size={4} fill="#f8f4e6" anchor="middle">
        HARDWARE
      </Text>
    </>
  );
}

/** Power → firmware → boot loader → kernel → init, as rising steps. */
function Boot() {
  const steps: [string, string, Ramp][] = [
    ["FIRMWARE", "UEFI", STONE],
    ["POST", "checks", TEAL],
    ["BOOT", "LOADER", GREEN],
    ["KERNEL", "loads", PURPLE],
    ["INIT", "PID 1", GOLD],
  ];
  return (
    <>
      <rect x={0} y={0} width={W} height={H} fill="#1b1446" />
      <rect x={0} y={70} width={W} height={42} fill="#251a5c" />
      {Array.from({ length: 30 }, (_, i) => (
        <rect key={i} x={(i * 53) % W} y={(i * 17) % 60} width={1} height={1} fill="#6b5ab0" />
      ))}
      {/* the power button */}
      <Block x={4} y={84} w={18} h={18} ramp={RED}>
        <rect x={12} y={88} width={2} height={6} fill="#f8f4e6" />
        <rect x={9} y={91} width={1} height={6} fill="#f8f4e6" />
        <rect x={16} y={91} width={1} height={6} fill="#f8f4e6" />
        <rect x={10} y={97} width={6} height={1} fill="#f8f4e6" />
      </Block>
      <Text x={13} y={109} size={3.5} fill="#f8a0a8" anchor="middle">
        POWER
      </Text>
      {steps.map(([a, b, r], i) => {
        const x = 26 + i * 31;
        const y = 78 - i * 15;
        const ink = r === GOLD ? INK : "#f8f4e6";
        return (
          <g key={a}>
            <rect x={x} y={y + 22} width={29} height={110 - y - 22} fill={INK} />
            <rect x={x + 1} y={y + 23} width={27} height={110 - y - 24} fill={r[0]} />
            <Card x={x} y={y} w={29} h={22} lines={[a, b]} size={3} ramp={r} ink={ink} />
            <Text x={x + 14.5} y={y + 31} size={5} fill="#ffe27a" anchor="middle">
              {i + 1}
            </Text>
          </g>
        );
      })}
      {steps.slice(1).map((_, i) => (
        <Arrow key={i} x1={26 + i * 31 + 22} y1={74 - i * 15} x2={26 + (i + 1) * 31 + 6} y2={74 - i * 15} />
      ))}
      <Arrow x1={22} y1={93} x2={30} y2={93} />
    </>
  );
}

const DIAGRAMS: Record<DiagramId, { title: string; draw: () => ReactNode }> = {
  modes: {
    title: "User mode and kernel mode, separated by the mode bit",
    draw: Modes,
  },
  syscall: { title: "The path of a read() system call", draw: Syscall },
  interrupt: {
    title: "Devices raise interrupts; the CPU jumps through the vector table",
    draw: Interrupt,
  },
  kernels: { title: "Monolithic, micro and hybrid kernels", draw: Kernels },
  boot: { title: "The boot chain from power-on to init", draw: Boot },
};

export const DIAGRAM_IDS = Object.keys(DIAGRAMS) as DiagramId[];

export function Diagram({ id, className = "" }: { id: DiagramId; className?: string }) {
  const d = DIAGRAMS[id];
  return (
    <svg role="img" aria-label={d.title} viewBox={`0 0 ${W} ${H}`} shapeRendering="crispEdges" className={`block h-auto w-full ${className}`} data-testid={`diagram-${id}`}>
      {d.draw()}
    </svg>
  );
}
