import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { createRoot } from 'react-dom/client';
import { useMasonry, usePositioner, useResizeObserver } from 'masonic';

const INITIAL_BATCH_SIZE = 24;
const LOAD_BATCH_SIZE = 20;
const LOAD_TRIGGER_DISTANCE = 240;

function getColumnCount() {
  if (window.innerWidth <= 719) return 2;
  if (window.innerWidth <= 820) return 4;
  return 5;
}

function getColumnGutter() {
  if (window.innerWidth <= 719) return 8;
  return Math.max(8.8, Math.min(14.4, window.innerWidth * .01));
}

function readGridWidth(element) {
  if (!element) return 1;
  const styles = window.getComputedStyle(element);
  const horizontalPadding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
  return Math.max(1, element.clientWidth - horizontalPadding);
}

function useGalleryGridSize(hostRef) {
  const [size, setSize] = useState({ width: 1, columnCount: getColumnCount(), gutter: getColumnGutter() });

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const update = () => {
      const nextSize = {
        width: readGridWidth(host),
        columnCount: getColumnCount(),
        gutter: getColumnGutter()
      };
      setSize(previous => (
        previous.width === nextSize.width
          && previous.columnCount === nextSize.columnCount
          && previous.gutter === nextSize.gutter
          ? previous
          : nextSize
      ));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    window.addEventListener('resize', update, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [hostRef]);

  return size;
}

function useMainAreaScroll(hostRef) {
  const [scrollState, setScrollState] = useState({ scrollTop: 0, viewportScrollTop: 0, height: 1, scrollHeight: 0, hasUserScrolled: false });
  const previousScrollTop = useRef(0);
  const userScrolled = useRef(false);
  const frame = useRef(0);

  useEffect(() => {
    const mainArea = document.querySelector('.main-area');
    const host = hostRef.current;
    if (!mainArea || !host) return undefined;

    const update = () => {
      frame.current = 0;
      const mainRect = mainArea.getBoundingClientRect();
      const hostRect = host.getBoundingClientRect();
      const hostOffset = hostRect.top - mainRect.top + mainArea.scrollTop;
      const nextScrollTop = Math.max(0, mainArea.scrollTop - hostOffset);
      const nextScrollHeight = mainArea.scrollHeight;
      const nextHasUserScrolled = userScrolled.current || mainArea.scrollTop > previousScrollTop.current + 1;
      userScrolled.current = nextHasUserScrolled;
      previousScrollTop.current = mainArea.scrollTop;
      setScrollState(previous => (
        previous.scrollTop === nextScrollTop
          && previous.viewportScrollTop === mainArea.scrollTop
          && previous.height === mainArea.clientHeight
          && previous.scrollHeight === nextScrollHeight
          && previous.hasUserScrolled === nextHasUserScrolled
          ? previous
          : { scrollTop: nextScrollTop, viewportScrollTop: mainArea.scrollTop, height: mainArea.clientHeight, scrollHeight: nextScrollHeight, hasUserScrolled: nextHasUserScrolled }
      ));
    };

    const scheduleUpdate = () => {
      if (frame.current) return;
      frame.current = window.requestAnimationFrame(update);
    };

    mainArea.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });
    update();
    return () => {
      mainArea.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      if (frame.current) window.cancelAnimationFrame(frame.current);
    };
  }, [hostRef]);

  return scrollState;
}

function GalleryMaterialCard({ data, index, onOpen }) {
  const priority = index < data.columnCount ? 'high' : 'auto';
  return (
    <button
      className={`gallery-card gallery-card--${data.variant} gallery-card--souvenir gallery-card--react`}
      type="button"
      data-cat-name={data.catName}
      data-material-index={data.materialIndex}
      aria-label={`查看${data.catName}的${data.materialLabel}照片`}
      onClick={() => onOpen(data.catName, data.materialIndex)}
    >
      <span className="gallery-card-media">
        <img
          src={data.src}
          alt={data.catName}
          loading={index < data.columnCount ? 'eager' : 'lazy'}
          fetchPriority={priority}
          decoding="async"
        />
      </span>
    </button>
  );
}

