/** 通常入力と拡大編集で同じ文字数制限を適用する。 */
export function applyTextLengthLimit(currentValue: string, nextValue: string, maxLength?: number) {
  if (!maxLength || nextValue.length <= maxLength) return nextValue;

  // 旧形式の保存データなど、すでに上限を超えている文章は失わず、
  // 上限へ戻すために文字数を減らす編集だけを許可する。
  if (currentValue.length > maxLength) {
    return nextValue.length < currentValue.length ? nextValue : currentValue;
  }

  return nextValue.slice(0, maxLength);
}
