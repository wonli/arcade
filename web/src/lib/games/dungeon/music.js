const NOTE = {
  D2: 73.42, F2: 87.31, G2: 98.00, A2: 110.00, C3: 130.81, D3: 146.83,
  F3: 174.61, G3: 196.00, A3: 220.00, C4: 261.63, D4: 293.66, F4: 349.23,
  G4: 392.00, A4: 440.00, C5: 523.25, D5: 587.33,
}

const bassRoots = ['D2', 'D2', 'C3', 'D2', 'F2', 'C3', 'D2', 'A2', 'D2', 'F2', 'G2', 'A2', 'D2', 'C3', 'A2', 'D2']
const bass = bassRoots.map((note, index) => ({ beat: index * 4, note, duration: 3.4, volume: index >= 8 ? 0.12 : 0.1 }))

const melodyNotes = [
  [4, 'D4'], [6, 'F4'], [7.5, 'A4'], [10, 'G4'], [12, 'F4'], [14, 'D4'],
  [18, 'F4'], [20, 'A4'], [22, 'C5'], [23.5, 'A4'], [26, 'G4'], [28, 'F4'], [30, 'D4'],
  [34, 'A4'], [36, 'C5'], [38, 'D5'], [40, 'C5'], [42, 'A4'], [44, 'G4'],
  [46, 'F4'], [48, 'D4'], [50, 'F4'], [52, 'A4'], [54, 'G4'], [56, 'F4'],
  [58, 'D4'], [60, 'C4'], [62, 'D4'],
]
const melody = melodyNotes.map(([beat, note], index) => ({ beat, note, duration: index >= 13 ? 0.9 : 0.72, volume: index >= 13 ? 0.085 : 0.065 }))

const pulses = Array.from({ length: 32 }, (_, index) => ({
  beat: index * 2,
  note: index % 8 === 6 ? 'A3' : (index % 4 === 2 ? 'F3' : 'D3'),
  duration: 0.16,
  volume: index >= 16 ? 0.055 : 0.04,
}))

const bells = [
  { beat: 15, note: 'D5', duration: 1.6, volume: 0.04 },
  { beat: 31, note: 'A4', duration: 1.8, volume: 0.045 },
  { beat: 47, note: 'C5', duration: 1.6, volume: 0.05 },
  { beat: 63, note: 'D5', duration: 0.7, volume: 0.035 },
]

export const DUNGEON_BGM = {
  bpm: 80,
  loopBeats: 64,
  duration: 48,
  notes: NOTE,
  bass,
  melody,
  pulses,
  bells,
}
