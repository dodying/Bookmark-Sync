var token
var description
var monitorBookmark = true

let folder = {
  '1': 'toolbar_____',
  '2': 'unfiled_____',
  'root________': 'root________',
  'toolbar_____': 'toolbar_____',
  'unfiled_____': 'unfiled_____',
  'menu________': 'menu________',
  'mobile______': 'mobile______',
  'tags________': 'tags________'
}

let folderPreserve = ['root________']

const browserActionReset = () => {
  browser.browserAction.setTitle({
    title: browser.i18n.getMessage('extDesc')
  })
  browser.browserAction.setIcon({
    path: 'images/logo-16.png'
  })
  browser.browserAction.setBadgeText({
    text: ''
  })
  browser.browserAction.setBadgeBackgroundColor({
    color: 'blue'
  })
}

const browserActionSet = (info = {}) => {
  if (info.title) {
    browser.browserAction.setTitle({
      title: browser.i18n.getMessage(info.title)
    })
  }
  if (info.icon) {
    browser.browserAction.setIcon({
      path: info.icon
    })
  }
  if (info.text) {
    browser.browserAction.setBadgeText({
      text: info.text
    })
  }
  if (info.color) {
    browser.browserAction.setBadgeBackgroundColor({
      color: info.color
    })
  }
}

const getBookmark = async () => {
  let tree = await browser.bookmarks.search({})
  let arr = []
  for (let i = 0; i < tree.length; i++) {
    let json = {
      parentId: tree[i].parentId,
      index: tree[i].index,
      title: tree[i].title,
      id: tree[i].id
    }
    if ('url' in tree[i]) json.url = tree[i].url
    arr.push(json)
  }
  return arr
}

const emptyBookmark = async () => {
  let bm = await getBookmark()
  for (let i = 0; i < bm.length; i++) {
    if (!folderPreserve.includes(bm[i].parentId)) {
      try {
        if (bm[i].url) {
          await browser.bookmarks.remove(bm[i].id)
        } else {
          await browser.bookmarks.removeTree(bm[i].id)
        }
      } catch (error) {}
    }
  }
}

const setBookmark = async bm => {
  for (let i = 0; i < bm.length; i++) {
    if (bm[i].parentId === 'root________') continue

    // 移除不接受的属性: id
    let id = bm[i].id
    delete bm[i].id

    // 替换真正的parentId
    bm[i].parentId = folder[bm[i].parentId]

    if (bm[i].url && bm[i].url.match(/^chrome:/)) {
      bm[i].url = bm[i].url.replace(/^chrome:/, 'about:')
    }

    if (bm[i].url === 'data:') {
      bm[i].type = 'separator'
    }

    let result = await browser.bookmarks.create(bm[i])
    if (!bm[i].url) folder[id] = result.id
  }
}

const getGistList = async () => {
  let res = await window.fetch('https://api.github.com/gists', {
    method: 'GET',
    headers: {
      'Authorization': 'token ' + token
    }
  })
  let list = await res.json()
  return list.filter(i => i.description === description)
}

const editGist = async (content, id) => {
  let res = await window.fetch(`https://api.github.com/gists/${id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': 'token ' + token
    },
    body: JSON.stringify({
      description: description,
      files: {
        bookmarks: {
          content: content
        }
      }
    })
  })
  let json = await res.json()
  return json
}

const createGist = async content => {
  let res = await window.fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      'Authorization': 'token ' + token
    },
    body: JSON.stringify({
      description: description,
      files: {
        bookmarks: {
          content: content
        }
      }
    })
  })
  let json = await res.json()
  return json
}

const getGistHistory = async id => {
  let res = await window.fetch(`https://api.github.com/gists/${id}/commits`, {
    method: 'GET',
    headers: {
      'Authorization': 'token ' + token
    }
  })
  let list = await res.json()
  return list
}

const getGistContent = async (id, sha = undefined) => {
  let res = await window.fetch(`https://api.github.com/gists/${id}${sha ? '/' + sha : ''}`, {
    method: 'GET',
    headers: {
      'Authorization': 'token ' + token
    }
  })
  let json = await res.json()
  let content = json.files['bookmarks'].content
  content = JSON.parse(content)
  return content
}

const onBookmarkChanged = (id, info) => {
  if (monitorBookmark) {
    browserActionSet({
      text: '!!'
    })
  }
}

browser.runtime.onMessage.addListener(async message => {
  token = window.localStorage.token
  description = window.localStorage.description || 'Bookmark Sync'
  monitorBookmark = false
  let messageNew = {}
  if (message.type === 'upload') {
    let list = await getGistList()
    let bookmarks = await getBookmark()
    bookmarks = JSON.stringify(bookmarks, null, 2)
    if (list.length) {
      await editGist(bookmarks, list[0].id)
    } else {
      await createGist(bookmarks)
    }
  } else if (message.type === 'download') {
    let list = await getGistList()
    if (list.length) {
      let content = await getGistContent(list[0].id)
      await emptyBookmark()
      await setBookmark(content)
    } else {
      console.error('No')
    }
  } else if (message.type === 'sync') {
    let list = await getGistList()
    if (list.length) {
      let local = await getBookmark()
      let upsteam = await getGistContent(list[0].id)
      upsteam = upsteam.filter(i => !local.some(j => i.id === j.id))
      await setBookmark(upsteam)
    } else {
      console.error('No')
    }
  } else if (message.type === 'history') {
    let list = await getGistList()
    if (list.length) {
      let history = await getGistHistory(list[0].id)
      let html = '<ol>'
      history.forEach(i => {
        let id = i.url.split('/')[4]
        html += `<li><a class="revision" name="${id}" title="${i.version}">${i.version.substr(0, 6)} ${i.committed_at}</a></li>`
      })
      html += '</ol>'
      messageNew.target = '#historyDiv'
      messageNew.html = html
    } else {
      console.error('No')
    }
  } else if (message.type === 'revision') {
    let content = await getGistContent(message.id, message.sha)
    await emptyBookmark()
    await setBookmark(content)
  }
  if (messageNew) browser.runtime.sendMessage(messageNew)
  browserActionReset()
  monitorBookmark = true

  let bm = await getBookmark()
  let id = bm.filter(i => i.parentId === 'menu________' && i.title === 'Mozilla Firefox')
  if (id.length) await browser.bookmarks.removeTree(id[0].id)
})

browser.bookmarks.onCreated.addListener(onBookmarkChanged)
browser.bookmarks.onRemoved.addListener(onBookmarkChanged)
browser.bookmarks.onChanged.addListener(onBookmarkChanged)
browser.bookmarks.onMoved.addListener(onBookmarkChanged)
