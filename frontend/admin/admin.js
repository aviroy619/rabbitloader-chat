// Admin Dashboard JavaScript
class ChatAdmin {
    constructor() {
        this.currentSessionId = null;
        this.currentEditData = null;
        this.sessions = [];
        this.currentSkip = 0;
        this.hasMoreSessions = true;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadStats();
        await this.loadSessions();
    }

    setupEventListeners() {
        // Session management
        document.getElementById('refreshSessions').addEventListener('click', () => this.refreshSessions());
        document.getElementById('loadMoreSessions').addEventListener('click', () => this.loadMoreSessions());
        document.getElementById('domainFilter').addEventListener('change', (e) => this.filterByDomain(e.target.value));
        
        // Session actions
        document.getElementById('exportSession').addEventListener('click', () => this.exportSession());
        document.getElementById('deleteSession').addEventListener('click', () => this.deleteSession());
        
        // Edit modal
        document.getElementById('closeEditModal').addEventListener('click', () => this.closeEditModal());
        document.getElementById('cancelEdit').addEventListener('click', () => this.closeEditModal());
        document.getElementById('saveEdit').addEventListener('click', () => this.saveEdit());
        
        // Close modal on overlay click
        document.getElementById('editModal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                this.closeEditModal();
            }
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeEditModal();
            }
        });
    }

    async loadStats() {
        try {
            const response = await fetch('/admin/stats');
            const data = await response.json();
            
            if (data.ok && data.stats) {
                document.getElementById('totalSessions').textContent = data.stats.totalSessions || 0;
                document.getElementById('recentActivity').textContent = data.stats.recentActivity || 0;
                document.getElementById('totalMessages').textContent = data.stats.totalMessages || 0;
                document.getElementById('uniqueUsers').textContent = data.stats.uniqueUsers || 0;
                document.getElementById('avgMessages').textContent = data.stats.avgMessagesPerSession || 0;
            }
        } catch (error) {
            console.error('Error loading stats:', error);
            this.showToast('Failed to load statistics', 'error');
        }
    }

    async loadSessions(reset = false) {
        if (reset) {
            this.currentSkip = 0;
            this.sessions = [];
            this.hasMoreSessions = true;
        }

        if (!this.hasMoreSessions) return;

        try {
            this.showLoading('sessionsList');
            
            const domainId = document.getElementById('domainFilter').value;
            let url = `/admin/sessions?limit=20&skip=${this.currentSkip}`;
            if (domainId) {
                url += `&domainId=${encodeURIComponent(domainId)}`;
            }
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.ok && data.sessions) {
                if (reset) {
                    this.sessions = data.sessions;
                } else {
                    this.sessions.push(...data.sessions);
                }
                
                this.hasMoreSessions = data.hasMore;
                this.currentSkip += data.sessions.length;
                this.renderSessions();
                
                // Show/hide load more button
                const loadMoreBtn = document.getElementById('loadMoreSessions');
                loadMoreBtn.style.display = this.hasMoreSessions ? 'block' : 'none';
            } else {
                throw new Error(data.error || 'Failed to load sessions');
            }
        } catch (error) {
            console.error('Error loading sessions:', error);
            this.showToast('Failed to load sessions', 'error');
            document.getElementById('sessionsList').innerHTML = '<div class="loading">Error loading sessions</div>';
        }
    }

    renderSessions() {
        const container = document.getElementById('sessionsList');
        container.innerHTML = '';
        
        if (this.sessions.length === 0) {
            container.innerHTML = '<div class="loading">No sessions found</div>';
            return;
        }
        
        this.sessions.forEach(session => {
            const sessionEl = document.createElement('div');
            sessionEl.className = 'session-item';
            sessionEl.dataset.sessionId = session.sessionId;
            
            const date = new Date(session.updatedAt).toLocaleDateString();
            const time = new Date(session.updatedAt).toLocaleTimeString();
            
            sessionEl.innerHTML = `
                <div class="session-preview">${this.truncateText(session.lastMsg, 100)}</div>
                <div class="session-meta">
                    <span>${session.messageCount || 0} msgs</span>
                    <span>${date} ${time}</span>
                </div>
            `;
            
            sessionEl.addEventListener('click', () => this.selectSession(session.sessionId));
            container.appendChild(sessionEl);
        });
    }

    async selectSession(sessionId) {
        this.currentSessionId = sessionId;
        
        // Update UI selection
        document.querySelectorAll('.session-item').forEach(el => {
            el.classList.toggle('active', el.dataset.sessionId === sessionId);
        });
        
        // Hide welcome screen, show session detail
        document.getElementById('welcomeScreen').style.display = 'none';
        document.getElementById('sessionDetail').style.display = 'flex';
        
        try {
            this.showLoading('messagesContainer');
            
            const response = await fetch(`/admin/session/${sessionId}`);
            const data = await response.json();
            
            if (data.ok) {
                this.renderSessionDetail(data);
            } else {
                throw new Error(data.error || 'Failed to load session');
            }
        } catch (error) {
            console.error('Error loading session detail:', error);
            this.showToast('Failed to load session details', 'error');
            document.getElementById('messagesContainer').innerHTML = '<div class="loading">Error loading session</div>';
        }
    }

    renderSessionDetail(sessionData) {
        // Update header info
        document.getElementById('sessionTitle').textContent = `Session ${sessionData.sessionId.substring(0, 8)}...`;
        document.getElementById('userName').textContent = sessionData.profile.name;
        document.getElementById('userEmail').textContent = sessionData.profile.email;
        document.getElementById('sessionDate').textContent = new Date(sessionData.createdAt).toLocaleString();
        document.getElementById('messageCount').textContent = `${sessionData.messageCount || 0} messages`;
        
        // Render messages
        const container = document.getElementById('messagesContainer');
        container.innerHTML = '';
        
        if (!sessionData.messages || sessionData.messages.length === 0) {
            container.innerHTML = '<div class="loading">No messages in this session</div>';
            return;
        }
        
        sessionData.messages.forEach((message, index) => {
            const messageEl = document.createElement('div');
            messageEl.className = `message-item ${message.role}`;
            
            const timestamp = new Date(message.timestamp || message.ts).toLocaleString();
            const isEdited = message.edited;
            const source = message.source || 'unknown';
            
            messageEl.innerHTML = `
                <div class="message-header">
                    <span class="message-role ${message.role}">
                        ${message.role === 'user' ? 'User' : 'Assistant'}
                        ${isEdited ? '<span class="edited-badge">Edited</span>' : ''}
                    </span>
                    <span class="message-timestamp">${timestamp}</span>
                </div>
                <div class="message-content">${this.escapeHtml(message.text)}</div>
                ${message.role === 'assistant' ? `
                    <div class="message-actions">
                        <button class="btn btn-small btn-secondary edit-btn" 
                                data-question="${this.escapeHtml(this.getPreviousUserMessage(sessionData.messages, index))}"
                                data-answer="${this.escapeHtml(message.text)}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                    </div>
                    <div class="message-source">Source: ${source}</div>
                ` : ''}
            `;
            
            container.appendChild(messageEl);
        });
        
        // Attach edit event listeners
        container.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const question = e.target.getAttribute('data-question');
                const answer = e.target.getAttribute('data-answer');
                this.openEditModal(question, answer);
            });
        });
        
        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    getPreviousUserMessage(messages, currentIndex) {
        for (let i = currentIndex - 1; i >= 0; i--) {
            if (messages[i].role === 'user') {
                return messages[i].text;
            }
        }
        return 'Unknown question';
    }

    openEditModal(question, currentAnswer) {
        this.currentEditData = { question, currentAnswer };
        
        document.getElementById('originalQuestion').textContent = question;
        document.getElementById('newAnswer').value = currentAnswer;
        document.getElementById('editModal').style.display = 'flex';
        
        // Focus on textarea
        setTimeout(() => {
            document.getElementById('newAnswer').focus();
        }, 100);
    }

    closeEditModal() {
        document.getElementById('editModal').style.display = 'none';
        this.currentEditData = null;
    }

    async saveEdit() {
        if (!this.currentEditData || !this.currentSessionId) return;
        
        const newAnswer = document.getElementById('newAnswer').value.trim();
        const editor = document.getElementById('editorName').value.trim();
        
        if (!newAnswer) {
            this.showToast('Please enter a new answer', 'error');
            return;
        }
        
        if (!editor) {
            this.showToast('Please enter editor name', 'error');
            return;
        }
        
        try {
            this.showLoadingOverlay();
            
            const response = await fetch('/admin/edit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.currentSessionId,
                    question: this.currentEditData.question,
                    newAnswer: newAnswer,
                    editor: editor
                })
            });
            
            const data = await response.json();
            
            if (data.ok) {
                this.showToast('Answer updated successfully', 'success');
                this.closeEditModal();
                // Reload the session to show updated content
                await this.selectSession(this.currentSessionId);
            } else {
                throw new Error(data.error || 'Failed to update answer');
            }
        } catch (error) {
            console.error('Error saving edit:', error);
            this.showToast('Failed to save changes', 'error');
        } finally {
            this.hideLoadingOverlay();
        }
    }

    async refreshSessions() {
        await this.loadSessions(true);
        this.showToast('Sessions refreshed', 'info');
    }

    async loadMoreSessions() {
        await this.loadSessions(false);
    }

    async filterByDomain(domainId) {
        this.currentSkip = 0;
        await this.loadSessions(true);
    }

    async exportSession() {
        if (!this.currentSessionId) return;
        
        try {
            const response = await fetch(`/admin/session/${this.currentSessionId}`);
            const data = await response.json();
            
            if (data.ok) {
                const exportData = {
                    sessionId: data.sessionId,
                    userId: data.userId,
                    profile: data.profile,
                    messages: data.messages,
                    exportedAt: new Date().toISOString()
                };
                
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `session-${this.currentSessionId.substring(0, 8)}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                this.showToast('Session exported successfully', 'success');
            }
        } catch (error) {
            console.error('Error exporting session:', error);
            this.showToast('Failed to export session', 'error');
        }
    }

    async deleteSession() {
        if (!this.currentSessionId) return;
        
        if (!confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
            return;
        }
        
        try {
            this.showLoadingOverlay();
            
            const response = await fetch(`/admin/session/${this.currentSessionId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.ok) {
                this.showToast('Session deleted successfully', 'success');
                
                // Remove from sessions list and refresh
                this.sessions = this.sessions.filter(s => s.sessionId !== this.currentSessionId);
                this.renderSessions();
                
                // Show welcome screen
                document.getElementById('sessionDetail').style.display = 'none';
                document.getElementById('welcomeScreen').style.display = 'flex';
                
                this.currentSessionId = null;
                await this.loadStats(); // Refresh stats
            } else {
                throw new Error(data.error || 'Failed to delete session');
            }
        } catch (error) {
            console.error('Error deleting session:', error);
            this.showToast('Failed to delete session', 'error');
        } finally {
            this.hideLoadingOverlay();
        }
    }

    // Utility methods
    showLoading(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    }

    showLoadingOverlay() {
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    hideLoadingOverlay() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? 'fa-check-circle' : 
                    type === 'error' ? 'fa-exclamation-circle' : 
                    'fa-info-circle';
        
        toast.innerHTML = `
            <i class="fas ${icon}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
        
        // Click to dismiss
        toast.addEventListener('click', () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
    }

    truncateText(text, maxLength) {
        if (!text) return 'No message';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the admin dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChatAdmin();
});