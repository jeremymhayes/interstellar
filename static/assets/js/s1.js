if (localStorage.getItem("ab") === null) {
  localStorage.setItem("ab", "true");
}

let eventKey = ["`"];
let eventKeyRaw = localStorage.getItem("eventKeyRaw") || "`";
let panicLink = localStorage.getItem("pLink") || "https://classroom.google.com/";

try {
  const storedEventKey = JSON.parse(localStorage.getItem("eventKey"));
  if (Array.isArray(storedEventKey) && storedEventKey.length > 0) {
    eventKey = storedEventKey;
  }
} catch {
  eventKey = [eventKeyRaw];
}

document.addEventListener("DOMContentLoaded", () => {
  const aboutBlankSwitch = document.getElementById("ab-settings-switch");
  if (aboutBlankSwitch) {
    aboutBlankSwitch.checked = localStorage.getItem("ab") === "true";
  }

  const eventKeyField = document.getElementById("eventKeyInput");
  const linkField = document.getElementById("linkInput");
  if (eventKeyField) {
    eventKeyField.value = eventKeyRaw;
  }
  if (linkField) {
    linkField.value = panicLink;
  }

  const cloakDropdown = document.getElementById("dropdown");
  const selectedCloak = localStorage.getItem("selectedOption");
  if (cloakDropdown && selectedCloak) {
    cloakDropdown.value = selectedCloak;
  }

  const proxyDropdown = document.getElementById("pChange");
  if (proxyDropdown) {
    proxyDropdown.value = localStorage.getItem("dy") === "true" ? "dy" : "uv";
    proxyDropdown.addEventListener("change", () => {
      const useDynamic = proxyDropdown.value === "dy";
      localStorage.setItem("dy", String(useDynamic));
      localStorage.setItem("uv", String(!useDynamic));
    });
  }

  const engineDropdown = document.getElementById("engine");
  const selectedEngine = localStorage.getItem("enginename");
  if (engineDropdown && selectedEngine && selectedEngine !== "Custom") {
    engineDropdown.value = selectedEngine;
  }
});

function saveEventKey() {
  const keyInput = document.getElementById("eventKeyInput");
  const linkInput = document.getElementById("linkInput");
  if (!keyInput || !linkInput) {
    return;
  }

  const nextKeys = keyInput.value
    .split(",")
    .map(key => key.trim())
    .filter(Boolean);

  eventKey = nextKeys.length > 0 ? nextKeys : ["`"];
  eventKeyRaw = keyInput.value;
  panicLink = linkInput.value.trim() || "https://classroom.google.com/";
  localStorage.setItem("eventKey", JSON.stringify(eventKey));
  localStorage.setItem("eventKeyRaw", eventKeyRaw);
  localStorage.setItem("pLink", panicLink);
}

function redirectToMainDomain() {
  window.location.reload();
}

function handleDropdownChange(selectElement) {
  localStorage.removeItem("CustomName");
  localStorage.removeItem("CustomIcon");
  localStorage.setItem("selectedOption", selectElement.value);
  redirectToMainDomain();
}

function ResetCustomCloak() {
  localStorage.removeItem("selectedOption");
  localStorage.removeItem("CustomName");
  localStorage.removeItem("CustomIcon");
  localStorage.removeItem("name");
  localStorage.removeItem("icon");
  redirectToMainDomain();
}

function AB() {
  let inFrame;
  try {
    inFrame = window !== top;
  } catch {
    inFrame = true;
  }

  if (inFrame || navigator.userAgent.includes("Firefox")) {
    return;
  }

  const popup = open("about:blank", "_blank");
  if (!popup || popup.closed) {
    alert("Window blocked. Please allow popups for this site.");
    return;
  }

  const iframe = popup.document.createElement("iframe");
  const icon = popup.document.createElement("link");
  popup.document.title = localStorage.getItem("name") || "My Drive - Google Drive";
  icon.rel = "icon";
  icon.href = localStorage.getItem("icon") || "https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png";

  iframe.src = location.href;
  Object.assign(iframe.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    border: "0",
    outline: "0",
  });

  popup.document.head.appendChild(icon);
  popup.document.body.appendChild(iframe);
  location.replace(localStorage.getItem("pLink") || getRandomURL());
}

function toggleAB() {
  const enabled = localStorage.getItem("ab") !== "true";
  localStorage.setItem("ab", String(enabled));
}

function EngineChange(dropdown) {
  const engineUrls = {
    Brave: "https://search.brave.com/search?q=",
    Google: "https://www.google.com/search?q=",
    Bing: "https://www.bing.com/search?q=",
    Qwant: "https://www.qwant.com/?q=",
    Startpage: "https://www.startpage.com/search?q=",
    SearchEncrypt: "https://www.searchencrypt.com/search/?q=",
    Ecosia: "https://www.ecosia.org/search?q=",
  };

  const url = engineUrls[dropdown.value];
  if (!url) {
    return;
  }

  localStorage.setItem("engine", url);
  localStorage.setItem("enginename", dropdown.value);
}

function SaveEngine() {
  const customEngine = document.getElementById("engine-form")?.value.trim();
  if (!customEngine) {
    alert("Enter a custom search URL prefix first.");
    return;
  }

  localStorage.setItem("engine", customEngine);
  localStorage.setItem("enginename", "Custom");
}

function getRandomURL() {
  const urls = [
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
  return urls[Math.floor(Math.random() * urls.length)];
}

function exportSaveData() {
  const cookies = {};
  for (const cookie of document.cookie ? document.cookie.split("; ") : []) {
    const separator = cookie.indexOf("=");
    if (separator > 0) {
      cookies[cookie.slice(0, separator)] = cookie.slice(separator + 1);
    }
  }

  const storedValues = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    storedValues[key] = localStorage.getItem(key);
  }

  const blob = new Blob([JSON.stringify({ cookies, localStorage: storedValues }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const download = document.createElement("a");
  download.href = url;
  download.download = "save_data.json";
  download.click();
  URL.revokeObjectURL(url);
}

function importSaveData() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", loadEvent => {
      try {
        const data = JSON.parse(loadEvent.target.result);
        for (const [key, value] of Object.entries(data.cookies ?? {})) {
          // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is not available in every supported browser.
          document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; path=/`;
        }
        for (const [key, value] of Object.entries(data.localStorage ?? {})) {
          localStorage.setItem(key, value);
        }
        alert("Save data imported.");
        window.location.reload();
      } catch (error) {
        console.error("Unable to import save data:", error);
        alert("That file could not be imported.");
      }
    });
    reader.readAsText(file);
  });
  input.click();
}

Object.assign(window, {
  AB,
  EngineChange,
  ResetCustomCloak,
  SaveEngine,
  exportSaveData,
  handleDropdownChange,
  importSaveData,
  redirectToMainDomain,
  saveEventKey,
  toggleAB,
});
