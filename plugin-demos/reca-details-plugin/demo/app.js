const nodes = [
  ['root', 0, 'ROOT', 'Flower-Fruit Mountain Oath', '4 shots · 10 leaves', 'running', 'Recursive film plan, shared visual state, parallel shots and final concat.'],
  ['plan', 1, 'PLAN', 'Narrative skeleton', 'ready', 'done', 'Planner locked four shots, ten serial leaves and continuity transitions.'],
  ['assets', 1, 'STATE', 'Shared memory', '7 images', 'done', 'Character identity, mountain plate, staff and sunset palette.'],
  ['shot01', 1, 'SHOT 01', 'Summit arrival', '2 / 2', 'done', 'Aerial approach into a controlled landing beat.'],
  ['s01a', 2, 'SEGMENT', 'Cloud approach', '8.0s', 'done', 'Wide aerial. First-frame identity anchor passed continuity validation.'],
  ['s01b', 2, 'SEGMENT', 'Landing beat', '6.4s', 'done', 'Tail-frame propagation keeps the staff silhouette and warm rim light.'],
  ['shot02', 1, 'SHOT 02', 'Cliff gaze', '3 / 4', 'running', 'Emotional hinge rendered as four serial leaves.'],
  ['s02a', 2, 'SEGMENT', 'Shoulder turn', 'ready', 'done', 'Medium profile with cloth motion and a stable eye line.'],
  ['s02b', 2, 'SEGMENT', 'Oath close-up', '72%', 'running', 'Rendering a close-up against the mountain horizon; validator waits for the tail frame.'],
  ['s02c', 2, 'SEGMENT', 'Mountain answer', 'queued', 'pending', 'Scheduled after the current continuity tail is committed.'],
  ['shot03', 1, 'SHOT 03', 'Monkeys gather', 'queued', 'pending', 'Crowd response and kinetic camera sweep.'],
  ['shot04', 1, 'SHOT 04', 'Oath tableau', 'queued', 'pending', 'Final crane-out, validation and concat.'],
]

const tree = document.querySelector('[data-tree]')
let selected = 's02b'
function renderTree() {
  tree.innerHTML = nodes.map(([id, depth, type, title, meta, state]) => `
    <button class="${id === selected ? 'selected' : ''}" style="--depth:${depth}" data-node="${id}">
      <span class="guide"></span><i class="dot ${state}"></i><span class="copy"><small>${type}</small><strong>${title}</strong></span><em>${meta}</em>
    </button>`).join('')
  tree.querySelectorAll('[data-node]').forEach(button => button.addEventListener('click', () => {
    selected = button.dataset.node
    const node = nodes.find(item => item[0] === selected)
    document.querySelector('[data-node-type]').textContent = node[2]
    document.querySelector('[data-node-title]').textContent = node[3]
    document.querySelector('[data-node-note]').textContent = node[6]
    document.querySelector('[data-node-state]').textContent = node[5]
    renderTree()
  }))
}
renderTree()

let progress = 68
setInterval(() => {
  progress = progress >= 91 ? 68 : progress + 1
  document.querySelectorAll('[data-progress], [data-chat-progress]').forEach(item => { item.textContent = `${progress}%` })
  document.querySelector('[data-progress-bar]').style.width = `${progress}%`
}, 1200)
