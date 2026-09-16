# Cờ Vua Chiến Binh — Gói bàn giao (để làm tiếp ở Cowork / Claude Code)

## 1. Đây là gì
Trang web cờ vua 1 file HTML duy nhất (`index.html`, ~137 KB) cho Ken (lớp 1) và Na (lớp 5) chơi với bạn cùng lớp.
Không cần build server; mở file là chạy. Cần internet để tải Three.js + PeerJS từ cdnjs.

Tính năng đã có:
- Hướng dẫn tiếng Việt cho lớp 1 và lớp 5 (tab "Học chơi").
- 3 chế độ: Chơi với máy (3 mức, mặc định dễ), 2 người cùng máy, Online qua mã phòng (`covua-chienbinh-XXXX`, WebRTC/PeerJS).
- Bàn cờ 3D thật (Three.js r128): xoay, zoom (nút + / − hoặc cuộn/pinch), 3 góc nhìn 2D / 3D / Ảo, phóng toàn màn hình.
- Chọn quân → mũi tên mờ chỉ nước đi hợp lệ.
- Hiệu ứng khi ăn quân: **Rượt đuổi trên bàn cờ (mặc định, không popup)** / Đấu kiếm (popup 3D) / Tắt.
- Đổi bộ quân: Cổ điển / Hoàng gia / Kẹo ngọt / Gỗ.
- Đồng hồ thi đấu (chọn phút ở trang chủ), lịch sử nước đi, undo, lật bàn.
- Chat online kèm emoji, bong bóng chat hiện trên bàn cờ.
- Ảnh Ken làm "chủ trang web" (badge ở trang chủ + favicon).
- Luật đầy đủ: nhập thành, bắt tốt qua đường, phong hậu, chiếu hết, hoà (pat, 50 nước, thiếu quân).
- Cài đặt lưu localStorage (tên, âm thanh, gợi ý, hiệu ứng, góc nhìn, bộ quân, đồng hồ).

## 2. Cấu trúc source (thư mục `src/`)
| File | Vai trò |
|---|---|
| `head.html` | HTML + toàn bộ CSS, màn hình Home / Học / Online / Game, thẻ script Three.js & PeerJS. Chỗ `__KEN__` sẽ được thay bằng ảnh Ken. |
| `engine.js` | Engine cờ (sinh nước hợp lệ, trạng thái ván, SAN, AI alpha-beta 3 mức). |
| `view3d.js` | Bàn cờ Three.js: quân 3D, camera, mũi tên, animation rượt đuổi, đấu kiếm 3D, đổi bộ quân (`SETS`). Có fallback CSS 2.5D nếu không tải được Three. |
| `app.js` | Logic ứng dụng: âm thanh, đồng hồ, chat, PeerJS online, tutorial, wiring nút bấm. |
| `ken.b64` | Ảnh Ken dạng data URI (200×200 JPEG). |
| `build.sh` | Ghép 4 file trên thành `index.html`. Chạy: `bash build.sh` |
| `mkart.py` | Tạo bản Artifact (bỏ doctype/head/body, tắt online) — chỉ dùng khi publish lên Claude Artifact. |

## 3. Việc còn lại (giao cho Cowork / Claude Code)
1. **Đưa lên web**: repo GitHub `cqv888/co-vua-chien-binh` đã tạo (public, còn trống, chỉ có README).
   - Cách nhanh nhất: `git clone` → copy `index.html` vào gốc repo → `git push`.
   - Sau đó **Vercel**: vercel.com → Add New Project → Import repo trên → Framework "Other", không cần build → Deploy. Hoặc bật GitHub Pages (Settings → Pages → branch `main`, folder `/root`) → `https://cqv888.github.io/co-vua-chien-binh/`.
   - Online chỉ chạy khi mở qua **https** (WebRTC), không chạy trong bản xem thử Artifact.
2. Nếu sửa tiếp: sửa file trong `src/`, chạy `bash build.sh`, kiểm tra `index.html` rồi push lại.

## 4. Lưu ý kỹ thuật
- Three.js/PeerJS tải từ cdnjs (có fallback unpkg cho PeerJS). Nếu muốn offline hoàn toàn, tải 2 file `three.min.js` và `peerjs.min.js` về đặt cạnh `index.html` và đổi `src` trong `head.html`.
- Mã phòng online dùng PeerJS cloud server miễn phí (0.peerjs.com); 2 máy cần cùng mở được WebRTC (mạng trường có thể chặn).
- Đã test headless (Playwright + swiftshader): engine perft đúng, render 3D, animation rượt đuổi, đổi bộ quân, chat, đồng hồ.

## 5. Cập nhật 16/09/2026
- 9 bộ quân (thêm Thuỷ tinh, Neon, Đồ chơi, Vàng–Bạc, Pha lê) — `SETS` trong `view3d.js`.
- Hiệu ứng ăn quân mặc định "Đấu kiếm" ngay trên bàn (`view.swordFight`), nút 🎬 bật/tắt nhanh.
- Nhạc nền (`Music`), đọc nước đi tiếng Việt (`Voice`) trong `app.js`.
- Kéo dọc trên bàn cờ để ngẩng/cúi camera (mọi góc nhìn, kể cả "Ảo").
- Tab "📺 Xem video": thêm video YouTube bằng cách điền mảng `VIDEOS` trong `buildLessons()` (app.js), ví dụ `{ id: 'abc123XYZ', title: 'Bài 1' }`.
- Push: máy này chưa có credential GitHub → upload qua github.com/cqv888/co-vua-chien-binh/upload/main (và /upload/main/src). Vercel tự deploy lại.
- PWA (16/09): `manifest.json`, `sw.js`, thư mục `icons/` (tạo từ logo bằng `work/icons/icon.html`). Khi đổi `index.html` nhớ tăng `VERSION` trong `sw.js` để máy bé nhận bản mới. Đóng gói Android: dán link trang vào pwabuilder.com → tải .aab → Google Play Console.
- Bàn cờ **Phẳng** (2D kiểu chess.com): `buildBoardCSS` trong `app.js` + CSS `.stage.flat2d`; góc nhìn "Phẳng" trong segView. Ăn quân ở 2D dùng màn So kiếm (popup) vì không có hoạt cảnh trên bàn.
- **Supabase** (`src/cloud.js`): URL + publishable key nằm trong file (an toàn, RLS bảo vệ). Bảng `profiles` — tạo bằng `supabase/schema.sql` trong SQL Editor (chạy 1 lần). Bố mẹ đăng nhập email+mật khẩu (Supabase Auth); mỗi bé 1 hồ sơ + PIN (băm SHA-256 phía trình duyệt); `data` jsonb lưu games/wins theo level/lastLevel/settings/history. Cài đặt đồng bộ qua `store.set` → `Cloud.queueSetting`.
- Nếu muốn bỏ bước xác nhận email khi tạo tài khoản: Supabase → Authentication → Providers → Email → tắt "Confirm email".
