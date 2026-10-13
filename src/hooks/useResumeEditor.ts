import { useCallback, useState } from 'react';
import { getTextAlignment, removeTextAlignmentPrefix, setTextAlignment } from '../lib/alignment';
import { createDefaultState, updateTimestamp } from '../lib/defaults';
import { formatPhoneNumberInput, formatPostalCodeInput, validateEmailInput } from '../lib/inputFormat';
import type {
  AccommodationData,
  BasicInfo,
  HistoryEntry,
  QualificationEntry,
  ResumeData,
  TextAlignment,
} from '../lib/types';

type BasicFieldErrorMap = Partial<Record<keyof BasicInfo, string>>;
type RowKind = 'histories' | 'qualifications';

const newId = () => crypto.randomUUID();

const validateBasicField = (key: keyof BasicInfo, value: string): string => {
  switch (key) {
    case 'postalCode':
    case 'contactPostalCode':
      return formatPostalCodeInput(value).error;
    case 'phone':
    case 'contactPhone':
      return formatPhoneNumberInput(value).error;
    case 'email':
      return validateEmailInput(value);
    default:
      return '';
  }
};

export function useResumeEditor(createInitialState = createDefaultState) {
  const [state, setState] = useState(createInitialState);
  const [basicFieldErrors, setBasicFieldErrors] = useState<BasicFieldErrorMap>({});
  const resume = state.resume;
  const accommodation = state.accommodation;

  const setResume = useCallback((updater: (resume: ResumeData) => ResumeData) => {
    setState((current) => ({ ...current, resume: updateTimestamp(updater(current.resume)) }));
  }, []);

  const setAccommodation = useCallback((updater: (data: AccommodationData) => AccommodationData) => {
    setState((current) => ({ ...current, accommodation: updater(current.accommodation) }));
  }, []);

  const setBasicFieldError = useCallback((key: keyof BasicInfo, error: string) => {
    setBasicFieldErrors((current) => {
      const next = { ...current };
      if (error) next[key] = error;
      else delete next[key];
      return next;
    });
  }, []);

  const clearBasicFieldErrors = useCallback(() => setBasicFieldErrors({}), []);

  const updateBasic = useCallback((key: keyof BasicInfo, value: string) => {
    setResume((current) => ({ ...current, basic: { ...current.basic, [key]: value } }));
    if (basicFieldErrors[key]) setBasicFieldError(key, validateBasicField(key, value));
  }, [basicFieldErrors, setBasicFieldError, setResume]);

  const handleBasicFieldBlur = useCallback((key: keyof BasicInfo) => {
    const value = resume.basic[key];
    const error = validateBasicField(key, value);
    let nextValue = value;

    if (!error) {
      if (key === 'postalCode' || key === 'contactPostalCode') {
        nextValue = formatPostalCodeInput(value).value;
      } else if (key === 'phone' || key === 'contactPhone') {
        nextValue = formatPhoneNumberInput(value).value;
      }
    }

    if (nextValue !== value) {
      setResume((current) => ({ ...current, basic: { ...current.basic, [key]: nextValue } }));
    }
    setBasicFieldError(key, error);
  }, [resume.basic, setBasicFieldError, setResume]);

  const updateResumeField = useCallback(<K extends keyof ResumeData>(key: K, value: ResumeData[K]) => {
    setResume((current) => ({ ...current, [key]: value }));
  }, [setResume]);

  const updateAccommodationField = useCallback((key: keyof AccommodationData, value: string | boolean) => {
    setAccommodation((current) => ({ ...current, [key]: value }));
  }, [setAccommodation]);

  const updateResumeAlignment = useCallback((key: string, alignment: TextAlignment) => {
    setResume((current) => ({
      ...current,
      textAlignments: setTextAlignment(current.textAlignments, key, alignment),
    }));
  }, [setResume]);

  const updateAccommodationAlignment = useCallback((key: string, alignment: TextAlignment) => {
    setAccommodation((current) => ({
      ...current,
      textAlignments: setTextAlignment(current.textAlignments, key, alignment),
    }));
  }, [setAccommodation]);

  const resumeAlignmentProps = useCallback((key: string) => ({
    alignment: getTextAlignment(resume.textAlignments, key),
    onAlignmentChange: (alignment: TextAlignment) => updateResumeAlignment(key, alignment),
  }), [resume.textAlignments, updateResumeAlignment]);

  const accommodationAlignmentProps = useCallback((key: string) => ({
    alignment: getTextAlignment(accommodation.textAlignments, key),
    onAlignmentChange: (alignment: TextAlignment) => updateAccommodationAlignment(key, alignment),
  }), [accommodation.textAlignments, updateAccommodationAlignment]);

  const updateHistory = useCallback((id: string, patch: Partial<HistoryEntry>) => {
    setResume((current) => ({
      ...current,
      histories: current.histories.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }, [setResume]);

  const updateQualification = useCallback((id: string, patch: Partial<QualificationEntry>) => {
    setResume((current) => ({
      ...current,
      qualifications: current.qualifications.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }, [setResume]);

  const addHistory = useCallback(() => {
    setResume((current) => ({
      ...current,
      histories: [...current.histories, { id: newId(), year: '', month: '', text: '' }],
    }));
  }, [setResume]);

  const addQualification = useCallback(() => {
    setResume((current) => ({
      ...current,
      qualifications: [...current.qualifications, { id: newId(), year: '', month: '', text: '' }],
    }));
  }, [setResume]);

  const removeRow = useCallback((kind: RowKind, id: string) => {
    setResume((current) => ({
      ...current,
      [kind]: current[kind].filter((item) => item.id !== id),
      textAlignments: removeTextAlignmentPrefix(current.textAlignments, `${kind}.${id}.`),
    }));
  }, [setResume]);

  const moveRow = useCallback((kind: RowKind, id: string, direction: -1 | 1) => {
    setResume((current) => {
      const rows = [...current[kind]];
      const index = rows.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= rows.length) return current;
      [rows[index], rows[target]] = [rows[target], rows[index]];
      return { ...current, [kind]: rows };
    });
  }, [setResume]);

  return {
    state,
    setState,
    resume,
    accommodation,
    basicFieldErrors,
    clearBasicFieldErrors,
    setResume,
    updateBasic,
    handleBasicFieldBlur,
    updateResumeField,
    updateAccommodationField,
    updateResumeAlignment,
    updateAccommodationAlignment,
    resumeAlignmentProps,
    accommodationAlignmentProps,
    updateHistory,
    updateQualification,
    addHistory,
    addQualification,
    removeRow,
    moveRow,
  };
}
