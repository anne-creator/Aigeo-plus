// Decorative, deterministic SVG scenery. No timers, network requests or project state.
const towers = [
  { x: -30, w: 150, y: 382 }, { x: 108, w: 116, y: 475 },
  { x: 215, w: 142, y: 285 }, { x: 345, w: 118, y: 433 },
  { x: 450, w: 163, y: 355 }, { x: 604, w: 108, y: 494 },
  { x: 702, w: 154, y: 259 }, { x: 849, w: 181, y: 179 },
  { x: 1019, w: 124, y: 384 }, { x: 1135, w: 170, y: 304 },
  { x: 1294, w: 130, y: 458 },
];
export function NightCity() {
  return <div className="workspace-background" aria-hidden="true"><svg className="night-city" viewBox="0 0 1341 958" preserveAspectRatio="xMidYMid slice" focusable="false">
    <defs>
      <linearGradient id="city-sky" x2="0" y2="1"><stop stopColor="#020916"/><stop offset=".55" stopColor="#082951"/><stop offset="1" stopColor="#103a65"/></linearGradient>
      <radialGradient id="city-halo"><stop stopColor="#279bff" stopOpacity=".35"/><stop offset="1" stopColor="#147dff" stopOpacity="0"/></radialGradient>
      <linearGradient id="city-face" x2="1" y2=".4"><stop stopColor="#071a30"/><stop offset=".55" stopColor="#113659"/><stop offset="1" stopColor="#081a30"/></linearGradient>
      <linearGradient id="city-side"><stop stopColor="#061426"/><stop offset="1" stopColor="#030d1e"/></linearGradient>
      <linearGradient id="city-sweep" x2="0" y2="1"><stop stopColor="#4ca9ff" stopOpacity="0"/><stop offset=".5" stopColor="#4ca9ff" stopOpacity=".22"/><stop offset="1" stopColor="#4ca9ff" stopOpacity="0"/></linearGradient>
      <linearGradient id="city-ground" x2="0" y2="1"><stop stopColor="#020d20" stopOpacity="0"/><stop offset="1" stopColor="#020a19" stopOpacity=".85"/></linearGradient>
      <filter id="city-glow"><feGaussianBlur stdDeviation="3"/></filter>
      <clipPath id="city-buildings">{towers.map(t => <rect key={t.x} x={t.x} y={t.y} width={t.w} height={958 - t.y}/>)}</clipPath>
    </defs>
    <path fill="url(#city-sky)" d="M0 0h1341v958H0z"/>
    <ellipse className="city-atmosphere" cx="880" cy="380" rx="640" ry="440" fill="url(#city-halo)"/>
    {Array.from({ length: 42 }, (_, i) => <circle key={i} cx={(i * 197 + 31) % 1341} cy={(i * 83 + 19) % 350} r={i % 4 === 0 ? 1.1 : .6} fill="#b9dfff" opacity={.15 + i % 5 * .07}/>)}
    <g opacity=".36">{Array.from({ length: 26 }, (_, i) => <g key={i}><rect x={i * 56 - 20} y={420 + (i * 37) % 170} width={33 + i % 4 * 8} height="530" fill="#0a203b"/><path d={`M${i * 56} ${440 + (i * 37) % 170}v430`} stroke="#479acb" strokeWidth="2" strokeDasharray="2 13"/></g>)}</g>
    {towers.map((t, index) => <g key={t.x}>
      <path d={`M${t.x} ${t.y + 18}l${t.w - 24} -18 24 18v${958 - t.y}H${t.x}z`} fill="url(#city-face)"/>
      <path d={`M${t.x + t.w - 24} ${t.y}l24 18v${958 - t.y}h-24z`} fill="url(#city-side)"/>
      <path d={`M${t.x + 2} 958V${t.y + 18}l${t.w - 26} -18v${958 - t.y}`} fill="none" stroke="#399eff" opacity=".3"/>
      <path d={`M${t.x + 2} ${t.y + 18}l${t.w - 26} -18 24 18`} fill="none" stroke="#64d5ff" strokeWidth="2" opacity=".8"/>
      <path d={`M${t.x + 2} ${t.y + 18}l${t.w - 26} -18 24 18`} fill="none" stroke="#279eff" strokeWidth="8" opacity=".65" filter="url(#city-glow)"/>
      {index === 7 && <><path d="M939 170v-75" stroke="#53a6e1" strokeWidth="2"/><circle className="city-beacon" cx="939" cy="95" r="3" fill="#8ae8ff"/><path d="M908 181v-16h61v16" fill="#0e2b48" stroke="#3b98da"/></>}
      {[0, 1, 2].map(group => <g key={group} className="city-windows" style={{ animationDuration: `${7 + (index + group) % 6}s`, animationDelay: `${-index * 1.7 - group * 2.3}s` }}>
        {Array.from({ length: Math.floor((940 - t.y) / 19) }, (_, row) => Array.from({ length: Math.floor((t.w - 38) / 14) }, (_, col) => {
          const seed = row * 17 + col * 31 + index * 13;
          if (seed % 3 !== group || seed % 7 < 2) return null;
          return <rect key={`${row}-${col}`} x={t.x + 10 + col * 14} y={t.y + 32 + row * 19} width={seed % 5 === 0 ? 8 : 5} height="3" rx=".5" fill={seed % 13 === 0 ? '#d8e8cd' : seed % 4 === 0 ? '#57c7ff' : '#2c7dbd'} opacity={seed % 4 === 0 ? .85 : .5}/>;
        }))}
      </g>)}
    </g>)}
    <g clipPath="url(#city-buildings)"><rect className="city-light-sweep" x="0" y="-240" width="1341" height="240" fill="url(#city-sweep)"/></g>
    <path fill="url(#city-ground)" d="M0 650h1341v308H0z"/>
  </svg></div>;
}
