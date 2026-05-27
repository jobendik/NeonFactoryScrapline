export interface ActiveEvent {
  id: string;
  name: string;
  description: string;
  color: string;
  scrapMult?: number;
  bonusCore?: number;
}

function isWeekendBlitz(now: Date): boolean {
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  if (day === 5) return hour >= 18;
  if (day === 6) return true;
  if (day === 0) return true;
  if (day === 1) return hour < 6;
  return false;
}

function isCoreSurge(now: Date): boolean {
  return now.getUTCDate() <= 3;
}

export const EventSystem = {
  getActiveEvent(nowMs: number = Date.now()): ActiveEvent | null {
    const now = new Date(nowMs);
    if (isWeekendBlitz(now)) {
      return {
        id: 'weekend_blitz',
        name: 'WEEKEND BLITZ',
        description: '+50% Scrap from raids',
        color: '#ffd75a',
        scrapMult: 1.5,
      };
    }
    if (isCoreSurge(now)) {
      return {
        id: 'core_surge',
        name: 'CORE SURGE',
        description: '+1 Core per extraction',
        color: '#a76cff',
        bonusCore: 1,
      };
    }
    return null;
  },
};
