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
    console.log('🚀 initAbly called', { currentUser: currentUser?.id });
    
    if (!currentUser) {
        console.error('❌ Cannot init Ably: no currentUser');
        return;
    }
    
    if (ably) {
        console.log('Closing existing Ably connection');
        try {
            ably.close();
        } catch (e) {
            console.error('Error closing Ably:', e);
        }
    }
    
    console.log('Creating new Ably connection with clientId:', currentUser.id.toString());
    
    ably = new Ably.Realtime({
        key: "pYHevw.VrFP9Q:8u3IGeMI56PtA4S6Z_VCVvvXpEXEmiIlfoAjfPb6BZg",
        clientId: currentUser.id.toString(),
        transports: ['web_socket', 'comet'],
        disconnectedRetryTimeout: 3000,
        suspendedRetryTimeout: 5000,
        realtimeRequestTimeout: 30000,
        echoMessages: false,
        idleTimeout: 60000
    });

    ably.connection.on('connected', () => {
        console.log('✅ Connected to Ably, connectionId:', ably.connection.id);
        
        if (ablyReconnectTimer) {
            clearTimeout(ablyReconnectTimer);
            ablyReconnectTimer = null;
        }
        
        // Presence channel
        const presenceChannel = ably.channels.get('presence');
        console.log('Entering presence channel');
        presenceChannel.presence.enter({ 
            name: currentUser.name, 
            avatar: currentUser.avatar || '👤',
            bio: currentUser.bio || '',
            isAdmin: currentUser.isAdmin || false,
            dnd: currentUser.dnd || false,
            lastSeen: Date.now()
        }, (err) => {
            if (err) console.error('❌ Presence enter error:', err);
            else console.log('✅ Presence entered');
        });
        
        setupPresenceHandlers(presenceChannel);
        
        // Подписываемся на персональный канал для звонков
        const userChannelName = `user-${currentUser.id}`;
        console.log('📞 Creating user channel:', userChannelName);
        const userChannel = ably.channels.get(userChannelName);
        setupUserChannelHandlers(userChannel);
        
        // Принудительно прикрепляем user channel
        userChannel.attach((err) => {
            if (err) console.error('❌ Failed to attach user channel:', err);
            else console.log('✅ User channel attached:', userChannelName);
        });
        
        // Подписываемся на все чаты
        subscribeToAllChats();
        
        // Глобальный канал для новых публичных чатов
        const globalChatsChannel = ably.channels.get('global-chats');
        globalChatsChannel.subscribe('new-chat', (message) => {
            const newChat = message.data;
            console.log('New public chat created:', newChat);
            if (!publicChats?.find(c => c.id === newChat.id)) {
                publicChats?.push(newChat);
                if (currentTab === 'public' && typeof window.updateChatsList === 'function') {
                    window.updateChatsList();
                }
            }
        });
    });

    ably.connection.on('connecting', () => {
        console.log('⏳ Ably connecting...');
    });

    ably.connection.on('disconnected', () => {
        console.log('⚠️ Ably disconnected, attempting to reconnect...');
        scheduleReconnect();
    });

    ably.connection.on('suspended', () => {
        console.log('⚠️ Ably suspended');
    });

    ably.connection.on('failed', (err) => {
        console.error('❌ Ably failed:', err);
        scheduleReconnect(true);
    });
}

