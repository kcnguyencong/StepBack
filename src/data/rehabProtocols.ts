export type SurgeryType = 'ACL_ONLY' | 'ACL_MENISCUS_REPAIR' | 'ACL_MENISCUS_TRIM';
export type AgeGroup = 'UNDER_30' | 'AGE_31_45' | 'OVER_45';

export interface Exercise {
  id: string;
  name: string;
  englishName: string;
  phase: 1 | 2 | 3 | 4;
  holdSeconds: number;
  restSeconds: number;
  reps: number;
  sets: number;
  frequencyPerDay: number;
  targetGoal: string;
  instructions: string[];
  contraindications?: string;
  medicalSource: string;
  allowedSurgeries: SurgeryType[];
  excludedAgeGroups?: AgeGroup[];
  startTiming?: string; // Thời điểm bắt đầu an toàn sau phẫu thuật (VD: Ngày 1 sau mổ, Tuần 3...)

  // Compatibility fields for existing player / UI
  vietnameseName?: string;
  targetSets: number;
  targetReps: number;
  holdSec: number;
  restSec: number;
  safetyWarning?: string;
  description?: string;
  maxFlexionAngle?: number;
}

export interface PhaseRule {
  phase: 1 | 2 | 3 | 4;
  phaseNumber?: 1 | 2 | 3 | 4;
  title: string;
  weekRange: [number, number];
  durationDays?: number;
  daysRange?: [number, number];
  daysLabel?: string;
  maxFlexionAngle: Record<SurgeryType, number>;
  weightBearingStatus: Record<SurgeryType, string>;
  braceRule: Record<SurgeryType, string>;
  milestoneCriteria: string[];
  redFlags: string[];

  // Compatibility fields
  minWeeks?: number;
  maxWeeks?: number;
  weeksRange?: string;
  subtitle?: string;
  goals?: string[];
  precautions?: string[];
  forbiddenActions?: string[];
}

