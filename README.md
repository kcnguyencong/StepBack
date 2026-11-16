# AXVYRA — Rebuild. Rise. Return.

**AXVYRA** là ứng dụng di động (Mobile-First Web App / PWA) đồng hành cùng bệnh nhân phục hồi chức năng chuyên sâu sau phẫu thuật **Tái tạo Dây chằng chéo trước (ACL)** và **Phẫu thuật Sụn chêm (Meniscus Repair & Meniscectomy)** chuẩn Y khoa.

---

## 🌟 Tính Năng Cốt Lõi V1 (P0 Complete)

1. **Home — Trang Chủ (Recovery Journey Dashboard)**:
   - Header hình ảnh 3D khớp gối Holographic y khoa, lời chào bệnh nhân & bối cảnh phục hồi.
   - Hiển thị ngày/tuần hậu phẫu, giai đoạn phục hồi lâm sàng và mục tiêu kế tiếp.
   - Thẻ bài tập được chỉ định hôm nay (Today's Assigned Session).
   - Tóm tắt tiến độ ROM và nhật ký đau/sưng gần nhất.
   - Đồng hồ **Chườm đá an toàn 15 phút** (R.I.C.E Protocol).
   - Nút ghi nhận nhanh triệu chứng hàng ngày.

2. **Plan — Kế Hoạch Bài Tập (Assigned Rehabilitation Plan)**:
   - Lịch tập theo tuần/ngày được chỉ định theo từng giai đoạn phẫu thuật.
   - Danh sách bài tập có số hiệp (Sets), lần lặp (Reps), thời gian gồng giữ (Hold) và thời gian nghỉ (Rest).
   - **Workout Player toàn màn hình**:
     - Âm thanh beep nhịp điệu (Web Audio API).
     - Khẩu lệnh giọng nói tiếng Việt (Web Speech API).
     - Giữ sáng màn hình thiết bị (Screen Wake Lock API).
   - **Đánh giá sau buổi tập (Session Feedback Modal)**:
     - Thang điểm gắng sức RPE (1-10).
     - Thang điểm đau khi tập VAS (1-10).
     - Ghi chú cảm giác của bệnh nhân lưu vào lịch sử ca phục hồi.

3. **Progress — Tiến Độ & Đo Góc Gối AI**:
   - **Đo góc gối bằng Camera AI (MediaPipe PoseLandmarker Lite)**:
     - Nhận diện 3 mốc khớp: Háng (Hip) — Gối (Knee) — Cổ chân (Ankle).
     - Đo góc gập/duỗi thời gian thực, đổi màu xanh ngọc (An toàn) / đỏ nhấp nháy cảnh báo khi vượt giới hạn an toàn.
     - Chế độ tải ảnh gối đo tĩnh (Photo Fallback).
   - Danh sách cột mốc lâm sàng (Milestone Timeline) với trạng thái `NOT_STARTED`, `IN_PROGRESS`, `AWAITING_ASSESSMENT`, `CONFIRMED`.
   - Lịch sử đo góc gối ROM thực tế.

4. **Explore — Khám Phá & Kiến Thức Y Khoa**:
   - Cẩm nang phục hồi sau mổ: Bảo vệ mối khâu sụn chêm trong 6 tuần, tầm quan trọng của độ duỗi 0°, dinh dưỡng tái tạo collagen, quy tắc chườm đá lạnh.
   - Thanh tìm kiếm bài viết và bộ lọc danh mục.
   - Cảnh báo các dấu hiệu nguy hiểm (sốt, sưng nóng đỏ đau, huyết khối tĩnh mạch sâu DVT) cần liên hệ bác sĩ ngay.

---

## 🚀 Hướng Dẫn Đưa Lên GitHub & Deploy Vercel

### Bước 1: Khởi tạo Git và đẩy lên GitHub
Sau khi anh tạo Repository mới trên GitHub (ví dụ: `axvyra`):

```bash
git init
git add .
git commit -m "feat: complete AXVYRA V1 mobile rehabilitation application"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

### Bước 2: Deploy lên Vercel trong 1 Click
1. Truy cập [Vercel Dashboard](https://vercel.com) $\rightarrow$ Nhấn **Add New Project**.
2. Chọn Repository GitHub vừa tạo.
3. Vercel sẽ tự động phát hiện Next.js.
4. Nhấn **Deploy**.

---

## 🗄️ Tích Hợp Neon Serverless PostgreSQL

AXVYRA đã được cấu trúc sẵn file Prisma Schema tại `prisma/schema.prisma` khớp 100% với đặc tả y tế:
- Tách rời mẫu phác đồ (`RecoveryProtocol`, `ProtocolVersion`) với kế hoạch thực tế của bệnh nhân (`PatientRecoveryPlan`).
- Quản lý trạng thái cột mốc, buổi tập, phản hồi RPE, đo góc gối ROM, nhật ký và Audit Log.

### Kết nối Neon với Vercel:
1. Tạo một cơ sở dữ liệu Postgres miễn phí tại [Neon.tech](https://neon.tech) (hoặc chọn tab **Storage** $\rightarrow$ **Postgres** ngay trên Vercel).
2. Sao chép chuỗi kết nối `DATABASE_URL`.
3. Trong phần **Settings $\rightarrow$ Environment Variables** trên Vercel, thêm biến:
   ```env
   DATABASE_URL="postgresql://user:password@ep-sample-pooler.us-east-2.aws.neon.tech/axvyra_db?sslmode=require"
   ```
4. Chạy migration tạo bảng:
   ```bash
   npx prisma db push
   ```

---

## 🛠️ Chạy Thử Ở Môi Trường Local

```bash
npm run dev
# Mở trình duyệt tại: http://localhost:3005
```
