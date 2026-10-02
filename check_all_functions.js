const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const lines = content.split('\n');

// Find all function boundaries and check balance
const functions = [
    'sendMessage',
    'sendImageMessage',
    'sendAudioMessage',
    'sendPendingMessages',
    'processMessageQueue',
    'addToMessageQueue',
    'sendQueuedMessagesToUser',
    'deleteMessage',
    'editMessage',
    'saveEditedMessage',
    'renderMessages',
    'downloadImage',
    'markMessagesAsRead',
    'updateUnreadCounts',
    'initAbly',
    'setupPresenceChannel',
    'setupGlobalChatsChannel',
    'setupUserChannel',
    'startHeartbeat',
    'startPresenceUpdates',
    'startStatusUpdates',
    'handleBeforeUnload',
    'updateChatsList',
    'renderUserItem',
    'renderChatItem',
    'updateProfileUI',
    'toggleRecording',
    'startRecording',
    'stopRecording',
    'toggleAudio',
    'updateAudioButton',
    'updateAudioProgress',
    'seekAudio',
    'preloadSounds',
    'cleanupOldCalls',
    'getIceServers',
    'initAudioContext',
    'clearRemoteAudios',
    'resetCallState',
    'closeCallModal',
    'createPeerConnection',
    'startCall',
    'showCallModal',
    'handleIncomingCallRequest',
    'answerCall',
    'rejectCall',
    'endCall',
    'toggleMute',
    'startCallTimer',
    'openCreateChatModal',
    'closeCreateChatModal',
    'closeEditMessageModal',
    'openProfileModal',
    'closeProfileModal',
    'saveProfile',
    'openAvatarModal',
    'selectAvatar',
    'saveAvatar',
    'closeAvatarModal',
    'openChatUserProfile',
    'closeUserProfileModal',
    'switchAuthMode',
    'switchTab',
    'updateCreateChatButtonVisibility',
    'handleKeyPress',
    'handleTextInput',
    'updateSendButtonState',
    'toggleSidebar',
    'handleBackButton',
    'updateUrlWithChat',
    'checkUrlForChat',
    'openMedia',
    'closeMediaViewer',
    'updateBackButtonVisibility',
    'setupMobileHandlers',
    'scrollToBottomOnMobile',
    'forceShowInput',
    'togglePassword',
    'toggleEmojiPicker',
    'populateEmojiPicker',
    'addEmoji',
    'handleMessagesContainerClick',
    'showMessageActions',
    'hideMessageActions',
    'disableSendButton',
    'handleImageUpload',
    'renderAttachmentPreview',
    'clearPendingAudio',
];

for (const funcName of functions) {
    let startLine = -1;
    let depth = 0;
    
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(`function ${funcName}`)) {
            startLine = i;
            break;
        }
    }
    
    if (startLine >= 0) {
        for (let i = startLine; i < lines.length; i++) {
            for (const ch of lines[i]) {
                if (ch === '{') depth++;
                else if (ch === '}') depth--;
            }
            
            if (depth === 0 && i > startLine) {
                if (depth !== 0) {
                    console.log(`${funcName} (lines ${startLine+1}-${i+1}): UNBALANCED, depth=${depth}`);
                } else {
                    console.log(`${funcName} (lines ${startLine+1}-${i+1}): OK`);
                }
                break;
            }
        }
    }
}