export const PHASE_RULES: PhaseRule[] = [
  {
    phase: 1,
    title: 'Giai đoạn 1: Kiểm soát sưng đau & Đánh thức cơ đùi',
    weekRange: [1, 2],
    durationDays: 14,
    daysRange: [1, 14],
    daysLabel: '14 ngày (Ngày 1 – 14 sau mổ)',
    maxFlexionAngle: {
      ACL_ONLY: 90,
      ACL_MENISCUS_REPAIR: 90,
      ACL_MENISCUS_TRIM: 90,
    },
    weightBearingStatus: {
      ACL_ONLY: 'Chống chân chịu lực một phần với 2 nạng (tùy mức độ đau)',
      ACL_MENISCUS_REPAIR: 'KHÔNG chống chân chịu lực (Non-weight bearing) - Đi 2 nạng hoàn toàn',
      ACL_MENISCUS_TRIM: 'Chống chân chịu lực một phần với 2 nạng theo khả năng chịu đựng',
    },
    braceRule: {
      ACL_ONLY: 'Đeo nẹp khóa thẳng 0° khi đi lại và khi ngủ',
      ACL_MENISCUS_REPAIR: 'Bắt buộc đeo nẹp khóa thẳng 0° liên tục 24/24 (chỉ tháo khi tập gập gối thụ động)',
      ACL_MENISCUS_TRIM: 'Đeo nẹp khóa thẳng 0° khi di chuyển',
    },
    milestoneCriteria: [
      'Duỗi thẳng khớp gối hoàn toàn đạt 0° (bằng chân lành)',
      'Gập gối đạt tối thiểu 70° - 90° không đau nhói',
      'Cơ tứ đầu đùi co tốt, thực hiện được nâng chân thẳng không bị rớt gối (No extensor lag)',
    ],
    redFlags: [
      'Sốt trên 38°C, vết mổ tấy đỏ, chảy dịch đục hoặc mùi hôi',
      'Bắp chân sưng to, căng cứng và đau nhức dữ dội khi gập cổ chân (nghi ngờ huyết khối tĩnh mạch sâu)',
      'Gối sưng phồng đột ngột và nóng rực sau buổi tập',
    ],
  },
  {
    phase: 2,
    title: 'Giai đoạn 2: Phục hồi biên độ vận động & Bỏ nạng',
    weekRange: [3, 6],
    durationDays: 28,
    daysRange: [15, 42],
    daysLabel: '28 ngày (Ngày 15 – 42 sau mổ)',
    maxFlexionAngle: {
      ACL_ONLY: 125,
      ACL_MENISCUS_REPAIR: 90,
      ACL_MENISCUS_TRIM: 125,
    },
    weightBearingStatus: {
      ACL_ONLY: 'Tăng dần trọng lực, tập bỏ nạng vào cuối tuần 4 nếu đi không khập khiễng',
      ACL_MENISCUS_REPAIR: 'Tiếp tục đi 2 nạng không tỳ lực hết tuần 4; tuần 5-6 bắt đầu chạm mũi chân nhẹ (Toe-touch)',
      ACL_MENISCUS_TRIM: 'Chịu lực hoàn toàn (Full weight-bearing), có thể bỏ nạng từ tuần 3-4',
    },
    braceRule: {
      ACL_ONLY: 'Mở khóa nẹp 0° - 90° khi đi lại; có thể bỏ nẹp vào tuần 4-6 theo chỉ định bác sĩ',
      ACL_MENISCUS_REPAIR: 'Giữ nẹp khóa thẳng 0° khi đi nạng; chỉ mở khóa 0°-90° khi ngồi tập',
      ACL_MENISCUS_TRIM: 'Bỏ nẹp dần khi kiểm soát tốt cơ đùi và không còn khập khiễng',
    },
    milestoneCriteria: [
      'Duy trì duỗi thẳng 0° ổn định',
      'Gập gối đạt 120°+ (với ACL đơn thuần) hoặc đủ 90° êm ái (với khâu sụn chêm)',
      'Đi bộ dáng bình thường, không tập tễnh (áp dụng cho nhóm được phép chống chân)',
    ],
    redFlags: [
      'Tiếng kêu "lục cục" kèm kẹt khớp cơ học (không thể duỗi hoặc gập tiếp)',
      'Đau nhói buốt tại khe khớp trong/ngoài (vị trí khâu sụn chêm)',
    ],
  },
  {
    phase: 3,
    title: 'Giai đoạn 3: Tăng cường sức mạnh cơ & Thăng bằng',
    weekRange: [7, 12],
    durationDays: 42,
    daysRange: [43, 84],
    daysLabel: '42 ngày (Ngày 43 – 84 sau mổ)',
    maxFlexionAngle: {
      ACL_ONLY: 135,
      ACL_MENISCUS_REPAIR: 125,
      ACL_MENISCUS_TRIM: 135,
    },
    weightBearingStatus: {
      ACL_ONLY: 'Đi lại bình thường hoàn toàn, leo cầu thang từng bậc',
      ACL_MENISCUS_REPAIR: 'Tập chịu lực tăng dần từ 50% lên 100% trong tuần 7-8, bỏ nạng hoàn toàn vào tuần 8',
      ACL_MENISCUS_TRIM: 'Sinh hoạt đi lại bình thường hoàn toàn',
    },
    braceRule: {
      ACL_ONLY: 'Không cần đeo nẹp trong sinh hoạt hàng ngày',
      ACL_MENISCUS_REPAIR: 'Bỏ nẹp hoàn toàn khi đã đi bộ vững vàng không đau',
      ACL_MENISCUS_TRIM: 'Không cần đeo nẹp',
    },
    milestoneCriteria: [
      'Biên độ gập gối đạt 130° - 135° (gần bằng chân lành)',
      'Đứng thăng bằng 1 chân mổ vững vàng trong 30 giây không rung lắc',
      'Bước lên/xuống bục cao 15cm kiểm soát tốt trục đầu gối (gối không đổ vào trong)',
    ],
    redFlags: [
      'Đầu gối có cảm giác lỏng lẻo, trượt khớp (Giving way) khi xoay người nhẹ',
      'Đau mặt trước khớp gối (đau gân bánh chè) kéo dài trên 24 giờ sau tập',
    ],
  },
  {
    phase: 4,
    title: 'Giai đoạn 4: Phục hồi sức bền & Chạy bộ cơ bản',
    weekRange: [13, 24],
    durationDays: 28,
    daysRange: [85, 112],
    daysLabel: '28+ ngày (Ngày 85 – 112+ sau mổ)',
    maxFlexionAngle: {
      ACL_ONLY: 145,
      ACL_MENISCUS_REPAIR: 135,
      ACL_MENISCUS_TRIM: 145,
    },
    weightBearingStatus: {
      ACL_ONLY: 'Tập chạy bộ đường thẳng (Jogging) từ tuần 14-16 nếu sức cơ đạt >= 80% chân lành',
      ACL_MENISCUS_REPAIR: 'Tránh ngồi xổm sâu (Deep Squat) chịu tải nặng đến hết tháng thứ 4; chạy bộ nhẹ từ tuần 16',
      ACL_MENISCUS_TRIM: 'Tập chạy bộ đường thẳng từ tuần 12-14',
    },
    braceRule: {
      ACL_ONLY: 'Không đeo nẹp',
      ACL_MENISCUS_REPAIR: 'Không đeo nẹp',
      ACL_MENISCUS_TRIM: 'Không đeo nẹp',
    },
    milestoneCriteria: [
      'Sức mạnh cơ tứ đầu và cơ gân kheo đạt >= 85% so với chân lành',
      'Chạy bộ đường thẳng 15-20 phút không sưng, không đau khớp gối',
      'Sẵn sàng bước vào giai đoạn tập chuyển hướng & trở lại thể thao (Tháng 6 - 9)',
    ],
    redFlags: [
      'Khớp gối tràn dịch sau mỗi buổi chạy bộ nhẹ',
      'Đau nhói vùng khe khớp khi thực hiện động tác Squat nông',
    ],
  },
];

