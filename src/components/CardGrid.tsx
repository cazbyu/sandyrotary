import { ReactNode } from 'react';

interface CardGridProps {
  children: ReactNode;
}

export function CardGrid({ children }: CardGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      {children}
    </div>
  );
}
