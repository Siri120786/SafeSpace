import React from "react";
import { SLOT_X, type StoryBackground } from "../storyScript";
import { SEAT_HEIGHT } from "./Characters";

// Flat backgrounds on a 1600 x 900 stage; the floor line is at y = 800, where
// characters stand. Seats line up with the places characters sit.
export const STAGE_W = 1600;
export const STAGE_H = 900;
export const FLOOR_Y = 800;

const Plant: React.FC<{ x: number; y: number; s?: number }> = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-30 0 h60 l-8 70 h-44 z" fill="#D9A27A" />
    {[[-40, -60, -25], [40, -60, 25], [0, -90, 0], [-20, -70, -12], [22, -74, 12]].map(([lx, ly, r], i) => (
      <ellipse key={i} cx={lx / 2} cy={ly / 2} rx={16} ry={44} fill={i % 2 ? "#6E9E5A" : "#7FB26A"} transform={`rotate(${r} ${lx / 2} ${ly / 2 + 30})`} />
    ))}
  </g>
);

const Window: React.FC<{ x: number; y: number; w: number; h: number; curtains?: string }> = ({ x, y, w, h, curtains }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={8} fill="#CFE8F5" stroke="#FFFFFF" strokeWidth={12} />
    <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} stroke="#FFFFFF" strokeWidth={8} />
    <line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} stroke="#FFFFFF" strokeWidth={8} />
    <circle cx={x + w * 0.75} cy={y + h * 0.25} r={26} fill="#FFF3C4" opacity={0.8} />
    {curtains && (
      <g fill={curtains}>
        <path d={`M${x - 30} ${y - 20} h${w * 0.32} q-20 ${h * 0.6} 10 ${h + 40} h${-w * 0.32 - 10} z`} />
        <path d={`M${x + w + 30} ${y - 20} h${-w * 0.32} q20 ${h * 0.6} -10 ${h + 40} h${w * 0.32 + 10} z`} />
      </g>
    )}
  </g>
);

const Frame: React.FC<{ x: number; y: number; w: number; h: number; fill: string }> = ({ x, y, w, h, fill }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={6} fill="#8A5A44" />
    <rect x={x + 10} y={y + 10} width={w - 20} height={h - 20} rx={4} fill={fill} />
  </g>
);

const Floor: React.FC<{ fill: string; line?: string }> = ({ fill, line }) => (
  <g>
    <rect x={0} y={FLOOR_Y - 60} width={STAGE_W} height={STAGE_H - FLOOR_Y + 60} fill={fill} />
    {line && <rect x={0} y={FLOOR_Y - 64} width={STAGE_W} height={8} fill={line} />}
  </g>
);

const Tooth: React.FC<{ x: number; y: number; s?: number }> = ({ x, y, s = 1 }) => (
  <path
    transform={`translate(${x} ${y}) scale(${s})`}
    d="M-30 -30 q-18 0 -18 22 q0 26 12 52 q6 14 12 0 l8 -26 q6 -8 12 0 l8 26 q6 14 12 0 q12 -26 12 -52 q0 -22 -18 -22 q-12 0 -20 6 q-8 -6 -20 -6 z"
    fill="#FFFFFF"
    stroke="#9FCFD6"
    strokeWidth={4}
  />
);

// Seat tops are all SEAT_HEIGHT above the floor, where sitting characters land.
const Chair: React.FC<{ x: number; color: string }> = ({ x, color }) => (
  <g transform={`translate(${x} ${FLOOR_Y})`}>
    <rect x={-100} y={-SEAT_HEIGHT - 190} width={200} height={200} rx={34} fill={color} />
    <rect x={-115} y={-SEAT_HEIGHT} width={230} height={56} rx={22} fill={color} />
    <rect x={-90} y={-SEAT_HEIGHT + 50} width={16} height={SEAT_HEIGHT - 50} fill="#9A8C7A" />
    <rect x={74} y={-SEAT_HEIGHT + 50} width={16} height={SEAT_HEIGHT - 50} fill="#9A8C7A" />
  </g>
);

