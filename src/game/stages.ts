/** Single source of truth for stage names shown in menus, HUD and cards. */
export interface StageInfo {
  id: number;
  name: string;
  /** Accent colour used for this stage's menu entry. */
  accent: string;
}

export const STAGES: StageInfo[] = [
  { id: 1, name: 'EARTH CITY', accent: '#5aa8ff' },
  { id: 2, name: 'ASTEROID BELT', accent: '#a78bfa' },
  { id: 3, name: 'LUNAR ORBIT', accent: '#e0b24a' },
  { id: 4, name: 'MOON SURFACE', accent: '#c4ccd8' },
  { id: 5, name: 'MOON CORE', accent: '#ff5d73' },
];

export const stageName = (id: number) => STAGES.find((s) => s.id === id)?.name ?? `STAGE ${id}`;
export const stageNo = (id: number) => id.toString().padStart(2, '0');
