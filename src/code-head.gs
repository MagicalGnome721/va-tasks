/**
 * ============================================================================
 *  VA Tasks — Google Apps Script backend (Code.gs)  · API version 2.0
 * ============================================================================
 *  Đồng bộ app VA Tasks (index.html) với Google Sheet "[Visual Artist] Request Assets".
 *  v2: hàng đợi order, đăng nhập bằng mã gửi qua Gmail, AI DeepSeek (tuỳ chọn),
 *      email thông báo, tự duyệt sau 3 ngày làm việc.
 *
 *  CÀI ĐẶT NHANH (xem HUONG-DAN.md để có hướng dẫn chi tiết):
 *   1. Mở Google Sheet › Extensions (Tiện ích mở rộng) › Apps Script.
 *   2. Dán toàn bộ file này vào Code.gs (thay nội dung cũ) › Lưu. Dán appsscript.json đi kèm.
 *   3. Chọn hàm `setup` › Run › cấp quyền. Hàm này: kiểm tra tab dữ liệu, thêm các cột mới
 *      còn thiếu vào CUỐI hàng 1, tạo `_Config` / `_Log`, đặt OWNER_EMAIL = tài khoản của bạn,
 *      cài tác vụ hằng ngày lúc 8h (`dailyJob`).
 *   4. Nếu sheet đang có dữ liệu v1: chọn hàm `migrateV2` › Run (một lần; chạy lại vẫn an toàn,
 *      mỗi lần chạy tạo 1 tab sao lưu `Backup_v1_yyyyMMdd_HHmm`).
 *   5. Deploy › New deployment › Web app · Execute as: Me · Who has access: Anyone.
 *   6. Copy Web app URL (…/exec) › dán vào app: Cài đặt › Kết nối.
 *
 *  SCRIPT PROPERTIES (Project Settings › Script properties):
 *   - Chủ app / quản trị viên CỐ ĐỊNH: khuonglun69@gmail.com (hằng FIXED_OWNER_EMAIL, không đổi qua Script
 *     properties). Luôn đăng nhập được, toàn quyền: thành viên, cấu hình, API key, duyệt thay người order.
 *   - GOOGLE_CLIENT_ID : OAuth Client ID cho nút "Đăng nhập bằng Google" (quản trị viên dán trong app:
 *     Cài đặt › Quản trị). Không có → chỉ đăng nhập bằng mã gửi qua Gmail.
 *   - APP_URL          : link app (vd. https://….github.io/va-tasks/) để chèn vào email thông báo.
 *   - DEEPSEEK_API_KEY : bật AI (đọc đơn, trợ lý quản lý, báo cáo tuần). Quản trị viên dán ngay trong app
 *     (Cài đặt › Quản trị) hoặc tại đây. Không có → app dùng form cố định, báo cáo tuần chỉ có số liệu.
 *   - DATA_SHEET_NAME  : (tuỳ chọn) tên tab dữ liệu nếu app chọn nhầm tab.
 *   Các key `sess_*`, `rem_*`, `aiq_*` do app tự tạo/xoá — đừng sửa tay.
 *
 *  NGUYÊN TẮC GHI DỮ LIỆU:
 *   - Đọc header ở hàng 1 mỗi lần xử lý; không dùng chỉ số cột cố định.
 *   - Chỉ ghi từng ô của trường thay đổi. KHÔNG BAO GIỜ ghi vào cột có header trống
 *     (vd. cột F), cột "Cảnh báo deadline" hay bất kỳ cột không thuộc app.
 *   - Dòng mới: sao chép công thức của các cột không thuộc app từ dòng dữ liệu cuối.
 *   - Mọi thao tác ghi chạy trong LockService (20 giây), luôn đọc lại sheet trước khi kiểm tra.
 *   - Mọi thao tác dữ liệu cần phiên đăng nhập; quyền kiểm bằng Rules.can trên dữ liệu vừa đọc lại.
 *   - Mã đăng nhập và phiên chỉ lưu dạng băm SHA-256.
 *
 *  CẬP NHẬT CODE: sửa file › Deploy › Manage deployments › ✎ Edit › Version: New version › Deploy
 *  (giữ nguyên URL cũ).
 * ============================================================================
 */

var API_VERSION = '2.1';
var FIXED_OWNER_EMAIL = 'khuonglun69@gmail.com';   // quản trị viên toàn app — KHÔNG ĐỔI
var GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo?id_token=';
var ASSIST_DAILY_LIMIT = 40;          // lượt trợ lý AI / email / ngày
var CONFIG_SHEET = '_Config';
var LOG_SHEET = '_Log';
var BACKUP_PREFIX = 'Backup_v1_';
var LOG_HEADERS = ['Thời gian', 'ID', 'Người thực hiện', 'Hành động', 'Trường', 'Giá trị cũ', 'Giá trị mới', 'Nội dung'];

var OTP_TTL_SEC = 600;               // mã đăng nhập có hiệu lực 10 phút
var OTP_MAX_TRIES = 5;               // sai 5 lần → huỷ mã
var OTP_MIN_INTERVAL_MS = 60000;     // tối đa 1 mã / 60 giây / email
var OTP_MAX_PER_HOUR = 5;            // tối đa 5 mã / giờ / email
var OTP_GLOBAL_PER_HOUR = 60;        // chặn lạm dụng hạn mức Gmail
var SESSION_DAYS = 30;
var AI_DAILY_LIMIT = 30;             // lượt aiIntake / email / ngày
var DRAFT_TTL_SEC = 3600;
var DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
var OTP_MESSAGE = 'Nếu Gmail này có trong danh sách, mã đã được gửi. Mã có hiệu lực 10 phút.';