const Home: React.FC = () => (
  <g>
    <rect width={STAGE_W} height={STAGE_H} fill="#F6E7D4" />
    <Window x={120} y={120} w={300} h={300} curtains="#F2B8A6" />
    <Frame x={660} y={140} w={150} h={110} fill="#BFD9C4" />
    <Frame x={840} y={160} w={110} h={150} fill="#F2D7A6" />
    <g transform="translate(1000 520)">
      <rect x={0} y={-120} width={480} height={150} rx={40} fill="#EFE5D8" />
      <rect x={-20} y={0} width={520} height={110} rx={30} fill="#F7EFE4" />
      <rect x={40} y={-60} width={110} height={80} rx={20} fill="#F5C26B" />
      <rect x={330} y={-60} width={110} height={80} rx={20} fill="#F2A7A0" />
    </g>
    <Plant x={1530} y={590} s={1.1} />
    <Floor fill="#D9B48F" line="#C9A07A" />
    <ellipse cx={800} cy={FLOOR_Y + 30} rx={520} ry={60} fill="#E8C9A8" />
  </g>
);

const FrontDoor: React.FC = () => (
  <g>
    <rect width={STAGE_W} height={STAGE_H} fill="#F3E3CF" />
    <g transform="translate(980 140)">
      <rect x={0} y={0} width={340} height={600} rx={10} fill="#FFF6DD" />
      <rect x={0} y={0} width={340} height={600} rx={10} fill="none" stroke="#B7835E" strokeWidth={18} />
      <path d="M20 10 l150 40 v520 l-150 30 z" fill="#C8956B" />
      <circle cx={150} cy={330} r={10} fill="#E8C35A" />
      <Plant x={260} y={520} s={0.8} />
    </g>
    <g transform="translate(200 560)">
      <rect x={0} y={0} width={260} height={180} rx={10} fill="#C9A07A" />
      <rect x={14} y={40} width={232} height={8} fill="#A97F5C" />
      <rect x={14} y={100} width={232} height={8} fill="#A97F5C" />
      <ellipse cx={70} cy={30} rx={34} ry={14} fill="#E06C5A" />
      <ellipse cx={170} cy={92} rx={34} ry={14} fill="#5A86C9" />
    </g>
    <Window x={520} y={150} w={240} h={240} curtains="#F2B8A6" />
    <Floor fill="#D9B48F" line="#C9A07A" />
    <rect x={960} y={FLOOR_Y - 20} width={380} height={40} rx={14} fill="#9CBF8A" />
  </g>
);

const ClinicOutside: React.FC = () => (
  <g>
    <defs>
      <linearGradient id="st-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#BFE3F6" />
        <stop offset="1" stopColor="#EAF6FB" />
      </linearGradient>
    </defs>
    <rect width={STAGE_W} height={STAGE_H} fill="url(#st-sky)" />
    <ellipse cx={260} cy={150} rx={110} ry={40} fill="#fff" opacity={0.9} />
    <ellipse cx={1340} cy={110} rx={130} ry={44} fill="#fff" opacity={0.9} />
    <g transform="translate(360 180)">
      <rect x={0} y={0} width={880} height={560} rx={16} fill="#F7F4EE" />
      <rect x={0} y={0} width={880} height={80} rx={16} fill="#8CCFC6" />
      <Tooth x={440} y={40} s={0.55} />
      <rect x={340} y={220} width={200} height={340} rx={10} fill="#CFEDEF" stroke="#BFD6D8" strokeWidth={8} />
      <line x1={440} y1={220} x2={440} y2={560} stroke="#BFD6D8" strokeWidth={6} />
      <rect x={60} y={200} width={220} height={180} rx={10} fill="#CFEDEF" />
      <rect x={600} y={200} width={220} height={180} rx={10} fill="#CFEDEF" />
    </g>
    <Plant x={300} y={600} s={1.2} />
    <Plant x={1300} y={600} s={1.2} />
    <Floor fill="#D8D2C6" line="#C4BDB0" />
  </g>
);

