import { SurgeryType, SURGERY_DETAILS } from './rehabProtocols';

export type MilestoneStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'AWAITING_ASSESSMENT' | 'CONFIRMED';

export interface Milestone {
  id: string;
  phaseNumber: number;
  title: string;
  description: string;
  targetCriteria: string;
  status: MilestoneStatus;
  achievedDate?: string;
  clinicianVerified?: boolean;
}

export interface ExercisePrescriptionItem {
  exerciseId: string;
  title: string;
  vietnameseName: string;
  targetSets: number;
  targetReps: number;
  holdSec: number;
  restSec: number;
  instructions: string[];
  safetyNote?: string;
  maxFlexionAngle?: number;
}

export interface DailyExerciseSession {
  id: string;
  dayNumber: number;
  weekNumber: number;
  title: string;
  focus: string;
  estimatedMinutes: number;
  exercises: ExercisePrescriptionItem[];
  completed: boolean;
  completedAt?: string;
}

export interface SessionFeedback {
  sessionId: string;
  completedAt: string;
  rpeScore: number; // 1-10 Rating of Perceived Exertion
  painDuringSession: number; // 1-10 VAS
  notes: string;
}

export interface ROMRecord {
  id: string;
  recordedAt: string;
  flexionAngle: number;
  extensionAngle: number;
  leg: 'left' | 'right';
  isSafe: boolean;
  safeLimit: number;
  source: 'camera_ai' | 'manual' | 'photo';
}

export interface DailyRecoveryLog {
  id: string;
  date: string;
  painScore: number;
  swellingLevel: 'none' | 'mild' | 'moderate' | 'severe';
  iceDone: boolean;
  functionalConfidence: number; // 1-10
  patientNotes: string;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  summary: string;
  category: 'protocol' | 'safety' | 'nutrition' | 'faq';
  readTime: string;
  content: string[];
  importantNotice?: string;
}

export interface RecoveryCase {
  id: string;
  patientName: string;
  surgeryDate: string;
  surgeryType: SurgeryType;
  surgeryLeg: 'left' | 'right';
  currentPhase: number;
  weightBearingStatus: string;
  braceRequirement: string;
  maxSafeFlexion: number;
  milestones: Milestone[];
  dailySessions: DailyExerciseSession[];
  sessionFeedbacks: SessionFeedback[];
  romHistory: ROMRecord[];
  dailyLogs: DailyRecoveryLog[];
  clinicalPendingVerification: boolean;
}

export const INITIAL_MILESTONES: Milestone[] = [
  {
    id: 'm1_extension',
    phaseNumber: 1,
    title: 'Đạt độ duỗi gối thẳng 0°',
    description: 'Ưu tiên sống còn sau mổ ACL để phòng ngừa mất duỗi và dáng đi khập khiễng vĩnh viễn.',
    targetCriteria: 'Khớp gối duỗi thẳng hoàn toàn 0° chạm mặt phẳng không cần đè ép lực.',
    status: 'IN_PROGRESS',
  },
  {
    id: 'm1_quad_control',
    phaseNumber: 1,
    title: 'Kích hoạt gồng cơ tứ đầu đùi (Quad Lag = 0)',
    description: 'Có thể siết cơ đùi và nâng thẳng chân có nẹp (Straight Leg Raise) mà không bị chùng gối.',
    targetCriteria: 'Nâng chân thẳng giữ vững 5 giây × 10 lần liên tục.',
    status: 'NOT_STARTED',
  },
  {
    id: 'm1_flexion_safe',
    phaseNumber: 1,
    title: 'Gập gối đạt 90° an toàn',
    description: 'Phục hồi biên độ gập góc vuông. Với ca khâu sụn chêm: Tuyệt đối không vượt quá 90°!',
    targetCriteria: 'Trượt gót chủ động đạt góc 90° không gây đau chói.',
    status: 'NOT_STARTED',
  },
  {
    id: 'm2_gait_transition',
    phaseNumber: 2,
    title: 'Chuyển đổi dáng đi bỏ dần 2 nạng',
    description: 'Tập chịu lực tăng dần, đi lại hai chân cân đối không khập khiễng.',
    targetCriteria: 'Bác sĩ/chuyên gia VLTL kiểm tra và cho phép chuyển từ 2 nạng sang 1 nạng/bỏ nạng.',
    status: 'NOT_STARTED',
  },
  {
    id: 'm3_full_rom',
    phaseNumber: 3,
    title: 'Đạt biên độ gập tối đa (125° - 135°)',
    description: 'Biên độ gập gối hồi phục hoàn toàn tương đương với chân lành.',
    targetCriteria: 'Gập gối đạt trên 130° không còn cảm giác căng tức bao khớp.',
    status: 'NOT_STARTED',
  },
  {
    id: 'm4_rts_testing',
    phaseNumber: 4,
    title: 'Vượt qua bài test Trở lại Thể thao (RTS Test)',
    description: 'Sức mạnh cơ đùi đạt ít nhất 90% so với chân lành, kiểm soát trục chân nhảy tiếp đất vững vàng.',
    targetCriteria: 'Hoàn tất bài kiểm tra Y-Balance test và Hop test lâm sàng.',
    status: 'NOT_STARTED',
  },
];

