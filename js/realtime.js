// ========== ABLY ИНИЦИАЛИЗАЦИЯ И УПРАВЛЕНИЕ ==========
const ABLY_API_KEY = "pYHevw.VrFP9Q:8u3IGeMI56PtA4S6Z_VCVvvXpEXEmiIlfoAjfPb6BZg";

let ably;
let onlineUsers = {};
let heartbeatInterval;
let presenceUpdateInterval;
let ablyReconnectTimer = null;

function initAbly() {
    if (!window.currentUser) return;
    
    if (ably) {
        try {
            ably.close();
        } catch (e) {}
    }
    
    ably = new Ably.Realtime({
        key: ABLY_API_KEY,
        clientId: window.currentUser.id.toString(),
        transports: ['web_socket'],
        disconnectedRetryTimeout: 500,
        suspendedRetryTimeout: 1000,
        realtimeRequestTimeout: 10000,
        echoMessages: false,
        idleTimeout: 30000
    });

    ably.connection.on('connected', () => {
        console.log('Connected to Ably');
        
        if (ablyReconnectTimer) {
            clearTimeout(ablyReconnectTimer);
            ablyReconnectTimer = null;
        }
        
        const presenceChannel = ably.channels.get('presence');
        
        presenceChannel.attach((err) => {
            if (err) {
                console.error('Failed to attach presence channel', err);
                return;
            }
            
            presenceChannel.presence.enter({ 
                name: window.currentUser.name, 
                avatar: window.currentUser.avatar || '👤',
                bio: window.currentUser.bio || '',
                isAdmin: window.currentUser.isAdmin || false,
                dnd: window.currentUser.dnd || false,
                lastSeen: Date.now()
            });
            
            presenceChannel.presence.get((err, members) => {
                if (members && Array.isArray(members)) {
                    members.forEach(member => {
                        if (member.clientId !== window.currentUser.id.toString()) {
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
                if (window.currentTab === 'users' || window.currentTab === 'chats') {
                    updateChatsList();
                }
            });
        });
        
        presenceChannel.subscribe('enter', (member) => {
            if (member.clientId !== window.currentUser.id.toString()) {
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
                
                sendQueuedMessagesToUser(member.clientId);
                
                if (window.currentTab === 'users' || window.currentTab === 'chats') {
                    updateChatsList();
                }
                updateChatStatus();
            }
        });
        
        presenceChannel.subscribe('update', (member) => {
            if (member.clientId !== window.currentUser.id.toString()) {
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
                if (window.currentTab === 'users' || window.currentTab === 'chats') {
                    updateChatsList();
                }
                updateChatStatus();
            }
        });
        
        presenceChannel.subscribe('leave', (member) => {
            if (onlineUsers[member.clientId]) {
                onlineUsers[member.clientId].online = false;
                onlineUsers[member.clientId].lastSeen = Date.now();
                if (window.currentTab === 'users' || window.currentTab === 'chats') {
                    updateChatsList();
                }
                updateChatStatus();
            }
        });

        const globalChatsChannel = ably.channels.get('global-chats');
        globalChatsChannel.subscribe('new-chat', (message) => {
            const newChat = message.data;
            if (!window.publicChats.find(c => c.id === newChat.id)) {
                window.publicChats.push(newChat);
                if (window.currentTab === 'public') updateChatsList();
            }
        });

        const userChannel = ably.channels.get(`user-${window.currentUser.id}`);
        userChannel.subscribe('new-private-chat', (message) => {
            const { chatId, pairKey, participants, avatar, timestamp } = message.data;
            
            if (Date.now() - timestamp > 10000) return;
            
            if (!participants.includes(window.currentUser.id)) return;
            if (window.myChats.some(c => c.id === chatId)) return;
            
            const otherUserId = participants.find(id => id !== window.currentUser.id);
            const otherUser = window.allUsers.find(u => u.id === otherUserId);
            const newChat = {
                id: chatId,
                name: '',
                pair_key: pairKey,
                avatar: otherUser ? otherUser.avatar : '👤',
                is_public: false,
                type: 'private',
                created_at: new Date().toISOString()
            };
            
            window.myChats.push(newChat);
            localStorage.setItem(`myChats_${window.currentUser.id}`, JSON.stringify(window.myChats));
            
            if (ably) {
                subscribeToChatChannel(newChat.id);
            }
            
            updateChatsList();
        });

        window.myChats.forEach(chat => {
            if (!chat.is_public) {
                subscribeToChatChannel(chat.id);
            }
        });
    });

    ably.connection.on('disconnected', () => {
        console.log('Ably disconnected, attempting to reconnect...');
        if (ablyReconnectTimer) {
            clearTimeout(ablyReconnectTimer);
        }
        ablyReconnectTimer = setTimeout(() => {
            if (window.currentUser && ably.connection.state !== 'connected') {
                ably.connection.connect();
            }
        }, 500);
    });

    ably.connection.on('failed', () => {
        console.log('Ably failed, reinitializing...');
        if (ablyReconnectTimer) {
            clearTimeout(ablyReconnectTimer);
        }
        ablyReconnectTimer = setTimeout(() => {
            if (window.currentUser) initAbly();
        }, 2000);
    });
}

function startHeartbeat() {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
        if (ably && ably.connection.state === 'connected' && window.currentUser) {
            const presenceChannel = ably.channels.get('presence');
            if (presenceChannel.state === 'attached') {
                presenceChannel.presence.update({ 
                    name: window.currentUser.name,
                    avatar: window.currentUser.avatar || '👤',
                    bio: window.currentUser.bio || '',
                    isAdmin: window.currentUser.isAdmin || false,
                    dnd: window.currentUser.dnd || false,
                    lastSeen: Date.now()
                });
            }
        }
    }, 20000);
}

function startPresenceUpdates() {
    if (presenceUpdateInterval) clearInterval(presenceUpdateInterval);
    presenceUpdateInterval = setInterval(() => {
        if (ably && ably.connection.state === 'connected' && window.currentUser) {
            const presenceChannel = ably.channels.get('presence');
            if (presenceChannel.state === 'attached') {
                presenceChannel.presence.update({ 
                    name: window.currentUser.name,
                    avatar: window.currentUser.avatar || '👤',
                    bio: window.currentUser.bio || '',
                    isAdmin: window.currentUser.isAdmin || false,
                    dnd: window.currentUser.dnd || false,
                    lastSeen: Date.now()
                });
            }
        }
    }, 20000);
}
