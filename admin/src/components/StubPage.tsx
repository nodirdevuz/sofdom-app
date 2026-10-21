import { PageHeader } from './PageHeader';

interface StubPageProps {
  title: string;
  subtitle: string;
}

/** Заглушка раздела: заголовок + плейсхолдер. */
export function StubPage({ title, subtitle }: StubPageProps) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="mt-[26px] border border-[#ecedf0] rounded-[14px] bg-white px-5 py-16 text-center text-sm text-[#8a94a0]">
        Раздел в разработке
      </div>
    </>
  );
}
