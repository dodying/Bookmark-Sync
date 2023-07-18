/* eslint-env webextensions */
document.querySelector("[name=save]").addEventListener("click", async function() {
  const token = document.querySelector("[name=token]").value;
  const gistId = document.querySelector("[name=gistId]").value;
  await browser.storage.local.set({
    token: token,
    gistId: gistId
  });
  document.querySelector(".status").textContent = "Options saved.";
});

browser.storage.local.get(["token", "gistId"]).then(function(result) {
  document.querySelector("[name=token]").value = result.token || "";
  document.querySelector("[name=gistId]").value = result.gistId || "";
});
