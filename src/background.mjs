import browser from "webextension-polyfill";

const USER_AGENT = navigator.userAgent.match(/Firefox/) ? "firefox" : "chrome";

const builtinIds = {
  // root: {
  //   chrome: "0",
  //   firefox: "root________"
  // },
  toolbar: {
    chrome: "1",
    firefox: "toolbar_____"
  },
  other: {
    // FIXME: it seems that vivaldi doesn't have "other bookmarks"?
    chrome: "2",
    firefox: "unfiled_____"
  },
  mobile: {
    chrome: null,
    firefox: "mobile______"
  },
  menu: {
    chrome: null,
    firefox: "menu________"
  }
}

let running = false;
let bookmarkChanged = false;

async function sync() {
  if (running) {
    scheduleSync();
    return;
  }
  running = true;
  try {
    await _sync();
  } catch (e) {
    console.error(e);
    await delay(5000)
  }
  running = false;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function compareData(a, b) {
  for (const key in builtinIds) {
    if (!builtinIds[key][USER_AGENT]) continue;
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
      return 1;
    }
  }
  return 0;
}

async function getRemoteData(token, gistId) {
  const rr = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'GET',
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `token ${token}`
    },
  })
  const r = await rr.json();
  if (r.truncated) {
    throw new Error("Gist content is too large");
  }
  return r.files['bookmark.json'] ? JSON.parse(r.files['bookmark.json'].content) : null;
}

async function _sync() {
  console.log(`sync start, bookmarkChanged: ${bookmarkChanged}`);
  let {token, bookmarkData, gistId} = await browser.storage.local.get(['token', 'bookmarkData', 'gistId']);
  if (!token || !gistId) {
    console.log("not login");
    return;
  }
  const remoteData = await getRemoteData(token, gistId);
  console.log("remoteData: ", remoteData);
  if (remoteData) {
    if (!bookmarkData || bookmarkData.lastUpdate < remoteData.lastUpdate) {
      console.log("patch local bookmark");
      await patchBookmark(remoteData);
      await browser.storage.local.set({bookmarkData: remoteData});
      bookmarkData = remoteData;
    } else if (bookmarkData && bookmarkData.lastUpdate > remoteData.lastUpdate) {
      console.log("patch gist (local is newer, the previous push failed?)");
      await patchGist(bookmarkData, token, gistId);
    }
  }
  if (!bookmarkChanged && remoteData) {
    console.log("no need to push");
    return;
  }
  bookmarkChanged = false;
  console.log("get local bookmark")
  const newBookmarkData = await getBookmarkData();
  if (bookmarkData && compareData(bookmarkData, newBookmarkData) === 0) {
    console.log("no change");
    return;
  }
  if (!bookmarkData) {
    console.log("remote is empty, push local bookmarks");
    bookmarkData = newBookmarkData;
  } else {
    console.log("merge local and remote bookmarks");
    Object.assign(bookmarkData, newBookmarkData);
  }
  console.log("patch gist");
  await patchGist(bookmarkData, token, gistId);
  await browser.storage.local.set({bookmarkData});
}

async function getBookmarkData() {
  const data = {
    lastUpdate: Date.now(),
  };
  for (const key in builtinIds) {
    const parentId = builtinIds[key][USER_AGENT];
    if (!parentId) continue;
    const bookmarks = await browser.bookmarks.getSubTree(parentId);
    data[key] = bookmarks[0].children.map(cleanBookmark);
  }
  return data;
}

function cleanBookmark(bookmark) {
  const b = {
    type: getBookmarkType(bookmark),
  };
  if (b.type !== "separator") {
    b.title = bookmark.title;
  }
  if (b.type === "bookmark") {
    b.url = bookmark.url;
  }
  if (b.type === "folder") {
    b.children = (bookmark.children || []).map(cleanBookmark);
  }
  return b;
}

async function patchGist(data, token, gistId) {
  await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `token ${token}`
    },
    body: JSON.stringify({
      files: {
        'bookmark.json': {
          content: JSON.stringify(data, null, 2)
        }
      }
    })
  });
}

