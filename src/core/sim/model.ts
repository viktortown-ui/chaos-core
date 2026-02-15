import { Action, ScenarioParams, StateVector } from './types';
import { Rng } from './rng';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export interface StepOutcome {
  state: StateVector;
  riskFlags: {
    stressBreak: boolean;
    drawdownOver20: boolean;
    blackSwan: boolean;
  };
}

export function scoreState(state: StateVector): number {
  return state.capital + state.resilience * 0.8 + state.momentum * 12 - state.stress * 9;
}

export function step(state: StateVector, action: Action, dtDays: number, params: ScenarioParams, rng: Rng): StepOutcome {
  const dtFactor = dtDays / 30;
  const strategyDrive = action.strategy === 'attack' ? 1.18 : action.strategy === 'defense' ? 0.84 : 1;
  const uncertaintyShock = rng.nextNormal() * params.uncertainty * (0.8 + action.uncertaintyBias * 0.3);
  const drift = (0.75 + params.riskAppetite * 0.7 + action.riskBias * 0.25) * strategyDrive;

  let blackSwan = false;
  let shockPenalty = 0;
  const swanChance = params.blackSwanEnabled ? params.blackSwanChanceMonthly * dtFactor : 0;
  if (rng.next() < swanChance) {
    blackSwan = true;
    shockPenalty = params.blackSwanImpact * (0.8 + rng.next() * 0.4);
  }

  const capitalDelta = (drift + uncertaintyShock - state.stress * 0.2 - shockPenalty) * dtFactor;
  const nextCapital = Math.max(0, state.capital + capitalDelta);

  const resilienceDelta = ((action.strategy === 'defense' ? 0.9 : 0.35) - params.uncertainty * 0.25 - shockPenalty * 0.18) * dtFactor;
  const nextResilience = clamp(state.resilience + resilienceDelta, 0, 100);

  const stressDelta = (params.uncertainty * 0.9 + (action.strategy === 'attack' ? 0.4 : -0.15) + shockPenalty * 1.5 - nextResilience * 0.01) * dtFactor;
  const nextStress = clamp(state.stress + stressDelta, 0, 100);

  const momentumDelta = (capitalDelta * 0.18 + (action.strategy === 'attack' ? 0.22 : 0.08) - nextStress * 0.012) * dtFactor;
  const nextMomentum = clamp(state.momentum + momentumDelta, 0, 100);

  const drawdownOver20 = nextCapital < state.capital * 0.8;
  const stressBreak = nextStress > 80;

  return {
    state: {
      capital: nextCapital,
      resilience: nextResilience,
      momentum: nextMomentum,
      stress: nextStress
    },
    riskFlags: {
      stressBreak,
      drawdownOver20,
      blackSwan
    }
  };
}
