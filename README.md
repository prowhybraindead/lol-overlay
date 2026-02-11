# 🎮 VN Student LoL Overlay

Hệ thống overlay realtime cho giải đấu Liên Minh Huyền Thoại sinh viên Việt Nam. Hỗ trợ truy cập qua LAN, tương thích OBS, an toàn với Vanguard.

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-4.x-010101?logo=socket.io)
![License](https://img.shields.io/badge/License-MIT-blue)
![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows)

---

## ✨ Tính Năng

| Overlay        | Mô tả                                                         |
| -------------- | ------------------------------------------------------------- |
| **Scoreboard** | Tên đội, kills, vàng, timer, KDA từng người chơi, killfeed    |
| **Pick/Ban**   | Giai đoạn chọn/cấm tướng realtime với hình ảnh DataDragon     |
| **Gold Graph** | Biểu đồ chênh lệch vàng theo thời gian (Chart.js)             |
| **Minimap**    | Bản đồ nhỏ với icon tướng tại vị trí mặc định                 |
| **Branding**   | Logo trường, tên giải đấu, nhà tài trợ — tùy chỉnh qua config |

### Thêm nữa

- 🌐 **Cross-LAN** — Server bind `0.0.0.0`, tự phát hiện IP LAN, in QR code
- 🇻🇳 **Tiếng Việt** — 150+ tên tướng tiếng Việt
- 🎨 **Glassmorphism UI** — Tailwind CSS + GSAP animations
- 🛡️ **Vanguard-safe** — Chỉ dùng API polling, không đọc bộ nhớ
- 💾 **SQLite** — Lưu đội thi đấu và cấu hình

---

## 🏗️ Kiến Trúc

```
LoL Client (Spectator)
  │
  ├── LCU API ──► lcu-poller.js (Pick/Ban)
  │
  └── Live Client Data API (localhost:2999) ──► live-game.js (KDA/Gold/Events)
                                                     │
                                               server.js (Express + Socket.io)
                                                     │
                                               Overlay Pages (HTML/JS)
                                                     │
                                            OBS Browser Source / LAN Browsers
```

---

## 🚀 Bắt Đầu Nhanh

### Yêu cầu

- [Node.js 20+](https://nodejs.org/)
- League of Legends Client (đang chạy)
- [Riot API Key](https://developer.riotgames.com/) (miễn phí, cho Spectator API fallback)

### Cài đặt

```bash
# Clone repo
git clone https://github.com/your-username/VN-Student-LoL-Overlay.git
cd VN-Student-LoL-Overlay

# Cài dependencies
npm install

# Tạo file .env (sao chép từ template)
cp .env.example .env
# Sửa .env → thêm RIOT_API_KEY thật của bạn
```

### Chạy

```bash
npm start
```

Server sẽ in ra:

```
╔═══════════════════════════════════════════════════════╗
║   🎮 VN Student LoL Overlay — Server Running!       ║
╠═══════════════════════════════════════════════════════╣
║   Local:    http://localhost:3003                    ║
║   LAN:      http://192.168.x.x:3003                 ║
╠═══════════════════════════════════════════════════════╣
║   Overlays:                                         ║
║   • Scoreboard:  http://192.168.x.x:3003/           ║
║   • Pick/Ban:    http://192.168.x.x:3003/pickban    ║
║   • Gold Graph:  http://192.168.x.x:3003/gold-graph ║
║   • Minimap:     http://192.168.x.x:3003/minimap    ║
║   • Branding:    http://192.168.x.x:3003/branding   ║
╚═══════════════════════════════════════════════════════╝
```

---

## 📺 Sử Dụng Với OBS

1. Mở OBS Studio
2. **Sources** → **+** → **Browser**
3. Nhập URL overlay (ví dụ: `http://localhost:3003/`)
4. Kích thước: **1920 x 1080**
5. ✅ Bật **"Shutdown source when not visible"**
6. ✅ Bật **"Refresh browser when scene becomes active"**

> **LAN**: Máy stream khác trong cùng mạng dùng `http://<IP_LAN>:3003/` (hoặc quét QR code từ terminal)

---

## ⚙️ Tùy Chỉnh

### `config.json` — Cấu hình giải đấu

```jsonc
{
  "tournament": {
    "name": "Giải Đấu Liên Minh Sinh Viên 2026",
    "logo": "/assets/tournament-logo.png", // Đặt logo vào thư mục assets/
    "sponsors": ["HCMUS", "FPT University"],
  },
  "teams": {
    "blue": { "name": "HCMUS Esports", "tag": "HCM", "color": "#1a73e8" },
    "red": { "name": "FPT Foxes", "tag": "FPT", "color": "#e53935" },
  },
  "overlay": {
    "showTimers": true, // Baron/Dragon/Herald timers
    "showKillfeed": true, // Kill notifications
    "showGoldGraph": true, // Gold difference chart
    "locale": "vn", // Tên tướng tiếng Việt
  },
}
```

### Thay đổi đội thi đấu nhanh (API)

```bash
curl -X POST http://localhost:3003/api/teams \
  -H "Content-Type: application/json" \
  -d '{"side":"blue","name":"UIT Gamers","tag":"UIT","color":"#00695c"}'
```

### Thêm logo đội

Đặt file ảnh vào `assets/` và cập nhật đường dẫn trong `config.json`.

---

## 📁 Cấu Trúc Dự Án

```
OverlayCLI/
├── server.js              # Server chính (Express + Socket.io)
├── config.json            # Cấu hình giải đấu
├── .env                   # 🔒 API key (không push lên Git)
├── .env.example           # Template cho collaborators
├── electron-main.js       # Đóng gói Windows EXE (tùy chọn)
├── src/
│   ├── lcu-poller.js      # Polling Pick/Ban từ LCU
│   ├── live-game.js       # Polling in-game data (KDA/gold)
│   ├── db.js              # SQLite database
│   └── utils.js           # LAN IP, QR code, helpers
├── data/
│   ├── champions_vn.json  # Tên tướng tiếng Việt
│   └── teams.json         # Đội mẫu (seed database)
└── public/
    ├── index.html          # Overlay: Scoreboard
    ├── pickban.html        # Overlay: Pick/Ban
    ├── gold-graph.html     # Overlay: Gold Graph
    ├── minimap.html        # Overlay: Minimap
    ├── branding.html       # Overlay: Branding
    ├── css/overlay.css     # Styles
    └── js/
        ├── socket-client.js  # WebSocket client
        └── animations.js     # GSAP animations
```

---

## 🔌 API Endpoints

| Method | Endpoint               | Mô tả                                       |
| ------ | ---------------------- | ------------------------------------------- |
| GET    | `/api/state`           | Trạng thái hiện tại (phase, game data)      |
| GET    | `/api/config`          | Cấu hình giải đấu                           |
| GET    | `/api/info`            | LAN IP, QR code, trạng thái kết nối         |
| GET    | `/api/db/teams`        | Danh sách đội từ database                   |
| GET    | `/api/champions/vn`    | Tên tướng tiếng Việt                        |
| GET    | `/api/gold-history`    | Lịch sử vàng cho biểu đồ                    |
| GET    | `/api/ddragon/version` | Phiên bản DataDragon mới nhất               |
| POST   | `/api/teams`           | Cập nhật đội (body: side, name, tag, color) |

---

## 🔒 Bảo Mật API Key

File `.env` chứa Riot API key và **không bao giờ được push lên Git**:

```env
RIOT_API_KEY=RGAPI-your-real-key-here
PORT=3003
```

- `.gitignore` đã loại trừ `.env`, `node_modules/`, `overlay.db`
- `.env.example` là template an toàn — commit lên Git cho collaborators

---

## 🛠️ Tech Stack

| Thành phần      | Công nghệ                               |
| --------------- | --------------------------------------- |
| Backend         | Node.js, Express, Socket.io             |
| Database        | SQLite3 (better-sqlite3)                |
| LCU Integration | league-connect                          |
| In-Game Data    | Live Client Data API (`localhost:2999`) |
| Static Data     | DataDragon CDN                          |
| Frontend        | HTML5, Tailwind CSS (CDN), Vanilla JS   |
| Animations      | GSAP                                    |
| Charts          | Chart.js                                |
| QR Code         | qrcode                                  |
| Packaging       | Electron (tùy chọn)                     |

---

## ⚠️ Lưu Ý

- **LCU API** là API không chính thức — có thể thay đổi khi Riot cập nhật patch
- **Live Client Data API** chỉ hoạt động khi đang trong game hoặc spectate
- **Riot API Key (Development)** có giới hạn rate — đủ cho giải đấu nhỏ
- Hệ thống **100% Vanguard-safe** — chỉ dùng HTTP API, không can thiệp bộ nhớ

---

## 📋 Bước Tiếp Theo

- [ ] Test trong Custom Game / Practice Tool
- [ ] Thêm logo đội thật vào `assets/`
- [ ] Tùy chỉnh `config.json` cho giải đấu của bạn
- [ ] Deploy trên máy caster với PM2: `npx pm2 start server.js`
- [ ] Đóng gói EXE: `npm run electron`
- [ ] Mở rộng: thêm overlay mới, tích hợp Spectator API đầy đủ

---

## 📄 License

MIT — Tự do sử dụng cho giải đấu sinh viên! 🎓
