function escapeMarkdownV2(text) {
  return text.replace(
    /(\_|\.|\*|\[|\]|\(|\)|~|`|>|#|\+|-|=|\||\{|\}|!)/g,
    "\\$1"
  );
}

const truncateText = (text, maxLength = 30) => {
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
};

module.exports = {escapeMarkdownV2, truncateText};
