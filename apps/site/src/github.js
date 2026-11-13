const githubApi = "https://api.github.com/repos/asetho/Surls";

async function githubJson(path) {
  const response = await fetch(`${githubApi}${path}`, {
    headers: { Accept: "application/vnd.github+json" },
    referrerPolicy: "no-referrer"
  });
  if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
  return response.json();
}

Promise.allSettled([
  githubJson(""),
  githubJson("/releases/latest")
]).then(([repository, release]) => {
  if (release.status === "fulfilled" && typeof release.value.tag_name === "string") {
    document.querySelector("[data-github-release]").textContent = release.value.tag_name;
  }

  if (repository.status === "fulfilled") {
    for (const [field, value] of [
      ["stars", repository.value.stargazers_count],
      ["forks", repository.value.forks_count]
    ]) {
      if (!Number.isSafeInteger(value) || value < 0) continue;
      document.querySelector(`[data-github-${field}-count]`).textContent = value.toLocaleString();
      document.querySelector(`[data-github-${field}]`).hidden = false;
    }
  }
});
