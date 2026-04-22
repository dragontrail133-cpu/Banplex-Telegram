import { useMemo, useState } from 'react'
import { AppButton } from './AppPrimitives'

function getItemKey(item, index, keyExtractor) {
  if (typeof keyExtractor === 'function') {
    return keyExtractor(item, index)
  }

  if (item && typeof item === 'object') {
    return item.id ?? item.key ?? index
  }

  return index
}

function SmartList({
  data = [],
  renderItem,
  keyExtractor,
  as = 'div',
  className = '',
  itemClassName = '',
  emptyState = null,
  loadMoreStep = 20,
  initialCount = 20,
  loadMoreLabel = 'Muat Lebih Banyak',
  loadMoreClassName = '',
  footerClassName = '',
}) {
  const normalizedInitialCount = Math.max(initialCount, 0)
  const normalizedLoadMoreStep = Math.max(loadMoreStep, 1)
  const [visibleCount, setVisibleCount] = useState(() => {
    return normalizedInitialCount
  })

  const safeVisibleCount = Math.min(visibleCount, data.length)
  const itemsToRender = useMemo(
    () => data.slice(0, safeVisibleCount),
    [data, safeVisibleCount]
  )

  const ContainerTag = as === 'ul' ? 'ul' : 'div'
  const ItemTag = as === 'ul' ? 'li' : 'div'

  const canLoadMore = safeVisibleCount < data.length
  const handleLoadMore = () => {
    setVisibleCount((currentCount) => {
      if (currentCount >= data.length) {
        return currentCount
      }

      return Math.min(currentCount + normalizedLoadMoreStep, data.length)
    })
  }

  if (itemsToRender.length === 0) {
    return emptyState
  }

  return (
    <ContainerTag className={className}>
      {itemsToRender.map((item, index) => {
        const itemKey = getItemKey(item, index, keyExtractor)

        return (
          <ItemTag key={itemKey} className={itemClassName}>
            {renderItem(item, index)}
          </ItemTag>
        )
      })}
      {canLoadMore ? (
        <div className={`pt-2 ${footerClassName}`}>
          <AppButton
            className={`w-full ${loadMoreClassName}`}
            onClick={handleLoadMore}
            fullWidth
            size="lg"
            type="button"
            variant="secondary"
          >
            {loadMoreLabel}
          </AppButton>
        </div>
      ) : null}
    </ContainerTag>
  )
}

export default SmartList
