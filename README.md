# Simple WebRTC Video Chat

Simple peer-to-peer video calling application using WebRTC, Next.js 16 and Vercel KV.

## ✨ Features

- 🎥 **Video and audio** chat between two users
- 🆔 **Smart connection** - enter a shared ID or create a new one
- 🔗 **Invitation links** - or just agree on an ID
- 🎯 **Click on video** - instant fullscreen mode
- 🔄 **Camera switching** - front/back with one click
- 🔇 **Microphone and camera controls** - turn on/off
- 📹 **Audio-only mode** - auto-fallback if camera unavailable
- 🖥️ **Fullscreen mode** with convenient round buttons
- 🔒 **P2P connection** - direct communication without intermediaries
- 🌐 **TURN fallback** - works even behind NAT and firewalls
- ⚡ **Fast signaling** via Redis (Vercel KV)
- 💾 **Persistent ID** - your link is saved in the browser
- 📱 **Responsive design** - works on any device

## 🚀 Technologies

- **Next.js 16** with App Router and Edge Runtime
- **WebRTC** - P2P video/audio communication via Google STUN
- **Vercel KV (Upstash Redis)** - signaling server
- **TypeScript** - strict typing
- **Tailwind CSS 4** - modern design

## 📦 Quick Start

### 1. Installation

