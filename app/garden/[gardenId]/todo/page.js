'use client';
import { useState, useEffect, useRef } from 'react';
import { FiEdit, FiEye, FiEyeOff } from 'react-icons/fi';
import { useGarden } from '@/context/GardenContext';
import PageHeader from '@/components/PageHeader';
import DropdownMenu from '@/components/DropdownMenu';
import Button from '@/components/Button';
import RichText from '@/components/RichText';
import RichTextEditor from '@/components/RichTextEditor';
import styles from './page.module.css';

export default function GardenTodoPage() {
  const { garden, user, updateGardenTodo, updateGardenCustomization } = useGarden();
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [justActivated, setJustActivated] = useState(false);
  const editorRef = useRef(null);

  // Hidden by default — only visible when explicitly set to false
  const isTodoHidden = garden?.customization?.todoPrivate !== false;

  useEffect(() => {
    if (garden && !editing) setContent(garden.todoContent || '');
  }, [garden?.todoContent, editing]);

  useEffect(() => {
    if (justActivated) {
      const t = setTimeout(() => setJustActivated(false), 100);
      return () => clearTimeout(t);
    }
  }, [justActivated]);

  useEffect(() => {
    if (!editing) return;
    const handleOutside = (e) => {
      if (justActivated) return;
      if (editorRef.current && !editorRef.current.contains(e.target)) {
        saveAndClose();
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [editing, justActivated, content]);

  useEffect(() => {
    if (!editing) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setContent(garden?.todoContent || '');
        setEditing(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [editing, garden?.todoContent]);

  if (!garden) return null;

  const saveAndClose = async () => {
    setSaving(true);
    await updateGardenTodo(content);
    setSaving(false);
    setEditing(false);
  };

  const startEditing = () => {
    setJustActivated(true);
    setEditing(true);
  };

  const toggleTodoPrivacy = async () => {
    const existing = garden?.customization || {};
    await updateGardenCustomization({ ...existing, todoPrivate: isTodoHidden ? false : true });
  };

  const menuItems = [
    { icon: <FiEdit size={16} />, label: 'Edit', onClick: startEditing },
    {
      icon: isTodoHidden ? <FiEye size={16} /> : <FiEyeOff size={16} />,
      label: isTodoHidden ? 'Show on Share' : 'Hide from Share',
      onClick: toggleTodoPrivacy,
    },
  ];

  const editingActions = (
    <div className={styles.headerActions}>
      <Button variant="secondary" onClick={() => { setContent(garden.todoContent || ''); setEditing(false); }}>Cancel</Button>
      <Button onClick={saveAndClose} disabled={saving}>{saving ? 'Saving...' : 'Done'}</Button>
    </div>
  );

  return (
    <div className={styles.container}>
      <PageHeader
        title="To-Do"
        actions={
          editing ? editingActions : user ? (
            <DropdownMenu items={menuItems} />
          ) : (
            <button className={styles.editIconButton} onClick={startEditing} aria-label="Edit">
              <FiEdit size={18} />
            </button>
          )
        }
      />

      <div
        ref={editorRef}
        className={`${styles.page} ${!editing ? styles.pageClickable : ''} ${editing ? styles.pageActive : ''}`}
        onClick={() => !editing && startEditing()}
      >
        {editing ? (
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="Add tasks, notes, reminders..."
            minRows={8}
          />
        ) : content ? (
          <RichText content={content} />
        ) : (
          <p className={styles.empty}>Add tasks, notes, reminders...</p>
        )}
      </div>
    </div>
  );
}