const WaitingRoom: React.FC = () => (
  <g>
    <rect width={STAGE_W} height={STAGE_H} fill="#E3F2EE" />
    <Window x={980} y={130} w={360} h={260} />
    <Frame x={640} y={170} w={170} h={120} fill="#F7E3B5" />
    <Chair x={SLOT_X.left} color="#A8D5C9" />
    <Chair x={SLOT_X.midleft} color="#F3C6C2" />
    <g transform="translate(1140 520)">
      <rect x={0} y={0} width={360} height={240} rx={10} fill="#E6C9A3" />
      <rect x={10} y={110} width={340} height={10} fill="#CDAE86" />
      <circle cx={70} cy={80} r={30} fill="#F2A65A" />
      <rect x={140} y={50} width={60} height={60} rx={6} fill="#6FA3D9" />
      <rect x={230} y={40} width={30} height={70} rx={4} fill="#E06C5A" />
      <rect x={270} y={50} width={30} height={60} rx={4} fill="#7FB26A" />
      <rect x={40} y={150} width={90} height={60} rx={8} fill="#F5D46B" />
      <circle cx={220} cy={180} r={30} fill="#B9A7D9" />
    </g>
    <Floor fill="#CFE3DA" line="#B9D3C7" />
  </g>
);

const DentalRoom: React.FC = () => (
  <g>
    <rect width={STAGE_W} height={STAGE_H} fill="#E6F4F3" />
    <Window x={100} y={130} w={280} h={240} />
    <g transform="translate(1180 160)">
      <rect x={0} y={0} width={180} height={220} rx={10} fill="#FFFFFF" stroke="#BFD6D8" strokeWidth={6} />
      <Tooth x={90} y={100} s={1.1} />
    </g>
    <g transform="translate(1250 560)">
      <rect x={0} y={0} width={300} height={200} rx={10} fill="#F2E3CC" />
      <rect x={0} y={0} width={300} height={24} rx={8} fill="#E0CDB0" />
      <rect x={140} y={40} width={10} height={140} fill="#E0CDB0" />
    </g>
    {/* The dental chair, centre stage: Kai sits here. */}
    <g transform={`translate(${SLOT_X.center} ${FLOOR_Y})`}>
      <path d="M-40 -90 h80 l24 90 h-128 z" fill="#B8C4C6" />
      <rect x={-200} y={-SEAT_HEIGHT} width={400} height={70} rx={30} fill="#7CCAC3" />
      <path d={`M-210 ${-SEAT_HEIGHT + 30} q-50 -120 -10 -330 q24 -36 74 0 q-24 170 10 300 z`} fill="#7CCAC3" />
      <rect x={150} y={-SEAT_HEIGHT + 20} width={160} height={46} rx={20} fill="#7CCAC3" />
    </g>
    <g stroke="#B8C4C6" strokeWidth={14} strokeLinecap="round" fill="none">
      <path d={`M${SLOT_X.center + 260} ${FLOOR_Y - 60} v-520 h-220`} />
    </g>
    <ellipse cx={SLOT_X.center + 40} cy={FLOOR_Y - 580} rx={70} ry={30} fill="#F2F2F2" stroke="#B8C4C6" strokeWidth={8} />
    <Floor fill="#D6E7E5" line="#C2D9D6" />
  </g>
);

