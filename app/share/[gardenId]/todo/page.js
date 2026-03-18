'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSharedGarden } from '@/context/SharedGardenContext';
import PageHeader from '@/components/PageHeader';
import RichText from '@/components/RichText';
import styles from './page.module.css';

export default function SharedGardenTodoPage() {
  const router = useRouter();
  const { garden, gardenId, isTodoVisible, isLoading } = useSharedGarden();

  // Redirect to plants page if todo is private or empty
  useEffect(() => {
    if (!isLoading && garden && !isTodoVisible) {
      router.replace(`/share/${gardenId}`);
    }
  }, [isLoading, garden, isTodoVisible, gardenId, router]);

  if (!garden || !isTodoVisible) return null;

  return (
    <div className={styles.container}>
      <PageHeader title="To-Do" />
      <div className={styles.page}>
        <RichText content={garden.todoContent} />
      </div>
    </div>
  );
}