async function patchBookmark(remote) {
  for (const baseKey in builtinIds) {
    const parentId = builtinIds[baseKey][USER_AGENT];
    if (!parentId) continue;
    const localBookmarks = await browser.bookmarks.getSubTree(parentId);
    await patchBookmarkFolder(localBookmarks[0].children, remote[baseKey], parentId);
  }
}

function isSameBookmark(a, b) {
  if (!a || !b) return false;
  if (getBookmarkType(a) !== getBookmarkType(b)) return false;
  if (a.title !== b.title) return false;
  if (a.url !== b.url) return false;
  return true;
}

function getBookmarkType(bookmark) {
  if (bookmark.type) return bookmark.type;
  if (bookmark.children || bookmark.url == null) return 'folder';
  if (bookmark.title.match(/^-+$/)) return 'separator';
  return 'bookmark';
}

// NOTE: bookmark.children is often undefined in Chrome when the folder is empty
async function patchBookmarkFolder(local = [], remote, parentId) {
  let i = 0, j = 0;
  for (; i < local.length && j < remote.length;) {
    if (isSameBookmark(local[i], remote[j])) {
      if (remote[j].children) {
        await patchBookmarkFolder(local[i].children, remote[j].children, local[i].id);
      }
      i++;
      j++;
      continue;
    }
    // FIXME: should we use a more advanced algorithm to find reordered items?
    if (isSameBookmark(local[i], remote[j + 1])) {
      // remote[j] is new
      const r = await createBookmark({
        index: j,
        parentId,
        title: remote[j].title,
        url: remote[j].url,
        type: getBookmarkType(remote[j])
      });
      j++;
      if (remote[j].children) {
        await patchBookmarkFolder(r.children, remote[j].children, r.id);
      }
      continue;
    }
    // local[i] is deleted
    // remoteTree can also remove a single bookmark
    await browser.bookmarks.removeTree(local[i].id);
    i++;
    continue;
  }
  for (;j < remote.length; j++) {
    const r = await createBookmark({
      index: j,
      parentId,
      title: remote[j].title,
      url: remote[j].url,
      type: getBookmarkType(remote[j])
    });
    if (remote[j].children) {
      await patchBookmarkFolder(r.children, remote[j].children, r.id);
    }
  }
}
    
browser.bookmarks.onCreated.addListener(onBookmarkChanged)
browser.bookmarks.onRemoved.addListener(onBookmarkChanged)
browser.bookmarks.onChanged.addListener(onBookmarkChanged)
browser.bookmarks.onMoved.addListener(onBookmarkChanged)
browser.storage.onChanged.addListener(changes => {
  if (changes.token || changes.gistId) {
    // FIXME: should we clear bookmarkData when token is changed?
    console.log("token or gistId changed")
    scheduleSync();
  }
});


async function onBookmarkChanged() {
  console.log("onBookmarkChanged")
  const {token, gistId} = await browser.storage.local.get(['token', 'gistId']);
  if (!token || !gistId) return;
  // FIXME: we will loose the bookmarkChanged state if the browser is closed before the sync
  // should we save it into storage?
  bookmarkChanged = true;
  scheduleSync();
}

async function createBookmark(bookmark) {
  if (USER_AGENT === 'chrome') {
    if (bookmark.type === 'folder') {
      bookmark.url = null;
    } else if (bookmark.type === 'separator') {
      bookmark.title = '-----------------';
      bookmark.url = 'about:blank';
    }
    delete bookmark.type;
  } else if (bookmark.type === "separator") {
    delete bookmark.title;
    delete bookmark.url;
  }
  return await browser.bookmarks.create(bookmark);
}

function scheduleSync(delayInMinutes = 1) {
  browser.alarms.create('sync', {
    periodInMinutes: 10,
    // NOTE: Firefox doesn't support delayInMinutes: 0?
    delayInMinutes
  });
}

scheduleSync();

browser.alarms.onAlarm.addListener(alarm => {
  console.log("alarm", alarm)
  if (alarm.name === 'sync') {
    sync().catch(e => console.error(e));
  }
});