export const REHAB_EXERCISES: Exercise[] = [
  {
    id: 'ex-ankle-pumps',
    name: 'Bơm cổ chân (Gập duỗi bàn chân)',
    englishName: 'Ankle Pumps',
    phase: 1,
    holdSeconds: 3,
    restSeconds: 2,
    reps: 15,
    sets: 3,
    frequencyPerDay: 4,
    targetGoal: 'Tăng tuần hoàn máu, giảm sưng nề và phòng ngừa huyết khối tĩnh mạch sâu',
    instructions: [
      'Nằm ngửa trên giường, kê cao cổ chân bằng một chiếc gối mềm.',
      'Kéo mũi bàn chân hướng về phía đầu hết mức có thể, giữ 3 giây.',
      'Duỗi thẳng mũi bàn chân về phía trước hết mức, giữ 3 giây rồi lặp lại.',
    ],
    medicalSource: 'MOON Knee Group ACL Protocol - Phase 1',
    allowedSurgeries: ['ACL_ONLY', 'ACL_MENISCUS_REPAIR', 'ACL_MENISCUS_TRIM'],
    startTiming: 'Ngay Ngày 1 sau mổ (24h đầu trên giường bệnh)',
    vietnameseName: 'Bơm cổ chân (Gập duỗi bàn chân)',
    targetSets: 3,
    targetReps: 15,
    holdSec: 3,
    restSec: 2,
  },
  {
    id: 'ex-quad-sets',
    name: 'Gồng cơ tứ đầu đùi tĩnh',
    englishName: 'Isometric Quad Sets',
    phase: 1,
    holdSeconds: 10,
    restSeconds: 5,
    reps: 10,
    sets: 3,
    frequencyPerDay: 3,
    targetGoal: 'Đánh thức nhóm cơ đùi trước, chống teo cơ và hỗ trợ duỗi thẳng gối 0°',
    instructions: [
      'Nằm ngửa hoặc ngồi duỗi thẳng hai chân trên mặt giường phẳng.',
      'Đặt một chiếc khăn cuộn nhỏ ngay dưới khoeo chân phẫu thuật.',
      'Gồng chặt cơ đùi trước, ấn mạnh mặt sau đầu gối xuống chiếc khăn (cảm nhận xương bánh chè kéo lên trên).',
      'Giữ căng tối đa trong 10 giây, thở đều (không nín thở), sau đó thả lỏng hoàn toàn 5 giây.',
    ],
    medicalSource: 'Mass General Hospital (MGH) Sports Medicine Protocol',
    allowedSurgeries: ['ACL_ONLY', 'ACL_MENISCUS_REPAIR', 'ACL_MENISCUS_TRIM'],
    startTiming: 'Ngày 1 - 2 sau mổ (khi hết thuốc tê)',
    vietnameseName: 'Gồng cơ tứ đầu đùi tĩnh',
    targetSets: 3,
    targetReps: 10,
    holdSec: 10,
    restSec: 5,
  },
  {
    id: 'ex-heel-props',
    name: 'Kê gót chân ép duỗi thẳng gối',
    englishName: 'Passive Knee Extension / Heel Props',
    phase: 1,
    holdSeconds: 300,
    restSeconds: 30,
    reps: 1,
    sets: 2,
    frequencyPerDay: 3,
    targetGoal: 'Đạt độ duỗi thẳng tuyệt đối 0° ngay trong 2 tuần đầu (quan trọng nhất)',
    instructions: [
      'Nằm ngửa, đặt một chiếc gối hoặc khăn cuộn dày dưới gót chân phẫu thuật.',
      'Để vùng khoeo chân lơ lửng hoàn toàn trên không (tuyệt đối KHÔNG kê gối dưới khoeo chân).',
      'Thả lỏng toàn bộ cơ đùi để trọng lực tự kéo đầu gối duỗi thẳng tự nhiên trong 5-10 phút.',
    ],
    contraindications: 'Không đè vật nặng lên xương bánh chè nếu cảm thấy đau buốt bên trong khớp.',
    medicalSource: 'MOON Knee Group - Extension Restoration Guideline',
    allowedSurgeries: ['ACL_ONLY', 'ACL_MENISCUS_REPAIR', 'ACL_MENISCUS_TRIM'],
    startTiming: 'Ngày 1 - 3 sau mổ (quan trọng nhất để duỗi 0°)',
    vietnameseName: 'Kê gót chân ép duỗi thẳng gối',
    targetSets: 2,
    targetReps: 1,
    holdSec: 300,
    restSec: 30,
  },
  {
    id: 'ex-heel-slides',
    name: 'Trượt gót chân gập gối thụ động',
    englishName: 'Heel Slides (Supine)',
    phase: 1,
    holdSeconds: 5,
    restSeconds: 5,
    reps: 10,
    sets: 2,
    frequencyPerDay: 3,
    targetGoal: 'Tăng dần biên độ gập gối an toàn (tối đa 90° trong 2 tuần đầu)',
    instructions: [
      'Nằm ngửa, đi tất trơn hoặc đặt một túi nilon dưới gót chân để giảm ma sát.',
      'Từ từ kéo gót chân trượt trên mặt giường về phía mông cho đến khi thấy khớp gối căng nhẹ.',
      'Giữ nguyên tại điểm căng trong 5 giây, sau đó từ từ trượt chân duỗi thẳng lại vị trí ban đầu.',
    ],
    contraindications: 'Với ca KHÂU SỤN CHÊM: Tuyệt đối dừng lại khi đạt góc 90°, không dùng tay ép quá mức.',
    medicalSource: 'Hospital for Special Surgery (HSS) ACL/Meniscus Protocol',
    allowedSurgeries: ['ACL_ONLY', 'ACL_MENISCUS_REPAIR', 'ACL_MENISCUS_TRIM'],
    startTiming: 'Ngày 3 - 5 sau mổ (khi vết mổ bớt sưng)',
    vietnameseName: 'Trượt gót chân gập gối thụ động',
    targetSets: 2,
    targetReps: 10,
    holdSec: 5,
    restSec: 5,
    safetyWarning: 'Với ca KHÂU SỤN CHÊM: Tuyệt đối dừng lại khi đạt góc 90°.',
  },
  {
    id: 'ex-slr',
    name: 'Nâng chân thẳng 4 hướng (Nằm ngửa)',
    englishName: 'Straight Leg Raises (SLR)',
    phase: 1,
    holdSeconds: 5,
    restSeconds: 5,
    reps: 10,
    sets: 3,
    frequencyPerDay: 2,
    targetGoal: 'Tăng sức mạnh cơ gấp hông và cơ tứ đầu đùi mà không gây áp lực lên dây chằng mới',
    instructions: [
      'Co chân lành chống bàn chân xuống giường để bảo vệ cột sống thắt lưng.',
      'Với chân phẫu thuật: Gồng chặt cơ đùi trước để khóa thẳng đầu gối hoàn toàn.',
      'Từ từ nâng cả chân phẫu thuật lên cao khoảng 30-40cm (ngang tầm đùi chân lành), giữ 5 giây.',
      'Hạ chân xuống thật chậm trong 3 giây. Nếu đầu gối bị chùng khi nâng, hãy đeo nẹp khóa thẳng khi tập.',
    ],
    medicalSource: 'Phác đồ Phục hồi chức năng sau mổ ACL - Bộ Y tế Việt Nam',
    allowedSurgeries: ['ACL_ONLY', 'ACL_MENISCUS_REPAIR', 'ACL_MENISCUS_TRIM'],
    startTiming: 'Ngày 3 - 7 sau mổ (khi gồng đùi chắc chắn)',
    vietnameseName: 'Nâng chân thẳng 4 hướng (Nằm ngửa)',
    targetSets: 3,
    targetReps: 10,
    holdSec: 5,
    restSec: 5,
  },
  {
    id: 'ex-seated-flexion',
    name: 'Ngồi mép giường gập gối chủ động có hỗ trợ',
    englishName: 'Seated Assisted Knee Flexion',
    phase: 2,
    holdSeconds: 10,
    restSeconds: 5,
    reps: 10,
    sets: 3,
    frequencyPerDay: 2,
    targetGoal: 'Mở rộng biên độ gập gối êm ái bằng trọng lực cẳng chân',
    instructions: [
      'Ngồi vững trên mép giường hoặc ghế cao, hai đùi đặt hoàn toàn trên mặt ghế.',
      'Thả lỏng cẳng chân phẫu thuật để trọng lực kéo gập tự nhiên xuống.',
      'Dùng cổ chân lành đặt nhẹ phía trước cổ chân mổ để hỗ trợ ép gập thêm một chút đến ngưỡng căng chịu được, giữ 10 giây.',
    ],
    contraindications: 'Ca KHÂU SỤN CHÊM không ép quá 90° cho đến hết tuần thứ 6.',
    medicalSource: 'MOON Knee Group - Phase 2 ROM Protocol',
    allowedSurgeries: ['ACL_ONLY', 'ACL_MENISCUS_REPAIR', 'ACL_MENISCUS_TRIM'],
    vietnameseName: 'Ngồi mép giường gập gối có hỗ trợ',
    targetSets: 3,
    targetReps: 10,
    holdSec: 10,
    restSec: 5,
    safetyWarning: 'Ca KHÂU SỤN CHÊM không ép quá 90° đến hết tuần thứ 6.',
  },
  {
    id: 'ex-calf-raises',
    name: 'Nhún gót chân hai chân (Bám điểm tựa)',
    englishName: 'Double-Leg Calf Raises',
    phase: 2,
    holdSeconds: 3,
    restSeconds: 3,
    reps: 12,
    sets: 3,
    frequencyPerDay: 2,
    targetGoal: 'Phục hồi sức mạnh cơ bắp chân và cảm giác tỳ đè bàn chân',
    instructions: [
      'Đứng thẳng, hai tay bám nhẹ vào thành ghế hoặc bàn vững chắc phía trước.',
      'Từ từ kiễng cả hai gót chân lên cao nhất có thể, dồn lực đều hai chân.',
      'Giữ ở đỉnh 3 giây rồi hạ gót chân xuống chậm rãi.',
    ],
    contraindications: 'Ca KHÂU SỤN CHÊM chỉ tập bài này từ tuần thứ 5-6 khi bác sĩ cho phép chịu lực.',
    medicalSource: 'MGH Sports Medicine Rehabilitation Guidelines',
    allowedSurgeries: ['ACL_ONLY', 'ACL_MENISCUS_TRIM'],
    vietnameseName: 'Nhún gót chân hai chân (Bám điểm tựa)',
    targetSets: 3,
    targetReps: 12,
    holdSec: 3,
    restSec: 3,
  },
  {
    id: 'ex-mini-squats',
    name: 'Squat nông dựa tường (0° - 45°)',
    englishName: 'Wall Mini Squats',
    phase: 2,
    holdSeconds: 5,
    restSeconds: 5,
    reps: 10,
    sets: 3,
    frequencyPerDay: 2,
    targetGoal: 'Tập kiểm soát cơ đùi chịu tải trọng một phần không gây hại cho sụn chêm',
    instructions: [
      'Đứng tựa lưng vào tường phẳng, hai chân cách tường khoảng 30-40cm, rộng bằng vai.',
      'Từ từ trượt lưng xuống tường gập gối tối đa 45° (không bao giờ gập sâu quá 60° ở giai đoạn này).',
      'Giữ gối thẳng hàng với ngón chân thứ hai, không để đầu gối chụm vào trong.',
      'Giữ 5 giây rồi trượt người đứng thẳng trở lại.',
    ],
    contraindications: 'Dừng ngay nếu đau buốt xương bánh chè hoặc khe khớp sụn chêm.',
    medicalSource: 'MOON Knee Group Phase 2 Guidelines',
    allowedSurgeries: ['ACL_ONLY', 'ACL_MENISCUS_REPAIR', 'ACL_MENISCUS_TRIM'],
    vietnameseName: 'Squat nông dựa tường (0° - 45°)',
    targetSets: 3,
    targetReps: 10,
    holdSec: 5,
    restSec: 5,
  },
  {
    id: 'ex-glute-bridge',
    name: 'Cầu mông hai chân (Glute Bridge)',
    englishName: 'Double-Leg Glute Bridge',
    phase: 2,
    holdSeconds: 5,
    restSeconds: 3,
    reps: 10,
    sets: 3,
    frequencyPerDay: 2,
    targetGoal: 'Kích hoạt nhóm cơ mông lớn và cơ gân kheo hỗ trợ bảo vệ dây chằng ACL',
    instructions: [
      'Nằm ngửa trên sàn, co hai gối khoảng 70-90°, hai bàn chân đặt phẳng trên mặt sàn rộng bằng hông.',
      'Siết chặt cơ bụng và cơ mông, ấn mạnh gót chân xuống sàn nâng hông lên cao thành đường thẳng.',
      'Giữ vững ở đỉnh 5 giây, thở đều rồi từ từ hạ hông xuống.',
    ],
    medicalSource: 'HSS Sports Medicine ACL Protocol',
    allowedSurgeries: ['ACL_ONLY', 'ACL_MENISCUS_REPAIR', 'ACL_MENISCUS_TRIM'],
    vietnameseName: 'Cầu mông hai chân (Glute Bridge)',
    targetSets: 3,
    targetReps: 10,
    holdSec: 5,
    restSec: 3,
  },
  {
    id: 'ex-single-leg-balance',
    name: 'Đứng thăng bằng một chân chân mổ',
    englishName: 'Single-Leg Balance',
    phase: 3,
    holdSeconds: 30,
    restSeconds: 15,
    reps: 3,
    sets: 3,
    frequencyPerDay: 2,
    targetGoal: 'Tái huấn luyện cảm thụ bản thể (Proprioception) và sự ổn định khớp gối',
    instructions: [
      'Đứng gần tường hoặc thành ghế để có điểm tựa khi cần.',
      'Nâng chân lành lên khỏi mặt đất, dồn toàn bộ trọng lượng lên chân phẫu thuật.',
      'Khớp gối chân mổ hơi chùng nhẹ 5-10° (không khóa cứng gối).',
      'Giữ thăng bằng trong 30 giây, mắt nhìn thẳng vào một điểm cố định phía trước.',
    ],
    medicalSource: 'Emory Sports Medicine ACL Return to Sport',
    allowedSurgeries: ['ACL_ONLY', 'ACL_MENISCUS_REPAIR', 'ACL_MENISCUS_TRIM'],
    vietnameseName: 'Đứng thăng bằng một chân',
    targetSets: 3,
    targetReps: 3,
    holdSec: 30,
    restSec: 15,
  },
  {
    id: 'ex-step-ups',
    name: 'Bước lên bục thấp có kiểm soát (10-15cm)',
    englishName: 'Controlled Step-Ups',
    phase: 3,
    holdSeconds: 3,
    restSeconds: 3,
    reps: 10,
    sets: 3,
    frequencyPerDay: 2,
    targetGoal: 'Phục hồi lực đẩy đùi và chuẩn bị cho sinh hoạt leo cầu thang',
    instructions: [
      'Đứng trước một bục vững chắc cao từ 10 - 15cm.',
      'Đặt toàn bộ bàn chân phẫu thuật lên giữa bục.',
      'Ấn gót chân mổ xuống bục để nâng cơ thể lên thẳng đứng, chân lành chạm nhẹ mép bục.',
      'Từ từ bước lùi hạ chân lành xuống đất trong 3 giây.',
    ],
    medicalSource: 'Mass General Sports Rehabilitation',
    allowedSurgeries: ['ACL_ONLY', 'ACL_MENISCUS_REPAIR', 'ACL_MENISCUS_TRIM'],
    vietnameseName: 'Bước lên bục thấp có kiểm soát',
    targetSets: 3,
    targetReps: 10,
    holdSec: 3,
    restSec: 3,
  },
  {
    id: 'ex-straight-line-jogging',
    name: 'Chạy bộ đường thẳng ngắt quãng (Jogging)',
    englishName: 'Interval Straight-Line Jogging',
    phase: 4,
    holdSeconds: 60,
    restSeconds: 60,
    reps: 8,
    sets: 1,
    frequencyPerDay: 1,
    targetGoal: 'Tái lập phản xạ chịu tải động và sức bền cơ đùi chuẩn bị trở lại thể thao',
    instructions: [
      'Thực hiện trên máy chạy bộ hoặc sân cỏ phẳng hoàn toàn bằng phẳng.',
      'Khởi động kỹ khớp gối và cơ đùi ít nhất 10 phút.',
      'Chạy chậm đường thẳng nhịp nhàng 1 phút (tốc độ 6-8 km/h), sau đó đi bộ 1 phút.',
      'Lặp lại 8-10 chu kỳ. Tuyệt đối không xoay người hoặc đổi hướng đột ngột.',
    ],
    contraindications: 'Dừng chạy nếu có phản ứng sưng gối hoặc đau nhói khớp.',
    medicalSource: 'Delaware-Oslo ACL Cohort Study Guidelines',
    allowedSurgeries: ['ACL_ONLY', 'ACL_MENISCUS_REPAIR', 'ACL_MENISCUS_TRIM'],
    vietnameseName: 'Chạy bộ đường thẳng ngắt quãng (Jogging)',
    targetSets: 1,
    targetReps: 8,
    holdSec: 60,
    restSec: 60,
  },
  {
    id: 'ex-agility-ladder',
    name: 'Thang dây linh hoạt cơ bản (Tiến - Lùi)',
    englishName: 'Agility Ladder Forward-Backward',
    phase: 4,
    holdSeconds: 30,
    restSeconds: 30,
    reps: 5,
    sets: 3,
    frequencyPerDay: 1,
    targetGoal: 'Tăng tốc độ điều hợp thần kinh cơ và độ nhạy bén bàn chân',
    instructions: [
      'Trải thang dây trên mặt phẳng vững chắc.',
      'Di chuyển bước chân nhanh tiến và lùi qua từng ô thang.',
      'Tiếp đất êm ái bằng nửa trước bàn chân, đầu gối luôn hơi chùng.',
    ],
    medicalSource: 'FIFA 11+ Knee Injury Prevention',
    allowedSurgeries: ['ACL_ONLY', 'ACL_MENISCUS_REPAIR', 'ACL_MENISCUS_TRIM'],
    excludedAgeGroups: ['OVER_45'],
    vietnameseName: 'Thang dây linh hoạt cơ bản',
    targetSets: 3,
    targetReps: 5,
    holdSec: 30,
    restSec: 30,
  },
];

