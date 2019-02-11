document.addEventListener('click', async e => {
  if (e.target.className === 'button') {
    e.target.setAttribute('disabled', 'disabled')
    chrome.runtime.sendMessage({
      type: e.target.name
    }, res => {
      e.target.removeAttribute('disabled')
    })
  } else if (e.target.className === 'revision') {
    chrome.runtime.sendMessage({
      type: 'revision',
      id: e.target.name,
      sha: e.target.title
    })
    e.target.setAttribute('disabled', 'disabled')
  }
})

chrome.runtime.onMessage.addListener(message => {
  if (message.html && message.target) {
    document.querySelector(message.target).innerHTML = message.html
  }
})