// Настройка обработчиков presence
function setupPresenceHandlers(presenceChannel) {
    presenceChannel.presence.subscribe('enter', (member) => {
        console.log('👤 User entered:', member.clientId, member.data);
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
            
            console.log('Online users updated:', Object.keys(onlineUsers));
            
            if (typeof window.sendQueuedMessagesToUser === 'function') {
                window.sendQueuedMessagesToUser(member.clientId);
            }
            
            if (currentTab === 'users' || currentTab === 'chats') {
                if (typeof window.updateChatsList === 'function') window.updateChatsList();
            }
            if (typeof window.updateChatStatus === 'function') window.updateChatStatus();
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
                if (typeof window.updateChatsList === 'function') window.updateChatsList();
            }
            if (typeof window.updateChatStatus === 'function') window.updateChatStatus();
        }
    });
    
    presenceChannel.presence.subscribe('leave', (member) => {
        console.log('👤 User left:', member.clientId);
        if (onlineUsers[member.clientId]) {
            onlineUsers[member.clientId].online = false;
            onlineUsers[member.clientId].lastSeen = Date.now();
            if (currentTab === 'users' || currentTab === 'chats') {
                if (typeof window.updateChatsList === 'function') window.updateChatsList();
            }
            if (typeof window.updateChatStatus === 'function') window.updateChatStatus();
        }
    });
    
    presenceChannel.presence.get((err, members) => {
        if (err) {
            console.error('Error getting presence members:', err);
            return;
        }
        console.log('Current presence members:', members?.length);
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
            if (typeof window.updateChatsList === 'function') window.updateChatsList();
        }
    });
}

// ИСПРАВЛЕННЫЙ обработчик канала пользователя
function setupUserChannelHandlers(userChannel) {
    console.log('📞 Setting up user channel handlers for', currentUser?.id);

    // Проверяем, что канал существует
    if (!userChannel) {
        console.error('❌ User channel is null');
        return;
    }

    // Отписываемся от старых подписок
    userChannel.unsubscribe();

    // входящий звонок
    userChannel.subscribe('offer', (message) => {
        console.log("📞📞📞 INCOMING CALL OFFER RECEIVED:", message.data);
        console.log("Current user:", currentUser?.id);
        console.log("Caller ID:", message.data.callerId);
        console.log("Target ID:", message.data.targetId);
        console.log("Call ID:", message.data.callId);
        console.log("Timestamp:", message.data.timestamp);
        
        const { offer, callerId, callerName, callerAvatar, callId, dbCallId, timestamp } = message.data;
        
        // Проверяем, что звонок предназначен этому пользователю
        if (callerId === currentUser.id) {
            console.log('⚠️ Ignoring own call');
            return;
        }
        
        // Проверяем, не устарел ли звонок
        if (Date.now() - timestamp > 15000) {
            console.log('⚠️ Ignoring old call offer', timestamp);
            return;
        }
        
        // Если уже есть активный звонок, отклоняем
        if (window.currentCall) {
            console.log('⚠️ Already have active call, rejecting');
            userChannel.publish('end', { 
                callId, 
                timestamp: Date.now(),
                reason: 'busy'
            });
            return;
        }

        // Вызываем обработчик входящего звонка
        if (typeof window.handleIncomingCall === 'function') {
            console.log('✅ Calling window.handleIncomingCall');
            window.handleIncomingCall({
                offer, 
                callerId, 
                callerName, 
                callerAvatar, 
                callId, 
                dbCallId, 
                timestamp
            });
        } else {
            console.error('❌ window.handleIncomingCall is not defined!');
        }
    });

    // ответ на звонок
    userChannel.subscribe('answer', (message) => {
        console.log("✅ Call answer received:", message.data);
        const { answer, callId, timestamp } = message.data;
        
        if (Date.now() - timestamp > 15000) {
            console.log('⚠️ Ignoring old answer');
            return;
        }
        
        if (typeof window.handleCallAnswer === 'function') {
            window.handleCallAnswer({ answer, callId });
        } else {
            console.error('❌ window.handleCallAnswer is not defined!');
        }
    });

    // ICE кандидаты
    userChannel.subscribe('ice-candidate', (message) => {
        console.log("🧊 ICE candidate received");
        const { candidate, callId, timestamp } = message.data;
        
        if (Date.now() - timestamp > 15000) return;
        
        if (typeof window.handleIceCandidate === 'function') {
            window.handleIceCandidate({ candidate, callId });
        }
    });

    // завершение звонка
    userChannel.subscribe('end', (message) => {
        console.log("📴 Call end received:", message.data);
        const { callId, reason } = message.data;
        
        if (typeof window.handleCallEnd === 'function') {
            window.handleCallEnd({ callId, reason });
        }
    });

    console.log('✅ User channel handlers setup complete');
}

