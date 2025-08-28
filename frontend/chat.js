// frontend/chat.js

const API_BASE = "http://localhost:3006"; // change in prod

const chatBox = document.getElementById("chat-box");
const input = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");

let sessionId = `sess-${Date.now()}`;

// --- Helpers ---
function appendMessage(text, sender = "user") {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${sender}`;
  bubble.innerText = text;
  chatBox.appendChild(bubble);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function showTyping() {
  const bubble = document.createElement("div");
  bubble.id = "typing-indicator";
  bubble.className = "bubble bot typing";
  bubble.innerHTML = `<span class="dot"></span><span class="dot"></span><span class="dot"></span> RabbitLoader is thinking...`;
  chatBox.appendChild(bubble);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function hideTyping() {
  const el = document.getElementById("typing-indicator");
  if (el) el.remove();
}

function getContext() {
  let jwt = localStorage.getItem("rl_jwt") || "";
  let domainId = localStorage.getItem("rl_domainId") || "";
  let domain = localStorage.getItem("rl_domain") || "";

  // --- Auto-inject from RL Console if not already set manually ---
  try {
    // JWT from cookie "urauth"
    if (!jwt) {
      const cookies = document.cookie.split(";").map(c => c.trim());
      const urauthCookie = cookies.find(c => c.startsWith("urauth="));
      if (urauthCookie) {
        jwt = urauthCookie.split("=")[1];
        localStorage.setItem("rl_jwt", jwt); // cache for chat use
      }
    }

    // Domain + domainId from localStorage "rl-selected-dr"
    if (!domainId || !domain) {
      const rlSelected = window.localStorage.getItem("rl-selected-dr");
      if (rlSelected) {
        const parsed = JSON.parse(rlSelected);
        domain = domain || parsed.host || "";
        domainId = domainId || parsed.id || "";
        if (domain) localStorage.setItem("rl_domain", domain);
        if (domainId) localStorage.setItem("rl_domainId", domainId);
      }
    }
  } catch (e) {
    console.warn("Auto-inject failed:", e);
  }

  return { jwt, domainId, domain };
}

// --- Command handler ---
function handleCommand(message) {
  if (message.toLowerCase().startsWith("jwt ")) {
    const jwt = message.slice(4).trim();
    localStorage.setItem("rl_jwt", jwt);
    appendMessage("✅ JWT saved.", "bot");
    return true;
  }
  if (message.toLowerCase().startsWith("domain_id ")) {
    const domainId = message.slice(10).trim();
    localStorage.setItem("rl_domainId", domainId);
    appendMessage("✅ Domain ID saved.", "bot");
    return true;
  }
  if (message.toLowerCase().startsWith("domain ")) {
    const domain = message.slice(7).trim();
    localStorage.setItem("rl_domain", domain);
    appendMessage("✅ Domain saved.", "bot");
    return true;
  }
  return false;
}

// --- Main send ---
async function sendMessage() {
  const message = input.value.trim();
  if (!message) return;

  appendMessage(message, "user");
  input.value = "";

  // ⛔ Important: intercept JWT/domain commands here
  if (handleCommand(message)) return;  // stops before sending to server

  try {
    const { jwt, domainId, domain } = getContext();

    showTyping();
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
      },
      body: JSON.stringify({
        sessionId,
        userMsg: message,
        ctx: { jwt, domainId, domain }
      })
    });
    hideTyping();

    const data = await res.json();

    if (data.answer) {
      appendMessage(data.answer, "bot");
    } else if (data.error) {
      appendMessage(`⚠️ Error: ${data.error}`, "bot");
    } else {
      appendMessage("⚠️ No response from server.", "bot");
    }
  } catch (err) {
    hideTyping(); // Make sure to hide typing indicator on error too
    appendMessage(`⚠️ Network error: ${err.message}`, "bot");
  }
}

// --- Event listeners ---
sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

// Suggestion button functionality
document.getElementById("suggestions").addEventListener("click", (e) => {
  if (e.target.tagName === "BUTTON") {
    input.value = e.target.innerText;
    sendMessage();
  }
});

// Auto-greet after context loads
window.addEventListener("load", () => {
  const { jwt, domainId, domain } = getContext();
  if (jwt && domainId && domain) {
    appendMessage(`Welcome back! Connected to RabbitLoader for ${domain}.`, "bot");
  } else {
    appendMessage("Welcome! Please log in or enter your RabbitLoader details to continue.", "bot");
  }
});