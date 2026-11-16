export type SurgeryType = 'ACL_ONLY' | 'ACL_MENISCUS_REPAIR' | 'ACL_MENISCUS_TRIM';

export interface Exercise {
  id: string;
  name: string;
  vietnameseName: string;
  category: 'mobility' | 'activation' | 'strength' | 'balance' | 'gait';
  targetSets: number;
  targetReps: number;
  holdSec: number;
  restSec: number;
  description: string;
  instructions: string[];
  safetyWarning?: string;
  cautionNote?: string;
  maxFlexionAngle?: number;
}

export interface PhaseProtocol {
  phaseNumber: 1 | 2 | 3 | 4;
  title: string;
  subtitle: string;
  weeksRange: string;
  minWeeks: number;
  maxWeeks: number;
  goals: string[];
  precautions: string[];
  forbiddenActions: string[];
  getWeightBearing: (surgeryType: SurgeryType) => string;
  getBraceRequirement: (surgeryType: SurgeryType) => string;
  getMaxSafeFlexion: (surgeryType: SurgeryType) => number;
  getExercises: (surgeryType: SurgeryType) => Exercise[];
}

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

// Common Exercises Database
const EXERCISES_DATABASE: Record<string, Exercise> = {
  ankle_pumps: {
    id: 'ankle_pumps',
    name: 'Ankle Pumps',
    vietnameseName: 'Bơm cổ chân (Gập duỗi cổ chân)',
    category: 'mobility',
    targetSets: 3,
    targetReps: 20,
    holdSec: 2,
    restSec: 5,
    description: 'Kích hoạt tuần hoàn bắp chân, phòng ngừa huyết khối tĩnh mạch sâu (DVT) và giảm ứ trệ phù nề.',
    instructions: [
      'Nằm hoặc ngồi thẳng, chân duỗi thoải mái.',
      'Kéo mũi bàn chân hết cỡ về phía đầu gối (gập mu chân), giữ 2 giây.',
      'Đạp mũi chân hết cỡ về phía trước (duỗi lòng bàn chân), giữ 2 giây.',
      'Thực hiện liên tục nhịp nhàng.'
    ]
  },
  quad_sets: {
    id: 'quad_sets',
    name: 'Quad Sets',
    vietnameseName: 'Gồng cơ tứ đầu đùi (Đè khoeo chân)',
    category: 'activation',
    targetSets: 3,
    targetReps: 12,
    holdSec: 6,
    restSec: 4,
    description: 'Đánh thức cơ tứ đầu đùi và phục hồi độ duỗi gối thẳng hoàn toàn 0°.',
    instructions: [
      'Nằm ngửa, chân mổ duỗi thẳng trên mặt phẳng hoặc kê một cuộn khăn mỏng dưới gót chân.',
      'Gồng cứng mặt trước đùi, siết chặt và ấn mạnh khoeo chân xuống giường.',
      'Cảm nhận xương bánh chè bị kéo nhẹ lên trên.',
      'Giữ hơi thở đều đặn, đếm giữ đủ 6 giây rồi thả lỏng 4 giây.'
    ],
    safetyWarning: 'Không nín thở khi siết cơ. Không ấn trực tiếp lên bánh chè.'
  },
  glute_sets: {
    id: 'glute_sets',
    name: 'Gluteal Sets',
    vietnameseName: 'Siết cơ mông',
    category: 'activation',
    targetSets: 3,
    targetReps: 15,
    holdSec: 5,
    restSec: 3,
    description: 'Kích hoạt khối cơ mông lớn, hỗ trợ cân bằng khung chậu và giảm áp lực lên đầu gối.',
    instructions: [
      'Nằm ngửa thoải mái, 2 chân duỗi thẳng.',
      'Siết chặt hai bên cơ mông ép vào nhau hết mức có thể.',
      'Giữ căng trong 5 giây, thở đều, sau đó từ từ thả lỏng.'
    ]
  },
  patellar_mobs: {
    id: 'patellar_mobs',
    name: 'Patellar Mobilization',
    vietnameseName: 'Di động xương bánh chè',
    category: 'mobility',
    targetSets: 2,
    targetReps: 15,
    holdSec: 3,
    restSec: 2,
    description: 'Phòng ngừa dính khớp và xơ hóa bao khớp quanh bánh chè sau mổ.',
    instructions: [
      'Ngồi tựa lưng, duỗi thẳng chân hoàn toàn để cơ đùi thả lỏng tối đa.',
      'Dùng ngón tay cái và ngón trỏ của hai tay ôm nhẹ lấy các cạnh của xương bánh chè.',
      'Nhẹ nhàng đẩy bánh chè sang trái - phải, lên trên - xuống dưới.',
      'Mỗi hướng di chuyển giữ nhẹ 3 giây rồi đổi hướng.'
    ],
    safetyWarning: 'Chỉ thực hiện khi cơ đùi thả lỏng hoàn toàn. Nếu đùi gồng cứng thì không thể di chuyển bánh chè.'
  },
  slr_flexion: {
    id: 'slr_flexion',
    name: 'Straight Leg Raise (Locked Brace)',
    vietnameseName: 'Nâng chân thẳng có khóa nẹp',
    category: 'strength',
    targetSets: 3,
    targetReps: 10,
    holdSec: 5,
    restSec: 5,
    description: 'Tăng cường sức mạnh cơ thẳng đùi và cơ gấp hông mà không làm uốn cong khớp gối.',
    instructions: [
      'Đeo nẹp cố định khóa ở 0° duỗi thẳng.',
      'Nằm ngửa, chân lành co gối đặt bàn chân lên giường.',
      'Siết chặt đùi chân mổ để khóa cứng gối, sau đó nâng cả chân lên cách mặt giường khoảng 20-30 cm.',
      'Giữ yên trên không 5 giây, hạ xuống từ từ có kiểm soát.'
    ],
    safetyWarning: 'Nếu gối bị chùng xuống hoặc đau nhói mặt trước, hãy ngừng lại và tiếp tục tập quad sets trước.'
  },
  heel_slides_limited: {
    id: 'heel_slides_limited',
    name: 'Heel Slides (Strict Limit <= 90°)',
    vietnameseName: 'Trượt gót gập gối (Giới hạn tối đa 90°)',
    category: 'mobility',
    targetSets: 3,
    targetReps: 10,
    holdSec: 5,
    restSec: 5,
    maxFlexionAngle: 90,
    description: 'Phục hồi góc gập gối an toàn. Đặc biệt cho bệnh nhân khâu sụn chêm, không được gập vượt quá 90°!',
    instructions: [
      'Nằm ngửa trên giường hoặc thảm nhẵn (có thể đi tất trơn hoặc dùng dây vải hỗ trợ).',
      'Từ từ kéo gót chân trượt về phía mông, gập gối nhẹ nhàng.',
      'Dừng lại ngay khi cảm thấy căng tức vừa phải hoặc khi chạm góc 90° (tuyệt đối không ép quá 90°).',
      'Giữ 5 giây rồi từ từ đẩy gót chân duỗi thẳng trở lại vị trí ban đầu.'
    ],
    safetyWarning: 'ĐỐI VỚI KHÂU SỤN CHÊM: Cấm gập quá 90°! Dừng lại ngay khi đạt góc vuông.'
  },
  heel_slides_progressive: {
    id: 'heel_slides_progressive',
    name: 'Progressive Heel Slides',
    vietnameseName: 'Trượt gót tăng dần biên độ',
    category: 'mobility',
    targetSets: 3,
    targetReps: 12,
    holdSec: 5,
    restSec: 5,
    maxFlexionAngle: 115,
    description: 'Gia tăng dần góc gập gối về mức 110° - 120° trong giai đoạn 2.',
    instructions: [
      'Nằm ngửa, trượt gót nhẹ nhàng về phía mông.',
      'Có thể dùng hai tay ôm nhẹ mặt sau đùi (không kéo giật cẳng chân) để hỗ trợ gập thêm vài độ.',
      'Giữ ở điểm căng tức thoải mái trong 5 giây, thở đều, rồi duỗi thẳng lại.'
    ]
  },
  seated_knee_extension: {
    id: 'seated_knee_extension',
    name: 'Active-Assisted Knee Extension',
    vietnameseName: 'Duỗi gối chủ động có trợ giúp (Ngồi mép giường)',
    category: 'mobility',
    targetSets: 3,
    targetReps: 10,
    holdSec: 5,
    restSec: 5,
    description: 'Tập kiểm soát duỗi gối chủ động từ tư thế ngồi buông cẳng chân.',
    instructions: [
      'Ngồi ở mép giường cao sao cho hai chân buông thõng tự nhiên.',
      'Dùng chân lành đỡ nhẹ phía sau gót chân mổ, từ từ duỗi thẳng chân mổ lên song song mặt đất.',
      'Gồng cơ đùi giữ gối thẳng hoàn toàn trong 5 giây.',
      'Từ từ hạ chân xuống vị trí 90°.'
    ]
  },
  prone_hang: {
    id: 'prone_hang',
    name: 'Prone Hang for Full Extension',
    vietnameseName: 'Nằm sấp thả gối lấy lại duỗi 0°',
    category: 'mobility',
    targetSets: 2,
    targetReps: 5,
    holdSec: 30,
    restSec: 15,
    description: 'Sử dụng trọng lực giúp khớp gối duỗi thẳng hoàn toàn 0 độ, phòng ngừa mất duỗi vĩnh viễn.',
    instructions: [
      'Nằm sấp trên giường, buông hai cẳng chân từ xương bánh chè thò ra ngoài mép giường.',
      'Thả lỏng hoàn toàn cơ bắp chân và đùi để trọng lực kéo cẳng chân duỗi thẳng xuống.',
      'Duy trì tư thế trong 30 giây đến 1 phút mỗi hiệp.',
      'Nếu thấy căng đau gân khoeo, có thể kê một khăn mỏng dưới xương đùi.'
    ]
  },
  bridge_double_leg: {
    id: 'bridge_double_leg',
    name: 'Double Leg Glute Bridge',
    vietnameseName: 'Nâng mông cây cầu (Hai chân)',
    category: 'strength',
    targetSets: 3,
    targetReps: 12,
    holdSec: 5,
    restSec: 10,
    description: 'Tăng cường sức mạnh cơ chuỗi sau gồm mông lớn và gân kheo.',
    instructions: [
      'Nằm ngửa, hai gối co khoảng 60-80° (đối với sụn chêm không gập quá 90°), hai bàn chân đặt phẳng trên sàn rộng bằng hông.',
      'Ấn đều gót chân xuống sàn, siết cơ mông và nâng hông lên sao cho thân người tạo thành đường thẳng từ vai đến gối.',
      'Giữ đỉnh động tác 5 giây, không ưỡn cong thắt lưng.',
      'Hạ hông xuống từ từ.'
    ]
  },
  standing_calf_raise: {
    id: 'standing_calf_raise',
    name: 'Standing Calf Raises',
    vietnameseName: 'Nhón gót bắp chân (Calf Raises)',
    category: 'strength',
    targetSets: 3,
    targetReps: 15,
    holdSec: 3,
    restSec: 5,
    description: 'Củng cố nhóm cơ tam đầu cẳng chân, hỗ trợ độ vững cổ chân và dáng đi đẩy gót.',
    instructions: [
      'Đứng vịn tay nhẹ vào lưng ghế hoặc tường để giữ thăng bằng.',
      'Hai chân rộng bằng vai, gối giữ thẳng nhẹ (không ưỡn gối ra sau).',
      'Nhón cao hai gót chân lên hết mức có thể, dồn lực vào các ụ ngón chân.',
      'Giữ lại 3 giây trên cao rồi hạ gót xuống chạm nhẹ sàn.'
    ]
  },
  mini_squats: {
    id: 'mini_squats',
    name: 'Wall-Supported Mini Squats (0-45°)',
    vietnameseName: 'Mini Squat tựa tường (0° - 45°)',
    category: 'strength',
    targetSets: 3,
    targetReps: 10,
    holdSec: 4,
    restSec: 8,
    maxFlexionAngle: 45,
    description: 'Bài tập chuỗi động lực kín (CKC) kích hoạt cơ tứ đầu đùi an toàn mà không kéo căng mảnh ghép ACL.',
    instructions: [
      'Đứng dựa lưng vào tường, hai chân bước về phía trước khoảng 30 cm, mở rộng bằng vai.',
      'Từ từ trượt lưng xuống tường hạ hông cho đến khi gối gập khoảng 30° - 45° (không vượt quá 60°).',
      'Đảm bảo đầu gối thẳng hàng với ngón chân thứ hai, không chụm gối vào trong.',
      'Giữ 4 giây rồi đẩy thẳng người lên về tư thế ban đầu.'
    ],
    safetyWarning: 'Không chụm hai gối vào nhau (valgus). Góc gập gối không vượt quá 45° trong giai đoạn này.'
  },
  stationary_bike: {
    id: 'stationary_bike',
    name: 'Stationary Cycling (High Seat, No Resistance)',
    vietnameseName: 'Đạp xe đạp tĩnh (Yên cao, không kháng lực)',
    category: 'mobility',
    targetSets: 1,
    targetReps: 15,
    holdSec: 60,
    restSec: 30,
    description: 'Bôi trơn ổ khớp, làm nóng cơ và cải thiện biên độ gập duỗi nhịp nhàng.',
    instructions: [
      'Chỉnh yên xe đủ cao để khi bàn chân ở điểm thấp nhất, khớp gối chỉ hơi gập nhẹ khoảng 10-15° (không bị gập sâu).',
      'Bắt đầu bằng cách đạp qua lại nửa vòng tròn (dao động con lắc) để khởi động biên độ.',
      'Khi đã thoải mái thì quay trọn vẹn vòng đạp nhẹ nhàng không cài kháng lực.',
      'Duy trì tốc độ êm ái khoảng 50-60 vòng/phút trong 10-15 phút.'
    ]
  },
  single_leg_balance: {
    id: 'single_leg_balance',
    name: 'Single Leg Balance (Eyes Open)',
    vietnameseName: 'Đứng thăng bằng một chân trên sàn cứng',
    category: 'balance',
    targetSets: 3,
    targetReps: 5,
    holdSec: 20,
    restSec: 10,
    description: 'Tập cảm thụ bản thể (proprioception), đánh thức phản xạ thăng bằng thần kinh cơ của dây chằng mới.',
    instructions: [
      'Đứng cạnh mép bàn hoặc tường để có thể bám tay khi mất thăng bằng.',
      'Nhấc chân lành lên khỏi sàn, đứng trụ hoàn toàn trên chân mổ.',
      'Gối chân trụ hơi chùng nhẹ 5-10° (tuyệt đối không khóa cứng gối ngược ra sau).',
      'Giữ vững tư thế thăng bằng mắt nhìn thẳng trong 20-30 giây.'
    ]
  },
  step_ups: {
    id: 'step_ups',
    name: 'Forward Step-Ups (Low Step 10-15cm)',
    vietnameseName: 'Bước lên bục thấp (10 - 15cm)',
    category: 'strength',
    targetSets: 3,
    targetReps: 10,
    holdSec: 2,
    restSec: 10,
    description: 'Tăng cường sức mạnh cơ đùi và mông theo chuyển động chức năng leo cầu thang.',
    instructions: [
      'Đứng trước một bục thấp vững chắc cao khoảng 10-15cm.',
      'Đặt toàn bộ bàn chân mổ lên bục.',
      'Dồn lực qua gót chân mổ đẩy thẳng thân người lên đứng trên bục, chân lành chạm nhẹ cạnh chân mổ.',
      'Từ từ bước lùi chân lành xuống sàn có kiểm soát.'
    ]
  },
  straight_line_jogging: {
    id: 'straight_line_jogging',
    name: 'Straight-Line Light Jogging Intervals',
    vietnameseName: 'Chạy bộ nhẹ đường thẳng (Ngắt quãng)',
    category: 'gait',
    targetSets: 4,
    targetReps: 3,
    holdSec: 60,
    restSec: 60,
    description: 'Tái thích ứng lực va đập cho khớp gối trên đường phẳng thẳng, chuẩn bị cho thể thao.',
    instructions: [
      'Chỉ thực hiện khi có sự đồng ý của bác sĩ/chuyên gia VLTL và cơ đùi đạt ít nhất 80% sức mạnh chân lành.',
      'Chạy bước nhỏ nhẹ nhàng trên thảm cỏ êm hoặc máy chạy bộ.',
      'Chỉ chạy thẳng, tuyệt đối KHÔNG đổi hướng gấp, không xoay vặn thân người.',
      'Chạy 1 phút, đi bộ 1 phút xen kẽ.'
    ],
    safetyWarning: 'Nếu gối có phản ứng sưng nề hoặc đau sau khi chạy, ngừng ngay lập tức và chườm đá.'
  }
};

