import './styles.css'

type Color = 'green' | 'red' | 'yellow' | 'blue'

type BestScoreResponse = {
  bestScore: number | null
}

const colors: Color[] = ['green', 'red', 'yellow', 'blue']

const playerIdStorageKey = 'simon-player-id'
const playerNameStorageKey = 'simon-player-name'

const frequencies: Record<Color, number> = {
  green: 329.63,
  red: 261.63,
  yellow: 220,
  blue: 164.81,
}

function getButton(selector: string): HTMLButtonElement {
  const element = document.querySelector(selector)

  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`Missing button: ${selector}`)
  }

  return element
}

function getText(selector: string): HTMLElement {
  const element = document.querySelector(selector)

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing element: ${selector}`)
  }

  return element
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

const statusText = getText('#status')
const scoreText = getText('#score')
const startButton = getButton('#start')
const meta = statusText.parentElement

if (meta === null) {
  throw new Error('Missing meta container')
}

const playerText = document.createElement('p')

meta.append(playerText)

const pads = new Map<Color, HTMLButtonElement>(
  colors.map((color) => [color, getButton(`[data-color="${color}"]`)])
)

let audioContext: AudioContext | null = null
let sequence: Color[] = []
let playerIndex = 0
let inputEnabled = false
let runId = 0
const playerId = loadPlayerId()
let playerName = loadPlayerName()
let bestScore: number | null = null

function loadPlayerId(): string {
  const saved = window.localStorage.getItem(playerIdStorageKey)?.trim()

  if (saved) {
    return saved
  }

  const created = crypto.randomUUID()
  window.localStorage.setItem(playerIdStorageKey, created)
  return created
}

function loadPlayerName(): string | null {
  const saved = window.localStorage.getItem(playerNameStorageKey)?.trim()
  return saved ? saved : null
}

function setPlayerName(name: string): void {
  playerName = name
  window.localStorage.setItem(playerNameStorageKey, name)
  renderPlayerMeta()
}

function renderPlayerMeta(): void {
  const label = playerName ?? 'anon'
  const scoreLabel = bestScore === null ? '-' : String(bestScore)
  playerText.textContent = `${label} · best ${scoreLabel}`
}

function setStatus(message: string): void {
  statusText.textContent = message
}

function setRound(round: number): void {
  scoreText.textContent = `Round ${round}`
}

function setPadsEnabled(enabled: boolean): void {
  inputEnabled = enabled

  for (const pad of pads.values()) {
    pad.disabled = !enabled
  }
}

function clearPads(): void {
  for (const pad of pads.values()) {
    pad.classList.remove('active')
  }
}

async function getAudioContext(): Promise<AudioContext> {
  if (audioContext === null) {
    audioContext = new AudioContext()
  }

  if (audioContext.state === 'suspended') {
    await audioContext.resume()
  }

  return audioContext
}

async function playTone(color: Color, duration: number): Promise<void> {
  const context = await getAudioContext()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const stopAt = context.currentTime + duration / 1000

  oscillator.type = 'sine'
  oscillator.frequency.value = frequencies[color]
  gain.gain.setValueAtTime(0.0001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, stopAt)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  oscillator.stop(stopAt)
  await delay(duration)
}

async function playFailureTone(): Promise<void> {
  const context = await getAudioContext()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const stopAt = context.currentTime + 0.45

  oscillator.type = 'sawtooth'
  oscillator.frequency.setValueAtTime(180, context.currentTime)
  oscillator.frequency.exponentialRampToValueAtTime(70, stopAt)
  gain.gain.setValueAtTime(0.0001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + 0.03)
  gain.gain.exponentialRampToValueAtTime(0.0001, stopAt)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  oscillator.stop(stopAt)
  await delay(450)
}

async function flashPad(color: Color, duration: number): Promise<void> {
  const pad = pads.get(color)

  if (pad === undefined) {
    return
  }

  pad.classList.add('active')

  try {
    await playTone(color, duration)
  } finally {
    pad.classList.remove('active')
  }
}

function nextColor(): Color {
  const index = Math.floor(Math.random() * colors.length)
  return colors[index] ?? 'green'
}

async function playSequence(currentRunId: number): Promise<void> {
  const duration = Math.max(240, 520 - sequence.length * 18)

  for (const color of sequence) {
    if (currentRunId !== runId) {
      return
    }

    await flashPad(color, duration)
    await delay(130)
  }
}

async function loadBestScore(): Promise<void> {
  try {
    const response = await fetch(`/api/players/${encodeURIComponent(playerId)}/best`)

    if (!response.ok) {
      return
    }

    const body = (await response.json()) as BestScoreResponse
    bestScore = body.bestScore
    renderPlayerMeta()
  } catch {
    renderPlayerMeta()
  }
}

async function saveScore(score: number): Promise<void> {
  const wantsSave = window.confirm(`Game over. Save score ${score}?`)

  if (!wantsSave) {
    return
  }

  const defaultName = playerName ?? ''
  const name = window.prompt('Name', defaultName)?.trim()

  if (!name) {
    return
  }

  setPlayerName(name)

  const response = await fetch('/api/scores', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ playerId, name, score }),
  })

  if (!response.ok) {
    throw new Error('Save failed')
  }

  bestScore = bestScore === null ? score : Math.max(bestScore, score)
  renderPlayerMeta()
}

async function finishGame(): Promise<void> {
  const score = Math.max(sequence.length - 1, 0)

  runId += 1
  setPadsEnabled(false)
  clearPads()
  setStatus(`Game over · ${score}`)

  try {
    await playFailureTone()
    await saveScore(score)
    setStatus(`Game over · ${score}`)
  } catch {
    setStatus(`Game over · ${score} · save failed`)
  }
}

async function startRound(currentRunId: number): Promise<void> {
  sequence = [...sequence, nextColor()]
  playerIndex = 0
  setRound(sequence.length)
  setStatus('Watch')
  setPadsEnabled(false)
  await delay(250)
  await playSequence(currentRunId)

  if (currentRunId !== runId) {
    return
  }

  setStatus('Repeat')
  setPadsEnabled(true)
}

async function handlePadPress(color: Color): Promise<void> {
  if (!inputEnabled) {
    return
  }

  const currentRunId = runId
  setPadsEnabled(false)
  await flashPad(color, 220)

  if (currentRunId !== runId) {
    return
  }

  if (sequence[playerIndex] !== color) {
    await finishGame()
    return
  }

  playerIndex += 1

  if (playerIndex === sequence.length) {
    setStatus('Good')
    await delay(350)

    if (currentRunId !== runId) {
      return
    }

    await startRound(currentRunId)
    return
  }

  setStatus('Repeat')
  setPadsEnabled(true)
}

async function startGame(): Promise<void> {
  runId += 1
  sequence = []
  playerIndex = 0
  clearPads()
  setRound(0)
  setStatus('Listen')
  setPadsEnabled(false)
  startButton.textContent = 'Restart'
  await startRound(runId)
}

for (const color of colors) {
  const pad = pads.get(color)

  if (pad !== undefined) {
    pad.addEventListener('click', () => {
      void handlePadPress(color)
    })
  }
}

startButton.addEventListener('click', () => {
  void startGame()
})

setRound(0)
setPadsEnabled(false)
renderPlayerMeta()
void loadBestScore()
