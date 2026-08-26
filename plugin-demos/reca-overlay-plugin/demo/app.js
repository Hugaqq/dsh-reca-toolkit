const drawer = document.querySelector('#reca-drawer')
const launcher = document.querySelector('#drawer-launcher')
const closeButton = document.querySelector('#drawer-close')
const sizeButton = document.querySelector('#size-toggle')
const resizeHandle = document.querySelector('#resize-handle')
const progressNumber = document.querySelector('#progress-number')
const progressBar = document.querySelector('#progress-bar')
const launcherProgress = document.querySelector('#launcher-progress')
const segmentProgress = document.querySelector('#segment-progress')
const inspectorTitle = document.querySelector('#inspector-title')
const inspectorDetail = document.querySelector('#inspector-detail')
const inspectorState = document.querySelector('#inspector-state')
const rootButton = document.querySelector('[data-id="root"]')
const widths = [388, 480, 620]
let widthIndex = 1
let progress = 68

function setOpen(open) {
  drawer.classList.toggle('closed', !open)
  launcher.classList.toggle('visible', !open)
}

function selectNode(node) {
  document.querySelectorAll('.tree-node').forEach(item => item.classList.remove('selected'))
  node.classList.add('selected')
  inspectorTitle.textContent = node.dataset.title
  inspectorDetail.textContent = node.dataset.detail
  inspectorState.textContent = node.dataset.status
  inspectorState.style.color = node.dataset.status === 'DONE' ? '#b9f65a' : node.dataset.status === 'PENDING' ? '#8b94a4' : '#ffad73'
}

closeButton.addEventListener('click', () => setOpen(false))
launcher.addEventListener('click', () => setOpen(true))
sizeButton.addEventListener('click', () => {
  widthIndex = (widthIndex + 1) % widths.length
  drawer.style.width = `${widths[widthIndex]}px`
})
document.querySelector('#view-root').addEventListener('click', () => selectNode(rootButton))
document.querySelectorAll('.tree-node').forEach(node => node.addEventListener('click', () => selectNode(node)))

resizeHandle.addEventListener('pointerdown', event => {
  event.preventDefault()
  const move = moveEvent => {
    const width = Math.min(680, Math.max(360, window.innerWidth - moveEvent.clientX - 14))
    drawer.style.width = `${width}px`
  }
  const end = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', end)
})

window.setInterval(() => {
  progress = progress >= 88 ? 68 : progress + 2
  progressNumber.textContent = `${progress}%`
  launcherProgress.textContent = `${progress}%`
  progressBar.style.width = `${progress}%`
  segmentProgress.textContent = `${Math.min(96, progress + 4)}%`
}, 2200)
