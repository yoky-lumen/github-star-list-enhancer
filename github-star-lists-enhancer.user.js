// ==UserScript==
// @name         GitHub Star Lists Enhancer
// @name:zh-CN   GitHub Star Lists 增强插件
// @namespace    https://github.com/yoky-lumen
// @description  Adds a filter bar to GitHub star lists, with search, language filtering, and sorting.
// @description:zh-CN  为 GitHub Star Lists 新增筛选栏，支持搜索、语言筛选和排序。
// @icon         https://github.githubassets.com/pinned-octocat.svg
// @version      1.0.0
// @author       Yoky
// @license      GPL-3.0
// @homepageURL  https://github.com/yoky-lumen/github-star-lists-enhancer
// @match        https://github.com/stars/*/lists/*
// @supportURL   https://github.com/yoky-lumen/github-star-lists-enhancer/issues
// @grant        none
// @run-at       document-idle
// ==/UserScript==

;(function () {
  "use strict"

  // Page-level configuration for locating GitHub star list content
  // and defining which local sort modes the toolbar should expose.
  const REPO_CONTAINER_SELECTORS = [
    "#user-list-repositories",
    '[data-listview-component="items"]',
    '[data-testid="user-list-repositories"]',
  ]
  const TOOLBAR_VERSION = "2"
  const SORT_OPTIONS = [
    { value: "created-desc", label: "Recently starred" },
    { value: "updated-desc", label: "Recently active" },
    { value: "stars-desc", label: "Most stars" },
  ]

  const repoMetaCache = new WeakMap()

  // Runtime state for the current list page, active filters,
  // and delayed boot work triggered by GitHub navigation updates.
  let originalRepos = []
  let currentLanguage = ""
  let currentSort = "created-desc"
  let pageKey = location.pathname
  let lastRepoSignature = ""
  let bootTimer = null
  let stateVersion = 0
  let shouldClearSearchInput = true
  let pendingKeyword = ""

  const ICON_SEARCH = `
        <span class="FormControl-input-leadingVisualWrap">
            <svg
                data-target="primer-text-field.leadingVisual"
                aria-hidden="true"
                data-component="Octicon"
                height="16"
                viewBox="0 0 16 16"
                version="1.1"
                width="16"
                data-view-component="true"
                class="octicon octicon-search FormControl-input-leadingVisual"
            >
                <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z"></path>
            </svg>
        </span>
    `

  const ICON_TRIANGLE_DOWN = `
        <span class="Button-visual Button-trailingAction">
            <svg
                aria-hidden="true"
                data-component="Octicon"
                height="16"
                viewBox="0 0 16 16"
                version="1.1"
                width="16"
                data-view-component="true"
                class="octicon octicon-triangle-down"
            >
                <path d="m4.427 7.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z"></path>
            </svg>
        </span>
    `

  const ICON_CHECK = `
        <svg
            aria-hidden="true"
            data-component="Octicon"
            height="16"
            viewBox="0 0 16 16"
            version="1.1"
            width="16"
            data-view-component="true"
            class="octicon octicon-check ActionListItem-singleSelectCheckmark"
        >
            <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
        </svg>
    `

  // Shared text helpers keep DOM parsing stable even when GitHub
  // wraps text in nested elements or inserts extra whitespace.
  function cleanText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  }

  function escapeHTML(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;")
  }

  function normalizePath(href) {
    if (!href) {
      return ""
    }

    try {
      return new URL(href, location.origin).pathname
    } catch (_) {
      return href
    }
  }

  // Container and row helpers normalize the current page into a list
  // of repository items that can be filtered and reordered locally.
  function getContainer() {
    for (const selector of REPO_CONTAINER_SELECTORS) {
      const element = document.querySelector(selector)
      if (element) {
        return element
      }
    }

    return null
  }

  function getRepos(container = getContainer()) {
    if (!container) {
      return []
    }

    return Array.from(container.children).filter((repo) => {
      return Boolean(repo.querySelector("h3 a[href], h2 a[href]"))
    })
  }

  function getRepoLink(repo) {
    return repo.querySelector("h3 a[href], h2 a[href]")
  }

  function getRepoName(repo) {
    return cleanText(getRepoLink(repo)?.textContent || "")
  }

  function getRepoPath(repo) {
    return normalizePath(getRepoLink(repo)?.getAttribute("href") || "")
  }

  function getRepoIdentity(repo) {
    return getRepoPath(repo) || getRepoName(repo)
  }

  // Metadata extraction reads the visible repository card once,
  // then later filtering and sorting can rely on cached values.
  function getLanguageFromTextBlock(text) {
    const normalized = cleanText(text)

    if (!normalized) {
      return ""
    }

    const pieces = normalized
      .split(/[\n·•]/)
      .map((piece) => cleanText(piece))
      .filter(Boolean)

    for (const piece of pieces) {
      if (
        piece &&
        !/^\d/.test(piece) &&
        !/star|fork|updated|license|built by|contributors?/i.test(piece) &&
        !/[0-9](k|m|b)?$/i.test(piece)
      ) {
        return piece
      }
    }

    return ""
  }

  function extractLanguage(repo) {
    const itemprop = repo.querySelector('[itemprop="programmingLanguage"]')
    if (itemprop) {
      return cleanText(itemprop.textContent)
    }

    const colorDot = repo.querySelector(".repo-language-color")
    if (colorDot) {
      const parentText = getLanguageFromTextBlock(
        colorDot.parentElement?.textContent || "",
      )
      if (parentText) {
        return parentText
      }

      let sibling = colorDot.nextElementSibling
      while (sibling) {
        const text = cleanText(sibling.textContent)
        if (text) {
          return text
        }

        sibling = sibling.nextElementSibling
      }
    }

    const candidate = Array.from(repo.querySelectorAll("span, div, li")).find(
      (element) => {
        const text = cleanText(element.textContent)
        return /^[A-Za-z][A-Za-z0-9+# ._-]{0,40}$/.test(text)
      },
    )

    return cleanText(candidate?.textContent || "")
  }

  function parseCompactNumber(text) {
    const raw = cleanText(text)
      .replaceAll(",", "")
      .replaceAll("，", "")
      .toLowerCase()

    const match = raw.match(/(\d+(?:\.\d+)?)/)
    if (!match) {
      return 0
    }

    let value = Number(match[1])
    if (Number.isNaN(value)) {
      return 0
    }

    if (/(^|[^a-z])k\b/.test(raw)) {
      value *= 1000
    } else if (/(^|[^a-z])m\b/.test(raw)) {
      value *= 1000000
    } else if (/(^|[^a-z])b\b/.test(raw)) {
      value *= 1000000000
    }

    return Math.round(value)
  }

  // Star counts are read from the repository card so "Most stars"
  // can be sorted locally without any extra page requests.
  function extractStars(repo) {
    const repoPath = getRepoPath(repo)
    const exactStarLink = repo.querySelector(`a[href="${repoPath}/stargazers"]`)
    if (exactStarLink) {
      return parseCompactNumber(exactStarLink.textContent || "")
    }

    const starLink = Array.from(
      repo.querySelectorAll("a[href], button, span"),
    ).find((element) => {
      const href = normalizePath(element.getAttribute?.("href") || "")
      const text = cleanText(element.textContent)
      const aria = cleanText(
        element.getAttribute?.("aria-label") ||
          element.getAttribute?.("title") ||
          "",
      )

      return (
        (repoPath && href === `${repoPath}/stargazers`) ||
        href.endsWith("/stargazers") ||
        /star/i.test(aria) ||
        (/star/i.test(text) && /\d/.test(text))
      )
    })

    if (starLink) {
      const value = parseCompactNumber(starLink.textContent || "")
      if (value > 0) {
        return value
      }
    }

    const starCounter = repo.querySelector(
      '[id*="repo-stars-counter-star"], a[href$="/stargazers"]',
    )
    if (starCounter) {
      return parseCompactNumber(starCounter.textContent || "")
    }

    return 0
  }

  function parseRelativeTime(text) {
    const now = Date.now()
    const normalized = cleanText(text.toLowerCase())

    if (!normalized) {
      return 0
    }

    if (/yesterday/.test(normalized)) {
      return now - 24 * 60 * 60 * 1000
    }

    const enMatch = normalized.match(
      /(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/,
    )
    if (enMatch) {
      const value = Number(enMatch[1])
      const unit = enMatch[2]
      const unitMap = {
        second: 1000,
        minute: 60 * 1000,
        hour: 60 * 60 * 1000,
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
        year: 365 * 24 * 60 * 60 * 1000,
      }

      return now - value * (unitMap[unit] || 0)
    }

    return 0
  }

  // Updated time is parsed so "Recently active" can be sorted
  // without asking GitHub for a new server-rendered list.
  function extractUpdatedTime(repo) {
    const timeElement = repo.querySelector(
      "relative-time[datetime], time-ago[datetime], local-time[datetime], time[datetime]",
    )

    if (timeElement) {
      const datetime =
        timeElement.getAttribute("datetime") || timeElement.dateTime || ""
      const timestamp = Date.parse(datetime)

      if (!Number.isNaN(timestamp)) {
        return timestamp
      }
    }

    const text = cleanText(repo.textContent)

    return parseRelativeTime(text) || 0
  }

  // Each repository row gets a cached metadata object. This avoids
  // re-reading the same DOM nodes every time a filter changes.
  function getRepoMeta(repo) {
    const cached = repoMetaCache.get(repo)
    const version = Number(repo.dataset.ghListsMetaVersion || 0)

    if (cached && version === stateVersion) {
      return cached
    }

    const name = getRepoName(repo)
    const language = extractLanguage(repo)

    const meta = {
      name,
      nameLower: name.toLowerCase(),
      path: getRepoPath(repo),
      language,
      languageLower: language.toLowerCase(),
      stars: extractStars(repo),
      updatedTime: extractUpdatedTime(repo),
      rawText: cleanText(repo.textContent).toLowerCase(),
      originalIndex: Number(repo.dataset.ghListsOriginalIndex || 0),
    }

    repo.dataset.ghListsMetaVersion = String(stateVersion)
    repoMetaCache.set(repo, meta)

    return meta
  }

  function getLanguages() {
    const map = new Map()

    originalRepos.forEach((repo) => {
      const { language, languageLower } = getRepoMeta(repo)

      if (!language) {
        return
      }

      if (!map.has(languageLower)) {
        map.set(languageLower, language)
      }
    })

    return Array.from(map.values()).sort((a, b) => {
      return a.localeCompare(b, "zh-Hans-CN")
    })
  }

  // Dropdown markup is generated to visually match GitHub's stars page
  // while still being fully controlled by local script state.
  function actionItemHTML(kind, value, label, checked) {
    return `
            <li
                data-targets="action-list.items"
                role="none"
                data-view-component="true"
                class="ActionListItem"
            >
                <a
                    href="#"
                    tabindex="${checked ? "0" : "-1"}"
                    role="menuitemradio"
                    aria-checked="${checked ? "true" : "false"}"
                    data-gh-kind="${escapeHTML(kind)}"
                    data-gh-value="${escapeHTML(value)}"
                    data-view-component="true"
                    class="ActionListContent"
                >
                    <span class="ActionListItem-visual ActionListItem-action--leading">
                        ${ICON_CHECK}
                    </span>
                    <span
                        data-view-component="true"
                        class="ActionListItem-label"
                    >
                        ${escapeHTML(label)}
                    </span>
                </a>
            </li>
        `
  }

  function buildActionMenuHTML(
    kind,
    buttonId,
    overlayId,
    listId,
    label,
    extraClass,
  ) {
    return `
            <action-menu
                data-turbo-replace="true"
                data-select-variant="single"
                data-view-component="true"
                class="${extraClass || ""} gh-action-menu"
                data-catalyst=""
                data-ready="true"
            >
                <focus-group direction="vertical" mnemonics="" retain="">
                    <button
                        id="${buttonId}"
                        data-gh-menu-button="${kind}"
                        aria-controls="${listId}"
                        aria-haspopup="true"
                        aria-expanded="false"
                        type="button"
                        data-view-component="true"
                        class="Button--secondary Button--medium Button"
                    >
                        <span class="Button-content">
                            <span
                                id="stars-${kind}-label"
                                class="Button-label"
                            >
                                ${escapeHTML(label)}
                            </span>
                        </span>
                        ${ICON_TRIANGLE_DOWN}
                    </button>
                    <anchored-position
                        data-target="action-menu.overlay"
                        id="${overlayId}"
                        anchor="${buttonId}"
                        align="start"
                        side="outside-bottom"
                        anchor-offset="normal"
                        data-view-component="true"
                        class="gh-menu-overlay"
                        hidden
                    >
                        <div
                            data-view-component="true"
                            class="Overlay Overlay--size-auto"
                        >
                            <div
                                data-view-component="true"
                                class="Overlay-body Overlay-body--paddingNone"
                            >
                                <action-list data-catalyst="">
                                    <div data-view-component="true">
                                        <ul
                                            aria-labelledby="${buttonId}"
                                            id="${listId}"
                                            role="menu"
                                            data-view-component="true"
                                            class="ActionListWrap--inset ActionListWrap"
                                        ></ul>
                                    </div>
                                </action-list>
                            </div>
                        </div>
                    </anchored-position>
                </focus-group>
            </action-menu>
        `
  }

  // The toolbar mirrors GitHub's native stars controls,
  // but keeps all search, filter, and sort behavior local.
  function toolbarHTML() {
    return `
            <div class="d-flex flex-column flex-lg-row flex-items-center tmp-mt-3 mb-n1">
                <div
                    id="gh-lists-search-form"
                    class="subnav-search ml-0 mb-1 mb-lg-0 tmp-mr-lg-3 flex-auto width-full"
                >
                    <div class="FormControl-spacingWrapper">
                        <div
                            data-view-component="true"
                            class="FormControl-horizontalGroup"
                        >
                            <primer-text-field
                                class="FormControl width-full FormControl--fullWidth"
                                data-catalyst=""
                            >
                                <label
                                    class="sr-only FormControl-label"
                                    for="gh-lists-search-query"
                                >
                                    Search
                                </label>
                                <div class="FormControl-input-wrap FormControl-input-wrap--leadingVisual">
                                    ${ICON_SEARCH}
                                    <input
                                        placeholder="Search starred repositories"
                                        aria-label="Search stars"
                                        type="search"
                                        autocapitalize="none"
                                        autocomplete="off"
                                        spellcheck="false"
                                        data-target="primer-text-field.inputElement"
                                        class="FormControl-input FormControl-medium color-fg-muted FormControl-input FormControl-medium"
                                        id="gh-lists-search-query"
                                    >
                                </div>
                            </primer-text-field>
                            <button
                                id="gh-lists-search-button"
                                type="button"
                                data-view-component="true"
                                class="FormField-input flex-self-start Button--secondary Button--medium Button"
                            >
                                <span class="Button-content">
                                    <span class="Button-label">Search</span>
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="d-flex flex-justify-end flex-wrap flex-lg-nowrap width-full">
                    ${buildActionMenuHTML(
                      "language",
                      "stars-language-filter-menu-button",
                      "stars-language-filter-menu-overlay",
                      "stars-language-filter-menu-list",
                      "Language",
                      "mb-1 tmp-mb-1 mb-lg-0 tmp-mb-lg-0",
                    )}
                    ${buildActionMenuHTML(
                      "sort",
                      "stars-sort-menu-button",
                      "stars-sort-menu-overlay",
                      "stars-sort-menu-list",
                      "Sort by: Recently starred",
                      "ml-2 tmp-ml-2 mb-1 tmp-mb-1 mb-lg-0 tmp-mb-lg-0",
                    )}
                </div>
            </div>
        `
  }

  // A small CSS layer is injected so the custom toolbar and dropdowns
  // align with GitHub spacing and remain predictable across updates.
  function injectStyle() {
    if (document.querySelector("#gh-lists-style")) {
      return
    }

    const style = document.createElement("style")
    style.id = "gh-lists-style"
    style.textContent = `
            #gh-lists-toolbar {
                margin-bottom: 16px;
            }

            #gh-lists-toolbar .gh-action-menu {
                position: relative;
            }

            #gh-lists-toolbar .gh-menu-overlay {
                position: absolute !important;
                top: calc(100% + 4px) !important;
                left: 0 !important;
                right: auto !important;
                bottom: auto !important;
                inset: auto auto auto 0 !important;
                z-index: 1000;
                display: block;
            }

            #gh-lists-toolbar .gh-menu-overlay[hidden] {
                display: none !important;
            }

            #gh-lists-toolbar .Overlay {
                width: 192px;
                min-width: 192px;
            }

            #gh-lists-toolbar .Overlay-body {
                max-height: 70vh;
                overflow: auto;
            }

            #gh-lists-toolbar .ActionListWrap {
                width: 192px;
            }

            #gh-lists-toolbar .ActionListContent {
                cursor: pointer;
                text-decoration: none;
            }

            #gh-lists-toolbar .ActionListContent[aria-checked="false"] .ActionListItem-singleSelectCheckmark {
                visibility: hidden;
            }

            #gh-lists-toolbar .ActionListContent[aria-checked="true"] .ActionListItem-singleSelectCheckmark {
                visibility: visible;
            }

            #gh-lists-empty-state {
                margin-top: 16px;
            }
        `

    document.head.appendChild(style)
  }

  // When every repository is filtered out, this empty state explains
  // that the current search and filter combination produced no matches.
  function getEmptyState() {
    let emptyState = document.querySelector("#gh-lists-empty-state")
    if (emptyState) {
      return emptyState
    }

    const container = getContainer()
    if (!container?.parentElement) {
      return null
    }

    emptyState = document.createElement("div")
    emptyState.id = "gh-lists-empty-state"
    emptyState.className =
      "Box color-border-default color-shadow-small p-4 rounded-2 color-bg-subtle"
    emptyState.hidden = true
    emptyState.innerHTML = `
            <div class="color-fg-muted">
                No repositories matched. Try another keyword or clear the language filter.
            </div>
        `

    container.insertAdjacentElement("afterend", emptyState)
    return emptyState
  }

  // The toolbar is inserted above the repository list and rebuilt
  // if GitHub navigation leaves behind an outdated injected version.
  function injectToolbar() {
    const existingToolbar = document.querySelector("#gh-lists-toolbar")
    if (existingToolbar) {
      const isCurrent =
        existingToolbar.dataset.ghListsVersion === TOOLBAR_VERSION &&
        !existingToolbar.querySelector("[popovertarget]")

      if (isCurrent) {
        return true
      }

      existingToolbar.remove()
    }

    const container = getContainer()
    if (!container?.parentElement) {
      return false
    }

    const toolbar = document.createElement("div")
    toolbar.id = "gh-lists-toolbar"
    toolbar.dataset.ghListsVersion = TOOLBAR_VERSION
    toolbar.innerHTML = toolbarHTML()
    container.parentElement.insertBefore(toolbar, container)

    buildSortMenu()
    return true
  }

  // Button labels and menu checkmarks are kept in sync with the current
  // local state so the UI always reflects active filters.
  function getSortLabel(value) {
    return (
      SORT_OPTIONS.find((option) => option.value === value)?.label ||
      "Recently starred"
    )
  }

  function updateLabels() {
    const languageLabel = document.querySelector("#stars-language-label")
    if (languageLabel) {
      languageLabel.textContent = currentLanguage || "Language"
    }

    const sortLabel = document.querySelector("#stars-sort-label")
    if (sortLabel) {
      sortLabel.textContent = `Sort by: ${getSortLabel(currentSort)}`
    }
  }

  function updateMenuState(kind, value) {
    const list = document.querySelector(
      `#stars-${kind}-filter-menu-list, #stars-${kind}-menu-list`,
    )

    if (!list) {
      return
    }

    list
      .querySelectorAll(".ActionListContent[data-gh-kind]")
      .forEach((item) => {
        const checked = (item.dataset.ghValue || "") === (value || "")
        item.setAttribute("aria-checked", checked ? "true" : "false")
        item.setAttribute("tabindex", checked ? "0" : "-1")
      })
  }

  // Menu contents are rebuilt from the repositories already on the page.
  // No extra GitHub requests are required for local filtering and sorting.
  function buildSortMenu() {
    const list = document.querySelector("#stars-sort-menu-list")
    if (!list) {
      return
    }

    list.innerHTML = SORT_OPTIONS.map((option) => {
      return actionItemHTML(
        "sort",
        option.value,
        option.label,
        option.value === currentSort,
      )
    }).join("")

    updateMenuState("sort", currentSort)
  }

  function buildLanguageMenu() {
    const list = document.querySelector("#stars-language-filter-menu-list")
    if (!list) {
      return
    }

    const options = [
      { value: "", label: "All languages" },
      ...getLanguages().map((language) => ({
        value: language,
        label: language,
      })),
    ]

    list.innerHTML = options
      .map((option) => {
        return actionItemHTML(
          "language",
          option.value,
          option.label,
          option.value === currentLanguage,
        )
      })
      .join("")

    updateMenuState("language", currentLanguage)
  }

  // Dropdown open and close behavior is handled manually because
  // custom list pages do not expose GitHub's original server-side menus.
  function closeMenus() {
    document
      .querySelectorAll("#gh-lists-toolbar .gh-menu-overlay")
      .forEach((menu) => {
        menu.hidden = true
      })

    document
      .querySelectorAll("#gh-lists-toolbar [data-gh-menu-button]")
      .forEach((button) => {
        button.setAttribute("aria-expanded", "false")
      })
  }

  function toggleMenu(kind) {
    const overlay = document.querySelector(
      `#stars-${kind}-filter-menu-overlay, #stars-${kind}-menu-overlay`,
    )
    const button = document.querySelector(`[data-gh-menu-button="${kind}"]`)

    if (!overlay || !button) {
      return
    }

    const willOpen = overlay.hidden
    closeMenus()
    overlay.hidden = !willOpen
    button.setAttribute("aria-expanded", willOpen ? "true" : "false")
  }

  // The original repository order is cached so local sorts can always
  // start from the same baseline as the page initially rendered.
  function getKeyword() {
    return cleanText(pendingKeyword).toLowerCase()
  }

  function getRepoSignature(repos) {
    const names = repos
      .map((repo) => getRepoIdentity(repo))
      .filter(Boolean)
      .sort()

    return `${repos.length}::${names.join("|")}`
  }

  function reconcileReposByOriginalOrder(previousRepos, nextRepos) {
    const nextByIdentity = new Map()

    nextRepos.forEach((repo) => {
      const identity = getRepoIdentity(repo)
      if (!identity) {
        return
      }

      if (!nextByIdentity.has(identity)) {
        nextByIdentity.set(identity, [])
      }

      nextByIdentity.get(identity).push(repo)
    })

    const ordered = []

    previousRepos.forEach((repo) => {
      const identity = getRepoIdentity(repo)
      const candidates = nextByIdentity.get(identity)
      const nextRepo = candidates?.shift()

      if (nextRepo) {
        ordered.push(nextRepo)
      }
    })

    nextRepos.forEach((repo) => {
      if (!ordered.includes(repo)) {
        ordered.push(repo)
      }
    })

    return ordered
  }

  function ensureCache(force = false) {
    const repos = getRepos()
    if (!repos.length) {
      originalRepos = []
      lastRepoSignature = ""
      return false
    }

    const nextSignature = getRepoSignature(repos)
    const shouldRefresh =
      force || !originalRepos.length || nextSignature !== lastRepoSignature

    if (!shouldRefresh) {
      return true
    }

    const isSameRepoSet =
      force && originalRepos.length && nextSignature === lastRepoSignature

    originalRepos = isSameRepoSet
      ? reconcileReposByOriginalOrder(originalRepos, repos)
      : [...repos]
    lastRepoSignature = nextSignature
    stateVersion += 1

    originalRepos.forEach((repo, index) => {
      repo.dataset.ghListsOriginalIndex = String(index)
      repo.dataset.ghListsMetaVersion = "0"
    })

    buildLanguageMenu()

    return true
  }

  // Sorting and matching are done in memory from cached repository data.
  // This keeps the list responsive and avoids round-trips to GitHub.
  function compareOriginalIndex(a, b) {
    return getRepoMeta(a).originalIndex - getRepoMeta(b).originalIndex
  }

  function getOrderedRepos() {
    const repos = [...originalRepos]

    if (currentSort === "created-desc") {
      return repos.reverse()
    }

    if (currentSort === "updated-desc") {
      return repos.sort((a, b) => {
        const diff = getRepoMeta(b).updatedTime - getRepoMeta(a).updatedTime
        return diff || compareOriginalIndex(a, b)
      })
    }

    if (currentSort === "stars-desc") {
      return repos.sort((a, b) => {
        const diff = getRepoMeta(b).stars - getRepoMeta(a).stars
        return diff || compareOriginalIndex(a, b)
      })
    }

    return repos
  }

  function matchRepo(repo, keyword) {
    const meta = getRepoMeta(repo)
    const languageMatched =
      !currentLanguage || meta.languageLower === currentLanguage.toLowerCase()
    const terms = keyword
      ? keyword
          .split(/\s+/)
          .map((term) => term.trim())
          .filter(Boolean)
      : []
    const haystack = `${meta.nameLower}\n${meta.rawText}`
    const searchMatched =
      !terms.length || terms.every((term) => haystack.includes(term))

    return languageMatched && searchMatched
  }

  function updateEmptyState(visibleCount) {
    const emptyState = getEmptyState()
    if (!emptyState) {
      return
    }

    emptyState.hidden = visibleCount > 0
  }

  // The list is updated by reordering existing DOM rows and toggling
  // visibility, instead of rebuilding repository cards from scratch.
  function update() {
    const container = getContainer()
    if (!container) {
      return
    }

    if (!ensureCache()) {
      return
    }

    const keyword = getKeyword()
    const orderedRepos = getOrderedRepos()
    let visibleCount = 0

    orderedRepos.forEach((repo) => {
      container.appendChild(repo)

      const matched = matchRepo(repo, keyword)
      repo.hidden = !matched
      repo.style.display = matched ? "" : "none"

      if (matched) {
        visibleCount += 1
      }
    })

    updateLabels()
    updateMenuState("language", currentLanguage)
    updateMenuState("sort", currentSort)
    updateEmptyState(visibleCount)
  }

  // Toolbar interactions only mutate local state, then trigger a repaint
  // of the current list based on the updated search, filter, and sort choices.
  function selectOption(kind, value) {
    if (kind === "language") {
      currentLanguage = value || ""
    } else if (kind === "sort") {
      currentSort = value || "created-desc"
    }

    updateLabels()
    updateMenuState(kind, value)
    closeMenus()
    update()
  }

  // GitHub often navigates without a full reload, so this reset clears
  // cached page state whenever the script lands on a different list path.
  function resetForNavigationIfNeeded() {
    const nextKey = location.pathname
    if (nextKey === pageKey) {
      return false
    }

    pageKey = nextKey
    originalRepos = []
    currentLanguage = ""
    currentSort = "created-desc"
    lastRepoSignature = ""
    stateVersion += 1
    shouldClearSearchInput = true

    document.querySelector("#gh-lists-toolbar")?.remove()
    document.querySelector("#gh-lists-empty-state")?.remove()
    return true
  }

  // Bootstrapping injects the toolbar, refreshes repository metadata,
  // and paints the list based on the current local state.
  function syncSearchInput() {
    const input = document.querySelector("#gh-lists-search-query")
    if (!input) {
      return
    }

    if (shouldClearSearchInput) {
      input.value = ""
      pendingKeyword = ""
      shouldClearSearchInput = false
      return
    }

    input.value = pendingKeyword
  }

  function commitSearch() {
    const input = document.querySelector("#gh-lists-search-query")
    pendingKeyword = cleanText(input?.value || "")
    update()
  }

  function boot(forceCache = false) {
    resetForNavigationIfNeeded()
    injectStyle()

    if (!injectToolbar()) {
      return
    }

    syncSearchInput()

    if (!ensureCache(forceCache)) {
      return
    }

    buildSortMenu()
    buildLanguageMenu()
    update()
  }

  function scheduleBoot(forceCache = false) {
    clearTimeout(bootTimer)
    bootTimer = setTimeout(() => {
      boot(forceCache)
    }, 180)
  }

  // Global listeners keep the toolbar interactive even when GitHub
  // updates the page with client-side navigation or partial rerenders.
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target instanceof Element ? event.target : null
      if (!target) {
        return
      }

      const toolbar = document.querySelector("#gh-lists-toolbar")
      if (!toolbar) {
        return
      }

      const menuButton = target.closest("[data-gh-menu-button]")
      if (menuButton && toolbar.contains(menuButton)) {
        event.preventDefault()
        event.stopPropagation()
        toggleMenu(menuButton.dataset.ghMenuButton)
        return
      }

      const menuItem = target.closest(".ActionListContent[data-gh-kind]")
      if (menuItem && toolbar.contains(menuItem)) {
        event.preventDefault()
        event.stopPropagation()
        selectOption(
          menuItem.dataset.ghKind || "",
          menuItem.dataset.ghValue || "",
        )
        return
      }

      if (!toolbar.contains(target)) {
        closeMenus()
      }
    },
    true,
  )

  document.addEventListener("keydown", (event) => {
    const target = event.target

    if (
      event.key === "Enter" &&
      target instanceof HTMLInputElement &&
      target.id === "gh-lists-search-query"
    ) {
      event.preventDefault()
      commitSearch()
      return
    }

    if (event.key === "Escape") {
      closeMenus()
    }
  })

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target instanceof Element ? event.target : null
      if (!target) {
        return
      }

      const searchButton = target.closest("#gh-lists-search-button")
      if (!searchButton) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      commitSearch()
    },
    true,
  )

  const observer = new MutationObserver(() => {
    const container = getContainer()
    const toolbar = document.querySelector("#gh-lists-toolbar")

    if (!container) {
      return
    }

    if (!toolbar) {
      scheduleBoot(true)
      return
    }

    const repos = getRepos(container)
    const nextSignature = getRepoSignature(repos)
    if (repos.length && nextSignature !== lastRepoSignature) {
      scheduleBoot(true)
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })

  window.addEventListener("popstate", () => {
    scheduleBoot(true)
  })

  window.addEventListener("pjax:end", () => {
    scheduleBoot(true)
  })

  window.addEventListener("turbo:render", () => {
    scheduleBoot(true)
  })

  window.addEventListener("turbo:load", () => {
    scheduleBoot(true)
  })

  console.log("GitHub Star Lists Enhancer started")
  scheduleBoot(true)
})()
