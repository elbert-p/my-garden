import Link from 'next/link';
import styles from './page.module.css';

export const metadata = {
  title: 'Privacy Policy — My Garden',
  description: 'What My Garden stores and how it is used.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <Link href="/" className={styles.back}>← Back to My Garden</Link>

        <h1 className={styles.title}>Privacy Policy</h1>
        <p className={styles.updated}>Last updated: August 7, 2026</p>

        <p>
          My Garden is a personal, independently built web app for cataloging the plants in your
          garden and, if you want, sharing them. This page explains what it stores and why. It&rsquo;s
          maintained by one developer, not a company.
        </p>

        <h2 className={styles.heading}>What&rsquo;s stored</h2>
        <ul className={styles.list}>
          <li>
            <strong>Your Google account basics.</strong> When you sign in with Google I receive your
            name, email, and profile picture — nothing else. I never see your password and can&rsquo;t
            access Gmail, Drive, or any other Google data.
          </li>
          <li>
            <strong>What you add to the app.</strong> Your gardens and plants (names, bloom time,
            height, sunlight, moisture, native range, plant type, hosted insects, dates, and notes),
            the images you upload, gardens you save or recently viewed, and your sharing preferences.
          </li>
        </ul>

        <h2 className={styles.heading}>Where it&rsquo;s stored</h2>
        <p>
          Data lives in Supabase (database and image storage), and the app is hosted on Vercel. Two
          things worth knowing: uploaded images are served from public image URLs, and if you use the
          app <em>without</em> signing in, your data stays only in your browser — if you later sign
          in, it&rsquo;s copied up to your account so you don&rsquo;t lose it.
        </p>

        <h2 className={styles.heading}>Sharing</h2>
        <p>
          Sharing is opt-in. If you make a garden or profile public or send someone a share link,
          anyone with that link can view what you&rsquo;ve shared. You can mark individual plants or
          gardens as private so they stay hidden.
        </p>

        <h2 className={styles.heading}>Analytics</h2>
        <p>
          I use Vercel Analytics to see aggregate, anonymized usage (like which pages get visited) to
          improve the app. There are no ads, and I don&rsquo;t sell your data.
        </p>

        <h2 className={styles.heading}>Deleting your data</h2>
        <p>
          You can delete individual plants, gardens, and images anytime in the app. To delete your
          whole account, or to revoke the app&rsquo;s access to your Google account (also possible from
          your Google Account settings), just email me.
        </p>

        <h2 className={styles.heading}>Contact</h2>
        <p>
          Questions? Email{' '}
          <a className={styles.link} href="mailto:philipelbert7@gmail.com">philipelbert7@gmail.com</a>.
          If this policy changes, the date above will change too.
        </p>
      </div>
    </main>
  );
}
