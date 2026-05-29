import './style.css'
import { ThreeLayoutDemo } from './app/ThreeLayoutDemo'

const canvas = document.querySelector<HTMLCanvasElement>('#scene')
const tileSizeReadout = document.querySelector<HTMLElement>('#tile-size')
const nodeCountReadout = document.querySelector<HTMLElement>('#node-count')

try {
  if (!canvas || !tileSizeReadout || !nodeCountReadout) {
    throw new Error('Demo elements were not found.')
  }

  const demo = await ThreeLayoutDemo.create({
    canvas,
    tileSizeReadout,
    nodeCountReadout,
  })
  demo.start()
} catch (error) {
  console.error(error)
  showMessage(error instanceof Error ? error.message : 'Unable to start the Three.js layout demo.')
}

function showMessage(message: string) {
  const element = document.createElement('main')
  element.className = 'message'
  element.textContent = message
  document.body.replaceChildren(element)
}
