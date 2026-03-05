// Ably клиент
let ably = null;
let ablyReconnectTimer = null;
let heartbeatInterval = null;
let presenceUpdateInterval = null;
let statusUpdateInterval = null;

// Состояние онлайн пользователей
let onlineUsers = {};

// Инициализация Ably
function initAbly() {
    if (!currentUser) return;
    
    if (ably) {
        try {
            ably.close();
        } catch (e) {}
    }
    
    ably = new Ably.Realtime({
        key: "pYHevw.VrFP9Q:8u3IGeMI56PtA4S6Z_VCVvvXpEXEmiIlfoAjfPb6BZg",
        clientId: currentUser.id.toString(),
        transports: ['web_socket'],
        disconnectedRetryTimeout: 1000,
        suspendedRetryTimeout: 2000,
        realtimeRequestTimeout: 15000,
        echoMessages: false,
        idleTimeout: 20000
    });

    ably.connection.on('connected', () => {
        console.log('Connected to Ably');
        
        if (ablyReconnectTimer) {
            clearTimeout(ablyReconnectTimer);
            ablyReconnectTimer = null;
        }
        
        const presenceChannel = ably.channels.get('presence');
        presenceChannel.presence.enter({ 
            name: currentUser.name, 
            avatar: currentUser.avatar || '👤',
            bio: currentUser.bio || '',
            isAdmin: currentUser.isAdmin || false,
            dnd: currentUser.dnd || false,
            lastSeen: Date.now()
        });
        
        presenceChannel.presence.subscribe('enter', (member) => {
            if (member.clientId !== currentUser.id.toString()) {
                onlineUsers[member.clientId] = {
                    id: member.clientId,
                    name: member.data.name,
                    avatar: member.data.avatar || '👤',
                    bio: member.data.bio || '',
                    online: true,
                    isAdmin: member.data.isAdmin || false,
                    dnd: member.data.dnd || false,
                    lastSeen: Date.now()
                };
                
                window.sendQueuedMessagesToUser?.(member.clientId);
                
                if (currentTab === 'users' || currentTab === 'chats') {
                    window.updateChatsList?.();
                }
                window.updateChatStatus?.();
            }
        });
        
        presenceChannel.presence.subscribe('update', (member) => {
            if (member.clientId !== currentUser.id.toString()) {
                onlineUsers[member.clientId] = {
                    ...onlineUsers[member.clientId],
                    name: member.data.name,
                    avatar: member.data.avatar,
                    bio: member.data.bio,
                    isAdmin: member.data.isAdmin,
                    online: true,
                    dnd: member.data.dnd,
                    lastSeen: Date.now()
                };
                if (currentTab === 'users' || currentTab === 'chats') {
                    window.updateChatsList?.();
                }
                window.updateChatStatus?.();
            }
        });
        
        presenceChannel.presence.subscribe('leave', (member) => {
            if (onlineUsers[member.clientId]) {
                onlineUsers[member.clientId].online = false;
                onlineUsers[member.clientId].lastSeen = Date.now();
                if (currentTab === 'users' || currentTab === 'chats') {
                    window.updateChatsList?.();
                }
                window.updateChatStatus?.();
            }
        });
        
        presenceChannel.presence.get((err, members) => {
            if (members) {
                members.forEach(member => {
                    if (member.clientId !== currentUser.id.toString()) {
                        onlineUsers[member.clientId] = {
                            id: member.clientId,
                            name: member.data.name,
                            avatar: member.data.avatar || '👤',
                            bio: member.data.bio || '',
                            online: true,
                            isAdmin: member.data.isAdmin || false,
                            dnd: member.data.dnd || false,
                            lastSeen: Date.now()
                        };
                    }
                });
            }
            if (currentTab === 'users' || currentTab === 'chats') {
                window.updateChatsList?.();
            }
        });

        const globalChatsChannel = ably.channels.get('global-chats');
        globalChatsChannel.subscribe('new-chat', (message) => {
            const newChat = message.data;
            if (!publicChats?.find(c => c.id === newChat.id)) {
                publicChats?.push(newChat);
                if (currentTab === 'public') window.updateChatsList?.();
            }
        });

        // Подписываемся на все приватные чаты
        myChats?.forEach(chat => {
            if (!chat.is_public && !chat.isFavorite) {
                subscribeToChatChannel(chat.id);
            }
        });
        
        // Подписываемся на персональный канал для звонков
        window.listenForIncomingCalls?.();
    });

    ably.connection.on('disconnected', () => {
        console.log('Ably disconnected, attempting to reconnect...');
        if (ablyReconnectTimer) {
            clearTimeout(ablyReconnectTimer);
        }
        ablyReconnectTimer = setTimeout(() => {
            if (currentUser && ably.connection.state !== 'connected') {
                ably.connection.connect();
            }
        }, 1000);
    });

    ably.connection.on('failed', () => {
        console.log('Ably failed, reinitializing...');
        if (ablyReconnectTimer) {
            clearTimeout(ablyReconnectTimer);
        }
        ablyReconnectTimer = setTimeout(() => {
            if (currentUser) initAbly();
        }, 3000);
    });
}

