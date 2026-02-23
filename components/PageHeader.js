'use client';
import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import Link from 'next/link';
import { BackButton } from './Button';
import styles from './PageHeader.module.css';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export default function PageHeader({ 
  title, 
  onBack, 
  backHref,
  actions 
}) {
  const hasLeft = !!(onBack || backHref);
  const hasRight = !!actions;

  const [centered, setCentered] = useState(true);
  const headerRef = useRef(null);
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const titleRef = useRef(null);

  useIsomorphicLayoutEffect(() => {
    const update = () => {
      const header = headerRef.current;
      const titleEl = titleRef.current;
      if (!header || !titleEl) return;

      const headerW = header.offsetWidth;
      const gap = parseFloat(getComputedStyle(header).gap) || 16;
      const leftW = leftRef.current ? leftRef.current.offsetWidth + gap : 0;
      const rightW = rightRef.current ? rightRef.current.offsetWidth + gap : 0;
      const maxSide = Math.max(leftW, rightW);

      // Temporarily let the title be unshrunk to measure its natural width
      titleEl.style.position = 'absolute';
      titleEl.style.width = 'auto';
      titleEl.style.maxWidth = 'none';
      titleEl.style.flex = 'none';
      const titleW = titleEl.scrollWidth;
      titleEl.style.position = '';
      titleEl.style.width = '';
      titleEl.style.maxWidth = '';
      titleEl.style.flex = '';

      setCentered(headerW / 2 >= maxSide + titleW / 2);
    };

    update();

    const ro = new ResizeObserver(update);
    if (headerRef.current) ro.observe(headerRef.current);
    if (titleRef.current) ro.observe(titleRef.current);
    if (leftRef.current) ro.observe(leftRef.current);
    if (rightRef.current) ro.observe(rightRef.current);

    return () => ro.disconnect();
  }, [title, hasLeft, hasRight]);

  return (
    <header
      ref={headerRef}
      className={`${styles.header} ${centered ? styles.headerCentered : ''}`}
    >
      {hasLeft && (
        <div className={styles.left} ref={leftRef}>
          {backHref ? (
            <Link href={backHref} className={styles.backLink}>
              <BackButton as="div" />
            </Link>
          ) : (
            <BackButton onClick={onBack} />
          )}
        </div>
      )}
      <h1
        ref={titleRef}
        className={`${styles.title} ${centered ? styles.titleCentered : ''}`}
      >
        {title}
      </h1>
      {hasRight && (
        <div className={styles.right} ref={rightRef}>
          {actions}
        </div>
      )}
    </header>
  );
}