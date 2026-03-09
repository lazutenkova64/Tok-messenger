// ========== UI КОМПОНЕНТЫ ==========
let currentTab = 'chats';
let statusUpdateInterval;
let activeMessageId = null;
let selectedAvatar = null;

const emojiList = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', 
    '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳',
    '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤',
    '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫'
];

const weirdEmojis = [
    '👾', '🤖', '👽', '💀', '👻', '👹', '👺', '🤡', '💩', '🔥',
    '🌀', '🌚', '🌝', '⭐', '🌟', '💫', '✨', '⚡', '☄️', '💥',
    '🕳️', '👁️', '🧠', '👅', '👄', '🦷', '🦴', '👀', '👃', '👂'
];

const themes = [
    { id: 'classic-dark', name: 'Классический темный', class: 'classic-dark' },
    { id: 'neon-city', name: 'Неоновый город', class: 'neon-city' },
    { id: 'cyberpunk', name: 'Киберпанк', class: 'cyberpunk' },
    { id: 'ice-cave', name: 'Ледяная пещера', class: 'ice-cave' },
    { id: 'volcanic', name: 'Вулканическая', class: 'volcanic' },
    { id: 'mint-fresh', name: 'Мятная свежесть', class: 'mint-fresh' },
    { id: 'purple-haze', name: 'Фиолетовый туман', class: 'purple-haze' },
    { id: 'golden-age', name: 'Золотой век', class: 'golden-age' },
    { id: 'cosmic-abyss', name: 'Космическая бездна', class: 'cosmic-abyss' },
    { id: 'ocean-deep', name: 'Морская глубина', class: 'ocean-deep' }
];

function startStatusUpdates() {
    if (statusUpdateInterval) clearInterval(statusUpdateInterval);
    statusUpdateInterval = setInterval(() => {
        if (currentTab === 'users' || currentTab === 'chats') {
            updateChatsList();
        }
        updateChatStatus();
    }, 2000);
}

function updateChatsList() {
    const list = document.getElementById('chatsList');
    if (!list) return;
    
    let items = [];
    
    if (currentTab === 'chats') {
        items = [...myChats].sort((a, b) => {
            const aIsSaved = a.type === 'private' && a.pair_key === `${window.currentUser.id}_${window.currentUser.id}`;
            const bIsSaved = b.type === 'private' && b.pair_key === `${window.currentUser.id}_${window.currentUser.id}`;
            if (aIsSaved && !bIsSaved) return -1;
            if (!aIsSaved && bIsSaved) return 1;
            
            const aPinned = isChatPinned(a.id);
            const bPinned = isChatPinned(b.id);
            
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            
            return new Date(b.created_at) - new Date(a.created_at);
        });
    } else if (currentTab === 'public') {
        items = [...publicChats].sort((a, b) => {
            return new Date(b.created_at) - new Date(a.created_at);
        });
    } else if (currentTab === 'users') {
        const allUsersList = window.allUsers.map(user => {
            const onlineUser = onlineUsers[user.id];
            const isCurrentUser = user.id === window.currentUser.id;
            
            if (isCurrentUser) return null;
            
            return {
                id: user.id,
                name: user.username,
                avatar: user.avatar || '👤',
                bio: user.bio || '',
                online: onlineUser ? onlineUser.online : false,
                isAdmin: user.username === ADMIN_USERNAME,
                dnd: onlineUser ? onlineUser.dnd : (user.dnd || false),
                lastSeen: onlineUser ? onlineUser.lastSeen : (user.last_seen ? new Date(user.last_seen).getTime() : null)
            };
        }).filter(Boolean);
        
        items = allUsersList;
    }
    
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    if (searchTerm) {
        items = items.filter(item => 
            (item.name || '').toLowerCase().includes(searchTerm) ||
            (item.description || '').toLowerCase().includes(searchTerm) ||
            (item.bio || '').toLowerCase().includes(searchTerm)
        );
    }
    
    let newHTML = '';
    
    if (items.length === 0) {
        newHTML = '<div class="empty-state">Ничего не найдено</div>';
    } else {
        const fragment = [];
        
        items.forEach(item => {
            if (currentTab === 'users') {
                fragment.push(renderUserItem(item));
            } else {
                fragment.push(renderChatItem(item));
            }
        });
        
        newHTML = fragment.join('');
    }
    
    list.innerHTML = newHTML;
}