// Подписка на канал чата
function subscribeToChatChannel(chatId) {
    if (!ably || !currentUser) return;
    
    const chatChannel = ably.channels.get(`chat-${chatId}`);
    
    chatChannel.unsubscribe();
    
    function attachWithRetry(retries = 10, delay = 300) {
        chatChannel.attach((err) => {
            if (err) {
                console.error(`Failed to attach to chat channel ${chatId}, retries left: ${retries}`, err);
                if (retries > 0) {
                    setTimeout(() => attachWithRetry(retries - 1, delay), delay);
                }
                return;
            }
            console.log(`Attached to chat-${chatId}`);
        });
    }
    
    attachWithRetry(10, 300);

    chatChannel.subscribe('message', (message) => {
        const msg = message.data;
        if (!msg) return;
        
        if (msg.sender_id === currentUser.id) return;
        
        const now = Date.now();
        const msgTime = msg.created_at ? new Date(msg.created_at).getTime() : now;
        if (now - msgTime > 60000) {
            console.log('Ignoring old message', msg);
            return;
        }
        
        if (window.deletedMessages?.[chatId]?.includes(msg.id)) return;
        
        if (!window.messages?.[chatId]) window.messages = { ...window.messages, [chatId]: [] };
        
        const exists = window.messages[chatId]?.some(m => m.id === msg.id);
        if (!exists) {
            const sender = window.allUsers?.find(u => u.id === msg.sender_id) || 
                         { username: msg.sender_name || 'Неизвестно', avatar: '👤' };
            
            const newMsg = {
                id: msg.id,
                chatId: msg.chat_id,
                sender: msg.sender_id,
                senderName: sender.username,
                text: msg.text,
                audio: msg.audio,
                duration: msg.duration,
                time: msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
                timestamp: msg.created_at ? new Date(msg.created_at).getTime() : Date.now(),
                isAdmin: sender.username === ADMIN_USERNAME,
                edited: msg.edited || false,
                type: 'in'
            };
            
            window.messages[chatId].push(newMsg);
            window.messages[chatId].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            
            chatChannel.publish('delivery_receipt', { 
                messageId: msg.id, 
                receiver: currentUser.id
            });
            
            if (currentChat?.id !== chatId) {
                window.unreadCounts = window.unreadCounts || {};
                window.unreadCounts[chatId] = (window.unreadCounts[chatId] || 0) + 1;
                
                if (Notification.permission === 'granted') {
                    new Notification(`Новое сообщение от ${sender.username}`, {
                        body: msg.text || 'Голосовое сообщение',
                        icon: sender.avatar
                    });
                }
            }
            
            if (currentChat && currentChat.id === chatId) {
                window.renderMessages?.();
                window.unreadCounts[chatId] = 0;
                window.markMessagesAsRead?.(chatId);
            }
            
            window.updateChatsList?.();
        }
    });
    
    chatChannel.subscribe('delivery_receipt', (data) => {
        const { messageId } = data.data;
        if (window.messageStatuses?.[messageId]) {
            window.messageStatuses[messageId].status = 'delivered';
            window.saveMessageStatuses?.();
        }
        if (currentChat && currentChat.id === chatId) {
            window.renderMessages?.();
        }
    });
    
    chatChannel.subscribe('read_receipt', (data) => {
        const { messageId } = data.data;
        if (window.messageStatuses?.[messageId]) {
            window.messageStatuses[messageId].status = 'read';
            window.saveMessageStatuses?.();
        }
        if (currentChat && currentChat.id === chatId) {
            window.renderMessages?.();
        }
    });
    
    chatChannel.subscribe('delete', (data) => {
        const { messageId } = data.data;
        
        if (!window.deletedMessages?.[chatId]) window.deletedMessages = { ...window.deletedMessages, [chatId]: [] };
        if (!window.deletedMessages[chatId].includes(messageId)) {
            window.deletedMessages[chatId].push(messageId);
            localStorage.setItem('deletedMessages', JSON.stringify(window.deletedMessages));
        }
        if (window.messages?.[chatId]) {
            window.messages[chatId] = window.messages[chatId].filter(m => m.id !== messageId);
            if (currentChat?.id === chatId) window.renderMessages?.();
            window.updateChatsList?.();
        }
    });
    
    chatChannel.subscribe('edit', (data) => {
        const { messageId, newText } = data.data;
        
        if (window.messages?.[chatId]) {
            const msgIndex = window.messages[chatId].findIndex(m => m.id === messageId);
            if (msgIndex !== -1) {
                window.messages[chatId][msgIndex].text = newText;
                window.messages[chatId][msgIndex].edited = true;
                if (currentChat?.id === chatId) window.renderMessages?.();
            }
        }
    });
}

