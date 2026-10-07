import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react';
import { createRoot } from 'react-dom/client';
import { useMasonry, usePositioner, useResizeObserver } from 'masonic';

function getColumnCount() {
  if (window.innerWidth <= 719) return 2;
  if (window.innerWidth <= 820) return 4;
  return 5;
}

function getColumnGutter() {
  if (window.innerWidth <= 719) return 8;
  return Math.max(8.8, Math.min(14.4, window.innerWidth * .01));
}

function getOverscanBy(columnCount) {
  return columnCount <= 2 ? 1 : 3;
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
  const [scrollState, setScrollState] = useState({ scrollTop: 0, viewportScrollTop: 0, height: 1, scrollHeight: 0, hasUserScrolled: false, isScrolling: false });
  const previousScrollTop = useRef(0);
  const userScrolled = useRef(false);
  const scrolling = useRef(false);
  const frame = useRef(0);
  const scrollStopTimer = useRef(0);

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
      const nextIsScrolling = scrolling.current;
      userScrolled.current = nextHasUserScrolled;
      previousScrollTop.current = mainArea.scrollTop;
      setScrollState(previous => (
        previous.scrollTop === nextScrollTop
          && previous.viewportScrollTop === mainArea.scrollTop
          && previous.height === mainArea.clientHeight
          && previous.scrollHeight === nextScrollHeight
          && previous.hasUserScrolled === nextHasUserScrolled
          && previous.isScrolling === nextIsScrolling
          ? previous
          : { scrollTop: nextScrollTop, viewportScrollTop: mainArea.scrollTop, height: mainArea.clientHeight, scrollHeight: nextScrollHeight, hasUserScrolled: nextHasUserScrolled, isScrolling: nextIsScrolling }
      ));
    };

    const scheduleUpdate = isScrollEvent => {
      if (isScrollEvent) {
        scrolling.current = true;
        if (scrollStopTimer.current) window.clearTimeout(scrollStopTimer.current);
        scrollStopTimer.current = window.setTimeout(() => {
          scrolling.current = false;
          setScrollState(previous => previous.isScrolling ? { ...previous, isScrolling: false } : previous);
        }, 120);
      }
      if (frame.current) return;
      frame.current = window.requestAnimationFrame(update);
    };

    const handleScroll = () => scheduleUpdate(true);
    const handleResize = () => scheduleUpdate(false);
    mainArea.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    update();
    return () => {
      mainArea.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      if (frame.current) window.cancelAnimationFrame(frame.current);
      if (scrollStopTimer.current) window.clearTimeout(scrollStopTimer.current);
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
          loading="eager"
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
  const size = useGalleryGridSize(hostRef);
  const scrollState = useMainAreaScroll(hostRef);
  const overscanBy = getOverscanBy(size.columnCount);
  const positioner = usePositioner({
    width: size.width,
    columnCount: size.columnCount,
    columnGutter: size.gutter,
    rowGutter: size.gutter
  }, [size.width, size.columnCount, size.gutter]);
  const resizeObserver = useResizeObserver(positioner);

  const renderItem = useCallback(({ data, index }) => (
    <GalleryMaterialCard
      data={{ ...data, columnCount: size.columnCount }}
      index={index}
      onOpen={onOpen}
    />
  ), [onOpen, size.columnCount]);

  const masonry = useMasonry({
    items,
    positioner,
    resizeObserver,
    containerRef: masonryRef,
    className: 'gallery-masonry-react-grid',
    role: 'list',
    itemAs: 'div',
    itemHeightEstimate: 300,
    itemKey: data => data.key,
    overscanBy,
    scrollTop: scrollState.scrollTop,
    height: scrollState.height,
    isScrolling: scrollState.isScrolling,
    render: renderItem
  });

  return (
    <div ref={hostRef} className="gallery-masonry-react-host">
      {masonry}
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
