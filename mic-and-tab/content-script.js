// navigator.mediaDevices.getUserMedia({ audio: true })
//     .then(stream => {
//         // Microphone access granted
//         stream.getTracks().forEach(track => track.stop()); // Stop the stream as we don't need it now
//         console.log('Microphone access granted');
//     })
//     .catch(err => {
//         console.error('Error accessing microphone:', err);
//     });