export const AGE_GROUP_DETAILS: Record<AgeGroup, { label: string; shortLabel: string; clinicalNote: string }> = {
  UNDER_30: {
    label: "Dưới 30 tuổi (Vận động viên / Người trẻ)",
    shortLabel: "< 30 tuổi",
    clinicalNote: "Mật độ xương và khả năng phục hồi cơ bắp nhanh; mục tiêu hồi phục thể lực cường độ cao và trở lại thể thao đối kháng."
  },
  AGE_31_45: {
    label: "31 - 45 tuổi (Người đi làm / Thể thao phong trào)",
    shortLabel: "31 - 45 tuổi",
    clinicalNote: "Tốc độ liền gân tiêu chuẩn; cần chú trọng cân bằng sức mạnh gân hamstring/quad và độ bền khớp."
  },
  OVER_45: {
    label: "Trên 45 tuổi (Trung niên & Cao tuổi)",
    shortLabel: "> 45 tuổi",
    clinicalNote: "Ưu tiên bảo tồn sụn khớp, kéo dài thời gian thích nghi chịu lực, loại bỏ các bài tập va đập dội lực cao."
  }
};

export const SURGERY_DETAILS: Record<SurgeryType, { label: string; shortLabel: string; description: string; riskNote: string }> = {
  ACL_ONLY: {
    label: "Tái tạo dây chằng chéo trước đơn thuần (ACL Only)",
    shortLabel: "Tái tạo ACL đơn thuần",
    description: "Phẫu thuật tái tạo ACL bằng gân tự thân (gân bánh chè hoặc gân hamstring) không can thiệp sụn chêm.",
    riskNote: "Tập trung lấy lại duỗi thẳng 0° sớm, tập gồng cơ đùi và kiểm soát sưng nề."
  },
  ACL_MENISCUS_REPAIR: {
    label: "Tái tạo ACL + Khâu bảo tồn sụn chêm (Meniscus Repair)",
    shortLabel: "ACL + Khâu sụn chêm",
    description: "Phẫu thuật tái tạo ACL kết hợp khâu phục hồi rách sụn chêm. Mối khâu sụn chêm rất mỏng manh cần thời gian liền xương sụn.",
    riskNote: "CỰC KỲ QUAN TRỌNG: 6 tuần đầu tuyệt đối KHÔNG gập gối quá 90° và KHÔNG chống chân tì trọng lượng (NWB) để tránh làm bục mũi khâu sụn chêm!"
  },
  ACL_MENISCUS_TRIM: {
    label: "Tái tạo ACL + Cắt lọc một phần sụn chêm (Meniscectomy/Trim)",
    shortLabel: "ACL + Cắt sụn chêm",
    description: "Phẫu thuật tái tạo ACL kèm cắt tỉa phần sụn rách không thể khâu. Không có mối khâu sụn cần bảo vệ chịu lực.",
    riskNote: "Có thể tập chịu lực sớm hơn khâu sụn chêm theo ngưỡng đau và hướng dẫn bác sĩ."
  }
};