function renderUserItem(user) {
    const statusClass = user.online ? (user.dnd ? 'dnd' : 'online') : 'offline';
    const lastSeenText = !user.online && user.lastSeen ? formatLastSeen(user.lastSeen) : '';
    
    return `
        <div class="chat-item" onclick="createPrivateChat({id: '${user.id}', name: '${user.name}', avatar: '${user.avatar}'})">
            <div class="chat-avatar">${user.avatar}</div>
            <div class="chat-details">
                <div class="chat-name">
                    ${user.name}
                    ${user.isAdmin ? '<span class="creator-badge">Создатель</span>' : ''}
                    <div class="status-container">
                        <span class="status-dot ${statusClass}"></span>
                        ${!user.online && lastSeenText ? `<span class="last-seen">${lastSeenText}</span>` : ''}
                        ${user.dnd && user.online ? '<span class="dnd-badge">Не беспокоить</span>' : ''}
                    </div>
                </div>
                <div class="chat-last-message">${user.bio || 'Нет информации'}</div>
            </div>
        </div>
    `;
}

function renderChatItem(chat) {
    const lastMsg = messages[chat.id] && messages[chat.id].length > 0 ? messages[chat.id][messages[chat.id].length - 1] : null;
    const unread = unreadCounts[chat.id] || 0;
    const isPinned = isChatPinned(chat.id);
    
    let lastMessageText = 'Нет сообщений';
    if (lastMsg) {
        lastMessageText = lastMsg.text ? lastMsg.text : (lastMsg.audio ? '🎤 Голосовое' : '📷 Медиа');
    }
    
    const timeText = lastMsg ? lastMsg.time : '';
    
    let displayName = chat.name;
    let avatar = chat.avatar || '👥';
    
    if (chat.type === 'private' && window.currentUser) {
        if (chat.pair_key === `${window.currentUser.id}_${window.currentUser.id}`) {
            displayName = 'Избранное';
            avatar = '⭐';
        } else {
            const otherId = chat.pair_key.split('_').find(id => id !== window.currentUser.id);
            const otherUser = window.allUsers.find(u => u.id === otherId);
            if (otherUser) {
                displayName = otherUser.username;
                avatar = otherUser.avatar || '👤';
            } else {
                displayName = 'Пользователь';
            }
        }
    }
    
    return `
        <div class="chat-item ${currentChat?.id === chat.id ? 'active' : ''}" onclick="joinChat(${JSON.stringify(chat).replace(/"/g, '&quot;')})">
            <div class="chat-avatar">${avatar}</div>
            <div class="chat-details">
                <div class="chat-name">
                    ${displayName}
                    ${isPinned ? '<span class="pin-icon">📌</span>' : ''}
                    ${chat.is_public ? '<span class="lock-icon">🌐</span>' : '<span class="lock-icon">🔒</span>'}
                    ${window.currentUser?.isAdmin && window.currentUser.name === ADMIN_USERNAME && currentTab === 'public' ? 
                        `<button class="delete-chat-btn" onclick="deleteChat('${chat.id}', event)">Удалить</button>` : ''}
                    <button class="pin-chat-btn ${isPinned ? 'pinned' : ''}" onclick="togglePinChat('${chat.id}', event)">📌</button>
                </div>
                <div class="chat-last-message">${lastMessageText}</div>
            </div>
            <div class="chat-meta">
                <div class="chat-time">${timeText}</div>
                ${unread > 0 ? `<div class="chat-unread">${unread}</div>` : ''}
            </div>
        </div>
    `;
}

