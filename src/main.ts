import './styles.css'

type Color = 'green' | 'red' | 'yellow' | 'blue'

type BestScoreResponse = {
  bestScore: number | null
}

type SaveModalResult =
  | { save: false }
  | {
      save: true
      name: string
    }

type Theme = 'dark' | 'light'

const colors: Color[] = ['green', 'red', 'yellow', 'blue']

const playerIdStorageKey = 'simon-player-id'
const playerNameStorageKey = 'simon-player-name'
const themeStorageKey = 'simon-theme'

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

function applyStyles(element: HTMLElement, styles: Record<string, string>): void {
  for (const [property, value] of Object.entries(styles)) {
    element.style.setProperty(property, value)
  }
}

function createModalButton(label: string, primary: boolean): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = label

  applyStyles(button, {
    border: '1px solid var(--modal-border)',
    background: primary ? 'var(--modal-button-primary-bg)' : 'var(--modal-button-bg)',
    color: primary ? 'var(--modal-button-primary-text)' : 'var(--modal-button-text)',
    padding: '10px 14px',
    'border-radius': '999px',
    cursor: 'pointer',
    'font-size': '12px',
    'text-transform': 'uppercase',
    'letter-spacing': '0.06em',
    'min-width': '88px',
  })

  return button
}

function showSaveModal(score: number, defaultName: string): Promise<SaveModalResult> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    const modal = document.createElement('div')
    const title = document.createElement('p')
    const message = document.createElement('p')
    const nameInput = document.createElement('input')
    const actions = document.createElement('div')
    const noButton = createModalButton('No', false)
    const yesButton = createModalButton('Yes', true)
    const cancelButton = createModalButton('Cancel', false)
    const saveButton = createModalButton('Save', true)
    let mode: 'choice' | 'name' = 'choice'
    let closed = false

    applyStyles(overlay, {
      position: 'fixed',
      inset: '0',
      display: 'grid',
      'place-items': 'center',
      background: 'rgba(0, 0, 0, 0.72)',
      'z-index': '1000',
      padding: '20px',
    })

    applyStyles(modal, {
      width: 'min(92vw, 360px)',
      background: 'var(--modal-surface)',
      border: '1px solid var(--modal-border)',
      'border-radius': '14px',
      padding: '16px',
      display: 'grid',
      gap: '10px',
    })

    applyStyles(title, {
      margin: '0',
      color: 'var(--modal-text)',
      'font-size': '15px',
      'font-weight': '600',
      'text-transform': 'uppercase',
      'letter-spacing': '0.06em',
    })

    applyStyles(message, {
      margin: '0',
      color: 'var(--modal-muted)',
      'font-size': '14px',
    })

    applyStyles(nameInput, {
      width: '100%',
      border: '1px solid var(--modal-border)',
      'border-radius': '8px',
      background: 'var(--modal-input-bg)',
      color: 'var(--modal-text)',
      padding: '10px 12px',
      'font-size': '14px',
    })

    applyStyles(actions, {
      display: 'flex',
      'justify-content': 'flex-end',
      gap: '8px',
      'margin-top': '4px',
    })

    title.textContent = 'Save score'
    nameInput.placeholder = 'Name'
    nameInput.value = defaultName

    function finish(result: SaveModalResult): void {
      if (closed) {
        return
      }

      closed = true
      document.removeEventListener('keydown', onKeyDown)
      overlay.remove()
      resolve(result)
    }

    function trySave(): void {
      const name = nameInput.value.trim()

      if (name === '') {
        nameInput.focus()
        return
      }

      finish({ save: true, name })
    }

    function showChoiceStep(): void {
      mode = 'choice'
      message.textContent = `Save score ${score}?`
      nameInput.style.display = 'none'
      actions.replaceChildren(noButton, yesButton)
      yesButton.focus()
    }

    function showNameStep(): void {
      mode = 'name'
      message.textContent = 'Choose display name'
      nameInput.style.display = 'block'
      actions.replaceChildren(cancelButton, saveButton)
      window.setTimeout(() => {
        nameInput.focus()
        nameInput.select()
      }, 0)
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault()
        finish({ save: false })
        return
      }

      if (event.key !== 'Enter') {
        return
      }

      event.preventDefault()

      if (mode === 'choice') {
        showNameStep()
        return
      }

      trySave()
    }

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        finish({ save: false })
      }
    })
    noButton.addEventListener('click', () => finish({ save: false }))
    yesButton.addEventListener('click', showNameStep)
    cancelButton.addEventListener('click', () => finish({ save: false }))
    saveButton.addEventListener('click', trySave)
    document.addEventListener('keydown', onKeyDown)

    modal.append(title, message, nameInput, actions)
    overlay.append(modal)
    document.body.append(overlay)
    showChoiceStep()
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
const themeButton = document.createElement('button')

meta.append(playerText)
themeButton.type = 'button'
themeButton.className = 'theme-toggle'
document.body.append(themeButton)

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
let currentTheme = loadTheme()

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

function loadTheme(): Theme {
  const saved = window.localStorage.getItem(themeStorageKey)
  return saved === 'light' ? 'light' : 'dark'
}

function renderThemeButton(): void {
  themeButton.textContent = currentTheme === 'light' ? 'Dark mode' : 'Light mode'
  themeButton.setAttribute('aria-pressed', String(currentTheme === 'light'))
}

function applyTheme(theme: Theme): void {
  currentTheme = theme
  document.documentElement.dataset.theme = theme
  window.localStorage.setItem(themeStorageKey, theme)
  renderThemeButton()
}

function toggleTheme(): void {
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark')
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
  const result = await showSaveModal(score, playerName ?? '')

  if (!result.save) {
    return
  }

  const name = result.name

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

themeButton.addEventListener('click', () => {
  toggleTheme()
})

setRound(0)
setPadsEnabled(false)
renderPlayerMeta()
applyTheme(currentTheme)
void loadBestScore()
