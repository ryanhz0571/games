export type UnitColor = "blue" | "green" | "orange" | "purple";

export interface LessonMeta {
  id: string;
  title: string;
  subtitle: string;
  available: boolean;
}

export interface Unit {
  id: string;
  name: string;
  emoji: string;
  color: UnitColor;
  description: string;
  lessons: LessonMeta[];
}

export const COURSE: Unit[] = [
  {
    id: "number",
    name: "数与运算",
    emoji: "🔢",
    color: "blue",
    description: "有理数 · 实数 · 运算",
    lessons: [
      {
        id: "number-negative",
        title: "认识负数",
        subtitle: "用符号表示相反意义的量",
        available: true,
      },
      {
        id: "number-axis",
        title: "数轴与相反数",
        subtitle: "数轴 · 相反数",
        available: true,
      },
      {
        id: "number-absolute",
        title: "绝对值",
        subtitle: "到原点的距离",
        available: false,
      },
      {
        id: "number-compare",
        title: "有理数大小比较",
        subtitle: "在数轴上比大小",
        available: false,
      },
    ],
  },
  {
    id: "algebra",
    name: "代数式",
    emoji: "🔤",
    color: "green",
    description: "整式 · 合并同类项",
    lessons: [
      {
        id: "algebra-letter",
        title: "用字母表示数",
        subtitle: "字母代替数",
        available: false,
      },
      {
        id: "algebra-integer",
        title: "整式",
        subtitle: "单项式 · 多项式",
        available: false,
      },
      {
        id: "algebra-combine",
        title: "合并同类项",
        subtitle: "整式的加减",
        available: false,
      },
    ],
  },
  {
    id: "equation",
    name: "方程",
    emoji: "⚖️",
    color: "orange",
    description: "一元一次方程 · 天平",
    lessons: [
      {
        id: "equation-basics",
        title: "等式性质",
        subtitle: "天平保持平衡",
        available: false,
      },
      {
        id: "equation-solve",
        title: "解方程",
        subtitle: "找到未知数",
        available: false,
      },
      {
        id: "equation-apply",
        title: "列方程解应用题",
        subtitle: "把故事翻译成方程",
        available: false,
      },
    ],
  },
  {
    id: "geometry",
    name: "图形与几何",
    emoji: "📐",
    color: "purple",
    description: "线段 · 角 · 相交线",
    lessons: [
      {
        id: "geo-line",
        title: "线段、射线、直线",
        subtitle: "认识图形",
        available: false,
      },
      {
        id: "geo-angle",
        title: "角的度量",
        subtitle: "量角器",
        available: false,
      },
      {
        id: "geo-intersect",
        title: "相交线",
        subtitle: "对顶角 · 垂线",
        available: false,
      },
    ],
  },
];

export interface LessonRef {
  unit: Unit;
  lesson: LessonMeta;
  index: number;
}

export function findLessonById(id: string): LessonRef | null {
  for (const unit of COURSE) {
    const index = unit.lessons.findIndex((lesson) => lesson.id === id);
    if (index >= 0) {
      return { unit, lesson: unit.lessons[index], index };
    }
  }
  return null;
}