// The examination bed, centre stage: Kai sits here.
const DoctorRoom: React.FC = () => (
  <g>
    <rect width={STAGE_W} height={STAGE_H} fill="#EEF1F8" />
    <Window x={110} y={130} w={260} h={230} />
    {/* Eye chart */}
    <g transform="translate(1160 140)">
      <rect x={0} y={0} width={170} height={240} rx={8} fill="#FFFFFF" stroke="#C9D2E3" strokeWidth={6} />
      {[[34, 50, 46], [26, 110, 36], [20, 160, 30], [14, 200, 26]].map(([size, y, w], i) => (
        <rect key={i} x={85 - w} y={y - size / 2} width={w * 2} height={size * 0.6} rx={3} fill="#5B6B8C" opacity={0.75} />
      ))}
    </g>
    {/* Height chart */}
    <g transform="translate(470 180)">
      <rect x={0} y={0} width={46} height={560} rx={8} fill="#F7E3B5" />
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={0} y={30 + i * 52} width={i % 2 ? 18 : 28} height={5} fill="#C9A86A" />
      ))}
    </g>
    {/* Sink cabinet */}
    <g transform="translate(1250 560)">
      <rect x={0} y={0} width={290} height={200} rx={10} fill="#DCE3EF" />
      <rect x={0} y={0} width={290} height={24} rx={8} fill="#C9D2E3" />
      <rect x={60} y={-46} width={12} height={50} rx={6} fill="#9AA6B8" />
      <rect x={140} y={40} width={10} height={140} fill="#C9D2E3" />
    </g>
    <g transform={`translate(${SLOT_X.center} ${FLOOR_Y})`}>
      <rect x={-230} y={-SEAT_HEIGHT} width={460} height={60} rx={22} fill="#8FB5E0" />
      <rect x={-230} y={-SEAT_HEIGHT - 14} width={460} height={20} rx={10} fill="#FFFFFF" opacity={0.9} />
      <path d={`M-230 ${-SEAT_HEIGHT - 4} q-20 -70 30 -110 h80 q-40 40 -20 110 z`} fill="#8FB5E0" />
      <rect x={-200} y={-SEAT_HEIGHT + 60} width={20} height={SEAT_HEIGHT - 60} fill="#9AA6B8" />
      <rect x={180} y={-SEAT_HEIGHT + 60} width={20} height={SEAT_HEIGHT - 60} fill="#9AA6B8" />
    </g>
    <Floor fill="#DCE1EA" line="#C9D0DC" />
  </g>
);

// Children sit on the small chairs at midleft and midright.
const Classroom: React.FC = () => (
  <g>
    <rect width={STAGE_W} height={STAGE_H} fill="#FBF1DC" />
    {/* The board */}
    <g transform="translate(470 110)">
      <rect x={-14} y={-14} width={688} height={348} rx={12} fill="#B98A5E" />
      <rect x={0} y={0} width={660} height={320} rx={6} fill="#3F6B5A" />
      <path d="M60 90 q40 -40 80 0 t80 0" fill="none" stroke="#F4F1E6" strokeWidth={6} strokeLinecap="round" opacity={0.85} />
      <text x={330} y={210} textAnchor="middle" fontSize={64} fontFamily="sans-serif" fill="#F4F1E6" opacity={0.85}>1 2 3</text>
      <rect x={480} y={300} width={60} height={12} rx={4} fill="#F4F1E6" />
    </g>
    {/* Alphabet strip */}
    <g>
      {["#E06C5A", "#F5C26B", "#7FB26A", "#6FA3D9", "#B9A7D9", "#F2A7A0"].map((c, i) => (
        <rect key={i} x={60 + i * 62} y={60} width={52} height={52} rx={8} fill={c} />
      ))}
      {["#6FA3D9", "#B9A7D9", "#F2A7A0", "#E06C5A", "#F5C26B", "#7FB26A"].map((c, i) => (
        <rect key={i} x={1180 + i * 62} y={60} width={52} height={52} rx={8} fill={c} />
      ))}
    </g>
    {/* Clock */}
    <g transform="translate(1300 230)">
      <circle r={62} fill="#FFFFFF" stroke="#B98A5E" strokeWidth={10} />
      <path d="M0 0 V-38 M0 0 L28 14" stroke="#2B1D17" strokeWidth={7} strokeLinecap="round" />
    </g>
    <Window x={90} y={180} w={260} h={220} />
    {/* Shelf with books */}
    <g transform="translate(1180 520)">
      <rect x={0} y={0} width={340} height={240} rx={10} fill="#D9B48F" />
      <rect x={10} y={110} width={320} height={10} fill="#C29A74" />
      {[["#E06C5A", 30], ["#6FA3D9", 70], ["#F5C26B", 110], ["#7FB26A", 150], ["#B9A7D9", 220], ["#F2A7A0", 260]].map(([c, x]) => (
        <rect key={x as number} x={x as number} y={30} width={30} height={80} rx={4} fill={c as string} />
      ))}
    </g>
    <Chair x={SLOT_X.midleft} color="#F5C26B" />
    <Chair x={SLOT_X.midright} color="#8CCFC6" />
    <Floor fill="#E3C9A2" line="#D2B48A" />
  </g>
);