// Heartbeat для поддержания присутствия
function startHeartbeat() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
        if (ably && ably.connection.state === 'connected' && currentUser) {
            const presenceChannel = ably.channels.get('presence');
            if (presenceChannel.state === 'attached') {
                presenceChannel.presence.update({ 
                    name: currentUser.name,
                    avatar: currentUser.avatar || '👤',
                    bio: currentUser.bio || '',
                    isAdmin: currentUser.isAdmin || false,
                    dnd: currentUser.dnd || false,
                    lastSeen: Date.now()
                });
            }
        }
    }, 20000);
}

function startPresenceUpdates() {
    if (presenceUpdateInterval) clearInterval(presenceUpdateInterval);
    presenceUpdateInterval = setInterval(() => {
        if (ably && ably.connection.state === 'connected' && currentUser) {
            const presenceChannel = ably.channels.get('presence');
            if (presenceChannel.state === 'attached') {
                presenceChannel.presence.update({ 
                    name: currentUser.name,
                    avatar: currentUser.avatar || '👤',
                    bio: currentUser.bio || '',
                    isAdmin: currentUser.isAdmin || false,
                    dnd: currentUser.dnd || false,
                    lastSeen: Date.now()
                });
            }
        }
    }, 20000);
}

function startStatusUpdates() {
    if (statusUpdateInterval) clearInterval(statusUpdateInterval);
    statusUpdateInterval = setInterval(() => {
        if (currentTab === 'users' || currentTab === 'chats') {
            window.updateChatsList?.();
        }
        window.updateChatStatus?.();
    }, 2000);
}

// Экспорт в глобальную область
window.ably = ably;
window.onlineUsers = onlineUsers;

window.initAbly = initAbly;
window.subscribeToChatChannel = subscribeToChatChannel;
window.startHeartbeat = startHeartbeat;
window.startPresenceUpdates = startPresenceUpdates;
window.startStatusUpdates = startStatusUpdates;
