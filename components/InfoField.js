'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import RichText from './RichText';
import RichTextEditor from './RichTextEditor';
import styles from './InfoField.module.css';

// Default date formatter that handles timezone correctly
const defaultDateFormat = (dateStr) => {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function InfoField({
  label,
  value,
  onChange,
  onSave,
  isEditing: parentIsEditing,
  type = 'text',
  options = [],
  placeholder = '',
  emptyText = 'Not set',
  size = 'normal',
  formatDisplay
}) {
  const [isFieldEditing, setIsFieldEditing] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);
  const [justActivated, setJustActivated] = useState(false);
  const containerRef = useRef(null);
  const dropdownTriggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const updateDropdownPosition = useCallback(() => {
    if (dropdownTriggerRef.current) {
      const rect = dropdownTriggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = Math.min(options.length * 42 + 12, 280);
      const shouldPositionAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
      setDropdownPosition({
        top: shouldPositionAbove ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 160)
      });
    }
  }, [options.length]);

  useEffect(() => {
    if (isDropdownOpen) {
      updateDropdownPosition();
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
    }
    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [isDropdownOpen, updateDropdownPosition]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (justActivated) return;
      const isClickInsideContainer = containerRef.current && containerRef.current.contains(e.target);
      const isClickInsideDropdown = dropdownRef.current && dropdownRef.current.contains(e.target);
      if (!isClickInsideContainer && !isClickInsideDropdown) {
        if (isFieldEditing) {
          setIsFieldEditing(false);
          setIsDropdownOpen(false);
          if (onSave) onSave();
        }
      }
    };
    if (isFieldEditing) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFieldEditing, onSave, justActivated]);

  useEffect(() => {
    if (justActivated) {
      const timer = setTimeout(() => setJustActivated(false), 100);
      return () => clearTimeout(timer);
    }
  }, [justActivated]);

  useEffect(() => {
    if (isFieldEditing && inputRef.current && (type === 'text' || type === 'textarea')) {
      inputRef.current.focus();
    }
  }, [isFieldEditing, type]);

  useEffect(() => {
    if (!parentIsEditing && isFieldEditing) {
      setIsFieldEditing(false);
      setIsDropdownOpen(false);
    }
  }, [parentIsEditing]);

  const formatDisplayValue = () => {
    if (type === 'multiselect' && Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : emptyText;
    }
    if (type === 'date' && value) {
      return formatDisplay ? formatDisplay(value) : defaultDateFormat(value);
    }
    return value || emptyText;
  };

  const handleFieldClick = (e) => {
    if (!isFieldEditing) {
      e.preventDefault();
      e.stopPropagation();
      setJustActivated(true);
      setIsFieldEditing(true);
      if (type === 'multiselect' || type === 'dropdown') {
        setIsDropdownOpen(true);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && type === 'text') {
      e.preventDefault();
      setIsFieldEditing(false);
      if (onSave) onSave();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsFieldEditing(false);
      setIsDropdownOpen(false);
      if (onSave) onSave();
    }
  };

  const handleMultiSelectToggle = (option) => {
    const optionValue = typeof option === 'object' ? option.value : option;
    const currentValues = Array.isArray(value) ? value : [];
    if (currentValues.includes(optionValue)) {
      onChange(currentValues.filter(v => v !== optionValue));
    } else {
      onChange([...currentValues, optionValue]);
    }
  };

  const handleSingleSelect = (option) => {
    const optionValue = typeof option === 'object' ? option.value : option;
    onChange(optionValue);
    setIsDropdownOpen(false);
    setIsFieldEditing(false);
    if (onSave) onSave();
  };

  const getOptionLabel = (option) => typeof option === 'object' ? option.label : option;
  const getOptionValue = (option) => typeof option === 'object' ? option.value : option;

  const renderDropdownPortal = () => {
    if (!isDropdownOpen || !mounted) return null;
    const selectedValues = type === 'multiselect' ? (Array.isArray(value) ? value : []) : null;
    return createPortal(
      <div
        ref={dropdownRef}
        className={styles.dropdownMenuPortal}
        style={{ top: dropdownPosition.top, left: dropdownPosition.left, width: dropdownPosition.width }}
      >
        {options.map((option, index) => {
          const optValue = getOptionValue(option);
          const isSelected = type === 'multiselect'
            ? selectedValues.includes(optValue)
            : value === optValue;
          return (
            <button
              key={index}
              type="button"
              className={`${styles.dropdownItem} ${isSelected ? styles.dropdownItemSelected : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                type === 'multiselect' ? handleMultiSelectToggle(option) : handleSingleSelect(option);
              }}
            >
              {type === 'multiselect' && (
                <span className={`${styles.checkbox} ${isSelected ? styles.checkboxChecked : ''}`}>
                  {isSelected && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </span>
              )}
              <span>{getOptionLabel(option)}</span>
              {type === 'dropdown' && isSelected && (
                <svg className={styles.checkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              )}
            </button>
          );
        })}
      </div>,
      document.body
    );
  };

  const renderInput = () => {
    switch (type) {
      case 'text':
        return (
          <input ref={inputRef} type="text" value={value || ''} onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown} className={styles.input}
            placeholder={placeholder || `Enter ${label.toLowerCase()}...`} />
        );
      case 'textarea':
        return (
          <RichTextEditor
            value={value || ''}
            onChange={(val) => onChange(val)}
            placeholder={placeholder || `Enter ${label.toLowerCase()}...`}
            minRows={3}
          />
        );
      case 'date':
        return (
          <input ref={inputRef} type="date" value={value || ''} onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown} className={styles.input} />
        );
      case 'radio':
        return (
          <div className={styles.radioGroup}>
            {options.map((option, index) => (
              <label key={index} className={styles.radioLabel}>
                <input type="radio" name={label} value={getOptionValue(option)}
                  checked={value === getOptionValue(option)}
                  onChange={() => handleSingleSelect(option)} className={styles.radioInput} />
                <span className={styles.radioText}>{getOptionLabel(option)}</span>
              </label>
            ))}
          </div>
        );
      case 'dropdown':
      case 'multiselect': {
        const selectedValues = type === 'multiselect' ? (Array.isArray(value) ? value : []) : null;
        return (
          <div className={styles.dropdownContainer}>
            <button ref={dropdownTriggerRef} type="button" className={styles.dropdownTrigger}
              onClick={(e) => { e.stopPropagation(); setIsDropdownOpen(!isDropdownOpen); }}>
              <span className={styles.dropdownTriggerText}>
                {type === 'multiselect'
                  ? (selectedValues.length > 0 ? selectedValues.join(', ') : placeholder || 'Select...')
                  : (value || placeholder || 'Select...')}
              </span>
              <svg className={`${styles.dropdownArrow} ${isDropdownOpen ? styles.dropdownArrowOpen : ''}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            {renderDropdownPortal()}
          </div>
        );
      }
      default:
        return (
          <input ref={inputRef} type="text" value={value || ''} onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown} className={styles.input} placeholder={placeholder} />
        );
    }
  };

  const isEmpty = !value || (Array.isArray(value) && value.length === 0);
  const isActive = isFieldEditing || parentIsEditing;

  return (
    <div
      ref={containerRef}
      className={`${styles.infoField} ${isActive ? styles.infoFieldActive : ''} ${size === 'large' ? styles.infoFieldLarge : ''}`}
      onClick={handleFieldClick}
    >
      <div className={styles.labelRow}>
        <label className={styles.label}>{label}</label>
        {!isActive && (
          <svg className={styles.editHint} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        )}
      </div>
      {isActive ? (
        renderInput()
      ) : type === 'textarea' && !isEmpty ? (
        <div className={styles.text}>
          <RichText content={value} />
        </div>
      ) : (
        <p className={`${styles.text} ${isEmpty ? styles.textEmpty : ''}`}>
          {formatDisplayValue()}
        </p>
      )}
    </div>
  );
}