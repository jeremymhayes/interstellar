// Ads
// settings.js
document.addEventListener("DOMContentLoaded", () => {
  function adChange(selectedValue) {
    if (selectedValue === "default") {
      localStorage.setItem("ads", "on");
    } else if (selectedValue === "popups") {
      localStorage.setItem("ads", "popups");
    } else if (selectedValue === "off") {
      localStorage.setItem("ads", "off");
    }
  }

  const adTypeElement = document.getElementById("adType");

  if (adTypeElement) {
    adTypeElement.addEventListener("change", function () {
      const selectedOption = this.value;
      adChange(selectedOption);
    });

    const storedAd = localStorage.getItem("ads");
    if (storedAd === "on") {
      adTypeElement.value = "default";
    } else if (storedAd === "popups") {
      adTypeElement.value = "popups";
    } else if (storedAd === "off") {
      adTypeElement.value = "off";
    } else {
      adTypeElement.value = "default";
    }
  }
  // Makes the custom icon and name persistent
  const iconElement = document.getElementById("icon");
  const nameElement = document.getElementById("name");
  const customIcon = localStorage.getItem("CustomIcon");
  const customName = localStorage.getItem("CustomName");
  if (iconElement) {
    iconElement.value = customIcon ?? "";
  }
  if (nameElement) {
    nameElement.value = customName ?? "";
  }

  const aboutBlankSwitch = document.getElementById("ab-settings-switch");
  if (aboutBlankSwitch && localStorage.getItem("ab") === "true") {
    aboutBlankSwitch.checked = true;
  }
});

// Dyn
document.addEventListener("DOMContentLoaded", () => {
  function pChange(selectedValue) {
    if (selectedValue === "uv") {
      localStorage.setItem("uv", "true");
      localStorage.setItem("dy", "false");
    } else if (selectedValue === "dy") {
      localStorage.setItem("uv", "false");
      localStorage.setItem("dy", "true");
    }
  }

  const pChangeElement = document.getElementById("pChange");

  if (pChangeElement) {
    pChangeElement.addEventListener("change", function () {
      const selectedOption = this.value;
      pChange(selectedOption);
    });

    const storedP = localStorage.getItem("uv");
    if (storedP === "true") {
      pChangeElement.value = "uv";
    } else if (localStorage.getItem("dy") === "true" || localStorage.getItem("dy") === "auto") {
      pChangeElement.value = "dy";
    } else {
      pChangeElement.value = "uv";
    }
  }
});

// Key
let eventKey = localStorage.getItem("eventKey") || "`";
let eventKeyRaw = localStorage.getItem("eventKeyRaw") || "`";
let pLink = localStorage.getItem("pLink") || "https://classroom.google.com/";

document.addEventListener("DOMContentLoaded", () => {
  const eventKeyField = document.getElementById("eventKeyInput");
  const linkField = document.getElementById("linkInput");

  if (eventKeyField) {
    eventKeyField.value = eventKeyRaw;
  }
  if (linkField) {
    linkField.value = pLink;
  }

  const selectedOption = localStorage.getItem("selectedOption");
  if (selectedOption) {
    updateHeadSection();
  }
});

const eventKeyInput = document.getElementById("eventKeyInput");
eventKeyInput?.addEventListener("input", () => {
  eventKey = eventKeyInput.value
    .split(",")
    .map(key => key.trim())
    .filter(Boolean);
});

const linkInput = document.getElementById("linkInput");
linkInput?.addEventListener("input", () => {
  pLink = linkInput.value;
});

function saveEventKey() {
  if (!eventKeyInput) {
    return;
  }

  const nextEventKey = eventKeyInput.value
    .split(",")
    .map(key => key.trim())
    .filter(Boolean);
  eventKey = nextEventKey.length ? nextEventKey : ["`"];
  eventKeyRaw = eventKeyInput.value;
  localStorage.setItem("eventKey", JSON.stringify(eventKey));
  localStorage.setItem("pLink", pLink);
  localStorage.setItem("eventKeyRaw", eventKeyRaw);
  window.location.reload();
}
const dropdown = document.getElementById("dropdown");
const options = dropdown ? dropdown.getElementsByTagName("option") : [];

const sortedOptions = Array.from(options).sort((a, b) => a.textContent.localeCompare(b.textContent));

if (dropdown) {
  while (dropdown.firstChild) {
    dropdown.removeChild(dropdown.firstChild);
  }

  for (const option of sortedOptions) {
    dropdown.appendChild(option);
  }
}

function saveIcon() {
  const iconElement = document.getElementById("icon");
  const iconValue = iconElement?.value.trim();
  if (!iconValue) {
    return;
  }

  localStorage.setItem("icon", iconValue);
}

