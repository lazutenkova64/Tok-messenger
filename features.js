function toggleForwardAuthor() {
            showForwardAuthor = !showForwardAuthor;
            localStorage.setItem('showForwardAuthor', showForwardAuthor ? 'true' : 'false');
            updateForwardAuthorSetting();
        }

function openForwardModal(messageId) {
            if (!currentChat || !currentUser) return;
            const msg = messages[currentChat.id]?.find(m => m.id === messageId);
            if (!msg) return;
            
            messageToForward = msg;
            closeContextMenu();
            
            const modal = document.getElementById('forwardModal');
            const list = document.getElementById('forwardChatList');
            const searchInput = document.getElementById('forwardSearchInput');
            const toggle = document.getElementById('forwardAuthorToggle');
            
            if (toggle) toggle.checked = showForwardAuthor;
            if (searchInput) searchInput.value = '';
            if (list) {
                list.innerHTML = '';
                const chats = myChats.filter(c => !(c.type === 'private' && c.pair_key === `${currentUser.id}_${currentUser.id}`));
                if (chats.length === 0) {
                    list.innerHTML = '<div class="empty-state">Нет доступных чатов</div>';
                } else {
                    chats.forEach(chat => {
                        const div = document.createElement('div');
                        div.className = 'chat-item';
                        div.style.cursor = 'pointer';
                        div.style.padding = '10px 14px';
                        div.style.borderRadius = '12px';
                        div.style.marginBottom = '4px';
                        div.dataset.chatId = chat.id;
                        
                        let displayName = chat.name;
                        let avatar = chat.avatar || '👥';
                        if (chat.type === 'private') {
                            const otherId = chat.pair_key.split('_').find(id => id !== currentUser.id);
                            const otherUser = allUsers.find(u => u.id === otherId);
                            if (otherUser) { displayName = otherUser.username; avatar = otherUser.avatar || '👤'; }
                        }
                        const safeAvatar = window.normalizeAvatar(avatar, displayName);
                        const avatarIsUrl = window.isAvatarUrl(safeAvatar);
                        const avatarHtml = avatarIsUrl
                            ? `<div class="chat-avatar" style="background-image: url('${safeAvatar}'); background-size: cover; width: 40px; height: 40px;"></div>`
                            : `<div class="chat-avatar" style="width: 40px; height: 40px; font-size: 18px;">${safeAvatar || '👥'}</div>`;
                        
                        div.innerHTML = `
                            ${avatarHtml}
                            <div class="chat-details">
                                <div class="chat-name" style="font-size: 15px;">${escapeHtml(displayName)}</div>
                            </div>
                        `;
                        div.onclick = () => forwardMessageToChat(chat.id);
                        list.appendChild(div);
                    });
                }
            }
            
            modal.classList.add('active');
        }

function filterForwardChats() {
            const input = document.getElementById('forwardSearchInput');
            const term = (input ? input.value : '').toLowerCase().trim();
            const list = document.getElementById('forwardChatList');
            if (!list) return;
            const items = list.querySelectorAll('.chat-item');
            items.forEach(item => {
                const name = (item.querySelector('.chat-name')?.textContent || '').toLowerCase();
                item.style.display = name.includes(term) ? 'flex' : 'none';
            });
        }

function closeForwardModal() {
            const modal = document.getElementById('forwardModal');
            if (modal) modal.classList.remove('active');
            messageToForward = null;
        }

