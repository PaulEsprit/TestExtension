import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";

const Welcome: React.FC = () => {
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        // Microphone access granted
        stream.getTracks().forEach(track => track.stop()); // Stop the stream as we don't need it now
        console.log('Microphone access granted');
      })
      .catch(err => {
        console.error('Error accessing microphone:', err);
      });
  }, []);

  return (
    <div>
      <h1>Welcome to Meet Track AI</h1>
      <p>Please allow microphone access to use this extension.</p>
    </div>
  );
};

const container = document.createElement("div");
document.body.appendChild(container);
const root = ReactDOM.createRoot(container);
root.render(<Welcome />);