function saveName() {
  const nameElement = document.getElementById("name");
  const nameValue = nameElement?.value.trim();
  if (!nameValue) {
    return;
  }

  localStorage.setItem("name", nameValue);
}

function CustomIcon() {
  const iconElement = document.getElementById("icon");
  const iconValue = iconElement?.value.trim();
  if (iconValue) {
    localStorage.setItem("CustomIcon", iconValue);
  } else {
    localStorage.removeItem("CustomIcon");
  }
}

function CustomName() {
  const nameElement = document.getElementById("name");
  const nameValue = nameElement?.value.trim();
  if (nameValue) {
    localStorage.setItem("CustomName", nameValue);
  } else {
    localStorage.removeItem("CustomName");
  }
}
function ResetCustomCloak() {
  localStorage.removeItem("CustomName");
  localStorage.removeItem("CustomIcon");
  const iconInput = document.getElementById("icon");
  const nameInput = document.getElementById("name");
  if (iconInput) {
    iconInput.value = "";
  }
  if (nameInput) {
    nameInput.value = "";
  }
}

function redirectToMainDomain() {
  const currentUrl = window.location.href;
  const mainDomainUrl = currentUrl.replace(/\/[^/]*$/, "");
  const target = mainDomainUrl + window.location.pathname;
  if (window !== top) {
    try {
      top.location.href = target;
    } catch {
      try {
        parent.location.href = target;
      } catch {
        window.location.href = target;
      }
    }
  } else window.location.href = mainDomainUrl + window.location.pathname;
}

document.addEventListener("DOMContentLoaded", () => {
  const selectedValue = localStorage.getItem("selectedOption") || "Default";
  const cloakDropdown = document.getElementById("dropdown");
  if (cloakDropdown) {
    cloakDropdown.value = selectedValue;
  }
  updateHeadSection();
});

function handleDropdownChange(selectElement) {
  const selectedValue = selectElement.value;
  localStorage.removeItem("CustomName");
  localStorage.removeItem("CustomIcon");
  localStorage.setItem("selectedOption", selectedValue);
  updateHeadSection();
  redirectToMainDomain();
}

function updateHeadSection() {
  const icon = document.getElementById("tab-favicon");
  const name = document.getElementById("t");
  const customName = localStorage.getItem("CustomName");
  const customIcon = localStorage.getItem("CustomIcon");

  if (name && customName) {
    name.textContent = customName;
    localStorage.setItem("name", customName);
  }
  if (icon && customIcon) {
    icon.setAttribute("href", customIcon);
    localStorage.setItem("icon", customIcon);
  }
}

function themeChange(selectElement) {
  const selectedTheme = selectElement.value;
  if (!selectedTheme || selectElement.selectedOptions[0]?.disabled) {
    return;
  }

  if (selectedTheme === "d") {
    localStorage.removeItem("theme");
  } else {
    localStorage.setItem("theme", selectedTheme);
  }

  redirectToMainDomain();
}

document.addEventListener("DOMContentLoaded", () => {
  const themeDropdown = document.getElementById("theme-dropdown");
  const selectedTheme = localStorage.getItem("theme");

  if (themeDropdown && selectedTheme) {
    themeDropdown.value = selectedTheme;
  }
});
// Custom Background
document.addEventListener("DOMContentLoaded", () => {
  const saveButton = document.getElementById("save-button");
  const backgroundInput = document.getElementById("background-input");
  const resetButton = document.getElementById("reset-button");

  if (!saveButton || !backgroundInput || !resetButton) {
    return;
  }

  saveButton.addEventListener("click", () => {
    const imageURL = backgroundInput.value;
    if (imageURL.trim() !== "") {
      localStorage.setItem("backgroundImage", imageURL);
      document.body.style.backgroundImage = `url('${imageURL}')`;
      backgroundInput.value = "";
    } else {
      console.log("No image URL entered.");
    }
  });

  resetButton.addEventListener("click", () => {
    localStorage.removeItem("backgroundImage");
    document.body.style.backgroundImage = "";
    window.location.reload();
  });
});

// Particles
const switches = document.getElementById("2");