export const REHAB_PHASES: PhaseProtocol[] = [
  {
    phaseNumber: 1,
    title: "Giai đoạn 1: Bảo vệ & Giảm sưng nề",
    subtitle: "Tuần 1 - Tuần 2 sau phẫu thuật",
    weeksRange: "Tuần 1 - 2",
    minWeeks: 0,
    maxWeeks: 2,
    goals: [
      "Kiểm soát sưng nề và cơn đau sau phẫu thuật",
      "Đạt duỗi thẳng gối hoàn toàn 0° (ưu tiên số 1)",
      "Đạt góc gập gối 90° an toàn (đối với sụn chêm: TUYỆT ĐỐI KHÔNG QUÁ 90°)",
      "Kích hoạt co cơ tứ đầu đùi (quadriceps) chủ động",
      "Phòng ngừa huyết khối tĩnh mạch sâu (DVT)"
    ],
    precautions: [
      "Chườm đá lạnh 15-20 phút mỗi 2-3 giờ, kê cao chân hơn mức tim khi nằm nghỉ",
      "Đeo nẹp dài cố định khóa ở 0° khi đi lại và khi ngủ",
      "Luôn dùng 2 nạng nách/khuỷu tay hỗ trợ khi di chuyển"
    ],
    forbiddenActions: [
      "KHÔNG kê gối dưới khoeo chân khi nằm (dễ gây co rút mất duỗi gối vĩnh viễn)",
      "KHÔNG đứng tì đè toàn bộ trọng lượng lên chân mổ",
      "KHÔNG xoay vặn khớp gối, không tự ý tháo nẹp khi đi lại",
      "ĐỐI VỚI KHÂU SỤN CHÊM: KHÔNG GẬP GỐI QUÁ 90° VÀ KHÔNG TÌ CHÂN DƯỚI BẤT KỲ HÌNH THỨC NÀO"
    ],
    getWeightBearing: (surgeryType: SurgeryType) => {
      if (surgeryType === 'ACL_MENISCUS_REPAIR') {
        return "CẤM TÌ CHÂN (NWB): Không chịu bất kỳ trọng lượng nào lên chân mổ. Đi bằng 2 nạng, chân mổ nhấc lơ lửng.";
      }
      return "Chịu lực một phần chạm ngón (TTWB ~ 25-50%): Dùng 2 nạng hỗ trợ, chạm nhẹ bàn chân mổ xuống đất khi bước.";
    },
    getBraceRequirement: (_surgeryType: SurgeryType) => {
      return "Đeo nẹp khóa thẳng 0° liên tục cả ngày lẫn đêm (kể cả khi ngủ). Chỉ mở nẹp khi tập phục hồi chức năng nằm trên giường.";
    },
    getMaxSafeFlexion: (surgeryType: SurgeryType) => {
      return surgeryType === 'ACL_MENISCUS_REPAIR' ? 90 : 90;
    },
    getExercises: (surgeryType: SurgeryType) => {
      const list = [
        EXERCISES_DATABASE.ankle_pumps,
        EXERCISES_DATABASE.quad_sets,
        EXERCISES_DATABASE.glute_sets,
        EXERCISES_DATABASE.patellar_mobs,
        EXERCISES_DATABASE.slr_flexion,
      ];
      list.push(EXERCISES_DATABASE.heel_slides_limited);
      if (surgeryType !== 'ACL_MENISCUS_REPAIR') {
        list.push(EXERCISES_DATABASE.seated_knee_extension);
      }
      return list;
    }
  },
  {
    phaseNumber: 2,
    title: "Giai đoạn 2: Phục hồi biên độ & Kích hoạt cơ",
    subtitle: "Tuần 3 - Tuần 6 sau phẫu thuật",
    weeksRange: "Tuần 3 - 6",
    minWeeks: 3,
    maxWeeks: 6,
    goals: [
      "Duy trì vững chắc duỗi gối 0° và tăng biên độ gập lên 110° - 120° (ngoại trừ khâu sụn chêm: giữ <= 90°)",
      "Nâng cao sức mạnh cơ tứ đầu đùi và chuỗi sau",
      "Chuẩn bị chuyển đổi dáng đi bỏ dần nạng theo tiến độ",
      "Kiểm soát sưng sau khi tập luyện"
    ],
    precautions: [
      "Khởi động làm ấm khớp gối trước khi tập, chườm lạnh sau khi hoàn tất bài tập",
      "Tiếp tục theo dõi độ nóng và sưng của khớp sau mỗi buổi tập"
    ],
    forbiddenActions: [
      "KHÔNG chạy nhảy, không bật nhảy tiếp đất",
      "KHÔNG ngồi xổm sâu (deep squat)",
      "ĐỐI VỚI KHÂU SỤN CHÊM TUẦN 3-6: TIẾP TỤC CẤM GẬP QUÁ 90° VÀ CẤM TÌ ĐÈ ĐẦY ĐỦ"
    ],
    getWeightBearing: (surgeryType: SurgeryType) => {
      if (surgeryType === 'ACL_MENISCUS_REPAIR') {
        return "CẤM TÌ CHÂN HOẶC TÌ CHẠM NGÓN RẤT NHẸ (NWB/Toe-touch): Tiếp tục dùng 2 nạng nách, tuân thủ nghiêm ngặt đến hết tuần 6.";
      }
      return "Tập chịu trọng lượng tăng dần tùy dung nạp (PWB -> FWB): Bắt đầu chuyển từ 2 nạng sang 1 nạng khi gối duỗi thẳng vững không khập khiễng.";
    },
    getBraceRequirement: (surgeryType: SurgeryType) => {
      if (surgeryType === 'ACL_MENISCUS_REPAIR') {
        return "Nẹp khóa thẳng gối khi đi nạng. Có thể mở nẹp 0°-90° khi ngồi nghỉ hoặc tập vận động có giám sát.";
      }
      return "Có thể mở khóa nẹp bản lề sang 0°-90° khi đi lại nếu cơ tứ đầu đùi đã đủ khỏe và kiểm soát tốt nâng chân thẳng không bị chùng gối.";
    },
    getMaxSafeFlexion: (surgeryType: SurgeryType) => {
      // Meniscus repair strictly limits <= 90 in weeks 1-6
      return surgeryType === 'ACL_MENISCUS_REPAIR' ? 90 : 115;
    },
    getExercises: (surgeryType: SurgeryType) => {
      const list = [
        EXERCISES_DATABASE.ankle_pumps,
        EXERCISES_DATABASE.quad_sets,
        EXERCISES_DATABASE.slr_flexion,
        EXERCISES_DATABASE.prone_hang,
        EXERCISES_DATABASE.bridge_double_leg,
        EXERCISES_DATABASE.standing_calf_raise
      ];
      if (surgeryType === 'ACL_MENISCUS_REPAIR') {
        list.push(EXERCISES_DATABASE.heel_slides_limited);
      } else {
        list.push(EXERCISES_DATABASE.heel_slides_progressive);
        list.push(EXERCISES_DATABASE.mini_squats);
        list.push(EXERCISES_DATABASE.stationary_bike);
      }
      return list;
    }
  },
  {
    phaseNumber: 3,
    title: "Giai đoạn 3: Tăng cường sức mạnh & Dáng đi chuẩn",
    subtitle: "Tuần 7 - Tuần 12 sau phẫu thuật",
    weeksRange: "Tuần 7 - 12",
    minWeeks: 7,
    maxWeeks: 12,
    goals: [
      "Đạt biên độ gập gối tối đa ngang bằng chân lành (125° - 135°)",
      "Dáng đi bình thường không khập khiễng, hoàn toàn bỏ nẹp và nạng",
      "Phục hồi thăng bằng và cảm thụ bản thể (proprioception)",
      "Tăng cường sức mạnh nhóm cơ đùi trước, sau và mông"
    ],
    precautions: [
      "Chỉ bỏ nẹp khi bác sĩ xác nhận mảnh ghép vững và dáng đi không khập khiễng",
      "Luyện tập kiểm soát trục chân: gối luôn hướng thẳng theo ngón chân cái"
    ],
    forbiddenActions: [
      "KHÔNG tham gia các môn thể thao va chạm hoặc đối kháng",
      "KHÔNG thực hiện các động tác xoay vặn trụ chân đột ngột",
      "KHÔNG nhảy tiếp đất từ trên cao"
    ],
    getWeightBearing: (_surgeryType: SurgeryType) => {
      return "Chịu lực toàn bộ bình thường (Full Weight Bearing): Đi lại tự nhiên hai chân cân bằng, không phụ thuộc nạng.";
    },
    getBraceRequirement: (_surgeryType: SurgeryType) => {
      return "Thường đã được bác sĩ cho phép tháo bỏ hoàn toàn nẹp dài nẹp cứng. Có thể dùng băng chun thể thao mềm khi tập nếu cần cảm giác an tâm.";
    },
    getMaxSafeFlexion: (_surgeryType: SurgeryType) => {
      return 135;
    },
    getExercises: (_surgeryType: SurgeryType) => {
      return [
        EXERCISES_DATABASE.quad_sets,
        EXERCISES_DATABASE.heel_slides_progressive,
        EXERCISES_DATABASE.bridge_double_leg,
        EXERCISES_DATABASE.mini_squats,
        EXERCISES_DATABASE.standing_calf_raise,
        EXERCISES_DATABASE.stationary_bike,
        EXERCISES_DATABASE.single_leg_balance,
        EXERCISES_DATABASE.step_ups
      ];
    }
  },
  {
    phaseNumber: 4,
    title: "Giai đoạn 4: Chức năng nâng cao & Trở lại vận động",
    subtitle: "Tháng 4 - Tháng 6 sau phẫu thuật",
    weeksRange: "Tháng 4 - 6",
    minWeeks: 13,
    maxWeeks: 26,
    goals: [
      "Sức mạnh cơ chân phẫu thuật đạt ít nhất 85-90% so với chân lành",
      "Bắt đầu chạy bộ nhẹ nhàng đường thẳng an toàn",
      "Thực hiện các bài tập linh hoạt (agility drills) có kiểm soát trục tốt",
      "Hoàn thiện bài kiểm tra Return to Sport (RTS test)"
    ],
    precautions: [
      "Khởi động kỹ ít nhất 10-15 phút trước mỗi buổi tập thể lực",
      "Tăng dần cường độ tập luyện một cách có hệ thống, không vội vã"
    ],
    forbiddenActions: [
      "KHÔNG thi đấu thể thao đối kháng (đá bóng, bóng rổ, cầu lông) khi chưa vượt qua bài test chức năng 6-9 tháng",
      "KHÔNG đổi hướng đột ngột (cutting movements) trên mặt sân trơn trượt"
    ],
    getWeightBearing: (_surgeryType: SurgeryType) => {
      return "Hoạt động chịu lực hoàn toàn, chịu được lực tác động từ chạy bộ nhẹ và bài tập thể lực chức năng.";
    },
    getBraceRequirement: (_surgeryType: SurgeryType) => {
      return "Không cần nẹp trong sinh hoạt. Có thể dùng đai gối thể thao chức năng khi bắt đầu tập chạy ngoài sân.";
    },
    getMaxSafeFlexion: (_surgeryType: SurgeryType) => {
      return 140;
    },
    getExercises: (_surgeryType: SurgeryType) => {
      return [
        EXERCISES_DATABASE.mini_squats,
        EXERCISES_DATABASE.bridge_double_leg,
        EXERCISES_DATABASE.stationary_bike,
        EXERCISES_DATABASE.single_leg_balance,
        EXERCISES_DATABASE.step_ups,
        EXERCISES_DATABASE.standing_calf_raise,
        EXERCISES_DATABASE.straight_line_jogging
      ];
    }
  }
];

