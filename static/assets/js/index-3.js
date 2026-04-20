// index.js
window.addEventListener("load", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("../sw.js?v=2025-04-15", {
        scope: "/a/",
      })
      .catch(error => {
        console.warn("Service worker registration failed:", error);
      });
  }
});

let xl;

try {
  xl = window.top.location.pathname === "/d";
} catch {
  try {
    xl = window.parent.location.pathname === "/d";
  } catch {
    xl = false;
  }
}

const form = document.getElementById("fv");
const input = document.getElementById("input");

if (form && input) {
  form.addEventListener("submit", async event => {
    event.preventDefault();
    try {
      if (xl) processUrl(input.value, "");
      else processUrl(input.value, "/d");
    } catch {
      processUrl(input.value, "/d");
    }
  });
}
function processUrl(value, path) {
  let url = value.trim();
  if (!url) {
    return;
  }

  const engine = localStorage.getItem("engine");
  const searchUrl = engine || "https://search.brave.com/search?q=";

  if (!isUrl(url)) {
    url = searchUrl + encodeURIComponent(url);
  } else if (!(url.startsWith("https://") || url.startsWith("http://"))) {
    url = `https://${url}`;
  }

  sessionStorage.setItem("GoUrl", __uv$config.encodeUrl(url));
  const dy = localStorage.getItem("dy");

  if (dy === "true") {
    window.location.href = `/a/q/${__uv$config.encodeUrl(url)}`;
  } else if (path) {
    location.href = path;
  } else {
    window.location.href = `/a/${__uv$config.encodeUrl(url)}`;
  }
}

function go(value) {
  processUrl(value, "/d");
}

function blank(value) {
  processUrl(value);
}

function dy(value) {
  processUrl(value, `/a/q/${__uv$config.encodeUrl(value)}`);
}

function isUrl(val = "") {
  return /^https?:\/\//.test(val) || (val.includes(".") && val.trim().length > 0);
}

Object.assign(window, {
  blank,
  dy,
  go,
});
