// frontend/chat.js - Browser JavaScript for the chat interface

class ChatInterface {
    constructor() {
        this.sessionId = null;
        this.isLoading = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.addWelcomeMessage();
    }

    setupEventListeners() {
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-btn');
        const suggestions = document.querySelectorAll('#suggestions button');

        // Send button click
        sendBtn.addEventListener('click', () => this.sendMessage());

        // Enter key press
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !this.isLoading) {
                this.sendMessage();
            }
        });

        // Suggestion buttons
        suggestions.forEach(btn => {
            btn.addEventListener('click', () => {
                const message = btn.textContent;
                chatInput.value = message;
                this.sendMessage();
            });
        });
    }

    addWelcomeMessage() {
        const welcomeMessage = "Hello! I'm Rabbit AI, your RabbitLoader assistant. How can I help you today?";
        this.addMessage('assistant', welcomeMessage);
    }

        // inside ChatInterface
    // inside ChatInterface
async sendMessage() {
    const chatInput = document.getElementById('chat-input');
    const userInput = chatInput.value.trim();
    if (!userInput) return;

    this.addMessage("user", userInput);
    this.setLoading(true);

    try {
        const res = await fetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        sessionId: this.sessionId || Date.now().toString(),
        message: userInput,
        ctx: {}
    })
});


        if (!res.ok) throw new Error("Chat API failed");
        const data = await res.json();

        if (data.ok) {
            this.addMessage("assistant", data.answer || "(no answer)");
            if (data.sources) {
                this.addSources(data.sources);
            }
        } else {
            this.addMessage("assistant", `⚠️ ${data.error}`);
        }
    } catch (err) {
        console.error("Error sending message:", err);
        this.addMessage("assistant", "⚠️ Error: Could not send message.");
    }

    this.setLoading(false);
    chatInput.value = "";
}

    addMessage(role, text) {
        const chatBox = document.getElementById('chat-box');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        if (role === 'assistant') {
            messageDiv.innerHTML = `
                <div class="message-avatar">
                    <img src="assets/favicon.svg" alt="AI" class="avatar">
                </div>
                <div class="message-content">${this.formatMessage(text)}</div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="message-content">${this.formatMessage(text)}</div>
                <div class="message-avatar">
                    <div class="user-avatar">You</div>
                </div>
            `;
        }
        
        chatBox.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addSources(sources) {
        const chatBox = document.getElementById('chat-box');
        const sourcesDiv = document.createElement('div');
        sourcesDiv.className = 'message-sources';
        
        let sourcesHtml = '<div class="sources-title">Sources:</div>';
        sources.forEach((source, index) => {
            if (source.url) {
                sourcesHtml += `
                    <a href="${source.url}" target="_blank" class="source-link">
                        ${source.title} (${source.score}% match)
                    </a>
                `;
            } else {
                sourcesHtml += `
                    <span class="source-item">
                        ${source.title} (${source.score}% match)
                    </span>
                `;
            }
        });
        
        sourcesDiv.innerHTML = sourcesHtml;
        chatBox.appendChild(sourcesDiv);
        this.scrollToBottom();
    }

    formatMessage(text) {
        // Basic HTML escaping and line break handling
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
    }

    setLoading(loading) {
        this.isLoading = loading;
        const sendBtn = document.getElementById('send-btn');
        const chatInput = document.getElementById('chat-input');
        
        sendBtn.disabled = loading;
        chatInput.disabled = loading;
        
        if (loading) {
            sendBtn.textContent = 'Sending...';
            this.addTypingIndicator();
        } else {
            sendBtn.textContent = 'Send';
            this.removeTypingIndicator();
        }
    }

    addTypingIndicator() {
        const chatBox = document.getElementById('chat-box');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message assistant typing-indicator';
        typingDiv.id = 'typing-indicator';
        typingDiv.innerHTML = `
            <div class="message-avatar">
                <img src="assets/favicon.svg" alt="AI" class="avatar">
            </div>
            <div class="message-content">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        chatBox.appendChild(typingDiv);
        this.scrollToBottom();
    }

    removeTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    hideSuggestions() {
        const suggestions = document.getElementById('suggestions');
        suggestions.style.display = 'none';
    }

    scrollToBottom() {
        const chatBox = document.getElementById('chat-box');
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

// Initialize chat when page loads
document.addEventListener('DOMContentLoaded', () => {
    new ChatInterface();
});