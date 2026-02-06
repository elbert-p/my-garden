'use client';
import { useSharedGarden } from '@/context/SharedGardenContext';
import styles from './page.module.css';

export default function SharedGardenAboutPage() {
  const { garden } = useSharedGarden();

  if (!garden) {
    return (
      <div className={styles.container}>
        <p className={styles.loading}>Loading...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.gardenImage}>
          <img src={garden.image || '/default-garden.jpg'} alt={garden.name} />
        </div>
        <h2>{garden.name}</h2>
        <p className={styles.placeholder}>Garden details coming soon.</p>
      </div>
    </div>
  );
}