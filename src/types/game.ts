export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type Difficulty = 'easy' | 'normal' | 'hard';

export type SkyTheme = 'day' | 'sunset' | 'night';

export interface DifficultyConfig {
  id: Difficulty;
  label: string;
  pipeSpeed: number;
  pipeGap: number;
  spawnInterval: number;
  gravity: number;
  flapVelocity: number;
}

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  easy: {
    id: 'easy',
    label: 'Dễ',
    pipeSpeed: 152,
    pipeGap: 158,
    spawnInterval: 1.65,
    gravity: 1420,
    flapVelocity: -440,
  },
  normal: {
    id: 'normal',
    label: 'Chuẩn',
    pipeSpeed: 186,
    pipeGap: 134,
    spawnInterval: 1.42,
    gravity: 1560,
    flapVelocity: -465,
  },
  hard: {
    id: 'hard',
    label: 'Khó',
    pipeSpeed: 224,
    pipeGap: 116,
    spawnInterval: 1.22,
    gravity: 1680,
    flapVelocity: -480,
  },
};

export interface Pipe {
  id: number;
  x: number;
  gapY: number;
  gapHeight: number;
  passed: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface SkyPalette {
  id: SkyTheme;
  label: string;
  skyTop: string;
  skyBottom: string;
  cloudColor: string;
  cityFar: string;
  cityNear: string;
  hillColor: string;
  pipeBody: string;
  pipeHighlight: string;
  pipeShadow: string;
  pipeOutline: string;
  groundTop: string;
  groundStripe: string;
  groundEarth: string;
  starsVisible: boolean;
}

export const SKY_PALETTES: Record<SkyTheme, SkyPalette> = {
  day: {
    id: 'day',
    label: 'Ban ngày',
    skyTop: '#5BC0EB',
    skyBottom: '#CBEBF7',
    cloudColor: 'rgba(255, 255, 255, 0.92)',
    cityFar: '#9CD3E6',
    cityNear: '#7ABED4',
    hillColor: '#76C957',
    pipeBody: '#68B92E',
    pipeHighlight: '#9BE059',
    pipeShadow: '#498A1B',
    pipeOutline: '#243D12',
    groundTop: '#73BF2E',
    groundStripe: '#569D1D',
    groundEarth: '#DED895',
    starsVisible: false,
  },
  sunset: {
    id: 'sunset',
    label: 'Hoàng hôn',
    skyTop: '#E96443',
    skyBottom: '#FCE38A',
    cloudColor: 'rgba(255, 240, 224, 0.85)',
    cityFar: '#C87D75',
    cityNear: '#A45A62',
    hillColor: '#668E48',
    pipeBody: '#559E34',
    pipeHighlight: '#83C95B',
    pipeShadow: '#3A7221',
    pipeOutline: '#243518',
    groundTop: '#66A330',
    groundStripe: '#4E8221',
    groundEarth: '#D6C485',
    starsVisible: false,
  },
  night: {
    id: 'night',
    label: 'Ban đêm',
    skyTop: '#0F1C3A',
    skyBottom: '#1F3A68',
    cloudColor: 'rgba(148, 179, 220, 0.25)',
    cityFar: '#172A4D',
    cityNear: '#11203B',
    hillColor: '#255249',
    pipeBody: '#3E8D5C',
    pipeHighlight: '#62B882',
    pipeShadow: '#26613D',
    pipeOutline: '#0F2719',
    groundTop: '#3E8244',
    groundStripe: '#2B6130',
    groundEarth: '#8B8562',
    starsVisible: true,
  },
};

export interface MedalInfo {
  name: string;
  minScore: number;
  fill: string;
  rim: string;
  textColor: string;
}

export function getMedal(score: number): MedalInfo | null {
  if (score >= 50) {
    return {
      name: 'Bạch Kim',
      minScore: 50,
      fill: '#E2E8F0',
      rim: '#94A3B8',
      textColor: '#1E293B',
    };
  }
  if (score >= 30) {
    return {
      name: 'Vàng',
      minScore: 30,
      fill: '#FACC15',
      rim: '#CA8A04',
      textColor: '#422006',
    };
  }
  if (score >= 20) {
    return {
      name: 'Bạc',
      minScore: 20,
      fill: '#CBD5E1',
      rim: '#64748B',
      textColor: '#1E293B',
    };
  }
  if (score >= 10) {
    return {
      name: 'Đồng',
      minScore: 10,
      fill: '#D97706',
      rim: '#92400E',
      textColor: '#FFFBEB',
    };
  }
  return null;
}
