import { c } from '../constants.ts'
import type { CrewMember } from '../types.ts'

// The same four astronauts fly both scenarios. Prior career doses are story
// values (balance), not physics: a veteran has less radiation budget left.
export function makeCrew(priorDosesMSv: [number, number, number, number]): CrewMember[] {
  const base: Omit<CrewMember, 'doseMSv'>[] = [
    { id: 'ada', name: 'Ada', role: 'commander', careerDoseLimitMSv: c('CAREER_DOSE_LIMIT_MSV'), status: 'active' },
    { id: 'kofi', name: 'Kofi', role: 'engineer', careerDoseLimitMSv: c('CAREER_DOSE_LIMIT_MSV'), status: 'active' },
    { id: 'mei', name: 'Mei', role: 'scientist', careerDoseLimitMSv: c('CAREER_DOSE_LIMIT_MSV'), status: 'active' },
    { id: 'luis', name: 'Luis', role: 'medic', careerDoseLimitMSv: c('CAREER_DOSE_LIMIT_MSV'), status: 'active' },
  ]
  return base.map((m, i) => ({ ...m, doseMSv: priorDosesMSv[i] }))
}
