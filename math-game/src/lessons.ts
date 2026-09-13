export type QuestionType = "choice" | "numberline" | "input" | "truefalse" | "order";
export type Answer = string | number | boolean | string[];

export interface Question {
  type: QuestionType;
  prompt: string;
  hint: string;
  explain: string;
  choices?: string[];
  min?: number;
  max?: number;
  tolerance?: number;
  unit?: string;
  items?: string[];
  answer: Answer;
}

/**
 * 题库按难度从易到难排列，跑得越远遇到的题越难。
 */
export const LESSONS: Record<string, Question[]> = {
  "number-negative": [
    {
      type: "choice",
      prompt: "“比 0 低 5 的量”应该记作哪个数？",
      hint: "比 0 低，就是往负的方向走。",
      explain: "比 0 低 5 记作 −5。",
      choices: ["5", "−5", "0"],
      answer: "−5",
    },
    {
      type: "numberline",
      prompt: "把 −3 拖到数轴上正确的位置。",
      hint: "从 0 出发，往左走 3 格就是 −3。",
      explain: "负数在 0 的左边，−3 在 0 左边第 3 格。",
      min: -6,
      max: 6,
      tolerance: 0.5,
      answer: -3,
    },
    {
      type: "input",
      prompt: "−8 的相反数是几？",
      hint: "相反数到 0 的距离一样，方向相反。",
      explain: "−8 的相反数是 8。",
      answer: 8,
    },
    {
      type: "choice",
      prompt: "在 −2、0、3、−7 这四个数里，最小的是哪个？",
      hint: "在数轴上越靠左的数越小。",
      explain: "−7 在最左边，所以它最小。",
      choices: ["−2", "0", "−7"],
      answer: "−7",
    },
    {
      type: "truefalse",
      prompt: "−6 比 −1 小。",
      hint: "数轴上越靠左越小，−6 和 −1 谁更靠左？",
      explain: "−6 在 −1 的左边，所以 −6 比 −1 小。",
      answer: true,
    },
    {
      type: "input",
      prompt: "|−9| 等于多少？",
      hint: "绝对值表示这个数到原点的距离，距离总是非负的。",
      explain: "−9 到原点的距离是 9，所以 |−9| = 9。",
      answer: 9,
    },
    {
      type: "input",
      prompt: "−5 + 2 等于多少？",
      hint: "从 −5 出发，向右走 2 格。",
      explain: "从 −5 向右走 2 格到 −3，所以 −5 + 2 = −3。",
      answer: -3,
    },
    {
      type: "choice",
      prompt: "3 − 7 等于多少？",
      hint: "从 3 出发向左走 7 格。",
      explain: "从 3 向左走 7 格到 −4，所以 3 − 7 = −4。",
      choices: ["−4", "4", "−10"],
      answer: "−4",
    },
    {
      type: "input",
      prompt: "电梯从 4 楼一直下到 −2 楼，一共下降了几层？",
      hint: "先数 4 到 0 有几层，再数 0 到 −2 有几层。",
      explain: "4 到 0 是 4 层，0 到 −2 是 2 层，一共 6 层。",
      unit: "层",
      answer: 6,
    },
    {
      type: "order",
      prompt: "把这些数从小到大排好。",
      hint: "画一条数轴，从左到右就是从最小到最大。",
      explain: "−6 < −1 < 0 < 2 < 4。",
      items: ["2", "−6", "0", "−1", "4"],
      answer: ["−6", "−1", "0", "2", "4"],
    },
    {
      type: "input",
      prompt: "比 −3 小 4 的数是多少？",
      hint: "“小 4”就是从 −3 再往左走 4 格。",
      explain: "−3 − 4 = −7。",
      answer: -7,
    },
    {
      type: "truefalse",
      prompt: "两个负数相加，结果一定是负数。",
      hint: "两个都往左走，会走到哪里？",
      explain: "两个负数相加相当于一直往左走，结果一定是负数。",
      answer: true,
    },
  ],
  "number-axis": [
    {
      type: "choice",
      prompt: "3 的相反数是哪个数？",
      hint: "相反数到 0 的距离一样，方向相反。",
      explain: "3 的相反数是 −3。",
      choices: ["3", "−3", "0"],
      answer: "−3",
    },
    {
      type: "numberline",
      prompt: "把 −4 的相反数拖到数轴上正确的位置。",
      hint: "先算出 −4 的相反数，再拖到数轴上。",
      explain: "−4 的相反数是 4，在 0 右边第 4 格。",
      min: -6,
      max: 6,
      tolerance: 0.5,
      answer: 4,
    },
    {
      type: "input",
      prompt: "−(−6) 等于多少？",
      hint: "一个数前面再加一个负号，就变成它的相反数。",
      explain: "−6 的相反数是 6，所以 −(−6) = 6。",
      answer: 6,
    },
    {
      type: "input",
      prompt: "−|−7| 等于多少？",
      hint: "先算绝对值 |−7|，再在最前面加上负号。",
      explain: "|−7| = 7，所以 −|−7| = −7。",
      answer: -7,
    },
    {
      type: "choice",
      prompt: "哪个数的相反数等于它自己？",
      hint: "哪个数在数轴上关于原点对称后还是它自己？",
      explain: "只有 0 的相反数还是 0。",
      choices: ["1", "−1", "0"],
      answer: "0",
    },
    {
      type: "input",
      prompt: "在数轴上，与 −2 相距 5 个单位、并且在 −2 右边的是哪个数？",
      hint: "在 −2 右边，就是 −2 加上 5。",
      explain: "−2 + 5 = 3，所以这个数是 3。",
      answer: 3,
    },
    {
      type: "truefalse",
      prompt: "互为相反数的两个数，到原点的距离相等。",
      hint: "相反数在数轴上是关于原点对称的。",
      explain: "关于原点对称的两点到原点距离相等，所以这句话是对的。",
      answer: true,
    },
    {
      type: "order",
      prompt: "把这些数从小到大排好。",
      hint: "先找到最小的负数，再依次往右排。",
      explain: "−4 < −1 < 0 < 3。",
      items: ["3", "−4", "0", "−1"],
      answer: ["−4", "−1", "0", "3"],
    },
  ],
};
