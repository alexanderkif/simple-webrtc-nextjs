// WebRTC connection timeouts
export const ICE_GATHERING_DELAY = 1500; // Wait for ICE candidates to be gathered
export const DATA_CHANNEL_OPEN_DELAY = 200; // Wait before sending initial state
export const MEDIA_STATE_SEND_DELAY = 50; // Debounce media state updates

// Signaling polling configuration
export const POLLING_INTERVAL = 5000; // Check for answer every 5 seconds
export const MAX_POLL_ATTEMPTS = 60; // Maximum 5 minutes (60 * 5s)
