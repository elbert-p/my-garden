import Link from 'next/link';
import { IoLeaf } from 'react-icons/io5';
import styles from './page.module.css';

export const metadata = {
  title: 'My Garden — Catalog and share your garden plants',
  description:
    'My Garden is a free web app for cataloging the plants in your garden, keeping notes and photos, and optionally sharing your gardens with others.',
};

export default function WelcomePage() {
  return (
    <main className={styles.page}>
      {/* Hero */}
      <header className={styles.hero}>
        <div className={styles.logo} aria-label="My Garden logo" role="img">
          <IoLeaf size={40} />
        </div>
        <h1 className={styles.title}>My Garden</h1>
        <p className={styles.tagline}>
          A simple, free web app for cataloging the plants in your garden — with photos, notes, and
          optional sharing.
        </p>
        <div className={styles.ctaRow}>
          <Link href="/" className={styles.ctaPrimary}>Open the app</Link>
          <a href="#data" className={styles.ctaSecondary}>How sign-in works</a>
        </div>
      </header>

      <div className={styles.container}>
        {/* What it does */}
        <section className={styles.section}>
          <h2 className={styles.heading}>What My Garden does</h2>
          <p>
            My Garden lets you build a personal catalog of your plants. You can create gardens, add
            plants to them, and record details for each one so you have everything in a single place:
          </p>
          <ul className={styles.list}>
            <li>Plant details like bloom time, height, sunlight, moisture, native range, plant type, and the insects a plant hosts</li>
            <li>Your own notes and photos for each plant</li>
            <li>Suggested plant info that autofills common plants, so entering plants is quick</li>
            <li>Public share links for a garden or your whole profile — with per-plant and per-garden privacy controls so you decide what&rsquo;s shown</li>
          </ul>
          <p>
            You can use My Garden without an account — your data is saved in your browser. Signing in
            simply saves it to your account so it&rsquo;s available on any device.
          </p>
        </section>

        {/* Data / sign-in transparency (required by Google) */}
        <section className={styles.section} id="data">
          <h2 className={styles.heading}>Why we ask you to sign in with Google</h2>
          <p>
            Signing in is optional and only used to save your gardens to your own account so you can
            access them across devices and share them. When you sign in with Google, the app receives
            only your <strong>name, email address, and profile picture</strong>. That&rsquo;s used to
            create and identify your account — nothing more.
          </p>
          <p>
            The app never receives your Google password and cannot access Gmail, Google Drive, or any
            other Google service. We don&rsquo;t sell your data or use it for advertising. For the full
            details, see the{' '}
            <Link href="/privacy" className={styles.link}>Privacy Policy</Link> and{' '}
            <Link href="/terms" className={styles.link}>Terms of Service</Link>.
          </p>
        </section>
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerLinks}>
          <Link href="/" className={styles.link}>Open the app</Link>
          <Link href="/privacy" className={styles.link}>Privacy Policy</Link>
          <Link href="/terms" className={styles.link}>Terms of Service</Link>
          <a href="mailto:philipelbert7@gmail.com" className={styles.link}>Contact</a>
        </div>
        <p className={styles.footerNote}>
          My Garden is an independently built project. Questions? Email{' '}
          <a href="mailto:philipelbert7@gmail.com" className={styles.link}>philipelbert7@gmail.com</a>.
        </p>
      </footer>
    </main>
  );
}
