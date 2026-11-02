/**
 * Scientific colour maps by Fabio Crameri (https://www.fabiocrameri.ch/colourmaps/, MIT licence), sampled at 33 evenly spaced
 * entries of the 256-entry tables. Both are perceptually uniform and readable with colour-vision deficiency or in greyscale.
 * batlow is sequential with monotonic lightness; vik is diverging with a light neutral centre (Crameri, Shephard & Heron 2020,
 * Nature Communications 11:5444). Interpolate linearly between adjacent entries; never re-space the tables.
 */
export const BATLOW=['#011959','#08255b','#0d315d','#0f3b5f','#114360','#134b61','#175262','#1b5962','#226061','#2b655e','#356a59','#416f53','#4d734d','#5a7745','#677b3e','#747e38','#828231','#8f862d','#9f892b','#af8d2e','#be9035','#cd923f','#db954b','#e7985a','#f19d6b','#f8a27e','#fca890','#fdaea2','#fdb4b4','#fdbac4','#fcbfd6','#fbc6e8','#faccfa'] as const;
export const VIK=['#001261','#021f69','#022b71','#023779','#034481','#055189','#0c5e92','#1c6d9c','#307da6','#488db2','#619ebd','#7aaec8','#94bed2','#adcddd','#c6dbe6','#dee6e9','#ece5e0','#eedbd0','#e9ccba','#e3bca5','#dcac90','#d69d7c','#cf8e68','#c98056','#c37243','#bd6431','#b3531f','#a5400f','#942f06','#832106','#741506','#670a07','#590008'] as const;
/** The earlier hand-made teal–gold ramp, kept as an alternate: its lightness is monotonic, if less evenly spaced. */
export const TEAL=['#152b39','#205865','#3c9089','#a2c695','#eed184'] as const;
export const sequentialMaps={batlow:BATLOW,teal:TEAL} as const;
export const divergingMap=VIK;
