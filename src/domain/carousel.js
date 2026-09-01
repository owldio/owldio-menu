export function advanceCarouselIndex(currentIndex, direction, itemCount) {
  if (itemCount <= 0) return 0;
  return (currentIndex + direction + itemCount) % itemCount;
}

export function relativeCarouselOffset(itemIndex, activeIndex, itemCount) {
  if (itemCount <= 0) return 0;
  const forwardOffset = (itemIndex - activeIndex + itemCount) % itemCount;
  return forwardOffset > itemCount / 2 ? forwardOffset - itemCount : forwardOffset;
}