// Подписка на все чаты
function subscribeToAllChats() {
    if (!myChats) {
        console.log('No chats to subscribe to');
        return;
    }
    
    console.log('Subscribing to', myChats.length, 'chats');
    myChats.forEach(chat => {
        if (!chat.isFavorite) {
            subscribeToChatChannel(chat.id, chat.is_public);
        }
    });
}

// Подписка на канал чата
function subscribeToChatChannel(chatId, isPublic = false) {
    if (!ably || !currentUser) return;
    
    const chatChannel = ably.channels.get(`chat-${chatId}`);
    
    // Отписываемся от старых подписок
    chatChannel.unsubscribe();
    
    // Прикрепляемся с повторными попытками
    attachWithRetry(chatChannel, chatId);
    
    // Подписываемся на сообщения
    chatChannel.subscribe('message', (message) => {
        handleIncomingMessage(message, chatId);
    });
    
    // Для приватных чатов подписываемся на дополнительные события
    if (!isPublic) {
        chatChannel.subscribe('delivery_receipt', (data) => {
            handleDeliveryReceipt(data, chatId);
        });
        
        chatChannel.subscribe('read_receipt', (data) => {
            handleReadReceipt(data, chatId);
        });
        
        chatChannel.subscribe('delete', (data) => {
            handleDeleteMessage(data, chatId);
        });
        
        chatChannel.subscribe('edit', (data) => {
            handleEditMessage(data, chatId);
        });
    }
}

// Обработка входящего сообщения
function handleIncomingMessage(message, chatId) {
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
    
    if (!window.messages) window.messages = {};
    if (!window.messages[chatId]) window.messages[chatId] = [];
    
    const exists = window.messages[chatId].some(m => m.id === msg.id);
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
        if (Array.isArray(window.messages[chatId])) {
            window.messages[chatId].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        }
        
        if (!window.publicChats?.find(c => c.id === chatId)) {
            const chatChannel = ably.channels.get(`chat-${chatId}`);
            chatChannel.publish('delivery_receipt', { 
                messageId: msg.id, 
                receiver: currentUser.id
            });
        }
        
        if (!window.unreadCounts) window.unreadCounts = {};
        if (currentChat?.id !== chatId) {
            window.unreadCounts[chatId] = (window.unreadCounts[chatId] || 0) + 1;
            
            if (Notification.permission === 'granted') {
                new Notification(`Новое сообщение от ${sender.username}`, {
                    body: msg.text || 'Голосовое сообщение',
                    icon: sender.avatar
                });
            }
        }
        
        if (currentChat && currentChat.id === chatId) {
            if (typeof window.renderMessages === 'function') window.renderMessages();
            window.unreadCounts[chatId] = 0;
            if (typeof window.markMessagesAsRead === 'function') window.markMessagesAsRead(chatId);
        }
        
        if (typeof window.updateChatsList === 'function') window.updateChatsList();
    }
}

// Обработка подтверждения доставки
function handleDeliveryReceipt(data, chatId) {
    const { messageId } = data.data;
    if (window.messageStatuses?.[messageId]) {
        window.messageStatuses[messageId].status = 'delivered';
        if (typeof window.saveMessageStatuses === 'function') window.saveMessageStatuses();
    }
    if (currentChat && currentChat.id === chatId) {
        if (typeof window.renderMessages === 'function') window.renderMessages();
    }
}

// Обработка подтверждения прочтения
function handleReadReceipt(data, chatId) {
    const { messageId } = data.data;
    if (window.messageStatuses?.[messageId]) {
        window.messageStatuses[messageId].status = 'read';
        if (typeof window.saveMessageStatuses === 'function') window.saveMessageStatuses();
    }
    if (currentChat && currentChat.id === chatId) {
        if (typeof window.renderMessages === 'function') window.renderMessages();
    }
}

