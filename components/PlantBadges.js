'use client';
import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getPlantBadges, getBadgeTooltip } from '@/lib/plantBadges';
import styles from './PlantBadges.module.css';

const BADGE_TITLES = {
  bee: 'Supports Bees',
};

export default function PlantBadges({ commonName, scientificName, size }) {
  const badges = getPlantBadges(commonName, scientificName);
  const [activeTip, setActiveTip] = useState(null);
  const [tipStyle, setTipStyle] = useState(null);

  const showTip = useCallback((e, key) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTipStyle({
      position: 'fixed',
      bottom: window.innerHeight - rect.top + 10,
      left: rect.left + rect.width / 2,
      transform: 'translateX(-50%)',
    });
    setActiveTip(key);
  }, []);

  const hideTip = useCallback(() => setActiveTip(null), []);

  const handleClick = useCallback((e, key) => {
    e.preventDefault();
    e.stopPropagation();
    if (activeTip === key) {
      setActiveTip(null);
    } else {
      showTip(e, key);
    }
  }, [activeTip, showTip]);

  if (!badges.length) return null;

  return (
    <div className={`${styles.container} ${size === 'large' ? styles.containerLarge : ''}`}>
      {badges.map((b) => (
        <div
          key={b.key}
          className={styles.badge}
          onMouseEnter={(e) => showTip(e, b.key)}
          onMouseLeave={hideTip}
          onClick={(e) => handleClick(e, b.key)}
        >
          <img src={b.icon} alt={getBadgeTooltip(b.key, commonName, scientificName).join(', ')} className={`${styles.icon} ${size === 'large' ? styles.iconLarge : ''}`} />
          {activeTip === b.key && typeof document !== 'undefined' &&
            createPortal(
              <div className={styles.tooltip} style={tipStyle}>
                <div className={styles.tooltipHeader}>
                  <img src={b.icon} alt="" className={styles.tooltipHeaderIcon} />
                  {BADGE_TITLES[b.key] || b.key}
                </div>
                <div className={styles.tooltipBody}>
                  {getBadgeTooltip(b.key, commonName, scientificName).map((line, i) => (
                    <span key={i} className={styles.tooltipItem}>
                      <span className={styles.tooltipDot} />
                      {line}
                    </span>
                  ))}
                </div>
              </div>,
              document.body
            )
          }
        </div>
      ))}
    </div>
  );
}
