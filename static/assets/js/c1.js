const currentPath = window.location.pathname;
const isGamesPage = currentPath === "/a" || currentPath === "/play.html";
const isAppsPage = currentPath === "/b";

let isInsideTabs = false;
try {
  isInsideTabs = window.top.location.pathname === "/d";
} catch {
  try {
    isInsideTabs = window.parent.location.pathname === "/d";
  } catch {
    isInsideTabs = false;
  }
}

const catalogPath = isGamesPage ? "/assets/json/g.min.json" : "/assets/json/a.min.json";
const pinStorageKey = isGamesPage ? "Gpinned" : isAppsPage ? "Apinned" : "Tpinned";
const customStorageKey = isGamesPage ? "Gcustom" : isAppsPage ? "Acustom" : "Tcustom";

function saveToLocal(path) {
  sessionStorage.setItem("GoUrl", path);
}

function getSelected(links) {
  if (links.length === 1) {
    return links[0].url;
  }

  const options = links.map((link, index) => `${index + 1}: ${link.name}`).join("\n");
  const choice = prompt(`Select a link by entering the corresponding number:\n${options}`);
  const selectedIndex = Number.parseInt(choice, 10) - 1;

  if (Number.isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= links.length) {
    alert("Invalid selection. Please try again.");
    return null;
  }

  return links[selectedIndex].url;
}

function handleClick(app) {
  if (app.say) {
    alert(app.say);
  }

  if (app.custom) {
    createCustomApp();
    return;
  }

  let selected = app.link;
  if (Array.isArray(app.links) && app.links.length > 0) {
    selected = getSelected(app.links);
  }

  if (!selected) {
    return;
  }

  if (app.local) {
    saveToLocal(selected);
    window.location.href = isInsideTabs ? selected : "rx";
  } else if (app.local2) {
    saveToLocal(selected);
    window.location.href = selected;
  } else if (app.blank) {
    blank(selected);
  } else if (app.now && typeof window.now === "function") {
    window.now(selected);
    if (isInsideTabs) {
      window.location.href = selected;
    }
  } else if (app.dy) {
    dy(selected);
  } else {
    go(selected);
    if (isInsideTabs) {
      blank(selected);
    }
  }
}

function getPinnedIndexes() {
  const savedPins = localStorage.getItem(pinStorageKey);
  if (!savedPins) {
    return [];
  }

  return savedPins
    .split(",")
    .map(Number)
    .filter(Number.isInteger);
}

function setPin(index) {
  const pins = getPinnedIndexes();
  const existingIndex = pins.indexOf(index);

  if (existingIndex >= 0) {
    pins.splice(existingIndex, 1);
  } else {
    pins.push(index);
  }

  localStorage.setItem(pinStorageKey, pins.join(","));
  window.location.reload();
}

function getStoredCustomApps() {
  try {
    return JSON.parse(localStorage.getItem(customStorageKey)) ?? {};
  } catch {
    return {};
  }
}

function saveCustomApp(customApp) {
  const apps = getStoredCustomApps();
  const key = `custom${Object.keys(apps).length + 1}`;
  apps[key] = customApp;
  localStorage.setItem(customStorageKey, JSON.stringify(apps));
}

function createCustomApp() {
  const title = prompt("Enter a title:");
  const link = prompt("Enter a URL:");

  if (!title || !link) {
    return;
  }

  const customApp = {
    name: `[Custom] ${title}`,
    link,
    image: "/assets/media/icons/custom.webp",
  };

  saveCustomApp(customApp);
  document.querySelector(".apps")?.prepend(createCard(customApp));
  applyFilters();
}

function createCard(app, index = null) {
  const card = document.createElement("article");
  card.className = "column";
  card.dataset.category = (app.categories ?? ["all"]).join(" ");
  card.dataset.name = app.name.toLowerCase();

  if (app.error) {
    card.dataset.status = "error";
    app.say ||= "This item is currently unavailable.";
  } else if (app.load || app.partial) {
    card.dataset.status = "warning";
    app.say ||= "This item may load slowly or have limited support.";
  }

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "app-button";
  openButton.addEventListener("click", () => handleClick(app));

  if (app.image) {
    const image = document.createElement("img");
    image.src = app.image;
    image.alt = "";
    image.loading = "lazy";
    openButton.appendChild(image);
  }

  const name = document.createElement("p");
  name.textContent = app.name;
  openButton.appendChild(name);
  card.appendChild(openButton);

  if (Number.isInteger(index) && index !== 0) {
    const pinButton = document.createElement("button");
    pinButton.type = "button";
    pinButton.className = "pin-button";
    pinButton.textContent = getPinnedIndexes().includes(index) ? "Unpin" : "Pin";
    pinButton.setAttribute("aria-label", `${pinButton.textContent} ${app.name}`);
    pinButton.addEventListener("click", () => setPin(index));
    card.appendChild(pinButton);
  }

  return card;
}

function applyFilters() {
  const query = document.getElementById("search")?.value.trim().toLowerCase() ?? "";
  const selectedCategory = document.getElementById("category")?.value ?? "all";

  for (const card of document.querySelectorAll(".column")) {
    const categories = card.dataset.category.split(" ");
    const matchesQuery = card.dataset.name.includes(query);
    const matchesCategory = selectedCategory === "all" || categories.includes(selectedCategory);
    card.hidden = !(matchesQuery && matchesCategory);
  }
}

function bar() {
  applyFilters();
}

function category() {
  applyFilters();
}

async function loadCatalog() {
  const appsContainer = document.querySelector(".apps");
  const pinnedContainer = document.querySelector(".pinned");
  if (!appsContainer || !pinnedContainer) {
    return;
  }

  for (const app of Object.values(getStoredCustomApps())) {
    appsContainer.appendChild(createCard(app));
  }

  try {
    const response = await fetch(catalogPath);
    if (!response.ok) {
      throw new Error(`Catalog request failed with status ${response.status}`);
    }

    const catalog = await response.json();
    catalog.sort((first, second) => first.name.localeCompare(second.name));
    const pinnedIndexes = getPinnedIndexes();

    catalog.forEach((app, index) => {
      if (typeof app.link === "string" && app.link.startsWith("/")) {
        app.local = true;
      } else if (app.link?.includes("now.gg") || app.link?.includes("nowgg.me")) {
        app.partial ??= true;
        app.say ??= "This item is not available for every user.";
      } else if (app.link?.includes("nowgg.nl")) {
        app.error ??= true;
        app.say ??= "This item is currently unavailable.";
      }

      const card = createCard(app, index);
      if (index !== 0 && pinnedIndexes.includes(index)) {
        pinnedContainer.appendChild(card);
      } else {
        appsContainer.appendChild(card);
      }
    });

    applyFilters();
  } catch (error) {
    console.error("Unable to load catalog:", error);
    const message = document.createElement("p");
    message.className = "muted";
    message.textContent = "The catalog could not be loaded.";
    appsContainer.appendChild(message);
  }
}

document.addEventListener("DOMContentLoaded", loadCatalog);

Object.assign(window, {
  bar,
  category,
});