export const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    id: 'art-meniscus-protection',
    title: 'Tại sao khâu sụn chêm phải kiêng gập quá 90° và cấm tì đè trong 6 tuần?',
    summary: 'Giải thích cơ sinh học của mối khâu sụn chêm và nguy cơ bục chỉ khi gập sâu hoặc tì chân sớm.',
    category: 'safety',
    readTime: '3 phút đọc',
    content: [
      'Sụn chêm (Meniscus) là lớp đệm giảm chấn giữa xương đùi và xương chày. Khi sụn chêm bị rách và được khâu phục hồi, các mối chỉ khâu rất mỏng manh và cần tối thiểu 6 tuần để mô sụn bắt đầu liền sinh học.',
      'Khi khớp gối gập quá 90 độ, lồi cầu xương đùi sẽ trượt ra phía sau và ép một áp lực cắt (shear stress) cực lớn lên sừng sau sụn chêm — nơi thường xảy ra mối khâu.',
      'Việc tì đè trọng lượng cơ thể (chống chân đi lại) cũng sẽ nén ép trực tiếp làm rách toác mối khâu trước khi nó kịp liền sẹo, biến ca phẫu thuật khâu bảo tồn trở thành thất bại.',
      'Do đó: Luôn dùng 2 nạng nách, nhấc lơ lửng chân mổ (NWB hoàn toàn) và khóa chặt nẹp thẳng gối ở 0° khi đứng dậy!'
    ],
    importantNotice: 'Bệnh nhân khâu sụn chêm tuyệt đối tuân thủ quy tắc 6 tuần vàng này.'
  },
  {
    id: 'art-extension-importance',
    title: 'Duỗi gối thẳng 0° — Mục tiêu quan trọng số 1 sau mổ ACL',
    summary: 'Nhiều bệnh nhân quá lo lắng về việc gập gối mà quên mất rằng mất độ duỗi thẳng mới là biến chứng khó chữa nhất.',
    category: 'protocol',
    readTime: '4 phút đọc',
    content: [
      'Sau mổ tái tạo dây chằng chéo trước, hầu hết mọi người đều có thể lấy lại góc gập gối từ từ theo thời gian. Tuy nhiên, nếu bạn để mất độ duỗi gối thẳng 0° trong 2 tuần đầu, bao khớp sau và mảnh ghép sẽ bị xơ hóa co rút.',
      'Mất chỉ 5 độ duỗi cũng sẽ khiến bạn đi khập khiễng vĩnh viễn, thoái hóa khớp bánh chè đùi sớm và đau lưng mạn tính.',
      'HÃY NHỚ: Tuyệt đối KHÔNG kê gối dưới khoeo chân khi nằm ngủ. Hãy kê gối hoặc cuộn khăn dưới gót chân để trọng lực kéo gối duỗi thẳng tự nhiên.'
    ]
  },
  {
    id: 'art-ice-therapy',
    title: 'Liệu pháp Chườm Đá Lạnh đúng chuẩn Y Khoa (R.I.C.E)',
    summary: 'Cách chườm đá giảm sưng đau hiệu quả mà không gây bỏng lạnh tổn thương mô mềm.',
    category: 'safety',
    readTime: '3 phút đọc',
    content: [
      'Chườm đá lạnh là biện pháp giảm đau tự nhiên và co mạch giảm ứ trệ phù nề hữu hiệu nhất.',
      'Quy tắc vàng: Mỗi lần chườm đúng 15 đến 20 phút. Không chườm quá 25 phút vì cơ thể sẽ phản xạ giãn mạch thứ phát (Hunting reflex), làm sưng to hơn.',
      'Luôn bọc túi đá hoặc gel lạnh trong 1 lớp khăn bông mỏng sạch. Không đặt đá trực tiếp lên da trần hoặc vết mổ chưa liền sẹo.',
      'Kết hợp nâng cao chân mổ cao hơn mức tim khi chườm đá.'
    ]
  },
  {
    id: 'art-nutrition',
    title: 'Dinh dưỡng phục hồi dây chằng và sụn khớp sau phẫu thuật',
    summary: 'Bổ sung Protein, Collagen type II, Vitamin C và Kẽm để đẩy nhanh tốc độ liền gân xương.',
    category: 'nutrition',
    readTime: '4 phút đọc',
    content: [
      'Giai đoạn tái tạo mạch máu và tích tụ collagen cho mảnh ghép ACL đòi hỏi hàm lượng đạm cao (1.5 - 2.0g protein/kg thể trọng/ngày).',
      'Vitamin C và Kẽm đóng vai trò xúc tác bắt buộc để cơ thể tổng hợp sợi collagen liên kết.',
      'Uống đủ 2 - 2.5 lít nước mỗi ngày giúp bôi trơn hoạt dịch khớp và hạn chế lắng đọng acid uric gây đau mỏi cơ.'
    ]
  }
];
