export const SYMBOLS = {k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙'};
export const PIECE_NAMES = {k:'King',q:'Queen',r:'Rook',b:'Bishop',n:'Knight',p:'Pawn'};
export const THEME_NAMES = {dragons:'Dragon stronghold',airfield:'U.S. airfield'};
export const ROLES = {
  airfield: {k:'Commander',q:'P-51 Mustang',r:'Sherman tank',b:'Radio tower',n:'Willys jeep',p:'Infantry helmet'},
  dragons: {k:'Dragon king',q:'Winged queen',r:'Dragon tower',b:'Mystic dragon',n:'Wyvern',p:'Hatchling'}
};
const military = {
  k:`<path d="M23 58 28 37 38 30h20l12 7 7 21Z" fill="#6e8153"/><path d="m25 48 20 10 5-10 5 10 18-10 5 22H18Z" fill="#465f39"/><path d="m37 37 11 15 12-15" fill="#b4b992"/><path d="M36 34V20q12-11 25 0v14q-12 14-25 0" fill="#d9b78b"/><path d="M32 22q1-18 17-18 18 0 19 18l-18 4Z" fill="#566b42"/><path d="M33 19h34v7H33Z" fill="#849269"/><path d="m49 8 2 4 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1Z" fill="#f5db87"/><path d="M42 30h2m10 0h2M45 38h8" stroke="#5a4939" stroke-width="2"/><path d="m27 55 6 6m33-6-6 6" stroke="#edd496" stroke-width="3"/>`,
  q:`<path d="m49 4 5 20 32 21v7L56 42l-2 23 13 8v5l-17-5-18 5v-5l13-8-2-23-29 10v-7l31-21Z" fill="#bac9c2" stroke="#4d675f" stroke-width="2"/><path d="M49 9v57" stroke="#f5e7bc" stroke-width="4"/><path d="M45 25q5-10 9 0v15h-9Z" fill="#2b586d"/><path d="m49 14 8 3-8 3-8-3Z" fill="#344c3a"/><circle cx="29" cy="45" r="5" fill="#243d4b"/><path d="m29 40 1.5 3 3.5.5-2.5 2.5.5 3.5-3-1.5-3 1.5.5-3.5-2.5-2.5 3.5-.5Z" fill="#fbf2d3"/><path d="M70 43v8M74 46v7" stroke="#a3543e" stroke-width="3"/>`,
  r:`<rect x="15" y="49" width="68" height="24" rx="11" fill="#293a31"/><path d="m21 43 51-1 9 16H14Z" fill="#7f9160" stroke="#344b37" stroke-width="2"/><path d="m33 23 31 2 4 18H29Z" fill="#627d4f" stroke="#344b37" stroke-width="2"/><path d="m57 29 31-10 3 7-30 13" fill="#8e9d76" stroke="#344b37" stroke-width="2"/><path d="M36 22v-5h17v8" fill="#8e9d76"/><circle cx="28" cy="61" r="7" fill="#778066"/><circle cx="44" cy="61" r="7" fill="#778066"/><circle cx="61" cy="61" r="7" fill="#778066"/><circle cx="75" cy="61" r="5" fill="#778066"/><path d="m45 34 2 4 5 1-4 3 1 4-4-2-4 2 1-4-4-3 5-1Z" fill="#f7edc9"/><path d="M24 47h21" stroke="#bac293" stroke-width="3"/>`,
  b:`<path d="m49 13-20 60h40Z" fill="#536c50" stroke="#b9c19c" stroke-width="3"/><path d="m42 34 17 17-25 16m23-33L39 51l26 16M49 3v20" fill="none" stroke="#ced3b6" stroke-width="3"/><path d="M26 17q-9 10 0 20m-8-26q-15 17 0 32m54-26q9 10 0 20m8-26q15 17 0 32" fill="none" stroke="#cfb778" stroke-width="3" stroke-linecap="round"/><rect x="26" y="69" width="46" height="8" rx="3" fill="#94a174"/><circle cx="49" cy="10" r="4" fill="#f2d992"/><path d="M44 66v-9h10v9" fill="#2d443c"/>`,
  n:`<path d="M18 44h60l7 19H13Z" fill="#6e8756" stroke="#344b37" stroke-width="2"/><path d="M29 45V22h31l9 23" fill="#adc7b7" stroke="#61784f" stroke-width="5"/><path d="M45 24v20" stroke="#61784f" stroke-width="3"/><rect x="22" y="49" width="52" height="12" rx="3" fill="#435a3e"/><path d="M38 51v9m6-9v9m6-9v9m6-9v9m6-9v9" stroke="#95a777" stroke-width="2"/><circle cx="27" cy="65" r="10" fill="#293932"/><circle cx="70" cy="65" r="10" fill="#293932"/><circle cx="27" cy="65" r="5" fill="#a2ab8b"/><circle cx="70" cy="65" r="5" fill="#a2ab8b"/><circle cx="27" cy="54" r="4" fill="#ffe5a4"/><circle cx="70" cy="54" r="4" fill="#ffe5a4"/><path d="m52 31 2 4 5 1-4 3 1 4-4-2-4 2 1-4-4-3 5-1Z" fill="#fff2c8"/>`,
  p:`<path d="M23 49q1-35 26-35t26 35l8 7q-32 15-66 0Z" fill="#61794e" stroke="#344b37" stroke-width="2"/><path d="M24 46q25 12 50 0l2 8q-27 16-55 0Z" fill="#a2ad7a"/><path d="M34 54q1 24 27 22l8-18" fill="none" stroke="#394e37" stroke-width="5"/><path d="M35 26q-8 8-9 17" fill="none" stroke="#c5c895" stroke-width="4" stroke-linecap="round"/><path d="m50 26 2 4 5 1-4 3 1 4-4-2-4 2 1-4-4-3 5-1Z" fill="#e7dfb5"/>`
};
const dragonHead = (skin, shadow, muzzle) => `<g stroke="#284d50" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M35 26C25 24 23 16 28 8c-1 8 5 11 13 12M52 22C46 15 49 9 57 5c-4 8-2 11 5 16" fill="#f5dda2"/>
  <path d="M34 32c-6-5-13-6-17-1l11 12 10-4" fill="${shadow}"/>
  <path d="M40 45c-8-2-13-9-10-17 3-8 14-11 24-8 7 0 12 5 14 11l11 1c7 0 11 4 9 10-2 8-8 11-17 11H56c-4 4-11 4-16-1Z" fill="${skin}"/>
  <path d="M57 41c9-3 22-3 30 1-2 7-8 10-17 10H59c-5-1-7-6-2-11Z" fill="${muzzle}" stroke="none"/>
  <path d="M36 29c2-4 7-6 12-5" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="3"/>
  <path d="M44 30c3-4 9-4 13-1-1 5-4 7-8 6-3 0-5-2-5-5Z" fill="#ffdf83" stroke-width="1.3"/>
  <ellipse cx="51.5" cy="31" rx="2" ry="3" fill="#203940" stroke="none"/><circle cx="52.3" cy="29.8" r=".8" fill="#fff9d6" stroke="none"/>
  <path d="M43 27c4-3 9-4 13-1M60 46c7 3 15 2 21-2" fill="none"/>
  <path d="m63 47 2 4 3-3" fill="#fff1cd" stroke="none"/>
  <ellipse cx="79" cy="37.5" rx="1.8" ry="1.3" fill="#284d50" stroke="none"/>
</g>`;
const dragonBody = (skin, shadow, belly) => `<g stroke="#284d50" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
  <path d="M43 71c-9 9-29 9-30-2-1-6 3-11 9-10-5 4-5 8 0 10 4 2 10-1 15-5" fill="${shadow}"/>
  <path d="m17 59-3-7 9 4" fill="#f5dda2"/>
  <path d="m34 42-6-8 12 1m-7 13-9-6 10-2" fill="#f0c776"/>
  <path d="M43 40c-10 4-13 15-9 24-3 4-5 7-4 12h38c1-4-2-7-5-11 8-8 7-17 0-22Z" fill="${skin}"/>
  <path d="M46 46c-7 5-8 17-4 23 3 4 12 6 18 2 4-8 3-19-2-24Z" fill="${belly}" stroke="none"/>
  <path d="M42 56q8 4 18 0M41 62q9 4 20 0M43 68q8 3 16 0" fill="none" stroke="#aa945f" stroke-width="1" stroke-opacity=".55"/>
  <path d="M36 68c-6 0-9 5-7 9h17c2-4-2-8-6-8m19-1c5-1 12 3 12 8H55c-2-4 0-7 4-8" fill="${shadow}"/>
  <path d="M33 76v-3m5 3v-3m22 3v-3m5 3v-3" fill="none" stroke="#f6dca0" stroke-width="1.3"/>
  <path d="M36 48q-6 2-7 7l8 3q4-2 5-6m21-3q7 2 8 6l-9 3-4-5" fill="${skin}"/>
</g>`;
const foldedWing = (membrane, outline='#284d50') => `<g stroke="${outline}" stroke-width="1.6" stroke-linejoin="round"><path d="M37 56C24 49 21 37 14 26c-2 13-2 24 4 34 5-7 11-5 17 4Z" fill="${membrane}"/><path d="m16 30 9 23 10 6m-10-6-8 6" fill="none" stroke="#f7e2b4" stroke-opacity=".6"/></g>`;
const dragons = {
  k:`${foldedWing('#9a82b3')}${dragonBody('#30978c','#236f72','#f4d69a')}${dragonHead('#30978c','#236f72','#8bc9ae')}
    <path d="m36 21-3-12 9 5 7-9 7 9 9-5-3 13Z" fill="#eac069" stroke="#7a6643" stroke-width="1.6" stroke-linejoin="round"/><path d="M37 20h24" stroke="#ffebba" stroke-width="2"/><circle cx="49" cy="15" r="2.7" fill="#b45265"/>
    <path d="m44 48 8 5 8-5-4 12h-8Z" fill="#a279b0" stroke="#284d50" stroke-width="1.3"/><circle cx="52" cy="54" r="2.4" fill="#f4d18a"/>`,
  q:`<g stroke="#3b405a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M38 57C23 44 22 27 9 16c-1 16-3 31 4 45 6-10 16-7 22 5Z" fill="#b7a0d7"/><path d="M62 53c13-13 15-27 28-36 1 16 4 29-3 43-7-9-14-5-21 5Z" fill="#b7a0d7"/><path d="m12 23 12 28 11 9m-11-9-10 7m64-7 9-27m-9 27 8 6" fill="none" stroke="#eee1e5"/></g>
    ${dragonBody('#7b71ad','#554d86','#f4dca7')}${dragonHead('#8b7ab8','#655491','#c8a7d2')}
    <path d="m40 21 1-9 6 4 7-7 4 9 8-1-5 8" fill="#f3d991" stroke="#7a6643" stroke-width="1.3" stroke-linejoin="round"/><circle cx="54" cy="17" r="2" fill="#539caa"/>
    <path d="M45 48q7 8 15 1" fill="none" stroke="#e9c778" stroke-width="2.5"/><path d="m51 54 3 5 3-5-3-4Z" fill="#99d8d0"/>`,
  r:`<g stroke="#3b5360" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M29 77 33 39h33l5 38Z" fill="#8297a0"/><path d="M26 30h10v8h9v-8h11v8h9v-8h10v16H26Z" fill="#b4c2bd"/>
    <path d="M40 77V63q10-14 20 0v14" fill="#304854"/><path d="M34 53h30m-35 9h11m20 0h9M47 46v7m-9 0v8m18-8v8" fill="none" stroke="#c8d3c7" stroke-width="1.3"/>
    <path d="M60 35c15 1 20 10 14 17-7 8-38 0-47 10-6 7 5 14 15 7-2 11-19 10-21 1-4-14 17-21 32-17 15 3 15-4 7-7Z" fill="#368b9b"/><path d="M29 62q13-6 29-4" fill="none" stroke="#87c7c4" stroke-width="2"/></g>
    <g transform="translate(15 -6) scale(.76)">${dragonHead('#368b9b','#236475','#87c7c4')}</g>
    <path d="M47 37q-8 1-9 6h14" fill="#368b9b" stroke="#284d50" stroke-width="1.5"/><path d="M40 42v-3m5 3v-3" stroke="#f6dca0" stroke-width="1.2"/>`,
  b:`${foldedWing('#6e97ba')}${dragonBody('#4b8eb0','#326580','#e6dab0')}${dragonHead('#4b8eb0','#326580','#a6c9d2')}
    <path d="M17 76V35" stroke="#bc9b60" stroke-width="3.6" stroke-linecap="round"/><circle cx="17" cy="28" r="9" fill="#deecca" stroke="#b8985e" stroke-width="2"/><circle cx="17" cy="28" r="5.8" fill="#86c6c5"/><path d="m17 22 1.5 4.5 4.5 1.5-4.5 1.5-1.5 4.5-1.5-4.5-4.5-1.5 4.5-1.5Z" fill="#fff8d6"/>
    <path d="m45 49 8 8 6-6" fill="none" stroke="#bc9b60" stroke-width="1.7"/><path d="m50 57 3 6 3-6-3-3Z" fill="#96d8d0" stroke="#284d50" stroke-width="1"/><path d="M34 52q-8 0-17 4" fill="none" stroke="#4b8eb0" stroke-width="5" stroke-linecap="round"/>`,
  n:`<g stroke="#674c48" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M40 57C25 45 26 21 11 7 8 20 5 43 13 61c8-10 17-5 22 4Z" fill="#efb475"/><path d="M63 53c8-16 9-26 25-40 2 19 2 31-4 45-6-9-14-4-19 7Z" fill="#efb475"/><path d="m13 15 11 35 11 9m-11-9-11 9m62-9 11-29m-11 29 8 7" fill="none" stroke="#fff0c4" stroke-width="1.3"/></g>
    ${dragonBody('#cf7560','#9f584f','#f8d79c')}${dragonHead('#cf7560','#9f584f','#efb889')}
    <path d="m39 21-6-7 10 1m8 5-1-7 7 7" fill="#f5dba0" stroke="#674c48" stroke-width="1.3" stroke-linejoin="round"/>`,
  p:`<g stroke="#284d50" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    <path d="M39 72c-12 9-27 3-24-6 1-4 6-5 9-3-5 3-3 7 7 4" fill="#4e9385"/>
    <path d="M36 60C23 56 20 43 13 38c-1 9 0 17 4 23 6-6 10-1 16 5m30-8c10-4 12-14 20-19 1 10-2 18-6 23-5-4-9-1-14 3" fill="#9cbfa3"/>
    <ellipse cx="51" cy="63" rx="20" ry="17" fill="#69b09a"/><ellipse cx="53" cy="65" rx="12" ry="13" fill="#f4dfab" stroke="none"/><path d="M44 63q9 4 17 0m-17 6q9 3 16 0" fill="none" stroke="#baa16b" stroke-width="1"/>
    <path d="M35 29c-8-3-11-9-9-17 3 7 8 9 14 11m20 1c8-4 12-8 12-14 4 9 1 15-8 19" fill="#f5dda2"/>
    <path d="M31 38c-5-5-11-5-14-1l11 12m40-12c6-4 12-3 14 2L71 49" fill="#4e9385"/>
    <path d="M28 40c-2-10 7-18 21-17 14-3 25 6 24 16l3 7c-1 8-10 13-24 13-15 1-26-5-26-14Z" fill="#69b09a"/>
    <path d="M33 34q4-7 12-6" fill="none" stroke="#fff" stroke-width="2.5" stroke-opacity=".3"/>
    <ellipse cx="42" cy="37" rx="4.7" ry="5.3" fill="#ffe096"/><ellipse cx="61" cy="36.5" rx="4.5" ry="5" fill="#ffe096"/><ellipse cx="43" cy="38" rx="1.8" ry="3" fill="#24484a" stroke="none"/><ellipse cx="61.5" cy="37.5" rx="1.7" ry="2.8" fill="#24484a" stroke="none"/>
    <path d="M38 44c7-5 21-5 29-1 5 2 5 7 1 10-8 5-20 5-27 0-4-2-6-6-3-9Z" fill="#a7d0aa" stroke="none"/>
    <ellipse cx="44" cy="47" rx="1.7" ry="1.2" fill="#345e52" stroke="none"/><ellipse cx="62" cy="46.5" rx="1.6" ry="1.2" fill="#345e52" stroke="none"/><path d="M45 52q9 5 17-1" fill="none" stroke-width="1.3"/>
    <path d="M36 72c-5 0-7 3-6 6h17c0-3-3-6-7-6m20-1c5-1 9 3 10 6H55c0-3 1-5 5-6" fill="#4e9385"/><path d="M34 77v-2m5 2v-2m21 1v-2m5 2v-2" fill="none" stroke="#f5dda2" stroke-width="1.2"/>
  </g>`
};
// Font-independent standard chess silhouettes keep the role badge clear on every device.
const signs = {
  p:'<circle cx="20" cy="9" r="6"/><path d="M15 17h10l-2 6 7 9H10l7-9Z"/><path d="M8 34h24v4H8Z"/>',
  r:'<path d="M8 5h6v5h4V5h5v5h4V5h6v12l-5 4v11H13V21l-5-4Z"/><path d="M8 34h25v4H8Z"/>',
  n:'<path d="m11 29 3-8-6-4 4-7 11-6 5 2 2-4 3 15q4 7-2 15H12l-1-3Z"/><path d="M9 34h25v4H9Z"/><circle cx="22" cy="12" r="1.7" fill="#789292"/>',
  b:'<path d="M20 3q-13 11-10 16 3 6 8 7l-7 6h18l-7-6q10-5 8-11Z"/><path d="M8 34h24v4H8Z"/><path d="m20 9 6 8" stroke="#789292" stroke-width="2.5"/>',
  q:'<circle cx="5" cy="8" r="3"/><circle cx="20" cy="4" r="3"/><circle cx="35" cy="8" r="3"/><path d="m5 12 9 7 6-11 6 11 9-7-6 14H11Z"/><path d="M12 28h16v4H12ZM8 34h24v4H8Z"/>',
  k:'<path d="M17 2h6v5h5v5h-5v5h-6v-5h-5V7h5Z"/><path d="M9 18q-7-6-7 3 1 7 11 9h14q10-2 11-9 0-9-7-3l-11 6Z"/><path d="M11 31h18v3H11ZM8 35h24v3H8Z"/>'
};
export function pieceArt(type, theme, color, badge = true) {
  return `<svg viewBox="0 0 100 100" aria-hidden="true" class="piece-art"><defs><linearGradient id="scale" x2=".8" y2="1"><stop stop-color="#f39b6c"/><stop offset="1" stop-color="#bf4e49"/></linearGradient></defs><ellipse cx="50" cy="80" rx="34" ry="9" fill="${color==='w'?'#fff6d7':'#203446'}" stroke="${color==='w'?'#c3a875':'#0c1c2b'}" stroke-width="2"/>${theme==='airfield'?military[type]:dragons[type]}${badge?`<circle cx="79" cy="79" r="18" fill="${color==='w'?'#fff9e9':'#172b3c'}" stroke="${color==='w'?'#b09260':'#87a0b0'}" stroke-width="1.5"/><g transform="translate(65 64) scale(.7)" fill="${color==='w'?'#243541':'#fff4d6'}">${signs[type]}</g>`:''}</svg>`;
}
export const scene = `<svg viewBox="0 0 1300 880" preserveAspectRatio="xMidYMid slice" class="landscape" aria-hidden="true"><defs><linearGradient id="sky" x2="1" y2=".6"><stop stop-color="#39636e"/><stop offset=".55" stop-color="#597e86"/><stop offset="1" stop-color="#b8826b"/></linearGradient><linearGradient id="land" y2="1" x2="0"><stop stop-color="#385355"/><stop offset="1" stop-color="#203a3f"/></linearGradient></defs><rect width="1300" height="880" fill="url(#sky)"/><circle cx="1050" cy="145" r="75" fill="#f0cca1" opacity=".7"/><path d="M320 560 520 310 620 460 765 190 885 370 980 240 1160 450 1300 280v600H0Z" fill="#62717b"/><path d="m720 244 45-54 72 109-60-24-25 15Z" fill="#d6bbae"/><path d="M610 570 825 355 975 590 1130 450 1300 600v280H0Z" fill="#485867"/><path d="M940 403h45v-72h20v-23h18v23h18v68h30v-41h20v-23h20v23h20v101H940Z" fill="#334552"/><path d="m972 331 42-53 40 53m26 27 30-42 30 42" fill="#a27468"/><path d="M0 604q320-93 645 13t655-22v285H0" fill="url(#land)"/><path d="m0 814 410-207h100L201 880H0Z" fill="#425c60"/><path d="m62 823 26-13m52-24 26-13m52-24 26-13m52-24 26-13m52-24 26-13" stroke="#b9b895" stroke-width="5"/><path d="M48 642v-95h56v95m-57-95-8-28h74l-9 28" fill="#273f46"/><path d="M47 535h58" stroke="#9aaba2" stroke-width="8"/><path d="M60 517v-31" stroke="#273f46" stroke-width="4"/><path d="m160 666 40-70h105l45 70Z" fill="#6a7970"/><path d="m170 666 34-61h92l39 61Z" fill="#2b4247"/><path d="m175 406 39-11 18-20 7 15 41 3-37 11-8 15-5-14-48 10Z" fill="#233f49"/><path d="m1090 245-26-32-8 34-22-11 18 27-2 15 28-12 32 6-20-17 10-27Z" fill="#4b4552"/><path d="m15 718 20-55 20 55m21 10 24-65 24 65m1040 15 25-78 25 78m29-9 35-89 35 89m-215 73 28-82 28 82" fill="#294247"/><path d="M0 845q240-84 470-10t830-2v47H0" fill="#172f38"/></svg>`;