function forwardMessageToChat(chatId) {
            if (!messageToForward || !currentUser) return;
            const msg = messageToForward;
            closeForwardModal();
            
            if (locallyDeletedChats.has(chatId)) {
                locallyDeletedChats.delete(chatId);
                saveLocallyDeletedChats();
            }
            
            let forwardedFrom = null;
            if (showForwardAuthor) {
                forwardedFrom = msg.sender === currentUser.id ? currentUser.name : (msg.senderName || 'Пользователь');
            }
            
            if (!currentChat || currentChat.id !== chatId) {
                const targetChat = myChats.find(c => c.id === chatId) || publicChats.find(c => c.id === chatId);
                if (targetChat) {
                    joinChat(targetChat);
                }
            }
            
            pendingForward = {
                text: msg.text || null,
                image: msg.image || null,
                audio: msg.audio || null,
                duration: msg.duration || null,
                forwarded_from: forwardedFrom
            };
            
            if (pendingImage) clearPendingImage();
            if (pendingAudio) clearPendingAudio();
            if (replyToMessage) cancelReply();
            if (editingMessage) cancelEditMessage();
            
            renderAttachmentPreview();
            messageToForward = null;
        }

async function loadReactionsForChat(chatId) {
            if (!currentUser || !chatId) return;
            try {
                const { data, error } = await db
                    .from('reactions')
                    .select('id, message_id, user_id, emoji, created_at')
                    .in('message_id', (messages[chatId] || []).map(m => m.id));
                if (error) { console.warn('[reactions] load error:', error); return; }
                
                (messages[chatId] || []).forEach(m => { delete messageReactions[m.id]; });
                
                (data || []).forEach(r => {
                    if (!messageReactions[r.message_id]) messageReactions[r.message_id] = [];
                    messageReactions[r.message_id].push(r);
                });
                
                if (currentChat && currentChat.id === chatId) renderMessages();
            } catch (e) { console.warn('[reactions] exception:', e); }
        }

function subscribeToReactions(chatId) {
            if (!currentUser || !chatId) return;
            if (reactionChannels[chatId]) return;
            
            const ch = db.channel('reactions-global-' + Math.random().toString(36).slice(2));
            
            ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions' }, (payload) => {
                const r = payload.new;
                if (!r || !r.message_id) return;
                let foundChatId = null;
                Object.keys(messages).forEach(cid => {
                    if ((messages[cid] || []).some(m => m.id === r.message_id)) foundChatId = cid;
                });
                if (!foundChatId) return;
                if (!messageReactions[r.message_id]) messageReactions[r.message_id] = [];
                if (messageReactions[r.message_id].some(x => x.id === r.id)) return;
                messageReactions[r.message_id].push(r);
                if (currentChat && currentChat.id === foundChatId) updateMessageReactions(r.message_id);
            });
            
            ch.on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'reactions' }, (payload) => {
                const old = payload.old;
                if (!old || !old.id) return;
                let affectedMessageId = null;
                Object.keys(messageReactions).forEach(msgId => {
                    const before = messageReactions[msgId].length;
                    messageReactions[msgId] = (messageReactions[msgId] || []).filter(x => x.id !== old.id);
                    if (messageReactions[msgId].length !== before) affectedMessageId = msgId;
                });
                if (affectedMessageId && currentChat) updateMessageReactions(affectedMessageId);
            });
            
            ch.subscribe((status) => {
                if (status === 'SUBSCRIBED') console.log('[reactions] subscribed (global)');
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.warn('[reactions] error, retry in 3s');
                    try { db.removeChannel(ch); } catch (e) {}
                    delete reactionChannels[chatId];
                    setTimeout(() => { if (currentUser) subscribeToReactions(chatId); }, 3000);
                }
            });
            
            reactionChannels[chatId] = ch;
        }

