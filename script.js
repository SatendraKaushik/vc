const startCallButton = document.getElementById('startCall');
const endCallButton = document.getElementById('endCall');
const joinMeetingButton = document.getElementById('joinMeeting');
const meetingIdInput = document.getElementById('meetingIdInput');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

let localStream;
let peerConnection;
let signalingServer;
let meetingId = null;
const configuration = { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }] };

function setupWebSocket() {
    if (signalingServer) {
        signalingServer.close();
    }

    signalingServer = new WebSocket('wss://videocalling-1nud.onrender.com/');

    signalingServer.onopen = () => {
        console.log('WebSocket connection established');
    };

    signalingServer.onclose = () => {
        console.log('WebSocket connection closed');
    };

    signalingServer.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    signalingServer.onmessage = async (message) => {
        if (message.data instanceof Blob) {
            const text = await message.data.text();
            const data = JSON.parse(text);
            console.log('Received signaling message:', data);

            if (!peerConnection && data.offer) {
                console.log('Creating new RTCPeerConnection');
                peerConnection = new RTCPeerConnection(configuration);
                peerConnection.onicecandidate = event => {
                    if (event.candidate) {
                        signalingServer.send(JSON.stringify({ meetingId, candidate: event.candidate }));
                    }
                };
                peerConnection.ontrack = event => {
                    remoteVideo.srcObject = event.streams[0];
                };
            }

            if (data.offer) {
                if (peerConnection.signalingState === 'stable') {
                    console.log('Closing existing peer connection');
                    peerConnection.close();
                    peerConnection = new RTCPeerConnection(configuration);
                    peerConnection.onicecandidate = event => {
                        if (event.candidate) {
                            signalingServer.send(JSON.stringify({ meetingId, candidate: event.candidate }));
                        }
                    };
                    peerConnection.ontrack = event => {
                        remoteVideo.srcObject = event.streams[0];
                    };
                }
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                signalingServer.send(JSON.stringify({ meetingId, answer }));
            } else if (data.answer) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            } else if (data.candidate) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        } else {
            console.error('Received non-Blob message:', message.data);
        }
    };
}

startCallButton.addEventListener('click', async () => {
    if (!meetingId) {
        console.warn('Meeting ID not set');
        return;
    }

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;

        peerConnection = new RTCPeerConnection(configuration);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                signalingServer.send(JSON.stringify({ meetingId, candidate: event.candidate }));
            }
        };

        peerConnection.ontrack = event => {
            remoteVideo.srcObject = event.streams[0];
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        signalingServer.send(JSON.stringify({ meetingId, offer }));

        console.log('Call started');
    } catch (error) {
        console.error('Error starting call:', error);
    }
});

endCallButton.addEventListener('click', () => {
    if (!peerConnection) {
        console.warn('No active call to end');
        return;
    }

    try {
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localVideo.srcObject = null;
            remoteVideo.srcObject = null;
        }

        console.log('Call ended');
    } catch (error) {
        console.error('Error ending call:', error);
    }
});

joinMeetingButton.addEventListener('click', () => {
    meetingId = meetingIdInput.value.trim();
    if (!meetingId) {
        console.warn('Meeting ID is empty');
        return;
    }

    setupWebSocket();
});
