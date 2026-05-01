// Emoji 数据 - Bilibili 风格分类

export interface EmojiItem {
  shortcode: string;
  unicode: string;
  name: string;
}

export interface EmojiCategory {
  name: string;
  slug: string;
  emojis: EmojiItem[];
}

export const emojiCategories: EmojiCategory[] = [
  {
    name: '笑脸',
    slug: 'smileys',
    emojis: [
      { shortcode: 'smile', unicode: '😄', name: '微笑' },
      { shortcode: 'grin', unicode: '😀', name: '咧嘴笑' },
      { shortcode: 'laugh', unicode: '😂', name: '大笑' },
      { shortcode: 'rofl', unicode: '🤣', name: '笑哭' },
      { shortcode: 'wink', unicode: '😉', name: '眨眼' },
      { shortcode: 'blush', unicode: '😊', name: '害羞' },
      { shortcode: 'heart_eyes', unicode: '😍', name: '爱心眼' },
      { shortcode: 'star_eyes', unicode: '🥰', name: '星星眼' },
      { shortcode: 'kiss', unicode: '😘', name: '亲亲' },
      { shortcode: 'happy_cry', unicode: '🥲', name: '感动哭' },
      { shortcode: 'savor', unicode: '😋', name: '美味' },
      { shortcode: 'tongue', unicode: '😜', name: '吐舌' },
      { shortcode: 'crazy', unicode: '🤪', name: '搞怪' },
      { shortcode: 'innocent', unicode: '😇', name: '无辜' },
    ],
  },
  {
    name: '悲伤',
    slug: 'sad',
    emojis: [
      { shortcode: 'sad', unicode: '😢', name: '伤心' },
      { shortcode: 'cry', unicode: '😭', name: '大哭' },
      { shortcode: 'sob', unicode: '😭', name: '啕大哭' },
      { shortcode: 'disappointed', unicode: '😞', name: '失望' },
      { shortcode: 'tired', unicode: '😩', name: '疲惫' },
      { shortcode: 'weary', unicode: '😩', name: '厌烦' },
      { shortcode: 'pleading', unicode: '🥺', name: '乞求' },
      { shortcode: 'broken_heart', unicode: '💔', name: '心碎' },
    ],
  },
  {
    name: '愤怒',
    slug: 'angry',
    emojis: [
      { shortcode: 'angry', unicode: '😠', name: '生气' },
      { shortcode: 'rage', unicode: '😡', name: '暴怒' },
      { shortcode: 'curse', unicode: '🤬', name: '骂人' },
      { shortcode: 'no_good', unicode: '🙅', name: '不行' },
      { shortcode: 'middle_finger', unicode: '🖕', name: '中指' },
    ],
  },
  {
    name: '惊讶',
    slug: 'surprised',
    emojis: [
      { shortcode: 'surprise', unicode: '😲', name: '惊讶' },
      { shortcode: 'shocked', unicode: '😱', name: '震惊' },
      { shortcode: 'flushed', unicode: '😳', name: '脸红' },
      { shortcode: 'dizzy', unicode: '😵', name: '晕' },
      { shortcode: 'exploding_head', unicode: '🤯', name: '脑爆' },
      { shortcode: 'cold_face', unicode: '🥶', name: '冷' },
      { shortcode: 'hot_face', unicode: '🥵', name: '热' },
    ],
  },
  {
    name: '思考',
    slug: 'thinking',
    emojis: [
      { shortcode: 'thinking', unicode: '🤔', name: '思考' },
      { shortcode: 'confused', unicode: '😕', name: '困惑' },
      { shortcode: 'hmm', unicode: '🤨', name: '怀疑' },
      { shortcode: 'neutral', unicode: '😐', name: '中性' },
      { shortcode: 'expressionless', unicode: '😑', name: '无语' },
      { shortcode: 'eyeroll', unicode: '🙄', name: '翻白眼' },
      { shortcode: 'zip_mouth', unicode: '🤐', name: '闭嘴' },
    ],
  },
  {
    name: '动作',
    slug: 'actions',
    emojis: [
      { shortcode: 'clap', unicode: '👏', name: '鼓掌' },
      { shortcode: 'thumbs_up', unicode: '👍', name: '点赞' },
      { shortcode: 'thumbs_down', unicode: '👎', name: '踩' },
      { shortcode: 'fist', unicode: '👊', name: '拳头' },
      { shortcode: 'handshake', unicode: '🤝', name: '握手' },
      { shortcode: 'ok', unicode: '👌', name: 'OK' },
      { shortcode: 'pray', unicode: '🙏', name: '祈祷' },
      { shortcode: 'write', unicode: '✍', name: '写字' },
      { shortcode: 'strong', unicode: '💪', name: '加油' },
    ],
  },
  {
    name: '动物',
    slug: 'animals',
    emojis: [
      { shortcode: 'cat', unicode: '🐱', name: '猫' },
      { shortcode: 'dog', unicode: '🐶', name: '狗' },
      { shortcode: 'mouse', unicode: '🐭', name: '老鼠' },
      { shortcode: 'hamster', unicode: '🐹', name: '仓鼠' },
      { shortcode: 'rabbit', unicode: '🐰', name: '兔子' },
      { shortcode: 'fox', unicode: '🦊', name: '狐狸' },
      { shortcode: 'bear', unicode: '🐻', name: '熊' },
      { shortcode: 'panda', unicode: '🐼', name: '熊猫' },
      { shortcode: 'koala', unicode: '🐨', name: '考拉' },
      { shortcode: 'lion', unicode: '🦁', name: '狮子' },
      { shortcode: 'pig', unicode: '🐷', name: '猪' },
      { shortcode: 'cow', unicode: '🐮', name: '牛' },
      { shortcode: 'monkey', unicode: '🐒', name: '猴子' },
      { shortcode: 'chicken', unicode: '🐔', name: '鸡' },
    ],
  },
  {
    name: '食物',
    slug: 'food',
    emojis: [
      { shortcode: 'watermelon', unicode: '🍉', name: '西瓜' },
      { shortcode: 'apple', unicode: '🍎', name: '苹果' },
      { shortcode: 'banana', unicode: '🍌', name: '香蕉' },
      { shortcode: 'grapes', unicode: '🍇', name: '葡萄' },
      { shortcode: 'strawberry', unicode: '🍓', name: '草莓' },
      { shortcode: 'pizza', unicode: '🍕', name: '披萨' },
      { shortcode: 'burger', unicode: '🍔', name: '汉堡' },
      { shortcode: 'noodles', unicode: '🍜', name: '面条' },
      { shortcode: 'rice', unicode: '🍚', name: '米饭' },
      { shortcode: 'bento', unicode: '🍱', name: '便当' },
      { shortcode: 'coffee', unicode: '☕', name: '咖啡' },
      { shortcode: 'tea', unicode: '🍵', name: '茶' },
      { shortcode: 'beer', unicode: '🍺', name: '啤酒' },
      { shortcode: 'cake', unicode: '🎂', name: '蛋糕' },
    ],
  },
  {
    name: '符号',
    slug: 'symbols',
    emojis: [
      { shortcode: 'heart', unicode: '❤', name: '爱心' },
      { shortcode: 'orange_heart', unicode: '🧡', name: '橙心' },
      { shortcode: 'yellow_heart', unicode: '💛', name: '黄心' },
      { shortcode: 'green_heart', unicode: '💚', name: '绿心' },
      { shortcode: 'blue_heart', unicode: '💙', name: '蓝心' },
      { shortcode: 'purple_heart', unicode: '💜', name: '紫心' },
      { shortcode: 'black_heart', unicode: '🖤', name: '黑心' },
      { shortcode: 'sparkles', unicode: '✨', name: '闪光' },
      { shortcode: 'star', unicode: '⭐', name: '星星' },
      { shortcode: 'fire', unicode: '🔥', name: '火' },
      { shortcode: 'lightning', unicode: '⚡', name: '闪电' },
      { shortcode: 'check', unicode: '✅', name: '正确' },
      { shortcode: 'cross', unicode: '❌', name: '错误' },
      { shortcode: 'question', unicode: '❓', name: '疑问' },
      { shortcode: 'exclamation', unicode: '❗', name: '感叹' },
    ],
  },
];

// 快捷映射：shortcode -> unicode
export const emojiMap: Record<string, string> = {};
emojiCategories.forEach(cat => {
  cat.emojis.forEach(emoji => {
    emojiMap[emoji.shortcode] = emoji.unicode;
  });
});

// 获取所有 emoji 列表（用于搜索）
export const allEmojis: EmojiItem[] = emojiCategories.flatMap(cat => cat.emojis);