export function getSafeAgeGroup(ag?: any): AgeGroup {
  if (ag === 'UNDER_30' || ag === 'AGE_31_45' || ag === 'OVER_45') {
    return ag;
  }
  return 'AGE_31_45';
}

export function getSafeSurgeryType(st?: any): SurgeryType {
  if (st === 'ACL_ONLY' || st === 'ACL_MENISCUS_REPAIR' || st === 'ACL_MENISCUS_TRIM') {
    return st;
  }
  return 'ACL_MENISCUS_REPAIR';
}

export function getAgeGroupDetails(ag?: any) {
  const safe = getSafeAgeGroup(ag);
  return AGE_GROUP_DETAILS[safe] || AGE_GROUP_DETAILS.AGE_31_45;
}

export function getSurgeryDetails(st?: any) {
  const safe = getSafeSurgeryType(st);
  return SURGERY_DETAILS[safe] || SURGERY_DETAILS.ACL_MENISCUS_REPAIR;
}

export interface RehabStatus {
  currentDay: number;
  currentWeek: number;
  phase: PhaseRule;
  surgeryType: SurgeryType;
  ageGroup: AgeGroup;
  surgeryDate: string;
  allowedFlexionMax: number;
  isMeniscusRepairStrictLimit: boolean;
  weightBearingSummary: string;
  braceSummary: string;
  ageAdjustmentNote: string;
  dangerSigns: string[];
  redFlags: string[];
  milestoneCriteria: string[];
  exercises: Exercise[];
}