if (switches) {
  switches.checked = window.localStorage.getItem("particles") === "true";

  switches.addEventListener("change", event => {
    window.localStorage.setItem("particles", event.currentTarget.checked ? "true" : "false");
  });
}
// AB Cloak
function AB() {
  let inFrame;

  try {
    inFrame = window !== top;
  } catch {
    inFrame = true;
  }

  if (!inFrame && !navigator.userAgent.includes("Firefox")) {
    const popup = open("about:blank", "_blank");
    if (!popup || popup.closed) {
      alert("Window blocked. Please allow popups for this site.");
    } else {
      const doc = popup.document;
      const iframe = doc.createElement("iframe");
      const style = iframe.style;
      const link = doc.createElement("link");

      const name = localStorage.getItem("name") || "My Drive - Google Drive";
      const icon = localStorage.getItem("icon") || "https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png";

      doc.title = name;
      link.rel = "icon";
      link.href = icon;

      iframe.src = location.href;
      style.position = "fixed";
      style.top = style.bottom = style.left = style.right = 0;
      style.border = style.outline = "none";
      style.width = style.height = "100%";

      const pLink = localStorage.getItem(encodeURI("pLink")) || getRandomURL();
      location.replace(pLink);

      const script = doc.createElement("script");
      script.textContent = `
        window.onbeforeunload = function (event) {
          const confirmationMessage = 'Leave Site?';
          (event || window.event).returnValue = confirmationMessage;
          return confirmationMessage;
        };
      `;
      doc.head.appendChild(link);
      doc.body.appendChild(iframe);
      doc.head.appendChild(script);
    }
  }
}

function toggleAB() {
  const ab = localStorage.getItem("ab");
  if (!ab) {
    localStorage.setItem("ab", "true");
  } else if (ab === "true") {
    localStorage.setItem("ab", "false");
  } else {
    localStorage.setItem("ab", "true");
  }
}
// Search Engine
function EngineChange(dropdown) {
  const selectedEngine = dropdown.value;

  const engineUrls = {
    Brave: "https://search.brave.com/search?q=",
    Google: "https://www.google.com/search?q=",
    Bing: "https://www.bing.com/search?q=",
    Qwant: "https://www.qwant.com/?q=",
    Startpage: "https://www.startpage.com/search?q=",
    SearchEncrypt: "https://www.searchencrypt.com/search/?q=",
    Ecosia: "https://www.ecosia.org/search?q=",
  };

  if (!engineUrls[selectedEngine]) {
    return;
  }

  localStorage.setItem("engine", engineUrls[selectedEngine]);
  localStorage.setItem("enginename", selectedEngine);

  dropdown.value = selectedEngine;
}

function SaveEngine() {
  const customEngine = document.getElementById("engine-form")?.value.trim();
  if (customEngine) {
    localStorage.setItem("engine", customEngine);
    localStorage.setItem("enginename", "Custom");
  } else {
    alert("Please enter a custom search engine value.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const selectedEngineName = localStorage.getItem("enginename");
  const dropdown = document.getElementById("engine");
  if (dropdown && selectedEngineName) {
    dropdown.value = selectedEngineName;
  }
});

function getRandomURL() {
  const randomURLS = [
    "https://kahoot.it",
    "https://classroom.google.com",
    "https://drive.google.com",
    "https://google.com",
    "https://docs.google.com",
    "https://slides.google.com",
    "https://www.nasa.gov",
    "https://blooket.com",
    "https://clever.com",
    "https://edpuzzle.com",
    "https://khanacademy.org",
    "https://wikipedia.org",
    "https://dictionary.com",
  ];
  return randomURLS[randRange(0, randomURLS.length)];
}

function randRange(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

function exportSaveData() {
  function getCookies() {
    const cookies = document.cookie ? document.cookie.split("; ") : [];
    const cookieObj = {};
    cookies.forEach(cookie => {
      const [name, value] = cookie.split("=");
      if (name) {
        cookieObj[name] = value;
      }
    });
    return cookieObj;
  }
  function getLocalStorage() {
    const localStorageObj = {};
    for (const key in localStorage) {
      if (Object.hasOwn(localStorage, key)) {
        localStorageObj[key] = localStorage.getItem(key);
      }
    }
    return localStorageObj;
  }
  const data = {
    cookies: getCookies(),
    localStorage: getLocalStorage(),
  };
  const dataStr = JSON.stringify(data, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "save_data.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importSaveData() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = event => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.cookies) {
          for (const [key, value] of Object.entries(data.cookies)) {
            // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is not available in every browser this app supports.
            document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; path=/`;
          }
        }
        if (data.localStorage) {
          Object.entries(data.localStorage).forEach(([key, value]) => {
            localStorage.setItem(key, value);
          });
        }
        alert("Your save data has been imported. Please test it out.");
        alert("If you find any issues then report it in GitHub or the Interstellar Discord.");
      } catch (error) {
        console.error("Error parsing JSON file:", error);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

Object.assign(window, {
  AB,
  CustomIcon,
  CustomName,
  EngineChange,
  ResetCustomCloak,
  SaveEngine,
  exportSaveData,
  handleDropdownChange,
  importSaveData,
  redirectToMainDomain,
  saveEventKey,
  saveIcon,
  saveName,
  themeChange,
  toggleAB,
});
