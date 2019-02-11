;[].concat(...document.querySelectorAll('input[name]')).forEach(i => {
  if (i.name in window.localStorage) i.value = window.localStorage[i.name]
})

document.body.addEventListener('keyup', e => {
  if (e.target.name) {
    window.localStorage[e.target.name] = e.target.value
  }
})

document.addEventListener('close', () => [
  browser.runtime.reload()
])
