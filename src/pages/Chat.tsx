import { JarvisChat } from "@/components/jarvis/JarvisChat";

export default function Chat() {
  return (
    <div className="h-[calc(100vh-4rem)] md:h-[calc(100vh-5rem)] mx-auto w-full max-w-4xl">
      <JarvisChat variant="page" />
    </div>
  );
}