\`\`\`bash
npm install
\`\`\`

### 2. Redis Setup via Vercel Marketplace

**IMPORTANT:** Use only **Upstash Redis** from Marketplace!

#### For local development:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Create a new project (or select an existing one)
3. Open [Vercel Marketplace → Upstash Redis](https://vercel.com/integrations/upstash)
4. Click **Add Integration**
5. Authorize in Upstash (or create a free account)
6. Create a new Redis database
7. Select a region (recommended close to you)
8. Connect to your project
9. Go to **Settings → Environment Variables** of the project
10. Copy three variables:
   - \`KV_REST_API_URL\`
   - \`KV_REST_API_TOKEN\`
   - \`KV_REST_API_READ_ONLY_TOKEN\`

### 3. Create .env.local

Create a `.env.local` file in the project root:

\`\`\`bash
KV_REST_API_URL=https://your-database.upstash.io
KV_REST_API_TOKEN=your_token
KV_REST_API_READ_ONLY_TOKEN=your_readonly_token
\`\`\`

### 4. Run

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000)

## 🌐 Deploy on Vercel

### Quick Deploy

\`\`\`bash
npm i -g vercel
vercel login
vercel
\`\`\`

### Database Setup

1. Open [Vercel Marketplace → Upstash Redis](https://vercel.com/integrations/upstash)
2. Click **Add Integration**
3. Select your project
4. Upstash will automatically add environment variables

### Production Deploy

\`\`\`bash
vercel --prod
\`\`\`

## 🎮 How to Use

### Option 1: By Shared ID (simpler)

**Both users:**
1. Open the application
2. Enter the same room identifier (e.g., `my-room` or `team_meeting`)
   - Use only: a-z, 0-9, hyphen (-), underscore (_)
3. Click **"Start Call"**
4. First user creates the room and waits, second user automatically joins

💡 **Tip:** Agree on an ID in advance - and just enter it both.

### Option 2: By Link (classic)

**First user:**
1. Open the application
2. **(Optional)** Enter your identifier or leave empty for random
3. Click **"Start Call"**
4. Allow access to camera and microphone
5. Copy the link with **"Copy Link"** button
6. Send the link to your friend

**Second user:**
1. Open the link from your friend (ID will be filled automatically)
2. Click **"Start Call"**
3. Allow access to camera/microphone
4. Connect automatically!

💡 **Tip:** Your ID is saved in the browser and always stays the same.

### During the call:

- 🖱️ **Click on video** → fullscreen mode with that video
- 🔄 **Click in fullscreen** → switch between your video and peer's
- 🔁 **Button in fullscreen** → switch front/back camera
- 🔇 **Microphone** → mute/unmute sound
- 📹 **Camera** → temporarily turn off/on video
- ⛶ **Fullscreen** → enter/exit fullscreen
- ☎️ **End** → finish the call

## 🏗️ Architecture

### WebRTC Flow

\`\`\`
User 1                   Redis (KV)           User 2
     |                        |                        |
     |-- Create offer ------->|                        |
     |   (+ ICE candidates)   |                        |
     |                        |<--- Get offer ---------| 
     |                        |                        |
     |                        |<--- Send answer -------| 
     |<-- Get answer ---------|   (+ ICE candidates)   |
     |    (polling 5 sec)     |                        |
     |                        |                        |
     |<-------------- P2P connection established ------>|
     |                        |                        |
     |-- Delete data -------->|                        |
\`\`\`

### API Routes (Edge Runtime)

- `POST /api/signaling/create` - Create offer
- `GET /api/signaling/get` - Get offer  
- `POST /api/signaling/answer` - Save answer
- `GET /api/signaling/get-answer` - Get answer + auto-delete
- `DELETE /api/signaling/delete` - Delete room

### Components

- **VideoChat.tsx** - main WebRTC logic
- **VideoWindow.tsx** - video display (normal/fullscreen mode)
- **WaitingRoom.tsx** - waiting screen with link
- **CallControls.tsx** - control buttons (normal mode)
- **FullscreenControls.tsx** - round buttons (fullscreen)

## 🔧 Technical Details

### Optimizations

- ⚡ **Polling 5 seconds** instead of 1 (3x fewer requests)
- 💾 **localStorage** for persistent room ID
- 🎯 **Edge Runtime** for minimal latency
- 🗑️ **Auto-delete** data after connection
- 🔄 **One video element** per stream (avoid duplication)
- 📝 **Input filtering** - automatic blocking of invalid characters

### STUN/TURN Servers (with TCP/TLS fallback)

Cascading configuration is used for maximum compatibility:

**Primary (UDP):**
- `stun:stun.l.google.com:19302` - Google STUN (fast)
- `stun:stun1.l.google.com:19302` - Google STUN backup

**Fallback (TCP/TLS via TURN):**
- `turn:openrelay.metered.ca:80` - TURN UDP
- `turn:openrelay.metered.ca:443` - TURN TCP
- `turns:openrelay.metered.ca:443?transport=tcp` - TURN TLS/443 (works everywhere!)

💡 **Why this matters:**
- UDP is blocked by many providers and corporate networks
- TCP/TLS on port 443 passes as regular HTTPS traffic
- Automatic fallback: UDP → TCP → TLS
- Free TURN server from [Open Relay Project](https://www.metered.ca/tools/openrelay/)

🔒 **Security:**
- TLS encryption for TURN connections
- Public credentials (safe for public use)

### TTL in Redis

- **Offer**: 5 minutes
- **Answer**: 1 minute
- After connection: immediate deletion

## 🎨 UI/UX Features

- **Dark theme** with gradients
- **ID input field** - with automatic character filtering
- **Real-time hints** - see allowed characters
- **SVG icons** in unified style (white on colored buttons)
- **Hover effects** - blue ring on video hover
- **Fullscreen hint** - "Click on video to switch"
- **Responsive design** - from mobile to desktop
- **Smooth transitions** and animations

## ⚠️ Known Limitations

- Only **2 users** per room (P2P architecture)
- Requires **HTTPS** (production) or localhost
- **iOS Safari** requires user interaction before getUserMedia

### ✅ Solved via TURN fallback:

- ~~May not work through corporate firewalls~~ → **Works!** (TCP on 3478)
- ~~May not work behind symmetric NAT~~ → **Works!** (TURN relay)

## 🚀 Possible Improvements

- [ ] WebSocket instead of polling
- [ ] Support for 3+ participants (SFU)
- [ ] Text chat
- [ ] Screen sharing
- [ ] Virtual backgrounds
- [ ] Call recording
- [ ] Mobile applications

## 📱 Supported Browsers

- ✅ Chrome/Edge (Desktop & Mobile)
- ✅ Firefox (Desktop & Mobile)  
- ✅ Safari (Desktop & Mobile)
- ✅ Opera (Desktop)

## 🐛 Troubleshooting

### Video not working
- Check HTTPS (or use localhost)
- Allow access to camera/microphone
- Check browser console

### Can't hear the other person
- Check that microphone is enabled (not crossed out)
- Increase volume
- Check sound settings in system

### "Room not found" error
- Room doesn't exist - create it first
- Or room was deleted (TTL expired or someone already connected)
- Just click "Start Call" again

### Connection not establishing

**Symptoms:** Endless "Connecting..." or "ICE failed"

**Solution:**
1. ✅ **TURN fallback already enabled** - should work automatically
2. Open browser console (F12) and look at ICE candidates
3. If you see only `relay` candidates - TURN is being used (normal)
4. If you see `failed` - check:
   - Internet connection is stable
   - Antivirus is not blocking WebRTC
   - Try a different browser

**Diagnostics:**
\`\`\`javascript
// In browser console
pc.getStats().then(stats => {
  stats.forEach(report => {
    if (report.type === 'candidate-pair' && report.state === 'succeeded') {
      console.log('Active connection type:', report);
    }
  });
});
\`\`\`

### Database not working
- Check environment variables
- Make sure you're using Upstash Redis from Marketplace
- Check logs in Vercel Dashboard

## 📄 License

MIT

---

Made with ❤️ using WebRTC and Next.js 16
