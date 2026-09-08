export interface EnglishWord {
  word: string;
  zh: string;
}

export interface WordUnit {
  id: string;
  label: string;
  words: EnglishWord[];
}

// 词库对应人教版（2024 版）七年级上册的单元主题，与杭州使用的课标框架一致。
export const WORD_UNITS: WordUnit[] = [
  {
    id: "starter-1",
    label: "Starter 1 · Hello!",
    words: [
      { word: "hello", zh: "你好" },
      { word: "hi", zh: "嗨" },
      { word: "name", zh: "名字" },
      { word: "meet", zh: "遇见" },
      { word: "nice", zh: "令人愉快的" },
      { word: "friend", zh: "朋友" },
      { word: "teacher", zh: "老师" },
      { word: "student", zh: "学生" },
      { word: "morning", zh: "早晨" },
      { word: "afternoon", zh: "下午" },
      { word: "evening", zh: "晚上" },
      { word: "goodbye", zh: "再见" },
      { word: "welcome", zh: "欢迎" },
    ],
  },
  {
    id: "unit-1",
    label: "Unit 1 · You and Me",
    words: [
      { word: "age", zh: "年龄" },
      { word: "old", zh: "……岁的；老的" },
      { word: "year", zh: "年" },
      { word: "from", zh: "来自" },
      { word: "China", zh: "中国" },
      { word: "class", zh: "班级" },
      { word: "grade", zh: "年级" },
      { word: "who", zh: "谁" },
      { word: "what", zh: "什么" },
      { word: "twelve", zh: "十二" },
      { word: "phone", zh: "电话" },
      { word: "number", zh: "号码" },
    ],
  },
  {
    id: "unit-2",
    label: "Unit 2 · We're Family!",
    words: [
      { word: "family", zh: "家庭" },
      { word: "mother", zh: "母亲" },
      { word: "father", zh: "父亲" },
      { word: "brother", zh: "兄弟" },
      { word: "sister", zh: "姐妹" },
      { word: "grandpa", zh: "爷爷/外公" },
      { word: "grandma", zh: "奶奶/外婆" },
      { word: "uncle", zh: "叔叔/舅舅" },
      { word: "aunt", zh: "阿姨/姑姑" },
      { word: "cousin", zh: "堂/表兄弟姐妹" },
      { word: "parent", zh: "父/母亲" },
      { word: "home", zh: "家" },
    ],
  },
  {
    id: "unit-3",
    label: "Unit 3 · My School",
    words: [
      { word: "school", zh: "学校" },
      { word: "classroom", zh: "教室" },
      { word: "library", zh: "图书馆" },
      { word: "playground", zh: "操场" },
      { word: "office", zh: "办公室" },
      { word: "map", zh: "地图" },
      { word: "desk", zh: "书桌" },
      { word: "chair", zh: "椅子" },
      { word: "book", zh: "书" },
      { word: "pen", zh: "钢笔" },
      { word: "pencil", zh: "铅笔" },
      { word: "ruler", zh: "尺子" },
      { word: "where", zh: "在哪里" },
    ],
  },
  {
    id: "unit-4",
    label: "Unit 4 · Favourite Subject",
    words: [
      { word: "subject", zh: "学科" },
      { word: "maths", zh: "数学" },
      { word: "English", zh: "英语" },
      { word: "Chinese", zh: "语文" },
      { word: "music", zh: "音乐" },
      { word: "art", zh: "美术" },
      { word: "science", zh: "科学" },
      { word: "history", zh: "历史" },
      { word: "easy", zh: "容易的" },
      { word: "fun", zh: "有趣的" },
      { word: "interesting", zh: "有意思的" },
      { word: "difficult", zh: "困难的" },
      { word: "because", zh: "因为" },
    ],
  },
  {
    id: "unit-5",
    label: "Unit 5 · Fun Clubs",
    words: [
      { word: "club", zh: "社团" },
      { word: "join", zh: "加入" },
      { word: "dance", zh: "跳舞" },
      { word: "sing", zh: "唱歌" },
      { word: "draw", zh: "画画" },
      { word: "swim", zh: "游泳" },
      { word: "play", zh: "玩；打（球）" },
      { word: "chess", zh: "国际象棋" },
      { word: "guitar", zh: "吉他" },
      { word: "piano", zh: "钢琴" },
      { word: "drum", zh: "鼓" },
      { word: "paint", zh: "涂色" },
      { word: "read", zh: "阅读" },
      { word: "sports", zh: "运动" },
    ],
  },
  {
    id: "unit-6",
    label: "Unit 6 · A Day in the Life",
    words: [
      { word: "get up", zh: "起床" },
      { word: "breakfast", zh: "早餐" },
      { word: "lunch", zh: "午餐" },
      { word: "dinner", zh: "晚餐" },
      { word: "homework", zh: "家庭作业" },
      { word: "sleep", zh: "睡觉" },
      { word: "clock", zh: "时钟" },
      { word: "time", zh: "时间" },
      { word: "morning", zh: "上午" },
      { word: "noon", zh: "中午" },
      { word: "evening", zh: "傍晚" },
      { word: "half", zh: "一半" },
      { word: "o'clock", zh: "……点钟" },
    ],
  },
  {
    id: "unit-7",
    label: "Unit 7 · Happy Birthday!",
    words: [
      { word: "birthday", zh: "生日" },
      { word: "date", zh: "日期" },
      { word: "month", zh: "月份" },
      { word: "cake", zh: "蛋糕" },
      { word: "party", zh: "聚会" },
      { word: "gift", zh: "礼物" },
      { word: "present", zh: "礼物" },
      { word: "card", zh: "贺卡" },
      { word: "January", zh: "一月" },
      { word: "May", zh: "五月" },
      { word: "June", zh: "六月" },
      { word: "October", zh: "十月" },
      { word: "December", zh: "十二月" },
    ],
  },
];

export function getUnit(id: string): WordUnit {
  return WORD_UNITS.find((unit) => unit.id === id) ?? WORD_UNITS[0];
}

export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
