import { useFormState, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form';

interface FormErrorSummaryProps<TInput extends FieldValues, TOutput> {
  form: UseFormReturn<TInput, unknown, TOutput>;
  /** Field names to their labels. */
  labels: Partial<Record<Path<TInput>, string>>;
}

/** An announced list of what is wrong, each entry moving focus to its field. */
export function FormErrorSummary<TInput extends FieldValues, TOutput>({
  form,
  labels,
}: FormErrorSummaryProps<TInput, TOutput>) {
  // useFormState, not form.formState: the Compiler memoises on the stable `form` object,
  // so reading through it can go stale.
  const formState = useFormState({ control: form.control });
  const names = Object.keys(labels) as Path<TInput>[];
  const invalid = names.filter((name) => form.getFieldState(name, formState).invalid);

  if (invalid.length === 0) return null;

  return (
    <div role="alert" className="rounded-card border-danger-border bg-danger-subtle border p-3">
      <p className="text-foreground text-sm font-semibold">Please fix these first</p>
      <ul className="mt-1 space-y-0.5">
        {invalid.map((name) => (
          <li key={name}>
            <button
              type="button"
              onClick={() => {
                form.setFocus(name);
              }}
              className="text-danger-strong text-start text-sm underline"
            >
              {labels[name]}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
