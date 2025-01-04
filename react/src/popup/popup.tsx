import React from 'react';
import ReactDOM from 'react-dom/client';
import './popup.css'

// Create a React element
const popup = 
<div>
    <div id="header">
      <button id="options">Options</button>
      <p id="recording">Recording...</p>
    </div>
    <div id="controls">
      <button id="start">Start</button>
      <button id="stop">Stop</button>
      <button id="clear">Clear</button>
    </div>
    <p id="transcript"></p>
</div>;

// Create a new div element and append it to the body
const doc = document.createElement('div');
document.body.appendChild(doc);

// Create a root for React using the div element
const root = ReactDOM.createRoot(doc);

// Render the React element inside the root
root.render(popup);