function GalleryMasonry({ items, onOpen }) {
  const hostRef = useRef(null);
  const masonryRef = useRef(null);
  const [loadedCount, setLoadedCount] = useState(Math.min(INITIAL_BATCH_SIZE, items.length));
  const [isLoading, setIsLoading] = useState(false);
  const lastLoadScrollTop = useRef(-Infinity);
  const size = useGalleryGridSize(hostRef);
  const scrollState = useMainAreaScroll(hostRef);
  const visibleItems = useMemo(() => items.slice(0, loadedCount), [items, loadedCount]);
  const positioner = usePositioner({
    width: size.width,
    columnCount: size.columnCount,
    columnGutter: size.gutter,
    rowGutter: size.gutter
  }, [size.width, size.columnCount, size.gutter]);
  const resizeObserver = useResizeObserver(positioner);

  useEffect(() => {
    setLoadedCount(Math.min(INITIAL_BATCH_SIZE, items.length));
    lastLoadScrollTop.current = -Infinity;
    setIsLoading(false);
  }, [items]);

  useEffect(() => {
    if (!scrollState.hasUserScrolled || loadedCount >= items.length) return;
    const distanceToBottom = scrollState.scrollHeight - (scrollState.viewportScrollTop + scrollState.height);
    if (distanceToBottom > LOAD_TRIGGER_DISTANCE) return;

    // 一次滚动只请求一批。追加内容后滚动位置不会自动变大，必须等用户
    // 继续向下滚动，才允许下一批触发，避免“加载中”状态自循环。
    if (scrollState.viewportScrollTop <= lastLoadScrollTop.current + 8) return;
    lastLoadScrollTop.current = scrollState.viewportScrollTop;
    setIsLoading(true);
    setLoadedCount(count => Math.min(count + LOAD_BATCH_SIZE, items.length));
  }, [items.length, loadedCount, scrollState.hasUserScrolled, scrollState.height, scrollState.scrollHeight, scrollState.viewportScrollTop]);

  useEffect(() => {
    if (!isLoading) return undefined;
    // 等新一批完成一次布局后再收起提示，避免状态刚切到“加载中”就被
    // 同一轮 effect 立即清掉，也避免内容已追加但提示仍永久转圈。
    const frame = window.requestAnimationFrame(() => {
      setIsLoading(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadedCount, isLoading]);

  const renderItem = useCallback(({ data, index }) => (
    <GalleryMaterialCard
      data={{ ...data, columnCount: size.columnCount }}
      index={index}
      onOpen={onOpen}
    />
  ), [onOpen, size.columnCount]);

  const masonry = useMasonry({
    items: visibleItems,
    positioner,
    resizeObserver,
    containerRef: masonryRef,
    className: 'gallery-masonry-react-grid',
    role: 'list',
    itemAs: 'div',
    itemHeightEstimate: 300,
    itemKey: data => data.key,
    overscanBy: 1,
    scrollTop: scrollState.scrollTop,
    height: scrollState.height,
    isScrolling: Boolean(scrollState.hasUserScrolled),
    render: renderItem
  });

  return (
    <div ref={hostRef} className="gallery-masonry-react-host">
      {masonry}
      {loadedCount < items.length && (
        <div className={`gallery-load-more${isLoading ? '' : ' gallery-load-more--idle'}`} data-gallery-load-more role="status" aria-live="polite">
          {isLoading
            ? <><span className="gallery-load-more-spinner" aria-hidden="true"></span><span>加载中</span></>
            : <span>继续下滑加载更多</span>}
        </div>
      )}
    </div>
  );
}

let activeRoot = null;

function mountGalleryMasonry(host, props) {
  if (!host) return;
  activeRoot?.unmount();
  activeRoot = createRoot(host);
  activeRoot.render(<GalleryMasonry {...props} />);
}

function unmountGalleryMasonry() {
  activeRoot?.unmount();
  activeRoot = null;
}

export { mountGalleryMasonry, unmountGalleryMasonry };
