interface LongTaskStatusProps {
  message: string;
}

export function LongTaskStatus({ message }: LongTaskStatusProps) {
  return (
    <div className="studio-settings-hint" role="status" aria-live="polite" aria-busy="true">
      <strong>{message}</strong>
      <progress aria-label={message} />
    </div>
  );
}