function renderMessages() {
    const container = document.getElementById('messagesContainer');
    if (!container) return;
    
    const oldScrollHeight = container.scrollHeight;
    const oldScrollTop = container.scrollTop;
    const isAtBottom = oldScrollHeight - oldScrollTop - container.clientHeight < 50;
    
    let newMessages = '';
    
    if (!currentChat) {
        newMessages = '<div class="empty-state">👈 Выберите чат</div>';
    } else if (!messages[currentChat.id] || messages[currentChat.id].length === 0) {
        newMessages = '<div class="empty-state">Нет сообщений</div>';
    } else {
        messages[currentChat.id].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        
        const fragment = [];
        
        messages[currentChat.id].forEach(msg => {
            if (deletedMessages[currentChat.id] && deletedMessages[currentChat.id].includes(msg.id)) {
                return;
            }
            
            const status = messageStatuses[msg.id] || { status: msg.sender == window.currentUser.id ? 'sent' : 'delivered' };
            
            let content = '';
            let statusHtml = '';
            
            if (msg.type === 'out') {
                statusHtml = `<span class="message-status"><span class="status-icon ${status.status}">${status.status === 'read' ? '✓✓' : '✓'}</span></span>`;
            }
            
            if (msg.text) {
                content = `<div class="message-bubble">${escapeHtml(msg.text)}${msg.edited ? ' <span style="font-size: 10px; opacity: 0.7;">(ред.)</span>' : ''}</div>`;
            } else if (msg.audio) {
                const messageId = msg.id;
                const duration = msg.duration || 0;
                
                content = `
                    <div class="message-bubble audio-message">
                        <div class="audio-player">
                            <button class="play-pause-btn" data-message-id="${messageId}" onclick="toggleAudio('${messageId}', '${msg.audio}')">▶️</button>
                            <div class="audio-progress-container">
                                <div class="audio-progress-bar" onclick="seekAudio('${messageId}', event)">
                                    <div class="audio-progress-fill" data-message-id="${messageId}" style="width: 0%"></div>
                                </div>
                                <div class="audio-time-container">
                                    <span class="audio-current-time" data-message-id="${messageId}">0:00</span>
                                    <span class="audio-duration" data-message-id="${messageId}">${formatTime(duration)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            const canDelete = window.currentUser.isAdmin || msg.sender == window.currentUser.id;
            const canEdit = msg.sender == window.currentUser.id;
            
            let actions = '';
            if (canDelete || canEdit) {
                actions = `
                    <div class="message-actions" data-message-id="${msg.id}">
                        ${canEdit ? `<button class="message-action-btn" onclick="editMessage('${msg.id}', event)">✏️</button>` : ''}
                        ${canDelete ? `<button class="message-action-btn delete" onclick="deleteMessage('${msg.id}', event)">🗑️</button>` : ''}
                    </div>
                `;
            }
            
            fragment.push(`
                <div class="message ${msg.type}" data-id="${msg.id}" onclick="showMessageActions('${msg.id}', event)">
                    ${actions}
                    ${msg.type === 'in' ? `<div class="message-sender">${escapeHtml(msg.senderName)}</div>` : ''}
                    ${content}
                    <div class="message-footer">
                        <span class="message-time">${msg.time}</span>
                        ${statusHtml}
                    </div>
                </div>
            `);
        });
        
        newMessages = fragment.join('');
    }
    
    container.innerHTML = newMessages;
    
    if (isAtBottom) {
        container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
        });
    }
    
    markMessagesAsRead(currentChat?.id);
    updateUnreadCounts();
}

function updateProfileUI() {
    if (!window.currentUser) return;
    
    const nameSpan = document.getElementById('profileName');
    nameSpan.innerHTML = '';
    
    const nameText = document.createTextNode(window.currentUser.name + ' ');
    nameSpan.appendChild(nameText);
    
    if (window.currentUser.isAdmin) {
        const badge = document.createElement('span');
        badge.className = 'creator-badge';
        badge.textContent = 'Создатель';
        nameSpan.appendChild(badge);
    }
    
    const statusDisplay = document.getElementById('profileStatusDisplay');
    if (window.currentUser.dnd) {
        statusDisplay.innerHTML = '<span class="dnd-indicator"></span> Не беспокоить';
    } else {
        statusDisplay.innerHTML = '<span class="online-indicator"></span> в сети';
    }
    
    document.getElementById('profileAvatar').textContent = window.currentUser.avatar || '👤';
    document.getElementById('profileAvatarLarge').textContent = window.currentUser.avatar || '👤';
    document.getElementById('profileBioInput').value = window.currentUser.bio || '';
    document.getElementById('profileDNDCheckbox').checked = window.currentUser.dnd || false;
}

function switchTab(tab) {
    currentTab = tab;
    document.getElementById('tabChats').className = tab === 'chats' ? 'tab active' : 'tab';
    document.getElementById('tabPublic').className = tab === 'public' ? 'tab active' : 'tab';
    document.getElementById('tabUsers').className = tab === 'users' ? 'tab active' : 'tab';
    document.getElementById('searchInput').value = '';
    
    if (tab === 'users') {
        loadAllUsers();
    }
    
    updateChatsList();
    updateCreateChatButtonVisibility();
}

function updateCreateChatButtonVisibility() {
    const createBtn = document.getElementById('createChatBtn');
    if (createBtn) {
        createBtn.style.display = currentTab === 'public' ? 'flex' : 'none';
    }
}

function handleSearch() {
    updateChatsList();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('active');
}

function updateBackButtonVisibility() {
    const backButton = document.getElementById('backButton');
    if (window.innerWidth <= 768) {
        backButton.classList.add('mobile-visible');
    } else {
        backButton.classList.remove('mobile-visible');
    }
}

function forceShowInput() {
    const inputContainer = document.getElementById('messageInputContainer');
    const emojiBtn = document.querySelector('.emoji-toggle-btn');
    const micBtn = document.getElementById('micBtn');
    const sendBtn = document.getElementById('sendBtn');
    
    if (inputContainer) {
        inputContainer.style.display = 'flex';
        inputContainer.style.visibility = 'visible';
        inputContainer.style.opacity = '1';
    }
    
    if (emojiBtn) {
        emojiBtn.style.display = 'flex';
        emojiBtn.style.visibility = 'visible';
        emojiBtn.style.opacity = '1';
    }
    
    if (micBtn) {
        micBtn.style.display = 'flex';
        micBtn.style.visibility = 'visible';
        micBtn.style.opacity = '1';
    }
    
    if (sendBtn) {
        sendBtn.style.display = 'flex';
        sendBtn.style.visibility = 'visible';
        sendBtn.style.opacity = '1';
    }
}

function toggleEmojiPicker() {
    const picker = document.getElementById('emojiPicker');
    picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
}

function populateEmojiPicker() {
    const picker = document.getElementById('emojiPicker');
    picker.innerHTML = '';
    emojiList.forEach(emoji => {
        const btn = document.createElement('button');
        btn.className = 'emoji-btn';
        btn.textContent = emoji;
        btn.onclick = () => addEmoji(emoji);
        picker.appendChild(btn);
    });
}

function addEmoji(emoji) {
    const input = document.getElementById('messageInput');
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.value = input.value.substring(0, start) + emoji + input.value.substring(end);
    input.focus();
    input.selectionStart = input.selectionEnd = start + emoji.length;
    input.style.height = 'auto';
    input.style.height = input.scrollHeight + 'px';
}

function handleKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

function handleTextInput() {}

function scrollToBottomOnMobile() {
    setTimeout(() => {
        const container = document.getElementById('messagesContainer');
        if (container) {
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, 300);
}

function handleMessagesContainerClick(event) {
    if (activeMessageId) {
        const activeMessage = document.querySelector(`.message[data-id="${activeMessageId}"]`);
        if (activeMessage && !activeMessage.contains(event.target)) {
            hideMessageActions();
        }
    }
}

function showMessageActions(messageId, event) {
    event.stopPropagation();
    
    if (activeMessageId) {
        const prevActive = document.querySelector(`.message-actions[data-message-id="${activeMessageId}"]`);
        if (prevActive) {
            prevActive.classList.remove('visible');
        }
    }
    
    const actions = document.querySelector(`.message-actions[data-message-id="${messageId}"]`);
    if (actions) {
        actions.classList.add('visible');
        activeMessageId = messageId;
        
        setTimeout(() => {
            if (activeMessageId === messageId) {
                hideMessageActions();
            }
        }, 5000);
    }
}

function hideMessageActions() {
    if (activeMessageId) {
        const actions = document.querySelector(`.message-actions[data-message-id="${activeMessageId}"]`);
        if (actions) {
            actions.classList.remove('visible');
        }
        activeMessageId = null;
    }
}

function openCreateChatModal() {
    document.getElementById('createChatModal').classList.add('active');
}

function closeCreateChatModal() {
    document.getElementById('createChatModal').classList.remove('active');
    document.getElementById('chatNameInput').value = '';
}

function closeEditMessageModal() {
    document.getElementById('editMessageModal').classList.remove('active');
    document.getElementById('editMessageText').value = '';
    window.messageToEdit = null;
}

function openProfileModal() {
    document.getElementById('profileNameInput').value = window.currentUser.name;
    document.getElementById('profileBioInput').value = window.currentUser.bio || '';
    document.getElementById('profileDNDCheckbox').checked = window.currentUser.dnd || false;
    document.getElementById('profileAvatarLarge').textContent = window.currentUser.avatar || '👤';
    
    populateThemeGrid();
    
    document.getElementById('profileModal').classList.add('active');
}

function closeProfileModal() {
    document.getElementById('profileModal').classList.remove('active');
}

async function saveProfile() {
    const newName = document.getElementById('profileNameInput').value.trim();
    const newBio = document.getElementById('profileBioInput').value.trim();
    const dnd = document.getElementById('profileDNDCheckbox').checked;
    
    if (newName && newName !== window.currentUser.name) {
        const { data: existingUsers } = await supabaseClient
            .from('profiles')
            .select('username')
            .eq('username', newName)
            .neq('id', window.currentUser.id)
            .limit(1);
        
        if (existingUsers && existingUsers.length > 0) {
            alert('Пользователь с таким именем уже существует');
            return;
        }
        
        window.currentUser.name = newName;
    }
    
    window.currentUser.bio = newBio;
    window.currentUser.dnd = dnd;
    
    try {
        await supabaseClient
            .from('profiles')
            .update({
                username: window.currentUser.name,
                bio: window.currentUser.bio,
                dnd: window.currentUser.dnd,
                avatar: window.currentUser.avatar
            })
            .eq('id', window.currentUser.id);
        
        localStorage.setItem('currentUser', JSON.stringify(window.currentUser));
        
        if (ably) {
            const presenceChannel = ably.channels.get('presence');
            if (presenceChannel.state === 'attached') {
                presenceChannel.presence.update({ 
                    name: window.currentUser.name, 
                    avatar: window.currentUser.avatar,
                    bio: window.currentUser.bio,
                    isAdmin: window.currentUser.isAdmin,
                    dnd: dnd,
                    lastSeen: Date.now()
                });
            }
        }
        
        updateProfileUI();
        closeProfileModal();
        
        await loadAllUsers();
        
    } catch (err) {
        console.error('Error updating profile:', err);
        alert('Ошибка при сохранении профиля');
    }
}

function openAvatarModal() {
    const grid = document.getElementById('avatarGrid');
    grid.innerHTML = '';
    weirdEmojis.forEach(emoji => {
        const div = document.createElement('div');
        div.className = 'avatar-option';
        div.textContent = emoji;
        div.onclick = () => selectAvatar(emoji, div);
        if (window.currentUser.avatar === emoji) div.classList.add('selected');
        grid.appendChild(div);
    });
    document.getElementById('avatarModal').classList.add('active');
}

function selectAvatar(emoji, element) {
    document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');
    selectedAvatar = emoji;
}

async function saveAvatar() {
    if (selectedAvatar) {
        window.currentUser.avatar = selectedAvatar;
        
        try {
            await supabaseClient
                .from('profiles')
                .update({ avatar: window.currentUser.avatar })
                .eq('id', window.currentUser.id);
            
            localStorage.setItem('currentUser', JSON.stringify(window.currentUser));
            updateProfileUI();
            
            if (ably) {
                const presenceChannel = ably.channels.get('presence');
                if (presenceChannel.state === 'attached') {
                    presenceChannel.presence.update({ 
                        name: window.currentUser.name, 
                        avatar: selectedAvatar,
                        bio: window.currentUser.bio,
                        isAdmin: window.currentUser.isAdmin,
                        dnd: window.currentUser.dnd,
                        lastSeen: Date.now()
                    });
                }
            }
        } catch (err) {
            console.error('Error saving avatar:', err);
            alert('Ошибка при сохранении аватара');
        }
    }
    closeAvatarModal();
}

function closeAvatarModal() {
    document.getElementById('avatarModal').classList.remove('active');
    selectedAvatar = null;
}

function openChatUserProfile() {
    if (!currentChat || currentChat.is_public) return;
    
    if (currentChat.pair_key === `${window.currentUser.id}_${window.currentUser.id}`) {
        openProfileModal();
        return;
    }
    
    const otherId = currentChat.pair_key.split('_').find(id => id !== window.currentUser.id);
    const user = window.allUsers.find(u => u.id === otherId);
    if (!user) return;
    
    const onlineUser = onlineUsers[user.id];
    const isOnline = onlineUser ? onlineUser.online : false;
    const dnd = onlineUser ? onlineUser.dnd : user.dnd;
    const lastSeen = onlineUser ? onlineUser.lastSeen : (user.last_seen ? new Date(user.last_seen).getTime() : null);
    
    let statusText = '';
    if (isOnline) {
        statusText = dnd ? 'Не беспокоит' : 'В сети';
    } else {
        statusText = lastSeen ? `Был(а) ${formatLastSeen(lastSeen)}` : 'Был(а) давно';
    }
    
    const content = `
        <div class="user-profile-avatar">${user.avatar || '👤'}</div>
        <div class="user-profile-name">${user.username}</div>
        <div class="user-profile-bio">${user.bio || 'Нет информации'}</div>
        <div class="user-profile-status">
            <span class="status-dot ${isOnline ? (dnd ? 'dnd' : 'online') : 'offline'}"></span>
            ${statusText}
        </div>
    `;
    
    document.getElementById('userProfileContent').innerHTML = content;
    document.getElementById('userProfileModal').classList.add('active');
}

function closeUserProfileModal() {
    document.getElementById('userProfileModal').classList.remove('active');
}

function updateUrlWithChat(chat) {
    if (chat) {
        const newUrl = `${window.location.pathname}#${chat.id}`;
        window.history.replaceState({ chatId: chat.id }, chat.name, newUrl);
        let title = chat.name;
        if (chat.type === 'private' && window.currentUser) {
            if (chat.pair_key === `${window.currentUser.id}_${window.currentUser.id}`) {
                title = 'Избранное';
            } else {
                const otherId = chat.pair_key.split('_').find(id => id !== window.currentUser.id);
                const otherUser = window.allUsers.find(u => u.id === otherId);
                title = otherUser ? otherUser.username : 'Приватный чат';
            }
        }
        document.title = `${title} - Telegram Web`;
    } else {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, 'Telegram Web', newUrl);
        document.title = 'Telegram Web';
    }
}

function checkUrlForChat() {
    const hash = window.location.hash.substring(1);
    if (hash) {
        const chat = myChats.find(c => c.id === hash) || publicChats.find(c => c.id === hash);
        if (chat) setTimeout(() => joinChat(chat), 500);
    }
}

function openMedia(url) {
    const viewer = document.getElementById('mediaViewer');
    const content = document.getElementById('mediaViewerContent');
    if (url.match(/\.(mp4|webm|ogg)$/i) || url.includes('video')) {
        content.innerHTML = `<video src="${url}" controls autoplay></video>`;
    } else {
        content.innerHTML = `<img src="${url}" style="max-width: 100%; max-height: 100%;">`;
    }
    viewer.classList.add('active');
}

function closeMediaViewer() {
    document.getElementById('mediaViewer').classList.remove('active');
    document.getElementById('mediaViewerContent').innerHTML = '';
}

function setupMobileHandlers() {
    const setVH = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);
    
    forceShowInput();
}

function applyTheme(themeId) {
    document.documentElement.setAttribute('data-theme', themeId);
    window.currentTheme = themeId;
    localStorage.setItem('theme', themeId);
}

function populateThemeGrid() {
    const grid = document.getElementById('themeGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    themes.forEach(theme => {
        const div = document.createElement('div');
        div.className = `theme-option ${window.currentTheme === theme.id ? 'selected' : ''}`;
        div.onclick = () => selectTheme(theme.id, div);
        
        const preview = document.createElement('div');
        preview.className = `theme-preview ${theme.class}`;
        
        const message1 = document.createElement('div');
        message1.className = 'preview-message';
        message1.style.width = '70%';
        message1.style.marginBottom = '4px';
        
        const message2 = document.createElement('div');
        message2.className = 'preview-message';
        message2.style.width = '40%';
        message2.style.alignSelf = 'flex-end';
        message2.style.marginLeft = 'auto';
        
        preview.appendChild(message1);
        preview.appendChild(message2);
        
        const name = document.createElement('span');
        name.className = 'theme-name';
        name.textContent = theme.name;
        
        div.appendChild(preview);
        div.appendChild(name);
        grid.appendChild(div);
    });
}

function selectTheme(themeId, element) {
    document.querySelectorAll('.theme-option').forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');
    applyTheme(themeId);
}