export interface RehabStatus {
  currentDay: number;
  currentWeek: number;
  phase: PhaseProtocol;
  surgeryType: SurgeryType;
  surgeryDate: string;
  allowedFlexionMax: number;
  isMeniscusRepairStrictLimit: boolean;
  weightBearingSummary: string;
  braceSummary: string;
  dangerSigns: string[];
  exercises: Exercise[];
}

export function getRehabStatus(surgeryDateStr: string | Date, surgeryType: SurgeryType = 'ACL_ONLY'): RehabStatus {
  const sDate = new Date(surgeryDateStr);
  const now = new Date();
  
  // Calculate difference in days
  const diffTime = Math.max(0, now.getTime() - sDate.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const currentWeek = Math.max(1, Math.floor(diffDays / 7) + 1);

  // Determine current phase
  let phase: PhaseProtocol = REHAB_PHASES[0];
  if (currentWeek <= 2) {
    phase = REHAB_PHASES[0];
  } else if (currentWeek <= 6) {
    phase = REHAB_PHASES[1];
  } else if (currentWeek <= 12) {
    phase = REHAB_PHASES[2];
  } else {
    phase = REHAB_PHASES[3];
  }

  // Strict check for meniscus repair in weeks 1 to 6
  const isMeniscusRepairStrictLimit = surgeryType === 'ACL_MENISCUS_REPAIR' && currentWeek <= 6;
  const allowedFlexionMax = isMeniscusRepairStrictLimit ? 90 : phase.getMaxSafeFlexion(surgeryType);

  const dangerSigns = [
    "Sưng to căng cứng đột ngột, gối nóng ran và đỏ rực",
    "Đau dữ dội không thuyên giảm kể cả khi dùng thuốc giảm đau và kê cao chân",
    "Bắp chân phía dưới căng cứng, đỏ, đau tức khi gập cổ chân (dấu hiệu nghi ngờ Huyết khối tĩnh mạch sâu - DVT)",
    "Sốt cao trên 38°C kèm ớn lạnh hoặc dịch/mủ bất thường chảy ra từ vết mổ",
    "Khớp gối bị kẹt cứng đột ngột không thể duỗi ra được"
  ];

  return {
    currentDay: diffDays,
    currentWeek,
    phase,
    surgeryType,
    surgeryDate: typeof surgeryDateStr === 'string' ? surgeryDateStr : surgeryDateStr.toISOString().split('T')[0],
    allowedFlexionMax,
    isMeniscusRepairStrictLimit,
    weightBearingSummary: phase.getWeightBearing(surgeryType),
    braceSummary: phase.getBraceRequirement(surgeryType),
    dangerSigns,
    exercises: phase.getExercises(surgeryType)
  };
}
