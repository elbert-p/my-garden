'use client';
import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getPlantBadges, getBadgeTooltip } from '@/lib/plantBadges';
import styles from './PlantBadges.module.css';

export default function PlantBadges({ commonName, scientificName, size }) {
  const badges = getPlantBadges(commonName, scientificName);
  const [activeTip, setActiveTip] = useState(null);
  const [tipStyle, setTipStyle] = useState(null);

  const showTip = useCallback((e, key) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTipStyle({
      position: 'fixed',
      bottom: window.innerHeight - rect.top + 6,
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
          <img src={b.icon} alt={getBadgeTooltip(b.key, commonName, scientificName)} className={`${styles.icon} ${size === 'large' ? styles.iconLarge : ''}`} />
          {activeTip === b.key && typeof document !== 'undefined' &&
            createPortal(
              <span className={styles.tooltip} style={tipStyle}>
                {getBadgeTooltip(b.key, commonName, scientificName)}
              </span>,
              document.body
            )
          }
        </div>
      ))}
    </div>
  );
}