function updateMessageReactions(messageId) {
            if (!currentChat) return;
            const msgEl = document.querySelector('.message[data-id="' + messageId + '"]');
            if (!msgEl) return;

            const msgReactions = messageReactions[messageId] || [];
            let reactionsHtml = '';
            if (msgReactions.length > 0) {
                const grouped = {};
                msgReactions.forEach(r => {
                    if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, isMine: false, latest: 0 };
                    grouped[r.emoji].count++;
                    if (r.user_id === currentUser.id) grouped[r.emoji].isMine = true;
                    const t = r.created_at ? new Date(r.created_at).getTime() : 0;
                    if (t > grouped[r.emoji].latest) grouped[r.emoji].latest = t;
                });
                let emojiList = Object.keys(grouped).sort((a, b) => grouped[a].latest - grouped[b].latest);
                if (emojiList.length > 3) emojiList = emojiList.slice(-3);
                reactionsHtml = '<div class="reactions-row" style="display:flex; gap:4px; margin-top:4px; margin-bottom:2px; flex-wrap:wrap; position:relative; z-index:10;">';
                emojiList.forEach((emoji) => {
                    const g = grouped[emoji];
                    const borderColor = g.isMine ? 'var(--accent-blue)' : 'var(--border-color)';
                    const bgColor = g.isMine ? 'rgba(0, 122, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)';
                    reactionsHtml += '<span class="reaction-pill" onclick="toggleReaction(\'' + messageId + '\', \'' + emoji + '\'); event.stopPropagation();" style="display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:14px; font-size:15px; cursor:pointer; background:' + bgColor + '; border:1px solid ' + borderColor + '; transition: background 0.15s, transform 0.15s; user-select:none;"><span style="font-size:16px;">' + emoji + '</span><span style="font-size:12px; color:var(--text-secondary); font-weight:600;">' + g.count + '</span></span>';
                });
                reactionsHtml += '</div>';
            }

            let row = msgEl.querySelector('.reactions-row');
            if (row) {
                row.outerHTML = reactionsHtml || '<div class="reactions-row" style="display:none;"></div>';
            } else if (reactionsHtml) {
                const footer = msgEl.querySelector('.message-footer');
                if (footer) {
                    footer.insertAdjacentHTML('beforebegin', reactionsHtml);
                } else {
                    msgEl.insertAdjacentHTML('beforeend', reactionsHtml);
                }
            }
        }

async function toggleReaction(messageId, emoji) {
            if (!currentUser || !messageId) return;
            if (!messageReactions[messageId]) messageReactions[messageId] = [];
            
            const existing = messageReactions[messageId].find(r => r.user_id === currentUser.id && r.emoji === emoji);
            
            if (existing) {
                // Оптимистично удалить из UI
                messageReactions[messageId] = messageReactions[messageId].filter(r => r.id !== existing.id);
                if (currentChat) updateMessageReactions(messageId);
                
                // Затем удалить в БД
                try {
                    await db.from('reactions').delete().eq('id', existing.id);
                } catch (e) {
                    console.warn('[reactions] delete error:', e);
                    // Откат при ошибке
                    messageReactions[messageId].push(existing);
                    if (currentChat) updateMessageReactions(messageId);
                }
            } else {
                // Оптимистично добавить в UI (tempId)
                const tempId = 'temp_' + Date.now();
                const tempReaction = { id: tempId, message_id: messageId, user_id: currentUser.id, emoji: emoji, created_at: new Date().toISOString() };
                messageReactions[messageId].push(tempReaction);
                if (currentChat) updateMessageReactions(messageId);
                
                // Затем сохранить в БД
                try {
                    const { data, error } = await db.from('reactions').insert([{
                        message_id: messageId, user_id: currentUser.id, emoji: emoji
                    }]).select();
                    if (error) {
                        console.warn('[reactions] insert error:', error);
                        messageReactions[messageId] = messageReactions[messageId].filter(r => r.id !== tempId);
                        if (currentChat) updateMessageReactions(messageId);
                        return;
                    }
                    if (data && data[0]) {
                        // Заменить tempId на реальный id
                        const idx = messageReactions[messageId].findIndex(r => r.id === tempId);
                        if (idx !== -1) messageReactions[messageId][idx] = data[0];
                    }
                } catch (e) {
                    console.warn('[reactions] insert exception:', e);
                    messageReactions[messageId] = messageReactions[messageId].filter(r => r.id !== tempId);
                    if (currentChat) updateMessageReactions(messageId);
                }
            }
        }