export function getRehabStatus(
  surgeryDateStr: string | Date,
  rawSurgeryType: SurgeryType = 'ACL_ONLY',
  rawAgeGroup: AgeGroup = 'AGE_31_45'
): RehabStatus {
  const surgeryType = getSafeSurgeryType(rawSurgeryType);
  const ageGroup = getSafeAgeGroup(rawAgeGroup);

  const sDate = new Date(surgeryDateStr);
  const now = new Date();
  
  // Difference in calendar days
  const diffTime = Math.max(0, now.getTime() - (isNaN(sDate.getTime()) ? now.getTime() : sDate.getTime()));
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const currentWeek = Math.max(1, Math.floor(diffDays / 7) + 1);

  // Determine current phase from PHASE_RULES
  let phaseIndex = 0;
  if (currentWeek <= 2) {
    phaseIndex = 0;
  } else if (currentWeek <= 6) {
    phaseIndex = 1;
  } else if (currentWeek <= 12) {
    phaseIndex = 2;
  } else {
    phaseIndex = 3;
  }

  const phase = PHASE_RULES[phaseIndex] || PHASE_RULES[0];
  const allowedFlexionMax = phase.maxFlexionAngle[surgeryType] ?? 90;
  const isMeniscusRepairStrictLimit = surgeryType === 'ACL_MENISCUS_REPAIR' && currentWeek <= 6;
  const weightBearingSummary = phase.weightBearingStatus[surgeryType] ?? 'Chống nạng tập đi';
  const braceSummary = phase.braceRule[surgeryType] ?? 'Đeo nẹp 0°';
  const redFlags = phase.redFlags || [];
  const milestoneCriteria = phase.milestoneCriteria || [];
  const ageDetail = getAgeGroupDetails(ageGroup);
  const ageAdjustmentNote = ageDetail.clinicalNote;

  // Filter exercises relevant to this phase, surgery type, and age group
  const matchedExercises = REHAB_EXERCISES.filter(
    (ex) =>
      ex.phase === phase.phase &&
      ex.allowedSurgeries.includes(surgeryType) &&
      (!ex.excludedAgeGroups || !ex.excludedAgeGroups.includes(ageGroup))
  );

  const exercises = matchedExercises.length > 0 ? matchedExercises : REHAB_EXERCISES.slice(0, 4);

  return {
    currentDay: diffDays,
    currentWeek,
    phase,
    surgeryType,
    ageGroup,
    surgeryDate: typeof surgeryDateStr === 'string' ? surgeryDateStr : (isNaN(sDate.getTime()) ? new Date().toISOString().split('T')[0] : sDate.toISOString().split('T')[0]),
    allowedFlexionMax,
    isMeniscusRepairStrictLimit,
    weightBearingSummary,
    braceSummary,
    ageAdjustmentNote,
    dangerSigns: redFlags,
    redFlags,
    milestoneCriteria,
    exercises,
  };
}
