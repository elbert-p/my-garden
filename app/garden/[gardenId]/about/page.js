'use client';
import { useGarden } from '@/context/GardenContext';
import styles from './page.module.css';

export default function GardenAboutPage() {
  const { garden } = useGarden();

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
        <p className={styles.placeholder}>Garden details and statistics coming soon.</p>
      </div>
    </div>
  );
}