async function loadBlocks() {
            if (!currentUser) return;
            try {
                const { data: myBlocks } = await db.from('blocks').select('blocked_id').eq('blocker_id', currentUser.id);
                blockedUsers = (myBlocks || []).map(b => b.blocked_id);
                
                const { data: theirBlocks } = await db.from('blocks').select('blocker_id').eq('blocked_id', currentUser.id);
                blockedByUsers = (theirBlocks || []).map(b => b.blocker_id);
            } catch (e) { console.warn('[blocks] load error:', e); }
        }

function isUserBlocked(userId) {
            return blockedUsers.includes(userId) || blockedByUsers.includes(userId);
        }

async function blockUser() {
            if (!currentChat || !currentUser) return;
            if (currentChat.type !== 'private') return;
            if (currentChat.pair_key === `${currentUser.id}_${currentUser.id}`) return;
            const otherId = currentChat.pair_key.split('_').find(id => id !== currentUser.id);
            if (!otherId || otherId === currentUser.id) return;
            
            const isBlocked = blockedUsers.includes(otherId);
            
            if (isBlocked) {
                // Разблокировать — без подтверждения
                try {
                    await db.from('blocks').delete().eq('blocker_id', currentUser.id).eq('blocked_id', otherId);
                    blockedUsers = blockedUsers.filter(id => id !== otherId);
                    updateBlockUI();
                    renderMessages();
                    
                    // Переподписаться на канал (для получения новых сообщений)
                    if (currentChat && currentChat.id) {
                        try { unsubscribeFromSupabaseChat(currentChat.id); } catch (e) {}
                        setTimeout(() => {
                            subscribeToSupabaseChat(currentChat.id);
                            loadChatHistory(currentChat.id);
                        }, 100);
                    }
                } catch (e) { console.warn('[block] unlock error:', e); }
            } else {
                // Заблокировать — без подтверждения
                try {
                    await db.from('blocks').insert([{ blocker_id: currentUser.id, blocked_id: otherId }]);
                    blockedUsers.push(otherId);
                    updateBlockUI();
                    renderMessages();
                } catch (e) { console.warn('[block] lock error:', e); }
            }
        }

function updateBlockUI() {
            if (!currentChat || currentChat.type !== 'private') return;
            if (currentChat.pair_key === `${currentUser.id}_${currentUser.id}`) return;
            const otherId = currentChat.pair_key.split('_').find(id => id !== currentUser.id);
            if (!otherId) return;
            
            const btn = document.getElementById('blockUserBtn');
            if (!btn) return;
            
            if (blockedUsers.includes(otherId)) {
                btn.innerHTML = '✅ <span id="blockUserBtnText">Разблокировать</span>';
            } else {
                btn.innerHTML = '🚫 <span id="blockUserBtnText">Заблокировать</span>';
            }
        }

function showFailedMessageMenu(messageId, event) {
            if (event) { event.stopPropagation(); event.preventDefault(); }
            failedMessageId = messageId;
            
            const existing = document.getElementById('failedMessageMenu');
            if (existing) existing.remove();
            
            const menu = document.createElement('div');
            menu.id = 'failedMessageMenu';
            menu.style.cssText = 'position: fixed; background: rgba(20,20,30, calc(0.4 + 0.5 * (1 - var(--glass-intensity)))); backdrop-filter: blur(calc(var(--glass-blur-menu) * var(--glass-intensity))); -webkit-backdrop-filter: blur(calc(var(--glass-blur-menu) * var(--glass-intensity))); border-radius: 14px; padding: 6px; box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.06) inset; border: 1px solid rgba(255,255,255,0.1); z-index: 10000; min-width: 200px;';
            
            const x = event ? event.clientX : window.innerWidth / 2;
            const y = event ? event.clientY : window.innerHeight / 2;
            menu.style.left = Math.min(x, window.innerWidth - 200) + 'px';
            menu.style.top = Math.min(y, window.innerHeight - 120) + 'px';
            
            menu.innerHTML = `
                <button onclick="retryFailedMessage()" style="display:flex; align-items:center; gap:10px; width:100%; padding:10px 14px; background:transparent; border:none; color:var(--text-primary); font-size:14px; cursor:pointer; text-align:left; border-radius:8px; -webkit-tap-highlight-color: transparent;">
                    <span style="font-size:16px; width:18px; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;">🔄</span>
                    <span>Повторить ещё раз</span>
                </button>
                <button onclick="deleteFailedMessage()" style="display:flex; align-items:center; gap:10px; width:100%; padding:10px 14px; background:transparent; border:none; color:#ff453a; font-size:14px; cursor:pointer; text-align:left; border-radius:8px; -webkit-tap-highlight-color: transparent;">
                    <span style="font-size:16px; width:18px; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;">🗑</span>
                    <span>Удалить</span>
                </button>
            `;
            document.body.appendChild(menu);
            
            setTimeout(() => {
                document.addEventListener('click', closeFailedMessageMenu, { once: true });
            }, 100);
        }

