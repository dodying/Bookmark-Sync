# Bookmark Sync

### [Firefox Addon](https://addons.mozilla.org/firefox/addon/bookmark-sync/)

Inspired by [shanalikhan/code-settings-sync](https://github.com/shanalikhan/code-settings-sync) and Xmarks is dead :cry:

### Usage

1. Cteate a [New personal access token](https://github.com/settings/tokens/new), and add `gist` in scope. [Like this](https://github.com/shanalikhan/code-settings-sync#steps-to-get-a-personal-access-token-from-github)
2. Put in the token in option page

### Usage

Sync starts automatically after settings is saved, or when bookmark changes.

If this is the first sync and remote data is available, it pulls the remote data. 

If remote data is not available, it pushes local data to remote.

Otherwise it checks the `lastUdpate` information to decide to push or pull.

Note that there is no "merge" strategy in this extension. Either all local bookmarks or all remote bookmarks are overwritten after sync.

### Cross browser compatibility

Firefox has four root folders:

* toolbar
* menu
* mobile
* other

Chrome has only two:

* toolbar
* other

When pushing the data, all folders will be pushed to gist. When pulling, only supported folders will be pulled. Therefore bookmarks from Firefox's menu/mobile won't be synced to Chrome. (They still sync between Firefox browsers.)

### Todos

* Support truncated response: https://docs.github.com/en/rest/gists/gists?apiVersion=2022-11-28#truncation
