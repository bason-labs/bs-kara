import type { Genre } from '../youtube/types';

// Curated pools per Vietnamese karaoke genre. The auto-random picker
// chooses a pool based on the active `genre` filter and combines the
// title with type/tone keywords to build a YouTube search query.
// `POPULAR_KARAOKE_SONGS` doubles as the "Nhạc trẻ" (modern pop) pool.
export const POPULAR_KARAOKE_SONGS: string[] = [
  'Lệ Lưu Ly',
  'Cắt Đôi Nỗi Sầu',
  'Nơi Tình Yêu Bắt Đầu',
  'Lạc Trôi',
  'Vợ Người Ta',
  'Em Của Ngày Hôm Qua',
  'Người Lạ Ơi',
  'Buồn Của Anh',
  'Sóng Gió',
  'Hồng Nhan',
  'Bạc Phận',
  'Duyên Âm',
  'Chạy Ngay Đi',
  'Đừng Như Thói Quen',
  'Ai Chung Tình Được Mãi',
  'Sài Gòn Đau Lòng Quá',
  'Có Chàng Trai Viết Lên Cây',
  'Nắng Ấm Xa Dần',
  'Con Bướm Xuân',
  'Vì Anh Thương Em',
  'Vì Yêu Mà Đến',
  'Người Hãy Quên Em Đi',
  'Anh Cứ Đi Đi',
  'Phía Sau Một Cô Gái',
  'Nắm',
  'Ghen',
  'Em Gái Mưa',
  'Đi Để Trở Về',
  'Nơi Này Có Anh',
  'Thằng Hầu',
  'Hoa Nở Không Màu',
  'Sau Tất Cả',
  'Yêu Một Người Vô Tâm',
  'Để Cho Em Khóc',
  'Mình Yêu Nhau Đi',
  'Thê Lương',
  'Đường Tôi Chở Em Về',
  'Tình Bạn Diệu Kỳ',
  'Đừng Hỏi Em',
  'Một Bước Yêu Vạn Dặm Đau',
  'Đếm Ngày Xa Em',
  'Giá Như Em Là',
  'Anh Thanh Niên',
  'Gặp May',
  'Hai Triệu Năm',
  'Thương Em Là Điều Anh Không Thể Ngờ',
  'Buông Đôi Tay Nhau Ra',
  'Yêu Là Cưới',
  'Bống Bống Bang Bang',
];

// Bolero / nhạc trữ tình classics. Many uploaders explicitly tag titles
// with "Bolero" so adding it to the search query reinforces the genre.
export const BOLERO_SONGS: string[] = [
  'Đắp Mộ Cuộc Tình',
  'Sương Lạnh Chiều Đông',
  'Vùng Lá Me Bay',
  'Hoa Sứ Nhà Nàng',
  'Phố Đêm',
  'Đêm Buồn Tỉnh Lẻ',
  'Sầu Tím Thiệp Hồng',
  'Chuyến Tàu Hoàng Hôn',
  'Nỗi Buồn Hoa Phượng',
  'Định Mệnh',
  'Áo Cưới Màu Hoa Cà',
  'Lan Và Điệp',
  'Thành Phố Buồn',
  'Đoạn Buồn Đêm Mưa',
  'Tâm Sự Đời Tôi',
  'Mưa Chiều Kỷ Niệm',
  'Tình Lỡ',
  'Hoa Trinh Nữ',
  'Đêm Tâm Sự',
  'Vọng Cổ Buồn',
  'Đêm Lang Thang',
  'Căn Nhà Màu Tím',
];

// Vọng cổ / cải lương — traditional southern Vietnamese theatrical music.
// These titles surface ca cổ uploads reliably when paired with "ca cổ" or
// "vọng cổ" in the query.
export const CA_CO_SONGS: string[] = [
  'Tình Anh Bán Chiếu',
  'Võ Đông Sơ Bạch Thu Hà',
  'Mưa Rừng',
  'Nửa Đời Hương Phấn',
  'Đêm Lạnh Chùa Hoang',
  'Tô Ánh Nguyệt',
  'Áo Tình Đắp Mộ Người Yêu',
  'Lương Sơn Bá Chúc Anh Đài',
  'Trọng Thuỷ Mỵ Châu',
  'Lá Trầu Xanh',
  'Sầu Vương Ý Nhạc',
  'Người Yêu Cô Đơn',
  'Tâm Sự Loài Chim Biển',
  'Sương Trắng Miền Quê Ngoại',
  'Chiếc Áo Bà Ba',
];

// Returns the pool to draw random titles from, based on the active genre
// filter. "All" merges every genre so the auto-picker explores broadly.
export function getSongPool(genre: Genre): string[] {
  switch (genre) {
    case 'bolero':
      return BOLERO_SONGS;
    case 'caco':
      return CA_CO_SONGS;
    case 'tre':
      return POPULAR_KARAOKE_SONGS;
    case 'all':
    default:
      return [...POPULAR_KARAOKE_SONGS, ...BOLERO_SONGS, ...CA_CO_SONGS];
  }
}