function closeFailedMessageMenu() {
            const menu = document.getElementById('failedMessageMenu');
            if (menu) menu.remove();
            failedMessageId = null;
        }

async function retryFailedMessage() {
            const messageId = failedMessageId;
            closeFailedMessageMenu();
            if (!messageId || !currentChat) return;
            
            const msg = messages[currentChat.id]?.find(m => m.id === messageId);
            if (!msg) return;
            
            messageStatuses[messageId] = { status: 'pending' };
            saveMessageStatuses();
            renderMessages();
            
            if (currentChat.type === 'private' && currentChat.pair_key !== `${currentUser.id}_${currentUser.id}`) {
                const otherId = currentChat.pair_key.split('_').find(id => id !== currentUser.id);
                try {
                    const { data: blockCheck } = await db.from('blocks')
                        .select('id')
                        .or(`and(blocker_id.eq.${currentUser.id},blocked_id.eq.${otherId}),and(blocker_id.eq.${otherId},blocked_id.eq.${currentUser.id})`)
                        .limit(1);
                    if (blockCheck && blockCheck.length > 0) {
                        messageStatuses[messageId] = { status: 'failed', reason: 'blocked' };
                        saveMessageStatuses();
                        renderMessages();
                        return;
                    }
                } catch (e) { console.warn('[retry] block check error:', e); }
            }
            
            try {
                const { data, error } = await db.from('messages').insert([{
                    chat_id: currentChat.id,
                    sender_id: currentUser.id,
                    text: msg.text || null,
                    image: msg.image || null,
                    audio: msg.audio || null,
                    duration: msg.duration || null,
                    is_admin: currentUser.is_admin,
                    read_at: null,
                    reply_to: msg.reply_to || null,
                    forwarded_from: msg.forwarded_from || null,
                    created_at: new Date().toISOString()
                }]).select();
                
                if (error) throw error;
                
                if (data && data[0]) {
                    messageStatuses[data[0].id] = { status: 'sent' };
                    delete messageStatuses[messageId];
                    const idx = messages[currentChat.id].findIndex(m => m.id === messageId);
                    if (idx !== -1) {
                        messages[currentChat.id][idx].id = data[0].id;
                        messages[currentChat.id][idx].timestamp = new Date(data[0].created_at).getTime();
                    }
                    saveMessageStatuses();
                    renderMessages();
                    updateChatsList();
                }
            } catch (e) {
                console.warn('[retry] failed again:', e);
                messageStatuses[messageId] = { status: 'failed' };
                saveMessageStatuses();
                renderMessages();
            }
        }

function deleteFailedMessage() {
            const messageId = failedMessageId;
            closeFailedMessageMenu();
            if (!messageId || !currentChat) return;
            
            messages[currentChat.id] = messages[currentChat.id].filter(m => m.id !== messageId);
            delete messageStatuses[messageId];
            saveMessageStatuses();
            renderMessages();
            updateChatsList();
        }

