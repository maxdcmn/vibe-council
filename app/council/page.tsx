import Council from '@/components/Council';

export default function CouncilPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6 text-center">The Vibe Council</h1>
      <p className="text-center mb-8 text-muted-foreground">
        Witness a conversation between two AI agents: The Optimist and The Pessimist.
      </p>
      <Council />
    </div>
  );
}
