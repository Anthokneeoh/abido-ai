import { AudioRecorder } from "@/components/AudioRecorder";

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2a2a20] via-[#1a1a1a] to-black p-4 font-sans text-white">
            <AudioRecorder />
        </main>
    );
}