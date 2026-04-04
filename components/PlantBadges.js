'use client';
import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getPlantBadges } from '@/lib/plantBadges';
import styles from './PlantBadges.module.css';

const BADGE_LABELS = {
  bee: 'Bee Badge',
};

export default function PlantBadges({ commonName, scientificName }) {
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
    <div className={styles.container}>
      {badges.map((b) => (
        <div
          key={b.key}
          className={styles.badge}
          onMouseEnter={(e) => showTip(e, b.key)}
          onMouseLeave={hideTip}
          onClick={(e) => handleClick(e, b.key)}
        >
          <img src={b.icon} alt={BADGE_LABELS[b.key] || b.key} className={styles.icon} />
          {activeTip === b.key && typeof document !== 'undefined' &&
            createPortal(
              <span className={styles.tooltip} style={tipStyle}>
                {BADGE_LABELS[b.key] || b.key}
              </span>,
              document.body
            )
          }
        </div>
      ))}
    </div>
  );
}
