import AnamPersona from '@/components/AnamPersona';

export default function AnamDemoPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6 text-center">Anam.ai Persona Demo</h1>
      <div className="flex justify-center">
        <AnamPersona />
      </div>
    </div>
  );
}
