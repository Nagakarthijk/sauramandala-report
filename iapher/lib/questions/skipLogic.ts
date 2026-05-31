export type Answer = {
  choice?: number
  multi?: number[]
  scale?: number
  text?: string
  hasVoice?: boolean
}

export function shouldShowQuestion(
  questionId: string,
  answers: Record<string, Answer>
): boolean {
  const rules: Record<string, (a: Record<string, Answer>) => boolean> = {
    q_mh_turn: (a) => {
      const mhFeel = a['q_mh_feel']?.multi || []
      return !mhFeel.includes(6) && !mhFeel.includes(7)
    },
    q_climate_voice: (a) => {
      const clim = a['q_clim']?.choice
      return clim === 0 || clim === 1
    },
    q_sh_safe: (a) => {
      const sh = a['q_sh_info']?.choice
      return sh === 3 || sh === 4 || sh === 5
    },
    q_migr: (a) => {
      const stress = a['q_job']?.scale || 0
      return stress >= 3
    },
  }
  return rules[questionId] ? rules[questionId](answers) : true
}

export function getVisibleQuestions(
  allQuestionIds: string[],
  answers: Record<string, Answer>
): string[] {
  return allQuestionIds.filter((id) => shouldShowQuestion(id, answers))
}
