document.addEventListener('click', async e => {
  if (e.target.className === 'button') {
    e.target.setAttribute('disabled', 'disabled')
    await browser.runtime.sendMessage({
      type: e.target.name
    })
    e.target.removeAttribute('disabled')
  } else if (e.target.className === 'revision') {
    browser.runtime.sendMessage({
      type: 'revision',
      id: e.target.name,
      sha: e.target.title
    })
    e.target.setAttribute('disabled', 'disabled')
  }
})

browser.runtime.onMessage.addListener(message => {
  if (message.html && message.target) {
    document.querySelector(message.target).innerHTML = message.html
  }
})
