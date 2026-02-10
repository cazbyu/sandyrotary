import { Layout } from './Layout';
import { LucideIcon } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  icon: LucideIcon;
}

export function PlaceholderPage({ title, icon: Icon }: PlaceholderPageProps) {
  return (
    <Layout>
      <div className="p-6">
        <div className="bg-white rounded-2xl shadow-md p-8 text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon className="w-10 h-10 text-[#1B2A4A]" />
          </div>
          <h1 className="text-2xl font-bold text-[#1B2A4A] mb-2">{title}</h1>
          <p className="text-gray-600">Coming Soon</p>
        </div>
      </div>
    </Layout>
  );
}