function setReplyTo(messageId) {
            if (!currentChat || !messages[currentChat.id]) return;
            const msg = messages[currentChat.id].find(m => m.id === messageId);
            if (!msg) return;
            replyToMessage = msg;
            
            const preview = document.getElementById('replyPreview');
            const nameEl = document.getElementById('replyPreviewName');
            const textEl = document.getElementById('replyPreviewText');
            if (!preview || !nameEl || !textEl) return;
            
            nameEl.textContent = msg.type === 'out' ? 'Вы' : (msg.senderName || 'Пользователь');
            textEl.textContent = msg.text ? msg.text.substring(0, 100) : (msg.image ? '📷 Изображение' : (msg.audio ? '🎤 Голосовое' : 'Сообщение'));
            preview.style.display = 'block';
            
            const input = document.getElementById('messageInput');
            if (input) input.focus();
            hideMessageActions();
        }

function cancelReply() {
            replyToMessage = null;
            const preview = document.getElementById('replyPreview');
            if (preview) preview.style.display = 'none';
        }

function scrollToMessage(messageId, event) {
            if (event) event.stopPropagation();
            const container = document.getElementById('messagesContainer');
            if (!container) return;
            const el = container.querySelector('.message[data-id="' + messageId + '"]');
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.style.transition = 'background 0.5s';
                const oldBg = el.style.background;
                el.style.background = 'rgba(0, 122, 255, 0.4)';
                setTimeout(() => { el.style.background = oldBg; }, 1000);
            }
        }

function checkScrollPosition() {
            const container = document.getElementById('messagesContainer');
            const btn = document.getElementById('scrollToBottomBtn');
            if (!container || !btn) return;
            const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
            if (distanceFromBottom > 200) {
                btn.classList.add('visible');
            } else {
                btn.classList.remove('visible');
                scrollToBottomBadgeCount = 0;
                const badge = document.getElementById('scrollToBottomBadge');
                if (badge) badge.style.display = 'none';
            }
        }

function scrollToBottomClick() {
            const container = document.getElementById('messagesContainer');
            if (!container) return;
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            scrollToBottomBadgeCount = 0;
            const badge = document.getElementById('scrollToBottomBadge');
            if (badge) badge.style.display = 'none';
        }

function incrementScrollBadge() {
            const container = document.getElementById('messagesContainer');
            const btn = document.getElementById('scrollToBottomBtn');
            const badge = document.getElementById('scrollToBottomBadge');
            if (!container || !btn || !badge) return;
            const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
            if (distanceFromBottom > 200) {
                scrollToBottomBadgeCount++;
                badge.textContent = scrollToBottomBadgeCount > 99 ? '99+' : scrollToBottomBadgeCount;
                badge.style.display = 'block';
            }
        }

window.toggleForwardAuthor = toggleForwardAuthor;
window.openForwardModal = openForwardModal;
window.filterForwardChats = filterForwardChats;
window.closeForwardModal = closeForwardModal;
window.forwardMessageToChat = forwardMessageToChat;
window.loadReactionsForChat = loadReactionsForChat;
window.subscribeToReactions = subscribeToReactions;
window.updateMessageReactions = updateMessageReactions;
window.toggleReaction = toggleReaction;
window.loadBlocks = loadBlocks;
window.isUserBlocked = isUserBlocked;
window.blockUser = blockUser;
window.updateBlockUI = updateBlockUI;
window.showFailedMessageMenu = showFailedMessageMenu;
window.closeFailedMessageMenu = closeFailedMessageMenu;
window.retryFailedMessage = retryFailedMessage;
window.deleteFailedMessage = deleteFailedMessage;
window.setReplyTo = setReplyTo;
window.cancelReply = cancelReply;
window.scrollToMessage = scrollToMessage;
window.checkScrollPosition = checkScrollPosition;
window.scrollToBottomClick = scrollToBottomClick;
window.incrementScrollBadge = incrementScrollBadge;
