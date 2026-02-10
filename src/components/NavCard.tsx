import { Link } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';

interface NavCardProps {
  to?: string;
  icon: LucideIcon;
  label: string;
  external?: boolean;
  onClick?: () => void;
}

export function NavCard({ to, icon: Icon, label, external = false, onClick }: NavCardProps) {
  const cardClasses = "bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 p-6 flex flex-col items-center justify-center gap-3 min-h-[140px] active:scale-95";

  const content = (
    <>
      <div className="w-12 h-12 rounded-full bg-[#1B2A4A] flex items-center justify-center">
        <Icon className="w-6 h-6 text-white" />
      </div>
      <span className="text-[#2D3748] font-semibold text-center text-base">
        {label}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className={cardClasses}>
        {content}
      </button>
    );
  }

  if (external && to) {
    return (
      <a
        href={to}
        target="_blank"
        rel="noopener noreferrer"
        className={cardClasses}
      >
        {content}
      </a>
    );
  }

  if (to) {
    return (
      <Link to={to} className={cardClasses}>
        {content}
      </Link>
    );
  }

  return null;
}