// Someone can sit on the bench at the left.
const Playground: React.FC = () => (
  <g>
    <defs>
      <linearGradient id="st-sky-pg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#BFE3F6" />
        <stop offset="1" stopColor="#F1F9FC" />
      </linearGradient>
    </defs>
    <rect width={STAGE_W} height={STAGE_H} fill="url(#st-sky-pg)" />
    <circle cx={1420} cy={130} r={60} fill="#FFE7A0" />
    <ellipse cx={380} cy={130} rx={120} ry={40} fill="#fff" opacity={0.9} />
    <ellipse cx={980} cy={90} rx={100} ry={34} fill="#fff" opacity={0.9} />
    {/* School building, far back */}
    <g transform="translate(560 300)">
      <rect x={0} y={0} width={480} height={440} rx={10} fill="#F2D7B6" />
      <path d="M-30 10 L240 -90 L510 10 z" fill="#D98C6A" />
      {[40, 190, 340].map((x) => <rect key={x} x={x} y={70} width={100} height={90} rx={6} fill="#CFE8F5" />)}
      <rect x={190} y={260} width={100} height={180} rx={6} fill="#B98A5E" />
    </g>
    {/* Tree */}
    <g transform="translate(150 740)">
      <rect x={-22} y={-260} width={44} height={260} rx={12} fill="#9C6B47" />
      <circle cx={0} cy={-300} r={120} fill="#7FB26A" />
      <circle cx={-80} cy={-240} r={80} fill="#6E9E5A" />
      <circle cx={80} cy={-250} r={86} fill="#86BC70" />
    </g>
    {/* Swings */}
    <g transform="translate(330 300)" stroke="#C0392B" strokeWidth={14} strokeLinecap="round" fill="none">
      <path d="M0 440 L60 0 H300 L360 440" />
      <g stroke="#7A7A7A" strokeWidth={4}>
        <path d="M110 0 V300 M170 0 V300 M200 0 V300 M260 0 V300" />
      </g>
      <rect x={100} y={300} width={80} height={14} rx={6} fill="#F5C26B" stroke="none" />
      <rect x={190} y={300} width={80} height={14} rx={6} fill="#6FA3D9" stroke="none" />
    </g>
    {/* Slide */}
    <g transform="translate(1180 330)">
      <rect x={0} y={0} width={20} height={410} fill="#6FA3D9" />
      <rect x={110} y={0} width={20} height={410} fill="#6FA3D9" />
      {[60, 130, 200, 270, 340].map((y) => <rect key={y} x={0} y={y} width={130} height={12} fill="#9CC7F0" />)}
      <rect x={-10} y={-20} width={150} height={30} rx={8} fill="#F5C26B" />
      <path d="M130 0 Q260 120 330 410 L280 410 Q220 160 130 50 z" fill="#F2A65A" />
    </g>
    {/* Bench at the left slot */}
    <g transform={`translate(${SLOT_X.left} ${FLOOR_Y})`}>
      <rect x={-130} y={-SEAT_HEIGHT - 110} width={260} height={26} rx={10} fill="#B98A5E" />
      <rect x={-130} y={-SEAT_HEIGHT - 70} width={260} height={26} rx={10} fill="#B98A5E" />
      <rect x={-140} y={-SEAT_HEIGHT} width={280} height={34} rx={12} fill="#C99A6E" />
      <rect x={-110} y={-SEAT_HEIGHT + 30} width={18} height={SEAT_HEIGHT - 30} fill="#8A6A4E" />
      <rect x={92} y={-SEAT_HEIGHT + 30} width={18} height={SEAT_HEIGHT - 30} fill="#8A6A4E" />
    </g>
    <Floor fill="#A9D18E" line="#94C079" />
    <ellipse cx={1340} cy={FLOOR_Y + 20} rx={220} ry={40} fill="#F1DDB0" />
  </g>
);

export const StoryBackdrop: React.FC<{ id: StoryBackground }> = ({ id }) => {
  switch (id) {
    case "home":
      return <Home />;
    case "front_door":
      return <FrontDoor />;
    case "clinic_outside":
      return <ClinicOutside />;
    case "waiting_room":
      return <WaitingRoom />;
    case "dental_room":
      return <DentalRoom />;
    case "doctor_room":
      return <DoctorRoom />;
    case "classroom":
      return <Classroom />;
    case "playground":
      return <Playground />;
  }
};