// Обработка удаления сообщения
function handleDeleteMessage(data, chatId) {
    const { messageId } = data.data;
    
    if (!window.deletedMessages) window.deletedMessages = {};
    if (!window.deletedMessages[chatId]) window.deletedMessages[chatId] = [];
    if (!window.deletedMessages[chatId].includes(messageId)) {
        window.deletedMessages[chatId].push(messageId);
        localStorage.setItem('deletedMessages', JSON.stringify(window.deletedMessages));
    }
    if (window.messages?.[chatId]) {
        window.messages[chatId] = window.messages[chatId].filter(m => m.id !== messageId);
        if (currentChat?.id === chatId && typeof window.renderMessages === 'function') {
            window.renderMessages();
        }
        if (typeof window.updateChatsList === 'function') window.updateChatsList();
    }
}

// Обработка редактирования сообщения
function handleEditMessage(data, chatId) {
    const { messageId, newText } = data.data;
    
    if (window.messages?.[chatId]) {
        const msgIndex = window.messages[chatId].findIndex(m => m.id === messageId);
        if (msgIndex !== -1) {
            window.messages[chatId][msgIndex].text = newText;
            window.messages[chatId][msgIndex].edited = true;
            if (currentChat?.id === chatId && typeof window.renderMessages === 'function') {
                window.renderMessages();
            }
        }
    }
}

// Вспомогательные функции
function attachWithRetry(channel, chatId, retries = 10, delay = 300) {
    channel.attach((err) => {
        if (err) {
            console.error(`Failed to attach to chat channel ${chatId}, retries left: ${retries}`, err);
            if (retries > 0) {
                setTimeout(() => attachWithRetry(channel, chatId, retries - 1, delay), delay);
            }
        } else {
            console.log(`✅ Attached to chat-${chatId}`);
        }
    });
}

function scheduleReconnect(fullReinit = false) {
    if (ablyReconnectTimer) clearTimeout(ablyReconnectTimer);
    ablyReconnectTimer = setTimeout(() => {
        if (currentUser) {
            if (fullReinit) {
                console.log('🔄 Full Ably reinitialization');
                initAbly();
            } else if (ably && ably.connection.state !== 'connected') {
                console.log('🔄 Attempting to reconnect Ably');
                ably.connection.connect();
            }
        }
    }, fullReinit ? 5000 : 2000);
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
                }, (err) => {
                    if (err) console.error('Heartbeat update error:', err);
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
            if (typeof window.updateChatsList === 'function') window.updateChatsList();
        }
        if (typeof window.updateChatStatus === 'function') window.updateChatStatus();
    }, 2000);
}

// Диагностическая функция
function diagnoseAbly() {
    console.log('=== ABLY DIAGNOSTICS ===');
    console.log('Ably exists:', !!ably);
    console.log('Ably connection state:', ably?.connection.state);
    console.log('Current user:', currentUser);
    console.log('Online users:', Object.keys(onlineUsers).length);
    console.log('handleIncomingCall exists:', typeof window.handleIncomingCall === 'function');
    console.log('handleCallAnswer exists:', typeof window.handleCallAnswer === 'function');
    console.log('handleIceCandidate exists:', typeof window.handleIceCandidate === 'function');
    console.log('handleCallEnd exists:', typeof window.handleCallEnd === 'function');
    console.log('=== END DIAGNOSTICS ===');
}

// Экспорт в глобальную область
window.ably = ably;
window.onlineUsers = onlineUsers;

window.initAbly = initAbly;
window.subscribeToChatChannel = subscribeToChatChannel;
window.startHeartbeat = startHeartbeat;
window.startPresenceUpdates = startPresenceUpdates;
window.startStatusUpdates = startStatusUpdates;
window.diagnoseAbly = diagnoseAbly;
