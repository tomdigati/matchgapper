import { useState, useCallback } from "react";

export function useFormState(initialValues = {}) {
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const updateField = useCallback((field, value) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const reset = useCallback(() => {
    setValues(initialValues);
    setError(null);
  }, []);

  return { values, updateField, error, setError, submitting, setSubmitting, reset };
}
