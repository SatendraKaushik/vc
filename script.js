const startCallButton = document.getElementById('startCall');
const endCallButton = document.getElementById('endCall');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

let localStream;
let peerConnection;
const configuration = { 'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }] };
const signalingServerUrl = 'wss://videocalling-1nud.onrender.com/';
const signalingServer = new WebSocket(signalingServerUrl);

signalingServer.onopen = () => {
    console.log('WebSocket connection established');
};

signalingServer.onclose = () => {
    console.log('WebSocket connection closed');
};

signalingServer.onerror = (error) => {
    console.error('WebSocket error:', error);
};

startCallButton.addEventListener('click', async () => {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;

        peerConnection = new RTCPeerConnection(configuration);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                signalingServer.send(JSON.stringify({ candidate: event.candidate }));
            }
        };

        peerConnection.ontrack = event => {
            console.log('Received remote track:', event.streams[0]);
            remoteVideo.srcObject = event.streams[0];
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        signalingServer.send(JSON.stringify({ offer }));
    } catch (error) {
        console.error('Error accessing media devices or starting call:', error);
    }
});

endCallButton.addEventListener('click', () => {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localVideo.srcObject = null;
        remoteVideo.srcObject = null;
    }
});

signalingServer.onmessage = async (message) => {
    try {
        // Convert Blob to text if the message is a Blob
        if (message.data instanceof Blob) {
            const text = await message.data.text();
            const data = JSON.parse(text);
            console.log('Received signaling message:', data);

            if (!peerConnection) {
                peerConnection = new RTCPeerConnection(configuration);
                peerConnection.onicecandidate = event => {
                    if (event.candidate) {
                        signalingServer.send(JSON.stringify({ candidate: event.candidate }));
                    }
                };
                peerConnection.ontrack = event => {
                    console.log('Received remote track:', event.streams[0]);
                    remoteVideo.srcObject = event.streams[0];
                };
            }

            if (data.offer) {
                if (peerConnection.signalingState === 'stable') {
                    peerConnection.close();
                    peerConnection = new RTCPeerConnection(configuration);
                    peerConnection.onicecandidate = event => {
                        if (event.candidate) {
                            signalingServer.send(JSON.stringify({ candidate: event.candidate }));
                        }
                    };
                    peerConnection.ontrack = event => {
                        console.log('Received remote track:', event.streams[0]);
                        remoteVideo.srcObject = event.streams[0];
                    };
                }
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                signalingServer.send(JSON.stringify({ answer }));
            } else if (data.answer) {
                if (peerConnection.signalingState !== 'stable') {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                }
            } else if (data.candidate) {
                if (peerConnection.remoteDescription) {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                }
            }
        } else {
            console.error('Received non-Blob message:', message.data);
        }
    } catch (error) {
        console.error('Error handling signaling message:', error);
    }
};
